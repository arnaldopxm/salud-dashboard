import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkKey, logExtraKey,
  isChecked, toggleCheck,
  getLogExtra, setLogExtra,
  getRegistroEj, setRegistroEj,
  construirLogDelDia,
  hydratarLogDesdeJson,
  LOG_SCHEMA_VERSION,
} from '../../core/log';
import type { Storage } from '../../core/log';
import type { LogDiario, RutinaSalud } from '../../types/schema';

// ---------------------------------------------------------------------------
// Storage in-memory para tests
// ---------------------------------------------------------------------------

function makeStorage(): Storage & { store: Record<string, string> } {
  const store: Record<string, string> = {};
  return {
    store,
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = v; },
    removeItem: (k) => { delete store[k]; },
  };
}

// Minimal RutinaSalud fixture
const DATA: RutinaSalud = {
  meta: { title: 'Test', version: '1.0', updated: '2025-06-30', fecha_inicio_programa: '2025-01-01' },
  pilares: [],
  horarios_diarios: [
    { hora: '08:00', tarea: 'Desayuno', pilar: 'nutricion', check: 'desayuno' },
    { hora: '09:00', tarea: 'Ejercicio', pilar: 'fuerza' },
  ],
  checklist_diario: [
    { id: 'agua', label: 'Beber agua', pilar: 'nutricion' },
    { id: 'paseo', label: 'Paseo', pilar: 'movimiento' },
  ],
  kegel: { fases: [], warning: '' },
};

const FECHA = '2025-06-30';

// ---------------------------------------------------------------------------
// checkKey / logExtraKey
// ---------------------------------------------------------------------------

describe('checkKey', () => {
  it('incluye la fecha y el id', () => {
    expect(checkKey('2025-06-30', 'agua')).toBe('salud-check-2025-06-30-agua');
  });
});

describe('logExtraKey', () => {
  it('incluye la fecha', () => {
    expect(logExtraKey('2025-06-30')).toBe('salud-logextra-2025-06-30');
  });
});

// ---------------------------------------------------------------------------
// isChecked / toggleCheck
// ---------------------------------------------------------------------------

describe('isChecked', () => {
  it('devuelve false si no hay entrada en storage', () => {
    const s = makeStorage();
    expect(isChecked(s, FECHA, 'agua')).toBe(false);
  });

  it('devuelve true si la entrada es "1"', () => {
    const s = makeStorage();
    s.setItem(checkKey(FECHA, 'agua'), '1');
    expect(isChecked(s, FECHA, 'agua')).toBe(true);
  });
});

