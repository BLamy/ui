#!/usr/bin/env node
/* The Copy page acceptance check: "copy a page's Markdown, paste it into a markdown renderer → the same page".
 * Needs the docs dev server (DOCS_URL, default http://localhost:4433) and apps/docs/public/md from pages-md.
 *
 * For every page:
 *   1. click Copy page and read the clipboard — it must be the renderable export (apps/docs/public/md/<id>.md:
 *      `{% demo %}` blocks with their files inline, no plain "**Example —**" form);
 *   2. render the clipboard through docstream at `?render` (the docs' renderer, with the demo resolver) and at
 *      `?render&resolver=0` (no resolver: the demos come from the inline files) and compare each to the page:
 *      headings, titled tab sections, command boxes, tabs, code blocks, demos (viewer, title, variants, files);
 *   3. paste the clipboard into the MarkdownEditor on the MarkdownEditor page and count the blocks it made.
 *
 *   node tools/docs/copy-page-check.mjs [page …] [--shots <dir>]   (--shots: full-page screenshots of page and renders)
 */
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BASE = process.env.DOCS_URL || 'http://localhost:4433';
const args = process.argv.slice(2);
const shotsAt = args.indexOf('--shots');
const shots = shotsAt >= 0 ? args.splice(shotsAt, 2)[1] : null;
if (shots) mkdirSync(shots, { recursive: true });
const NAV = JSON.parse(readFileSync(join(ROOT, 'apps/docs/pages/nav.json'), 'utf8'));
const all = [...NAV.sections.flatMap((s) => s.pages.map((p) => p.id)), ...NAV.standalone.map((p) => p.id)];
const pages = args.length ? args : all;

/** The rendered document as a list of comparable lines (runs in the page). */
function structure() {
  const article = document.querySelector('.dk-md [data-docstream-blocks]');
  const text = (el) => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const lines = [];
  const walk = (blocks, depth) => {
    for (const el of blocks.children) {
      const pad = '  '.repeat(depth);
      const c = el.classList;
      if (/^H[1-6]$/.test(el.tagName)) lines.push(`${pad}${el.tagName.toLowerCase()} ${text(el)}`);
      else if (c.contains('docs-tabs-section')) {
        const tabs = [...el.querySelectorAll('.docs-tabs-section-head [role=tab]')].map(text);
        lines.push(`${pad}section "${text(el.querySelector('.docs-tabs-section-title'))}" [${tabs.join(' | ')}]`);
        const body = el.querySelector('.docs-tabs-section-body > [data-docstream-blocks]');
        if (body) walk(body, depth + 1);
      } else if (c.contains('docs-command')) {
        const pms = [...el.querySelectorAll('[role=tab]')].map(text);
        lines.push(`${pad}command [${pms.join(' ')}] ${text(el.querySelector('.docs-tabs-code-body'))}`);
      } else if (c.contains('docs-tabs')) {
        lines.push(`${pad}tabs [${[...el.querySelectorAll(':scope > .docs-tabs-header [role=tab], :scope > .docs-tabs-code-head [role=tab]')].map(text).join(' | ')}]`);
      } else if (c.contains('docs-code')) {
        const numbered = !!el.querySelector('.docs-code-lineno');
        const header = !!el.querySelector('.docs-code-header');
        lines.push(`${pad}code ${el.dataset.language ?? ''}${header ? ' +header' : ''}${numbered ? ' +lines' : ''} ${text(el.querySelector('pre')).slice(0, 60)}`);
      } else if (c.contains('docs-demo')) {
        const viewer = c.contains('docs-demo-single') ? 'single' : 'multi';
        const variants = [...el.querySelectorAll('.docs-demo-variants [role=radio], .docs-demo-variants button')].map(text);
        const files = viewer === 'multi'
          ? [...el.querySelectorAll('.docs-demo-file')].map(text)
          : [...el.querySelectorAll('.docs-react-demo-code-copy, .docs-react-demo-code [aria-label^="Copy "]')].map((b) => b.getAttribute('aria-label').replace(/^Copy /, ''));
        const status = text(el.querySelector('.docs-demo-status'));
        lines.push(`${pad}demo ${viewer} "${text(el.querySelector('.docs-demo-title'))}" variants=[${variants.join(',')}] files=[${[...new Set(files)].join(',')}]${status ? ` status=${status}` : ''}`);
      } else if (c.contains('docs-hint')) lines.push(`${pad}hint ${[...c].find((x) => x.startsWith('docs-hint-')) ?? ''}`);
      else if (el.tagName === 'P') lines.push(`${pad}p ${text(el).slice(0, 50)}`);
      else lines.push(`${pad}${el.tagName.toLowerCase()}${el.className ? '.' + [...c][0] : ''}`);
    }
  };
  if (article) walk(article, 0);
  return lines;
}

