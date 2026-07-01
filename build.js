import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { hashFile, injectSwVersion } from './scripts/build-utils.mjs';

const watch = process.argv.includes('--watch');

const ctx = await esbuild.context({
  entryPoints: ['src/main.ts'],
  bundle: true,
  outfile: 'dist/bundle.js',
  format: 'iife',
  target: 'es2020',
  sourcemap: true,
  minify: !watch,
});

mkdirSync('dist', { recursive: true });

// En modo build (no watch) generamos el bundle ANTES de los estáticos, porque
// el SW hashea dist/bundle.js: necesita el artefacto ya escrito en disco.
// En watch, esbuild escribe el bundle de forma incremental (ver más abajo).
if (!watch) {
  await ctx.rebuild();
}

// Archivos estáticos
// index.html en la raíz del repo referencia el bundle como "dist/bundle.js"
// (para servir el repo desde su raíz en dev: `npm run serve`/`preview`). Pero
// Pages publica el CONTENIDO de dist/ como raíz del sitio, donde el bundle queda
// en "bundle.js". Reescribimos la ruta al copiar para que ambos layouts funcionen.
const html = readFileSync('index.html', 'utf8')
  .replace(/src=(["'])dist\/bundle\.js\1/g, 'src=$1bundle.js$1');
writeFileSync('dist/index.html', html);
if (existsSync('manifest.json')) copyFileSync('manifest.json', 'dist/manifest.json');

// SW con el hash del bundle inyectado — invalida la cache en cada deploy.
// Se hashea dist/bundle.js (el artefacto real que sirve Pages), así cualquier
// cambio de código genera un CACHE_NAME nuevo y purga el cache viejo. En watch
// el bundle puede no existir aún en el primer tick; sin él dejamos el placeholder.
if (existsSync('sw.js') && existsSync('dist/bundle.js')) {
  const bundleHash = hashFile('dist/bundle.js');
  const swContent = injectSwVersion(readFileSync('sw.js', 'utf8'), bundleHash);
  writeFileSync('dist/sw.js', swContent);
  console.log(`SW cache version: salud-${bundleHash}`);
} else if (existsSync('sw.js')) {
  copyFileSync('sw.js', 'dist/sw.js');
}

// Iconos PWA
if (existsSync('icons')) {
  mkdirSync('dist/icons', { recursive: true });
  readdirSync('icons').forEach(f => {
    if (f.endsWith('.png') || f.endsWith('.svg')) {
      copyFileSync(join('icons', f), join('dist/icons', f));
    }
  });
}

if (watch) {
  await ctx.watch();
  console.log('Watching for changes…');
} else {
  await ctx.dispose();
  console.log('Build complete → dist/');
}
