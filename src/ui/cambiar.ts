// ---------------------------------------------------------------------------
// src/ui/cambiar.ts
// Panel de "Cambiar ejercicio" — pool local + IA (solo Cowork).
// Gestiona el estado por key en AppState.changeState.
//
// Seguridad: todo dato externo interpolado en innerHTML pasa por escapeHtml.
// Los onclick de buttons usan parámetros primitivos (string/number) escapados.
// ---------------------------------------------------------------------------

import { escapeHtml, fichaLinkHTML } from '../utils/html';
import { iaAskClaude } from '../core/drive';
import { getState, setState } from '../core/state';
import type { ChangePanelState } from '../core/state';
import type { AlternativaPool, AlternativaIA, RutinaSalud } from '../types/schema';
import { kbUnidadLabel } from './fuerza';
import { tryParseAlternativas as _tryParseAlternativasFromDomain } from '../domain/rehab';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

// Perfil de salud — idéntico al index.html original para que el prompt sea el mismo.
const PERFIL =
  'Perfil: hombro derecho lesionado (NADA de dominadas, colgarse con carga ni press por encima de la cabeza con carga en el lado derecho; el izquierdo puede ir normal, el derecho solo en rango sin dolor). Hiperlaxitud articular (control sobre rango, no buscar el rango final). Objetivo general: compensar el sedentarismo (mucho tiempo sentado).';

const MOTIVOS = [
  { id: 'aburre',     label: 'Me aburre' },
  { id: 'molesta',    label: 'Me molesta' },
  { id: 'sin-espacio', label: 'Sin espacio' },
  { id: 'sin-energia', label: 'Sin energía' },
] as const;

type MotivoId = typeof MOTIVOS[number]['id'];

// ---------------------------------------------------------------------------
// Helpers de acceso al estado de ejercicio activo
// ---------------------------------------------------------------------------

interface EjInfo {
  nombre: string;
  objetivo: string;
  detalle: string;
}

function getEjercicioFor(
  data: RutinaSalud,
  context: 'fz' | 'rehab',
  bi: number,
  ei: number,
): EjInfo {
  if (context === 'rehab') {
    const session = getState().rehabSession;
    if (!session) return { nombre: '—', objetivo: '', detalle: '' };
    const ej = session.bloques[bi]?.ejercicios[ei];
    if (!ej) return { nombre: '—', objetivo: '', detalle: '' };
    return {
      nombre: ej.sustituto ? ej.sustituto.nombre : ej.nombre,
      objetivo: session.bloques[bi]!.titulo,
      detalle: [ej.detalle, ej.nota].filter(Boolean).join(' · '),
    };
  } else {
    const e = data.entrenamiento;
    if (!e) return { nombre: '—', objetivo: '', detalle: '' };
    const cat = e.categorias[bi];
    const ej = cat?.pool[ei];
    if (!cat || !ej) return { nombre: '—', objetivo: '', detalle: '' };
    return {
      nombre: ej._sustituto ? ej._sustituto.nombre : ej.nombre,
      objetivo: `Patrón: ${cat.nombre}. ${cat.objetivo ?? ''} (${ej.series}×${ej.reps} ${kbUnidadLabel(ej.unidad)})`,
      detalle: ej.nota ?? '',
    };
  }
}

// ---------------------------------------------------------------------------
// alternativasDelPool
// ---------------------------------------------------------------------------

/**
 * Devuelve hasta 4 alternativas del pool de la misma categoría (solo 'fz').
 * Para 'rehab' devuelve [] — el panel ofrece solo IA como respaldo.
 * Lógica idéntica al index.html original.
 */
