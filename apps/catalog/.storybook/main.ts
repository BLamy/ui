import type { StorybookConfig } from '@storybook/react-vite';
import { defaultClientConditions } from 'vite';
import tailwindcss from '@tailwindcss/vite';

const config: StorybookConfig = {
  stories: ['../../../packages/*/src/**/*.stories.@(ts|tsx)'],
  framework: { name: '@storybook/react-vite', options: {} },
  async viteFinal(cfg) {
    cfg.plugins = [...(cfg.plugins ?? []), tailwindcss()];
    cfg.resolve = cfg.resolve ?? {};
    // consume package TS source via the workspace custom condition, keeping vite's defaults
    (cfg.resolve as any).conditions = ['@org/source', ...defaultClientConditions];
    (cfg.resolve as any).dedupe = ['react', 'react-dom'];
    cfg.optimizeDeps = {
      ...cfg.optimizeDeps,
      include: [
        ...(cfg.optimizeDeps?.include ?? []),
        'react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime',
        'framer-motion', 'react-aria-components', '@brett_lamy/ui > react-aria/PortalProvider', 'perfect-freehand', 'clsx', 'tailwind-merge', 'class-variance-authority',
        'highlight.js/lib/core', 'use-sync-external-store/shim/index.js', 'use-sync-external-store/shim/with-selector.js',
        // docstream pulls CommonJS deps (style-to-js, debug) the browser can't import unbundled; pre-bundle it whole.
        '@brett_lamy/workbench > @brett_lamy/docstream',
        '@brett_lamy/workbench > @brett_lamy/docstream-editor',
      ],
    };
    return cfg;
  },
};
export default config;
