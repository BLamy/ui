import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  base: '/docstream-editor/',
  plugins: [react()],
  resolve: {
    alias: {
      react: path.resolve(__dirname, 'node_modules/react'),
      'react-dom': path.resolve(__dirname, 'node_modules/react-dom'),
      '@brett_lamy/ui/docstream-editor/styles.css': path.resolve(__dirname, '../../packages/ui/src/docstream-editor/styles.css'),
      '@brett_lamy/ui/docstream-editor': path.resolve(__dirname, '../../packages/ui/src/docstream-editor/index.ts'),
    },
  },
});
