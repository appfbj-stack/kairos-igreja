import { prisma } from "../config/database";
import { isGlobalRole } from "../middleware/access";

export interface ScopeUser {
  role: string;
  congregationId?: string | null;
}

/**
 * Repository de membros.
 *
 * Multi-tenant: sempre filtra por tenantId.
 * Multi-congregação: para roles GERENTE/OPERADOR/USUARIO, filtra por congregação
 *   (membros da própria congregação OU membros globais sem congregaçãoId).
 * ADMIN/SUPER_ADMIN veem todos os membros do tenant.
 */
export class MemberRepository {
  constructor(
    private tenantId: string,
    private user: ScopeUser
  ) {}

  /**
   * Filtro base com escopo de tenant + congregação.
   * Para não-admins: `congregationId == user.congregationId` OR `congregationId IS NULL`.
   * Para admins: apenas tenantId.
   */
  private baseFilter() {
    const f: any = { tenantId: this.tenantId, deletedAt: null };
    if (!isGlobalRole(this.user.role) && this.user.congregationId) {
      f.OR = [
        { congregationId: this.user.congregationId },
        { congregationId: null }, // membros globais visíveis pra todos
      ];
    }
    return f;
  }

  async findAll(search?: string, page = 1, limit = 20) {
    const where = { ...this.baseFilter() } as any;
    if (search) where.name = { contains: search };

    const [data, total] = await Promise.all([
      prisma.member.findMany({
        where,
        include: { congregation: true },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: "asc" },
      }),
      prisma.member.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findById(id: string) {
    return prisma.member.findFirst({
      where: { id, ...this.baseFilter() },
      include: { congregation: true },
    });
  }

  async create(data: {
    name: string;
    email?: string;
    phone?: string;
    birthDate?: Date;
    address?: string;
    congregationId?: string;
    photoUrl?: string;
    notes?: string;
  }) {
    // Para não-admin, força congregationId ao do user (caso frontend mande outro)
    if (!isGlobalRole(this.user.role)) {
      data.congregationId = this.user.congregationId ?? undefined;
    }
    return prisma.member.create({
      data: { ...data, tenantId: this.tenantId },
    });
  }

  async update(id: string, data: Record<string, any>) {
    // Não-admin não pode mover membro pra outra congregação
    if (!isGlobalRole(this.user.role) && "congregationId" in data) {
      delete data.congregationId;
    }
    return prisma.member.updateMany({
      where: { id, ...this.baseFilter() },
      data,
    });
  }

  async softDelete(id: string) {
    return prisma.member.updateMany({
      where: { id, ...this.baseFilter() },
      data: { deletedAt: new Date() },
    });
  }
}