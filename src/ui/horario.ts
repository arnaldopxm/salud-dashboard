// ---------------------------------------------------------------------------
// Pestaña "Hoy" — horario, sin-hora y recordatorio
// ---------------------------------------------------------------------------

import type {
  Calentamiento,
  Categoria,
  Ejercicio,
  FasePies,
  HorarioItem,
  PasoCalentamiento,
  Pilar,
  RutinaSalud,
} from '../types/schema';
import type { Storage } from '../core/log';
import { getRegistroEj, isChecked, toggleCheck } from '../core/log';
import { today, todayDayName } from '../utils/date';
import { escapeHtml, fichaLinkHTML, slugify } from '../utils/html';
import {
  microcicloIdx,
  resolverCategoriaSlot,
  seleccionarEjercicios,
} from '../domain/seleccion';
import { faseActual, ejerciciosDeFase, getPiesCategoria, getPiesProtocolo } from '../domain/pies';

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

function getPilarColor(pilares: Pilar[], pilarId: string): string {
  const p = pilares.find(p => p.id === pilarId);
  return p ? p.color : '#A0A0B8';
}

function kbUnidadLabel(u: string | undefined): string {
  if (u === 'rep_por_lado') return 'rep/lado';
  if (u === 'segundos') return 'seg';
  return 'rep';
}

function tierBadge(tier: string): string {
  if (tier === 'principal') return '<span class="tier-pill tier-principal">principal</span>';
  if (tier === 'base') return '<span class="tier-pill tier-base">base</span>';
  if (tier === 'avanzado') return '<span class="tier-pill tier-avanzado">avanzado</span>';
  return '';
}

// ---------------------------------------------------------------------------
// Registro por ejercicio (mini-bloque embebido en el horario)
// Los handlers llaman a funciones globales de index.html que existen en
// runtime; se referencian como string en los atributos inline para no crear
// una dependencia cíclica hacia la capa de Drive.
// ---------------------------------------------------------------------------

const ESFUERZO_OPCIONES = [
  { v: '',   label: 'RPE' },
  { v: '6',  label: '6' },
  { v: '7',  label: '7' },
  { v: '8',  label: '8' },
  { v: '9',  label: '9' },
  { v: '10', label: '10' },
];

