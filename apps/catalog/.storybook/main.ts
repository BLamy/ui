import type { StorybookConfig } from '@storybook/react-vite';
import { defaultClientConditions } from 'vite';

const config: StorybookConfig = {
  stories: ['../../../packages/*/src/**/*.stories.@(ts|tsx)'],
  framework: { name: '@storybook/react-vite', options: {} },
  async viteFinal(cfg) {
    cfg.resolve = cfg.resolve ?? {};
    // consume package TS source via the workspace custom condition, keeping vite's defaults
    (cfg.resolve as any).conditions = ['@org/source', ...defaultClientConditions];
    (cfg.resolve as any).dedupe = ['react', 'react-dom'];
    cfg.optimizeDeps = {
      ...cfg.optimizeDeps,
      include: [
        ...(cfg.optimizeDeps?.include ?? []),
        'react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime',
        'framer-motion', 'react-aria-components', 'perfect-freehand', 'clsx', 'tailwind-merge', 'class-variance-authority',
        'highlight.js/lib/core', 'use-sync-external-store/shim/index.js', 'use-sync-external-store/shim/with-selector.js',
      ],
    };
    return cfg;
  },
};
export default config;
