import type { RutinaSalud } from '../types/schema';
import type { RehabSesionParseada } from '../types/schema';
import type { TimerState } from '../domain/kegel';

// ---------------------------------------------------------------------------
// Estado centralizado de la aplicación
// Toda la UI lee y escribe aquí — nada mutado directamente en el scope global.
// ---------------------------------------------------------------------------

export interface AppState {
  // Datos cargados desde Drive
  data: RutinaSalud | null;

  // Pestaña activa
  activeTab: string;

  // Kegel
  selectedEjercicio: import('../types/schema').KagelEjercicio | null;
  timerState: TimerState | null;
  overrideSemana: number | null;

  // Pies
  overridePiesFase: number | null;

  // Rehab
  rehabSession: RehabSesionParseada | null;
  rehabLoaded: boolean;

  // Cambiar ejercicio
  openChangePanel: string | null;
  changeState: Record<string, ChangePanelState>;

  // Horario
  openSlots: Set<number>;
  firstHorarioRender: boolean;

  // Log
  logDirty: boolean;
  logSaving: boolean;
  logLastSavedTs: Date | null;
}

export interface ChangePanelState {
  motivo: string | null;
  loading: boolean;
  alternativas: import('../types/schema').AlternativaIA[] | null;
  raw: string | null;
}

// ---------------------------------------------------------------------------
// Instancia única (singleton de módulo — no hay global window.*)
// ---------------------------------------------------------------------------

const state: AppState = {
  data: null,
  activeTab: 'hoy',
  selectedEjercicio: null,
  timerState: null,
  overrideSemana: null,
  overridePiesFase: null,
  rehabSession: null,
  rehabLoaded: false,
  openChangePanel: null,
  changeState: {},
  openSlots: new Set(),
  firstHorarioRender: true,
  logDirty: false,
  logSaving: false,
  logLastSavedTs: null,
};

export function getState(): Readonly<AppState> {
  return state;
}

// Actualizaciones parciales tipadas — nunca se muta state directamente fuera de aquí
export function setState(patch: Partial<AppState>): void {
  Object.assign(state, patch);
}

// Accesores tipados frecuentes
export function getData(): RutinaSalud {
  if (!state.data) throw new Error('DATA no cargado — loadData() debe completarse primero');
  return state.data;
}

export function setData(data: RutinaSalud): void {
  state.data = data;
}
