/**
 * requireActiveSubscription.ts
 *
 * Middleware que libera/bloqueia o tenant baseado no status da assinatura.
 * Chamado após o `authMiddleware`. Pula rotas de billing e webhook.
 *
 * Regras:
 *  - TRIAL válido (trialEndsAt > agora) → LIBERA
 *  - subscriptionStatus === "ACTIVE"   → LIBERA
 *  - subscriptionStatus === "OVERDUE"  → LIBERA (grace period)
 *  - Qualquer outro caso               → BLOQUEIA com 402
 *
 * Rotas isentas (passam sempre): /api/billing/*, /api/asaas/webhook
 */

import { Request, Response, NextFunction } from "express";
import { prisma } from "../config/database";

const EXEMPT_PREFIXES = [
  "/api/billing",
  "/api/asaas/webhook",
  "/api/health",
  "/api/auth",
];

export async function requireActiveSubscription(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    if (EXEMPT_PREFIXES.some((p) => req.path.startsWith(p))) {
      return next();
    }
    if (!req.user?.tenantId) return next();

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user.tenantId },
      select: {
        subscriptionStatus: true,
        trialEndsAt: true,
        subscriptionEndsAt: true,
      },
    });
    if (!tenant) return next();

    const now = new Date();

    // Trial válido (ou legado sem trialEndsAt — libera retroativamente)
    if (tenant.subscriptionStatus === "TRIAL") {
      if (!tenant.trialEndsAt || tenant.trialEndsAt > now) {
        return next();
      }
    }

    // Assinatura ativa
    if (
      tenant.subscriptionStatus === "ACTIVE" &&
      (!tenant.subscriptionEndsAt || tenant.subscriptionEndsAt > now)
    ) {
      return next();
    }

    // Grace period (OVERDUE) — libera por mais 3 dias
    if (tenant.subscriptionStatus === "OVERDUE") {
      if (
        tenant.subscriptionEndsAt &&
        tenant.subscriptionEndsAt.getTime() + 3 * 86400000 > now.getTime()
      ) {
        return next();
      }
    }

    // Bloqueado
    return res.status(402).json({
      success: false,
      code: "SUBSCRIPTION_REQUIRED",
      error: "Trial expirado ou assinatura inativa",
      status: tenant.subscriptionStatus,
      trialEndsAt: tenant.trialEndsAt,
      subscriptionEndsAt: tenant.subscriptionEndsAt,
    });
  } catch (err) {
    console.error("[subscription-check] erro:", err);
    // Em caso de erro, libera (fail open) — não vamos derrubar o app por causa do billing
    next();
  }
}
