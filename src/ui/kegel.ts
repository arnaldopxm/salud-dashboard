// ---------------------------------------------------------------------------
// src/ui/kegel.ts
// Gestiona la pestaña Kegel completa: lista de ejercicios, selector de semana
// y timer SVG con lógica de tick delegada a domain/kegel (función pura).
//
// Seguridad: todos los datos externos interpolados en innerHTML pasan por
// escapeHtml. Los event listeners se adjuntan tras innerHTML.
// ---------------------------------------------------------------------------

import { escapeHtml } from '../utils/html';
import {
  getFaseForSemana,
  semanaActualKegel,
  maxSemana,
  createTimerState,
  tickTimerState,
  type TimerState,
} from '../domain/kegel';
import { getState, setState } from '../core/state';
import type { KagelEjercicio, RutinaSalud } from '../types/schema';

// ---------------------------------------------------------------------------
// Constantes del timer SVG
// ---------------------------------------------------------------------------

const TIMER_RADIUS = 54;
const TIMER_CIRC = 2 * Math.PI * TIMER_RADIUS;

// ---------------------------------------------------------------------------
// Estado local del intervalo (no serializable, solo en runtime)
// ---------------------------------------------------------------------------

let _intervalId: ReturnType<typeof setInterval> | null = null;

// ---------------------------------------------------------------------------
// renderKegel
// ---------------------------------------------------------------------------

/**
 * Rellena los elementos del panel Kegel:
 *   #kegel-fase-nombre, #kegel-semana-label, #kegel-semana-select,
 *   #kegel-ejercicios-list, #kegel-warning.
 * El select onchange llama a onSemanaChange.
 */
export function renderKegel(
  data: RutinaSalud,
  fechaInicio: string,
  overrideSemana: number | null,
): void {
  const kegel = data.kegel;
  const semanaActual = overrideSemana ?? semanaActualKegel(kegel, fechaInicio);
  const maxS = maxSemana(kegel);

  // ---- Select de semana ----
  const sel = document.getElementById('kegel-semana-select') as HTMLSelectElement | null;
  if (sel) {
    sel.innerHTML = '';
    for (let s = 1; s <= maxS; s++) {
      const opt = document.createElement('option');
      opt.value = String(s);
      opt.textContent = `Semana ${s}`;
      if (s === semanaActual) opt.selected = true;
      sel.appendChild(opt);
    }
    // El handler llama a onSemanaChange con el valor elegido
    // Se reemplaza listener previo clonando el nodo
    const newSel = sel.cloneNode(true) as HTMLSelectElement;
    sel.parentNode?.replaceChild(newSel, sel);
    newSel.addEventListener('change', () => {
      onSemanaChange(parseInt(newSel.value, 10));
    });
  }

  // ---- Warning ----
  const warningEl = document.getElementById('kegel-warning');
  if (warningEl) warningEl.textContent = kegel.warning;

  // ---- Fase ----
  _renderKegelFase(data, fechaInicio, semanaActual, maxS);
}

// ---------------------------------------------------------------------------
// _renderKegelFase (interna)
// ---------------------------------------------------------------------------

function _renderKegelFase(
  data: RutinaSalud,
  fechaInicio: string,
  semana: number,
  maxS: number,
): void {
  const kegel = data.kegel;
  const faseNombreEl = document.getElementById('kegel-fase-nombre');
  const semanaLabelEl = document.getElementById('kegel-semana-label');

  const fase = getFaseForSemana(kegel, semana);

  if (!fase) {
    if (faseNombreEl) faseNombreEl.textContent = 'Programa completado';
    if (semanaLabelEl) semanaLabelEl.textContent = 'Repite la fase final o redefine';
    const lastFase = kegel.fases[kegel.fases.length - 1];
    if (lastFase) _renderEjerciciosList(lastFase.ejercicios);
    return;
  }

  if (faseNombreEl) faseNombreEl.textContent = fase.nombre;
  if (semanaLabelEl) semanaLabelEl.textContent = `Semana ${semana} de ${maxS}`;

  _renderEjerciciosList(fase.ejercicios);
}

