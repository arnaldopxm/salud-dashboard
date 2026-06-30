import { GOOGLE_CLIENT_ID, GOOGLE_SCOPE } from './config';
import {
  IS_COWORK, driveSearch, driveDownload, driveCreate,
  decodeBase64Utf8, initTokenClient, requestAccessToken,
  requestAccessTokenSilent, wasAuthorized, revokeAuthorization,
} from './core/drive';
import { setData, getData, getState, setState } from './core/state';
import {
  construirLogDelDia, getLogExtra, setLogExtra, setRegistroEj,
  hydratarLogDesdeJson,
} from './core/log';
import { initTabs, activateTab } from './ui/tabs';
import { renderHeader, updateProgress } from './ui/header';
import { renderHorario, renderSinHora, renderRecordatorio, refreshHorarioHighlight } from './ui/horario';
import { renderRegistro } from './ui/registro';
import { renderKegel, onSemanaChange } from './ui/kegel';
import { renderFuerza } from './ui/fuerza';
import { renderPies, onPiesFaseChange } from './ui/pies';
import { loadRehabSession, generarSesionHoy } from './ui/rehab';
import {
  toggleChangePanel, selectMotivo,
  pedirAlternativasIA, elegirDelPool, elegirAlternativaIA,
  resetChange,
} from './ui/cambiar';
import { today } from './utils/date';
import { escapeHtml, slugify, fichaHref } from './utils/html';

// ---------------------------------------------------------------------------
// Storage wrapper — usa localStorage del navegador
// ---------------------------------------------------------------------------

const storage = {
  getItem: (k: string) => { try { return localStorage.getItem(k); } catch { return null; } },
  setItem: (k: string, v: string) => { try { localStorage.setItem(k, v); } catch {} },
  removeItem: (k: string) => { try { localStorage.removeItem(k); } catch {} },
};

// ---------------------------------------------------------------------------
// Constantes de Drive
// ---------------------------------------------------------------------------

const LOG_FOLDER_ID = '1WtwAQ46B7gvbhxNxNrLOnWmwfcMYA6wP';

// ---------------------------------------------------------------------------
// Guardar log en Drive
// ---------------------------------------------------------------------------

async function guardarDiaEnDrive(): Promise<void> {
  const s = getState();
  if (s.logSaving) return;
  setState({ logSaving: true });
  const btn = document.getElementById('log-save-btn') as HTMLButtonElement | null;
  if (btn) { btn.disabled = true; btn.textContent = '💾 Guardando…'; }
  try {
    const folderId = await resolverCarpetaLog();
    const data = getData();
    const payload = construirLogDelDia(storage, data, today());
    await driveCreate({
      title: `salud-log-${today()}.json`,
      parentId: folderId,
      textContent: JSON.stringify(payload, null, 2),
      contentMimeType: 'application/json',
    });
    setState({ logDirty: false, logLastSavedTs: new Date(), logSaving: false });
    if (btn) {
      btn.textContent = '✓ Guardado';
      setTimeout(() => {
        if (btn && !getState().logDirty) { btn.textContent = '💾 Guardar día en Drive'; btn.disabled = true; }
      }, 2000);
    }
  } catch (e) {
    console.error('[salud] guardarDiaEnDrive failed:', e);
    setState({ logSaving: false });
    if (btn) { btn.textContent = '⚠ Error al guardar — reintentar'; btn.disabled = false; }
  }
}

async function resolverCarpetaLog(): Promise<string> {
  try {
    const d = await driveSearch("name = 'log' and mimeType = 'application/vnd.google-apps.folder'");
    const f = (d.files ?? []).find(x => x.id === LOG_FOLDER_ID) ?? d.files?.[0];
    return f ? f.id : LOG_FOLDER_ID;
  } catch { return LOG_FOLDER_ID; }
}

function logMarkDirty(): void {
  setState({ logDirty: true });
  const btn = document.getElementById('log-save-btn') as HTMLButtonElement | null;
  if (btn) { btn.textContent = '💾 Guardar día en Drive *'; btn.disabled = false; }
}

// ---------------------------------------------------------------------------
// Render principal
// ---------------------------------------------------------------------------