describe('toggleCheck', () => {
  it('marca como completado en el primer toggle', () => {
    const s = makeStorage();
    const result = toggleCheck(s, FECHA, 'agua');
    expect(result).toBe(true);
    expect(isChecked(s, FECHA, 'agua')).toBe(true);
  });

  it('desmarca en el segundo toggle', () => {
    const s = makeStorage();
    toggleCheck(s, FECHA, 'agua');
    const result = toggleCheck(s, FECHA, 'agua');
    expect(result).toBe(false);
    expect(isChecked(s, FECHA, 'agua')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getLogExtra / setLogExtra
// ---------------------------------------------------------------------------

describe('getLogExtra', () => {
  it('devuelve objeto vacío si no hay datos', () => {
    expect(getLogExtra(makeStorage(), FECHA)).toEqual({});
  });

  it('devuelve los datos guardados', () => {
    const s = makeStorage();
    setLogExtra(s, FECHA, { nota_libre: 'Buen día' });
    expect(getLogExtra(s, FECHA).nota_libre).toBe('Buen día');
  });

  it('devuelve objeto vacío si el JSON está corrupto', () => {
    const s = makeStorage();
    s.setItem(logExtraKey(FECHA), 'NO_ES_JSON{{{');
    expect(getLogExtra(s, FECHA)).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// getRegistroEj / setRegistroEj
// ---------------------------------------------------------------------------

describe('setRegistroEj / getRegistroEj', () => {
  it('crea un registro nuevo con la carga', () => {
    const s = makeStorage();
    setRegistroEj(s, FECHA, 'empuje', 'Press', 'carga', '20');
    const reg = getRegistroEj(s, FECHA, 'empuje', 'Press');
    expect(reg?.carga_kg).toBe(20);
    expect(reg?.completado).toBe(true);
  });

  it('actualiza un campo sin borrar los demás', () => {
    const s = makeStorage();
    setRegistroEj(s, FECHA, 'empuje', 'Press', 'carga', '20');
    setRegistroEj(s, FECHA, 'empuje', 'Press', 'reps', '8');
    const reg = getRegistroEj(s, FECHA, 'empuje', 'Press');
    expect(reg?.carga_kg).toBe(20);
    expect(reg?.reps_reales).toBe(8);
  });

  it('elimina el registro si todos los campos quedan vacíos', () => {
    const s = makeStorage();
    setRegistroEj(s, FECHA, 'empuje', 'Press', 'carga', '20');
    setRegistroEj(s, FECHA, 'empuje', 'Press', 'carga', '');
    expect(getRegistroEj(s, FECHA, 'empuje', 'Press')).toBeNull();
  });

  it('devuelve null si no hay registro', () => {
    expect(getRegistroEj(makeStorage(), FECHA, 'empuje', 'Press')).toBeNull();
  });

  it('distingue registros de distintos ejercicios', () => {
    const s = makeStorage();
    setRegistroEj(s, FECHA, 'empuje', 'Press', 'reps', '8');
    setRegistroEj(s, FECHA, 'empuje', 'Remo', 'reps', '10');
    expect(getRegistroEj(s, FECHA, 'empuje', 'Press')?.reps_reales).toBe(8);
    expect(getRegistroEj(s, FECHA, 'empuje', 'Remo')?.reps_reales).toBe(10);
  });

  it('guarda rpe correctamente', () => {
    const s = makeStorage();
    setRegistroEj(s, FECHA, 'core', 'Plancha', 'rpe', '8');
    expect(getRegistroEj(s, FECHA, 'core', 'Plancha')?.rpe).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// construirLogDelDia
// ---------------------------------------------------------------------------

describe('construirLogDelDia', () => {
  it('incluye todos los ids del checklist en checks', () => {
    const s = makeStorage();
    const log = construirLogDelDia(s, DATA, FECHA);
    expect(Object.keys(log.checks)).toContain('agua');
    expect(Object.keys(log.checks)).toContain('paseo');
  });

  it('incluye checks de horarios con check definido', () => {
    const s = makeStorage();
    const log = construirLogDelDia(s, DATA, FECHA);
    expect(Object.keys(log.checks)).toContain('desayuno');
  });

  it('refleja los items marcados como true', () => {
    const s = makeStorage();
    toggleCheck(s, FECHA, 'agua');
    const log = construirLogDelDia(s, DATA, FECHA);
    expect(log.checks['agua']).toBe(true);
    expect(log.checks['paseo']).toBe(false);
  });

  it('incluye la fecha correcta', () => {
    const s = makeStorage();
    const log = construirLogDelDia(s, DATA, FECHA);
    expect(log.fecha).toBe(FECHA);
  });

  it('incluye schema_version', () => {
    const s = makeStorage();
    const log = construirLogDelDia(s, DATA, FECHA);
    expect(log.$schema_version).toBe(LOG_SCHEMA_VERSION);
  });

  it('incluye molestias y nota del logExtra', () => {
    const s = makeStorage();
    setLogExtra(s, FECHA, {
      molestias: [{ zona: 'hombro', intensidad: 2, contexto: 'al levantar', nota: '' }],
      nota_libre: 'Día duro',
    });
    const log = construirLogDelDia(s, DATA, FECHA);
    expect(log.molestias).toHaveLength(1);
    expect(log.nota_libre).toBe('Día duro');
  });

  it('incluye ejercicios registrados', () => {
    const s = makeStorage();
    setRegistroEj(s, FECHA, 'empuje', 'Press', 'carga', '15');
    const log = construirLogDelDia(s, DATA, FECHA);
    expect(log.ejercicios).toHaveLength(1);
    expect(log.ejercicios[0]!.ejercicio).toBe('Press');
  });
});

// ---------------------------------------------------------------------------
// hydratarLogDesdeJson
// ---------------------------------------------------------------------------

const FECHA_H = '2026-06-30';

function makeLog(overrides: Partial<LogDiario> = {}): LogDiario {
  return {
    $schema_version: '1.0',
    fecha: FECHA_H,
    guardado_ts: '2026-06-30T10:00:00.000Z',
    checks: {},
    ejercicios: [],
    molestias: [],
    nota_libre: '',
    ...overrides,
  };
}

describe('hydratarLogDesdeJson', () => {
  it('hidrata checks en storage vacío', () => {
    const s = makeStorage();
    const log = makeLog({ checks: { 'agua': true, 'vitamina-d': false } });
    hydratarLogDesdeJson(s, log);
    expect(isChecked(s, FECHA_H, 'agua')).toBe(true);
    expect(isChecked(s, FECHA_H, 'vitamina-d')).toBe(false);
  });

  it('hidrata ejercicios completados en storage vacío', () => {
    const s = makeStorage();
    const log = makeLog({
      ejercicios: [{
        patron: 'fuerza-A', ejercicio: 'Sentadilla',
        completado: true, carga_kg: 60, reps_reales: 8,
        series_reales: 3, rpe: 7, sustituido_por: null,
      }],
    });
    hydratarLogDesdeJson(s, log);
    const reg = getRegistroEj(s, FECHA_H, 'fuerza-A', 'Sentadilla');
    expect(reg).not.toBeNull();
    expect(reg!.carga_kg).toBe(60);
    expect(reg!.reps_reales).toBe(8);
    expect(reg!.completado).toBe(true);
  });

  it('hidrata molestias y nota en storage vacío', () => {
    const s = makeStorage();
    const log = makeLog({
      molestias: [{ zona: 'rodilla', intensidad: 2, contexto: 'al subir', nota: '' }],
      nota_libre: 'sesión dura',
    });
    hydratarLogDesdeJson(s, log);
    const extra = getLogExtra(s, FECHA_H);
    expect(extra.molestias).toHaveLength(1);
    expect(extra.molestias![0]!.zona).toBe('rodilla');
    expect(extra.nota_libre).toBe('sesión dura');
  });

  it('NO sobreescribe checks que ya existen en storage', () => {
    const s = makeStorage();
    s.setItem(checkKey(FECHA_H, 'agua'), '1');
    const log = makeLog({ checks: { 'agua': false } });
    hydratarLogDesdeJson(s, log);
    expect(isChecked(s, FECHA_H, 'agua')).toBe(true);
  });

  it('NO sobreescribe ejercicios si ya hay extra local', () => {
    const s = makeStorage();
    setLogExtra(s, FECHA_H, {
      ejercicios: [{
        patron: 'fuerza-A', ejercicio: 'Sentadilla',
        completado: true, carga_kg: 80, reps_reales: 5,
        series_reales: 3, rpe: 8, sustituido_por: null,
      }],
    });
    const log = makeLog({
      ejercicios: [{
        patron: 'fuerza-A', ejercicio: 'Sentadilla',
        completado: true, carga_kg: 60, reps_reales: 8,
        series_reales: 3, rpe: 7, sustituido_por: null,
      }],
    });
    hydratarLogDesdeJson(s, log);
    const reg = getRegistroEj(s, FECHA_H, 'fuerza-A', 'Sentadilla');
    expect(reg!.carga_kg).toBe(80);
  });

  it('devuelve true si escribió checks', () => {
    const s = makeStorage();
    const log = makeLog({ checks: { 'agua': true } });
    expect(hydratarLogDesdeJson(s, log)).toBe(true);
  });

  it('devuelve true si procesó checks aunque sean false', () => {
    const s = makeStorage();
    const log = makeLog({ checks: { 'agua': false } });
    expect(hydratarLogDesdeJson(s, log)).toBe(true);
  });

  it('devuelve false si el log está completamente vacío', () => {
    const s = makeStorage();
    expect(hydratarLogDesdeJson(s, makeLog())).toBe(false);
  });

  it('ejercicios completados del log son visibles tras hidratar', () => {
    const s = makeStorage();
    const log = makeLog({
      ejercicios: [
        { patron: 'kegel', ejercicio: 'Kegel básico', completado: true, carga_kg: null, reps_reales: 10, series_reales: 3, rpe: null, sustituido_por: null },
        { patron: 'pies', ejercicio: 'Intrínseco', completado: true, carga_kg: null, reps_reales: null, series_reales: null, rpe: null, sustituido_por: null },
      ],
    });
    hydratarLogDesdeJson(s, log);
    expect(getRegistroEj(s, FECHA_H, 'kegel', 'Kegel básico')!.completado).toBe(true);
    expect(getRegistroEj(s, FECHA_H, 'pies', 'Intrínseco')!.completado).toBe(true);
  });
});
