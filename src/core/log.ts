import { today } from '../utils/date';
import type { LogDiario, Molestia, RegistroEjercicio, RutinaSalud } from '../types/schema';

export const LOG_SCHEMA_VERSION = '1.0';

// ---------------------------------------------------------------------------
// Claves de localStorage
// ---------------------------------------------------------------------------

export function checkKey(fecha: string, itemId: string): string {
  return `salud-check-${fecha}-${itemId}`;
}

export function logExtraKey(fecha: string): string {
  return `salud-logextra-${fecha}`;
}

// ---------------------------------------------------------------------------
// Interfaz de storage — abstraída para poder testear sin localStorage real
// ---------------------------------------------------------------------------

export interface Storage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// ---------------------------------------------------------------------------
// Checks (completado de ítems)
// ---------------------------------------------------------------------------

export function isChecked(storage: Storage, fecha: string, itemId: string): boolean {
  return storage.getItem(checkKey(fecha, itemId)) === '1';
}

export function toggleCheck(storage: Storage, fecha: string, itemId: string): boolean {
  if (isChecked(storage, fecha, itemId)) {
    storage.removeItem(checkKey(fecha, itemId));
    return false;
  }
  storage.setItem(checkKey(fecha, itemId), '1');
  return true;
}

// ---------------------------------------------------------------------------
// Log extra (molestias, ejercicios, nota)
// ---------------------------------------------------------------------------

export interface LogExtra {
  ejercicios?: RegistroEjercicio[];
  molestias?: Molestia[];
  nota_libre?: string;
}

export function getLogExtra(storage: Storage, fecha: string): LogExtra {
  try {
    return JSON.parse(storage.getItem(logExtraKey(fecha)) ?? '{}') as LogExtra;
  } catch {
    return {};
  }
}

export function setLogExtra(storage: Storage, fecha: string, obj: LogExtra): void {
  storage.setItem(logExtraKey(fecha), JSON.stringify(obj));
}

// ---------------------------------------------------------------------------
// Registro por ejercicio
// ---------------------------------------------------------------------------

export function getRegistroEj(
  storage: Storage,
  fecha: string,
  patron: string,
  nombre: string,
): RegistroEjercicio | null {
  const extra = getLogExtra(storage, fecha);
  return (extra.ejercicios ?? []).find(e => e.patron === patron && e.ejercicio === nombre) ?? null;
}

type CampoRegistro = 'carga' | 'reps' | 'series' | 'rpe';

export function setRegistroEj(
  storage: Storage,
  fecha: string,
  patron: string,
  nombre: string,
  campo: CampoRegistro,
  valor: string,
): void {
  const extra = getLogExtra(storage, fecha);
  extra.ejercicios ??= [];

  let reg = extra.ejercicios.find(e => e.patron === patron && e.ejercicio === nombre);
  if (!reg) {
    reg = {
      patron,
      ejercicio: nombre,
      completado: true,
      carga_kg: null,
      reps_reales: null,
      series_reales: null,
      rpe: null,
      sustituido_por: null,
    };
    extra.ejercicios.push(reg);
  }

  const num = valor === '' ? null : Number(valor);
  if (campo === 'carga') reg.carga_kg = num;
  else if (campo === 'reps') reg.reps_reales = num;
  else if (campo === 'series') reg.series_reales = num;
  else if (campo === 'rpe') reg.rpe = num;
  reg.completado = true;

  // Si todos los campos quedan vacíos, elimina el registro
  if (
    reg.carga_kg === null &&
    reg.reps_reales === null &&
    reg.series_reales === null &&
    reg.rpe === null
  ) {
    extra.ejercicios = extra.ejercicios.filter(
      e => !(e.patron === patron && e.ejercicio === nombre),
    );
  }

  setLogExtra(storage, fecha, extra);
}

// ---------------------------------------------------------------------------
// Hidratación desde un log guardado en Drive
// ---------------------------------------------------------------------------

/**
 * Puebla storage con los valores de un LogDiario cargado desde Drive.
 * Regla: solo escribe una clave si storage NO la tiene ya (localStorage
 * de la sesión activa tiene prioridad sobre el log guardado).
 * Devuelve true si escribió al menos un valor (útil para saber si re-renderizar).
 */
export function hydratarLogDesdeJson(
  storage: Storage,
  log: LogDiario,
): boolean {
  const fecha = log.fecha;
  let wrote = false;

  // Checks
  for (const [id, checked] of Object.entries(log.checks)) {
    const key = checkKey(fecha, id);
    if (storage.getItem(key) === null) {
      if (checked) storage.setItem(key, '1');
      wrote = true;
    }
  }

  // Extra (ejercicios, molestias, nota) — solo si no hay nada local para el día
  const extraKey = logExtraKey(fecha);
  if (storage.getItem(extraKey) === null) {
    const extra: LogExtra = {};
    if (log.ejercicios.length > 0) extra.ejercicios = log.ejercicios;
    if (log.molestias.length > 0) extra.molestias = log.molestias;
    if (log.nota_libre) extra.nota_libre = log.nota_libre;
    if (Object.keys(extra).length > 0) {
      storage.setItem(extraKey, JSON.stringify(extra));
      wrote = true;
    }
  }

  return wrote;
}

// ---------------------------------------------------------------------------
// Construcción del payload del log
// ---------------------------------------------------------------------------

export function construirLogDelDia(
  storage: Storage,
  data: RutinaSalud,
  fecha: string = today(),
): LogDiario {
  const checks: Record<string, boolean> = {};

  for (const item of data.checklist_diario) {
    checks[item.id] = isChecked(storage, fecha, item.id);
  }
  for (const h of data.horarios_diarios) {
    if (h.check) checks[h.check] = isChecked(storage, fecha, h.check);
  }

  const extra = getLogExtra(storage, fecha);

  return {
    $schema_version: LOG_SCHEMA_VERSION,
    fecha,
    guardado_ts: new Date().toISOString(),
    checks,
    ejercicios: extra.ejercicios ?? [],
    molestias: extra.molestias ?? [],
    nota_libre: extra.nota_libre ?? '',
  };
}
