/** Shape of each component entry (registry/components/<name>.json). tools/registry/build.mjs turns it into
 *  `registry/components/<name>.tsx` (a thin named re-export, installed as `@/components/ui/<name>`) plus a
 *  `registry:ui` item in registry.json; the docs read it for the page's Installation section. */
export interface ComponentEntry {
  /** Registry item name — the URL is https://blamy.github.io/ui/r/<name>.json. */
  name: string;
  title: string;
  description: string;
  /** Docs page id (apps/docs/src/content.ts) that shows this entry's install instructions. */
  page: string;
  /** Value exports re-exported by the component file. The first is the one the docs import line leads with. */
  exports: string[];
  /** Names the docs' import line shows (default: the first few component exports). */
  imports?: string[];
  /** Extra type exports. Types whose name starts with one of `exports` (`ComposerProps`…) are added automatically. */
  types?: string[];
  /** Package the parts come from (default '@brett_lamy/ui'). */
  from?: string;
}
