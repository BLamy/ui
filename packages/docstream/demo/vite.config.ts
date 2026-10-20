import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { docstreamSources } from '../src/vite/index';

// Every package entry resolves to its source (the `source` condition in package.json), so the
// site always runs the docstream in this checkout: `@brett_lamy/docstream/site`, `/replay`, …
const pkg = JSON.parse(readFileSync(path.resolve(__dirname, '../package.json'), 'utf8')) as {
  exports: Record<string, string | { source?: string }>;
};
const entryAliases = Object.entries(pkg.exports).flatMap(([key, value]) => {
  const target = typeof value === 'string' ? value.replace('./dist/', './src/') : value.source;
  if (!target) return [];
  const name = `@brett_lamy/docstream${key === '.' ? '' : key.slice(1)}`;
  return [{ find: new RegExp(`^${name.replace(/[/.]/g, '\\$&')}$`), replacement: path.resolve(__dirname, '..', target) }];
});

export default defineConfig({
  base: '/docstream/',
  plugins: [react(), docstreamSources({ mounts: [{ name: 'demo', root: 'src/examples' }] }), nodePolyfills()],
  resolve: {
    alias: [
      ...entryAliases,
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