function renderAll(): void {
  const data = getData();
  const fecha = today();

  document.getElementById('loading-screen')!.style.display = 'none';
  document.getElementById('main-header')!.style.display = 'block';
  document.getElementById('tabs')!.style.display = 'flex';
  document.getElementById('content')!.style.display = 'block';

  renderHeader(data, storage);
  const horarioResult = renderHorario(
    data, storage, getState().openSlots, getState().firstHorarioRender,
    (tab) => activateTab(tab, handleRehabActivate),
  );
  setState({ openSlots: horarioResult.nextOpenSlots, firstHorarioRender: false });
  renderSinHora(data, storage, () => {
    logMarkDirty();
    updateProgress(data, storage, fecha);
  });
  renderRecordatorio(data);
  renderRegistro(storage, fecha, getState().logDirty, getState().logLastSavedTs, {
    onSave: guardarDiaEnDrive,
    onDirty: logMarkDirty,
  });
  renderKegel(data, data.meta.fecha_inicio_programa, getState().overrideSemana);
  renderFuerza(data, storage, fecha);
  renderPies(data, getState().overridePiesFase);
  renderPlan(data);

  initTabs(handleRehabActivate);

  // Escucha el evento de progreso emitido por horario.ts
  document.addEventListener('salud:progress-update', () => {
    logMarkDirty();
    updateProgress(data, storage, fecha);
  });

  // Refresca el highlight cada minuto
  setInterval(() => refreshHorarioHighlight(data), 60_000);

  // Autosave al ocultar/cerrar
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && getState().logDirty && !getState().logSaving) {
      void guardarDiaEnDrive();
    }
  });
  window.addEventListener('pagehide', () => {
    if (getState().logDirty && !getState().logSaving) void guardarDiaEnDrive();
  });
}

function handleRehabActivate(): void {
  if (!getState().rehabLoaded) {
    setState({ rehabLoaded: true });
    void loadRehabSession();
  }
}

// ---------------------------------------------------------------------------
// Pestaña Plan (sin módulo propio — es solo display de datos)
// ---------------------------------------------------------------------------

function renderPlan(data: ReturnType<typeof getData>): void {
  const pilaresEl = document.getElementById('plan-pilares');
  if (!pilaresEl) return;
  pilaresEl.innerHTML = '';
  data.pilares.filter(p => p.activo).forEach(p => {
    const el = document.createElement('div');
    el.className = 'pilar-card';
    el.style.borderColor = p.color + '40';
    el.innerHTML = `<div class="pilar-dot" style="background:${p.color}"></div><div class="pilar-body"><div class="pilar-nombre">${escapeHtml(p.nombre)}</div><div class="pilar-freq">${escapeHtml(p.frecuencia)}</div><div class="pilar-nota">${escapeHtml(p.notas)}</div></div>`;
    pilaresEl.appendChild(el);
  });
  const analiticaEl = document.getElementById('plan-analitica');
  if (analiticaEl) {
    analiticaEl.innerHTML = (data.analitica_anual_recomendada ?? [])
      .map(item => `<div class="analitica-item"><div class="analitica-dot"></div>${escapeHtml(item)}</div>`)
      .join('');
  }
  const footerEl = document.getElementById('plan-footer');
  if (footerEl) footerEl.textContent = `Web · Datos: ${data.meta.version} · Actualizado ${data.meta.updated}`;
}

// ---------------------------------------------------------------------------
// Hidratación del log del día desde Drive
// ---------------------------------------------------------------------------

async function cargarLogDelDia(): Promise<void> {
  const fecha = today();
  try {
    const results = await driveSearch(
      `name = 'salud-log-${fecha}.json'`,
    );
    const logFile = results.files[0];
    if (!logFile) return; // no hay log guardado hoy — storage vacío es correcto

    const dl = await driveDownload(logFile.id);
    if (!dl.content) return;

    const log = JSON.parse(decodeBase64Utf8(dl.content)) as import('./types/schema').LogDiario;
    hydratarLogDesdeJson(storage, log);
  } catch {
    // Si falla la carga del log no bloqueamos el render — es best-effort
  }
}

