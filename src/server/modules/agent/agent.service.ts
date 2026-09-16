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
const DEFAULT_MODEL = "meta-llama/llama-3.1-8b-instruct:free";
const MAX_ITERATIONS = 5;

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
Você é o **Kairós**, assistente pastoral do Kairos Igreja.
Você ajuda pastoras, pastores, secretárias e tesoureiros via chat em PT-BR natural.

# REGRAS
1. **SEMPRE confirme** antes de cadastrar/editar/transferir/inativar.
   Mostre o que será feito e peça "confirmar? (sim/não)" antes de chamar a tool destrutiva.
2. **Pastora/pastor** — use conforme o nome do usuário logado.
3. **NUNCA invente dados.** Se faltar info, pergunte.
4. **Datas em ISO** (YYYY-MM-DD).
5. **Respostas CURTAS** (1-3 frases + ação).
6. **Quando o usuário confirmar** ("sim", "pode", "vai"), execute a tool destrutiva.

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
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        ok: false,
        message: `OpenRouter ${res.status}: ${text.slice(0, 200)}`,
      };
    }

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
