/* Build-time Markdown export (tools/docs/pages-md.mjs loads this through Vite's SSR loader, so the same
   import.meta.glob resolver config applies): every page with its `{% demo %}` tags replaced by the demos' real files. */
import { parseMarkdown, resolveDemosToMarkdown, serializeMarkdown } from '@brett_lamy/docstream';
import { demoResolver } from './demos';
import { PAGE_LIST, pageSource } from './pages';

export { PAGE_LIST };

/** The page as docstream resolves it for "Copy page" (default options — no docs-side post-processing). */
export const exportPage = (id: string): Promise<string> => resolveDemosToMarkdown(pageSource(id), demoResolver);

/** JSON with sorted keys, so two ASTs compare by content. */
const canon = (v: unknown): string =>
  JSON.stringify(v, (_, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x));

/** Pages whose Markdown doesn't survive docstream's parse → serialize → parse (content docstream can't represent). */
export function unstablePages(): string[] {
  return PAGE_LIST.map((p) => p.id).filter((id) => {
    const once = serializeMarkdown(parseMarkdown(pageSource(id)));
    return serializeMarkdown(parseMarkdown(once)) !== once || canon(parseMarkdown(once)) !== canon(parseMarkdown(pageSource(id)));
  });
}

/** Every `src` a page embeds that the resolver can't find (the build fails on these). */
export async function missingDemos(): Promise<string[]> {
  const known = new Set(demoResolver.list!());
  return PAGE_LIST.flatMap((p) =>
    [...pageSource(p.id).matchAll(/^\{%\s*demo\s[^%]*?src="([^"]+)"/gm)].map((m) => m[1]).filter((s) => !known.has(s)).map((s) => `${p.id}: ${s}`),
  );
}
