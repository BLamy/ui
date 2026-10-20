import nx from '@nx/eslint-plugin';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...nx.configs['flat/react'],
  ...baseConfig,
  {
    // demo/ is its own project (docstream-playground), linted with its own config.
    ignores: ['**/out-tsc', 'demo/**'],
  },
  {
    // Tests run without Node's types installed (`// @ts-ignore` on node: imports) and stub DOM APIs with no-ops.
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: { '@typescript-eslint/ban-ts-comment': 'off', '@typescript-eslint/no-empty-function': 'off' },
  },
];
