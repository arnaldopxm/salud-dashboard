import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getFaseForSemana,
  faseActual,
  ejerciciosDeFase,
  maxSemana,
  semanaActualPies,
} from '../../domain/pies';
import type { Categoria, Ejercicio, FasePies, PiesProtocolo } from '../../types/schema';

afterEach(() => vi.useRealTimers());

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makeEjPies(nombre: string, ficha?: string): Ejercicio {
  const ej: Ejercicio = { nombre, tier: 'principal', series: 2, reps: 10, unidad: 'rep' };
  if (ficha !== undefined) ej.ficha = ficha;
  return ej;
}

const CAT_PIES: Categoria = {
  id: 'pies',
  nombre: 'Pies',
  color: '#8BC34A',
  prioridad: 2,
  pool: [
    makeEjPies('Elevación de talones', '[[elevacion-talones]]'),
    makeEjPies('Caminar descalzo', '[[caminar-descalzo]]'),
    makeEjPies('Spreadtoe', '[[spreadtoe]]'),
  ],
};

const PP: PiesProtocolo = {
  fecha_inicio: '2025-01-01',
  fases: [
    {
      nombre: 'Fase 1 — Activación',
      semanas: [1, 2, 3, 4],
      ejercicios: ['[[elevacion-talones]]', '[[caminar-descalzo]]'],
    },
    {
      nombre: 'Fase 2 — Fortalecimiento',
      semanas: [5, 6, 7, 8],
      ejercicios: ['[[spreadtoe]]'],
    },
    {
      nombre: 'Fase 3 — Mantenimiento',
      semanas: [9, 99],
    },
  ],
};

// ---------------------------------------------------------------------------
// getFaseForSemana
// ---------------------------------------------------------------------------

describe('getFaseForSemana', () => {
  it('devuelve la fase 1 para semana 1', () => {
    expect(getFaseForSemana(PP, 1)?.nombre).toBe('Fase 1 — Activación');
  });

  it('devuelve la fase 2 para semana 5', () => {
    expect(getFaseForSemana(PP, 5)?.nombre).toBe('Fase 2 — Fortalecimiento');
  });

  it('devuelve la fase abierta para semana 50', () => {
    expect(getFaseForSemana(PP, 50)?.nombre).toBe('Fase 3 — Mantenimiento');
  });

  it('devuelve null si no hay fase que cubra la semana', () => {
    const ppCerrado: PiesProtocolo = {
      fecha_inicio: '2025-01-01',
      fases: [{ nombre: 'F1', semanas: [1, 2] }],
    };
    expect(getFaseForSemana(ppCerrado, 10)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// semanaActualPies
// ---------------------------------------------------------------------------

describe('semanaActualPies', () => {
  it('devuelve 1 el mismo día del inicio', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T10:00:00'));
    expect(semanaActualPies({ ...PP, fecha_inicio: '2025-01-01' })).toBe(1);
  });

  it('devuelve 2 tras 7 días', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-08T10:00:00'));
    expect(semanaActualPies({ ...PP, fecha_inicio: '2025-01-01' })).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// faseActual
// ---------------------------------------------------------------------------

describe('faseActual', () => {
  it('respeta el override de semana', () => {
    const fase = faseActual(PP, 5);
    expect(fase.nombre).toBe('Fase 2 — Fortalecimiento');
  });

  it('usa la semana calculada si no hay override', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-06T10:00:00')); // semana 1
    const fase = faseActual(PP);
    expect(fase.nombre).toBe('Fase 1 — Activación');
  });

  it('devuelve la última fase si la semana supera el rango', () => {
    const fase = faseActual(PP, 999);
    expect(fase.nombre).toBe('Fase 3 — Mantenimiento');
  });
});

// ---------------------------------------------------------------------------
// ejerciciosDeFase
// ---------------------------------------------------------------------------

describe('ejerciciosDeFase', () => {
  it('devuelve los ejercicios de la fase por slug de wikilink', () => {
    const fase = PP.fases[0]!;
    const ejs = ejerciciosDeFase(fase, CAT_PIES);
    expect(ejs.map(e => e.nombre)).toEqual(['Elevación de talones', 'Caminar descalzo']);
  });

  it('respeta el orden definido en la fase', () => {
    const fase: FasePies = {
      nombre: 'Test',
      semanas: [1],
      ejercicios: ['[[caminar-descalzo]]', '[[elevacion-talones]]'],
    };
    const ejs = ejerciciosDeFase(fase, CAT_PIES);
    expect(ejs[0]!.nombre).toBe('Caminar descalzo');
    expect(ejs[1]!.nombre).toBe('Elevación de talones');
  });

  it('devuelve el pool completo si la fase no tiene ejercicios definidos', () => {
    const fase = PP.fases[2]!; // Fase 3 sin ejercicios
    const ejs = ejerciciosDeFase(fase, CAT_PIES);
    expect(ejs).toHaveLength(CAT_PIES.pool.length);
  });

  it('devuelve el pool completo si ningún slug coincide', () => {
    const fase: FasePies = {
      nombre: 'Sin coincidencias',
      semanas: [1],
      ejercicios: ['[[no-existe]]'],
    };
    const ejs = ejerciciosDeFase(fase, CAT_PIES);
    expect(ejs).toHaveLength(CAT_PIES.pool.length);
  });
});

// ---------------------------------------------------------------------------
// maxSemana
// ---------------------------------------------------------------------------

describe('maxSemana', () => {
  it('devuelve 99 para un protocolo con fase abierta', () => {
    expect(maxSemana(PP)).toBe(99);
  });
});
