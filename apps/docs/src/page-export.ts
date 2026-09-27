/* Build-time Markdown export (tools/docs/pages-md.mjs loads this through Vite's SSR loader, so the same
   import.meta.glob resolver config applies): every page as "Copy page" gives it — renderable docstream Markdown whose
   `{% demo %}` blocks carry the demos' real files inline. */
import { parseMarkdown, resolveDemosToMarkdown, serializeMarkdown, type DemoNode } from '@brett_lamy/docstream';
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

const trimEnd = (s: string) => s.replace(/\n+$/, '');

/**
 * What "Copy page" must preserve, per page: its export parses to the source's block structure — every block equal,
 * demos compared by `src` — and every demo carries the resolver's files inline (same paths, same contents, in the
 * resolver's order) with its title folded in, so the copy renders the same demos with or without the resolver.
 * Returns one line per problem.
 */
export async function exportMismatches(): Promise<string[]> {
  const problems: string[] = [];
  for (const { id } of PAGE_LIST) {
    const demos: { source: DemoNode[]; exported: DemoNode[] } = { source: [], exported: [] };
    const shape = (doc: unknown, into: DemoNode[]) =>
      canon(JSON.parse(JSON.stringify(doc, (_, x) => {
        if (x && typeof x === 'object' && (x as { type?: unknown }).type === 'demo') {
          into.push(x as DemoNode);
          return { type: 'demo', src: (x as DemoNode).src };
        }
        return x;
      })));
    const source = shape(parseMarkdown(pageSource(id)), demos.source);
    const exported = shape(parseMarkdown(await exportPage(id)), demos.exported);
    if (source !== exported) {
      problems.push(`${id}: the export's block structure differs from the page's`);
      continue;
    }
    for (const [i, demo] of demos.exported.entries()) {
      const [files, meta] = await Promise.all([demoResolver.files(demo.src), demoResolver.meta(demo.src)]);
      const inline = demo.files ?? [];
      const want = files.map((f) => `${f.path}\n${trimEnd(f.content)}`);
      const got = inline.map((f) => `${f.path}\n${trimEnd(f.content)}`);
      if (canon(want) !== canon(got)) {
        problems.push(`${id}: ${demo.src} carries [${inline.map((f) => f.path).join(', ')}], the resolver has [${files.map((f) => f.path).join(', ')}]`);
      }
      const title = demos.source[i].title ?? meta?.title;
      if (title && demo.title !== title) problems.push(`${id}: ${demo.src} exported title "${demo.title}", expected "${title}"`);
    }
  }
  return problems;
}

/** Every `src` a page embeds that the resolver can't find (the build fails on these). */
export async function missingDemos(): Promise<string[]> {
  const known = new Set(demoResolver.list!());
  return PAGE_LIST.flatMap((p) =>
    [...pageSource(p.id).matchAll(/^\{%\s*demo\s[^%]*?src="([^"]+)"/gm)].map((m) => m[1]).filter((s) => !known.has(s)).map((s) => `${p.id}: ${s}`),
  );
}
