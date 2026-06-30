import * as esbuild from 'esbuild';
import { mkdirSync, existsSync, writeFileSync, readFileSync, copyFileSync } from 'fs';
import { generateIconSvg, resolveManifestIcons, injectIconsIntoManifest, writeIcons } from './scripts/build-utils.mjs';

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

// Archivos estáticos
copyFileSync('index.html', 'dist/index.html');
if (existsSync('sw.js')) copyFileSync('sw.js', 'dist/sw.js');

// Iconos PWA — copia PNGs reales si existen, genera SVGs placeholder si no
const iconSizes = [192, 512];
writeIcons(iconSizes, 'icons', 'dist/icons');
const manifestIcons = resolveManifestIcons(iconSizes, size => existsSync(`icons/icon-${size}.png`));

// Reescribe el manifest con los iconos correctos (SVG o PNG según lo que haya)
if (existsSync('manifest.json')) {
  const manifest = injectIconsIntoManifest(
    JSON.parse(readFileSync('manifest.json', 'utf-8')),
    manifestIcons,
  );
  writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2), 'utf-8');
}

if (watch) {
  await ctx.watch();
  console.log('Watching for changes…');
} else {
  await ctx.rebuild();
  await ctx.dispose();
  console.log('Build complete → dist/');
}
