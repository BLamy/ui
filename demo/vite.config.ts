import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'node:path';

export default defineConfig({
  base: '/docstream/',
  plugins: [react(), nodePolyfills()],
  resolve: {
    alias: {
      react: path.resolve(__dirname, "node_modules/react"),
      '@agent-wasm/core': path.resolve(__dirname, 'node_modules/@agent-wasm/core'),
      'vite-plugin-node-polyfills/shims/buffer': path.resolve(__dirname, 'node_modules/vite-plugin-node-polyfills/shims/buffer'),
      'vite-plugin-node-polyfills/shims/global': path.resolve(__dirname, 'node_modules/vite-plugin-node-polyfills/shims/global'),
      'vite-plugin-node-polyfills/shims/process': path.resolve(__dirname, 'node_modules/vite-plugin-node-polyfills/shims/process'),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      '@brett_lamy/docstream/styles.css': path.resolve(__dirname, '../src/styles.css'),
      '@brett_lamy/docstream': path.resolve(__dirname, 'src/docstream-lite.ts'),
    },
  },
});
