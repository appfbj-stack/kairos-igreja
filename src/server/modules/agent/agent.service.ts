/**
 * Orquestrador do agente IA do Kairos Igreja.
 *
 * Sprint 2.2: LLM REAL via OpenRouter (modelo free llama-3.1-8b-instruct).
 *
 * Fluxo:
 *   1. Recebe mensagem do usuário + contexto (tenant, role, congregação)
 *   2. Carrega histórico da conversa (memória in-process por usuário)
 *   3. Constrói system prompt com regras + tools filtradas pelo role
 *   4. Loop:
 *      - Envia histórico + mensagem atual + tools pro OpenRouter
 *      - Se LLM pede tool: executa, manda resultado de volta
 *      - Se LLM responde texto: devolve pro frontend
 *   5. Salva turno no histórico (max 8 turnos = 16 mensagens)
 *   6. Limita a 5 iterações pra evitar loops infinitos
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

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "nex-agi/nex-n2.5-mini:free";
const MAX_ITERATIONS = 5;
const FETCH_TIMEOUT_MS = 120_000;
const MAX_HISTORY_TURNS = 8; // 8 turnos = 16 mensagens (user+assistant cada)

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

function buildSystemPrompt(ctx: AgentContext): string {
  const tools = toolsForRole(ctx.role);
  const isAdmin = ctx.role === "SUPER_ADMIN" || ctx.role === "ADMIN";
  const filtroCong = !isAdmin && ctx.congregationId
    ? `\n\nVocê está limitado à congregação "${ctx.congregationId}" do usuário logado. Não liste/modifique dados de outras congregações.`
    : isAdmin
      ? `\n\nVocê tem acesso a todas as congregações do tenant.`
      : `\n\nVocê não tem congregação vinculada — apenas leitura (USUARIO).`;

  return `Você é a **Secretaria IA**, assistente pastoral do Kairos Igreja, em PT-BR natural.

# REGRA DE OURO — DECISÃO IMEDIATA POR TOOL
Quando o usuário pede algo, você DEVE chamar a tool correspondente IMEDIATAMENTE. NÃO pergunte "você quer buscar ou cadastrar?". O usuário já disse o que quer.

MAPA INTENÇÃO → TOOL (use sem perguntar):
- "quero cadastrar", "cadastrar um membro", "novo membro", "inscrever", "registrar", "adicionar", "incluir pessoa", "cadastra o/a [nome]" → \`igreja:cadastrar-membro\`
- "buscar", "procurar", "quem é", "telefone de", "achar" → \`igreja:buscar-membros\`
- "editar", "atualizar", "mudar", "corrigir" → \`igreja:editar-membro\`
- "transferir", "mudar de congregação" → \`igreja:transferir-membro\`
- "inativar", "desativar", "remover" → \`igreja:inativar-membro\`
- "listar congregações", "quais congregações" → \`igreja:listar-congregacoes\`

# CADASTRO — SEMPRE DIRETO
1. Se o usuário disse "cadastrar" na conversa ATUAL, e a mensagem atual é só um nome ou nome+telefone → CHAME \`igreja:cadastrar-membro\` IMEDIATAMENTE. NÃO busque antes.
2. Se a tool retornar \`conflict: true\` → mostre ao usuário QUEM já tem aquele telefone/CPF e pergunte "Cadastra mesmo assim? (sim/não)". Se sim → chame de novo com \`force=true\`.
3. Se faltar SÓ o nome → pergunte APENAS o nome. Se faltar SÓ o telefone → pergunte APENAS o telefone.
4. NUNCA invente dados que o usuário não forneceu.

# REGRAS GERAIS
- Datas em ISO (YYYY-MM-DD ou YYYY ou YYYY-MM).
- Respostas CURTAS (1-2 frases).
- Para editar/inativar/transferir: confirme com 1 frase ("Confirma? sim/não").
- Use "pastor/pastora" conforme o nome do usuário.

# CONTEXTO
- Usuário logado: ${ctx.userName} (${ctx.role})
- Tenant: ${ctx.tenantId}
${filtroCong}

# TOOLS DISPONÍVEIS
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

  const messages: Message[] = [
    { role: "system", content: buildSystemPrompt(ctx) },
    ...history,
    { role: "user", content: req.message },
  ];

  const apiKey = process.env.OPENROUTER_API_KEY ?? env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      message:
        "OPENROUTER_API_KEY não configurada no servidor. Configure no .env e reinicie.",
    };
  }

  let iterations = 0;
  let lastToolData: any = null;
  let lastToolName: string | undefined;
  let finalAssistantText: string | null = null;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    const body = {
      model: DEFAULT_MODEL,
      messages,
      tools: toolsSchema,
      tool_choice: "auto",
      temperature: 0.3,
      max_tokens: 800,
    };

    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://igrejasede.fbautomacao.space",
        "X-Title": "Kairos Igreja Agent",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    const t0 = Date.now();
    console.log(`[agent] iter=${iterations} model=${DEFAULT_MODEL} history=${history.length} msgs=${messages.length}`);

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
      let tool: ToolDefinition | undefined;
      for (const t of tools) {
        if (t.name.replace(/[^a-zA-Z0-9_-]/g, "_") === toolNameSent) {
          tool = t;
          break;
        }
      }

      if (!tool) {
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
    const text = msg.content ?? "(sem resposta)";
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
    modelUsed: DEFAULT_MODEL,
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
