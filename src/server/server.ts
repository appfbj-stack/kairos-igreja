import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { env } from "./config/env";
import { authRoutes } from "./modules/auth/auth.routes";
import { memberRoutes } from "./modules/members/member.routes";
import { chatRoutes } from "./modules/chat/chat.routes";

async function startServer() {
  const app = express();
  const PORT = env.PORT;

  // Middlewares
  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  // ==========================================
  // API Routes
  // ==========================================
  app.use("/api/auth", authRoutes);
  app.use("/api/members", memberRoutes);
  app.use("/api/chat", chatRoutes);

  // TODO: Adicionar rotas dos demais módulos
  // app.use("/api/celulas", celulaRoutes);
  // app.use("/api/congregations", congregationRoutes);
  // app.use("/api/ministries", ministryRoutes);
  // app.use("/api/events", eventRoutes);
  // app.use("/api/finances", financeRoutes);
  // app.use("/api/prayers", prayerRoutes);
  // app.use("/api/sermons", sermonRoutes);
  // app.use("/api/volunteers", volunteerRoutes);
  // app.use("/api/murals", muralRoutes);
  // app.use("/api/chat", chatRoutes);
  // app.use("/api/backup", backupRoutes);

  // ==========================================
  // Health check
  // ==========================================
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", app: "Kairos Church Platform", db: "SQLite", auth: "JWT" });
  });

  // ==========================================
  // Global error handler
  // ==========================================
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error("Unhandled error:", err);
    res.status(500).json({ success: false, error: err.message || "Erro interno" });
  });

  // ==========================================
  // Vite (dev) or Static (prod)
  // ==========================================
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Kairos Church API running on http://localhost:${PORT}`);
    console.log(`  DB: SQLite | Auth: JWT | Multi-tenant`);
  });
}

startServer();