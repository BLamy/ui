import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { aliases, docstreamAliases } from '../../tools/alias.mjs';

// Docstream, the editor and what they use of the rest of the library resolve to their sources, so this runs the checkout as it is.
export default defineConfig({
  base: '/docstream-editor/',
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^react$/, replacement: path.resolve(__dirname, 'node_modules/react') },
      { find: /^react-dom$/, replacement: path.resolve(__dirname, 'node_modules/react-dom') },
      ...docstreamAliases,
      ...aliases,
    ],
  },
});
