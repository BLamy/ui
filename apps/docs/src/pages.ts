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
  /** Pages outside the sidebar list (the top-level Blocks page). */
  standalone: Array<NavPage & { section: string }>;
}
export interface PageInfo extends NavPage {
  section: string;
}

export const SITE_URL = 'https://blamy.github.io/ui';

const sources = import.meta.glob<string>('../pages/*.md', { eager: true, query: '?raw', import: 'default' });

export const NAV: Nav = navJson as Nav;

/** Every page by id (sidebar pages and standalone ones like Blocks), in order. */
export const PAGE_LIST: PageInfo[] = [
  ...NAV.sections.flatMap((s) => s.pages.map((p) => ({ ...p, section: s.section }))),
  ...NAV.standalone,
];
export const PAGES: Record<string, PageInfo> = Object.fromEntries(PAGE_LIST.map((p) => [p.id, p]));

/** Sidebar pages in reading order (prev / next). */
export const PAGE_ORDER: string[] = NAV.sections.flatMap((s) => s.pages.map((p) => p.id));

/** A page's Markdown source. */
export const pageSource = (id: string): string => sources[`../pages/${id}.md`] ?? '';

export const pageUrl = (id: string) => `${SITE_URL}/#/${id}`;
/** Where the build writes the page as Markdown (tools/docs/pages-md.mjs). */
export const pageMdPath = (id: string) => `md/${id}.md`;
