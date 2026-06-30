// ---------------------------------------------------------------------------
// Gestión del sistema de pestañas
// ---------------------------------------------------------------------------

/**
 * Activa una pestaña: quita `active` de todos los botones y paneles,
 * y lo añade al botón y al panel que corresponden a `tabName`.
 * Si la pestaña es `rehab` llama a `onRehabActivate` (si se pasa).
 */
export function activateTab(tabName: string, onRehabActivate?: () => void): void {
  document.querySelectorAll<HTMLElement>('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll<HTMLElement>('.tab-panel').forEach(p => p.classList.remove('active'));

  const btn = document.querySelector<HTMLElement>(`.tab-btn[data-tab="${tabName}"]`);
  if (btn) btn.classList.add('active');

  const panel = document.getElementById(`tab-${tabName}`);
  if (panel) panel.classList.add('active');

  if (tabName === 'rehab' && onRehabActivate) {
    onRehabActivate();
  }
}

/**
 * Registra listeners en todos los `.tab-btn`. Al hacer click activa la
 * pestaña correspondiente. Cuando la pestaña es `rehab` llama a
 * `onRehabActivate` la primera vez (el caller decide si ya se cargó).
 */
export function initTabs(onRehabActivate: () => void): void {
  document.querySelectorAll<HTMLElement>('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset['tab'] ?? '';
      activateTab(tabName, onRehabActivate);
    });
  });
}
