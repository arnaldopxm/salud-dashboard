import { readFileSync } from 'fs';
import { createHash } from 'crypto';

/**
 * Calcula un hash SHA-256 corto (8 hex) del contenido de un archivo.
 * Función pura respecto al contenido — mismos bytes, mismo hash.
 */
export function hashFile(filePath) {
  const content = readFileSync(filePath);
  return createHash('sha256').update(content).digest('hex').slice(0, 8);
}

/**
 * Inyecta la versión de cache en el SW reemplazando TODAS las apariciones del
 * placeholder __CACHE_VERSION__. Función pura — devuelve el string modificado,
 * no escribe en disco. Reemplaza todas (no solo la primera) para que un
 * placeholder duplicado no deje inyección a medias.
 */
export function injectSwVersion(swContent, version) {
  return swContent.replaceAll('__CACHE_VERSION__', version);
}
