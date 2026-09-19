import { Router, Response } from "express";
import { authMiddleware } from "../middleware/auth";
import { requireScope, enforceCongregation, getScopeFilter, isGlobalRole } from "../middleware/access";
import { asyncHandler } from "../middleware/asyncHandler";
import { prisma } from "../config/database";
import { AuthRequest } from "../types";

/**
 * Cache simples de "model tem congregationId?" pra evitar queries a cada request.
 * Congelado na criação do router (models do app não mudam em runtime).
 */
const congregationIdPresenceCache = new Map<string, boolean>();
function modelHasCongregationField(modelName: string): boolean {
  if (congregationIdPresenceCache.has(modelName)) {
    return congregationIdPresenceCache.get(modelName)!;
  }
  const model = (prisma as any)[modelName];
  if (!model?.fields) {
    congregationIdPresenceCache.set(modelName, false);
    return false;
  }
  const has = !!model.fields.congregationId;
  congregationIdPresenceCache.set(modelName, has);
  return has;
}

/**
 * Modelos "self-scoped": cada item É uma congregação (ou tenant).
 * Para não-admins, filtra `id == user.congregationId` em vez de `congregationId == ...`.
 * Sem isso, um GERENTE veria TODAS as congregações do admin.
 *
 * Adicione aqui qualquer outro model "self-scoped" futuro.
 */
const SELF_SCOPED_MODELS = new Set(["congregation"]);

/**
 * Factory de rotas CRUD genéricas com controle de acesso por congregação.
 *
 * Regras:
 * - GET    → filtra por `getScopeFilter(req)` (multi-tenant + congregação)
 * - POST   → força `congregationId` do user se não-admin
 * - PUT    → valida que item pertence à congregação permitida
 * - DELETE → valida que item pertence à congregação permitida
 *
 * Modelos SEM congregationId (ex: MuralNotice global) funcionam normalmente.
 *
 * @param modelName        Nome do model no Prisma Client (ex: "celula", "member")
 * @param searchFields     Campos onde o `?search=` faz "contains" (OR). Vazio = sem busca.
 * @param superAdminOnlyFields  Campos que SÓ SUPER_ADMIN pode setar (filtra do body pra outros).
 */