// ---------------------------------------------------------------------------
// _renderEjerciciosList (interna)
// ---------------------------------------------------------------------------

function _renderEjerciciosList(ejercicios: KagelEjercicio[]): void {
  const container = document.getElementById('kegel-ejercicios-list');
  if (!container) return;

  container.innerHTML = '';
  const { selectedEjercicio } = getState();

  ejercicios.forEach(ej => {
    const el = document.createElement('div');
    el.className = 'ejercicio-item' + (selectedEjercicio === ej ? ' selected' : '');
    el.innerHTML =
      `<span class="ejercicio-tipo">${escapeHtml(ej.tipo)}</span>` +
      `<span class="ejercicio-params">` +
        `${escapeHtml(String(ej.contraccion_s))}s contrae · ` +
        `${escapeHtml(String(ej.pausa_s))}s pausa · ` +
        `${escapeHtml(String(ej.reps))} reps · ` +
        `${escapeHtml(String(ej.series))} series` +
      `</span>` +
      `<span style="color:var(--accent-blue); font-size:0.8rem">▶</span>`;

    el.addEventListener('click', () => {
      stopTimer();
      setState({ selectedEjercicio: ej });
      // Re-pinta solo la lista para marcar el seleccionado
      _renderEjerciciosList(ejercicios);
      renderTimer(ej);
    });

    container.appendChild(el);
  });
}

// ---------------------------------------------------------------------------
// onSemanaChange
// ---------------------------------------------------------------------------

/**
 * Actualiza overrideSemana en AppState, limpia el timer y re-renderiza la fase.
 * El select ya está en el DOM; solo actualizamos la zona de fase y timer.
 */
export function onSemanaChange(semana: number): void {
  setState({ overrideSemana: semana, selectedEjercicio: null, timerState: null });
  stopTimer();

  const container = document.getElementById('kegel-timer-container');
  if (container) {
    container.innerHTML =
      `<div style="font-size:0.8rem; color:var(--text-secondary); text-align:center; padding:0.5rem 0">` +
      `Selecciona un ejercicio arriba para iniciar el timer</div>`;
  }

  // Necesitamos data y fechaInicio para re-renderizar la fase.
  // Los leemos desde state (data está cargado en este punto).
  const { data } = getState();
  if (!data) return;
  const fechaInicio = data.meta.fecha_inicio_programa;
  const maxS = maxSemana(data.kegel);
  _renderKegelFase(data, fechaInicio, semana, maxS);
}

// ---------------------------------------------------------------------------
// renderTimer
// ---------------------------------------------------------------------------

/**
 * Renderiza el timer SVG en #kegel-timer-container e inicializa timerState
 * en AppState (sin arrancar el intervalo — el usuario pulsa Iniciar).
 */
export function renderTimer(ej: KagelEjercicio): void {
  const container = document.getElementById('kegel-timer-container');
  if (!container) return;

  container.innerHTML =
    `<div class="timer-wrap">` +
      `<div class="timer-svg" style="position:relative;width:140px;height:140px">` +
        `<svg width="140" height="140" viewBox="0 0 140 140">` +
          `<circle class="timer-circle-bg" cx="70" cy="70" r="${TIMER_RADIUS}"/>` +
          `<circle class="timer-circle-fill" id="timer-arc" cx="70" cy="70" r="${TIMER_RADIUS}"` +
            ` stroke-dasharray="${TIMER_CIRC}" stroke-dashoffset="0"/>` +
        `</svg>` +
        `<div class="timer-label-wrap">` +
          `<div class="timer-action contrae" id="timer-action-label">LISTO</div>` +
          `<div class="timer-seconds" id="timer-seconds-label">—</div>` +
        `</div>` +
      `</div>` +
      `<div class="timer-progress-text" id="timer-progress-text">` +
        `Rep 0 / ${escapeHtml(String(ej.reps))} · Serie 0 / ${escapeHtml(String(ej.series))}` +
      `</div>` +
      `<div class="timer-btn-row">` +
        `<button class="timer-btn btn-start" id="timer-start-btn">Iniciar</button>` +
        `<button class="timer-btn btn-reset" id="timer-reset-btn">Reiniciar</button>` +
      `</div>` +
      `<div class="timer-done-msg" id="timer-done-msg">✅ Serie completa — ¡buen trabajo!</div>` +
    `</div>`;

  // Inicializa el estado puro en AppState
  const ts = createTimerState(ej);
  setState({ timerState: ts });

  // Listeners (sin strings globales)
  container.querySelector('#timer-start-btn')?.addEventListener('click', () => startTimer());
  container.querySelector('#timer-reset-btn')?.addEventListener('click', () => resetTimer());

  _updateTimerDisplay(ts);
}

