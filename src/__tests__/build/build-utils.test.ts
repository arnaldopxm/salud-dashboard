import { describe, it, expect } from 'vitest';
import { writeFileSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { createHash } from 'crypto';

// Importación dinámica del módulo .mjs — tipos en build-utils.d.ts.
// El `as string` evita que TS resuelva/typecheck el .mjs; el cast externo
// aporta los tipos desde el .d.ts hermano.
const { hashFile, injectSwVersion } =
  await import('../../../scripts/build-utils.mjs' as string) as typeof import('../../../scripts/build-utils.d.ts');

// Raíz del repo desde este test (…/src/__tests__/build → tres niveles arriba).
// El replace normaliza el prefijo "/C:" que devuelve pathname en Windows.
const repoRoot = join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), '../../..');

// ---------------------------------------------------------------------------
// hashFile
// ---------------------------------------------------------------------------

describe('hashFile', () => {
  it('devuelve exactamente 8 caracteres hex', () => {
    const tmp = join(tmpdir(), 'test-hash-len.txt');
    writeFileSync(tmp, 'hola mundo', 'utf-8');
    const h = hashFile(tmp);
    unlinkSync(tmp);
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });

  it('mismo contenido → mismo hash (determinista)', () => {
    const a = join(tmpdir(), 'test-hash-a.txt');
    const b = join(tmpdir(), 'test-hash-b.txt');
    writeFileSync(a, 'contenido igual', 'utf-8');
    writeFileSync(b, 'contenido igual', 'utf-8');
    const ha = hashFile(a);
    const hb = hashFile(b);
    unlinkSync(a); unlinkSync(b);
    expect(ha).toBe(hb);
  });

  it('contenido distinto → hash distinto', () => {
    const a = join(tmpdir(), 'test-hash-c.txt');
    const b = join(tmpdir(), 'test-hash-d.txt');
    writeFileSync(a, 'contenido A', 'utf-8');
    writeFileSync(b, 'contenido B', 'utf-8');
    const ha = hashFile(a);
    const hb = hashFile(b);
    unlinkSync(a); unlinkSync(b);
    expect(ha).not.toBe(hb);
  });

  it('coincide con SHA-256 manual de los mismos bytes', () => {
    const tmp = join(tmpdir(), 'test-hash-manual.txt');
    writeFileSync(tmp, 'verificación manual', 'utf-8');
    const expected = createHash('sha256').update(readFileSync(tmp)).digest('hex').slice(0, 8);
    const actual = hashFile(tmp);
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
    const result = injectSwVersion(sw, 'ff001122');
    expect(result).toContain('const X = 1;');
  });

  it('el placeholder no aparece en el resultado', () => {
    const sw = `const CACHE_NAME = 'salud-__CACHE_VERSION__';`;
    const result = injectSwVersion(sw, 'deadbeef');
    expect(result).not.toContain('__CACHE_VERSION__');
  });

  it('reemplaza TODAS las apariciones del placeholder', () => {
    const sw = `// __CACHE_VERSION__ doc\nconst X = '__CACHE_VERSION__';`;
    const result = injectSwVersion(sw, 'cafe0011');
    expect(result).not.toContain('__CACHE_VERSION__');
    expect(result).toBe(`// cafe0011 doc\nconst X = 'cafe0011';`);
  });
});

// ---------------------------------------------------------------------------
// Regresión: contrato del sw.js fuente + inyección end-to-end
// (los tests corren ANTES del build, así que NO leemos dist/ — verificamos el
// contrato sobre el sw.js fuente real y simulamos la inyección que hace build.js)
// ---------------------------------------------------------------------------

describe('sw.js: contrato de versión de cache', () => {
  const swSource = readFileSync(join(repoRoot, 'sw.js'), 'utf-8');

  it('el sw.js fuente contiene el placeholder __CACHE_VERSION__', () => {
    expect(swSource).toContain('__CACHE_VERSION__');
  });

  it('inyectar un hash deja un CACHE_NAME bien formado y sin placeholder', () => {
    const injected = injectSwVersion(swSource, 'deadbeef');
    expect(injected).not.toContain('__CACHE_VERSION__');
    expect(injected).toMatch(/const CACHE_NAME = 'salud-[0-9a-f]{8}';/);
  });
});
