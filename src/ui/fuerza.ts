// ---------------------------------------------------------------------------
// src/ui/fuerza.ts
// Renderiza la pestaña Fuerza:
//   #fuerza-intro, #fuerza-categorias, #fuerza-rotacion, #fuerza-progresion
// ---------------------------------------------------------------------------

import { escapeHtml, fichaLinkHTML } from '../utils/html';
import { todayDayName } from '../utils/date';
import { seleccionarEjercicios, microcicloIdx, patronesDeHoy } from '../domain/seleccion';
import type { Storage } from '../core/log';
import { renderEjRegistroHTML } from './registro';
import type { RutinaSalud, Categoria, Calentamiento, Ejercicio } from '../types/schema';

// ---------------------------------------------------------------------------
// Helpers exportados
// ---------------------------------------------------------------------------

/** Etiqueta de unidad legible. Idéntica al index.html original. */
export function kbUnidadLabel(u: string): string {
  if (u === 'rep_por_lado') return 'rep/lado';
  if (u === 'segundos') return 'seg';
  return 'rep';
}

/** Span con clase tier-pill según tier del ejercicio. */
export function tierBadge(tier: string): string {
  if (tier === 'principal') return '<span class="tier-pill tier-principal">principal</span>';
  if (tier === 'base') return '<span class="tier-pill tier-base">base</span>';
  if (tier === 'avanzado') return '<span class="tier-pill tier-avanzado">avanzado</span>';
  return '';
}

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function getEntrenamiento(data: RutinaSalud) {
  return data.entrenamiento ?? null;
}

function getCalentamiento(data: RutinaSalud, id: string | undefined): Calentamiento | null {
  if (!id) return null;
  const e = getEntrenamiento(data);
  return e?.calentamientos.find(c => c.id === id) ?? null;
}

function buildWarmupHTML(cal: Calentamiento): string {
  const pasos = (cal.pasos ?? []).map(p => {
    const params = p.series && p.reps ? `${p.series}×${p.reps} ${kbUnidadLabel(p.unidad ?? 'rep')}` : '';
    const ficha = fichaLinkHTML(p.ficha, p.nombre);
    return (
      `<div class="hd-step"><span class="hd-nombre">${escapeHtml(p.nombre)}` +
      (p.detalle ? `<small>${escapeHtml(p.detalle)}</small>` : '') +
      `</span><span class="hd-params">${escapeHtml(params)}</span></div>` +
      (ficha ? `<div class="hd-ficha-row">${ficha}</div>` : '')
    );
  }).join('');

  return (
    `<div class="kb-warmup-banner">` +
    `<div class="hd-warmup-title">🔥 ${escapeHtml(cal.nombre || 'Calentamiento')} — antes del primer ejercicio</div>` +
    (cal.nota ? `<div class="hd-warmup-nota">${escapeHtml(cal.nota)}</div>` : '') +
    pasos +
    `</div>`
  );
}

