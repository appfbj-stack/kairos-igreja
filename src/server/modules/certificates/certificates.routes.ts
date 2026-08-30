/**
 * certificates.routes.ts
 *
 * Geração de certificados pastorais (Batismo, Obreiro, Apresentação, Casamento).
 * Suporta 3 padrões visuais: completo, simplificado, com-versiculo.
 *
 *  - GET  /api/certificates/preview?memberId=xxx&type=...&pattern=...
 *      Retorna o HTML pronto para visualizar / imprimir (text/html).
 *      Use `?save=true` para também persistir como Documento e devolver
 *      { url, documentId, html } em JSON.
 *
 *  - POST /api/certificates/save-edited
 *      Salva um HTML já editado (vindo do preview com contenteditable).
 *      body: { memberId, type, html }
 *
 * Templates pensados para `window.print()` → "Salvar como PDF" no navegador.
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

const MONTHS_PT = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function fmtDateLong(d: Date | null | undefined): string {
  if (!d) return "____ de __________ de ______";
  const dt = new Date(d);
  return `${dt.getUTCDate()} de ${MONTHS_PT[dt.getUTCMonth()]} de ${dt.getUTCFullYear()}`;
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

const VERSICULOS: Record<string, string> = {
  BATISMO: '"Portanto ide, fazei discípulos de todas as nações, batizando-as em nome do Pai, e do Filho, e do Espírito Santo." — Mateus 28:19',
  OBREIRO: '"Cada um exerça o dom que recebeu para servir os outros, administrando fielmente a graça de Deus em suas múltiplas formas." — 1 Pedro 4:10',
  APRESENTACAO: '"Jesus chamava as crianças, e dizia: Deixai os pequenos vir a mim, e não os impeçais." — Mateus 19:14',
  CASAMENTO: '"Portanto, o que Deus uniu, ninguém separe." — Marcos 10:9',
};

// ─────────────────────────────────────────────────────────
// CSS por padrão
// ─────────────────────────────────────────────────────────
const CSS_COMPLETO = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4 portrait; margin: 0; }
  body { font-family: Georgia, 'Times New Roman', serif; color: #2a2a20; background: #f5f5f0; padding: 0; }
  .no-print { position: fixed; top: 12px; right: 12px; z-index: 100; display: flex; gap: 8px; }
  .no-print button { background: #5a5a40; color: #f5f5f0; border: none; padding: 10px 18px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 13px; box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
  .no-print button:hover { background: #4d4d36; }
  .no-print .back { background: #7a7060; }
  .page { width: 210mm; min-height: 297mm; padding: 18mm 18mm; margin: 12px auto; background: #fffdf6; box-shadow: 0 4px 18px rgba(0,0,0,0.15); position: relative; border: 6px double #5a5a40; }
  .page::before { content: ""; position: absolute; inset: 8mm; border: 1px solid #a68a64; pointer-events: none; }
  .header { text-align: center; margin-bottom: 24px; }
  .header .church-name { font-size: 18pt; font-weight: 700; letter-spacing: 1.5px; color: #2a2a20; text-transform: uppercase; }
  .header .tagline { font-size: 9pt; color: #7a7060; font-style: italic; margin-top: 2px; letter-spacing: 0.5px; }
  .header .cross { font-size: 22pt; color: #a68a64; margin: 8px 0 4px; }
  .title { text-align: center; font-size: 24pt; font-weight: 700; letter-spacing: 2.5px; color: #2a2a20; margin: 18px 0 6px; text-transform: uppercase; }
  .subtitle { text-align: center; font-size: 11pt; color: #5a5a40; font-style: italic; margin-bottom: 28px; }
  .body { font-size: 13pt; line-height: 1.85; text-align: justify; color: #2a2a20; margin: 0 10mm; }
  .body .member-name { font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #2a2a20; }
  .editable { background: #fff8dc; padding: 0 4px; border-radius: 3px; outline: 1px dashed #a68a64; }
  .editable:focus { background: #fffacd; outline: 2px solid #5a5a40; }
  .footer { margin-top: 50px; }
  .signatures { display: flex; justify-content: space-around; margin-top: 70px; gap: 30px; }
  .sig-block { text-align: center; flex: 1; max-width: 200px; }
  .sig-line { border-top: 1.5px solid #2a2a20; padding-top: 6px; font-size: 10pt; font-weight: 700; color: #2a2a20; }
  .sig-role { font-size: 9pt; color: #5a5a40; font-style: italic; margin-top: 2px; }
  .versiculo { margin-top: 40px; text-align: center; font-style: italic; font-size: 11pt; color: #5a5a40; padding: 0 15mm; }
  .meta { margin-top: 30px; text-align: center; font-size: 9pt; color: #7a7060; font-style: italic; }
  .meta .doc-id { color: #a68a64; }
  @media print { body { background: #fff; } .page { box-shadow: none; margin: 0; page-break-after: always; } .no-print { display: none !important; } }
`;

const CSS_SIMPLIFICADO = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4 portrait; margin: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; background: #fff; padding: 0; }
  .no-print { position: fixed; top: 12px; right: 12px; z-index: 100; display: flex; gap: 8px; }
  .no-print button { background: #333; color: #fff; border: none; padding: 10px 18px; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px; }
  .page { width: 210mm; min-height: 297mm; padding: 25mm 20mm; margin: 0 auto; background: #fff; }
  .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #1a1a1a; padding-bottom: 14px; }
  .header .church-name { font-size: 14pt; font-weight: 600; color: #1a1a1a; }
  .title { text-align: center; font-size: 20pt; font-weight: 700; color: #1a1a1a; margin: 30px 0 8px; text-transform: uppercase; letter-spacing: 1.5px; }
  .subtitle { text-align: center; font-size: 10pt; color: #555; font-style: italic; margin-bottom: 30px; }
  .body { font-size: 12pt; line-height: 1.7; text-align: justify; color: #2a2a2a; }
  .body .member-name { font-weight: 700; }
  .editable { background: #f0f8ff; padding: 0 4px; border-radius: 2px; outline: 1px dashed #888; }
  .editable:focus { background: #e6f3ff; outline: 2px solid #333; }
  .signatures { display: flex; justify-content: space-around; margin-top: 60px; gap: 30px; }
  .sig-block { text-align: center; flex: 1; max-width: 200px; }
  .sig-line { border-top: 1px solid #1a1a1a; padding-top: 5px; font-size: 10pt; font-weight: 600; }
  .sig-role { font-size: 9pt; color: #555; font-style: italic; margin-top: 2px; }
  .versiculo { margin-top: 35px; text-align: center; font-style: italic; font-size: 10pt; color: #555; padding: 0 10mm; }
  .meta { margin-top: 30px; text-align: center; font-size: 9pt; color: #888; font-style: italic; }
  .meta .doc-id { color: #666; }
  @media print { .no-print { display: none !important; } }
`;

const CSS_COMVERSICULO = `
  ${CSS_COMPLETO}
  .versiculo { font-size: 12pt; color: #2a2a20; }
`;

// ─────────────────────────────────────────────────────────
// Renderers por tipo
// ─────────────────────────────────────────────────────────
type Type = "BATISMO" | "OBREIRO" | "APRESENTACAO" | "CASAMENTO";
type Pattern = "completo" | "simplificado" | "com-versiculo";

function cssFor(p: Pattern): string {
  if (p === "simplificado") return CSS_SIMPLIFICADO;
  if (p === "com-versiculo") return CSS_COMVERSICULO;
  return CSS_COMPLETO;
}

function titleFor(t: Type): string {
  if (t === "APRESENTACAO") return "Certidão de Apresentação";
  if (t === "CASAMENTO") return "Certidão de Casamento";
  return t === "BATISMO" ? "Certidão de Batismo" : "Certificado de Obreiro";
}

function subtitleFor(t: Type): string {
  if (t === "APRESENTACAO") return "Apresentação de Criança";
  if (t === "CASAMENTO") return "Sacramento do Matrimônio";
  if (t === "BATISMO") return "Atestado eclesiástico de Sacramento Cristão";
  return "Reconhecimento ministerial";
}

function signaturesFor(t: Type, ctx: { pastor?: string | null }): string {
  const pastor = ctx.pastor || "________________________________";
  if (t === "CASAMENTO") {
    return `<div class="sig-block"><div class="sig-line">${escapeHtml(pastor)}</div><div class="sig-role">Celebrante</div></div>
    <div class="sig-block"><div class="sig-line">Noivo</div><div class="sig-role">Cônjuge</div></div>
    <div class="sig-block"><div class="sig-line">Noiva</div><div class="sig-role">Cônjuge</div></div>`;
  }
  if (t === "APRESENTACAO") {
    return `<div class="sig-block"><div class="sig-line">${escapeHtml(pastor)}</div><div class="sig-role">Celebrante</div></div>
    <div class="sig-block"><div class="sig-line">Pai</div><div class="sig-role"></div></div>
    <div class="sig-block"><div class="sig-line">Mãe</div><div class="sig-role"></div></div>`;
  }
  // BATISMO + OBREIRO
  return `<div class="sig-block"><div class="sig-line">${escapeHtml(pastor)}</div><div class="sig-role">${t === "BATISMO" ? "Quem batizou" : "Pastor Presidente"}</div></div>
  <div class="sig-block"><div class="sig-line">Secretário(a) da Igreja</div><div class="sig-role">1º Secretário(a)</div></div>`;
}

function bodyFor(
  t: Type,
  m: any,
  congregation: string,
  churchName: string
): string {
  const nome = `<span class="member-name editable" data-field="memberName">${escapeHtml(m.name)}</span>`;
  const cong = congregation ? `, na congregação <em>${escapeHtml(congregation)}</em>` : "";

  if (t === "BATISMO") {
    const pastor = `<strong class="editable" data-field="baptizedBy">${escapeHtml(m.baptizedBy) || "________________________________"}</strong>`;
    return `<p class="body">
      &nbsp;&nbsp;&nbsp;&nbsp;Certificamos, para os devidos fins e com fundamento no registro desta igreja,
      que ${nome}${m.birthDate ? `, nascido(a) em ${fmtDateLong(m.birthDate)},` : ""}
      foi solenemente batizado(a) em <strong class="editable" data-field="baptismDate">${fmtDateLong(m.baptismDate)}</strong>${cong},
      por imersão nas águas, conforme o mandamento do Senhor Jesus Cristo
      (Mateus 28:19), pelo(a) pastor(a) ${pastor}.
    </p>
    <p class="body" style="margin-top: 14px;">
      &nbsp;&nbsp;&nbsp;&nbsp;O(A) referido(a) irmão(ã) é membro em comunhão desta igreja,
      participa da Ceia do Senhor e goza de todos os direitos e deveres
      pertinentes ao corpo de Cristo. Por ser verdade, firmamos a presente
      certidão para que possa produzir os efeitos legais e eclesiásticos
      necessários.
    </p>`;
  }

  if (t === "OBREIRO") {
    const funcao = `<strong class="editable" data-field="obreiroRole">${escapeHtml(m.obreiroRole) || "Auxiliar"}</strong>`;
    return `<p class="body">
      &nbsp;&nbsp;&nbsp;&nbsp;Certificamos, com alegria e gratidão a Deus, que
      ${nome} é reconhecido(a) como <strong>obreiro(a)</strong> desta igreja,
      exercendo a função de ${funcao}${cong},
      desde <strong class="editable" data-field="obreiroSince">${fmtDateLong(m.obreiroSince)}</strong>.
    </p>
    <p class="body" style="margin-top: 14px;">
      &nbsp;&nbsp;&nbsp;&nbsp;Durante este período, o(a) referido(a) irmão(ã) tem se dedicado
      com zelo, fidelidade e amor ao serviço do Reino de Deus, colaborando
      ativamente na obra e no crescimento espiritual da comunidade.
      Por reconhecer a sua vocação e serviço, emitimos o presente certificado
      para que produza os efeitos eclesiásticos e pastorais cabíveis.
    </p>`;
  }

  if (t === "APRESENTACAO") {
    const pai = `<span class="editable" data-field="pai">${escapeHtml(m.pai) || "____________________"}</span>`;
    const mae = `<span class="editable" data-field="mae">${escapeHtml(m.mae) || "____________________"}</span>`;
    return `<p class="body">
      &nbsp;&nbsp;&nbsp;&nbsp;Certificamos, com alegria, que no dia <strong class="editable" data-field="dataApresentacao">${fmtDateLong(m.dataApresentacao)}</strong>,
      foi apresentada à igreja ${nome},${cong ? ` congregação <em>${escapeHtml(congregation)}</em>,` : ""}
      filha de ${pai} e ${mae}, em cerimônia realizada conforme o rito cristão
      de dedicação de crianças.
    </p>
    <p class="body" style="margin-top: 14px;">
      &nbsp;&nbsp;&nbsp;&nbsp;A criança é confiada ao cuidado da comunidade de fé,
      comprometendo-se os pais e a igreja a conduzi-la no caminho do Senhor,
      com amor, exemplo e ensino. Por ser verdade, firmamos a presente
      certidão para os fins eclesiásticos cabíveis.
    </p>`;
  }

  // CASAMENTO
  const conjuge = `<span class="editable" data-field="conjugeName">${escapeHtml(m.conjugeName) || "____________________"}</span>`;
  return `<p class="body">
    &nbsp;&nbsp;&nbsp;&nbsp;Certificamos, com a bênção de Deus e perante esta comunidade de fé,
    que <strong class="editable" data-field="memberName">${escapeHtml(m.name)}</strong> e ${conjuge}
    receberam o sacramento do santo matrimônio no dia <strong class="editable" data-field="dataCasamento">${fmtDateLong(m.dataCasamento)}</strong>${cong},
    em cerimônia presidida por pastor desta igreja,
    unindo-se pelo laço do matrimônio diante de Deus e dos homens.
  </p>
  <p class="body" style="margin-top: 14px;">
    &nbsp;&nbsp;&nbsp;&nbsp;O casal é acolhido em nossa comunidade como marido e esposa,
    comprometendo-se a viver em fidelidade, amor e respeito mútuo,
    conforme o mandamento das Sagradas Escrituras. Por ser verdade,
    firmamos a presente certidão para que produza os efeitos
    eclesiásticos e legais cabíveis.
  </p>`;
}

function render(opts: {
  type: Type;
  pattern: Pattern;
  member: any;
  congregation: string;
  churchName: string;
  documentId?: string;
  issuedAt: Date;
}): string {
  const { type, pattern, member, congregation, churchName, documentId, issuedAt } = opts;
  const css = cssFor(pattern);
  const title = titleFor(type);
  const subtitle = subtitleFor(type);
  const body = bodyFor(type, member, congregation, churchName);
  const signatures = signaturesFor(type, { pastor: member.baptizedBy });
  const versiculo = VERSICULOS[type] || "";

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>${title} — ${escapeHtml(member.name)}</title>
<style>${css}</style>
</head>
<body>
<div class="no-print">
  <button class="back" onclick="window.close()">← Voltar</button>
  <button onclick="window.print()">🖨 Imprimir / Salvar PDF</button>
</div>
<div class="page">
  <div class="header">
    <div class="church-name">${escapeHtml(churchName)}</div>
    ${pattern === "completo" || pattern === "com-versiculo" ? '<div class="tagline">— Comunidade de Fé e Serviço —</div><div class="cross">✝</div>' : ""}
  </div>

  <div class="title">${title}</div>
  <div class="subtitle">${subtitle}</div>

  ${body}

  ${pattern === "com-versiculo" || pattern === "completo" ? `<div class="versiculo">${versiculo}</div>` : ""}

  <div class="footer">
    <div class="signatures">
      ${signatures}
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
    const type = String(req.query.type || "BATISMO").toUpperCase() as Type;
    const pattern = String(req.query.pattern || "completo").toLowerCase() as Pattern;
    const save = String(req.query.save || "") === "true";

    if (!memberId) return res.status(400).send("memberId é obrigatório");
    if (!["BATISMO", "OBREIRO", "APRESENTACAO", "CASAMENTO"].includes(type)) {
      return res.status(400).send("type deve ser BATISMO, OBREIRO, APRESENTACAO ou CASAMENTO");
    }
    if (!["completo", "simplificado", "com-versiculo"].includes(pattern)) {
      return res.status(400).send("pattern deve ser completo, simplificado ou com-versiculo");
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
    let html: string = render({
      type,
      pattern,
      member,
      congregation: member.congregation?.name || "",
      churchName,
      issuedAt,
    });

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
          title: `${titleFor(type)} — ${member.name}`,
          type: type as any,
          url,
          fileName,
          fileSize: Buffer.byteLength(html, "utf-8"),
          mimeType: "text/html",
        },
      });
      html = render({
        type,
        pattern,
        member,
        congregation: member.congregation?.name || "",
        churchName,
        documentId: doc.id,
        issuedAt,
      });
      fs.writeFileSync(filePath, html, "utf-8");

      return res.json({
        success: true,
        documentId: doc.id,
        url,
        html,
      });
    }

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  })
);

router.post(
  "/save-edited",
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { memberId, type, html, title } = req.body as {
      memberId?: string;
      type?: Type;
      html?: string;
      title?: string;
    };
    if (!memberId || !type || !html) {
      return res.status(400).json({ success: false, error: "memberId, type, html são obrigatórios" });
    }
    if (!["BATISMO", "OBREIRO", "APRESENTACAO", "CASAMENTO"].includes(type)) {
      return res.status(400).json({ success: false, error: "type inválido" });
    }

    const member = await prisma.member.findFirst({
      where: { id: memberId, tenantId: req.user!.tenantId, deletedAt: null },
    });
    if (!member) return res.status(404).json({ success: false, error: "Membro não encontrado" });

    const fileName = `certificado-${type.toLowerCase()}-editado-${Date.now()}.html`;
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
        title: title || `${titleFor(type)} — ${member.name} (editado)`,
        type: type as any,
        url,
        fileName,
        fileSize: Buffer.byteLength(html, "utf-8"),
        mimeType: "text/html",
      },
    });

    res.json({
      success: true,
      documentId: doc.id,
      url,
    });
  })
);

export default router;
