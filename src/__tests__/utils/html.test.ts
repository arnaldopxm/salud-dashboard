import { describe, it, expect } from 'vitest';
import { escapeHtml, slugify, fichaSlug, fichaHref, fichaLinkHTML } from '../../utils/html';

describe('escapeHtml', () => {
  it('escapes ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes < and >', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes double quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
  });

  it('handles non-string input by converting to string', () => {
    expect(escapeHtml(42)).toBe('42');
    expect(escapeHtml(null)).toBe('null');
  });

  it('leaves safe strings untouched', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('escapes all dangerous chars in one string', () => {
    expect(escapeHtml('<a href="x&y">z</a>')).toBe('&lt;a href=&quot;x&amp;y&quot;&gt;z&lt;/a&gt;');
  });
});

describe('slugify', () => {
  it('lowercases and replaces spaces with hyphens', () => {
    expect(slugify('Hola Mundo')).toBe('hola-mundo');
  });

  it('strips accents', () => {
    expect(slugify('Extensión de cadera')).toBe('extension-de-cadera');
  });

  it('collapses multiple non-alphanumeric chars', () => {
    expect(slugify('a -- b  c')).toBe('a-b-c');
  });

  it('trims leading and trailing hyphens', () => {
    expect(slugify('  -hello- ')).toBe('hello');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('handles special characters like ñ', () => {
    expect(slugify('rotación')).toBe('rotacion');
  });
});

describe('fichaSlug', () => {
  it('extracts slug from wikilink [[slug]]', () => {
    expect(fichaSlug('[[mi-ficha]]', 'nombre')).toBe('mi-ficha');
  });

  it('extracts slug from wikilink with alias [[slug|alias]]', () => {
    expect(fichaSlug('[[mi-ficha|Nombre Bonito]]', 'nombre')).toBe('mi-ficha');
  });

  it('returns raw string if not a wikilink', () => {
    expect(fichaSlug('remo-con-banda', 'nombre')).toBe('remo-con-banda');
  });

  it('falls back to slugified nombre when ficha is empty', () => {
    expect(fichaSlug('', 'Remo con Banda')).toBe('remo-con-banda');
  });

  it('returns empty string when both are empty', () => {
    expect(fichaSlug('', '')).toBe('');
  });

  it('trims whitespace from wikilink', () => {
    expect(fichaSlug('[[ mi-ficha ]]', 'nombre')).toBe('mi-ficha');
  });
});

describe('fichaHref', () => {
  it('builds an obsidian:// URI with vault and file', () => {
    const href = fichaHref('remo-con-banda');
    expect(href).toContain('obsidian://open');
    expect(href).toContain('vault=VAULT');
    expect(href).toContain('file=remo-con-banda');
  });

  it('encodes special characters in the slug', () => {
    const href = fichaHref('ejercicio con espacios');
    expect(href).toContain('ejercicio%20con%20espacios');
  });
});

describe('fichaLinkHTML', () => {
  it('returns empty string when slug resolves to empty', () => {
    expect(fichaLinkHTML('', '')).toBe('');
  });

  it('returns a button with the slug when ficha is provided', () => {
    const html = fichaLinkHTML('[[mi-ficha]]', 'nombre');
    expect(html).toContain('mi-ficha');
    expect(html).toContain('<button');
    expect(html).toContain('abrirFicha');
  });

  it('uses slugified nombre as fallback', () => {
    const html = fichaLinkHTML(undefined, 'Remo con Banda');
    expect(html).toContain('remo-con-banda');
  });
});
