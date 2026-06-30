// Tipos inferidos del esquema real de rutina-salud.json (datos v2.9+).
// La app lee este JSON desde Drive y NUNCA lo escribe.
// Cambiar estas interfaces requiere aprobación de Arnaldo (hay otras piezas
// que dependen del esquema: artifact, scheduled, vault).

// ---------------------------------------------------------------------------
// Primitivos compartidos
// ---------------------------------------------------------------------------

export type DiasSemana =
  | 'lunes'
  | 'martes'
  | 'miercoles'
  | 'jueves'
  | 'viernes'
  | 'sabado'
  | 'domingo';

export type TierEjercicio = 'principal' | 'base' | 'avanzado';

export type UnidadEjercicio = 'rep' | 'rep_por_lado' | 'segundos';

// ---------------------------------------------------------------------------
// Meta
// ---------------------------------------------------------------------------

export interface Meta {
  title: string;
  version: string;
  updated: string;
  fecha_inicio_programa: string; // ISO date: "YYYY-MM-DD"
}

// ---------------------------------------------------------------------------
// Design tokens (opcionales — sobrescriben las variables CSS)
// ---------------------------------------------------------------------------

export interface DesignTokens {
  bg?: string;
  card?: string;
  border?: string;
  text_primary?: string;
  text_secondary?: string;
  accent_blue?: string;
  accent_orange?: string;
  accent_green?: string;
  accent_purple?: string;
  accent_gray?: string;
  accent_red?: string;
  accent_cyan?: string;
  accent_teal?: string;
  radius_card?: number;
  radius_button?: number;
}

// ---------------------------------------------------------------------------
// Pilares
// ---------------------------------------------------------------------------

export interface Pilar {
  id: string;
  nombre: string;
  color: string;
  frecuencia: string;
  notas: string;
  activo: boolean;
}

// ---------------------------------------------------------------------------
// Horario diario
// ---------------------------------------------------------------------------

export interface HorarioItem {
  hora: string;           // "HH:MM"
  tarea: string;
  pilar: string;          // id del pilar
  check?: string;         // id para localStorage
  categoria?: string;     // id de categoría de entrenamiento, o "rotativo"
}

// ---------------------------------------------------------------------------
// Checklist diario (items sin hora)
// ---------------------------------------------------------------------------

export interface ChecklistItem {
  id: string;
  label: string;
  pilar: string;
  sin_hora?: boolean;
}

// ---------------------------------------------------------------------------
// Recordatorios semanales
// ---------------------------------------------------------------------------

export interface RecordatorioSemanal {
  dia: DiasSemana;
  mensaje: string;
}

// ---------------------------------------------------------------------------
// Kegel
// ---------------------------------------------------------------------------

export interface KagelEjercicio {
  tipo: string;
  contraccion_s: number;
  pausa_s: number;
  reps: number;
  series: number;
}

export interface KagelFase {
  nombre: string;
  semanas: number[];
  ejercicios: KagelEjercicio[];
}

export interface Kegel {
  fases: KagelFase[];
  warning: string;
}

// ---------------------------------------------------------------------------
// Entrenamiento (esquema v2.0 — por patrones)
// ---------------------------------------------------------------------------

export interface PasoCalentamiento {
  nombre: string;
  series?: number;
  reps?: number;
  unidad?: UnidadEjercicio;
  detalle?: string;
  ficha?: string;
}

export interface Calentamiento {
  id: string;
  nombre: string;
  nota?: string;
  pasos: PasoCalentamiento[];
}

export interface Ejercicio {
  nombre: string;
  tier: TierEjercicio;
  series: number;
  reps: number | string; // puede ser "8-10"
  unidad: UnidadEjercicio;
  nota?: string;
  ficha?: string;
  grupo_equivalente?: string;
  // Estado de UI mutable en runtime (no viene del JSON)
  _sustituto?: SustitucionEjercicio | null;
}

