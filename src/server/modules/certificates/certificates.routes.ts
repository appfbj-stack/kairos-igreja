/**
 * certificates.routes.ts
 *
 * Geração de certificados pastorais (Batismo e Obreiro) em HTML A4.
 *
 *  - GET  /api/certificates/preview?memberId=xxx&type=BATISMO|OBREIRO
 *      Retorna o HTML pronto para visualizar / imprimir (text/html).
 *      Use `?save=true` para também persistir como Documento (tipo BATISMO/OBREIRO)
 *      e devolver { url, documentId } em JSON.
 *
 *  - GET  /api/certificates/:id/html
 *      Re-emite o HTML de um documento já salvo (para reimprimir).
 *
 * Templates pensados para `window.print()` → "Salvar como PDF" no navegador.
 * Sem dependência de puppeteer/pdfkit (zero peso na imagem Docker).
 */

import { Router, Response } from "express";
import path from "path";
import fs from "fs";
import { authMiddleware } from "../../middleware/auth";
import { asyncHandler } from "../../middleware/asyncHandler";
import { prisma } from "../../config/database";
import { AuthRequest } from "../../types";

const UPLOAD_ROOT = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");

function ensureDir(p: string) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

// ─────────────────────────────────────────────────────────
// Helpers de formatação
// ─────────────────────────────────────────────────────────
const MONTHS_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function fmtDateLong(d: Date | null | undefined): string {
  if (!d) return "____ de __________ de ______";
  const dt = new Date(d);
  return `${dt.getUTCDate()} de ${MONTHS_PT[dt.getUTCMonth()]} de ${dt.getUTCFullYear()}`;
}

function fmtDateShort(d: Date | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d);
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${dt.getUTCFullYear()}`;
}

function escapeHtml(s: string | null | undefined): string {
  if (!s) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ─────────────────────────────────────────────────────────
// Templates HTML
// ─────────────────────────────────────────────────────────
const CERT_BASE_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4 portrait; margin: 0; }
  body {
    font-family: Georgia, 'Times New Roman', serif;
    color: #2a2a20;
    background: #f5f5f0;
    padding: 0;
  }
  .no-print {
    position: fixed; top: 12px; right: 12px; z-index: 100;
    display: flex; gap: 8px;
  }
  .no-print button {
    background: #5a5a40; color: #f5f5f0; border: none;
    padding: 10px 18px; border-radius: 8px; font-weight: 700;
    cursor: pointer; font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,0.2);
  }
  .no-print button:hover { background: #4d4d36; }
  .no-print .back { background: #7a7060; }
  .no-print .back:hover { background: #5a5a40; }
  .page {
    width: 210mm; min-height: 297mm; padding: 18mm 18mm;
    margin: 12px auto; background: #fffdf6;
    box-shadow: 0 4px 18px rgba(0,0,0,0.15);
    position: relative; border: 6px double #5a5a40;
  }
  .page::before {
    content: ""; position: absolute; inset: 8mm;
    border: 1px solid #a68a64; pointer-events: none;
  }
  .header { text-align: center; margin-bottom: 24px; }
  .header .church-name {
    font-size: 18pt; font-weight: 700; letter-spacing: 1.5px;
    color: #2a2a20; text-transform: uppercase;
  }
  .header .tagline {
    font-size: 9pt; color: #7a7060; font-style: italic;
    margin-top: 2px; letter-spacing: 0.5px;
  }
  .header .cross {
    font-size: 22pt; color: #a68a64; margin: 8px 0 4px;
  }
  .title {
    text-align: center; font-size: 24pt; font-weight: 700;
    letter-spacing: 2.5px; color: #2a2a20;
    margin: 18px 0 6px; text-transform: uppercase;
  }
  .subtitle {
    text-align: center; font-size: 11pt; color: #5a5a40;
    font-style: italic; margin-bottom: 28px;
  }
  .body { font-size: 13pt; line-height: 1.85; text-align: justify;
    color: #2a2a20; margin: 0 10mm;
  }
  .body .member-name {
    font-weight: 700; text-transform: uppercase; letter-spacing: 1px;
    color: #2a2a20;
  }
  .footer { margin-top: 50px; }
  .signatures {
    display: flex; justify-content: space-around;
    margin-top: 70px; gap: 30px;
  }
  .sig-block { text-align: center; flex: 1; max-width: 200px; }
  .sig-line {
    border-top: 1.5px solid #2a2a20; padding-top: 6px;
    font-size: 10pt; font-weight: 700; color: #2a2a20;
  }
  .sig-role { font-size: 9pt; color: #5a5a40; font-style: italic; margin-top: 2px; }
  .meta {
    margin-top: 30px; text-align: center; font-size: 9pt; color: #7a7060;
    font-style: italic;
  }
  .meta .doc-id { color: #a68a64; }
  @media print {
    body { background: #fff; }
    .page { box-shadow: none; margin: 0; page-break-after: always; }
    .no-print { display: none !important; }
  }
`;

