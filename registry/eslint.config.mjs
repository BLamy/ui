import nx from '@nx/eslint-plugin';
import baseConfig, { noUpstreamUiSdk } from '../eslint.config.mjs';

export default [
  ...nx.configs['flat/react'],
  ...baseConfig,
  noUpstreamUiSdk,
];