// ---------------------------------------------------------------------------
// Login y carga de datos
// ---------------------------------------------------------------------------

async function loadData(): Promise<void> {
  document.getElementById('loading-screen')!.style.display = 'flex';
  document.getElementById('login-screen')!.style.display = 'none';
  document.getElementById('error-screen')!.style.display = 'none';
  document.getElementById('main-header')!.style.display = 'none';
  document.getElementById('tabs')!.style.display = 'none';
  document.getElementById('content')!.style.display = 'none';
  (document.getElementById('error-detail') as HTMLElement).textContent = '';

  if (!IS_COWORK && !window.__saludGisToken) {
    // Si el usuario ya autorizó antes, intentar renovación silenciosa primero.
    // GIS llamará al callback (onSuccess) o al error_callback (onError).
    if (wasAuthorized()) {
      initTokenClient(
        GOOGLE_CLIENT_ID, GOOGLE_SCOPE,
        () => { void loadData(); },           // renovó OK → reintenta loadData
        () => {                                // falló → muestra login
          document.getElementById('loading-screen')!.style.display = 'none';
          document.getElementById('login-screen')!.style.display = 'flex';
        },
      );
      requestAccessTokenSilent();
      return; // espera el callback — no continuar con el render
    }
    document.getElementById('loading-screen')!.style.display = 'none';
    document.getElementById('login-screen')!.style.display = 'flex';
    return;
  }

  try {
    const searchData = await driveSearch("name = 'rutina-salud.json'");
    if (!searchData.files?.length) throw new Error('Archivo rutina-salud.json no encontrado en Drive');
    const file = searchData.files.slice().sort((a, b) =>
      (b.modifiedTime ?? '').localeCompare(a.modifiedTime ?? ''),
    )[0]!;
    const dl = await driveDownload(file.id);
    if (!dl.content) throw new Error('download no devolvió campo content');
    setData(JSON.parse(decodeBase64Utf8(dl.content)));
    await cargarLogDelDia();
    renderAll();
  } catch (e) {
    console.error('[salud] loadData failed:', e);
    document.getElementById('loading-screen')!.style.display = 'none';
    document.getElementById('error-screen')!.style.display = 'flex';
    (document.getElementById('error-detail') as HTMLElement).textContent =
      e instanceof Error ? e.message : String(e);
  }
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

declare global {
  interface Window {
    __saludGisToken?: string;
    cerrarSesion: () => void;
    // Funciones expuestas globalmente para los onclick residuales en index.html
    iniciarLogin: () => void;
    loadData: () => Promise<void>;
    activateTab: (tab: string) => void;
    onSemanaChange: (val: string) => void;
    onPiesFaseChange: (val: string) => void;
    toggleChangePanel: typeof toggleChangePanel;
    selectMotivo: typeof selectMotivo;
    pedirAlternativasIA: typeof pedirAlternativasIA;
    elegirDelPool: typeof elegirDelPool;
    elegirAlternativaIA: typeof elegirAlternativaIA;
    resetChange: typeof resetChange;
    generarSesionHoy: () => Promise<void>;
    guardarDiaEnDrive: () => Promise<void>;
    abrirFicha: (ev: MouseEvent, slug: string) => void;
    setRegistroEj: (patron: string, nombre: string, campo: string, valor: string) => void;
    quitarMolestia: (i: number) => void;
    anadirMolestia: () => void;
    guardarNota: (val: string) => void;
  }
}

function iniciarLogin(): void {
  if (!GOOGLE_CLIENT_ID) {
    (document.getElementById('login-detail') as HTMLElement).textContent =
      'Falta GOOGLE_CLIENT_ID en config.ts.';
    return;
  }
  initTokenClient(
    GOOGLE_CLIENT_ID, GOOGLE_SCOPE,
    () => {
      document.getElementById('login-screen')!.style.display = 'none';
      void loadData();
    },
  );
  requestAccessToken();
}

function abrirFicha(ev: MouseEvent, slug: string): void {
  if (ev) { ev.preventDefault(); ev.stopPropagation(); }
  const btn = ev?.currentTarget as HTMLButtonElement | null;
  const href = fichaHref(slug);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(href)
      .then(() => fichaFeedback(btn, true))
      .catch(() => legacyCopy(href, btn));
  } else {
    legacyCopy(href, btn);
  }
}

