import { escapeHtml } from '../utils/html';
import type { AlternativaIA, RehabBloque, RehabEjercicio, RehabSesionParseada } from '../types/schema';

// ---------------------------------------------------------------------------
// Parser de sesión Markdown
// ---------------------------------------------------------------------------

interface DriveFile {
  title: string;
  viewUrl?: string;
  modifiedTime?: string;
}

const EX_RE = /^\s*(?:\d+[.)]\s+|[-*+]\s+)?\*\*\[\[([^\]|]+)(?:\|([^\]]+))?\]\]\*\*\s*(?:[—\-–:]\s*(.*))?$/;
const VIDEO_RE = /v[íi]deo\s*:\s*\[([^\]]*)\]\(([^)]+)\)/i;
const LINK_RE = /\[([^\]]*)\]\(([^)]+)\)/;
const SKIP_HEADERS_RE = /relacion|bandera|changelog|c[óo]mo encaja|contexto|regla/i;

export function parseSessionMarkdown(md: string, file: DriveFile): RehabSesionParseada {
  const lines = md.replace(/\r/g, '').split('\n');
  let titulo = (file.title || 'Sesión').replace(/\.md$/i, '');
  const bloques: RehabBloque[] = [];
  let currentBloque: RehabBloque | null = null;
  let currentEj: RehabEjercicio | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();

    const h1 = line.match(/^#\s+(.+)$/);
    if (h1 && /sesi/i.test(h1[1]!)) {
      titulo = h1[1]!.trim();
      continue;
    }

    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      if (SKIP_HEADERS_RE.test(h2[1]!)) {
        currentBloque = null;
        currentEj = null;
        continue;
      }
      currentBloque = { titulo: h2[1]!.trim(), ejercicios: [] };
      bloques.push(currentBloque);
      currentEj = null;
      continue;
    }

    const ex = line.match(EX_RE);
    if (ex) {
      if (!currentBloque) {
        currentBloque = { titulo: 'Ejercicios', ejercicios: [] };
        bloques.push(currentBloque);
      }
      const slug = ex[1]!.trim();
      const nombre = (ex[2] ?? slug).trim();
      const detalle = (ex[3] ?? '').trim();
      currentEj = { nombre, slug, detalle, nota: '', video: null, sustituto: null };
      currentBloque.ejercicios.push(currentEj);
      continue;
    }

    if (currentEj) {
      const cleaned = rawLine.replace(/^>\s*/, '').trim();
      const vm = cleaned.match(VIDEO_RE);
      if (vm) {
        const lm = cleaned.match(LINK_RE);
        currentEj.video = { label: lm ? lm[1]! : 'Vídeo', url: lm ? lm[2]! : '' };
        continue;
      }
      if (/^>/.test(rawLine) && !currentEj.nota) {
        currentEj.nota = cleaned;
      }
    }
  }

  const ejBloques = bloques.filter(b => b.ejercicios.length > 0);
  const result: RehabSesionParseada = {
    titulo,
    fileName: file.title,
    viewUrl: file.viewUrl ?? null,
    bloques: ejBloques,
  };
  if (file.modifiedTime !== undefined) result.modifiedTime = file.modifiedTime;
  return result;
}

// ---------------------------------------------------------------------------
// Parsers de respuestas IA
// ---------------------------------------------------------------------------

function extractJson(text: string): string {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  // Encuentra la posición del primer '{' y del primer '[' y usa el que aparece antes.
  const objIdx = stripped.indexOf('{');
  const arrIdx = stripped.indexOf('[');
  if (arrIdx !== -1 && (objIdx === -1 || arrIdx < objIdx)) {
    const arr = stripped.match(/\[[\s\S]*\]/);
    if (arr) return arr[0];
  }
  const obj = stripped.match(/\{[\s\S]*\}/);
  if (obj) return obj[0];
  return stripped;
}

export function tryParseAlternativas(text: string): AlternativaIA[] | null {
  if (!text) return null;
  try {
    const parsed: unknown = JSON.parse(extractJson(text));
    if (Array.isArray(parsed)) return parsed as AlternativaIA[];
    if (parsed !== null && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj['alternativas'])) return obj['alternativas'] as AlternativaIA[];
    }
  } catch {
    // respuesta malformada — la UI mostrará el texto crudo
  }
  return null;
}

export interface SesionGenerada {
  titulo: string;
  bloques: Array<{
    titulo: string;
    ejercicios: Array<{
      nombre: string;
      detalle: string;
      nota: string;
      video?: string;
    }>;
  }>;
}

export function tryParseSesion(text: string): SesionGenerada | null {
  if (!text) return null;
  try {
    const obj = JSON.parse(extractJson(text));
    if (obj && Array.isArray(obj.bloques)) return obj as SesionGenerada;
  } catch {
    // respuesta malformada
  }
  return null;
}

export function sesionGeneradaToParseada(sesion: SesionGenerada): RehabSesionParseada {
  return {
    titulo: sesion.titulo || 'Sesión de hoy',
    fileName: 'Generada por Claude (no guardada)',
    viewUrl: null,
    bloques: sesion.bloques
      .map(b => ({
        titulo: b.titulo || 'Bloque',
        ejercicios: b.ejercicios.map(e => ({
          nombre: e.nombre,
          slug: '',
          detalle: e.detalle || '',
          nota: e.nota || '',
          video: e.video ? { label: 'Vídeo', url: e.video } : null,
          sustituto: null,
        })),
      }))
      .filter(b => b.ejercicios.length > 0),
  };
}

// ---------------------------------------------------------------------------
// Filtro de archivos de sesión Drive
// ---------------------------------------------------------------------------

const DATE_PREFIX_RE = /^(\d{8})[-_](\d{4})/;
const SESSION_RE = /^(\d{8})[-_](\d{4})_sesion[-_]/i;
const SKIP_RE = /plantilla|template|contexto|_log_/i;

function dateKey(title: string): number {
  const m = title.match(DATE_PREFIX_RE);
  return m ? Number(m[1]! + m[2]!) : 0;
}

export interface DriveFileRef {
  title: string;
  modifiedTime?: string;
  id: string;
  viewUrl?: string;
}

export function filtrarArchivosSession(files: DriveFileRef[]): DriveFileRef[] {
  return files
    .filter(f => !SKIP_RE.test(f.title) && SESSION_RE.test(f.title))
    .sort((a, b) => {
      const d = dateKey(b.title) - dateKey(a.title);
      return d !== 0 ? d : (b.modifiedTime ?? '').localeCompare(a.modifiedTime ?? '');
    });
}
