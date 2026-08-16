import { Router, Response } from "express";
import { authMiddleware } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import { prisma } from "../config/database";
import { AuthRequest } from "../types";

/**
 * Factory de rotas CRUD genéricas.
 * Funciona para qualquer model Prisma que tenha `tenantId` e `deletedAt`.
 *
 * @param modelName  Nome do model no Prisma Client (ex: "celula", "member")
 * @param searchFields Campos onde o `?search=` faz "contains" (OR). Vazio = sem busca.
 *
 * Endpoints gerados:
 *   GET    /            → lista (paginação + busca)
 *   GET    /:id         → item por id
 *   POST   /            → cria
 *   PUT    /:id         → atualiza
 *   DELETE /:id         → soft delete (deletedAt = now)
 */
export function createCrudRouter(
  modelName: string,
  searchFields: string[] = ["name"]
) {
  const router = Router();
  router.use(authMiddleware);

  // GET / — list
  router.get(
    "/",
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const tenantId = req.tenantId!;
      const { search, page, limit, orderBy, orderDir } = req.query as Record<string, string | undefined>;

      const where: any = { tenantId, deletedAt: null };
      if (search && searchFields.length > 0) {
        where.OR = searchFields.map((f) => ({ [f]: { contains: search } }));
      }

      const pageNum = page ? Math.max(1, Number(page)) : 1;
      const limitNum = limit ? Math.min(100, Math.max(1, Number(limit))) : 200;

      // ordem padrão
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
      const tenantId = req.tenantId!;
      const model = (prisma as any)[modelName];
      const item = await model.findFirst({
        where: { id: req.params.id, tenantId, deletedAt: null },
      });
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
    asyncHandler(async (req: AuthRequest, res: Response) => {
      const tenantId = req.tenantId!;
      const model = (prisma as any)[modelName];
      const { id: _ignore, createdAt: _c, updatedAt: _u, deletedAt: _d, ...cleanData } = req.body || {};
      try {
        const item = await model.create({
          data: { ...cleanData, tenantId },
        });
        res.status(201).json({ success: true, data: item });
      } catch (e: any) {
        // Prisma 7 rejeita campos desconhecidos. Tenta de novo removendo os campos
        // que o model não aceita.
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
      const tenantId = req.tenantId!;
      const { id: _i, tenantId: _t, createdAt: _c, updatedAt: _u, deletedAt: _d, ...cleanData } = req.body || {};
      const model = (prisma as any)[modelName];
      try {
        const result = await model.updateMany({
          where: { id: req.params.id, tenantId, deletedAt: null },
          data: cleanData,
        });
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
            const result = await model.updateMany({
              where: { id: req.params.id, tenantId, deletedAt: null },
              data: retry,
            });
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
      const tenantId = req.tenantId!;
      const model = (prisma as any)[modelName];
      const result = await model.updateMany({
        where: { id: req.params.id, tenantId, deletedAt: null },
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
