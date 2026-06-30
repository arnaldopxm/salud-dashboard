const VAULT_NAME = 'VAULT';

export function escapeHtml(s: unknown): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function slugify(s: string): string {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function fichaSlug(ficha: string | undefined, nombre: string): string {
  const raw = (ficha || '').trim();
  const wikilink = raw.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/);
  if (wikilink) return wikilink[1]!.trim();
  if (raw) return raw;
  return nombre ? slugify(nombre) : '';
}

export function fichaHref(slug: string): string {
  return `obsidian://open?vault=${encodeURIComponent(VAULT_NAME)}&file=${encodeURIComponent(slug)}`;
}

export function fichaLinkHTML(ficha: string | undefined, nombre: string): string {
  const slug = fichaSlug(ficha, nombre);
  if (!slug) return '';
  return `<button type="button" class="rehab-link" onclick="abrirFicha(event,'${slug}')">📄 Copiar ficha</button>`;
}
