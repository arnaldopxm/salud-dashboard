// ---------------------------------------------------------------------------
// src/ui/rehab.ts
// Pestaña Rehab: busca la sesión más reciente en Drive, la parsea y la renderiza.
// También expone generarSesionHoy (solo Cowork via iaAskClaude).
//
// Seguridad: todo dato externo interpolado en innerHTML pasa por escapeHtml.
// Los href de vídeos/Drive se usan en atributos href de <a> con rel="noopener".
// ---------------------------------------------------------------------------

import { escapeHtml } from '../utils/html';
import { fichaLinkHTML } from '../utils/html';
import { driveSearch, driveDownload, iaAskClaude, decodeBase64Utf8 } from '../core/drive';
import {
  parseSessionMarkdown,
  tryParseSesion,
  sesionGeneradaToParseada,
  filtrarArchivosSession,
} from '../domain/rehab';
import { getState, setState } from '../core/state';
import { patronesDeHoy } from '../domain/seleccion';
import { todayDayName } from '../utils/date';
import type { RutinaSalud, RehabEjercicio } from '../types/schema';

// ---------------------------------------------------------------------------
// Perfil — idéntico al index.html original (mismo prompt para mismo resultado)
// ---------------------------------------------------------------------------

const PERFIL =
  'Perfil: hombro derecho lesionado (NADA de dominadas, colgarse con carga ni press por encima de la cabeza con carga en el lado derecho; el izquierdo puede ir normal, el derecho solo en rango sin dolor). Hiperlaxitud articular (control sobre rango, no buscar el rango final). Objetivo general: compensar el sedentarismo (mucho tiempo sentado).';

// ---------------------------------------------------------------------------
// loadRehabSession
// ---------------------------------------------------------------------------

/**
 * Busca la sesión más reciente en Drive (query: title contains 'sesion'),
 * filtra por SESSION_RE, descarga, parsea y llama a renderRehabSession.
 * En error muestra mensaje + botones reintentar/generar.
 */
export async function loadRehabSession(): Promise<void> {
  const container = document.getElementById('rehab-content');
  if (!container) return;

  container.innerHTML =
    `<div class="loading-inline"><span class="mini-spinner"></span> Buscando sesión en 02-rutinas…</div>`;

  try {
    const searchData = await driveSearch("name contains 'sesion' and mimeType = 'text/plain'");
    const archivos = filtrarArchivosSession(searchData.files ?? []);

    if (archivos.length === 0) {
      renderRehabEmpty();
      return;
    }

    const file = archivos[0]!;
    const dlData = await driveDownload(file.id);
    if (!dlData.content) throw new Error('La sesión no devolvió contenido');

    const md = decodeBase64Utf8(dlData.content);
    const driveFileArg: { title: string; viewUrl?: string; modifiedTime?: string } = { title: file.title };
    if (file.viewUrl !== undefined) driveFileArg.viewUrl = file.viewUrl;
    if (file.modifiedTime !== undefined) driveFileArg.modifiedTime = file.modifiedTime;
    const parsed = parseSessionMarkdown(md, driveFileArg);

    setState({ rehabSession: parsed });
    renderRehabSession();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    container.innerHTML =
      `<div class="rehab-md-text" style="color:var(--accent-red)">` +
      `No se pudo cargar la sesión: ${escapeHtml(msg)}</div>` +
      `<button class="btn-secondary" onclick="rehabLoaded=true; loadRehabSession()">Reintentar</button>` +
      `<button class="btn-primary" style="margin-top:0.5rem" onclick="generarSesionHoy()">Generar sesión de hoy</button>`;
  }
}

// ---------------------------------------------------------------------------
// renderRehabEmpty
// ---------------------------------------------------------------------------

/** Estado vacío: no hay sesiones en Drive aún. */
export function renderRehabEmpty(): void {
  const container = document.getElementById('rehab-content');
  if (!container) return;
  container.innerHTML =
    `<div class="empty-hint">No hay ninguna sesión en <b>02-rutinas</b> todavía.<br>` +
    `Genera una respetando tu perfil.</div>` +
    `<button class="btn-primary" onclick="generarSesionHoy()">Generar sesión de hoy</button>`;
}

// ---------------------------------------------------------------------------
// renderRehabSession
// ---------------------------------------------------------------------------

/**
 * Renderiza la sesión parseada guardada en AppState.rehabSession.
 * Si no hay sesión o no tiene bloques, cae en renderRehabEmpty.
 */
export function renderRehabSession(): void {
  const s = getState().rehabSession;
  const container = document.getElementById('rehab-content');
  if (!container) return;

  if (!s || s.bloques.length === 0) {
    renderRehabEmpty();
    return;
  }

  let html =
    `<div class="rehab-session-title">${escapeHtml(s.titulo)}</div>` +
    `<div class="rehab-session-meta">📄 ${escapeHtml(s.fileName)}` +
    (s.viewUrl
      ? ` · <a class="rehab-link" style="padding:0;border:none;background:none" ` +
        `href="${s.viewUrl}" target="_blank" rel="noopener">abrir en Drive</a>`
      : '') +
    `</div>`;

  s.bloques.forEach((b, bi) => {
    html += `<div class="rehab-block-title">${escapeHtml(b.titulo)}</div>`;
    b.ejercicios.forEach((ej, ei) => {
      html += _renderRehabEjercicio(ej, bi, ei);
    });
  });

  html +=
    `<button class="btn-secondary" onclick="generarSesionHoy()">` +
    `🔄 Generar otra sesión de hoy</button>`;

  container.innerHTML = html;
}