export function createCrudRouter(
  modelName: string,
  searchFields: string[] = ["name"],
  superAdminOnlyFields: string[] = []
) {
  const router = Router();
  router.use(authMiddleware);

  /**
   * Filtra body removendo campos que só SUPER_ADMIN pode setar.
   * Defesa em profundidade: mesmo se o frontend esquecer, backend recusa.
   */
  const filterPrivilegedFields = (req: AuthRequest): boolean => {
    if (!req.body || typeof req.body !== "object") return false;
    const isSuperAdmin = req.user?.role === "SUPER_ADMIN";
    if (isSuperAdmin) return false; // SUPER_ADMIN passa tudo
    let filtered = false;
    for (const field of superAdminOnlyFields) {
      if (field in req.body) {
        delete req.body[field];
        filtered = true;
      }
    }
    return filtered;
  };

  /**
   * Aplica o filtro de escopo (tenantId + congregação) ao `where` Prisma.
   *
   * Para models com `congregationId`: `congregationId == user.congregationId OR IS NULL`.
   * Para "self-scoped" (Congregation): `id == user.congregationId`.
   * Para models sem congregationId (MuralNotice etc): só `tenantId`.
   */
  const applyScopeToWhere = (
    where: any,
    scope: { tenantId: string; congregationId?: string | null }
  ): void => {
    // Model self-scoped: cada item É uma congregação
    if (SELF_SCOPED_MODELS.has(modelName) && scope.congregationId) {
      where.id = scope.congregationId;
      return;
    }
    // Model com congregationId: filtra por congregação do user (ou global)
    if ("congregationId" in scope && modelHasCongregationField(modelName)) {
      if (scope.congregationId) {
        where.OR = [
          { congregationId: scope.congregationId },
          { congregationId: null },
        ];
      } else {
        where.congregationId = null;
      }
    }
  };

  // GET / — list
  router.get(
    "/",
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const scope = getScopeFilter(req);
      const { search, page, limit, orderBy, orderDir } = req.query as Record<string, string | undefined>;

      const where: any = { tenantId: scope.tenantId, deletedAt: null };
      // Filtro de escopo (tenant + congregação)
      applyScopeToWhere(where, scope);
      if (search && searchFields.length > 0) {
        const searchOr = searchFields.map((f) => ({ [f]: { contains: search } }));
        where.OR = where.OR ? [...where.OR, ...searchOr] : searchOr;
      }

      const pageNum = page ? Math.max(1, Number(page)) : 1;
      const limitNum = limit ? Math.min(100, Math.max(1, Number(limit))) : 200;

      const orderField = orderBy || "createdAt";
      const orderDirection = (orderDir as "asc" | "desc") || "desc";

      const model = (prisma as any)[modelName];
      const [data, total] = await Promise.all([
        model.findMany({
          where,
          orderBy: { [orderField]: orderDirection },
          skip: (pageNum - 1) * limitNum,
          take: limitNum,
        }),
        model.count({ where }),
      ]);

      res.json({
        success: true,
        data,
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      });
    })
  );

  // GET /:id — get one
  router.get(
    "/:id",
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const scope = getScopeFilter(req);
      const model = (prisma as any)[modelName];
      const where: any = { id: req.params.id, tenantId: scope.tenantId, deletedAt: null };
      applyScopeToWhere(where, scope);
      const item = await model.findFirst({ where });
      if (!item) {
        res.status(404).json({ success: false, error: "Item não encontrado" });
        return;
      }
      res.json({ success: true, data: item });
    })
  );

  // POST / — create
  router.post(
    "/",
    requireScope,
    enforceCongregation,
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const tenantId = req.user!.tenantId;
      const model = (prisma as any)[modelName];
      filterPrivilegedFields(req); // remove campos de SUPER_ADMIN se user não for
      const { id: _ignore, createdAt: _c, updatedAt: _u, deletedAt: _d, ...cleanData } = req.body || {};
      try {
        const item = await model.create({
          data: { ...cleanData, tenantId },
        });
        res.status(201).json({ success: true, data: item });
      } catch (e: any) {
        const msg = String(e?.message || "");
        const m = msg.match(/Unknown argument `([^`]+)`/);
        if (m) {
          const bad = m[1];
          const { [bad]: _drop, ...retry } = cleanData;
          try {
            const item = await model.create({ data: { ...retry, tenantId } });
            return res.status(201).json({ success: true, data: item });
          } catch (e2: any) {
            return res.status(400).json({ success: false, error: e2.message });
          }
        }
        res.status(400).json({ success: false, error: msg || "Erro ao criar" });
      }
    })
  );

  // PUT /:id — update
  router.put(
    "/:id",
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const scope = getScopeFilter(req);
      filterPrivilegedFields(req); // remove campos de SUPER_ADMIN se user não for
      const { id: _i, tenantId: _t, createdAt: _c, updatedAt: _u, deletedAt: _d, ...cleanData } = req.body || {};
      const model = (prisma as any)[modelName];
      const where: any = { id: req.params.id, tenantId: scope.tenantId, deletedAt: null };
      applyScopeToWhere(where, scope);
      try {
        const result = await model.updateMany({ where, data: cleanData });
        if (result.count === 0) {
          res.status(404).json({ success: false, error: "Item não encontrado" });
          return;
        }
        res.json({ success: true, message: "Atualizado" });
      } catch (e: any) {
        const msg = String(e?.message || "");
        const m = msg.match(/Unknown argument `([^`]+)`/);
        if (m) {
          const bad = m[1];
          const { [bad]: _drop, ...retry } = cleanData;
          try {
            const result = await model.updateMany({ where, data: retry });
            if (result.count === 0) {
              res.status(404).json({ success: false, error: "Item não encontrado" });
              return;
            }
            return res.json({ success: true, message: "Atualizado" });
          } catch (e2: any) {
            return res.status(400).json({ success: false, error: e2.message });
          }
        }
        res.status(400).json({ success: false, error: msg || "Erro ao atualizar" });
      }
    })
  );

  // DELETE /:id — soft delete
  router.delete(
    "/:id",
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const scope = getScopeFilter(req);
      const model = (prisma as any)[modelName];
      const where: any = { id: req.params.id, tenantId: scope.tenantId, deletedAt: null };
      applyScopeToWhere(where, scope);
      const result = await model.updateMany({
        where,
        data: { deletedAt: new Date() },
      });
      if (result.count === 0) {
        res.status(404).json({ success: false, error: "Item não encontrado" });
        return;
      }
      res.json({ success: true, message: "Removido" });
    })
  );

  return router;
}