export interface SustitucionEjercicio {
  nombre: string;
  video: string | null;
  ficha?: string | null;
}

export interface Categoria {
  id: string;
  nombre: string;
  color: string;
  prioridad: 1 | 2 | 3;
  objetivo?: string;
  calentamiento?: string; // id de Calentamiento
  doc_protocolo?: string;
  regla_seleccion?: ReglaSeleccion;
  pool: Ejercicio[];
}

export interface ReglaSeleccion {
  principal: number;
  base: number;
}

export interface RotacionDia {
  dia: DiasSemana;
  patrones: string[]; // ids de Categoria
  nota?: string;
}

export interface EtapaProgresion {
  semanas: [number, number]; // [inicio, fin] — fin >= 99 significa abierto
  ajuste: string;
}

export interface Microciclo {
  duracion_semanas: number;
  ancla: 'fecha_inicio_programa';
}

// ---------------------------------------------------------------------------
// Protocolo de pies (datos v2.9+)
// ---------------------------------------------------------------------------

export interface FasePies {
  nombre: string;
  semanas: number[];
  descripcion?: string;
  ejercicios?: string[]; // slugs o wikilinks de ejercicios del pool "pies"
}

export interface PiesProtocolo {
  fecha_inicio: string; // ISO date
  doc?: string;
  aviso_fase?: string;
  bandera_roja?: string;
  fases: FasePies[];
}

// ---------------------------------------------------------------------------
// Bloque de entrenamiento completo
// ---------------------------------------------------------------------------

export interface Entrenamiento {
  categorias: Categoria[];
  calentamientos: Calentamiento[];
  rotacion_semanal: RotacionDia[];
  progresion: EtapaProgresion[];
  microciclo: Microciclo;
  pies_protocolo?: PiesProtocolo;
}

// ---------------------------------------------------------------------------
// Raíz del JSON: rutina-salud.json
// ---------------------------------------------------------------------------

export interface RutinaSalud {
  meta: Meta;
  design_tokens?: DesignTokens;
  pilares: Pilar[];
  horarios_diarios: HorarioItem[];
  checklist_diario: ChecklistItem[];
  recordatorios_semanales?: RecordatorioSemanal[];
  kegel: Kegel;
  entrenamiento?: Entrenamiento;
  analitica_anual_recomendada?: string[];
}

// ---------------------------------------------------------------------------
// Log diario: salud-log-YYYY-MM-DD.json
// ---------------------------------------------------------------------------

export interface RegistroEjercicio {
  patron: string;
  ejercicio: string;
  completado: boolean;
  carga_kg: number | null;
  reps_reales: number | null;
  series_reales: number | null;
  rpe: number | null;
  sustituido_por: string | null;
}

export interface Molestia {
  zona: string;
  intensidad: 1 | 2 | 3;
  contexto: string;
  nota: string;
}

export interface LogDiario {
  $schema_version: string;
  fecha: string;         // ISO date
  guardado_ts: string;   // ISO datetime
  checks: Record<string, boolean>;
  ejercicios: RegistroEjercicio[];
  molestias: Molestia[];
  nota_libre: string;
}

// ---------------------------------------------------------------------------
// Tipos de UI (estado de runtime, no del JSON)
// ---------------------------------------------------------------------------

export interface RehabSesionParseada {
  titulo: string;
  fileName: string;
  viewUrl: string | null;
  modifiedTime?: string;
  bloques: RehabBloque[];
}

export interface RehabBloque {
  titulo: string;
  ejercicios: RehabEjercicio[];
}

export interface RehabEjercicio {
  nombre: string;
  slug: string;
  detalle: string;
  nota: string;
  video: { label: string; url: string } | null;
  sustituto: { nombre: string; video: string | null } | null;
}

export interface AlternativaIA {
  nombre: string;
  descripcion: string;
  video?: string;
  recomendado: boolean;
}

export interface AlternativaPool {
  nombre: string;
  descripcion: string;
  ficha: string | null;
  poolIdx: number;
}
