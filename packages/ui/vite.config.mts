/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';
import { copyFileSync, mkdirSync } from 'fs';
import pkg from './package.json' with { type: 'json' };
import { aliases } from '../../tools/alias.mjs';

const DIAGRAM_WORKER_LINE = "new Worker(new URL('./layout-worker.js', import.meta.url), { type: 'module' })";
const DIAGRAM_WORKER_STAND_IN = '__blDiagramLayoutWorker__()';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/packages/ui',
  resolve: { alias: aliases },
  plugins: [
    react(),
    tailwindcss(),
    dts({
      entryRoot: 'src',
      exclude: ['**/*.stories.tsx', 'src/stories/**'],
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
    }),
    // The bl-theme ships as plain CSS (`@brett_lamy/ui/theme.css`), copied as is.
    { name: 'bl-theme-css', closeBundle: () => copyFileSync(path.join(import.meta.dirname, 'src/theme.css'), path.join(import.meta.dirname, 'dist/theme.css')) },
    // The Tailscale router's service worker ships as a plain script (`@brett_lamy/ui/tailscale-sw.js`) to copy into public/.
    {
      name: 'bl-tailscale-sw',
      closeBundle: () =>
        copyFileSync(path.join(import.meta.dirname, 'src/lib/tailscale-router/tailscale-sw.js'), path.join(import.meta.dirname, 'dist/tailscale-sw.js')),
    },
    // So does the FFmpeg worker (`@brett_lamy/ui/ffmpeg-worker.js`), to serve next to the FFmpeg wasm build.
    {
      name: 'bl-ffmpeg-worker',
      closeBundle: () =>
        copyFileSync(path.join(import.meta.dirname, 'src/lib/ffmpeg/ffmpeg-worker.js'), path.join(import.meta.dirname, 'dist/ffmpeg-worker.js')),
    },
    // The diagram layout worker stays a plain script beside its module, and it's the app's bundler that has to pick it up,
    // because it imports ELK, an optional peer with another licence that mustn't end up in this package. So the line that
    // starts it is hidden from this build's own worker handling, and put back as it was.
    {
      name: 'bl-diagram-layout-worker',
      enforce: 'pre' as const,
      transform: (code: string, id: string) => (id.endsWith('lib/diagram-layout/index.ts') ? code.replace(DIAGRAM_WORKER_LINE, DIAGRAM_WORKER_STAND_IN) : null),
      renderChunk: (code: string) => (code.includes(DIAGRAM_WORKER_STAND_IN) ? code.replace(DIAGRAM_WORKER_STAND_IN, DIAGRAM_WORKER_LINE) : null),
      closeBundle: () => {
        mkdirSync(path.join(import.meta.dirname, 'dist/lib/diagram-layout'), { recursive: true });
        copyFileSync(path.join(import.meta.dirname, 'src/lib/diagram-layout/layout-worker.js'), path.join(import.meta.dirname, 'dist/lib/diagram-layout/layout-worker.js'));
      },
    },
  ],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [],
  // },
  // Configuration for building your library.
  // See: https://vite.dev/guide/build.html#library-mode
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      // Could also be a dictionary or array of multiple entry points.
      entry: { index: 'src/index.ts', opencode: 'src/opencode.ts' },
      name: '@brett_lamy/ui',
      fileName: 'index',
      // Change this to the formats you want to support.
      // Don't forget to update your package.json as well.
      formats: ['es' as const],
    },
    rolldownOptions: {
      // One output module per source module: bundlers drop what an app doesn't import, and the module-level
      // 'use client' directives survive per file. (The stylesheet is still a single dist/index.css.)
      output: { preserveModules: true, preserveModulesRoot: 'src', entryFileNames: '[name].js' },
      // External packages that should not be bundled into your library.
      // Dependencies stay external so apps share one copy (react-aria's contexts must be shared).
      external: (id: string) =>
        [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.peerDependencies ?? {}), 'react/jsx-runtime']
          .some((dep) => id === dep || id.startsWith(dep + '/')),
    },
  },
}));
