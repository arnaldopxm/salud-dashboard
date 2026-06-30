import { describe, it, expect, beforeEach } from 'vitest';
import {
  checkKey, logExtraKey,
  isChecked, toggleCheck,
  getLogExtra, setLogExtra,
  getRegistroEj, setRegistroEj,
  construirLogDelDia,
  LOG_SCHEMA_VERSION,
} from '../../core/log';
import type { Storage } from '../../core/log';
import type { RutinaSalud } from '../../types/schema';

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
