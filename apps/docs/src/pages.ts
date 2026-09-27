/* The docs' pages: one docstream Markdown file per page (apps/docs/pages/<id>.md) and the nav manifest
   (apps/docs/pages/nav.json) that orders and titles them. */
import navJson from '../pages/nav.json';
import { pageList, type Nav, type PageInfo } from './page-md';

const sources = import.meta.glob<string>('../pages/*.md', { eager: true, query: '?raw', import: 'default' });

export const NAV: Nav = navJson as Nav;

/** Every page by id (sidebar pages and standalone ones like Blocks). */
export const PAGES: Record<string, PageInfo> = Object.fromEntries(pageList(NAV).map((p) => [p.id, p]));

/** Sidebar pages in reading order (prev / next). */
export const PAGE_ORDER: string[] = NAV.sections.flatMap((s) => s.pages.map((p) => p.id));

/** A page's Markdown source. */
export const pageSource = (id: string): string => sources[`../pages/${id}.md`] ?? '';
