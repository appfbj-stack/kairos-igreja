/**
 * Orquestrador do agente IA do Kairos Igreja.
 *
 * v2.11.0: MiniMax (Plano Mensal Plus) como provider principal,
 *          com OpenRouter como fallback opcional.
 *
 * Fluxo:
 *   1. Recebe mensagem do usuário + contexto (tenant, role, congregação)
 *   2. Carrega histórico da conversa (memória in-process por usuário)
 *   3. Constrói system prompt com regras + tools filtradas pelo role
 *   4. Loop:
 *      - Envia histórico + mensagem atual + tools pro LLM
 *      - Se LLM pede tool: executa, manda resultado de volta
 *      - Se LLM responde texto: devolve pro frontend (strip <think>...</think>)
 *   5. Salva turno no histórico (max 8 turnos = 16 mensagens)
 *   6. Limita a 5 iterações pra evitar loops infinitos
 *
 * Providers (prioridade):
 *   1. MINIMAX_API_KEY → MiniMax-M3 (512k contexto, rápido, suporta tools)
 *   2. OPENROUTER_API_KEY → modelo nex-2.5-mini:free (fallback)
 */

import { toolsForRole, toolsToOpenRouterSchema, ToolDefinition, AgentContext } from "./tools.js";
import { env } from "../../config/env";

export interface ChatRequest {
  message: string;
  conversationId?: string;
}

export interface ChatResponse {
  ok: boolean;
  message: string;
  tool?: string;
  data?: unknown;
  suggestions?: string[];
  modelUsed?: string;
  iterations?: number;
}

const MINIMAX_URL = "https://api.minimax.io/v1/chat/completions";
const MINIMAX_MODEL = "MiniMax-M3";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "nex-agi/nex-n2.5-mini:free";
const MAX_ITERATIONS = 5;
const FETCH_TIMEOUT_MS = 60_000; // MiniMax costuma responder em <5s; 60s é folga
const MAX_HISTORY_TURNS = 8; // 8 turnos = 16 mensagens (user+assistant cada)

/** Provider ativo baseado nas chaves disponíveis. */
function pickProvider(): { name: string; url: string; model: string; apiKey: string } {
  const minimaxKey = process.env.MINIMAX_API_KEY ?? env.MINIMAX_API_KEY;
  const openrouterKey = process.env.OPENROUTER_API_KEY ?? env.OPENROUTER_API_KEY;
  if (minimaxKey) {
    return { name: "minimax", url: MINIMAX_URL, model: MINIMAX_MODEL, apiKey: minimaxKey };
  }
  if (openrouterKey) {
    return { name: "openrouter", url: OPENROUTER_URL, model: OPENROUTER_MODEL, apiKey: openrouterKey };
  }
  return { name: "none", url: "", model: "", apiKey: "" };
}