function renderEjRegistroHTML(
  storage: Storage,
  fecha: string,
  patron: string,
  nombre: string,
): string {
  // Leer el registro ya guardado para pre-rellenar los campos
  const reg = getRegistroEj(storage, fecha, patron, nombre) ?? ({} as Partial<import('../types/schema').RegistroEjercicio>);
  const sid = slugify(`${patron}-${nombre}`);
  const patronEsc = escapeHtml(patron);
  const nombreEsc = escapeHtml(nombre).replace(/'/g, "\\'");
  const opts = ESFUERZO_OPCIONES.map(o =>
    `<option value="${o.v}"${String(reg.rpe ?? '') === o.v ? ' selected' : ''}>${o.label}</option>`,
  ).join('');
  return `<div class="ej-reg">
    <div class="ej-reg-grid">
      <div class="ej-reg-field"><label>carga kg</label><input class="ej-reg-input" type="number" inputmode="decimal" value="${reg.carga_kg != null ? reg.carga_kg : ''}" onchange="setRegistroEj('${patronEsc}','${nombreEsc}','carga',this.value)"></div>
      <div class="ej-reg-field"><label>reps</label><input class="ej-reg-input" type="number" inputmode="numeric" value="${reg.reps_reales != null ? reg.reps_reales : ''}" onchange="setRegistroEj('${patronEsc}','${nombreEsc}','reps',this.value)"></div>
      <div class="ej-reg-field"><label>series</label><input class="ej-reg-input" type="number" inputmode="numeric" value="${reg.series_reales != null ? reg.series_reales : ''}" onchange="setRegistroEj('${patronEsc}','${nombreEsc}','series',this.value)"></div>
      <div class="ej-reg-field"><label>RPE</label><select class="ej-reg-input" onchange="setRegistroEj('${patronEsc}','${nombreEsc}','rpe',this.value)">${opts}</select></div>
      <span class="ej-reg-done" data-ejreg-badge="${sid}">${reg.completado ? '✓ registrado' : ''}</span>
    </div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Render de calentamiento (inline, no depende de ui/fuerza)
// ---------------------------------------------------------------------------

function renderWarmupHTML(cal: Calentamiento, colapsado: boolean): string {
  const pasosFull = (cal.pasos ?? []).map((p: PasoCalentamiento) => {
    const params = p.series && p.reps ? `${p.series}×${p.reps} ${kbUnidadLabel(p.unidad)}` : '';
    const ficha = fichaLinkHTML(p.ficha, p.nombre);
    return `<div class="hd-step"><span class="hd-nombre">${escapeHtml(p.nombre)}${p.detalle ? `<small>${escapeHtml(p.detalle)}</small>` : ''}</span><span class="hd-params">${escapeHtml(params)}</span></div>${ficha ? `<div class="hd-ficha-row">${ficha}</div>` : ''}`;
  }).join('');
  const resumen = (cal.pasos ?? []).map(p => p.nombre).join(' → ');
  return `<div class="hd-warmup${colapsado ? ' colapsado' : ''}" onclick="this.classList.toggle('colapsado')">
    <div class="hd-warmup-title">🔥 ${escapeHtml(cal.nombre ?? 'Calentamiento')}${colapsado ? ' · ya calentaste — toca para ver' : ''}</div>
    ${cal.nota ? `<div class="hd-warmup-nota">${escapeHtml(cal.nota)}</div>` : ''}
    ${pasosFull}
    <div class="hd-warmup-resumen">${escapeHtml(resumen)}</div>
  </div>`;
}

// ---------------------------------------------------------------------------
// Render de fila de ejercicio de fuerza (inline, no depende de ui/fuerza)
// ---------------------------------------------------------------------------

function renderEjFilaHTML(
  storage: Storage,
  fecha: string,
  ej: Ejercicio,
  patronId?: string,
): string {
  const params = `${ej.series}×${ej.reps} ${kbUnidadLabel(ej.unidad)}`;
  const ficha = fichaLinkHTML(ej.ficha, ej.nombre);
  const nota = ej.nota ? `<div class="kb-ej-nota">${escapeHtml(ej.nota)}</div>` : '';
  let regHTML = '';
  if (patronId) {
    const rid = `hoyreg-${slugify(`${patronId}-${ej.nombre}`)}`;
    regHTML = `<div class="hd-ficha-row"><button class="ej-reg-toggle" onclick="var b=document.getElementById('${rid}');b.style.display=b.style.display==='block'?'none':'block'">📝 Registrar</button></div><div id="${rid}" style="display:none">${renderEjRegistroHTML(storage, fecha, patronId, ej.nombre)}</div>`;
  }
  return `<div class="hd-ej"><span class="hd-nombre">${escapeHtml(ej.nombre)} ${tierBadge(ej.tier)}</span><span class="hd-params">${escapeHtml(params)}</span></div>${nota}${ficha ? `<div class="hd-ficha-row">${ficha}</div>` : ''}${regHTML}`;
}

function renderPoolEjerciciosHTML(
  storage: Storage,
  fecha: string,
  cat: Categoria,
  data: RutinaSalud,
): string {
  if (!cat.pool) return '';
  const ent = data.entrenamiento!;
  const mcIdx = microcicloIdx(ent, data.meta.fecha_inicio_programa);
  const sel = seleccionarEjercicios(cat, mcIdx);
  let html = sel.elegidos.map(ej => renderEjFilaHTML(storage, fecha, ej, cat.id)).join('');
  if (sel.avanzados.length) {
    html += `<div class="opt-avanzado" onclick="this.classList.toggle('open')"><div class="opt-avanzado-head">＋ Opción avanzada (solo si el hombro lo tolera)</div><div class="opt-avanzado-body">${sel.avanzados.map(ej => renderEjFilaHTML(storage, fecha, ej)).join('')}</div></div>`;
  }
  return html;
}

// ---------------------------------------------------------------------------
// Render de ejercicios de pies (inline, no depende de ui/pies)
// ---------------------------------------------------------------------------

function renderPiesEjerciciosHoyHTML(fase: FasePies, cat: Categoria): string {
  const ejs = ejerciciosDeFase(fase, cat);
  if (!ejs.length) return '<div class="empty-hint">Sin ejercicios definidos.</div>';
  return ejs.map(ej => {
    const params = `${ej.series}×${ej.reps} ${kbUnidadLabel(ej.unidad)}`;
    const ficha = fichaLinkHTML(ej.ficha, ej.nombre);
    return `<div class="hd-ej"><span class="hd-nombre">${escapeHtml(ej.nombre)}</span><span class="hd-params">${escapeHtml(params)}</span></div>${ficha ? `<div class="hd-ficha-row">${ficha}</div>` : ''}`;
  }).join('');
}

// ---------------------------------------------------------------------------
// Helpers de horario
// ---------------------------------------------------------------------------

function computeNextIdx(items: HorarioItem[]): number {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  let nextIdx = -1;
  items.forEach((item, idx) => {
    const [h, m] = item.hora.split(':').map(Number);
    if ((h! * 60 + m!) > nowMins && nextIdx === -1) nextIdx = idx;
  });
  return nextIdx;
}

function getCategoria(data: RutinaSalud, catId: string): Categoria | null {
  return data.entrenamiento?.categorias.find(c => c.id === catId) ?? null;
}

function getCalentamiento(data: RutinaSalud, id: string | undefined): Calentamiento | null {
  if (!id) return null;
  return data.entrenamiento?.calentamientos.find(c => c.id === id) ?? null;
}

// ---------------------------------------------------------------------------
// renderHorario
// ---------------------------------------------------------------------------

export interface RenderHorarioResult {
  nextOpenSlots: Set<number>;
}

/**
 * Renderiza `#horario-list` con todos los ítems del horario diario.
 *
 * @param data - Plan cargado desde Drive.
 * @param storage - Implementación de Storage (localStorage en navegador).
 * @param openSlots - Conjunto de índices cuyo detalle está expandido.
 * @param firstRender - Si es true, pre-abre el slot "próximo" automáticamente.
 * @param onTabActivate - Callback para navegar a otra pestaña desde los links internos.
 * @returns nextOpenSlots — el Set actualizado tras el render (por si firstRender añadió uno).
 */
export function renderHorario(
  data: RutinaSalud,
  storage: Storage,
  openSlots: Set<number>,
  firstRender: boolean,
  onTabActivate: (tab: string) => void,
): RenderHorarioResult {
  const container = document.getElementById('horario-list');
  if (!container) return { nextOpenSlots: openSlots };

  container.innerHTML = '';
  const fecha = today();
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const nextIdx = computeNextIdx(data.horarios_diarios);

  // En el primer render pre-abre el slot "próximo" para orientar al usuario
  if (firstRender && nextIdx !== -1) {
    openSlots.add(nextIdx);
  }

  // Índice del primer slot de fuerza (para colapsar el warmup en el resto)
  let primerFuerzaIdx = -1;
  data.horarios_diarios.forEach((item, idx) => {
    if (item.categoria && item.categoria !== 'pies' && primerFuerzaIdx === -1) {
      primerFuerzaIdx = idx;
    }
  });

  let rotativoCounter = 0;
  const diaHoy = todayDayName();

  data.horarios_diarios.forEach((item, idx) => {
    const [h, m] = item.hora.split(':').map(Number);
    const itemMins = h! * 60 + m!;
    const isPast = itemMins < nowMins;
    const isNext = idx === nextIdx;
    const color = getPilarColor(data.pilares, item.pilar);

    // Resolver categoría del slot (puede ser rotativa)
    let catId: string | null = null;
    if (item.categoria === 'rotativo') {
      catId = resolverCategoriaSlot(
        item.categoria,
        rotativoCounter,
        data.entrenamiento?.rotacion_semanal ?? [],
        diaHoy,
      );
      rotativoCounter++;
    } else if (item.categoria) {
      catId = item.categoria;
    }

    const cat = catId ? getCategoria(data, catId) : null;
    const isPies = catId === 'pies';
    const isRehab = item.pilar === 'rehab' && !cat;
    const expandable = !!cat || isRehab;

    const checkId = item.check ?? null;
    const done = checkId ? isChecked(storage, fecha, checkId) : false;

    const badgeLabel = cat
      ? (cat.nombre.split('/')[0] ?? cat.nombre).trim()
      : item.pilar.split('-').pop() ?? item.pilar;
    const badgeColor = cat ? cat.color : color;

    // Contenedor de la fila
    const wrap = document.createElement('div');
    wrap.className = 'horario-row-wrap';
    wrap.dataset['idx'] = String(idx);

    // Fila principal
    const row = document.createElement('div');
    row.className = [
      'horario-item',
      isPast ? 'pasado' : '',
      isNext ? 'proximo' : '',
      expandable ? 'expandable' : '',
      done ? 'done' : '',
    ].filter(Boolean).join(' ');

    // innerHTML construido solo con datos escapados
    row.innerHTML = `
      ${checkId
        ? `<div class="horario-check ${done ? 'done' : ''}" data-check="${escapeHtml(checkId)}">${done ? '✓' : ''}</div>`
        : '<div class="horario-check placeholder"></div>'
      }
      <span class="horario-hora">${escapeHtml(item.hora)}</span>
      <span class="horario-tarea">${escapeHtml(item.tarea)}</span>
      ${isNext ? '<span class="proximo-label">PRÓXIMO</span>' : ''}
      <span class="horario-badge" style="color:${escapeHtml(badgeColor)};border-color:${escapeHtml(badgeColor)}20;background:${escapeHtml(badgeColor)}15">${escapeHtml(badgeLabel)}</span>
      ${expandable ? '<span class="horario-chevron">▶</span>' : ''}
    `;

    // Listener del check: no propaga para no abrir/cerrar el detalle
    if (checkId) {
      const cb = row.querySelector<HTMLElement>('.horario-check');
      cb?.addEventListener('click', e => {
        e.stopPropagation();
        toggleCheck(storage, fecha, checkId);
        // Re-render del horario completo (misma lógica que el original)
        renderHorario(data, storage, openSlots, false, onTabActivate);
        // updateProgress lo llamará el caller al recibir el resultado —
        // aquí disparamos el evento custom para que main.ts lo escuche
        document.dispatchEvent(new CustomEvent('salud:progress-update'));
      });
    }

    wrap.appendChild(row);

    // Detalle expandible
    if (expandable) {
      const det = document.createElement('div');
      det.className = 'horario-detalle';

      if (cat && isPies) {
        const pp = data.entrenamiento ? getPiesProtocolo(data.entrenamiento) : null;
        const piesCat = data.entrenamiento ? getPiesCategoria(data.entrenamiento) : null;
        const fase = pp ? faseActual(pp) : null;
        let html = '';
        html += `<div class="hd-block-label">${escapeHtml(cat.nombre)}${fase ? ` · ${escapeHtml(fase.nombre)}` : ''}</div>`;
        if (cat.objetivo) html += `<div class="cat-objetivo">${escapeHtml(cat.objetivo)}</div>`;
        if (fase && piesCat) html += renderPiesEjerciciosHoyHTML(fase, piesCat);
        html += `<div class="hd-rehab-link" onclick="event.stopPropagation()">Ver protocolo de pies y fases →</div>`;
        det.innerHTML = html;
        // Navegación via listener seguro (sin inyección en onclick)
        const link = det.querySelector<HTMLElement>('.hd-rehab-link');
        link?.addEventListener('click', e => { e.stopPropagation(); onTabActivate('pies'); });

      } else if (cat) {
        const cal = getCalentamiento(data, cat.calentamiento);
        const colapsado = idx !== primerFuerzaIdx;
        let html = '';
        if (cal) html += renderWarmupHTML(cal, colapsado);
        html += `<div class="hd-block-label">${escapeHtml(cat.nombre)}</div>`;
        if (cat.objetivo) html += `<div class="cat-objetivo">${escapeHtml(cat.objetivo)}</div>`;
        html += renderPoolEjerciciosHTML(storage, fecha, cat, data);
        html += `<div class="hd-rehab-link" onclick="event.stopPropagation()">Ver el patrón completo / cambiar ejercicio →</div>`;
        det.innerHTML = html;
        const link = det.querySelector<HTMLElement>('.hd-rehab-link');
        link?.addEventListener('click', e => { e.stopPropagation(); onTabActivate('fuerza'); });

      } else if (isRehab) {
        det.innerHTML = `<div class="hd-rehab-link">Abrir la sesión de hoy en Rehab →</div>`;
        const link = det.querySelector<HTMLElement>('.hd-rehab-link');
        link?.addEventListener('click', e => { e.stopPropagation(); onTabActivate('rehab'); });
      }

      wrap.appendChild(det);

      if (openSlots.has(idx)) wrap.classList.add('open');

      row.addEventListener('click', () => {
        wrap.classList.toggle('open');
        if (wrap.classList.contains('open')) openSlots.add(idx);
        else openSlots.delete(idx);
      });
    }

    container.appendChild(wrap);
  });

  return { nextOpenSlots: openSlots };
}

// ---------------------------------------------------------------------------
// refreshHorarioHighlight
// ---------------------------------------------------------------------------

/**
 * Actualiza solo las clases `pasado`/`proximo` y la etiqueta "PRÓXIMO"
 * sin re-renderizar el DOM completo. Se llama cada minuto.
 */
export function refreshHorarioHighlight(data: RutinaSalud): void {
  const container = document.getElementById('horario-list');
  if (!container) return;

  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const nextIdx = computeNextIdx(data.horarios_diarios);

  container.querySelectorAll<HTMLElement>('.horario-row-wrap').forEach(wrap => {
    const idx = Number(wrap.dataset['idx']);
    const item = data.horarios_diarios[idx];
    if (!item) return;

    const [h, m] = item.hora.split(':').map(Number);
    const itemMins = h! * 60 + m!;
    const row = wrap.querySelector<HTMLElement>('.horario-item');
    if (!row) return;

    row.classList.toggle('pasado', itemMins < nowMins);
    const isNext = idx === nextIdx;
    row.classList.toggle('proximo', isNext);

    let label = row.querySelector<HTMLElement>('.proximo-label');
    if (isNext && !label) {
      label = document.createElement('span');
      label.className = 'proximo-label';
      label.textContent = 'PRÓXIMO';
      const tarea = row.querySelector('.horario-tarea');
      if (tarea?.nextSibling) row.insertBefore(label, tarea.nextSibling);
      else row.appendChild(label);
    } else if (!isNext && label) {
      label.remove();
    }
  });
}

// ---------------------------------------------------------------------------
// renderSinHora
// ---------------------------------------------------------------------------

/**
 * Renderiza `#sinhora-list` con los ítems del `checklist_diario` que tienen
 * `sin_hora: true`. `onToggle` se llama tras cada toggle para que el caller
 * actualice la barra de progreso.
 */
export function renderSinHora(
  data: RutinaSalud,
  storage: Storage,
  onToggle: () => void,
): void {
  const container = document.getElementById('sinhora-list');
  if (!container) return;

  container.innerHTML = '';
  const fecha = today();
  const items = (data.checklist_diario ?? []).filter(i => i.sin_hora);
  if (items.length === 0) return;

  const labelEl = document.createElement('div');
  labelEl.className = 'sinhora-label';
  labelEl.textContent = 'Durante el día';
  container.appendChild(labelEl);

  items.forEach(item => {
    const el = document.createElement('div');
    el.className = `check-item${isChecked(storage, fecha, item.id) ? ' done' : ''}`;
    el.dataset['id'] = item.id;

    const color = getPilarColor(data.pilares, item.pilar);
    const done = isChecked(storage, fecha, item.id);
    // Datos externos escapados antes de inyectar en innerHTML
    el.innerHTML = `<div class="check-box">${done ? '✓' : ''}</div><span class="check-label">${escapeHtml(item.label)}</span><span class="check-pilar-dot" style="background:${escapeHtml(color)}"></span>`;

    el.addEventListener('click', () => {
      toggleCheck(storage, fecha, item.id);
      renderSinHora(data, storage, onToggle);
      onToggle();
    });

    container.appendChild(el);
  });
}

// ---------------------------------------------------------------------------
// renderRecordatorio
// ---------------------------------------------------------------------------

/**
 * Renderiza `#recordatorio-hoy` con el recordatorio del día de hoy,
 * o oculta `#recordatorio-hoy-card` si no hay ninguno.
 */
export function renderRecordatorio(data: RutinaSalud): void {
  const card = document.getElementById('recordatorio-hoy-card');
  const container = document.getElementById('recordatorio-hoy');

  if (!data.recordatorios_semanales) {
    if (card) card.style.display = 'none';
    return;
  }

  const dia = todayDayName();
  const rec = data.recordatorios_semanales.find(r => r.dia === dia);

  if (rec && container) {
    // Capitaliza el nombre del día sin inyectar HTML sin escapar
    const diaCapitalizado = rec.dia.charAt(0).toUpperCase() + rec.dia.slice(1);
    container.innerHTML = `<div class="recordatorio-card"><div class="recordatorio-dia">${escapeHtml(diaCapitalizado)}</div>${escapeHtml(rec.mensaje)}</div>`;
  } else if (card) {
    card.style.display = 'none';
  }
}
