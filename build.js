import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join } from 'path';

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
if (existsSync('manifest.json')) copyFileSync('manifest.json', 'dist/manifest.json');
if (existsSync('sw.js')) copyFileSync('sw.js', 'dist/sw.js');

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
  await ctx.rebuild();
  await ctx.dispose();
  console.log('Build complete → dist/');
}
