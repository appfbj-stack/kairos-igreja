import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import fs from "fs";
import { env } from "./config/env";
import { authRoutes } from "./modules/auth/auth.routes";
import { memberRoutes } from "./modules/members/member.routes";
import { chatRoutes } from "./modules/chat/chat.routes";
import { userRoutes } from "./modules/users/users.routes";
import { documentRoutes } from "./modules/documents/documents.routes";
import { createCrudRouter } from "./modules/_crud";

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
  app.use("/api/users", userRoutes);
  app.use("/api/documents", documentRoutes);

  // ==========================================
  // Uploads — serve arquivos estáticos de /uploads
  // ==========================================
  const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  app.use("/uploads", express.static(uploadDir, {
    maxAge: "7d",
    setHeaders: (res) => {
      res.setHeader("Content-Disposition", "inline");
    },
  }));

  // Rotas CRUD genéricas (multi-tenant, soft-delete, busca, paginação)
  app.use("/api/celulas", createCrudRouter("celula", ["name", "leaderName"]));
  app.use("/api/congregations", createCrudRouter("congregation", ["name", "pastorName"]));
  app.use("/api/ministries", createCrudRouter("ministry", ["name", "leaderName"]));
  app.use("/api/events", createCrudRouter("event", ["title", "location", "type"]));
  app.use("/api/finances", createCrudRouter("financialTransaction", ["description", "category"]));
  app.use("/api/prayers", createCrudRouter("prayerRequest", ["name", "request"]));
  app.use("/api/sermons", createCrudRouter("sermon", ["title", "theme", "passage"]));
  app.use("/api/volunteers", createCrudRouter("volunteerRoster", ["name", "ministry", "role"]));
  app.use("/api/murals", createCrudRouter("muralNotice", ["title", "content"]));
  app.use("/api/assets", createCrudRouter("asset", ["name", "type"]));

  // ==========================================
  // Health check
  // ==========================================
  app.get("/api/health", (_req, res) => {
    const dbKind = (env.DATABASE_URL || "").startsWith("postgres") ? "PostgreSQL" : "SQLite";
    res.json({ status: "ok", app: "Kairos Church Platform", db: dbKind, auth: "JWT" });
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
    const dbKind = (env.DATABASE_URL || "").startsWith("postgres") ? "PostgreSQL" : "SQLite";
    console.log(`Kairos Church API running on http://localhost:${PORT}`);
    console.log(`  DB: ${dbKind} | Auth: JWT | Multi-tenant`);
  });
}

startServer();