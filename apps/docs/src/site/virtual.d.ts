/** apps/docs/vite.config.mts: what the site reports on, without bundling the files. */
declare module 'virtual:bl-site-files' {
  /** The units of packages/ui/src (src/site/plan-graph.ts), sorted. */
  export const uiUnits: string[];
  /** Markdown pages across docstream's and the editor's docs folders. */
  export const libraryPages: number;
  /** Per library id: the blocks that import it and the docs pages of its parts (src/site/showcase-graph.ts). */
  export const libraryShowcase: import('./showcase-graph').LibraryShowcase;
}