function renderBatismo(opts: {
  memberName: string;
  birthDate: Date | null;
  baptismDate: Date | null;
  baptizedBy: string | null;
  congregation: string;
  churchName: string;
  documentId?: string;
  issuedAt: Date;
}): string {
  const { memberName, birthDate, baptismDate, baptizedBy, congregation, churchName, documentId, issuedAt } = opts;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Certidão de Batismo — ${escapeHtml(memberName)}</title>
<style>${CERT_BASE_CSS}</style>
</head>
<body>
<div class="no-print">
  <button class="back" onclick="window.close()">← Voltar</button>
  <button onclick="window.print()">🖨 Imprimir / Salvar PDF</button>
</div>
<div class="page">
  <div class="header">
    <div class="church-name">${escapeHtml(churchName)}</div>
    <div class="tagline">— Comunidade de Fé e Serviço —</div>
    <div class="cross">✝</div>
  </div>

  <div class="title">Certidão de Batismo</div>
  <div class="subtitle">Atestado eclesiástico de Sacramento Cristão</div>

  <p class="body">
    &nbsp;&nbsp;&nbsp;&nbsp;Certificamos, para os devidos fins e com fundamento no registro desta igreja,
    que <span class="member-name">${escapeHtml(memberName)}</span>${
      birthDate ? `, nascido(a) em ${fmtDateLong(birthDate)},` : ""
    }
    foi solenemente batizado(a) em <strong>${fmtDateLong(baptismDate)}</strong>,
    na${congregation ? ` congregação <em>${escapeHtml(congregation)}</em>,` : ""}
    por imersão nas águas, conforme o mandamento do Senhor Jesus Cristo
    (Mateus 28:19), pelo(a) pastor(a) <strong>${escapeHtml(baptizedBy) || "________________________________"}</strong>.
  </p>

  <p class="body" style="margin-top: 14px;">
    &nbsp;&nbsp;&nbsp;&nbsp;O(A) referido(a) irmão(ã) é membro em comunhão desta igreja,
    participa da Ceia do Senhor e goza de todos os direitos e deveres
    pertinentes ao corpo de Cristo. Por ser verdade, firmamos a presente
    certidão para que possa produzir os efeitos legais e eclesiásticos
    necessários.
  </p>

  <div class="footer">
    <div class="signatures">
      <div class="sig-block">
        <div class="sig-line">${escapeHtml(baptizedBy) || "Pastor(a)"}</div>
        <div class="sig-role">Quem batizou</div>
      </div>
      <div class="sig-block">
        <div class="sig-line">Secretário(a) da Igreja</div>
        <div class="sig-role">1º Secretário(a)</div>
      </div>
    </div>
  </div>

  <div class="meta">
    Emitido em ${fmtDateLong(issuedAt)} ·
    ${documentId ? `<span class="doc-id">Registro nº ${escapeHtml(documentId.slice(0, 8).toUpperCase())}</span>` : "Documento gerado eletronicamente"}
  </div>
</div>
</body>
</html>`;
}

function renderObreiro(opts: {
  memberName: string;
  obreiroRole: string | null;
  obreiroSince: Date | null;
  congregation: string;
  churchName: string;
  documentId?: string;
  issuedAt: Date;
}): string {
  const { memberName, obreiroRole, obreiroSince, congregation, churchName, documentId, issuedAt } = opts;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Certificado de Obreiro — ${escapeHtml(memberName)}</title>
<style>${CERT_BASE_CSS}</style>
</head>
<body>
<div class="no-print">
  <button class="back" onclick="window.close()">← Voltar</button>
  <button onclick="window.print()">🖨 Imprimir / Salvar PDF</button>
</div>
<div class="page">
  <div class="header">
    <div class="church-name">${escapeHtml(churchName)}</div>
    <div class="tagline">— Comunidade de Fé e Serviço —</div>
    <div class="cross">✝</div>
  </div>

  <div class="title">Certificado de Obreiro</div>
  <div class="subtitle">Reconhecimento ministerial</div>

  <p class="body">
    &nbsp;&nbsp;&nbsp;&nbsp;Certificamos, com alegria e gratidão a Deus, que
    <span class="member-name">${escapeHtml(memberName)}</span>
    é reconhecido(a) como <strong>obreiro(a)</strong> desta igreja,
    exercendo a função de <strong>${escapeHtml(obreiroRole) || "Auxiliar"}</strong>${
      congregation ? `, vinculado(a) à congregação <em>${escapeHtml(congregation)}</em>` : ""
    },
    desde <strong>${fmtDateLong(obreiroSince)}</strong>.
  </p>

  <p class="body" style="margin-top: 14px;">
    &nbsp;&nbsp;&nbsp;&nbsp;Durante este período, o(a) referido(a) irmão(ã) tem se dedicado
    com zelo, fidelidade e amor ao serviço do Reino de Deus, colaborando
    ativamente na obra e no crescimento espiritual da comunidade.
    Por reconhecer a sua vocação e serviço, emitimos o presente certificado
    para que produza os efeitos eclesiásticos e pastorais cabíveis.
  </p>

  <p class="body" style="margin-top: 14px; font-style: italic; text-align: center;">
    "Cada um exerça o dom que recebeu para servir os outros,
    administrando fielmente a graça de Deus em suas múltiplas formas."
    <br>— 1 Pedro 4:10
  </p>

  <div class="footer">
    <div class="signatures">
      <div class="sig-block">
        <div class="sig-line">Pastor Presidente</div>
        <div class="sig-role">Presidente do Rol</div>
      </div>
      <div class="sig-block">
        <div class="sig-line">Secretário(a) da Igreja</div>
        <div class="sig-role">1º Secretário(a)</div>
      </div>
    </div>
  </div>

  <div class="meta">
    Emitido em ${fmtDateLong(issuedAt)} ·
    ${documentId ? `<span class="doc-id">Registro nº ${escapeHtml(documentId.slice(0, 8).toUpperCase())}</span>` : "Documento gerado eletronicamente"}
  </div>
</div>
</body>
</html>`;
}

