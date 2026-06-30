// ---------------------------------------------------------------------------
// src/ui/pies.ts
// Renderiza la pestaña Pies (#pies-fase-nombre, #pies-semana-label, etc.)
// ---------------------------------------------------------------------------

import { escapeHtml, fichaLinkHTML, fichaSlug } from '../utils/html';
import {
  getPiesProtocolo,
  getPiesCategoria,
  getFaseForSemana,
  semanaActualPies,
  ejerciciosDeFase,
} from '../domain/pies';
import { getState, setState } from '../core/state';
import type { RutinaSalud, Ejercicio } from '../types/schema';
import { kbUnidadLabel } from './fuerza';

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function renderPiesEjFilaHTML(ej: Ejercicio): string {
  const params = `${ej.series}×${ej.reps} ${kbUnidadLabel(ej.unidad)}`;
  const ficha = fichaLinkHTML(ej.ficha, ej.nombre);
  const nota = ej.nota ? `<div class="pies-ej-nota">${escapeHtml(ej.nota)}</div>` : '';
  return (
    `<div class="pies-ej">` +
    `<div class="pies-ej-main">` +
    `<span class="pies-ej-nombre">${escapeHtml(ej.nombre)}</span>` +
    `<span class="pies-ej-params">${escapeHtml(params)}</span>` +
    `</div>` +
    nota +
    (ficha ? `<div class="pies-ej-actions">${ficha}</div>` : '') +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// onPiesFaseChange
// ---------------------------------------------------------------------------

/**
 * Callback del <select> de fases. Actualiza AppState y re-renderiza.
 * Se llama desde el atributo onchange del select, que pasa el value como string.
 */
export function onPiesFaseChange(val: number | string): void {
  setState({ overridePiesFase: typeof val === 'string' ? parseInt(val, 10) : val });
  const state = getState();
  if (state.data) {
    renderPies(state.data, state.overridePiesFase);
  }
}

// ---------------------------------------------------------------------------
// renderPies
// ---------------------------------------------------------------------------

/**
 * Renderiza la pestaña Pies completa.
 * @param data              Plan cargado desde Drive.
 * @param overridePiesFase  Semana de override manual (null = semana calculada).
 */
export function renderPies(
  data: RutinaSalud,
  overridePiesFase: number | null,
): void {
  const nombreEl = document.getElementById('pies-fase-nombre');
  const labelEl = document.getElementById('pies-semana-label');
  const descEl = document.getElementById('pies-fase-desc');
  const listEl = document.getElementById('pies-ejercicios-list');
  const selEl = document.getElementById('pies-fase-select') as HTMLSelectElement | null;
  const docEl = document.getElementById('pies-doc-link');
  const avisoEl = document.getElementById('pies-aviso') as HTMLElement | null;
  const banderaEl = document.getElementById('pies-bandera') as HTMLElement | null;

  if (!nombreEl || !labelEl || !descEl || !listEl || !selEl || !docEl) return;

  const e = data.entrenamiento;
  if (!e) {
    nombreEl.textContent = 'Protocolo de pies no disponible';
    labelEl.textContent = '';
    descEl.textContent = 'El JSON cargado no tiene entrenamiento (requiere datos v2.9+).';
    listEl.innerHTML = '';
    selEl.innerHTML = '';
    docEl.innerHTML = '';
    if (avisoEl) avisoEl.style.display = 'none';
    if (banderaEl) banderaEl.style.display = 'none';
    return;
  }

  const pp = getPiesProtocolo(e);
  const cat = getPiesCategoria(e);

  if (!pp || !cat) {
    nombreEl.textContent = 'Protocolo de pies no disponible';
    labelEl.textContent = '';
    descEl.textContent = 'El JSON cargado no tiene entrenamiento.pies_protocolo (requiere datos v2.9+).';
    listEl.innerHTML = '';
    selEl.innerHTML = '';
    docEl.innerHTML = '';
    if (avisoEl) avisoEl.style.display = 'none';
    if (banderaEl) banderaEl.style.display = 'none';
    return;
  }

  const semCalc = semanaActualPies(pp);
  const semMostrada = overridePiesFase ?? semCalc;

  // ---- Select de fases ----
  selEl.innerHTML = '';
  const faseMostrada = getFaseForSemana(pp, semMostrada);
  pp.fases.forEach(f => {
    const opt = document.createElement('option');
    const hi = f.semanas[f.semanas.length - 1]!;
    const rango = hi >= 99 ? `Sem ${f.semanas[0]}+` : `Sem ${f.semanas[0]}-${hi}`;
    opt.value = String(f.semanas[0]);
    opt.textContent = `${rango} · ${f.nombre}`;
    if (faseMostrada === f) opt.selected = true;
    selEl.appendChild(opt);
  });

  // ---- Fase activa ----
  const fase = faseMostrada ?? pp.fases[pp.fases.length - 1]!;
  const hi = fase.semanas[fase.semanas.length - 1]!;

  nombreEl.innerHTML =
    `${escapeHtml(fase.nombre)}` +
    (overridePiesFase != null
      ? '<span class="pies-fase-pill">manual</span>'
      : `<span class="pies-fase-pill">sem ${semCalc}</span>`);

  labelEl.textContent =
    hi >= 99
      ? `Fase de mantenimiento (semana ${fase.semanas[0]}+)`
      : `Semanas ${fase.semanas[0]}–${hi} del protocolo`;

  descEl.textContent = fase.descripcion ?? '';

  // ---- Lista de ejercicios ----
  listEl.innerHTML = ejerciciosDeFase(fase, cat).map(renderPiesEjFilaHTML).join('');

  // ---- Enlace al documento del protocolo ----
  const docSlug = fichaSlug(pp.doc ?? (cat as { doc_protocolo?: string }).doc_protocolo, '');
  docEl.innerHTML = docSlug
    ? `<div class="hd-rehab-link" style="margin-top:0.6rem" onclick="abrirFicha(event,'${docSlug}')">📄 Copiar enlace al protocolo completo</div>`
    : '';

  // ---- Avisos ----
  if (avisoEl) {
    if (pp.aviso_fase) {
      avisoEl.style.display = 'block';
      avisoEl.textContent = pp.aviso_fase;
    } else {
      avisoEl.style.display = 'none';
    }
  }
  if (banderaEl) {
    if (pp.bandera_roja) {
      banderaEl.style.display = 'block';
      banderaEl.textContent = pp.bandera_roja;
    } else {
      banderaEl.style.display = 'none';
    }
  }
}
