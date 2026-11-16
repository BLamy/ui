/* The live demos of docstream's and the editor's docs, as they run inside the BL site: every folder under their
   playgrounds' src/examples/<page>/<example>/ with an index.tsx. Their "Open in new tab" links are namespaced
   (`?demo=docstream:<page>/<example>`) so they never collide with the ui docs' own `?demo=<page>/<example>`; main.tsx
   routes those to `<DemoFullscreen>` with the resolver below. Loaded only with a library's docs or its demo. */
import { createGlobDemoResolver, demoHref, type DemoResolver } from '@brett_lamy/ui/docstream';

export const LIBRARY_DEMO_PREFIXES = ['docstream-editor', 'docstream'] as const;
export type LibraryDemoPrefix = (typeof LIBRARY_DEMO_PREFIXES)[number];

const href = (prefix: LibraryDemoPrefix) => (src: string) => demoHref(`${prefix}:${src}`, { base: import.meta.env.BASE_URL });

export const docstreamDemos: DemoResolver = createGlobDemoResolver({
  root: '../../../docstream-playground/src/examples',
  modules: import.meta.glob('../../../docstream-playground/src/examples/*/*/index.tsx'),
  sources: import.meta.glob('../../../docstream-playground/src/examples/*/*/**/*.{ts,tsx,css,json}', { query: '?raw', import: 'default' }),
  metas: import.meta.glob('../../../docstream-playground/src/examples/*/*/meta.json', { eager: true, import: 'default' }),
  href: href('docstream'),
});

export const editorDemos: DemoResolver = createGlobDemoResolver({
  root: '../../../docstream-editor-playground/src/examples',
  modules: import.meta.glob('../../../docstream-editor-playground/src/examples/*/*/index.tsx'),
  sources: import.meta.glob('../../../docstream-editor-playground/src/examples/*/*/**/*.{ts,tsx,css,json}', { query: '?raw', import: 'default' }),
  metas: import.meta.glob('../../../docstream-editor-playground/src/examples/*/*/meta.json', { eager: true, import: 'default' }),
  href: href('docstream-editor'),
});

/** `docstream:writing-code/basic` → the docstream resolver and `writing-code/basic`; null for a ui docs demo. */
export function libraryDemo(src: string): { resolver: DemoResolver; src: string } | null {
  const m = /^(docstream-editor|docstream):(.+)$/.exec(src);
  if (!m) return null;
  return { resolver: m[1] === 'docstream' ? docstreamDemos : editorDemos, src: m[2] };
}
