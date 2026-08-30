/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/apps/chat',
  server: {
    port: 4203,
    host: 'localhost',
  },
  preview: {
    port: 4203,
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
