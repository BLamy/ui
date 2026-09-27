#!/usr/bin/env node
/* Writes every docs page as Markdown to apps/docs/public/md/<page>.md (served at /ui/md/<page>.md — "View as
 * Markdown" and the ChatGPT / Claude links point there), plus apps/docs/public/llms.txt indexing them.
 *
 * Each page is its Markdown file (apps/docs/pages/<id>.md) with every `{% demo src="…" %}` replaced by the example's
 * real files, read from disk: apps/docs/examples/<page>/<example>/ (entry first) or, for `blocks/<slug>`, the files
 * listed in registry/blocks/<slug>/meta.json. The transform is apps/docs/src/page-md.ts — the same one "Copy page"
 * uses — imported directly (Node strips its types). Fails if a demo is missing or an Installation section is stale. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pageList, pageMarkdown, splitDemos } from '../../apps/docs/src/page-md.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DOCS = join(ROOT, 'apps/docs');
const MD_OUT = join(DOCS, 'public/md');
const SITE = 'https://blamy.github.io/ui';

execFileSync(process.execPath, [join(ROOT, 'tools/docs/install-md.mjs'), '--check'], { stdio: 'inherit' });

const walk = (dir) => readdirSync(dir).flatMap((f) => (statSync(join(dir, f)).isDirectory() ? walk(join(dir, f)) : [join(dir, f)]));

/** A demo's title and files, entry first — straight from disk. */
function demo(src) {
  if (src.startsWith('blocks/')) {
    const dir = join(ROOT, 'registry/blocks', src.slice('blocks/'.length));
    if (!existsSync(join(dir, 'meta.json'))) return undefined;
    const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
    return { title: meta.title, files: meta.files.map((f) => [f, readFileSync(join(dir, f), 'utf8')]) };
  }
  const dir = join(DOCS, 'examples', src);
  if (!existsSync(join(dir, 'meta.json'))) return undefined;
  const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
  const entry = meta.entry ?? 'index.tsx';
  const names = walk(dir)
    .map((f) => relative(dir, f))
    .filter((f) => f !== 'meta.json')
    .sort((a, b) => (a === entry ? -1 : b === entry ? 1 : a.localeCompare(b)));
  return { title: meta.title, files: names.map((f) => [f, readFileSync(join(dir, f), 'utf8')]) };
}

const nav = JSON.parse(readFileSync(join(DOCS, 'pages/nav.json'), 'utf8'));
const pages = pageList(nav);
const isPage = (id) => pages.some((p) => p.id === id);
const missing = [];

rmSync(MD_OUT, { recursive: true, force: true });
mkdirSync(MD_OUT, { recursive: true });
for (const page of pages) {
  const md = readFileSync(join(DOCS, 'pages', `${page.id}.md`), 'utf8');
  for (const s of splitDemos(md)) if (s.kind === 'demo' && !demo(s.src)) missing.push(`${page.id}: ${s.src}`);
  writeFileSync(join(MD_OUT, `${page.id}.md`), pageMarkdown(md, { page, siteUrl: SITE, isPage, demo }));
}
const blocksMd = readFileSync(join(DOCS, 'pages/blocks.md'), 'utf8');
for (const slug of readdirSync(join(ROOT, 'registry/blocks'))) {
  if (existsSync(join(ROOT, 'registry/blocks', slug, 'meta.json')) && !blocksMd.includes(`src="blocks/${slug}"`)) missing.push(`blocks: blocks/${slug} (registry block not on the Blocks page)`);
}
if (missing.length) {
  console.error(`pages-md: missing examples\n  ${missing.join('\n  ')}`);
  process.exit(1);
}

const sections = [...new Set(pages.map((p) => p.section))];
const llms = [
  '# BL UI',
  '',
  '> iOS-flavored React components (containers, lists, haptics, tokens, a workbench composer and chat shells) on react-aria-components, Tailwind v4 and shadcn conventions. Install with `npm i @brett_lamy/ui`, or add items from the shadcn registry at https://blamy.github.io/ui/r/<item>.json.',
  '',
  ...sections.flatMap((s) => [
    `## ${s}`,
    '',
    ...pages.filter((p) => p.section === s).map((p) => `- [${p.title}](${SITE}/md/${p.id}.md)`),
    '',
  ]),
  '## Registry',
  '',
  `- [registry.json](${SITE}/r/registry.json): every shadcn registry item (bl-ui base, components, blocks)`,
  '',
].join('\n');
writeFileSync(join(DOCS, 'public/llms.txt'), llms);
console.log(`pages-md: ${pages.length} pages → apps/docs/public/md, llms.txt`);
