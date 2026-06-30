#!/usr/bin/env node
/**
 * check-drive.mjs — verifica que el flujo Drive funciona con un token real.
 *
 * Uso:
 *   node scripts/check-drive.mjs <ACCESS_TOKEN>
 *
 * Cómo obtener el token:
 *   1. Abre la app en el navegador e inicia sesión.
 *   2. Abre DevTools → Application → Local Storage  (o Network → cualquier
 *      llamada a googleapis.com → cabecera Authorization → quita "Bearer ").
 *   3. Pega el token como argumento.
 *
 * Qué verifica:
 *   1. driveSearch "name = 'rutina-salud.json'" → debe encontrar el archivo
 *   2. driveDownload del primer resultado → debe decodificar JSON válido
 *   3. Imprime meta.version y el número de pilares del plan
 */

const token = process.argv[2];
if (!token) {
  console.error('Uso: node scripts/check-drive.mjs <ACCESS_TOKEN>');
  process.exit(1);
}

const BASE = 'https://www.googleapis.com/drive/v3';

async function driveFetch(url) {
  const r = await fetch(url, {
    headers: { Authorization: 'Bearer ' + token },
  });
  if (r.status === 401) throw new Error('Token expirado o inválido (401).');
  if (!r.ok) {
    const body = await r.text();
    throw new Error(`Drive API ${r.status}: ${body.slice(0, 300)}`);
  }
  return r;
}

async function driveSearch(q) {
  const url =
    BASE + '/files?q=' + encodeURIComponent(q) +
    '&fields=' + encodeURIComponent('files(id,name,modifiedTime,webViewLink)') +
    '&pageSize=10&orderBy=modifiedTime+desc';
  const r = await driveFetch(url);
  return r.json();
}

async function driveDownload(fileId) {
  const url = BASE + '/files/' + encodeURIComponent(fileId) + '?alt=media';
  const r = await driveFetch(url);
  const buf = await r.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const b64 = Buffer.from(buf).toString('base64');
  return new TextDecoder('utf-8').decode(bytes);
}

// ── PASO 1: buscar el archivo ─────────────────────────────────────────────

console.log('\n[1] Buscando rutina-salud.json en Drive…');
let files;
try {
  const data = await driveSearch("name = 'rutina-salud.json'");
  files = data.files ?? [];
} catch (e) {
  console.error('  ✗ Error en driveSearch:', e.message);
  process.exit(1);
}

if (files.length === 0) {
  console.error('  ✗ No se encontró rutina-salud.json en Drive.');
  console.error('    Asegúrate de que el archivo existe y el token tiene scope drive.readonly.');
  process.exit(1);
}

const file = files.sort((a, b) =>
  (b.modifiedTime ?? '').localeCompare(a.modifiedTime ?? ''),
)[0];
console.log(`  ✓ Encontrado: "${file.name}" (id: ${file.id})`);
console.log(`    Modificado: ${file.modifiedTime ?? 'desconocido'}`);
if (file.webViewLink) console.log(`    Drive URL: ${file.webViewLink}`);

// ── PASO 2: descargar y parsear ───────────────────────────────────────────

console.log('\n[2] Descargando contenido…');
let json;
try {
  const text = await driveDownload(file.id);
  json = JSON.parse(text);
} catch (e) {
  console.error('  ✗ Error al descargar/parsear:', e.message);
  process.exit(1);
}

console.log('  ✓ JSON válido descargado.');

// ── PASO 3: validar estructura mínima ────────────────────────────────────

console.log('\n[3] Validando estructura del JSON…');
const checks = [
  ['meta', typeof json.meta === 'object'],
  ['meta.version', typeof json.meta?.version === 'string'],
  ['meta.fecha_inicio_programa', typeof json.meta?.fecha_inicio_programa === 'string'],
  ['pilares (array)', Array.isArray(json.pilares)],
  ['entrenamiento', typeof json.entrenamiento === 'object'],
  ['kegel', typeof json.kegel === 'object'],
  ['pies_protocolo (opcional)', json.pies_protocolo === undefined || typeof json.pies_protocolo === 'object'],
];

let allOk = true;
for (const [label, ok] of checks) {
  console.log(`  ${ok ? '✓' : '✗'} ${label}`);
  if (!ok) allOk = false;
}

if (!allOk) {
  console.error('\n  El JSON existe pero le faltan campos esperados.');
  process.exit(1);
}

// ── RESUMEN ───────────────────────────────────────────────────────────────

console.log('\n  Claves raíz del JSON:', Object.keys(json).join(', '));
console.log('\n─────────────────────────────────────────');
console.log('  ✓ Todo OK');
console.log(`  Versión del plan: ${json.meta.version}`);
console.log(`  Inicio programa:  ${json.meta.fecha_inicio_programa}`);
console.log(`  Pilares activos:  ${json.pilares.filter(p => p.activo).length}/${json.pilares.length}`);
const cats = Object.keys(json.entrenamiento?.categorias ?? {});
console.log(`  Categorías:       ${cats.join(', ')}`);
console.log('─────────────────────────────────────────\n');
