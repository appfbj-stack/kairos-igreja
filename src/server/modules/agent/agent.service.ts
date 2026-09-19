/**
 * Orquestrador do agente IA do Kairos Igreja.
 *
 * Sprint 2.2: LLM REAL via OpenRouter (modelo free llama-3.1-8b-instruct).
 *
 * Fluxo:
 *   1. Recebe mensagem do usuário + contexto (tenant, role, congregação)
 *   2. Constrói system prompt com regras + tools filtradas pelo role
 *   3. Loop:
 *      - Envia mensagem + tools pro OpenRouter
 *      - Se LLM pede tool: executa, manda resultado de volta
 *      - Se LLM responde texto: devolve pro frontend
 *   4. Limita a 5 iterações pra evitar loops infinitos
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

interface Message {
  role: "system" | "user" | "assistant" | "tool";
  content?: string;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

function buildSystemPrompt(ctx: AgentContext): string {
  const tools = toolsForRole(ctx.role);
  const isAdmin = ctx.role === "SUPER_ADMIN" || ctx.role === "ADMIN";
  const filtroCong = !isAdmin && ctx.congregationId
    ? `\n\nVocê está limitado à congregação "${ctx.congregationId}" do usuário logado. Não liste/modifique dados de outras congregações.`
    : isAdmin
      ? `\n\nVocê tem acesso a todas as congregações do tenant.`
      : `\n\nVocê não tem congregação vinculada — apenas leitura (USUARIO).`;

  return `# IDENTIDADE
Você é a **Secretaria IA**, assistente pastoral do Kairos Igreja.
Você ajuda pastoras, pastores, secretárias e tesoureiros via chat em PT-BR natural.

# INTENÇÕES (reconheça desde a primeira mensagem!)
Quando o usuário disser QUALQUER uma destas frases, entre IMEDIATAMENTE no fluxo correspondente SEM perguntar de novo:
- **CADASTRO**: "quero cadastrar", "cadastrar um membro", "novo membro", "inscrever", "registrar", "adicionar membro", "incluir pessoa", "cadastra o/a [nome]"
- **BUSCA**: "buscar", "procurar", "quem é", "telefone de", "achar membro"
- **EDIÇÃO**: "editar", "atualizar", "mudar telefone", "corrigir nome"
- **TRANSFERÊNCIA**: "transferir", "mudar de congregação"
- **INATIVAÇÃO**: "inativar", "desativar", "remover membro"
- **CONGREGAÇÃO**: "listar congregações", "quais congregações"

Se o usuário já disse a intenção antes, NÃO pergunte de novo — apenas colete os dados que faltam.

# REGRAS
1. **CADASTRE DIRETO** quando o usuário der dados suficientes (nome + 1 contato + congregação OU telefone/email).
   NÃO faça busca ANTES de cadastrar — vá DIRETO pra \`igreja:cadastrar-membro\`. Se houver conflito (telefone/CPF já existe), mostre o conflito pro usuário e peça 1 frase de confirmação, então chame novamente com force=true.
2. Se faltar APENAS o nome completo ou congregação, pergunte APENAS esse campo — nada mais.
3. **NUNCA invente dados** que o usuário não forneceu.
4. **Pastora/pastor** — use conforme o nome do usuário logado.
5. **Datas em ISO** (YYYY-MM-DD ou YYYY-MM ou só YYYY).
6. **Respostas CURTAS** (1-2 frases + ação).
7. Para **editar/inativar/transferir**: confirme com 1 frase ("Confirma? (sim/não)").

# DUPLICATAS
Quando \`igreja:cadastrar-membro\` retornar \`conflict: true\`:
- Mostre ao usuário QUEM já tem aquele telefone/CPF.
- Pergunte APENAS: "Cadastra mesmo assim? (sim/não)"
- Se "sim" → chame a tool novamente com \`force=true\`.
- Se "não" → cancele e ofereça editar o existente.

# CONTEXTO
- Usuário logado: ${ctx.userName} (${ctx.role})
- Tenant: ${ctx.tenantId}
${filtroCong}

# TOOLS DISPONÍVEIS
${tools.map((t) => `- ${t.name}: ${t.description}`).join("\n")}

Use a tool apropriada baseada na intenção. Se não souber, peça esclarecimento.

# CONTEXTO
- Usuário logado: ${ctx.userName} (${ctx.role})
- Tenant: ${ctx.tenantId}
${filtroCong}

# TOOLS DISPONÍVEIS
${tools.map((t) => `- ${t.name}: ${t.description}`).join("\n")}

Use a tool apropriada baseada na intenção. Se não souber, peça esclarecimento.`;
}

export async function processChat(
  req: ChatRequest,
  ctx: AgentContext
): Promise<ChatResponse> {
  const tools = toolsForRole(ctx.role);
  const toolsSchema = toolsToOpenRouterSchema(tools);
  const toolsByName = new Map(tools.map((t) => [t.name, t]));

  const messages: Message[] = [
    { role: "system", content: buildSystemPrompt(ctx) },
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
    console.log(`[agent] iter=${iterations} model=${DEFAULT_MODEL} msgs=${messages.length}`);

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
    return {
      ok: true,
      message: text,
      tool: lastToolName,
      data: lastToolData,
      iterations,
      modelUsed: DEFAULT_MODEL,
      suggestions: sugerirProximas(lastToolData, lastToolName, ctx),
    };
  }

  return {
    ok: false,
    message: `Loop estourou após ${MAX_ITERATIONS} iterações.`,
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
