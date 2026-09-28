/* Shared Vite config for the demo apps (contacts, chat, pencil, workbench-app). They consume @brett_lamy/ui and the
   registry blocks as TS source (the `@org/source` condition), so the dev server has to pre-bundle the same
   CommonJS dependencies Storybook and the docs do — otherwise the first page load fails on
   `use-sync-external-store/shim` (react-aria, tiptap) and docstream's CJS deps. */
import { defineConfig, type UserConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export function appConfig(name: string, port: number, root: string): UserConfig {
  return defineConfig({
    root,
    cacheDir: `../../node_modules/.vite/apps/${name}`,
    server: { port, host: 'localhost' },
    preview: { port, host: 'localhost' },
    plugins: [react(), tailwindcss()],
    resolve: { conditions: ['@org/source'], dedupe: ['react', 'react-dom'] },
    optimizeDeps: {
      include: [
        // Storybook includes these from the catalog's own devDependencies; the apps reach them through ui.
        '@brett_lamy/ui > @tiptap/react > use-sync-external-store/shim/index.js',
        '@brett_lamy/ui > @tiptap/react > use-sync-external-store/shim/with-selector.js',
        '@brett_lamy/ui > react-aria/PortalProvider',
        '@brett_lamy/ui > @brett_lamy/docstream',
        '@brett_lamy/ui > @brett_lamy/docstream-editor',
      ],
    },
    build: {
      outDir: './dist',
      emptyOutDir: true,
      reportCompressedSize: true,
      commonjsOptions: { transformMixedEsModules: true },
    },
  });
}
