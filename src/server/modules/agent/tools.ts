/**
 * Catálogo de tools do agente IA do Kairos Igreja.
 *
 * Sprint 2.2: 10 tools (1 buscar-membros + 9 novas de membros/congregações/células).
 *
 * Cada tool:
 *  - name (igreja:xxx) — único
 *  - description — o que faz, em PT-BR, pro LLM entender
 *  - inputSchema — JSON Schema-like (validado em runtime)
 *  - execute(input, ctx) — função que faz a operação
 */

import { z } from "zod";
import { prisma } from "../../config/database";

export interface AgentContext {
  tenantId: string;
  userId: string;
  congregationId: string | null;
  role: "SUPER_ADMIN" | "ADMIN" | "GERENTE" | "OPERADOR" | "USUARIO";
  userName: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  /** Roles permitidos a usar essa tool. Se vazio, qualquer role. */
  allowedRoles?: AgentContext["role"][];
  /** Marcar como destrutiva — exige confirmação no chat (Sprint 2.3+) */
  destructive?: boolean;
  execute: (input: any, ctx: AgentContext) => Promise<unknown>;
}

// ============================================================
// Util: valida que memberId pertence à congregação do usuário
// (a menos que seja admin/super)
// ============================================================
async function garantirAcessoMembro(memberId: string, ctx: AgentContext) {
  const m = await prisma.member.findFirst({
    where: { id: memberId, tenantId: ctx.tenantId, deletedAt: null },
  });
  if (!m) throw new Error("Membro não encontrado.");
  if (
    ctx.role !== "SUPER_ADMIN" &&
    ctx.role !== "ADMIN" &&
    m.congregationId !== ctx.congregationId
  ) {
    throw new Error("Você não tem acesso a esse membro.");
  }
  return m;
}

async function garantirAdmin(ctx: AgentContext) {
  if (ctx.role !== "SUPER_ADMIN" && ctx.role !== "ADMIN") {
    throw new Error("Apenas ADMIN ou SUPER_ADMIN pode fazer isso.");
  }
}

// ============================================================
// MEMBROS (6 tools)
// ============================================================
const buscarMembrosInput = z.object({
  query: z.string().min(2).describe("Nome, telefone ou CPF"),
  limit: z.number().int().min(1).max(50).default(10),
});

const buscarMembrosTool: ToolDefinition = {
  name: "igreja:buscar-membros",
  description:
    "Busca membros por nome, telefone ou CPF. Retorna até 10 resultados com nome, congregação e status.",
  inputSchema: buscarMembrosInput,
  execute: async (input, ctx) => {
    const isAdmin = ctx.role === "SUPER_ADMIN" || ctx.role === "ADMIN";
    const where: any = {
      tenantId: ctx.tenantId,
      deletedAt: null,
      OR: [
        { name: { contains: input.query } },
        { phone: { contains: input.query } },
        { cpf: { contains: input.query } },
      ],
    };
    if (!isAdmin && ctx.congregationId) {
      where.congregationId = ctx.congregationId;
    }
    const members = await prisma.member.findMany({
      where,
      include: { congregation: { select: { name: true } } },
      take: Math.min(input.limit ?? 10, 50),
      orderBy: { name: "asc" },
    });
    return {
      query: input.query,
      total: members.length,
      members: members.map((m) => ({
        id: m.id,
        name: m.name,
        status: m.status ?? "membro",
        phone: m.phone ?? null,
        email: m.email ?? null,
        congregation: m.congregation?.name ?? null,
      })),
    };
  },
};

const detalhesMembroInput = z.object({
  memberId: z.string().uuid().describe("ID do membro"),
});

const detalhesMembroTool: ToolDefinition = {
  name: "igreja:detalhes-membro",
  description:
    "Mostra todos os dados de um membro: nome, email, telefone, CPF, data nascimento, congregação, status, batismo, etc.",
  inputSchema: detalhesMembroInput,
  execute: async (input, ctx) => {
    const m = await garantirAcessoMembro(input.memberId, ctx);
    return {
      id: m.id,
      name: m.name,
      email: m.email,
      phone: m.phone,
      cpf: m.cpf,
      birthDate: m.birthDate,
      address: m.address,
      maritalStatus: m.maritalStatus,
      status: m.status,
      baptized: m.baptized,
      baptismDate: m.baptismDate,
      memberSince: m.memberSince,
      filiation: m.filiation,
      cardValidity: m.cardValidity,
      congregationId: m.congregationId,
      notes: m.notes,
      active: m.active,
    };
  },
};

