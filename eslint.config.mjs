import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: [
      '**/dist',
      '**/vite.config.*.timestamp*',
      '**/vitest.config.*.timestamp*',
      '**/test-output',
      '**/out-tsc',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      // Components, blocks, docs examples and stories import each other through the `@/components/ui/*`, `@/components/blocks/*`
      // and `@/lib/*` aliases on purpose: the registry copies source into other projects, where those aliases resolve and
      // relative paths would not. This rule wants them relative (and its autofix crashes resolving them), and the
      // dependency constraints below allowed everything anyway, so it has nothing to offer this workspace.
      '@nx/enforce-module-boundaries': 'off',
      // A browser library: `location`, `innerWidth`, `addEventListener` and friends are the platform, not mistakes.
      'no-restricted-globals': 'off',
      // `interface PopoverProps extends AriaPopoverProps {}` is a named extension point, not an empty type.
      '@typescript-eslint/no-empty-interface': ['error', { allowSingleExtends: true }],
      '@typescript-eslint/no-empty-object-type': ['error', { allowInterfaces: 'with-single-extends' }],
      // No-op defaults and stubs (`onChange = () => {}`).
      '@typescript-eslint/no-empty-function': ['error', { allow: ['arrowFunctions'] }],
    },
  },
  {
    // Storybook `render` functions are components in all but name, and call hooks.
    files: ['**/*.stories.tsx'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];