// ─────────────────────────────────────────────────────────
// Router
// ─────────────────────────────────────────────────────────
const router = Router();

router.use(authMiddleware);

router.get(
  "/preview",
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const memberId = String(req.query.memberId || "");
    const type = String(req.query.type || "").toUpperCase();
    const save = String(req.query.save || "") === "true";

    if (!memberId) return res.status(400).send("memberId é obrigatório");
    if (!["BATISMO", "OBREIRO"].includes(type)) {
      return res.status(400).send("type deve ser BATISMO ou OBREIRO");
    }

    const member = await prisma.member.findFirst({
      where: { id: memberId, tenantId: req.user!.tenantId, deletedAt: null },
      include: { congregation: true },
    });
    if (!member) return res.status(404).send("Membro não encontrado");

    const tenant = await prisma.tenant.findUnique({
      where: { id: req.user!.tenantId },
      select: { name: true },
    });
    const churchName = tenant?.name || "Igreja";

    const issuedAt = new Date();
    let html: string;
    let documentId: string | undefined;

    if (type === "BATISMO") {
      html = renderBatismo({
        memberName: member.name,
        birthDate: member.birthDate,
        baptismDate: member.baptismDate,
        baptizedBy: member.baptizedBy,
        congregation: member.congregation?.name || "",
        churchName,
        issuedAt,
      });
    } else {
      html = renderObreiro({
        memberName: member.name,
        obreiroRole: member.obreiroRole,
        obreiroSince: member.obreiroSince,
        congregation: member.congregation?.name || "",
        churchName,
        issuedAt,
      });
    }

    if (save) {
      const fileName = `certificado-${type.toLowerCase()}-${Date.now()}.html`;
      const dir = path.join(UPLOAD_ROOT, req.user!.tenantId);
      ensureDir(dir);
      const filePath = path.join(dir, fileName);
      fs.writeFileSync(filePath, html, "utf-8");
      const url = `/uploads/${req.user!.tenantId}/${fileName}`;
      const doc = await prisma.document.create({
        data: {
          tenantId: req.user!.tenantId,
          memberId: member.id,
          uploadedById: req.user!.userId,
          title: `Certificado de ${type === "BATISMO" ? "Batismo" : "Obreiro"} — ${member.name}`,
          type: type as any,
          url,
          fileName,
          fileSize: Buffer.byteLength(html, "utf-8"),
          mimeType: "text/html",
        },
      });
      documentId = doc.id;
      // Re-render com o documentId no rodapé
      if (type === "BATISMO") {
        html = renderBatismo({
          memberName: member.name,
          birthDate: member.birthDate,
          baptismDate: member.baptismDate,
          baptizedBy: member.baptizedBy,
          congregation: member.congregation?.name || "",
          churchName,
          documentId,
          issuedAt,
        });
      } else {
        html = renderObreiro({
          memberName: member.name,
          obreiroRole: member.obreiroRole,
          obreiroSince: member.obreiroSince,
          congregation: member.congregation?.name || "",
          churchName,
          documentId,
          issuedAt,
        });
      }
      // Atualiza o arquivo com o número de registro
      fs.writeFileSync(filePath, html, "utf-8");
    }

    if (save) {
      return res.json({
        success: true,
        documentId,
        url: `/uploads/${req.user!.tenantId}/${documentId ? "x" : "x"}`.replace("x", "x"),
        // Retornar também o HTML direto (mais útil pro preview)
        html,
      });
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  })
);

export default router;