const cadastrarMembroInput = z.object({
  name: z.string().min(2).describe("Nome completo do membro"),
  phone: z.string().optional().describe("Telefone com DDD"),
  email: z.string().email().optional(),
  birthDate: z.string().optional().describe("Data nascimento ISO (YYYY, YYYY-MM, ou YYYY-MM-DD)"),
  cpf: z.string().optional().describe("CPF (11 dígitos, sem pontuação)"),
  maritalStatus: z
    .enum(["solteiro", "casado", "divorciado", "viuvo", "uniao_estavel"])
    .optional()
    .describe("Estado civil"),
  status: z
    .enum(["membro", "visitante", "convertido", "batizado", "em_discipulado", "ausente"])
    .optional()
    .describe("Status eclesiástico. Default = membro"),
  role: z
    .enum(["membro", "obreiro", "diacono", "presbitero", "pastor", "lider_celula", "tesoureiro"])
    .optional()
    .describe("Cargo ministerial. Default = membro"),
  congregationId: z.string().uuid().optional().describe("UUID da congregação (opcional se passar congregationName)"),
  congregationName: z.string().optional().describe("Nome (ou parte) da congregação — ex: 'Cajuru', 'Sede'. Faz match fuzzy."),
  celulaId: z.string().uuid().optional().describe("UUID da célula"),
  celulaName: z.string().optional().describe("Nome (ou parte) da célula — fuzzy match"),
  baptismDate: z.string().optional().describe("Data do batismo (ISO)"),
  filiation: z.string().optional().describe("Filiação (nome do pai e da mãe)"),
  address: z.string().optional().describe("Endereço completo"),
  cardValidity: z.string().optional().describe("Validade da carteirinha (ISO). Default = +2 anos."),
  ministries: z.array(z.string()).optional().describe("Ministérios que participa (ex: ['Louvor', 'Diaconato'])"),
  notes: z.string().optional().describe("Observações gerais"),
  consentAccepted: z.boolean().optional().describe("LGPD: true se usuário consentiu com Política de Privacidade. Default = true se cadastro via chat"),
});

