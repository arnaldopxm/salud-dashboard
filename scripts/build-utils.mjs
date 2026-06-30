import { existsSync, writeFileSync, readFileSync, mkdirSync, copyFileSync } from 'fs';
import { join } from 'path';

/**
 * Genera el SVG placeholder para un icono PWA de tamaño dado.
 * Función pura — no toca el filesystem.
 */
export function generateIconSvg(size) {
  const rx = Math.round(size * 0.18);
  const fontSize = Math.round(size * 0.55);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" rx="${rx}" fill="#0f0f1a"/><text x="50%" y="54%" font-size="${fontSize}" text-anchor="middle" dominant-baseline="middle">💪</text></svg>`;
}

/**
 * Calcula la lista de entradas de iconos para el manifest dado un directorio
 * base de iconos y los tamaños requeridos.
 * Función pura — recibe un predicado `hasPng` en vez de llamar existsSync.
 */
export function resolveManifestIcons(sizes, hasPng) {
  return sizes.map(size => {
    if (hasPng(size)) {
      return { src: `icons/icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png', purpose: 'any maskable' };
    }
    return { src: `icons/icon-${size}.svg`, sizes: `${size}x${size}`, type: 'image/svg+xml', purpose: 'any maskable' };
  });
}

/**
 * Inyecta los iconos resueltos en un objeto manifest.
 * Función pura — devuelve un nuevo objeto, no muta el original.
 */
export function injectIconsIntoManifest(manifest, icons) {
  return { ...manifest, icons };
}

/**
 * Escribe los iconos en distIconsDir: copia PNG si existe, escribe SVG si no.
 * Impura — escribe en disco.
 */
export function writeIcons(sizes, srcIconsDir, distIconsDir) {
  mkdirSync(distIconsDir, { recursive: true });
  sizes.forEach(size => {
    const pngSrc = join(srcIconsDir, `icon-${size}.png`);
    if (existsSync(pngSrc)) {
      copyFileSync(pngSrc, join(distIconsDir, `icon-${size}.png`));
    } else {
      writeFileSync(join(distIconsDir, `icon-${size}.svg`), generateIconSvg(size), 'utf-8');
    }
  });
}