export function alternativasDelPool(
  data: RutinaSalud,
  context: 'fz' | 'rehab',
  bi: number,
  ei: number,
  motivo: string,
): AlternativaPool[] {
  if (context !== 'fz') return [];
  const e = data.entrenamiento;
  const cat = e?.categorias[bi];
  if (!cat?.pool) return [];

  const actual = cat.pool[ei];
  const grupoActual = actual?.grupo_equivalente ?? null;
  const texto = (ej: { nombre?: string; nota?: string }) =>
    ((ej.nombre ?? '') + ' ' + (ej.nota ?? '')).toLowerCase();

  let cands = cat.pool
    .map((ej, idx) => ({ ej, idx }))
    .filter(o => o.idx !== ei);

  if (motivo === 'sin-energia') {
    cands = cands.filter(o => o.ej.tier !== 'avanzado');
    cands.sort(
      (a, b) =>
        (a.ej.tier === 'base' ? 0 : 1) - (b.ej.tier === 'base' ? 0 : 1),
    );
  } else if (motivo === 'molesta') {
    cands = cands.filter(o => o.ej.tier !== 'avanzado');
    const amable = (o: { ej: { nombre?: string; nota?: string } }) =>
      /banda|suelo|floor|pared|caj[oó]n|isom/.test(texto(o.ej));
    cands.sort((a, b) => (amable(b) ? 1 : 0) - (amable(a) ? 1 : 0));
  } else if (motivo === 'sin-espacio') {
    const compacto = (o: { ej: { nombre?: string; nota?: string } }) =>
      /banda|de pie|pared|isom/.test(texto(o.ej));
    cands.sort((a, b) => (compacto(b) ? 1 : 0) - (compacto(a) ? 1 : 0));
  } else {
    // 'aburre' o cualquier otro: prioriza mismo grupo_equivalente
    cands.sort((a, b) => {
      const am = a.ej.grupo_equivalente === grupoActual ? 0 : 1;
      const bm = b.ej.grupo_equivalente === grupoActual ? 0 : 1;
      return am - bm;
    });
  }

  return cands.slice(0, 4).map(o => ({
    nombre: o.ej.nombre,
    descripcion: [
      o.ej.nota,
      `${o.ej.series}×${o.ej.reps} ${kbUnidadLabel(o.ej.unidad)}`,
      o.ej.tier,
    ]
      .filter(Boolean)
      .join(' · '),
    ficha: o.ej.ficha ?? null,
    poolIdx: o.idx,
  }));
}

// ---------------------------------------------------------------------------
// toggleChangePanel
// ---------------------------------------------------------------------------

/**
 * Abre el panel si estaba cerrado; lo cierra si ya estaba abierto.
 * Solo hay un panel abierto a la vez.
 */
export function toggleChangePanel(
  key: string,
  context: 'fz' | 'rehab',
  bi: number,
  ei: number,
): void {
  const panel = document.getElementById('panel-' + key);
  if (!panel) return;

  const state = getState();
  if (state.openChangePanel === key) {
    setState({ openChangePanel: null });
    panel.innerHTML = '';
    return;
  }

  // Cierra el panel anterior si existe
  if (state.openChangePanel) {
    const prev = document.getElementById('panel-' + state.openChangePanel);
    if (prev) prev.innerHTML = '';
  }

  setState({ openChangePanel: key });

  // Inicializa el estado de este panel si no existe
  if (!state.changeState[key]) {
    setState({
      changeState: {
        ...state.changeState,
        [key]: { motivo: null, loading: false, alternativas: null, raw: null },
      },
    });
  }

  const data = getState().data;
  if (data) renderChangePanel(key, context, bi, ei, data);
}

// ---------------------------------------------------------------------------
// renderChangePanel
// ---------------------------------------------------------------------------

/** Renderiza el contenido del panel de cambio en #panel-{key}. */
export function renderChangePanel(
  key: string,
  context: 'fz' | 'rehab',
  bi: number,
  ei: number,
  data: RutinaSalud,
): void {
  const panel = document.getElementById('panel-' + key);
  if (!panel) return;

  const st: ChangePanelState = getState().changeState[key] ?? {
    motivo: null,
    loading: false,
    alternativas: null,
    raw: null,
  };

  const ejInfo = getEjercicioFor(data, context, bi, ei);

  // ---- Chips de motivo ----
  const motivoChips = MOTIVOS.map(m =>
    `<button class="motivo-chip${st.motivo === m.id ? ' active' : ''}" ` +
    `onclick="selectMotivo('${escapeHtml(key)}','${context}',${bi},${ei},'${m.id}')">` +
    `${escapeHtml(m.label)}</button>`,
  ).join('');

  let html =
    `<div class="change-panel">` +
    `<div class="change-panel-title">Cambiar: ${escapeHtml(ejInfo.nombre)}</div>` +
    `<div class="motivo-row">${motivoChips}</div>`;

  // ---- Pool de alternativas (solo fz, solo si hay motivo) ----
  if (st.motivo) {
    const delPool = alternativasDelPool(data, context, bi, ei, st.motivo);
    if (delPool.length > 0) {
      html += `<div class="alt-pool-label">Del pool · mismo patrón, afinado a tus lesiones</div><div class="alt-list">`;
      delPool.forEach(alt => {
        const fichaBtn = alt.ficha ? fichaLinkHTML(alt.ficha, alt.nombre) : '';
        html +=
          `<div class="alt-item alt-pool">` +
          `<div class="alt-item-nombre">${escapeHtml(alt.nombre)}</div>` +
          (alt.descripcion
            ? `<div class="alt-item-desc">${escapeHtml(alt.descripcion)}</div>`
            : '') +
          `<div class="alt-item-actions">` +
          fichaBtn +
          `<button class="alt-choose-btn" ` +
          `onclick="elegirDelPool('${escapeHtml(key)}','${context}',${bi},${ei},${alt.poolIdx})">` +
          `✓ Usar esta</button>` +
          `</div></div>`;
      });
      html += `</div>`;
    } else if (context === 'fz') {
      const catNombre = data.entrenamiento?.categorias[bi]?.nombre ?? '';
      html +=
        `<div class="alt-item-desc" style="margin-bottom:0.4rem">` +
        `No hay más equivalentes en el pool para ese motivo. Puedes ampliarlo ` +
        `(pídeme "añade X al pool de ${escapeHtml(catNombre)}") ` +
        `o pedir una sugerencia con IA abajo.</div>`;
    }
  }

  // ---- Estado IA ----
  if (st.loading) {
    html +=
      `<div class="loading-inline"><span class="mini-spinner"></span> Pidiendo sugerencia con IA…</div>`;
  } else if (st.alternativas || st.raw) {
    html += _renderAlternativasIA(key, context, bi, ei, st);
  } else if (st.motivo) {
    html +=
      `<button class="change-ia-btn" ` +
      `onclick="pedirAlternativasIA('${escapeHtml(key)}','${context}',${bi},${ei})">` +
      `＋ Sugerencia con IA (solo en Cowork)</button>`;
  }

  html += `</div>`;
  panel.innerHTML = html;
}

