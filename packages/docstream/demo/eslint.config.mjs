import nx from '@nx/eslint-plugin';
import baseConfig from '../../../eslint.config.mjs';

export default [
  ...nx.configs['flat/react'],
  ...baseConfig,
  {
    // public/assets and __sw__.js are the almost-node runtime, copied in by scripts/copy-sw.mjs (gitignored).
    ignores: ['**/out-tsc', 'public/**'],
  },
];
