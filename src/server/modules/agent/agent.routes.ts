/**
 * Rotas do agente IA do Kairos Igreja.
 *
 * Sprint 2.1:
 *   POST /api/agent/chat    → recebe mensagem, retorna resposta + tool usada
 *   GET  /api/agent/tools   → lista tools disponíveis pro role do usuário
 *
 * Tudo autenticado com JWT (authMiddleware popula req.user).
 */

import { Router, Response } from "express";
import { authMiddleware } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/asyncHandler";
import { AuthRequest } from "../../types";
import { processChat } from "./agent.service.js";
import { toolsForRole } from "./tools.js";

const router = Router();
router.use(authMiddleware);

// POST /api/agent/chat
router.post(
  "/chat",
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { message, conversationId } = req.body ?? {};

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      res.status(400).json({ success: false, error: "Mensagem vazia" });
      return;
    }
    if (message.length > 1000) {
      res.status(400).json({ success: false, error: "Mensagem muito longa (máx 1000 caracteres)" });
      return;
    }

    if (!req.user) {
      res.status(401).json({ success: false, error: "Não autenticado" });
      return;
    }

    const ctx = {
      tenantId: req.user.tenantId,
      userId: req.user.userId,
      congregationId: req.user.congregationId,
      role: req.user.role,
      userName: req.user.name,
    };

    const result = await processChat({ message: message.trim(), conversationId }, ctx);
    res.json({ success: true, ...result });
  })
);

// GET /api/agent/tools
router.get(
  "/tools",
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) {
      res.status(401).json({ success: false, error: "Não autenticado" });
      return;
    }
    const tools = toolsForRole(req.user.role);
    res.json({
      success: true,
      count: tools.length,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema._def ?? t.inputSchema,
      })),
    });
  })
);

export { router as agentRoutes };
