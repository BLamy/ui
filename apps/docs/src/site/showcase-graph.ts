/* What each library's page shows off, read from the code rather than kept by hand: the blocks (registry/blocks/<slug>)
   that import the library, and the docs pages (apps/docs/pages/<id>.md) that document its parts, each with the first
   demo it embeds. Node only, like plan-graph.ts: the docs' Vite plugin hands the result to the site as
   `virtual:bl-site-files`'s `libraryShowcase`, and showcase-graph.test.ts checks it.

   A block belongs to every library whose units it imports, ranked by how many (Video's page leads with the video
   editor, which uses six of its units; the core's with the blocks that use the most of it). A docs page belongs to the
   library that owns the unit named like it (`waveform.md` → `components/waveform.tsx` → Audio); pages named for no unit
   (`lists.md`, `env-variables.md`) go by what their examples import. A library's `showcase` pins (libraries.ts) come
   first in either list, for the foundation libraries every block uses and for pages no unit is named after. */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LIBRARIES, ownerOf } from './libraries';
import { UI_SRC, listUnits, resolveImport } from './plan-graph';

const ROOT = join(UI_SRC, '../../..');
const BLOCKS = join(ROOT, 'registry/blocks');
const DOCS = join(ROOT, 'apps/docs');

export interface ShowcaseBlock {
  slug: string;
  /** How many of the library's units the block imports. */
  uses: number;
  /** The block starts a runtime (Node, OpenCode, FFmpeg) or needs a cross-origin isolated page: the library page
      links to it instead of running it in place. */
  heavy: boolean;
}
export interface ShowcasePage {
  id: string;
  /** The first `{% demo src="…" %}` on the page. */
  demo?: string;
}
export type LibraryShowcase = Record<string, { blocks: ShowcaseBlock[]; pages: ShowcasePage[] }>;

/** Libraries whose parts start a runtime, or need a cross-origin isolated page, when a block mounts them. */
const HEAVY_LIBRARIES = new Set(['video', 'opencode', 'sandbox', 'linux-vm']);
/** Docs sections that hold guides, not parts: never a library's component. */
const GUIDE_SECTIONS = new Set(['Getting started', 'Hooks', 'Behaviors', 'About']);
/** Libraries every block and example imports: a page's examples never make it theirs. */
const FOUNDATION = new Set(['ui-sdk', 'tokens', 'motion', 'icons']);

const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|^\s*import\s+)(['"])([^'"\n]+)\1/gm;
const SOURCE = /\.tsx?$/;
const NOT_SOURCE = /\.(test|stories|spec)\.|\.d\.ts$/;

function sourcesIn(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .map((f) => f.split('\\').join('/'))
    .filter((f) => SOURCE.test(f) && !NOT_SOURCE.test(f))
    .map((f) => join(dir, f));
}

/** The units of packages/ui/src the files under `dir` import, by the library that owns each. */
function libraryUseIn(dir: string, units: readonly string[]): Map<string, Set<string>> {
  const use = new Map<string, Set<string>>();
  const add = (lib: string, unit: string) => (use.get(lib) ?? use.set(lib, new Set()).get(lib)!).add(unit);
  // Aliases and package entries resolve the same from any file of packages/ui/src.
  const from = join(UI_SRC, 'index.ts');
  for (const file of sourcesIn(dir)) {
    for (const m of readFileSync(file, 'utf8').matchAll(IMPORT)) {
      const spec = m[2];
      if (spec.startsWith('@brett_lamy/ui/sdk/')) { add('ui-sdk', spec.slice('@brett_lamy/ui/'.length)); continue; }
      const target = resolveImport(from, spec, units);
      if (target && 'unit' in target) add(ownerOf(target.unit).id, target.unit);
    }
  }
  return use;
}

const firstDemo = (markdown: string) => /\{% demo src="([^"]+)"/.exec(markdown)?.[1];

export function libraryShowcase(): LibraryShowcase {
  const units = listUnits();
  const out: LibraryShowcase = Object.fromEntries(LIBRARIES.map((l) => [l.id, { blocks: [], pages: [] }]));

  // Blocks, by the libraries they import.
  const slugs = readdirSync(BLOCKS).filter((s) => existsSync(join(BLOCKS, s, 'meta.json'))).sort();
  for (const slug of slugs) {
    const use = libraryUseIn(join(BLOCKS, slug), units);
    const heavy = [...use.keys()].some((l) => HEAVY_LIBRARIES.has(l));
    for (const [lib, used] of use) out[lib]?.blocks.push({ slug, uses: used.size, heavy });
  }

  // Docs pages, by the unit they are named for, else by what their examples import.
  const nav = JSON.parse(readFileSync(join(DOCS, 'pages/nav.json'), 'utf8')) as { sections: Array<{ section: string; pages: Array<{ id: string }> }> };
  const pageOf = (id: string): ShowcasePage => {
    const md = join(DOCS, 'pages', `${id}.md`);
    return { id, demo: existsSync(md) ? firstDemo(readFileSync(md, 'utf8')) : undefined };
  };
  for (const { section, pages } of nav.sections) {
    if (GUIDE_SECTIONS.has(section)) continue;
    for (const { id } of pages) {
      const named = [`components/${id}.tsx`, `components/${id}/`, `lib/${id}.ts`, `lib/${id}.tsx`, `lib/${id}/`].find((u) => units.includes(u));
      let lib = named ? ownerOf(named).id : null;
      if (!lib) {
        const use = [...libraryUseIn(join(DOCS, 'examples', id), units)].filter(([l]) => !FOUNDATION.has(l));
        lib = use.sort((a, b) => b[1].size - a[1].size)[0]?.[0] ?? null;
      }
      if (!lib || FOUNDATION.has(lib)) continue;
      out[lib]!.pages.push(pageOf(id));
    }
  }

  // Pins first, in their order. A pinned block the library's imports don't reach is added; a pinned page moves to
  // that library alone.
  for (const lib of LIBRARIES) {
    const entry = out[lib.id]!;
    const pinnedBlocks = lib.showcase?.blocks ?? [];
    for (const slug of pinnedBlocks) {
      if (!slugs.includes(slug)) throw new Error(`libraries.ts: ${lib.id} pins the block "${slug}", which doesn't exist`);
      if (!entry.blocks.some((b) => b.slug === slug)) entry.blocks.push({ slug, uses: 0, heavy: false });
    }
    const rank = (slug: string) => { const i = pinnedBlocks.indexOf(slug); return i < 0 ? Infinity : i; };
    entry.blocks.sort((a, b) => rank(a.slug) - rank(b.slug) || b.uses - a.uses || a.slug.localeCompare(b.slug));
    for (const id of lib.showcase?.pages ?? []) {
      if (!existsSync(join(DOCS, 'pages', `${id}.md`))) throw new Error(`libraries.ts: ${lib.id} pins the page "${id}", which doesn't exist`);
      for (const other of Object.values(out)) other.pages = other.pages.filter((p) => p.id !== id);
    }
  }
  for (const lib of LIBRARIES) out[lib.id]!.pages.unshift(...(lib.showcase?.pages ?? []).map(pageOf));
  return out;
}
