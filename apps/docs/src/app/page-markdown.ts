/* "Copy page": the page's Markdown file with every `{% demo %}` replaced by the example's files — the same
   transform tools/docs/pages-md.mjs applies at build time for md/<page>.md and llms.txt (../page-md.ts). */
import { demoText } from '../demo-resolver';
import { pageMarkdown as render, type DemoText } from '../page-md';
import { PAGES, pageSource } from '../pages';
import { SITE_URL } from './registry';

export { pageMdPath } from '../page-md';

export async function pageMarkdown(id: string): Promise<string> {
  const page = PAGES[id];
  if (!page) return '';
  const md = pageSource(id);
  const srcs = [...md.matchAll(/^\{%\s*demo\s+.*?src="([^"]+)"/gm)].map((m) => m[1]);
  const demos = new Map<string, DemoText | undefined>(await Promise.all(srcs.map(async (s) => [s, await demoText(s)] as const)));
  return render(md, { page, siteUrl: SITE_URL, isPage: (t) => !!PAGES[t], demo: (s) => demos.get(s) });
}