// ---------------------------------------------------------------------------
// selectMotivo
// ---------------------------------------------------------------------------

export function selectMotivo(
  key: string,
  context: 'fz' | 'rehab',
  bi: number,
  ei: number,
  motivo: string,
): void {
  const state = getState();
  setState({
    changeState: {
      ...state.changeState,
      [key]: { motivo, loading: false, alternativas: null, raw: null },
    },
  });
  const data = getState().data;
  if (data) renderChangePanel(key, context, bi, ei, data);
}

// ---------------------------------------------------------------------------
// pedirAlternativasIA
// ---------------------------------------------------------------------------

export async function pedirAlternativasIA(
  key: string,
  context: 'fz' | 'rehab',
  bi: number,
  ei: number,
): Promise<void> {
  const state = getState();
  const st = state.changeState[key];
  if (!st?.motivo || !state.data) return;

  setState({
    changeState: {
      ...state.changeState,
      [key]: { ...st, loading: true },
    },
  });
  renderChangePanel(key, context, bi, ei, state.data);

  const ejInfo = getEjercicioFor(state.data, context, bi, ei);
  const motivoLabel =
    MOTIVOS.find(m => m.id === (st.motivo as MotivoId))?.label ?? st.motivo ?? '';

  const prompt =
    `Necesito 2-3 ALTERNATIVAS a un ejercicio dentro de mi rutina de salud.\n` +
    `Ejercicio a sustituir: "${ejInfo.nombre}".\n` +
    `Objetivo / músculo / contexto: ${ejInfo.objetivo}.` +
    (ejInfo.detalle ? ` Notas: ${ejInfo.detalle}.` : '') + `\n` +
    `Motivo del cambio: ${motivoLabel}.\n` +
    `${PERFIL}\n` +
    `Material disponible: kettlebell 10kg, 2 bandas elásticas (blanda y dura), barra de dominadas (sin colgarse con carga), cajón flamenco, peso corporal.\n` +
    `Cada alternativa debe entrenar el MISMO patrón o grupo muscular, respetar el hombro derecho y la hiperlaxitud, e incluir un enlace de vídeo (YouTube preferiblemente). Marca cuál recomiendas.\n\n` +
    `Responde ÚNICAMENTE con un objeto JSON válido, sin texto alrededor, con esta forma:\n` +
    `{"alternativas":[{"nombre":"...","descripcion":"breve, por qué encaja y nota de forma","video":"https://...","recomendado":true|false}]}`;

  let alternativas: AlternativaIA[] | null = null;
  let raw: string | null = null;

  try {
    const res = await iaAskClaude(prompt);
    const text = typeof res === 'string'
      ? res
      : (res as unknown as { text?: string; content?: string; response?: string })?.text
        ?? JSON.stringify(res);
    const parsed = _tryParseAlternativasFromDomain(text);
    if (parsed && parsed.length > 0) {
      alternativas = parsed;
    } else {
      raw = text;
    }
  } catch (e) {
    raw = (e instanceof Error ? e.message : String(e));
  }

  const currentState = getState();
  setState({
    changeState: {
      ...currentState.changeState,
      [key]: { motivo: st.motivo, loading: false, alternativas, raw },
    },
  });
  const data = getState().data;
  if (data) renderChangePanel(key, context, bi, ei, data);
}

// ---------------------------------------------------------------------------
// elegirDelPool
// ---------------------------------------------------------------------------

