import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  base: '/docstream/',
  plugins: [react()],
  build: {
    rollupOptions: { external: ["@agent-wasm/core"] },
  },
  resolve: {
    alias: {
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      '@brett_lamy/docstream/styles.css': path.resolve(__dirname, '../src/styles.css'),
      '@brett_lamy/docstream': path.resolve(__dirname, 'src/docstream-lite.ts'),
    },
  },
});
