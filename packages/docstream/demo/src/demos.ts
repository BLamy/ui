/* The docs' DemoResolver: every folder under examples/<page>/<example>/ with an index.tsx. `prefix` namespaces the
   "Open in new tab" link (`?demo=<prefix><page>/<example>`) for a host that serves several libraries' demos. */
import { createGlobDemoResolver, demoHref, type DemoResolver } from '@brett_lamy/docstream';

export function createDemoResolver(prefix = ''): DemoResolver {
  return createGlobDemoResolver({
    root: './examples',
    modules: import.meta.glob('./examples/*/*/index.tsx'),
    sources: import.meta.glob('./examples/*/*/**/*.{ts,tsx,css,json}', { query: '?raw', import: 'default' }),
    metas: import.meta.glob('./examples/*/*/meta.json', { eager: true, import: 'default' }),
    href: (src) => demoHref(`${prefix}${src}`, { base: import.meta.env.BASE_URL }),
  });
}

export const demoResolver = createDemoResolver();
