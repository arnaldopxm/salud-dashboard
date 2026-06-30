// ---------------------------------------------------------------------------
// src/ui/registro.ts
// Gestiona la card "Registro del día": molestias, nota libre, botón guardar.
// También exporta renderEjRegistroHTML para ui/horario y ui/fuerza.
//
// Seguridad: todo dato externo interpolado en HTML pasa por escapeHtml (XSS).
// Los event listeners se adjuntan tras innerHTML — sin inline handlers en los
// nodos de datos de usuario.
// ---------------------------------------------------------------------------

import { escapeHtml, slugify } from '../utils/html';
import { getLogExtra, setLogExtra, getRegistroEj, type Storage } from '../core/log';
import type { Molestia } from '../types/schema';

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

// RPE directo (rep-in-reserve), 6-10 enteros. Vacío = sin registrar.
// Idéntico al original de index.html para que el log sea compatible.
const ESFUERZO_OPCIONES = [
  { v: '',   label: 'RPE' },
  { v: '6',  label: '6' },
  { v: '7',  label: '7' },
  { v: '8',  label: '8' },
  { v: '9',  label: '9' },
  { v: '10', label: '10' },
] as const;

// ---------------------------------------------------------------------------
// Tipos públicos
// ---------------------------------------------------------------------------

export interface RegistroCallbacks {
  onSave: () => Promise<void>;
  onDirty: () => void;
}

// ---------------------------------------------------------------------------
// renderRegistro
// ---------------------------------------------------------------------------

/**
 * Rellena #registro-body con el HTML completo de molestias + nota + botón
 * guardar. Los event listeners se adjuntan tras asignar innerHTML para evitar
 * referencias a funciones globales en strings HTML.
 *
 * El caller es responsable de llamar de nuevo a renderRegistro cuando el
 * estado de logDirty / logLastSavedTs cambie (p.ej. tras onSave).
 */
export function renderRegistro(
  storage: Storage,
  fecha: string,
  logDirty: boolean,
  logLastSavedTs: Date | null,
  callbacks: RegistroCallbacks,
): void {
  const body = document.getElementById('registro-body');
  if (!body) return;

  const extra = getLogExtra(storage, fecha);
  const molestias: Molestia[] = extra.molestias ?? [];
  const nota: string = extra.nota_libre ?? '';

  // ---- Molestias ----
  let molestiaItems = '';
  if (molestias.length > 0) {
    molestias.forEach((m, i) => {
      const zonaCtx = m.contexto
        ? `${escapeHtml(m.zona)} · ${escapeHtml(m.contexto)}`
        : escapeHtml(m.zona);
      molestiaItems +=
        `<div class="reg-molestia-item">` +
          `<span class="zona">${zonaCtx}</span>` +
          `<span class="inten">${escapeHtml(String(m.intensidad))}/3</span>` +
          `<span class="reg-x" data-quitar="${i}">✕</span>` +
        `</div>`;
    });
  } else {
    molestiaItems =
      `<div style="font-size:0.76rem;color:var(--text-secondary)">Sin molestias registradas hoy.</div>`;
  }

  // ---- Botón guardar y status ----
  const btnLabel = logDirty ? '💾 Guardar día en Drive *' : '💾 Guardar día en Drive';
  const btnDisabled = logDirty ? '' : 'disabled';
  const statusText = logLastSavedTs
    ? `Último guardado: ${logLastSavedTs.toLocaleTimeString()}`
    : 'El check de cada tarea se guarda al pulsar "Guardar día". También se autoguarda al cerrar.';

  body.innerHTML =
    `<div class="reg-row">` +
      `<div class="reg-label">Molestias de hoy (lo que más mira el fisio)</div>` +
      `<div class="reg-molestia-list">${molestiaItems}</div>` +
      `<div class="reg-add-row">` +
        `<input class="reg-input zona" id="reg-zona" placeholder="zona (p.ej. hombro derecho)">` +
        `<select class="reg-select" id="reg-inten">` +
          `<option value="1">1 leve</option>` +
          `<option value="2">2 media</option>` +
          `<option value="3">3 fuerte</option>` +
        `</select>` +
        `<input class="reg-input" id="reg-ctx" placeholder="contexto" style="flex:1;min-width:80px">` +
        `<button class="reg-add-btn" id="reg-add-btn">+ molestia</button>` +
      `</div>` +
    `</div>` +
    `<div class="reg-row">` +
      `<div class="reg-label">Nota del día</div>` +
      `<textarea class="reg-input reg-nota" id="reg-nota" ` +
        `placeholder="Cómo fue el día, energía, sensaciones…">${escapeHtml(nota)}</textarea>` +
    `</div>` +
    `<button class="btn-primary" id="log-save-btn" ${btnDisabled}>${escapeHtml(btnLabel)}</button>` +
    `<div class="reg-save-status">${escapeHtml(statusText)}</div>`;

  // ---- Event listeners (sin inline handlers en datos de usuario) ----

  // "+ molestia"
  body.querySelector('#reg-add-btn')?.addEventListener('click', () => {
    _anadirMolestia(storage, fecha, logDirty, logLastSavedTs, callbacks);
  });

  // "✕" de cada molestia (delegados con data-quitar)
  body.querySelectorAll<HTMLElement>('[data-quitar]').forEach(el => {
    el.addEventListener('click', () => {
      const idx = parseInt(el.dataset['quitar'] ?? '-1', 10);
      _quitarMolestia(storage, fecha, idx, logDirty, logLastSavedTs, callbacks);
    });
  });

  // Textarea nota libre
  body.querySelector<HTMLTextAreaElement>('#reg-nota')?.addEventListener('input', e => {
    const val = (e.target as HTMLTextAreaElement).value;
    _guardarNota(storage, fecha, val, callbacks);
  });

  // Botón guardar
  body.querySelector('#log-save-btn')?.addEventListener('click', () => {
    void callbacks.onSave();
  });
}