const cadastrarMembroTool: ToolDefinition = {
  name: "igreja:cadastrar-membro",
  description:
    "Cria um novo membro no sistema. Secretária pode cadastrar na sua própria congregação. Admin/SUPER_ADMIN pode escolher a congregação. Aceita TODOS os campos do formulário (CPF, filiação, endereço, estado civil, data batismo, ministérios, célula, cargo, status). Detecta automaticamente duplicatas por telefone/CPF (a menos que force=true).",
  inputSchema: cadastrarMembroInput.extend({
    force: z.boolean().optional().describe("Se true, cadastra mesmo havendo conflito de telefone/CPF (use após o usuário confirmar)."),
  }),
  destructive: false,
  execute: async (input, ctx) => {
    if (ctx.role === "USUARIO") throw new Error("Sem permissão para cadastrar.");

    // Resolver congregationId: se vier congregationName (em vez de UUID), fazer lookup fuzzy
    let congregationId = input.congregationId;
    if (!congregationId && input.congregationName) {
      const norm = (s: string) =>
        s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const target = norm(input.congregationName);
      const congregations = await prisma.congregation.findMany({
        where: { tenantId: ctx.tenantId, deletedAt: null },
        select: { id: true, name: true },
      });
      const exact = congregations.find((c) => norm(c.name) === target);
      const partial = exact ?? congregations.find(
        (c) => norm(c.name).includes(target) || target.includes(norm(c.name))
      );
      if (!partial) {
        throw new Error(
          `Congregação "${input.congregationName}" não encontrada. Use 'igreja:listar-congregacoes' para ver as opções.`
        );
      }
      congregationId = partial.id;
    }

    // Resolver celulaId: fuzzy match por nome
    let celulaId: string | undefined = input.celulaId;
    if (!celulaId && input.celulaName) {
      const norm = (s: string) =>
        s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      const target = norm(input.celulaName);
      const where: any = { tenantId: ctx.tenantId, deletedAt: null };
      if (congregationId) where.congregationId = congregationId;
      const celulas = await prisma.celula.findMany({
        where,
        select: { id: true, name: true },
        take: 50,
      });
      const exact = celulas.find((c) => norm(c.name) === target);
      const partial = exact ?? celulas.find(
        (c) => norm(c.name).includes(target) || target.includes(norm(c.name))
      );
      if (partial) {
        celulaId = partial.id;
      }
    }

    // Usuário não-admin só pode cadastrar na própria congregação
    if (ctx.role !== "SUPER_ADMIN" && ctx.role !== "ADMIN") {
      if (!ctx.congregationId) {
        throw new Error("Sua conta não tem congregação vinculada.");
      }
      congregationId = ctx.congregationId;
    }

    if (!congregationId) {
      throw new Error(
        "Informe a congregação (UUID via congregationId OU nome via congregationName)."
      );
    }

    // ============================================
    // DETECÇÃO DE DUPLICATA (telefone ou CPF)
    // Não bloqueia — só retorna o conflito pro LLM decidir.
    // Se o usuário mandar force=true, cadastra mesmo assim.
    // ============================================
    const conflicts: Array<{ field: string; value: string; existing: { id: string; name: string; congregation: string | null } }> = [];
    if (input.phone) {
      const normPhone = input.phone.replace(/\D/g, "");
      if (normPhone.length >= 8) {
        const existing = await prisma.member.findFirst({
          where: {
            tenantId: ctx.tenantId,
            deletedAt: null,
            // match aproximado: ultimos 8 digitos (ignora DDI/DDD差异)
            phone: { contains: normPhone.slice(-8) },
            NOT: { id: "00000000-0000-0000-0000-000000000000" },
          },
          include: { congregation: { select: { name: true } } },
        });
        if (existing) {
          conflicts.push({
            field: "phone",
            value: input.phone,
            existing: { id: existing.id, name: existing.name, congregation: existing.congregation?.name ?? null },
          });
        }
      }
    }
    if (input.cpf) {
      const normCpf = input.cpf.replace(/\D/g, "");
      if (normCpf.length === 11) {
        const existing = await prisma.member.findFirst({
          where: {
            tenantId: ctx.tenantId,
            deletedAt: null,
            cpf: { contains: normCpf },
          },
          include: { congregation: { select: { name: true } } },
        });
        if (existing) {
          conflicts.push({
            field: "cpf",
            value: input.cpf,
            existing: { id: existing.id, name: existing.name, congregation: existing.congregation?.name ?? null },
          });
        }
      }
    }

    if (conflicts.length > 0 && !input.force) {
      return {
        ok: false,
        conflict: true,
        conflicts,
        message: `Possível duplicata encontrada. ${conflicts.map((c) => `${c.field}=${c.value} → já é de ${c.existing.name} (${c.existing.congregation ?? "sem congregação"})`).join("; ")}. Pergunte ao usuário se quer cadastrar mesmo assim (force=true).`,
      };
    }

    const member = await prisma.member.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name,
        phone: input.phone ?? null,
        email: input.email ?? null,
        birthDate: input.birthDate ? new Date(input.birthDate) : null,
        cpf: input.cpf ?? null,
        maritalStatus: input.maritalStatus ?? null,
        status: input.status ?? "membro",
        role: input.role ?? null,
        congregationId,
        celulaId: celulaId ?? null,
        baptismDate: input.baptismDate ? new Date(input.baptismDate) : null,
        filiation: input.filiation ?? null,
        address: input.address ?? null,
        cardValidity: input.cardValidity ?? null,
        ministries: input.ministries ? JSON.stringify(input.ministries) : null,
        notes: input.notes ?? null,
        // LGPD: chat считается consentimento (usuário logado)
        consentAcceptedAt: input.consentAccepted !== false ? new Date() : null,
        consentTermsVersion: "v1.0-chat-2026",
      },
    });
    return {
      ok: true,
      id: member.id,
      name: member.name,
      ...(conflicts.length > 0 ? { duplicateWarning: `Cadastrado apesar de ${conflicts.length} conflito(s) de duplicata.` } : {}),
    };
  },
};

const editarMembroInput = z.object({
  memberId: z.string().uuid(),
  fields: z.record(z.string(), z.any()).describe("Campos a alterar"),
});

const editarMembroTool: ToolDefinition = {
  name: "igreja:editar-membro",
  description:
    "Edita campos de um membro (telefone, email, endereço, estado civil, notas, etc). Não muda congregação — use transferir-membro pra isso.",
  inputSchema: editarMembroInput,
  destructive: true,
  execute: async (input, ctx) => {
    await garantirAcessoMembro(input.memberId, ctx);
    const allowed = [
      "phone",
      "email",
      "address",
      "maritalStatus",
      "notes",
      "birthDate",
      "filiation",
      "baptized",
      "baptismDate",
      "memberSince",
      "cardValidity",
      "photoUrl",
      "ministries",
    ];
    const fields: any = {};
    for (const [k, v] of Object.entries(input.fields as Record<string, unknown>)) {
      if (!allowed.includes(k)) continue;
      if (k === "birthDate" || k === "baptismDate" || k === "memberSince" || k === "cardValidity") {
        fields[k] = v ? new Date(v as string) : null;
      } else {
        fields[k] = v;
      }
    }
    await prisma.member.update({ where: { id: input.memberId }, data: fields });
    return { ok: true, updated: Object.keys(fields) };
  },
};

