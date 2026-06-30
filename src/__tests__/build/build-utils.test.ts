import { describe, it, expect } from 'vitest';

// Importación dinámica del módulo .mjs — tipos en build-utils.d.ts
const { generateIconSvg, resolveManifestIcons, injectIconsIntoManifest, hashFile, injectSwVersion } =
  await import('../../../scripts/build-utils.mjs' as string) as typeof import('../../../scripts/build-utils.d.ts');

// ---------------------------------------------------------------------------
// generateIconSvg
// ---------------------------------------------------------------------------

describe('generateIconSvg', () => {
  it('devuelve un SVG válido con el tamaño correcto', () => {
    const svg = generateIconSvg(192) as string;
    expect(svg).toContain('width="192"');
    expect(svg).toContain('height="192"');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('incluye el color de fondo correcto', () => {
    const svg = generateIconSvg(192) as string;
    expect(svg).toContain('fill="#0f0f1a"');
  });

  it('el rx es proporcional al tamaño', () => {
    const svg192 = generateIconSvg(192) as string;
    const svg512 = generateIconSvg(512) as string;
    expect(svg192).toContain(`rx="${Math.round(192 * 0.18)}"`);
    expect(svg512).toContain(`rx="${Math.round(512 * 0.18)}"`);
  });

  it('el font-size es proporcional al tamaño', () => {
    const svg = generateIconSvg(192) as string;
    expect(svg).toContain(`font-size="${Math.round(192 * 0.55)}"`);
  });

  it('produce SVG bien formado (abre y cierra <svg>)', () => {
    const svg = generateIconSvg(512) as string;
    expect(svg.trimStart()).toMatch(/^<svg /);
    expect(svg.trimEnd()).toMatch(/<\/svg>$/);
  });
});

// ---------------------------------------------------------------------------
// resolveManifestIcons
// ---------------------------------------------------------------------------

describe('resolveManifestIcons', () => {
  it('usa PNG cuando hasPng devuelve true', () => {
    const icons = resolveManifestIcons([192, 512], () => true) as Array<Record<string, string>>;
    expect(icons).toHaveLength(2);
    expect(icons[0]!.src).toBe('icons/icon-192.png');
    expect(icons[0]!.type).toBe('image/png');
    expect(icons[1]!.src).toBe('icons/icon-512.png');
  });

  it('usa SVG cuando hasPng devuelve false', () => {
    const icons = resolveManifestIcons([192, 512], () => false) as Array<Record<string, string>>;
    expect(icons[0]!.src).toBe('icons/icon-192.svg');
    expect(icons[0]!.type).toBe('image/svg+xml');
    expect(icons[1]!.src).toBe('icons/icon-512.svg');
  });

  it('mezcla PNG y SVG según el predicado', () => {
    const icons = resolveManifestIcons([192, 512], (size: number) => size === 192) as Array<Record<string, string>>;
    expect(icons[0]!.type).toBe('image/png');
    expect(icons[1]!.type).toBe('image/svg+xml');
  });

  it('el campo sizes coincide con el tamaño', () => {
    const icons = resolveManifestIcons([192, 512], () => false) as Array<Record<string, string>>;
    expect(icons[0]!.sizes).toBe('192x192');
    expect(icons[1]!.sizes).toBe('512x512');
  });

  it('purpose es "any maskable"', () => {
    const icons = resolveManifestIcons([192], () => true) as Array<Record<string, string>>;
    expect(icons[0]!.purpose).toBe('any maskable');
  });
});

// ---------------------------------------------------------------------------
// injectIconsIntoManifest
// ---------------------------------------------------------------------------

describe('injectIconsIntoManifest', () => {
  const baseManifest = {
    name: 'Rutina Salud',
    start_url: '/salud-dashboard/',
    icons: [{ src: 'old.png', sizes: '192x192', type: 'image/png' }],
  };

  it('sustituye los iconos del manifest', () => {
    const newIcons = [{ src: 'icons/icon-192.svg', sizes: '192x192', type: 'image/svg+xml', purpose: 'any maskable' }];
    const result = injectIconsIntoManifest(baseManifest, newIcons) as typeof baseManifest & { icons: typeof newIcons };
    expect(result.icons).toEqual(newIcons);
  });

  it('conserva el resto de campos intactos', () => {
    const newIcons = [] as unknown[];
    const result = injectIconsIntoManifest(baseManifest, newIcons) as typeof baseManifest;
    expect(result.name).toBe('Rutina Salud');
    expect(result.start_url).toBe('/salud-dashboard/');
  });

  it('no muta el manifest original', () => {
    const original = { ...baseManifest, icons: [...baseManifest.icons] };
    injectIconsIntoManifest(baseManifest, []);
    expect(baseManifest.icons).toEqual(original.icons);
  });
});

// ---------------------------------------------------------------------------
// Regresión: index.html referencia "bundle.js" no "dist/bundle.js"
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// hashFile
// ---------------------------------------------------------------------------

import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';

describe('hashFile', () => {
  it('devuelve exactamente 8 caracteres hex', () => {
    const tmp = join(tmpdir(), `test-hash-${Date.now()}.txt`);
    writeFileSync(tmp, 'hola mundo', 'utf-8');
    const h = hashFile(tmp) as string;
    unlinkSync(tmp);
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });

  it('mismo contenido → mismo hash (determinista)', () => {
    const tmp1 = join(tmpdir(), `test-hash-a-${Date.now()}.txt`);
    const tmp2 = join(tmpdir(), `test-hash-b-${Date.now()}.txt`);
    writeFileSync(tmp1, 'contenido igual', 'utf-8');
    writeFileSync(tmp2, 'contenido igual', 'utf-8');
    const h1 = hashFile(tmp1) as string;
    const h2 = hashFile(tmp2) as string;
    unlinkSync(tmp1); unlinkSync(tmp2);
    expect(h1).toBe(h2);
  });

  it('contenido distinto → hash distinto', () => {
    const tmp1 = join(tmpdir(), `test-hash-c-${Date.now()}.txt`);
    const tmp2 = join(tmpdir(), `test-hash-d-${Date.now()}.txt`);
    writeFileSync(tmp1, 'contenido A', 'utf-8');
    writeFileSync(tmp2, 'contenido B', 'utf-8');
    const h1 = hashFile(tmp1) as string;
    const h2 = hashFile(tmp2) as string;
    unlinkSync(tmp1); unlinkSync(tmp2);
    expect(h1).not.toBe(h2);
  });

  it('coincide con SHA-256 manual de los mismos bytes', () => {
    const tmp = join(tmpdir(), `test-hash-e-${Date.now()}.txt`);
    const content = 'verificación manual';
    writeFileSync(tmp, content, 'utf-8');
    const expected = createHash('sha256').update(readFileSync(tmp)).digest('hex').slice(0, 8);
    const actual = hashFile(tmp) as string;
    unlinkSync(tmp);
    expect(actual).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// injectSwVersion
// ---------------------------------------------------------------------------

describe('injectSwVersion', () => {
  it('reemplaza __CACHE_VERSION__ con la versión dada', () => {
    const sw = `const CACHE_NAME = 'salud-__CACHE_VERSION__';`;
    expect(injectSwVersion(sw, 'abc12345')).toBe(`const CACHE_NAME = 'salud-abc12345';`);
  });

  it('no modifica el resto del contenido', () => {
    const sw = `const CACHE_NAME = 'salud-__CACHE_VERSION__';\nconst X = 1;`;
    const result = injectSwVersion(sw, 'ff001122') as string;
    expect(result).toContain('const X = 1;');
  });

  it('el placeholder original no aparece en el resultado', () => {
    const sw = `const CACHE_NAME = 'salud-__CACHE_VERSION__';`;
    const result = injectSwVersion(sw, 'deadbeef') as string;
    expect(result).not.toContain('__CACHE_VERSION__');
  });

  it('el sw.js fuente contiene el placeholder (si falta, el build no inyecta nada)', () => {
    const srcDir = join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), '../../..');
    const swSource = readFileSync(join(srcDir, 'sw.js'), 'utf-8');
    expect(swSource).toContain('__CACHE_VERSION__');
  });

  it('sw.js fuente contiene skipWaiting', () => {
    const srcDir = join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), '../../..');
    const swSource = readFileSync(join(srcDir, 'sw.js'), 'utf-8');
    expect(swSource).toContain('skipWaiting');
  });

  it('injectSwVersion elimina el placeholder del contenido del sw fuente', () => {
    const srcDir = join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), '../../..');
    const swSource = readFileSync(join(srcDir, 'sw.js'), 'utf-8');
    const result = injectSwVersion(swSource, 'abc12345') as string;
    expect(result).not.toContain('__CACHE_VERSION__');
    expect(result).toContain('salud-abc12345');
  });
});

// ---------------------------------------------------------------------------
// Regresión: index.html asset paths
// ---------------------------------------------------------------------------

describe('index.html asset paths', () => {
  const srcDir = join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), '../../..');
  const html = readFileSync(join(srcDir, 'index.html'), 'utf-8');

  it('no referencia dist/bundle.js (causaría 404 en Pages)', () => {
    expect(html).not.toContain('src="dist/bundle.js"');
  });

  it('referencia bundle.js directamente', () => {
    expect(html).toContain('src="bundle.js"');
  });
});
