#!/usr/bin/env node
/* Writes every docs page as Markdown to apps/docs/public/md/<page>.md (served at /ui/md/<page>.md — "View as
 * Markdown" and the ChatGPT / Claude links point there), plus apps/docs/public/llms.txt indexing them.
 *
 * The Markdown comes from the same pageMarkdown() the "Copy page" button uses (apps/docs/src/app/page-markdown.ts):
 * it reads each live example's code from the example registry, so the docs app is bundled for Node first
 * (a Vite SSR build into apps/docs/node_modules/.md-ssr) and imported here. */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DOCS = join(ROOT, 'apps/docs');
const SSR_OUT = join(DOCS, 'node_modules/.md-ssr');
const MD_OUT = join(DOCS, 'public/md');

execFileSync(
  join(ROOT, 'node_modules/.bin/vite'),
  ['build', '--config', 'vite.config.mts', '--ssr', 'src/app/page-markdown.ts', '--outDir', SSR_OUT, '--emptyOutDir', '--logLevel', 'error'],
  { cwd: DOCS, stdio: ['ignore', 'ignore', 'inherit'] },
);

const { pageMarkdown, PAGE_INDEX } = await import(pathToFileURL(join(SSR_OUT, 'page-markdown.mjs')).href);
rmSync(MD_OUT, { recursive: true, force: true });
mkdirSync(MD_OUT, { recursive: true });
for (const { id } of PAGE_INDEX) writeFileSync(join(MD_OUT, `${id}.md`), pageMarkdown(id));

const SITE = 'https://blamy.github.io/ui';
const sections = [...new Set(PAGE_INDEX.map((p) => p.section))];
const llms = [
  '# BL UI',
  '',
  '> iOS-flavored React components (containers, lists, haptics, tokens, a workbench composer and chat shells) on react-aria-components, Tailwind v4 and shadcn conventions. Install with `npm i @brett_lamy/ui`, or add items from the shadcn registry at https://blamy.github.io/ui/r/<item>.json.',
  '',
  ...sections.flatMap((s) => [
    `## ${s}`,
    '',
    ...PAGE_INDEX.filter((p) => p.section === s).map((p) => `- [${p.title}](${SITE}/md/${p.id}.md)`),
    '',
  ]),
  '## Registry',
  '',
  `- [registry.json](${SITE}/r/registry.json): every shadcn registry item (bl-ui base, components, blocks)`,
  '',
].join('\n');
writeFileSync(join(DOCS, 'public/llms.txt'), llms);
console.log(`pages-md: ${PAGE_INDEX.length} pages → apps/docs/public/md, llms.txt`);
// The bundled app leaves timers running (haptics, motion); nothing else to wait for.
process.exit(0);