function fichaFeedback(btn: HTMLButtonElement | null, ok: boolean): void {
  if (!btn) return;
  const original = btn.dataset['orig'] ?? btn.textContent ?? '';
  btn.dataset['orig'] = original;
  btn.textContent = ok ? '✓ Copiada — pégala en Obsidian' : '⚠ No se pudo copiar';
  setTimeout(() => { btn.textContent = btn.dataset['orig'] ?? original; }, 2200);
}

function legacyCopy(text: string, btn: HTMLButtonElement | null): void {
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.focus(); ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    fichaFeedback(btn, ok);
  } catch {
    fichaFeedback(btn, false);
    prompt('Copia este enlace y ábrelo en Obsidian:', text);
  }
}

function boot(): void {
  // Registra SW para PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(console.error);
  }

  // Indicador de entorno
  const pill = document.getElementById('env-pill');
  if (pill) pill.textContent = IS_COWORK ? 'Cowork' : 'Web';

  // Expone funciones globales necesarias para onclick residuales en el HTML
  window.iniciarLogin = iniciarLogin;
  window.cerrarSesion = () => {
    if (!confirm('¿Cerrar sesión?')) return;
    revokeAuthorization();
    location.reload();
  };
  window.loadData = loadData;
  window.activateTab = (tab) => activateTab(tab, handleRehabActivate);
  window.onSemanaChange = (val) => onSemanaChange(parseInt(val));
  window.onPiesFaseChange = (val) => onPiesFaseChange(Number(val));
  window.toggleChangePanel = toggleChangePanel;
  window.selectMotivo = selectMotivo;
  window.pedirAlternativasIA = pedirAlternativasIA;
  window.elegirDelPool = elegirDelPool;
  window.elegirAlternativaIA = elegirAlternativaIA;
  window.resetChange = resetChange;
  window.generarSesionHoy = () => generarSesionHoy(getData());
  window.guardarDiaEnDrive = guardarDiaEnDrive;
  window.abrirFicha = abrirFicha;
  window.setRegistroEj = (patron, nombre, campo, valor) => {
    setRegistroEj(storage, today(), patron, nombre, campo as 'carga' | 'reps' | 'series' | 'rpe', valor);
    logMarkDirty();
    // Refresca badges sin re-render completo
    const sid = slugify(`${patron}-${nombre}`);
    document.querySelectorAll(`[data-ejreg-badge="${sid}"]`)
      .forEach(b => { (b as HTMLElement).textContent = '✓ registrado'; });
  };
  window.quitarMolestia = (i) => {
    const extra = getLogExtra(storage, today());
    extra.molestias?.splice(i, 1);
    setLogExtra(storage, today(), extra);
    logMarkDirty();
    renderRegistro(storage, today(), true, getState().logLastSavedTs, {
      onSave: guardarDiaEnDrive, onDirty: logMarkDirty,
    });
  };
  window.anadirMolestia = () => {
    const zona = ((document.getElementById('reg-zona') as HTMLInputElement)?.value ?? '').trim();
    if (!zona) return;
    const inten = parseInt((document.getElementById('reg-inten') as HTMLSelectElement)?.value ?? '1');
    const ctx = ((document.getElementById('reg-ctx') as HTMLInputElement)?.value ?? '').trim();
    const extra = getLogExtra(storage, today());
    extra.molestias ??= [];
    extra.molestias.push({ zona, intensidad: inten as 1 | 2 | 3, contexto: ctx, nota: '' });
    setLogExtra(storage, today(), extra);
    logMarkDirty();
    renderRegistro(storage, today(), true, getState().logLastSavedTs, {
      onSave: guardarDiaEnDrive, onDirty: logMarkDirty,
    });
  };
  window.guardarNota = (val) => {
    const extra = getLogExtra(storage, today());
    extra.nota_libre = val;
    setLogExtra(storage, today(), extra);
    logMarkDirty();
  };

  void loadData();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
