import { describe, it, expect } from 'vitest';

// Importación dinámica del módulo .mjs (ESM puro, sin tipos TS)
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
const { generateIconSvg, resolveManifestIcons, injectIconsIntoManifest } =
  await import('../../../scripts/build-utils.mjs');

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

import { readFileSync } from 'fs';
import { join } from 'path';

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
