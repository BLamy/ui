import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'node:path';
import { docstreamSources } from '../../packages/ui/src/docstream/vite/index';
import { docstreamAliases } from '../../tools/alias.mjs';

// Every docstream entry resolves to its source, so the site always runs the docstream in this checkout: `@brett_lamy/ui/docstream/site`, `/replay`, …
export default defineConfig({
  base: '/docstream/',
  plugins: [react(), docstreamSources({ mounts: [{ name: 'demo', root: 'src/examples' }] }), nodePolyfills()],
  resolve: {
    alias: [
      ...docstreamAliases,
      ...Object.entries({
        react: path.resolve(__dirname, "node_modules/react"),
        '@agent-wasm/core': path.resolve(__dirname, 'node_modules/@agent-wasm/core'),
        'vite-plugin-node-polyfills/shims/buffer': path.resolve(__dirname, 'node_modules/vite-plugin-node-polyfills/shims/buffer'),
        'vite-plugin-node-polyfills/shims/global': path.resolve(__dirname, 'node_modules/vite-plugin-node-polyfills/shims/global'),
        'vite-plugin-node-polyfills/shims/process': path.resolve(__dirname, 'node_modules/vite-plugin-node-polyfills/shims/process'),
        "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      }).map(([find, replacement]) => ({ find, replacement })),
    ],
  },
});
