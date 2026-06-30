import { weeksSince } from '../utils/date';
import type { Kegel, KagelFase, KagelEjercicio } from '../types/schema';

// ---------------------------------------------------------------------------
// Lookup de fase por semana
// ---------------------------------------------------------------------------

export function getFaseForSemana(kegel: Kegel, semana: number): KagelFase | null {
  for (const fase of kegel.fases) {
    const lo = fase.semanas[0]!;
    const hi = fase.semanas[fase.semanas.length - 1]!;
    if (lo <= semana && semana <= hi) return fase;
  }
  return null;
}

export function semanaActualKegel(kegel: Kegel, fechaInicio: string): number {
  const maxSemana = Math.max(...kegel.fases.flatMap(f => f.semanas));
  return Math.min(weeksSince(fechaInicio), maxSemana);
}

export function faseActual(kegel: Kegel, fechaInicio: string): KagelFase {
  const semana = semanaActualKegel(kegel, fechaInicio);
  return getFaseForSemana(kegel, semana) ?? kegel.fases[kegel.fases.length - 1]!;
}

export function maxSemana(kegel: Kegel): number {
  return Math.max(...kegel.fases.flatMap(f => f.semanas));
}

// ---------------------------------------------------------------------------
// Estado del timer de Kegel
// ---------------------------------------------------------------------------

export interface TimerState {
  ej: KagelEjercicio;
  contrae: boolean;
  secondsLeft: number;
  rep: number;
  serie: number;
  running: boolean;
  intervalId: ReturnType<typeof setInterval> | null;
}

export type TimerPhase = 'idle' | 'running' | 'done';

export function createTimerState(ej: KagelEjercicio): TimerState {
  return {
    ej,
    contrae: true,
    secondsLeft: ej.contraccion_s,
    rep: 0,
    serie: 1,
    running: false,
    intervalId: null,
  };
}

export type TimerTickResult =
  | { type: 'continue'; state: TimerState }
  | { type: 'done'; state: TimerState };

// Avanza el estado del timer en 1 segundo. Puro — no toca el DOM ni setInterval.
export function tickTimerState(state: TimerState): TimerTickResult {
  const next: TimerState = { ...state, secondsLeft: state.secondsLeft - 1 };

  if (next.secondsLeft > 0) {
    return { type: 'continue', state: next };
  }

  // Fin de fase (contrae → suelta)
  if (next.contrae) {
    next.contrae = false;
    next.secondsLeft = next.ej.pausa_s;
    return { type: 'continue', state: next };
  }

  // Fin de rep
  next.rep++;
  if (next.rep < next.ej.reps) {
    next.contrae = true;
    next.secondsLeft = next.ej.contraccion_s;
    return { type: 'continue', state: next };
  }

  // Fin de serie
  next.rep = 0;
  next.serie++;
  if (next.serie > next.ej.series) {
    next.running = false;
    return { type: 'done', state: next };
  }

  next.contrae = true;
  next.secondsLeft = next.ej.contraccion_s;
  return { type: 'continue', state: next };
}