/** Strip <think>...</think> do conteúdo (MiniMax M3 mete raciocínio inline). */
function stripThinking(text: string | undefined): string {
  if (!text) return "";
  // Remove blocos <think>...</think> (inclusive multiline). Sem isso o usuário vê o "pensamento" do agente.
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

/**
 * Histórico de conversa em memória (por usuário).
 * Persiste durante o processo do Node, reseta em restart.
 * Map<userId, Message[]> — máximo MAX_HISTORY_TURNS * 2 mensagens por usuário.
 */
const conversationHistory = new Map<string, Message[]>();

function getHistory(userId: string): Message[] {
  return conversationHistory.get(userId) ?? [];
}

function appendHistory(userId: string, ...msgs: Message[]): void {
  const current = conversationHistory.get(userId) ?? [];
  const updated = [...current, ...msgs];
  // Corta se passar do limite
  const maxMsgs = MAX_HISTORY_TURNS * 2;
  if (updated.length > maxMsgs) {
    updated.splice(0, updated.length - maxMsgs);
  }
  conversationHistory.set(userId, updated);
}

function clearHistory(userId: string): void {
  conversationHistory.delete(userId);
}

/**
 * Estado de "último membro criado" por usuário.
 * Usado pra auto-editar: se o usuário enviar dados logo após cadastrar
 * (ex: "telefone 159..."), o sistema já edita direto, sem depender do LLM.
 * Reseta em "limpar" e em restart.
 */
interface LastMemberAction {
  memberId: string;
  memberName: string;
  tool: "igreja:cadastrar-membro" | "igreja:editar-membro";
}
const lastMemberActionByUser = new Map<string, LastMemberAction | null>();

function setLastMemberAction(userId: string, action: LastMemberAction | null) {
  if (action === null) lastMemberActionByUser.delete(userId);
  else lastMemberActionByUser.set(userId, action);
}
function getLastMemberAction(userId: string): LastMemberAction | null {
  return lastMemberActionByUser.get(userId) ?? null;
}

/**
 * Detecta se a mensagem do usuário parece ser DADOS após um cadastro
 * (telefone, CPF, email, data, endereço). Se sim + existe lastMemberAction,
 * auto-edita direto sem LLM.
 *
 * Retorna `null` se não parece ser dados editáveis; ou um objeto `{ field, value }`.
 */
function detectQuickEditData(msg: string): { field: string; value: string } | null {
  const t = msg.trim();

  // Telefone: "telefone 1599...", "celular 11...", "fone 99999-9999", ou só dígitos >= 8
  const phoneMatch = t.match(/^(?:telefone|celular|fone|whats|whatsapp|zap|tel)[:\s]+(.+)/i);
  if (phoneMatch) return { field: "phone", value: phoneMatch[1].trim() };
  if (/^\d{8,}$/.test(t.replace(/\D/g, "")) && t.replace(/\D/g, "").length >= 8) {
    return { field: "phone", value: t.trim() };
  }

  // CPF: "cpf 12345678900" ou só 11 dígitos
  const cpfMatch = t.match(/^(?:cpf)[:\s]+(.+)/i);
  if (cpfMatch) return { field: "cpf", value: cpfMatch[1].replace(/\D/g, "") };
  if (/^\d{11}$/.test(t.replace(/\D/g, ""))) {
    return { field: "cpf", value: t.replace(/\D/g, "") };
  }

  // Email
  const emailMatch = t.match(/^(?:email|e-mail)[:\s]+(.+)/i);
  if (emailMatch) return { field: "email", value: emailMatch[1].trim() };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return { field: "email", value: t.trim() };

  // Data de nascimento
  const birthMatch = t.match(/^(?:nascimento|nascido|nasc|aniversario|aniversário)[:\s]+(.+)/i);
  if (birthMatch) return { field: "birthDate", value: birthMatch[1].trim() };

  // Endereço
  const addrMatch = t.match(/^(?:endere[çc]o|rua|av|avenida)[:\s]+(.+)/i);
  if (addrMatch) return { field: "address", value: addrMatch[1].trim() };

  // Batismo
  const baptismMatch = t.match(/^(?:batismo|batizado|batizada)[:\s]+(.+)/i);
  if (baptismMatch) return { field: "baptismDate", value: baptismMatch[1].trim() };

  // Filiação
  const filiationMatch = t.match(/^(?:filia[çc][ãa]o|pai|mae|m[ãa]e)[:\s]+(.+)/i);
  if (filiationMatch) return { field: "filiation", value: filiationMatch[1].trim() };

  return null;
}

function buildSystemPrompt(ctx: AgentContext): string {
  const tools = toolsForRole(ctx.role);
  const isAdmin = ctx.role === "SUPER_ADMIN" || ctx.role === "ADMIN";
  const filtroCong = !isAdmin && ctx.congregationId
    ? `\n\nVocê está limitado à congregação "${ctx.congregationId}" do usuário logado. Não liste/modifique dados de outras congregações.`
    : isAdmin
      ? `\n\nVocê tem acesso a todas as congregações do tenant.`
      : `\n\nVocê não tem congregação vinculada — apenas leitura (USUARIO).`;

  return `Você é a Secretaria IA do Kairos Igreja. Responda em PT-BR curto.

REGRA ABSOLUTA: NUNCA peça confirmação. NUNCA peça sobrenome. NUNCA diga "tem certeza?". NUNCA diga "preciso de mais dados". Apenas CHAME a tool.

USE O HISTÓRICO: olhe as mensagens anteriores da conversa. Se o usuário JÁ deu nome em turno anterior, USE ESSE NOME agora — NÃO peça de novo. Se deu telefone, use. Extraia TUDO que aparecer nas mensagens anteriores ou na mensagem atual.

INTENÇÃO → TOOL (chame IMEDIATAMENTE, sem perguntar):
- cadastrar / inscrever / registrar / novo membro / adicionar → igreja:cadastrar-membro
- buscar / procurar / quem é / telefone de → igreja:buscar-membros
- editar / atualizar / mudar / corrigir → igreja:editar-membro
- transferir / mudar de congregação → igreja:transferir-membro
- inativar / desativar / remover → igreja:inativar-membro

CADASTRO: extraia TODOS os campos que o usuário mencionar (nome, telefone, email, CPF, data nascimento, data batismo, estado civil, filiação/pai/mãe, endereço, ministérios, célula por nome). Se der só nome, cadastra só com nome — telefone é opcional. NÃO PERGUNTE NADA ANTES. NÃO peça confirmação. O nome pode ser qualquer um (curto, sem sobrenome, sem acento) — cadastra o que veio.

CAMPOS SUPORTADOS em igreja:cadastrar-membro: name (obrigatório), phone, email, birthDate, cpf, maritalStatus, status, role, congregationName, celulaName, baptismDate, filiation, address, cardValidity, ministries.

PÓS-CADASTRO: depois que cadastrar, mostre em 1 frase o que foi salvo. Se o usuário der MAIS dados (telefone, CPF, etc) depois do cadastro → use igreja:editar-membro pra atualizar o membro recém-criado. Se o usuário disser "sim", "ok", "feito" → responda só com texto curto, SEM chamar tool.

CONFLITO (conflict=true): mostre ao usuário QUEM já tem o telefone/CPF e pergunte "Cadastra mesmo assim?". Se sim → chame de novo com force=true.

REGRAS:
- Datas em ISO (YYYY-MM-DD).
- Respostas em 1 frase só.
- Use "pastor/pastora" conforme o nome do usuário logado.
- Depois de cadastrar: confirme o que foi salvo (nome, congregação). Sem perguntas extras.

USUARIO: ${ctx.userName} (${ctx.role})
TENANT: ${ctx.tenantId}${filtroCong}

TOOLS:
${tools.map((t) => `- ${t.name}: ${t.description}`).join("\n")}`;
}

export async function processChat(
  req: ChatRequest,
  ctx: AgentContext
): Promise<ChatResponse> {
  const tools = toolsForRole(ctx.role);
  const toolsSchema = toolsToOpenRouterSchema(tools);
  const toolsByName = new Map(tools.map((t) => [t.name, t]));

  // ============================================
  // COMANDO ESPECIAL: "limpar" / "reset" / "começar de novo"
  // Limpa o histórico da conversa do usuário.
  // ============================================
  const trimmed = req.message.trim().toLowerCase();
  if (["limpar", "reset", "esquecer", "começar de novo", "nova conversa", "zerar"].includes(trimmed)) {
    clearHistory(ctx.userId);
    setLastMemberAction(ctx.userId, null);
    return {
      ok: true,
      message: "Histórico da conversa limpo. Pode começar de novo! 😊",
      iterations: 0,
    };
  }

  // ============================================
  // HISTÓRICO DE CONVERSA (memória in-process)
  // Carrega turnos anteriores pra LLM ter contexto.
  // ============================================
  const history = getHistory(ctx.userId);

  // ============================================
  // AUTO-EDIT RÁPIDO (pós-cadastro)
  // Se o usuário acabou de criar um membro E agora envia dados
  // (telefone, CPF, email, etc), edita DIRETO sem LLM.
  // Isso evita alucinação do tipo "Atualizado!" sem tool_call.
  // ============================================
  const lastAction = getLastMemberAction(ctx.userId);
  const quickEdit = detectQuickEditData(req.message);
  if (lastAction && quickEdit) {
    const editarTool = tools.find((t) => t.name === "igreja:editar-membro");
    if (editarTool) {
      try {
        const result = await editarTool.execute(
          { memberId: lastAction.memberId, fields: { [quickEdit.field]: quickEdit.value } },
          ctx
        );
        const msg = `✅ Atualizei ${quickEdit.field} de **${lastAction.memberName}** com "${quickEdit.value}".`;
        appendHistory(ctx.userId, { role: "user", content: req.message });
        appendHistory(ctx.userId, { role: "assistant", content: msg });
        return {
          ok: true,
          message: msg,
          tool: "igreja:editar-membro",
          data: result,
          iterations: 0,
          modelUsed: "auto-edit",
        };
      } catch (e) {
        // Cai pro fluxo normal se der erro
        console.log(`[agent] auto_edit_failed: ${(e as Error).message}`);
      }
    }
  }

  const messages: Message[] = [
    { role: "system", content: buildSystemPrompt(ctx) },
    ...history,
    { role: "user", content: req.message },
  ];

  const provider = pickProvider();
  if (provider.apiKey === "") {
    return {
      ok: false,
      message:
        "Nenhuma LLM_API_KEY configurada. Defina MINIMAX_API_KEY (preferido) ou OPENROUTER_API_KEY no .env e reinicie.",
    };
  }
  console.log(`[agent] provider=${provider.name} model=${provider.model}`);

  let iterations = 0;
  let lastToolData: any = null;
  let lastToolName: string | undefined;
  let finalAssistantText: string | null = null;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const body: any = {
      model: provider.model,
      messages,
      tools: toolsSchema,
      // Deixa o LLM escolher. "required" causava tool_calls errados
      // (buscar quando deveria editar). O prompt é forte o suficiente.
      tool_choice: "auto",
      temperature: 0.2,
      max_tokens: 800,
    };
    // MiniMax: habilita reasoning_split pra receber thinking separado (não inline)
    if (provider.name === "minimax") {
      body.reasoning_split = true;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${provider.apiKey}`,
      "Content-Type": "application/json",
    };
    if (provider.name === "openrouter") {
      headers["HTTP-Referer"] = "https://igrejasede.fbautomacao.space";
      headers["X-Title"] = "Kairos Igreja Agent";
    }

    const res = await fetch(provider.url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    const t0 = Date.now();
    console.log(`[agent] iter=${iterations} provider=${provider.name} model=${provider.model} history=${history.length} msgs=${messages.length}`);

    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        message: `OpenRouter ${res.status}: ${text.slice(0, 200)}`,
      };
    }

    console.log(`[agent] iter=${iterations} OK in ${Date.now() - t0}ms`);

    const data = await res.json();
    const choice = data.choices?.[0];
    const msg = choice?.message;

    if (!msg) {
      return { ok: false, message: "Resposta vazia do LLM." };
    }

    // Se LLM chamou tool
    if (msg.tool_calls && msg.tool_calls.length > 0) {
      const toolCall = msg.tool_calls[0];
      const toolNameSent = toolCall.function.name;
      console.log(`[agent] tool_call: ${toolNameSent}`);
      // Mapear de volta do sanitized name → name original
      // OpenRouter/provedores podem normalizar diferente:
      // - nosso normalizer: replace de tudo que NÃO é [a-zA-Z0-9_-] por "_" → mantém "-"
      // - alguns provedores também trocam "-" por "_"
      // Comparação tolerante: ambos viram só [a-zA-Z0-9_]
      const norm = (s: string) => s.replace(/[^a-zA-Z0-9]/g, "_");
      let tool: ToolDefinition | undefined;
      for (const t of tools) {
        if (norm(t.name) === norm(toolNameSent)) {
          tool = t;
          break;
        }
      }

      if (!tool) {
        console.log(`[agent] tool_name_lookup_fail: sent=${toolNameSent}, available=${tools.map((t) => t.name).join(", ")}`);
        return { ok: false, message: `Tool "${toolNameSent}" não encontrada.` };
      }

      // Parse dos argumentos
      let args: any = {};
      try {
        args = JSON.parse(toolCall.function.arguments || "{}");
      } catch {
        args = {};
      }

      // Valida com Zod
      const parsed = tool.inputSchema.safeParse(args);
      if (!parsed.success) {
        const err = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
        // devolve erro pro LLM pra ele tentar de novo
        messages.push(msg);
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: `Erro de validação: ${err}. Tente com parâmetros válidos.`,
        });
        continue;
      }

      try {
        const result = await tool.execute(parsed.data, ctx);
        lastToolData = result;
        lastToolName = tool.name;

        // Track pra auto-editar depois do cadastro
        if (tool.name === "igreja:cadastrar-membro" && result && typeof result === "object" && (result as any).ok && (result as any).id) {
          setLastMemberAction(ctx.userId, {
            memberId: (result as any).id,
            memberName: (result as any).name,
            tool: "igreja:cadastrar-membro",
          });
        }

        // devolve pro LLM
        messages.push(msg);
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      } catch (err) {
        messages.push(msg);
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: `Erro: ${(err as Error).message}`,
        });
      }
      continue;
    }

    // LLM respondeu texto → fim
    // MiniMax pode devolver thinking inline mesmo com reasoning_split=true — strip por garantia
    const text = stripThinking(msg.content) || "(sem resposta)";
    finalAssistantText = text;
    break;
  }

  if (finalAssistantText === null) {
    return {
      ok: false,
      message: `Loop estourou após ${MAX_ITERATIONS} iterações. Tente "limpar" pra resetar.`,
    };
  }

  // ============================================
  // SALVA HISTÓRICO (apenas turnos user+assistant de texto/tool final)
  // ============================================
  appendHistory(ctx.userId, { role: "user", content: req.message });
  appendHistory(ctx.userId, { role: "assistant", content: finalAssistantText });

  return {
    ok: true,
    message: finalAssistantText,
    tool: lastToolName,
    data: lastToolData,
    iterations,
    modelUsed: `${provider.name}/${provider.model}`,
    suggestions: sugerirProximas(lastToolData, lastToolName, ctx),
  };
}

function sugerirProximas(data: any, toolName?: string, ctx?: AgentContext): string[] {
  if (!toolName || !data) return [];
  if (toolName === "igreja:buscar-membros" && data.members?.length > 0) {
    const primeiro = data.members[0];
    return [
      `detalhes do ${primeiro.name}`,
      `transferir ${primeiro.name}`,
      `cadastrar novo membro`,
    ];
  }
  if (toolName === "igreja:cadastrar-membro" && data.name) {
    return [`detalhes do ${data.name}`, `listar congregações`, `gerar carteirinha do ${data.name}`];
  }
  if (toolName === "igreja:listar-congregacoes" && data.congregations?.length > 0) {
    return data.congregations.slice(0, 3).map((c: any) => `detalhes da ${c.name}`);
  }
  return [];
}
