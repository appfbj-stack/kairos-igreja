/**
 * certificate-templates.routes.ts
 *
 * Área de "Modelos Prontos" para o Pastor subir templates de certificados
 * (PDF, HTML, JPG, PNG) que ele já tem prontos e quer reutilizar.
 *
 * Não usa tabela no banco — é só filesystem em /uploads/certificate-templates/.
 * O nome do arquivo é prefixado com o tipo (BATISMO-, OBREIRO-, APRESENTACAO-,
 * CASAMENTO-) pra permitir filtro na listagem.
 *
 * Rotas:
 *   GET    /api/certificate-templates?type=BATISMO        — lista (opcional filtro)
 *   POST   /api/certificate-templates/upload              — upload (multipart 'file', campo 'type')
 *   DELETE /api/certificate-templates/:filename           — remove
 */

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authMiddleware } from '../../middleware/auth';

const router = Router();

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
const TEMPLATES_DIR = path.join(UPLOAD_DIR, 'certificate-templates');

if (!fs.existsSync(TEMPLATES_DIR)) {
  fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
  console.log(`[certificate-templates] pasta criada: ${TEMPLATES_DIR}`);
}

const ALLOWED_TYPES = ['BATISMO', 'OBREIRO', 'APRESENTACAO', 'CASAMENTO'] as const;
type TemplateType = (typeof ALLOWED_TYPES)[number];

function safeOriginalName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100) || 'modelo';
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TEMPLATES_DIR),
  filename: (_req, file, cb) => {
    // Salva primeiro com nome temporário; renomeamos no handler com o type correto
    const ts = Date.now();
    const safe = safeOriginalName(file.originalname);
    cb(null, `TMP-${ts}-${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    const okExt = /\.(pdf|html?|jpg|jpeg|png)$/i.test(file.originalname);
    const okMime = /^(application\/pdf|text\/html|image\/(jpeg|jpg|png))$/i.test(file.mimetype);
    if (okExt || okMime) return cb(null, true);
    cb(new Error('Tipo não permitido. Aceitos: PDF, HTML, JPG, PNG.'));
  },
});

function parseFilename(filename: string) {
  // Formato: TIPO-TS-nome.pdf  ou  GERAL-TS-nome.pdf
  const m = filename.match(/^(BATISMO|OBREIRO|APRESENTACAO|CASAMENTO|GERAL)-(\d+)-(.+)$/);
  if (!m) {
    return { type: 'GERAL' as 'GERAL' | TemplateType, ts: 0, originalName: filename, ext: path.extname(filename) };
  }
  return {
    type: m[1] as 'GERAL' | TemplateType,
    ts: Number(m[2]),
    originalName: m[3],
    ext: path.extname(m[3]),
  };
}

function statTemplate(filename: string) {
  const full = path.join(TEMPLATES_DIR, filename);
  if (!fs.existsSync(full)) return null;
  const stat = fs.statSync(full);
  const parsed = parseFilename(filename);
  return {
    filename,
    type: parsed.type,
    originalName: parsed.originalName,
    ext: parsed.ext,
    size: stat.size,
    url: `/uploads/certificate-templates/${filename}`,
    createdAt: stat.birthtime.toISOString(),
  };
}

// GET /api/certificate-templates?type=BATISMO
router.get('/', authMiddleware, (req, res) => {
  try {
    const typeFilter = String(req.query.type || '').toUpperCase();
    const files = fs
      .readdirSync(TEMPLATES_DIR)
      .filter((f) => !f.startsWith('.'))
      .map(statTemplate)
      .filter((t): t is NonNullable<typeof t> => t !== null)
      .filter((t) => !typeFilter || t.type === typeFilter)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    res.json({ success: true, templates: files });
  } catch (e: any) {
    console.error('[certificate-templates] list error:', e);
    res.status(500).json({ success: false, error: e.message || 'Erro ao listar' });
  }
});

// POST /api/certificate-templates/upload  (multipart: file + type)
router.post('/upload', authMiddleware, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'Arquivo é obrigatório' });
  }
  // Renomeia com o type correto (multer chama filename() antes do body ser parseado)
  const rawType = String(req.body?.type || 'GERAL').toUpperCase();
  const t = (ALLOWED_TYPES as readonly string[]).includes(rawType) ? rawType : 'GERAL';
  const tmpName = req.file.filename;
  const finalName = `${t}-${Date.now()}-${safeOriginalName(req.file.originalname)}`;
  try {
    fs.renameSync(path.join(TEMPLATES_DIR, tmpName), path.join(TEMPLATES_DIR, finalName));
  } catch (e: any) {
    // Se rename falhar, mantém o TMP (não bloqueia o upload)
    console.error('[certificate-templates] rename error:', e);
  }
  const stat = statTemplate(finalName);
  res.json({ success: true, template: stat });
});

// DELETE /api/certificate-templates/:filename
router.delete('/:filename', authMiddleware, (req, res) => {
  try {
    const safe = path.basename(req.params.filename);
    if (safe !== req.params.filename || safe.includes('..')) {
      return res.status(400).json({ success: false, error: 'Nome inválido' });
    }
    const full = path.join(TEMPLATES_DIR, safe);
    if (!fs.existsSync(full)) {
      return res.status(404).json({ success: false, error: 'Modelo não encontrado' });
    }
    fs.unlinkSync(full);
    res.json({ success: true });
  } catch (e: any) {
    console.error('[certificate-templates] delete error:', e);
    res.status(500).json({ success: false, error: e.message || 'Erro ao remover' });
  }
});

export default router;
