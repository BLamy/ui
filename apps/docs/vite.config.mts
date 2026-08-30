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