/**
 * Aplica una alternativa del pool al ejercicio[ei] de la categoría[bi].
 * Solo aplicable en contexto 'fz'.
 */
export function elegirDelPool(
  key: string,
  context: 'fz' | 'rehab',
  bi: number,
  ei: number,
  poolIdx: number,
): void {
  if (context !== 'fz') return;
  const data = getState().data;
  if (!data?.entrenamiento) return;

  const cat = data.entrenamiento.categorias[bi];
  const nuevo = cat?.pool[poolIdx];
  if (!nuevo || !cat?.pool[ei]) return;

  cat.pool[ei]!._sustituto = {
    nombre: nuevo.nombre,
    video: null,
    ficha: nuevo.ficha ?? null,
  };

  setState({ openChangePanel: null });

  // Re-renderiza fuerza — importación diferida para romper ciclo de dependencia
  void import('./fuerza').then(({ renderFuerza }) => {
    const s = getState();
    if (s.data) {
      renderFuerza(s.data, localStorage, new Date().toISOString().slice(0, 10));
    }
  });
}

// ---------------------------------------------------------------------------
// elegirAlternativaIA
// ---------------------------------------------------------------------------

/**
 * Aplica la alternativa IA elegida al ejercicio. En 'rehab' muta rehabSession;
 * en 'fz' muta el pool de la categoría.
 */
export function elegirAlternativaIA(
  key: string,
  context: 'fz' | 'rehab',
  bi: number,
  ei: number,
  ai: number,
): void {
  const state = getState();
  const st = state.changeState[key];
  const alt = st?.alternativas?.[ai];
  if (!alt) return;

  if (context === 'rehab') {
    const session = state.rehabSession;
    const ej = session?.bloques[bi]?.ejercicios[ei];
    if (!ej) return;
    ej.sustituto = { nombre: alt.nombre, video: alt.video ?? null };
    setState({ openChangePanel: null });
    void import('./rehab').then(({ renderRehabSession }) => {
      renderRehabSession();
    });
  } else {
    const data = state.data;
    if (!data?.entrenamiento) return;
    const cat = data.entrenamiento.categorias[bi];
    if (!cat?.pool[ei]) return;
    cat.pool[ei]!._sustituto = {
      nombre: alt.nombre,
      video: alt.video ?? null,
      ficha: null,
    };
    setState({ openChangePanel: null });
    void import('./fuerza').then(({ renderFuerza }) => {
      const s = getState();
      if (s.data) {
        renderFuerza(s.data, localStorage, new Date().toISOString().slice(0, 10));
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function _renderAlternativasIA(
  key: string,
  context: 'fz' | 'rehab',
  bi: number,
  ei: number,
  st: ChangePanelState,
): string {
  let html =
    `<div class="alt-ia-label">Sugerencia con IA</div>` +
    `<div class="alt-ia-warning">` +
    `⚠ No validada por fisio. Revísala con criterio antes de adoptarla; ` +
    `no tiene ficha en tu vault.</div>` +
    `<div class="alt-list">`;

  if (st.alternativas && st.alternativas.length > 0) {
    st.alternativas.forEach((alt, idx) => {
      html +=
        `<div class="alt-item">` +
        `<div class="alt-item-nombre">${escapeHtml(alt.nombre)}${alt.recomendado ? ' ⭐' : ''}</div>` +
        (alt.descripcion
          ? `<div class="alt-item-desc">${escapeHtml(alt.descripcion)}</div>`
          : '') +
        `<div class="alt-item-actions">` +
        (alt.video
          ? `<a class="rehab-link" href="${alt.video}" target="_blank" rel="noopener">▶ Vídeo</a>`
          : '') +
        `<button class="alt-choose-btn" ` +
        `onclick="elegirAlternativaIA('${escapeHtml(key)}','${context}',${bi},${ei},${idx})">` +
        `✓ Usar esta</button>` +
        `</div></div>`;
    });
  } else if (st.raw) {
    html += `<div class="alt-raw">${escapeHtml(st.raw)}</div>`;
  }

  html +=
    `</div>` +
    `<button class="btn-secondary" ` +
    `onclick="resetChange('${escapeHtml(key)}','${context}',${bi},${ei})">` +
    `Pedir otra vez</button>`;

  return html;
}

/** Resetea estado de alternativas IA para pedir de nuevo. */
export function resetChange(
  key: string,
  context: 'fz' | 'rehab',
  bi: number,
  ei: number,
): void {
  const state = getState();
  const st = state.changeState[key];
  setState({
    changeState: {
      ...state.changeState,
      [key]: { motivo: st?.motivo ?? null, loading: false, alternativas: null, raw: null },
    },
  });
  const data = getState().data;
  if (data) renderChangePanel(key, context, bi, ei, data);
}
