import express from "express";
import path from "path";
import cors from "cors";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { env } from "./config/env";
import { authRoutes } from "./modules/auth/auth.routes";
import { memberRoutes } from "./modules/members/member.routes";

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
  // AI Sermon Outline Generator
  // ==========================================
  app.post("/api/ai/sermon-outline", async (req, res) => {
    try {
      const { theme, passage, audience } = req.body || {};
      const apiKey = env.GEMINI_API_KEY;

      if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
        return res.json({
          title: theme ? `Esboço: ${theme}` : "Esboço de Sermão Kairos",
          passage: passage || "Salmos 23:1-6",
          introduction: "Deus deseja falar ao coração da Sua igreja através da Sua palavra viva e eficaz.",
          mainPoints: [
            { point: "1. Reconhecendo a Soberania e o Cuidado de Deus", explanation: "Em momentos de transição e escolhas, o Senhor é quem nos guia com fidelidade." },
            { point: "2. Caminhando pela Fé nos Vales e Desafios", explanation: "A presença do Espírito Santo nos concede paz inabalável mesmo em tempos difíceis." },
            { point: "3. Transbordando a Graça para a Comunidade", explanation: "A bênção de Deus não é para estagnar, mas para servir ao próximo e aos pequenos grupos." },
          ],
          conclusion: "Comprometa-se hoje a viver uma fé ativa, em oração e comunhão contínua na igreja.",
          prayer: "Senhor nosso Deus, fortalece a tua igreja para ser luz e testemunho vivo neste tempo oportuno (Kairos). Amém!",
          isDemo: true,
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Você é um teólogo e pastor auxiliar experiente da igreja cristã "Kairos".
Crie um esboço detalhado e inspirador de pregação/sermão em Português com base nos seguintes dados:
Tema: ${theme || "Tempo de Crescimento e Fé"}
Passagem Bíblica: ${passage || "Atos 2:42-47"}
Público Alvo: ${audience || "Igreja Geral e Líderes de Célula"}

Responda EXCLUSIVAMENTE em formato JSON com o seguinte formato:
{
  "title": "Título Marcante",
  "passage": "Passagem Bíblica",
  "introduction": "Breve introdução (2-3 frases)",
  "mainPoints": [
    {"point": "Ponto 1", "explanation": "Explicação prática e aplicação"},
    {"point": "Ponto 2", "explanation": "Explicação prática e aplicação"},
    {"point": "Ponto 3", "explanation": "Explicação prática e aplicação"}
  ],
  "conclusion": "Conclusão e apelo prático",
  "prayer": "Oração final de encerramento"
}`;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: { responseMimeType: "application/json" },
      });

      return res.json(JSON.parse(response.text || "{}"));
    } catch (error) {
      console.error("Error generating sermon outline:", error);
      return res.status(500).json({ error: "Erro ao gerar esboço de sermão por IA.", details: String(error) });
    }
  });

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