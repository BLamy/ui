/** Shape of each block's `meta.json` (registry/blocks/<slug>/meta.json). The docs Blocks page and
 *  tools/registry build read these; `files` are paths relative to the block folder. */
export interface BlockMeta {
  name: string;
  title: string;
  description: string;
  categories?: string[];
  /** Entry is `page.tsx` (default export = the whole block). */
  files: string[];
  /** Extra npm dependencies beyond @brett_lamy/ui. */
  dependencies?: string[];
}
