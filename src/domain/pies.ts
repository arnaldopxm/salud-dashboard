import { weeksSince } from '../utils/date';
import { fichaSlug } from '../utils/html';
import type { Categoria, Ejercicio, Entrenamiento, FasePies, PiesProtocolo } from '../types/schema';

// ---------------------------------------------------------------------------
// Acceso al protocolo
// ---------------------------------------------------------------------------

export function getPiesProtocolo(entrenamiento: Entrenamiento): PiesProtocolo | null {
  return entrenamiento.pies_protocolo ?? null;
}

export function getPiesCategoria(entrenamiento: Entrenamiento): Categoria | null {
  return entrenamiento.categorias.find(c => c.id === 'pies') ?? null;
}

// ---------------------------------------------------------------------------
// Lookup de fase
// ---------------------------------------------------------------------------

export function getFaseForSemana(pp: PiesProtocolo, semana: number): FasePies | null {
  for (const fase of pp.fases) {
    const lo = fase.semanas[0]!;
    const hi = fase.semanas[fase.semanas.length - 1]!;
    if (lo <= semana && semana <= hi) return fase;
  }
  return null;
}

export function semanaActualPies(pp: PiesProtocolo): number {
  return weeksSince(pp.fecha_inicio);
}

export function faseActual(pp: PiesProtocolo, overrideSemana?: number): FasePies {
  const semana = overrideSemana ?? semanaActualPies(pp);
  return getFaseForSemana(pp, semana) ?? pp.fases[pp.fases.length - 1]!;
}

// ---------------------------------------------------------------------------
// Ejercicios de una fase
// ---------------------------------------------------------------------------

export function ejerciciosDeFase(fase: FasePies, cat: Categoria): Ejercicio[] {
  if (!fase.ejercicios || fase.ejercicios.length === 0) return cat.pool.slice();

  const slugsDeFase = fase.ejercicios.map(w => fichaSlug(w, ''));
  const encontrados = slugsDeFase
    .map(sl => cat.pool.find(e => fichaSlug(e.ficha, e.nombre) === sl))
    .filter((e): e is Ejercicio => e !== undefined);

  return encontrados.length > 0 ? encontrados : cat.pool.slice();
}

// ---------------------------------------------------------------------------
// Semana máxima del protocolo
// ---------------------------------------------------------------------------

export function maxSemana(pp: PiesProtocolo): number {
  return Math.max(...pp.fases.flatMap(f => f.semanas));
}
