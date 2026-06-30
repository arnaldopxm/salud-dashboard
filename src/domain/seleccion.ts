import { dayOrdinal } from '../utils/date';
import type { Categoria, Ejercicio, Entrenamiento, RotacionDia } from '../types/schema';
import type { DayNameES } from '../utils/date';

export interface SeleccionEjercicios {
  elegidos: Ejercicio[];
  avanzados: Ejercicio[];
}

// ---------------------------------------------------------------------------
// Microciclo
// ---------------------------------------------------------------------------

export function microcicloIdx(entrenamiento: Entrenamiento, fechaInicio: string): number {
  const mc = entrenamiento.microciclo;
  const dur = mc.duracion_semanas ?? 2;
  const d0 = new Date(fechaInicio + 'T00:00:00');
  const now = new Date();
  const semanas = Math.floor((now.getTime() - d0.getTime()) / (7 * 24 * 3600 * 1000));
  return Math.floor(Math.max(0, semanas) / dur);
}

// ---------------------------------------------------------------------------
// Selección de ejercicios por tiers
// ---------------------------------------------------------------------------

export function seleccionarEjercicios(
  cat: Categoria,
  mcIdx: number,
  ordinalDia: number = dayOrdinal(),
): SeleccionEjercicios {
  if (!cat.pool) return { elegidos: [], avanzados: [] };

  const porTier: Record<'base' | 'principal' | 'avanzado', Ejercicio[]> = {
    base: [],
    principal: [],
    avanzado: [],
  };
  for (const ej of cat.pool) {
    porTier[ej.tier].push(ej);
  }

  // Sin regla de selección: todos los no-avanzados van directos
  if (!cat.regla_seleccion) {
    if (
      porTier.base.length === 0 &&
      porTier.principal.length === 0 &&
      porTier.avanzado.length === 0
    ) {
      return { elegidos: cat.pool.slice(), avanzados: [] };
    }
    return {
      elegidos: cat.pool.filter(e => e.tier !== 'avanzado'),
      avanzados: porTier.avanzado,
    };
  }

  const regla = cat.regla_seleccion;
  const elegidos: Ejercicio[] = [];

  // Principales: rotan por microciclo
  if (regla.principal > 0 && porTier.principal.length > 0) {
    for (let k = 0; k < regla.principal && k < porTier.principal.length; k++) {
      elegidos.push(porTier.principal[(mcIdx + k) % porTier.principal.length]!);
    }
  }

  // Base: rotan por grupo equivalente y día
  if (regla.base > 0 && porTier.base.length > 0) {
    const grupos: Record<string, Ejercicio[]> = {};
    porTier.base.forEach((ej, i) => {
      const g = ej.grupo_equivalente ?? `__solo${i}`;
      (grupos[g] ??= []).push(ej);
    });
    const claves = Object.keys(grupos);
    let puestos = 0;
    let gi = 0;
    while (puestos < regla.base && claves.length > 0) {
      const g = grupos[claves[gi % claves.length]!]!;
      const pick = g[(ordinalDia + gi) % g.length]!;
      if (!elegidos.includes(pick)) {
        elegidos.push(pick);
        puestos++;
      }
      gi++;
      if (gi > 50) break; // salvaguarda contra bucle infinito
    }
  }

  return { elegidos, avanzados: porTier.avanzado };
}

// ---------------------------------------------------------------------------
// Patrones del día según rotación semanal
// ---------------------------------------------------------------------------

export function patronesDeHoy(
  rotacion: RotacionDia[],
  diaHoy: DayNameES,
): string[] {
  const entrada = rotacion.find(x => x.dia === diaHoy);
  return entrada?.patrones ?? [];
}

// ---------------------------------------------------------------------------
// Resolución de categoría para un slot del horario
// ---------------------------------------------------------------------------

export function resolverCategoriaSlot(
  categoriaSlot: string | undefined,
  rotativoIdx: number,
  rotacion: RotacionDia[],
  diaHoy: DayNameES,
): string | null {
  if (!categoriaSlot) return null;
  if (categoriaSlot !== 'rotativo') return categoriaSlot;

  const pats = patronesDeHoy(rotacion, diaHoy).filter(
    p => p !== 'traccion' && p !== 'cuello',
  );
  const fuente = pats.length > 0 ? pats : patronesDeHoy(rotacion, diaHoy);
  return fuente[rotativoIdx % fuente.length] ?? null;
}
