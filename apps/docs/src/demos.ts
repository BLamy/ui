/* The demo resolver: `{% demo src="<page>/<example>" %}` → apps/docs/examples/<page>/<example>/ (entry index.tsx),
   `{% demo src="blocks/<slug>" %}` → registry/blocks/<slug>/ (entry page.tsx). What renders and what readers see are
   the same files. `?demo=<src>` renders one demo alone (main.tsx). */
import { createGlobDemoResolver, demoHref, type DemoMeta, type DemoResolver } from '@brett_lamy/docstream';
import { themed } from './demo-theme';

const href: DemoResolver['href'] = (src, options) =>
  demoHref(src, { base: import.meta.env.BASE_URL, variant: options?.variant });

const examples = createGlobDemoResolver({
  root: '../examples',
  modules: import.meta.glob('../examples/*/*/index.tsx'),
  sources: import.meta.glob<string>('../examples/*/*/**/*.{ts,tsx,css,json}', { query: '?raw', import: 'default' }),
  metas: import.meta.glob('../examples/*/*/meta.json', { eager: true, import: 'default' }),
  href,
});

const blocks = createGlobDemoResolver({
  root: '../../../registry',
  entry: 'page.tsx',
  modules: import.meta.glob('../../../registry/blocks/*/page.tsx'),
  sources: import.meta.glob<string>(
    ['../../../registry/blocks/*/**/*.{ts,tsx,css,json}', '!../../../registry/blocks/*/**/*.stories.tsx'],
    { query: '?raw', import: 'default' },
  ),
  // A block's meta.json (title, description, files) plus how the viewer shows it: full bleed, multi-file.
  metas: Object.fromEntries(
    Object.entries(import.meta.glob<DemoMeta>('../../../registry/blocks/*/meta.json', { eager: true, import: 'default' }))
      .map(([path, meta]) => [path, { title: meta.title, description: meta.description, entry: 'page.tsx', layout: 'multi', bleed: true, height: 720 } satisfies DemoMeta]),
  ),
  href,
});

const pick = (src: string) => (src.startsWith('blocks/') ? blocks : examples);

export const demoResolver: DemoResolver = {
  list: () => [...examples.list!(), ...blocks.list!()],
  meta: (src) => pick(src).meta(src),
  files: (src) => pick(src).files(src),
  load: (src) => pick(src).load(src).then(themed),
  href,
};

/** Registry block slugs (the nav's Blocks count). */
export const BLOCK_COUNT = blocks.list!().length;
