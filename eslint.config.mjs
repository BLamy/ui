import nx from '@nx/eslint-plugin';

// The React projects add nx's React config in their own eslint.config.mjs, which `nx lint` reads from the project's
// folder. ESLint run from the repo root reads only this file, so it gives those folders the same React rules here:
// otherwise a direct `eslint packages/ui/src` has no `react-hooks` plugin and fails on the projects' own
// `react-hooks/...` disable comments. Inside a project the patterns match nothing (they resolve against the project's
// config), so the project's own copy is the one that applies.
const REACT_PROJECTS = ['packages/ui', 'registry', 'apps/docs', 'apps/docstream-playground', 'apps/docstream-editor-playground'];
const reactFromRoot = nx.configs['flat/react'].map((config) => ({
  ...config,
  files: REACT_PROJECTS.flatMap((dir) => (config.files ?? ['**/*']).map((pattern) => `${dir}/${pattern}`)),
}));

/* UI SDK ships inside @brett_lamy/ui. Only the library's own source names it as upstream does (`@ui-sdk/react/dialog`);
   blocks, docs examples and apps import the copy an app gets, `@brett_lamy/ui/sdk/react/dialog`. The projects that hold
   such code add this to their own config (registry, apps/docs). */
export const noUpstreamUiSdk = {
  files: ['**/*.ts', '**/*.tsx'],
  rules: {
    'no-restricted-imports': ['error', { patterns: [{ group: ['@ui-sdk/*'], message: 'UI SDK ships inside the package: import @brett_lamy/ui/sdk/… instead.' }] }],
  },
};

export default [
  ...reactFromRoot,
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
