/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';
import { copyFileSync } from 'fs';
import pkg from './package.json' with { type: 'json' };
import { aliases } from '../../tools/alias.mjs';

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
      entry: 'src/index.ts',
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
