const DAYS_ES = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'] as const;
const DAYS_ES_NO_ACCENT = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'] as const;
const MONTHS_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'] as const;

export type DayNameES = typeof DAYS_ES_NO_ACCENT[number];

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function todayDayName(): DayNameES {
  return DAYS_ES_NO_ACCENT[new Date().getDay()]!;
}

export function formatDateES(d: Date): string {
  return `${DAYS_ES[d.getDay()]}, ${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`;
}

export function weeksSince(dateStr: string): number {
  const start = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const diff = Math.floor((now.getTime() - start.getTime()) / (7 * 24 * 3600 * 1000));
  return Math.max(1, diff + 1);
}

// Ordinal de día desde epoch (usado por el motor de selección de ejercicios).
export function dayOrdinal(date: Date = new Date()): number {
  return Math.floor(
    new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() / 86400000,
  );
}