// ---------------------------------------------------------------------------
// generarSesionHoy
// ---------------------------------------------------------------------------

/**
 * Llama a iaAskClaude con el prompt completo, parsea la respuesta y
 * llama a renderRehabSession. Solo funciona en Cowork.
 */
export async function generarSesionHoy(data?: RutinaSalud): Promise<void> {
  const container = document.getElementById('rehab-content');
  if (!container) return;

  container.innerHTML =
    `<div class="loading-inline"><span class="mini-spinner"></span> Generando sesión de hoy con Claude…</div>`;

  // Patrones del día desde el plan (si está disponible)
  const appData = data ?? getState().data;
  let patsHoy: string[] = [];
  if (appData?.entrenamiento?.rotacion_semanal) {
    patsHoy = patronesDeHoy(appData.entrenamiento.rotacion_semanal, todayDayName());
  }

  const prompt =
    `Genera una SESIÓN de rehabilitación y compensación de 15-20 minutos para hoy.\n` +
    `${PERFIL}\n` +
    `Patrones que tocan hoy según mi rotación: ${patsHoy.join(', ') || 'tracción, cuello, core'}.\n` +
    `Foco: compensar el sedentarismo (espalda baja, dorsal, cuello, trapecios, romboides, glúteo, core) ` +
    `y meter algo de fuerza razonable. Material: kettlebell 10 kg, 2 bandas elásticas, cajón, suelo. ` +
    `Control sobre rango por la hiperlaxitud.\n\n` +
    `Estructura la sesión en bloques (entrada/movilidad, fuerza, compensación, cierre). ` +
    `Cada ejercicio con series×reps o tiempo, una nota de forma breve, y un enlace de vídeo (YouTube preferible).\n\n` +
    `Responde ÚNICAMENTE con un objeto JSON válido, sin texto alrededor, con esta forma:\n` +
    `{"titulo":"Sesión de hoy — ...","bloques":[{"titulo":"Bloque 1 — ...","ejercicios":[` +
    `{"nombre":"...","detalle":"series×reps o tiempo","nota":"nota de forma","video":"https://..."}]}]}`;

  try {
    const res = await iaAskClaude(prompt);
    const text =
      typeof res === 'string'
        ? res
        : (res as unknown as { text?: string; content?: string; response?: string })?.text
          ?? JSON.stringify(res);

    const sesion = tryParseSesion(text);
    if (sesion) {
      setState({ rehabSession: sesionGeneradaToParseada(sesion) });
      renderRehabSession();
    } else {
      container.innerHTML =
        `<div class="rehab-session-title">Sesión generada</div>` +
        `<div class="alt-raw">${escapeHtml(text)}</div>` +
        `<button class="btn-secondary" onclick="generarSesionHoy()">🔄 Generar otra</button>`;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    container.innerHTML =
      `<div class="rehab-md-text" style="color:var(--accent-red)">` +
      `No se pudo generar la sesión: ${escapeHtml(msg)}</div>` +
      `<button class="btn-primary" onclick="generarSesionHoy()">Reintentar</button>`;
  }
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function _renderRehabEjercicio(ej: RehabEjercicio, bi: number, ei: number): string {
  const key = `rehab-${bi}-${ei}`;
  const nombre = ej.sustituto ? ej.sustituto.nombre : ej.nombre;
  const detalle = [ej.detalle, ej.nota].filter(Boolean).join(' · ');

  // URL de vídeo: si hay sustituto usa la del sustituto, si no la del ejercicio original
  const vurl =
    ej.sustituto && ej.sustituto.video
      ? ej.sustituto.video
      : ej.video
        ? ej.video.url
        : null;

  let html =
    `<div class="rehab-ej${ej.sustituto ? ' sustituido' : ''}" id="${key}">` +
    `<div class="rehab-ej-nombre">${escapeHtml(nombre)}</div>` +
    (detalle ? `<div class="rehab-ej-detalle">${escapeHtml(detalle)}</div>` : '') +
    (ej.sustituto
      ? `<div class="rehab-sustituido-badge">↻ Sustituye a: ${escapeHtml(ej.nombre)}</div>`
      : '') +
    `<div class="rehab-ej-actions">`;

  if (vurl) {
    html += `<a class="rehab-link" href="${vurl}" target="_blank" rel="noopener">▶ Vídeo</a>`;
  }

  if (!ej.sustituto) {
    const fichaBtn = fichaLinkHTML(ej.slug, ej.nombre);
    if (fichaBtn) html += fichaBtn;
  }

  html +=
    `<button class="rehab-change-btn" ` +
    `onclick="toggleChangePanel('${key}','rehab',${bi},${ei})">⇄ Cambiar ejercicio</button>` +
    `</div>` +
    `<div id="panel-${key}"></div>` +
    `</div>`;

  return html;
}
