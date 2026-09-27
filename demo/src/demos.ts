/* The demo site's DemoResolver: every folder under examples/<page>/<example>/ with an index.tsx. */
import { createGlobDemoResolver, demoHref, type DemoMeta } from '@brett_lamy/docstream';

export const demoResolver = createGlobDemoResolver({
  root: './examples',
  modules: import.meta.glob('./examples/*/*/index.tsx'),
  sources: import.meta.glob('./examples/*/*/**/*.{ts,tsx,css,json}', { query: '?raw', import: 'default' }) as Record<string, () => Promise<string>>,
  metas: import.meta.glob<DemoMeta>('./examples/*/*/meta.json', { eager: true, import: 'default' }),
  href: (src) => demoHref(src, { base: import.meta.env.BASE_URL }),
});