// ---------------------------------------------------------------------------
// startTimer / stopTimer / resetTimer
// ---------------------------------------------------------------------------

export function startTimer(): void {
  const { timerState } = getState();
  if (!timerState || timerState.running) return;

  const startBtn = document.getElementById('timer-start-btn') as HTMLButtonElement | null;
  if (startBtn) { startBtn.disabled = true; startBtn.style.opacity = '0.5'; }

  setState({ timerState: { ...timerState, running: true } });

  _intervalId = setInterval(() => _tickTimer(), 1000);
}

export function stopTimer(): void {
  if (_intervalId !== null) {
    clearInterval(_intervalId);
    _intervalId = null;
  }
  const { timerState } = getState();
  if (timerState) {
    setState({ timerState: { ...timerState, running: false, intervalId: null } });
  }
}

export function resetTimer(): void {
  stopTimer();
  const { selectedEjercicio } = getState();
  if (selectedEjercicio) renderTimer(selectedEjercicio);
}

// ---------------------------------------------------------------------------
// _tickTimer (interna)
// ---------------------------------------------------------------------------

function _tickTimer(): void {
  const { timerState } = getState();
  if (!timerState) return;

  const result = tickTimerState(timerState);
  setState({ timerState: result.state });

  if (result.type === 'done') {
    if (_intervalId !== null) { clearInterval(_intervalId); _intervalId = null; }

    const doneMsg = document.getElementById('timer-done-msg');
    if (doneMsg) doneMsg.style.display = 'block';

    const actionLabel = document.getElementById('timer-action-label');
    if (actionLabel) { actionLabel.textContent = 'FIN'; actionLabel.className = 'timer-action'; }

    const secLabel = document.getElementById('timer-seconds-label');
    if (secLabel) secLabel.textContent = '✓';

    const arc = document.getElementById('timer-arc') as SVGCircleElement | null;
    if (arc) arc.style.strokeDashoffset = '0';

    return;
  }

  _updateTimerDisplay(result.state);
}

// ---------------------------------------------------------------------------
// _updateTimerDisplay (interna)
// ---------------------------------------------------------------------------

function _updateTimerDisplay(ts: TimerState): void {
  const total = ts.contrae ? ts.ej.contraccion_s : ts.ej.pausa_s;
  const frac = ts.secondsLeft / total;
  const offset = TIMER_CIRC * (1 - frac);

  const arc = document.getElementById('timer-arc') as SVGCircleElement | null;
  if (arc) {
    arc.style.strokeDashoffset = String(offset);
    arc.style.stroke = ts.contrae ? 'var(--accent-blue)' : 'var(--accent-green)';
  }

  const actionLabel = document.getElementById('timer-action-label');
  if (actionLabel) {
    actionLabel.textContent = ts.contrae ? 'CONTRAE' : 'SUELTA';
    actionLabel.className = 'timer-action ' + (ts.contrae ? 'contrae' : 'suelta');
  }

  const secLabel = document.getElementById('timer-seconds-label');
  if (secLabel) secLabel.textContent = String(ts.secondsLeft);

  const progText = document.getElementById('timer-progress-text');
  if (progText) {
    progText.textContent =
      `Rep ${ts.rep + 1} / ${ts.ej.reps} · Serie ${ts.serie} / ${ts.ej.series}`;
  }
}
