import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { decodeBase64Utf8, driveSearch, driveDownload, _setTokenForTesting } from '../../core/drive';

// ---------------------------------------------------------------------------
// decodeBase64Utf8
// ---------------------------------------------------------------------------

describe('decodeBase64Utf8', () => {
  it('decodifica ASCII básico', () => {
    const b64 = btoa('hello world');
    expect(decodeBase64Utf8(b64)).toBe('hello world');
  });

  it('decodifica UTF-8 correctamente (tildes, ñ)', () => {
    const text = 'Rodilla · rehabilitación · ñoño';
    const bytes = new TextEncoder().encode(text);
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    const b64 = btoa(binary);
    expect(decodeBase64Utf8(b64)).toBe(text);
  });

  it('decodifica JSON de Drive simulado', () => {
    const json = JSON.stringify({ meta: { version: '1.0' }, pilares: [] });
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    bytes.forEach(b => { binary += String.fromCharCode(b); });
    const b64 = btoa(binary);
    expect(JSON.parse(decodeBase64Utf8(b64))).toEqual({ meta: { version: '1.0' }, pilares: [] });
  });
});

// ---------------------------------------------------------------------------
// Regresión: ninguna query de Drive debe usar sintaxis v2 (title =)
// Drive v3 usa "name" — "title" solo existe en v2 y devuelve 400 Invalid Value.
// ---------------------------------------------------------------------------

function collectTsFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      results.push(...collectTsFiles(full));
    } else if (entry.endsWith('.ts') && !entry.endsWith('.test.ts')) {
      results.push(full);
    }
  }
  return results;
}

describe('Drive API v3 query syntax', () => {
  const srcDir = join(new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), '../../..');
  const files = collectTsFiles(join(srcDir, 'src'));

  it('ningún archivo usa "title =" en queries de Drive (debe ser "name =")', () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      // Busca el patrón dentro de strings que parezcan queries de Drive
      const matches = [...content.matchAll(/driveSearch\([^)]*title\s*=/g)];
      if (matches.length > 0) {
        violations.push(`${file}: ${matches.map(m => m[0]).join(', ')}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('ningún archivo usa "title contains" en queries de Drive (debe ser "name contains")', () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      const matches = [...content.matchAll(/driveSearch\([^)]*title\s+contains/g)];
      if (matches.length > 0) {
        violations.push(`${file}: ${matches.map(m => m[0]).join(', ')}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('orderBy no usa espacio sin encodear (debe ser + o estar en parámetro separado)', () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      // Detecta "orderBy=modifiedTime desc" con espacio literal en una URL string
      const matches = [...content.matchAll(/orderBy=\w+\s+\w+/g)];
      if (matches.length > 0) {
        violations.push(`${file}: ${matches.map(m => m[0]).join(', ')}`);
      }
    }
    expect(violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// driveSearch (browser mode) — fetch mockeado con vi.stubGlobal
// ---------------------------------------------------------------------------

describe('driveSearch (browser mode)', () => {
  let capturedUrl: string;
  let capturedHeaders: Record<string, string>;

  beforeEach(() => {
    // Establece un token falso para que driveFetch no lance "Sin sesión"
    _setTokenForTesting('test-token-123');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    _setTokenForTesting(null);
  });

  it('lanza "Sin sesión" cuando no hay token', async () => {
    _setTokenForTesting(null);
    // fetch nunca se llama, pero lo mockeamos para que no falle si se llamara
    vi.stubGlobal('fetch', vi.fn());
    await expect(driveSearch("name = 'rutina-salud.json'")).rejects.toThrow('Sin sesión');
  });

  it('construye la URL correcta con q= y fields= y Authorization', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string, opts?: RequestInit) => {
      capturedUrl = url;
      capturedHeaders = (opts?.headers ?? {}) as Record<string, string>;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ files: [] }),
      });
    }));

    await driveSearch("name = 'rutina-salud.json'");

    // q= debe contener la query encodeada
    const urlObj = new URL(capturedUrl);
    expect(urlObj.searchParams.get('q')).toBe("name = 'rutina-salud.json'");

    // fields debe incluir id, name, modifiedTime, webViewLink
    const fields = urlObj.searchParams.get('fields') ?? '';
    expect(fields).toContain('id');
    expect(fields).toContain('name');
    expect(fields).toContain('modifiedTime');
    expect(fields).toContain('webViewLink');

    // Header Authorization con Bearer
    expect(capturedHeaders['Authorization']).toBe('Bearer test-token-123');
  });

  it('mapea name → title en el resultado', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          files: [{ id: 'abc', name: 'rutina-salud.json', modifiedTime: '2024-01-01' }],
        }),
      }),
    ));

    const result = await driveSearch("name = 'rutina-salud.json'");

    expect(result.files).toHaveLength(1);
    const first = result.files[0]!;
    expect(first).toMatchObject({
      id: 'abc',
      title: 'rutina-salud.json',
      modifiedTime: '2024-01-01',
    });
    // La propiedad "name" no debe aparecer en el objeto resultado
    expect((first as unknown as Record<string, unknown>)['name']).toBeUndefined();
  });

  it('lanza error "Sesión expirada" en 401', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      }),
    ));

    await expect(driveSearch("name = 'test.json'")).rejects.toThrow('Sesión expirada');
  });

  it('lanza error "Drive API 400" en 400', async () => {
    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({
        ok: false,
        status: 400,
        text: () => Promise.resolve(JSON.stringify({ error: { message: 'Invalid Value' } })),
      }),
    ));

    await expect(driveSearch("name = 'test.json'")).rejects.toThrow('Drive API 400');
  });
});

// ---------------------------------------------------------------------------
// driveDownload (browser mode) — fetch mockeado con vi.stubGlobal
// ---------------------------------------------------------------------------

describe('driveDownload (browser mode)', () => {
  beforeEach(() => {
    _setTokenForTesting('test-token-456');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    _setTokenForTesting(null);
  });

  it('devuelve el base64 correcto de los bytes UTF-8 de "hola"', async () => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode('hola');
    const buf = bytes.buffer as ArrayBuffer;

    vi.stubGlobal('fetch', vi.fn(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(buf),
      }),
    ));

    const result = await driveDownload('file-id-xyz');

    // Calculamos el base64 esperado de los bytes de "hola"
    let binary = '';
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
    const expectedB64 = btoa(binary);

    expect(result.content).toBe(expectedB64);
  });
});
