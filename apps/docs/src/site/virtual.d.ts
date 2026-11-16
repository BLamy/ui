/** apps/docs/vite.config.mts: file lists the site reports on, without bundling the files. */
declare module 'virtual:bl-site-files' {
  /** packages/ui/src modules (components/… and lib/…, tests and stories aside), sorted. */
  export const uiModules: string[];
  /** Markdown pages across the libraries' docs folders. */
  export const libraryPages: number;
}
