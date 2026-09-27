/* The docs' view of the shadcn registry (registry/): component entries drive each page's Installation section,
   block folders drive the Blocks gallery. Both are discovered by glob, so a new registry/components/<name>.json
   or registry/blocks/<slug>/ shows up without touching the docs. */
import type { ComponentType } from 'react';
import type { BlockMeta } from '../../../../registry/blocks/types';
import type { ComponentEntry } from '../../../../registry/components/types';

/** Where the static registry is served (tools/registry/build.mjs → apps/docs/public/r). */
export const REGISTRY_URL = 'https://blamy.github.io/ui/r';
export const SITE_URL = 'https://blamy.github.io/ui';
export const itemUrl = (name: string) => `${REGISTRY_URL}/${name}.json`;

const entries = import.meta.glob<ComponentEntry>('../../../../registry/components/*.json', { eager: true, import: 'default' });
const byPage = new Map<string, ComponentEntry>();
for (const e of Object.values(entries)) byPage.set(e.page, e);

/** The registry entry a docs page installs, if any. */
export const installFor = (page: string): ComponentEntry | undefined => byPage.get(page);

export interface Block extends BlockMeta {
  slug: string;
  /** Lazy loader for page.tsx (default export = the whole block). */
  load: () => Promise<{ default: ComponentType }>;
  /** Lazy loaders for each listed file's source, keyed by file name. */
  sources: Record<string, () => Promise<string>>;
}

const metas = import.meta.glob<BlockMeta>('../../../../registry/blocks/*/meta.json', { eager: true, import: 'default' });
const pages = import.meta.glob<{ default: ComponentType }>('../../../../registry/blocks/*/page.tsx');
const raws = import.meta.glob<string>(
  ['../../../../registry/blocks/*/*.{ts,tsx,css,json}', '!../../../../registry/blocks/*/*.stories.tsx'],
  { query: '?raw', import: 'default' },
);

export const BLOCKS: Block[] = Object.entries(metas)
  .map(([path, meta]) => {
    const dir = path.slice(0, -'meta.json'.length);
    const slug = dir.split('/').at(-2)!;
    const sources: Record<string, () => Promise<string>> = {};
    for (const f of meta.files) if (raws[dir + f]) sources[f] = raws[dir + f];
    return { ...meta, slug, load: pages[dir + 'page.tsx'], sources };
  })
  .filter((b) => b.load)
  .sort((a, b) => a.title.localeCompare(b.title));

export const blockBySlug = (slug: string) => BLOCKS.find((b) => b.slug === slug);
