// ---------------------------------------------------------------------------
// Header y barra de progreso
// ---------------------------------------------------------------------------

import type { DesignTokens, RutinaSalud } from '../types/schema';
import type { Storage } from '../core/log';
import { isChecked } from '../core/log';
import { formatDateES, today } from '../utils/date';

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

// Mapa token JSON → variable CSS. Refleja el índice.html original.
const TOKEN_MAP: Partial<Record<keyof DesignTokens, string>> = {
  bg: '--bg',
  card: '--card',
  border: '--border',
  text_primary: '--text-primary',
  text_secondary: '--text-secondary',
  accent_blue: '--accent-blue',
  accent_orange: '--accent-orange',
  accent_green: '--accent-green',
  accent_purple: '--accent-purple',
  accent_gray: '--accent-gray',
  accent_red: '--accent-red',
  accent_cyan: '--accent-cyan',
  accent_teal: '--accent-teal',
};

/**
 * Aplica el mapa de design_tokens al `documentElement` como CSS custom props.
 * Si `dt` es undefined no hace nada.
 */
export function applyDesignTokens(dt: DesignTokens | undefined): void {
  if (!dt) return;
  const root = document.documentElement.style;

  (Object.keys(TOKEN_MAP) as Array<keyof DesignTokens>).forEach(k => {
    const cssVar = TOKEN_MAP[k];
    const val = dt[k];
    if (cssVar && val !== undefined && val !== null) {
      root.setProperty(cssVar, String(val));
    }
  });

  if (dt.radius_card != null) {
    root.setProperty('--radius-card', `${dt.radius_card}px`);
  }
  if (dt.radius_button != null) {
    root.setProperty('--radius-button', `${dt.radius_button}px`);
  }
}

// ---------------------------------------------------------------------------
// Barra de progreso
// ---------------------------------------------------------------------------

/**
 * Calcula cuántos ítems del `checklist_diario` están marcados en `storage`
 * para `fecha` y actualiza `#prog-fill` (width %) y `#prog-label`.
 */
export function updateProgress(
  data: RutinaSalud,
  storage: Storage,
  fecha: string,
): void {
  const total = data.checklist_diario.length;
  const done = data.checklist_diario.filter(i => isChecked(storage, fecha, i.id)).length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const fill = document.getElementById('prog-fill');
  const label = document.getElementById('prog-label');
  if (fill) fill.style.width = `${pct}%`;
  if (label) label.textContent = `${done} / ${total} completado`;
}

// ---------------------------------------------------------------------------
// Header principal
// ---------------------------------------------------------------------------

/**
 * Aplica design tokens, escribe el título, la fecha formateada y la versión
 * en el header, y actualiza la barra de progreso.
 */
export function renderHeader(data: RutinaSalud, storage: Storage): void {
  applyDesignTokens(data.design_tokens);

  const titleEl = document.getElementById('header-title');
  const dateEl = document.getElementById('header-date');
  const versionEl = document.getElementById('header-version');

  // textContent es seguro — no interpreta HTML
  if (titleEl) titleEl.textContent = data.meta.title;
  if (dateEl) dateEl.textContent = formatDateES(new Date());
  if (versionEl) versionEl.textContent = `web · datos v${data.meta.version}`;

  updateProgress(data, storage, today());
}
