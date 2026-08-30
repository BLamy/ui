/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
  plugins: [react()],
  resolve: { conditions: ['@org/source'] },
  optimizeDeps: {
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
    ],
  },
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [],
  // },
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
  },
}));
