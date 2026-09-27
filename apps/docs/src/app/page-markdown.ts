/* A docs page as plain Markdown — for "Copy page", "View as Markdown" and the build's md/<page>.md files:
   the page source with the Installation section in place and each live example replaced by its code. */
import { PAGES, PAGE_ORDER } from '../content';
import { LIVE } from '../live/docs-live';
import { installMarkdown } from './install-section';
import { installFor, SITE_URL } from './registry';

/** Splits a page into its lead (the H1 and the paragraph after it) and the rest; Installation goes between. */
export function splitLead(md: string): [string, string] {
  const lines = md.split('\n');
  let i = lines.findIndex((l) => l.startsWith('# '));
  if (i < 0) return ['', md];
  i++;
  while (i < lines.length && !lines[i].trim()) i++;
  // One plain paragraph (not a fence, table, list, heading or live marker) stays with the title.
  if (i < lines.length && !/^(```|\||#|%%|[-*] |\d+\. |>)/.test(lines[i])) {
    while (i < lines.length && lines[i].trim()) i++;
  }
  return [lines.slice(0, i).join('\n').trim(), lines.slice(i).join('\n').trim()];
}

/** Every page in nav order (tools/docs/pages-md.mjs writes md/<id>.md for each). */
export const PAGE_INDEX = PAGE_ORDER.filter((id) => PAGES[id]).map((id) => ({ id, title: PAGES[id].title, section: PAGES[id].section }));

export const pageUrl = (id: string) => `${SITE_URL}/#/${id}`;
export const pageMdPath = (id: string) => `md/${id}.md`;

function liveCode(name: string): string {
  const spec = LIVE[name];
  if (!spec) return '';
  const code = spec.codeFor ? spec.codeFor(spec.variants?.[0]?.id ?? '') : spec.code;
  return [`**Example — ${spec.title}**`, '', '```tsx', (code || '').trim(), '```'].join('\n');
}

export function pageMarkdown(id: string): string {
  const page = PAGES[id];
  if (!page) return '';
  const entry = installFor(id);
  let md = page.markdown;
  if (entry) {
    const [lead, rest] = splitLead(md);
    md = [lead, installMarkdown(entry), rest].filter(Boolean).join('\n\n');
  }
  md = md
    .replace(/^%%live:(\w+)%%$/gm, (_, name: string) => liveCode(name))
    .replace(/^%%demo:(\w+)%%$/gm, () => `> An interactive demo runs here on the live page: ${pageUrl(id)}`)
    // Internal page links become absolute, so the Markdown works outside the site.
    .replace(/\]\(#([\w-]+)\)/g, (m, target: string) => (PAGES[target] || target === 'blocks' ? `](${pageUrl(target)})` : m));
  return `${md.trim()}\n\n---\n\nSource: ${pageUrl(id)} · BL UI (${page.section})\n`;
}