/** Page lines vs render lines: the differing ones (statuses are compared separately — the Markdown can't carry them). */
function diff(a, b) {
  const strip = (l) => l.replace(/ status=\S.*$/, '');
  const out = [];
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) if (strip(a[i] ?? '') !== strip(b[i] ?? '')) out.push(`    page:   ${a[i] ?? '∅'}\n    render: ${b[i] ?? '∅'}`);
  return out;
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
const settle = async (page) => {
  await page.waitForTimeout(1200);
  const h = await page.evaluate(() => document.getElementById('bldocs-scroll')?.scrollHeight ?? 900);
  await page.setViewportSize({ width: 1400, height: Math.min(h, 16000) });
  await page.waitForTimeout(1500);
};
let failures = 0;
const copied = {};
for (const id of pages) {
  const problems = [];
  const page = await context.newPage();
  await page.route(/arcgisonline|openstreetmap|tile\./, (r) => r.abort());
  await page.goto(`${BASE}/?theme=light#/${id}`, { waitUntil: 'load' });
  await page.locator('.docs-page-actions-main').waitFor();
  await page.locator('.docs-page-actions-main').click();
  await page.waitForTimeout(400);
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  copied[id] = clip;
  const expected = readFileSync(join(ROOT, 'apps/docs/public/md', `${id}.md`), 'utf8');
  if (clip !== expected) problems.push('  clipboard ≠ apps/docs/public/md export');
  if (/\*\*Example — /.test(clip)) problems.push('  clipboard has the plain (non-renderable) demo form');
  const demoTags = (clip.match(/^\{% demo /gm) ?? []).length;
  const enddemos = (clip.match(/^\{% enddemo %\}$/gm) ?? []).length;
  if (demoTags !== enddemos) problems.push(`  ${demoTags} demo tags but ${enddemos} {% enddemo %}: not every demo carries its files`);
  await settle(page);
  const want = await page.evaluate(structure);
  if (process.env.VERBOSE) console.log(want.map((l) => `    ${l}`).join('\n'));
  if (shots) await page.screenshot({ path: join(shots, `${id}-page.png`), fullPage: true });
  await page.close();

  for (const mode of ['resolver', 'inline']) {
    const r = await context.newPage();
    await r.addInitScript((md) => window.sessionStorage.setItem('bldocs-render', md), clip);
    await r.goto(`${BASE}/?theme=light&render${mode === 'inline' ? '&resolver=0' : ''}`, { waitUntil: 'load' });
    await r.locator('.dk-md [data-docstream-blocks]').first().waitFor();
    await settle(r);
    const got = await r.evaluate(structure);
    if (shots) await r.screenshot({ path: join(shots, `${id}-render-${mode}.png`), fullPage: true });
    const d = diff(want, got);
    if (d.length) problems.push(`  render (${mode}) differs from the page:\n${d.slice(0, 12).join('\n')}${d.length > 12 ? `\n    … ${d.length - 12} more` : ''}`);
    if (mode === 'inline') {
      const lost = want.filter((l) => / status=/.test(l)).length - got.filter((l) => / status=/.test(l)).length;
      if (lost > 0) console.log(`  note ${id}: ${lost} demo status label(s) not carried by the Markdown (meta.status isn't a demo attribute)`);
    }
    await r.close();
  }
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${id}  (${want.length} blocks, ${demoTags} demos)`);
  if (problems.length) { failures++; console.log(problems.join('\n')); }
}

/* Paste each copied page into the MarkdownEditor (the notes demo on the MarkdownEditor page). */
if (pages.length) {
  const ed = await context.newPage();
  await ed.goto(`${BASE}/?theme=light#/markdown-editor`, { waitUntil: 'load' });
  await settle(ed);
  const editor = ed.locator('[data-docstream-demo] .ProseMirror').first();
  await editor.waitFor();
  for (const id of pages) {
    const clip = copied[id];
    await editor.focus();
    await ed.keyboard.press('ControlOrMeta+A');
    await ed.keyboard.press('Delete');
    await editor.evaluate((el, text) => {
      const data = new DataTransfer();
      data.setData('text/plain', text);
      el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
    }, clip);
    await ed.waitForTimeout(800);
    const got = await editor.evaluate((el) => ({
      demos: el.querySelectorAll('.gb-demo-block').length,
      viewers: el.querySelectorAll('.gb-demo-block .docs-demo').length,
      commands: el.querySelectorAll('.gb-command').length,
      sections: el.querySelectorAll('.gb-tabs-section').length,
      headings: el.querySelectorAll(':scope > :is(h1, h2, h3)').length,
    }));
    const want = {
      demos: (clip.match(/^\{% demo /gm) ?? []).length,
      commands: (clip.match(/\{% command\b/g) ?? []).length,
      sections: (clip.match(/^\{% tabs title=/gm) ?? []).length,
      headings: (clip.replace(/^(`{3,})[\s\S]*?^\1\s*$/gm, '').match(/^#{1,3} /gm) ?? []).length,
    };
    want.viewers = want.demos;
    const bad = Object.keys(want).filter((k) => want[k] !== got[k]);
    console.log(`${bad.length ? 'FAIL' : 'ok  '} editor paste ${id}  ${Object.entries(got).map(([k, v]) => `${k}=${v}${want[k] !== v ? `(want ${want[k]})` : ''}`).join(' ')}`);
    if (bad.length) failures++;
    if (shots && id === pages[0]) await ed.locator('[data-docstream-demo]').first().screenshot({ path: join(shots, `${id}-editor-paste.png`) });
  }
  await ed.close();
}
await browser.close();
console.log(failures ? `${failures} failing` : 'all pages: Copy page renders back as the page');
process.exit(failures ? 1 : 0);
