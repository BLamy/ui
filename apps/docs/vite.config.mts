/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { aliases } from '../../tools/alias.mjs';

export default defineConfig(() => ({
  root: import.meta.dirname,
  base: process.env.GITHUB_ACTIONS ? '/ui/' : '/',
  cacheDir: '../../node_modules/.vite/apps/docs',
  server: {
    port: 4206,
    host: 'localhost',
  },
  preview: {
    port: 4206,
    host: 'localhost',
  },
  plugins: [react(), tailwindcss()],
  resolve: { conditions: ['@org/source'], alias: aliases },
  optimizeDeps: {
    // PGlite finds its WebAssembly with `new URL('./pglite.wasm', import.meta.url)`; pre-bundling would move the JS
    // away from the .wasm / .data files next to it. Serve it from where it is (see the PGlite page).
    exclude: ['@electric-sql/pglite', '@electric-sql/pglite-tools'],
    include: [
      '@tiptap/core',
      '@tiptap/extension-code-block-lowlight',
      '@tiptap/extension-list',
      '@tiptap/extension-placeholder',
      '@tiptap/extension-table',
      '@tiptap/pm/changeset',
      '@tiptap/pm/commands',
      '@tiptap/pm/dropcursor',
      '@tiptap/pm/gapcursor',
      '@tiptap/pm/history',
      '@tiptap/pm/inputrules',
      '@tiptap/pm/keymap',
      '@tiptap/pm/model',
      '@tiptap/pm/schema-list',
      '@tiptap/pm/state',
      '@tiptap/pm/tables',
      '@tiptap/pm/transform',
      '@tiptap/pm/view',
      '@tiptap/react',
      '@tiptap/starter-kit',
      '@tiptap/suggestion',
      'highlight.js/lib/core',
      'highlight.js/lib/languages/*',
      'lowlight',
      'lowlight > highlight.js',
      // docstream pulls CommonJS deps (style-to-js, debug) the browser can't import unbundled; pre-bundle it whole.
      '@brett_lamy/ui > @brett_lamy/docstream',
      '@brett_lamy/ui > @brett_lamy/docstream-editor',
      // ReplayPreview's player (rrweb loads from it lazily).
      '@brett_lamy/ui > @brett_lamy/docstream/replay',
      // The live example card (ReactDemo with an in-page preview).
      '@brett_lamy/docstream/playground',
    ],
  },
  // PGlite's worker (examples/pglite/worker) imports the engine, which code-splits: workers must build as ES modules.
  worker: { format: 'es' },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
}));
