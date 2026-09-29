/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import dts from 'vite-plugin-dts';
import * as path from 'path';
import { copyFileSync } from 'fs';
import pkg from './package.json' with { type: 'json' };

export default defineConfig(() => ({
  root: import.meta.dirname,
  cacheDir: '../../node_modules/.vite/packages/ui',
  plugins: [
    react(),
    tailwindcss(),
    dts({
      entryRoot: 'src',
      tsconfigPath: path.join(import.meta.dirname, 'tsconfig.lib.json'),
    }),
    // The bl-theme ships as plain CSS (`@brett_lamy/ui/theme.css`), copied as is.
    { name: 'bl-theme-css', closeBundle: () => copyFileSync(path.join(import.meta.dirname, 'src/theme.css'), path.join(import.meta.dirname, 'dist/theme.css')) },
  ],
  // Uncomment this if you are using workers.
  // worker: {
  //  plugins: [],
  // },
  // Configuration for building your library.
  // See: https://vite.dev/guide/build.html#library-mode
  build: {
    outDir: './dist',
    emptyOutDir: true,
    reportCompressedSize: true,
    commonjsOptions: {
      transformMixedEsModules: true,
    },
    lib: {
      // Could also be a dictionary or array of multiple entry points.
      entry: 'src/index.ts',
      name: '@brett_lamy/ui',
      fileName: 'index',
      // Change this to the formats you want to support.
      // Don't forget to update your package.json as well.
      formats: ['es' as const],
    },
    rolldownOptions: {
      // External packages that should not be bundled into your library.
      // Dependencies stay external so apps share one copy (react-aria's contexts must be shared).
      external: (id: string) =>
        [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.peerDependencies ?? {}), 'react/jsx-runtime']
          .some((dep) => id === dep || id.startsWith(dep + '/')),
    },
  },
}));
