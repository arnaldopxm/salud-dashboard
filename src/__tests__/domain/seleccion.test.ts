import { describe, it, expect } from 'vitest';
import {
  seleccionarEjercicios,
  microcicloIdx,
  patronesDeHoy,
  resolverCategoriaSlot,
} from '../../domain/seleccion';
import type { Categoria, Ejercicio, Entrenamiento, RotacionDia } from '../../types/schema';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEj(nombre: string, tier: Ejercicio['tier'], grupo?: string): Ejercicio {
  const ej: Ejercicio = { nombre, tier, series: 3, reps: 10, unidad: 'rep' };
  if (grupo !== undefined) ej.grupo_equivalente = grupo;
  return ej;
}

function makeCat(pool: Ejercicio[], regla?: { principal: number; base: number }): Categoria {
  const cat: Categoria = { id: 'test', nombre: 'Test', color: '#fff', prioridad: 1, pool };
  if (regla !== undefined) cat.regla_seleccion = regla;
  return cat;
}

const ROTACION: RotacionDia[] = [
  { dia: 'lunes', patrones: ['empuje', 'core'] },
  { dia: 'martes', patrones: ['traccion', 'cuello'] },
  { dia: 'miercoles', patrones: ['empuje', 'rotativo'] },
];

// ---------------------------------------------------------------------------
// seleccionarEjercicios
// ---------------------------------------------------------------------------

describe('seleccionarEjercicios — sin regla', () => {
  it('devuelve todos cuando no hay tiers ni regla', () => {
    const pool = [makeEj('A', 'principal'), makeEj('B', 'principal')];
    const cat = makeCat(pool);
    // forzamos que no haya regla y que todos sean principal
    const { elegidos, avanzados } = seleccionarEjercicios(cat, 0);
    expect(elegidos).toHaveLength(2);
    expect(avanzados).toHaveLength(0);
  });

  it('excluye avanzados cuando no hay regla pero hay tiers mezclados', () => {
    const pool = [
      makeEj('Base1', 'base'),
      makeEj('Principal1', 'principal'),
      makeEj('Avanzado1', 'avanzado'),
    ];
    const cat = makeCat(pool);
    const { elegidos, avanzados } = seleccionarEjercicios(cat, 0);
    expect(elegidos.map(e => e.nombre)).toEqual(['Base1', 'Principal1']);
    expect(avanzados.map(e => e.nombre)).toEqual(['Avanzado1']);
  });
});

