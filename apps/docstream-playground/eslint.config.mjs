import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  // scripts/copy-sw.mjs copies the almost-node service worker and its bundled workers in before each build: built output, not source (gitignored).
  { ignores: ['public/__sw__.js', 'public/assets/**'] },
  ...nx.configs['flat/react'],
  ...baseConfig,
];