// ---------------------------------------------------------------------------
// Helpers privados de molestias / nota
// ---------------------------------------------------------------------------

function _anadirMolestia(
  storage: Storage,
  fecha: string,
  logDirty: boolean,
  logLastSavedTs: Date | null,
  callbacks: RegistroCallbacks,
): void {
  const body = document.getElementById('registro-body');
  if (!body) return;

  const zona = (body.querySelector<HTMLInputElement>('#reg-zona')?.value ?? '').trim();
  if (!zona) return;

  const rawInten = parseInt(body.querySelector<HTMLSelectElement>('#reg-inten')?.value ?? '1', 10);
  const intensidad = (rawInten >= 1 && rawInten <= 3 ? rawInten : 1) as 1 | 2 | 3;
  const contexto = (body.querySelector<HTMLInputElement>('#reg-ctx')?.value ?? '').trim();

  const extra = getLogExtra(storage, fecha);
  extra.molestias ??= [];
  extra.molestias.push({ zona, intensidad, contexto, nota: '' });
  setLogExtra(storage, fecha, extra);

  callbacks.onDirty();
  // Re-render con dirty=true para que el botón se active de inmediato
  renderRegistro(storage, fecha, true, logLastSavedTs, callbacks);
}

function _quitarMolestia(
  storage: Storage,
  fecha: string,
  idx: number,
  logDirty: boolean,
  logLastSavedTs: Date | null,
  callbacks: RegistroCallbacks,
): void {
  const extra = getLogExtra(storage, fecha);
  if (!extra.molestias || idx < 0 || idx >= extra.molestias.length) return;
  extra.molestias.splice(idx, 1);
  setLogExtra(storage, fecha, extra);

  callbacks.onDirty();
  renderRegistro(storage, fecha, true, logLastSavedTs, callbacks);
}

function _guardarNota(
  storage: Storage,
  fecha: string,
  val: string,
  callbacks: RegistroCallbacks,
): void {
  const extra = getLogExtra(storage, fecha);
  extra.nota_libre = val;
  setLogExtra(storage, fecha, extra);
  callbacks.onDirty();
}

// ---------------------------------------------------------------------------
// renderEjRegistroHTML
// ---------------------------------------------------------------------------

/**
 * Devuelve el HTML del mini-registro de un ejercicio (carga/reps/series/RPE).
 * Usado por ui/horario y ui/fuerza. Los onchange llaman a setRegistroEj que
 * el bundle expone en el scope global durante la migración progresiva.
 *
 * Seguridad: patron y nombre se escapan para atributo HTML y para el literal
 * JS dentro de onclick (comillas simples se escapan con \').
 */
export function renderEjRegistroHTML(
  storage: Storage,
  fecha: string,
  patron: string,
  nombre: string,
): string {
  const reg = getRegistroEj(storage, fecha, patron, nombre) ?? {};
  const sid = slugify(`${patron}-${nombre}`);

  // Escapado para atributos HTML y para literales JS en onchange
  const patronJs = escapeHtml(patron).replace(/'/g, "\\'");
  const nombreJs = escapeHtml(nombre).replace(/'/g, "\\'");

  const cargaVal   = ('carga_kg'      in reg && reg.carga_kg      != null) ? String(reg.carga_kg)      : '';
  const repsVal    = ('reps_reales'   in reg && reg.reps_reales    != null) ? String(reg.reps_reales)   : '';
  const seriesVal  = ('series_reales' in reg && reg.series_reales  != null) ? String(reg.series_reales) : '';
  const rpeVal     = ('rpe'           in reg && reg.rpe            != null) ? String(reg.rpe)           : '';
  const completado = 'completado' in reg ? Boolean(reg.completado) : false;

  const opts = ESFUERZO_OPCIONES.map(o => {
    const sel = rpeVal === o.v ? ' selected' : '';
    return `<option value="${o.v}"${sel}>${o.label}</option>`;
  }).join('');

  return (
    `<div class="ej-reg">` +
      `<div class="ej-reg-grid">` +
        `<div class="ej-reg-field"><label>carga kg</label>` +
          `<input class="ej-reg-input" type="number" inputmode="decimal"` +
            ` value="${escapeHtml(cargaVal)}"` +
            ` onchange="setRegistroEj('${patronJs}','${nombreJs}','carga',this.value)">` +
        `</div>` +
        `<div class="ej-reg-field"><label>reps</label>` +
          `<input class="ej-reg-input" type="number" inputmode="numeric"` +
            ` value="${escapeHtml(repsVal)}"` +
            ` onchange="setRegistroEj('${patronJs}','${nombreJs}','reps',this.value)">` +
        `</div>` +
        `<div class="ej-reg-field"><label>series</label>` +
          `<input class="ej-reg-input" type="number" inputmode="numeric"` +
            ` value="${escapeHtml(seriesVal)}"` +
            ` onchange="setRegistroEj('${patronJs}','${nombreJs}','series',this.value)">` +
        `</div>` +
        `<div class="ej-reg-field"><label>RPE</label>` +
          `<select class="ej-reg-input"` +
            ` onchange="setRegistroEj('${patronJs}','${nombreJs}','rpe',this.value)">${opts}</select>` +
        `</div>` +
        `<span class="ej-reg-done" data-ejreg-badge="${escapeHtml(sid)}">${completado ? '✓ registrado' : ''}</span>` +
      `</div>` +
    `</div>`
  );
}