const transferirMembroInput = z.object({
  memberId: z.string().uuid(),
  novaCongregationId: z.string().uuid(),
  motivo: z.string().optional(),
});

const transferirMembroTool: ToolDefinition = {
  name: "igreja:transferir-membro",
  description:
    "Transfere um membro de uma congregação para outra. Só ADMIN/SUPER_ADMIN/Gerente pode fazer.",
  inputSchema: transferirMembroInput,
  destructive: true,
  allowedRoles: ["SUPER_ADMIN", "ADMIN", "GERENTE"],
  execute: async (input, ctx) => {
    await garantirAdmin(ctx);
    const m = await prisma.member.findFirst({
      where: { id: input.memberId, tenantId: ctx.tenantId, deletedAt: null },
    });
    if (!m) throw new Error("Membro não encontrado.");
    const from = m.congregationId;
    await prisma.member.update({
      where: { id: m.id },
      data: { congregationId: input.novaCongregationId },
    });
    return { ok: true, memberId: m.id, from, to: input.novaCongregationId };
  },
};

const inativarMembroInput = z.object({
  memberId: z.string().uuid(),
  motivo: z.string().optional(),
});

const inativarMembroTool: ToolDefinition = {
  name: "igreja:inativar-membro",
  description: "Marca um membro como inativo (soft delete — preserva histórico).",
  inputSchema: inativarMembroInput,
  destructive: true,
  allowedRoles: ["SUPER_ADMIN", "ADMIN", "GERENTE", "OPERADOR"],
  execute: async (input, ctx) => {
    await garantirAcessoMembro(input.memberId, ctx);
    await prisma.member.update({
      where: { id: input.memberId },
      data: { active: false, deletedAt: new Date(), notes: input.motivo ?? null },
    });
    return { ok: true };
  },
};

// ============================================================
// CONGREGAÇÕES (3 tools)
// ============================================================
const listarCongregacoesTool: ToolDefinition = {
  name: "igreja:listar-congregacoes",
  description: "Lista todas as congregações da igreja com nome, pastor e nº de membros.",
  inputSchema: z.object({}),
  execute: async (_input, ctx) => {
    const congregations = await prisma.congregation.findMany({
      where: { tenantId: ctx.tenantId, active: true, deletedAt: null },
      include: { _count: { select: { members: true } } },
      orderBy: { name: "asc" },
    });
    return {
      congregations: congregations.map((c) => ({
        id: c.id,
        name: c.name,
        pastor: c.pastorName,
        membersCount: c._count.members,
        address: c.address,
      })),
    };
  },
};

const detalhesCongregacaoInput = z.object({
  congregationId: z.string().uuid(),
});

const detalhesCongregacaoTool: ToolDefinition = {
  name: "igreja:detalhes-congregacao",
  description: "Mostra detalhes de uma congregação: pastor, endereço, total de membros.",
  inputSchema: detalhesCongregacaoInput,
  execute: async (input, ctx) => {
    const c = await prisma.congregation.findFirst({
      where: { id: input.congregationId, tenantId: ctx.tenantId, deletedAt: null },
      include: { _count: { select: { members: true } } },
    });
    if (!c) throw new Error("Congregação não encontrada.");
    if (
      ctx.role !== "SUPER_ADMIN" &&
      ctx.role !== "ADMIN" &&
      c.id !== ctx.congregationId
    ) {
      throw new Error("Sem acesso a essa congregação.");
    }
    return {
      id: c.id,
      name: c.name,
      pastor: c.pastorName,
      phone: c.phone,
      address: c.address,
      membersCount: c._count.members,
      active: c.active,
    };
  },
};

const cadastrarCongregacaoInput = z.object({
  name: z.string().min(2).describe("Nome da congregação"),
  address: z.string().optional(),
  phone: z.string().optional(),
  pastorName: z.string().optional(),
});

const cadastrarCongregacaoTool: ToolDefinition = {
  name: "igreja:cadastrar-congregacao",
  description: "Cria uma nova congregação. Só ADMIN/SUPER_ADMIN.",
  inputSchema: cadastrarCongregacaoInput,
  allowedRoles: ["SUPER_ADMIN", "ADMIN"],
  execute: async (input, ctx) => {
    await garantirAdmin(ctx);
    const c = await prisma.congregation.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name,
        address: input.address ?? null,
        phone: input.phone ?? null,
        pastorName: input.pastorName ?? null,
      },
    });
    return { ok: true, id: c.id, name: c.name };
  },
};

