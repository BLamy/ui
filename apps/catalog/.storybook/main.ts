import type { StorybookConfig } from '@storybook/react-vite';
import { defaultClientConditions } from 'vite';
import tailwindcss from '@tailwindcss/vite';
// @ts-expect-error plain ESM helper shared with the Vite configs
import { aliases } from '../../../tools/alias.mjs';

const config: StorybookConfig = {
  // package stories, block stories, and catalog stories that render registry blocks (packages can't depend on the registry)
  stories: ['../../../packages/*/src/**/*.stories.@(ts|tsx)', '../../../registry/blocks/**/*.stories.@(ts|tsx)', '../stories/**/*.stories.@(ts|tsx)'],
  framework: { name: '@storybook/react-vite', options: {} },
  async viteFinal(cfg) {
    cfg.plugins = [...(cfg.plugins ?? []), tailwindcss()];
    cfg.resolve = cfg.resolve ?? {};
    (cfg.resolve as any).alias = [...((cfg.resolve as any).alias ?? []), ...aliases];
    // consume package TS source via the workspace custom condition, keeping vite's defaults
    (cfg.resolve as any).conditions = ['@org/source', ...defaultClientConditions];
    (cfg.resolve as any).dedupe = ['react', 'react-dom'];
    cfg.optimizeDeps = {
      ...cfg.optimizeDeps,
      // PGlite locates its WebAssembly next to its own module (`new URL('./pglite.wasm', import.meta.url)`): serve it unbundled.
      exclude: [...(cfg.optimizeDeps?.exclude ?? []), '@electric-sql/pglite', '@electric-sql/pglite-tools'],
      include: [
        ...(cfg.optimizeDeps?.include ?? []),
        'react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime',
        'framer-motion', 'react-aria-components', '@brett_lamy/ui > react-aria/PortalProvider', 'perfect-freehand', 'clsx', 'tailwind-merge', 'class-variance-authority',
        'highlight.js/lib/core', 'use-sync-external-store/shim/index.js', 'use-sync-external-store/shim/with-selector.js',
        // docstream pulls CommonJS deps (style-to-js, debug) the browser can't import unbundled; pre-bundle it whole.
        '@brett_lamy/ui > @brett_lamy/docstream',
        '@brett_lamy/ui > @brett_lamy/docstream-editor',
        // ReplayPreview's player (rrweb loads from it lazily).
        '@brett_lamy/ui > @brett_lamy/docstream/replay',
      ],
    };
    return cfg;
  },
};
export default config;
