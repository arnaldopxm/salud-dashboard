import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getFaseForSemana,
  faseActual,
  maxSemana,
  createTimerState,
  tickTimerState,
} from '../../domain/kegel';
import type { Kegel, KagelEjercicio } from '../../types/schema';

afterEach(() => vi.useRealTimers());

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const KEGEL: Kegel = {
  warning: 'Consulta al fisio.',
  fases: [
    { nombre: 'Fase 1 — Toma de contacto', semanas: [1, 2, 3, 4], ejercicios: [
      { tipo: 'Lento', contraccion_s: 5, pausa_s: 5, reps: 5, series: 3 },
    ]},
    { nombre: 'Fase 2 — Consolidación', semanas: [5, 6, 7, 8], ejercicios: [
      { tipo: 'Lento', contraccion_s: 8, pausa_s: 4, reps: 8, series: 3 },
    ]},
    { nombre: 'Fase 3 — Mantenimiento', semanas: [9, 10, 99], ejercicios: [
      { tipo: 'Mixto', contraccion_s: 10, pausa_s: 5, reps: 10, series: 3 },
    ]},
  ],
};

const EJ_SIMPLE: KagelEjercicio = {
  tipo: 'Lento',
  contraccion_s: 3,
  pausa_s: 2,
  reps: 2,
  series: 2,
};

// ---------------------------------------------------------------------------
// getFaseForSemana
// ---------------------------------------------------------------------------

describe('getFaseForSemana', () => {
  it('devuelve la fase correcta para semana 1', () => {
    expect(getFaseForSemana(KEGEL, 1)?.nombre).toBe('Fase 1 — Toma de contacto');
  });

  it('devuelve la fase correcta para semana 5', () => {
    expect(getFaseForSemana(KEGEL, 5)?.nombre).toBe('Fase 2 — Consolidación');
  });

  it('devuelve null para semana fuera de rango si no hay fase abierta', () => {
    const kegelCerrado: Kegel = {
      warning: '',
      fases: [{ nombre: 'F1', semanas: [1, 2], ejercicios: [] }],
    };
    expect(getFaseForSemana(kegelCerrado, 10)).toBeNull();
  });

  it('la fase abierta (semana 99) captura semanas grandes', () => {
    expect(getFaseForSemana(KEGEL, 50)?.nombre).toBe('Fase 3 — Mantenimiento');
  });
});

// ---------------------------------------------------------------------------
// faseActual
// ---------------------------------------------------------------------------

describe('faseActual', () => {
  it('devuelve la primera fase en la primera semana del programa', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-30'));
    const fase = faseActual(KEGEL, '2025-06-30');
    expect(fase.nombre).toBe('Fase 1 — Toma de contacto');
  });

  it('devuelve la última fase si weeksSince supera el máximo', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01'));
    const fase = faseActual(KEGEL, '2025-01-01');
    expect(fase.nombre).toBe('Fase 3 — Mantenimiento');
  });
});

// ---------------------------------------------------------------------------
// maxSemana
// ---------------------------------------------------------------------------

describe('maxSemana', () => {
  it('devuelve el valor máximo de todas las semanas', () => {
    expect(maxSemana(KEGEL)).toBe(99);
  });
});

// ---------------------------------------------------------------------------
// createTimerState
// ---------------------------------------------------------------------------

describe('createTimerState', () => {
  it('inicializa en fase contrae con los segundos del ejercicio', () => {
    const st = createTimerState(EJ_SIMPLE);
    expect(st.contrae).toBe(true);
    expect(st.secondsLeft).toBe(EJ_SIMPLE.contraccion_s);
    expect(st.rep).toBe(0);
    expect(st.serie).toBe(1);
    expect(st.running).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// tickTimerState — lógica pura, sin DOM
// ---------------------------------------------------------------------------

describe('tickTimerState', () => {
  it('decrementa secondsLeft en cada tick', () => {
    const st = createTimerState(EJ_SIMPLE);
    const result = tickTimerState(st);
    expect(result.state.secondsLeft).toBe(EJ_SIMPLE.contraccion_s - 1);
    expect(result.type).toBe('continue');
  });

  it('cambia de contrae a suelta al llegar a 0', () => {
    let st = createTimerState({ ...EJ_SIMPLE, contraccion_s: 1 });
    const result = tickTimerState(st);
    expect(result.type).toBe('continue');
    expect(result.state.contrae).toBe(false);
    expect(result.state.secondsLeft).toBe(EJ_SIMPLE.pausa_s);
  });

  it('avanza la rep tras completar pausa', () => {
    // contraccion=1, pausa=1 → tras 2 ticks debe subir rep
    let st = createTimerState({ ...EJ_SIMPLE, contraccion_s: 1, pausa_s: 1 });
    const r1 = tickTimerState(st);       // contrae→0, pasa a suelta
    expect(r1.state.contrae).toBe(false);
    const r2 = tickTimerState(r1.state); // suelta→0, avanza rep
    expect(r2.state.rep).toBe(1);
    expect(r2.state.contrae).toBe(true);
  });

  it('avanza la serie tras completar todas las reps', () => {
    // 1 rep, 1s contrae, 1s pausa
    let st = createTimerState({ ...EJ_SIMPLE, reps: 1, contraccion_s: 1, pausa_s: 1 });
    const r1 = tickTimerState(st);       // contrae→suelta
    const r2 = tickTimerState(r1.state); // suelta→fin rep → serie 2
    expect(r2.state.serie).toBe(2);
    expect(r2.state.rep).toBe(0);
  });

  it('devuelve done al completar todas las series', () => {
    // 1 rep, 1 serie, 1s contrae, 1s pausa
    let st = createTimerState({ ...EJ_SIMPLE, reps: 1, series: 1, contraccion_s: 1, pausa_s: 1 });
    const r1 = tickTimerState(st);       // contrae→suelta
    const r2 = tickTimerState(r1.state); // suelta→fin → done
    expect(r2.type).toBe('done');
    expect(r2.state.running).toBe(false);
  });

  it('no muta el estado original (inmutabilidad)', () => {
    const st = createTimerState(EJ_SIMPLE);
    const original = st.secondsLeft;
    tickTimerState(st);
    expect(st.secondsLeft).toBe(original);
  });
});
