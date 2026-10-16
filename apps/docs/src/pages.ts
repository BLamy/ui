/* The docs' pages: one docstream Markdown file per page (apps/docs/pages/<id>.md) and the nav manifest
   (apps/docs/pages/nav.json) that orders and titles them. */
import navJson from '../pages/nav.json';

export interface NavPage {
  id: string;
  title: string;
  /** Wide page layout (the Blocks gallery). */
  wide?: boolean;
}
export interface Nav {
  /** The sidebar, in reading order. */
  sections: Array<{ section: string; pages: NavPage[] }>;
  /** Pages outside the components list (the Blocks overview). */
  standalone: Array<NavPage & { section: string }>;
}
export interface PageInfo extends NavPage {
  section: string;
}

export const SITE_URL = 'https://blamy.github.io/ui';

const sources = import.meta.glob<string>('../pages/*.md', { eager: true, query: '?raw', import: 'default' });

export const NAV: Nav = navJson as Nav;

export const SITE_BLOCKS = 'blocks';

/* Blocks: one page each, cut from pages/blocks.md (one `{% demo src="blocks/<slug>" %}` and the prose under it
   per block, in that file's order). The Blocks page itself becomes the overview: its intro and a list of them. */
const blockMetas = import.meta.glob<{ title: string; description?: string }>('../../../registry/blocks/*/meta.json', { eager: true, import: 'default' });
const BLOCK_DEMO = /^\{% demo src="blocks\/([\w-]+)"/;
const blockSections = (() => {
  const lines = (sources[`../pages/${SITE_BLOCKS}.md`] ?? '').split('\n');
  const intro: string[] = [];
  const blocks: Array<{ slug: string; lines: string[] }> = [];
  for (const line of lines) {
    const slug = BLOCK_DEMO.exec(line)?.[1];
    if (slug) blocks.push({ slug, lines: [line] });
    else (blocks.at(-1)?.lines ?? intro).push(line);
  }
  return { intro: intro.join('\n').trim(), blocks };
})();

/** The block pages, in the order pages/blocks.md lists them. */
export const BLOCK_PAGES: Array<PageInfo & { description: string }> = blockSections.blocks.map(({ slug }) => {
  const meta = blockMetas[`../../../registry/blocks/${slug}/meta.json`];
  return { id: `${SITE_BLOCKS}/${slug}`, title: meta?.title ?? slug, description: meta?.description ?? '', section: 'Blocks', wide: true };
});

function blockSource(id: string) {
  if (id === SITE_BLOCKS) return [
    blockSections.intro,
    BLOCK_PAGES.map((b) => `- [${b.title}](${SITE_URL}/#/${b.id})`).join('\n'),
  ].join('\n\n') + '\n';
  const page = BLOCK_PAGES.find((b) => b.id === id);
  const block = blockSections.blocks.find((b) => `${SITE_BLOCKS}/${b.slug}` === id);
  if (!page || !block) return '';
  return [`# ${page.title}`, page.description, block.lines.join('\n').trim()].filter(Boolean).join('\n\n') + '\n';
}

/** Every page by id (sidebar pages, the Blocks overview and each block), in order. */
export const PAGE_LIST: PageInfo[] = [
  ...NAV.sections.flatMap((s) => s.pages.map((p) => ({ ...p, section: s.section }))),
  ...NAV.standalone,
  ...BLOCK_PAGES.map(({ description: _, ...page }) => page),
];
export const PAGES: Record<string, PageInfo> = Object.fromEntries(PAGE_LIST.map((p) => [p.id, p]));

/** Component docs in reading order (prev / next). */
export const PAGE_ORDER: string[] = NAV.sections.flatMap((s) => s.pages.map((p) => p.id));
/** Blocks in reading order (prev / next), after the overview. */
export const BLOCK_ORDER: string[] = [SITE_BLOCKS, ...BLOCK_PAGES.map((b) => b.id)];
export const isBlockPage = (id: string) => id === SITE_BLOCKS || id.startsWith(`${SITE_BLOCKS}/`);

/** A page's Markdown source. */
export const pageSource = (id: string): string => isBlockPage(id) ? blockSource(id) : sources[`../pages/${id}.md`] ?? '';

export const pageUrl = (id: string) => `${SITE_URL}/#/${id}`;
/** Where the build writes the page as Markdown (tools/docs/pages-md.mjs). */
export const pageMdPath = (id: string) => `md/${id}.md`;