// ============================================================
// CÉLULAS (2 tools)
// ============================================================
const listarCelulasInput = z.object({
  congregationId: z.string().uuid().optional(),
});

const listarCelulasTool: ToolDefinition = {
  name: "igreja:listar-celulas",
  description: "Lista as células (pequenos grupos) de uma congregação ou todas.",
  inputSchema: listarCelulasInput,
  execute: async (input, ctx) => {
    const isAdmin = ctx.role === "SUPER_ADMIN" || ctx.role === "ADMIN";
    const congregationId =
      input.congregationId ?? (isAdmin ? undefined : ctx.congregationId);
    const where: any = {
      tenantId: ctx.tenantId,
      active: true,
      deletedAt: null,
    };
    if (congregationId) where.congregationId = congregationId;
    const celulas = await prisma.celula.findMany({ where, orderBy: { name: "asc" } });
    return { celulas };
  },
};

const cadastrarCelulaInput = z.object({
  name: z.string().min(2),
  leaderName: z.string().optional(),
  congregationId: z.string().uuid().optional(),
  meetingDay: z.string().optional(),
  meetingTime: z.string().optional(),
  address: z.string().optional(),
});

const cadastrarCelulaTool: ToolDefinition = {
  name: "igreja:cadastrar-celula",
  description: "Cria uma nova célula (pequeno grupo).",
  inputSchema: cadastrarCelulaInput,
  allowedRoles: ["SUPER_ADMIN", "ADMIN", "GERENTE", "OPERADOR"],
  execute: async (input, ctx) => {
    let congregationId = input.congregationId;
    if (ctx.role !== "SUPER_ADMIN" && ctx.role !== "ADMIN") {
      if (!ctx.congregationId) throw new Error("Sua conta não tem congregação.");
      congregationId = ctx.congregationId;
    }
    const c = await prisma.celula.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name,
        leaderName: input.leaderName ?? null,
        congregationId: congregationId ?? null,
        meetingDay: input.meetingDay ?? null,
        meetingTime: input.meetingTime ?? null,
        address: input.address ?? null,
      },
    });
    return { ok: true, id: c.id, name: c.name };
  },
};

// ============================================================
// Catálogo completo (10 tools no Sprint 2.2)
// ============================================================
export const TOOLS: ToolDefinition[] = [
  // Membros
  buscarMembrosTool,
  detalhesMembroTool,
  cadastrarMembroTool,
  editarMembroTool,
  transferirMembroTool,
  inativarMembroTool,
  // Congregações
  listarCongregacoesTool,
  detalhesCongregacaoTool,
  cadastrarCongregacaoTool,
  // Células
  listarCelulasTool,
  cadastrarCelulaTool,
];

/** Retorna tools filtradas pelo role do usuário */
export function toolsForRole(role: AgentContext["role"]): ToolDefinition[] {
  return TOOLS.filter((t) => !t.allowedRoles || t.allowedRoles.includes(role));
}

/** Serializa tools pra OpenRouter (formato tool/function calling) */
export function toolsToOpenRouterSchema(tools: ToolDefinition[]) {
  return tools.map((t) => {
    const zodDef = t.inputSchema._def as any;
    return {
      type: "function",
      function: {
        name: t.name.replace(/[^a-zA-Z0-9_-]/g, "_"),
        description: t.description,
        parameters: zodDef.schema
          ? zodToJsonSchema(zodDef.schema)
          : { type: "object", properties: {} },
      },
    };
  });
}

/** Converte Zod schema simples em JSON Schema (básico, suficiente pro LLM) */
function zodToJsonSchema(schema: any): any {
  if (!schema) return { type: "object", properties: {} };
  const shape = schema._def?.schema?._def?.shape?.() ?? schema._def?.shape?.() ?? {};
  const properties: any = {};
  const required: string[] = [];
  for (const [key, val] of Object.entries(shape)) {
    const v: any = val;
    const t = v._def?.typeName ?? v.constructor?.name;
    let type = "string";
    if (t === "ZodNumber" || t === "ZodNumber" as any) type = "number";
    else if (t === "ZodBoolean") type = "boolean";
    else if (t === "ZodArray") type = "array";
    else if (t === "ZodObject" || t === "ZodEffects") type = "object";
    else if (t === "ZodEnum") {
      const values = v._def?.values ?? [];
      properties[key] = { type: "string", enum: values };
      required.push(key);
      continue;
    }
    properties[key] = { type, description: v._def?.description ?? "" };
    if (v._def?.typeName !== "ZodOptional") required.push(key);
  }
  return { type: "object", properties, required };
}