describe('seleccionarEjercicios — con regla', () => {
  it('selecciona N principales por microciclo rotando el pool', () => {
    const pool = [
      makeEj('P1', 'principal'),
      makeEj('P2', 'principal'),
      makeEj('P3', 'principal'),
    ];
    const cat = makeCat(pool, { principal: 1, base: 0 });

    const { elegidos: en0 } = seleccionarEjercicios(cat, 0);
    const { elegidos: en1 } = seleccionarEjercicios(cat, 1);
    const { elegidos: en2 } = seleccionarEjercicios(cat, 2);
    const { elegidos: en3 } = seleccionarEjercicios(cat, 3); // wraps

    expect(en0[0]!.nombre).toBe('P1');
    expect(en1[0]!.nombre).toBe('P2');
    expect(en2[0]!.nombre).toBe('P3');
    expect(en3[0]!.nombre).toBe('P1');
  });

  it('selecciona 2 principales cuando regla.principal = 2', () => {
    const pool = [makeEj('P1', 'principal'), makeEj('P2', 'principal'), makeEj('P3', 'principal')];
    const cat = makeCat(pool, { principal: 2, base: 0 });
    const { elegidos } = seleccionarEjercicios(cat, 0);
    expect(elegidos).toHaveLength(2);
  });

  it('selecciona bases rotando por día dentro de grupo equivalente', () => {
    const pool = [
      makeEj('B1', 'base', 'empuje-horizontal'),
      makeEj('B2', 'base', 'empuje-horizontal'),
    ];
    const cat = makeCat(pool, { principal: 0, base: 1 });

    const { elegidos: dia0 } = seleccionarEjercicios(cat, 0, 0);
    const { elegidos: dia1 } = seleccionarEjercicios(cat, 0, 1);

    // Deben ser distintos (rotan)
    expect(dia0[0]!.nombre).not.toBe(dia1[0]!.nombre);
  });

  it('aísla avanzados fuera de elegidos', () => {
    const pool = [makeEj('P1', 'principal'), makeEj('Av1', 'avanzado')];
    const cat = makeCat(pool, { principal: 1, base: 0 });
    const { elegidos, avanzados } = seleccionarEjercicios(cat, 0);
    expect(elegidos.map(e => e.nombre)).toContain('P1');
    expect(elegidos.map(e => e.nombre)).not.toContain('Av1');
    expect(avanzados.map(e => e.nombre)).toContain('Av1');
  });

  it('no selecciona más principales que los disponibles en el pool', () => {
    const pool = [makeEj('P1', 'principal')];
    const cat = makeCat(pool, { principal: 3, base: 0 });
    const { elegidos } = seleccionarEjercicios(cat, 0);
    expect(elegidos).toHaveLength(1);
  });

  it('devuelve pool vacío sin errores', () => {
    const cat = makeCat([], { principal: 1, base: 1 });
    const { elegidos, avanzados } = seleccionarEjercicios(cat, 0);
    expect(elegidos).toHaveLength(0);
    expect(avanzados).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// microcicloIdx
// ---------------------------------------------------------------------------

describe('microcicloIdx', () => {
  const entrenamiento: Entrenamiento = {
    categorias: [],
    calentamientos: [],
    rotacion_semanal: [],
    progresion: [],
    microciclo: { duracion_semanas: 2, ancla: 'fecha_inicio_programa' },
  };

  it('devuelve 0 en la primera semana', () => {
    const hoy = new Date();
    const fechaInicio = hoy.toISOString().slice(0, 10);
    expect(microcicloIdx(entrenamiento, fechaInicio)).toBe(0);
  });

  it('sigue en 0 durante las primeras 2 semanas (duracion=2)', () => {
    const hace10dias = new Date(Date.now() - 10 * 86400000).toISOString().slice(0, 10);
    expect(microcicloIdx(entrenamiento, hace10dias)).toBe(0);
  });

  it('pasa a 1 tras 2 semanas completas', () => {
    const hace14dias = new Date(Date.now() - 14 * 86400000).toISOString().slice(0, 10);
    expect(microcicloIdx(entrenamiento, hace14dias)).toBe(1);
  });

  it('nunca devuelve negativo para fechas futuras', () => {
    const manana = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    expect(microcicloIdx(entrenamiento, manana)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// patronesDeHoy
// ---------------------------------------------------------------------------

describe('patronesDeHoy', () => {
  it('devuelve los patrones del día correcto', () => {
    expect(patronesDeHoy(ROTACION, 'lunes')).toEqual(['empuje', 'core']);
  });

  it('devuelve array vacío si el día no tiene entrada', () => {
    expect(patronesDeHoy(ROTACION, 'domingo')).toEqual([]);
  });

  it('devuelve múltiples patrones', () => {
    expect(patronesDeHoy(ROTACION, 'miercoles')).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// resolverCategoriaSlot
// ---------------------------------------------------------------------------

describe('resolverCategoriaSlot', () => {
  it('devuelve la categoría directamente si no es rotativo', () => {
    expect(resolverCategoriaSlot('empuje', 0, ROTACION, 'lunes')).toBe('empuje');
  });

  it('devuelve null si categoria es undefined', () => {
    expect(resolverCategoriaSlot(undefined, 0, ROTACION, 'lunes')).toBeNull();
  });

  it('resuelve rotativo filtrando traccion y cuello', () => {
    // martes tiene [traccion, cuello] — ambos filtrados → cae al array completo
    const result = resolverCategoriaSlot('rotativo', 0, ROTACION, 'martes');
    expect(['traccion', 'cuello']).toContain(result);
  });

  it('resuelve rotativo con patrones válidos en miercoles', () => {
    // miercoles: [empuje, rotativo] → filtra traccion/cuello → [empuje, rotativo]
    const result = resolverCategoriaSlot('rotativo', 0, ROTACION, 'miercoles');
    expect(result).toBe('empuje');
  });

  it('rota el slot según rotativoIdx', () => {
    const r0 = resolverCategoriaSlot('rotativo', 0, ROTACION, 'miercoles');
    const r1 = resolverCategoriaSlot('rotativo', 1, ROTACION, 'miercoles');
    expect(r0).not.toBe(r1);
  });
});