function buildEjercicioHTML(
  ej: Ejercicio,
  ci: number,
  ei: number,
  catId: string,
  esHoy: boolean,
  storage: Storage,
  fecha: string,
): string {
  const esAvanzado = ej.tier === 'avanzado';
  const key = `fz-${ci}-${ei}`;
  const nombre = ej._sustituto ? ej._sustituto.nombre : ej.nombre;

  const fichaBtn = ej._sustituto
    ? (ej._sustituto.ficha ? fichaLinkHTML(ej._sustituto.ficha, ej._sustituto.nombre) : '')
    : fichaLinkHTML(ej.ficha, ej.nombre);

  const nota = !ej._sustituto && ej.nota
    ? `<div class="kb-ej-nota">${escapeHtml(ej.nota)}</div>`
    : '';

  const rowCls =
    'kb-ejercicio-row' +
    (esHoy ? ' ej-hoy' : ' ej-otro') +
    (esAvanzado ? ' ej-avanzado' : '');

  const marca = esHoy ? '<span class="ej-hoy-dot">●</span> ' : '';

  // Botón de registro solo para ejercicios elegidos para hoy
  const regBtn = esHoy
    ? `<button class="ej-reg-toggle" onclick="document.getElementById('ejreg-${key}').style.display=document.getElementById('ejreg-${key}').style.display==='block'?'none':'block'">📝 Registrar</button>`
    : '';
  const regBlock = esHoy
    ? `<div id="ejreg-${key}" style="display:none">${renderEjRegistroHTML(storage, fecha, catId, nombre)}</div>`
    : '';

  // Vídeo del sustituto si existe
  const sustitutoInfo = ej._sustituto
    ? `<div class="kb-ej-sustituto">↻ Sustituye a: ${escapeHtml(ej.nombre)}${ej._sustituto.video ? ` · <a class="rehab-link" style="padding:0;border:none;background:none" href="${ej._sustituto.video}" target="_blank" rel="noopener">vídeo</a>` : ''}</div>`
    : '';

  // El onclick de toggleChangePanel se expone como función global en el bundle principal
  return (
    `<div class="${rowCls}" id="${key}">` +
    `<div class="kb-ej-main">` +
    `<span class="kb-ej-nombre">${marca}${escapeHtml(nombre)} ${tierBadge(ej.tier)}</span>` +
    `<span class="kb-ej-params">${escapeHtml(String(ej.series))}×${escapeHtml(String(ej.reps))} ${kbUnidadLabel(ej.unidad)}</span>` +
    `</div>` +
    nota +
    sustitutoInfo +
    `<div class="rehab-ej-actions">` +
    fichaBtn +
    regBtn +
    `<button class="rehab-change-btn" onclick="toggleChangePanel('${key}','fz',${ci},${ei})">⇄ Cambiar ejercicio</button>` +
    `</div>` +
    regBlock +
    `<div id="panel-${key}"></div>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Export principal
// ---------------------------------------------------------------------------

/**
 * Renderiza la pestaña Fuerza completa.
 * @param data    Plan cargado desde Drive.
 * @param storage Implementación de Storage (normalmente localStorage).
 * @param fecha   Fecha actual en formato YYYY-MM-DD.
 */
export function renderFuerza(
  data: RutinaSalud,
  storage: Storage,
  fecha: string,
): void {
  const e = getEntrenamiento(data);

  const introEl = document.getElementById('fuerza-intro');
  const contEl = document.getElementById('fuerza-categorias');
  const rotEl = document.getElementById('fuerza-rotacion');
  const progEl = document.getElementById('fuerza-progresion');

  if (!introEl || !contEl || !rotEl || !progEl) return;

  if (!e || !e.categorias) {
    introEl.innerHTML =
      '<div class="empty-hint">Este dashboard espera el esquema v2.0 (entrenamiento por patrones). El JSON cargado no lo tiene.</div>';
    contEl.innerHTML = '';
    rotEl.innerHTML = '';
    progEl.innerHTML = '';
    return;
  }

  const diaHoy = todayDayName();
  const patsHoy = patronesDeHoy(e.rotacion_semanal, diaHoy);
  const mcIdx = microcicloIdx(e, data.meta.fecha_inicio_programa);

  // ---- Intro ----
  introEl.innerHTML =
    `<div class="card-title">Patrones de hoy</div>` +
    `<div class="cat-objetivo">Hoy toca: <b style="color:var(--text-primary)">${patsHoy.map(escapeHtml).join(' · ') || '—'}</b>. ` +
    `Dentro de cada patrón, el <b style="color:var(--accent-green)">●</b> marca el ejercicio elegido para hoy: ` +
    `el <b>principal</b> rota cada 2 semanas (microciclo ${mcIdx + 1}) para que progreses en él, ` +
    `los <b>base</b> rotan a diario entre equivalentes, y el <b>avanzado</b> solo aparece como opción. ` +
    `El resto del pool queda atenuado como alternativas. Pulsa "cambiar ejercicio" para pedir sustitutos.</div>`;

  // ---- Categorías ----
  contEl.innerHTML = '';
  e.categorias.forEach((cat: Categoria, ci: number) => {
    if (cat.id === 'pies') return;

    const card = document.createElement('div');
    card.className = 'card';

    const cal = getCalentamiento(data, cat.calentamiento);
    const warmupHTML = cal ? buildWarmupHTML(cal) : '';

    const seleccion = seleccionarEjercicios(cat, mcIdx);
    const idsElegidos = new Set(seleccion.elegidos);

    const ejsHTML = (cat.pool ?? []).map((ej: Ejercicio, ei: number) => {
      const esHoyEj = idsElegidos.has(ej);
      // Inicializa _sustituto si aún no existe (estado de runtime)
      if (ej._sustituto === undefined) ej._sustituto = null;
      return buildEjercicioHTML(ej, ci, ei, cat.id, esHoyEj, storage, fecha);
    }).join('');

    const prioClass = cat.prioridad === 1 ? 'p1' : cat.prioridad === 2 ? 'p2' : 'p3';
    const prioLabel = cat.prioridad === 1 ? 'Prioridad' : cat.prioridad === 2 ? 'Importante' : 'Rotativo';
    const esHoyCat = patsHoy.includes(cat.id);

    card.innerHTML =
      `<div class="cat-header">` +
      `<div class="cat-dot" style="background:${cat.color || 'var(--accent-orange)'}"></div>` +
      `<div class="cat-nombre">${escapeHtml(cat.nombre)}${esHoyCat ? ' <span style="font-size:0.7rem;color:var(--accent-blue)">• hoy</span>' : ''}</div>` +
      `<div class="cat-prio ${prioClass}">${prioLabel}</div>` +
      `</div>` +
      (cat.objetivo ? `<div class="cat-objetivo">${escapeHtml(cat.objetivo)}</div>` : '') +
      warmupHTML +
      ejsHTML;

    contEl.appendChild(card);
  });

  // ---- Rotación semanal ----
  rotEl.innerHTML = '';
  (e.rotacion_semanal ?? []).forEach(r => {
    const el = document.createElement('div');
    el.className = 'rotacion-item';
    const pats = (r.patrones ?? []).map(p => {
      const c = e.categorias.find(cat => cat.id === p);
      return c ? c.nombre.split('/')[0]!.trim() : p;
    }).join(' · ');
    const extra = r.nota
      ? ` <span style="color:var(--accent-red)">(${escapeHtml(r.nota)})</span>`
      : '';
    el.innerHTML =
      `<span class="rotacion-dia${r.dia === diaHoy ? ' hoy' : ''}">${escapeHtml(r.dia)}</span>` +
      `<span class="rotacion-pats">${escapeHtml(pats)}${extra}</span>`;
    rotEl.appendChild(el);
  });

  // ---- Progresión ----
  progEl.innerHTML = '';
  (e.progresion ?? []).forEach(p => {
    const el = document.createElement('div');
    el.className = 'progresion-item';
    const semLabel =
      p.semanas[1]! >= 99
        ? `Semana ${p.semanas[0]}+`
        : `Semanas ${p.semanas[0]}–${p.semanas[1]}`;
    el.innerHTML =
      `<div class="progresion-semanas">${semLabel}</div>` +
      `<div>${escapeHtml(p.ajuste)}</div>`;
    progEl.appendChild(el);
  });
}
