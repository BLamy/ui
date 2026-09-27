#!/usr/bin/env node
/* Writes every docs page as Markdown to apps/docs/public/md/<page>.md (served at /ui/md/<page>.md — "View as
 * Markdown" and the ChatGPT / Claude links point there), plus apps/docs/public/llms.txt indexing them.
 *
 * Each page is its Markdown file (apps/docs/pages/<id>.md) with every `{% demo %}` carrying the demo's real files
 * inline — docstream's resolveDemosToMarkdown over the docs' own resolver (apps/docs/src/demos.ts), loaded through
 * Vite's SSR module loader so its import.meta.glob config applies — the exact renderable Markdown "Copy page"
 * produces. Fails if a demo is missing, a registry block is not on the Blocks page, a page doesn't round-trip through
 * docstream's parse → serialize → parse, an export doesn't parse to the page's block structure plus its demos' files
 * (exportMismatches), or an Installation section is stale. */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const DOCS = join(ROOT, 'apps/docs');
const MD_OUT = join(DOCS, 'public/md');
const SITE = 'https://blamy.github.io/ui';

execFileSync(process.execPath, [join(ROOT, 'tools/docs/install-md.mjs'), '--check'], { stdio: 'inherit' });

const server = await createServer({
  configFile: join(DOCS, 'vite.config.mts'),
  server: { middlewareMode: true, hmr: false, watch: null },
  appType: 'custom',
  logLevel: 'error',
});
let failed = false;
try {
  const { exportPage, exportMismatches, missingDemos, unstablePages, PAGE_LIST } = await server.ssrLoadModule('/src/page-export.ts');

  const missing = await missingDemos();
  const blocksMd = readFileSync(join(DOCS, 'pages/blocks.md'), 'utf8');
  for (const slug of readdirSync(join(ROOT, 'registry/blocks'))) {
    if (existsSync(join(ROOT, 'registry/blocks', slug, 'meta.json')) && !blocksMd.includes(`src="blocks/${slug}"`)) {
      missing.push(`blocks: blocks/${slug} (registry block not on the Blocks page)`);
    }
  }
  if (missing.length) throw new Error(`missing demos\n  ${missing.join('\n  ')}`);
  const unstable = unstablePages();
  if (unstable.length) throw new Error(`pages that don't round-trip through docstream's parse → serialize: ${unstable.join(', ')}`);
  const mismatched = await exportMismatches();
  if (mismatched.length) throw new Error(`Copy page exports that aren't the page plus its demos' files\n  ${mismatched.join('\n  ')}`);

  rmSync(MD_OUT, { recursive: true, force: true });
  mkdirSync(MD_OUT, { recursive: true });
  for (const { id } of PAGE_LIST) writeFileSync(join(MD_OUT, `${id}.md`), await exportPage(id));

  const sections = [...new Set(PAGE_LIST.map((p) => p.section))];
  const llms = [
    '# BL UI',
    '',
    '> iOS-flavored React components (containers, lists, haptics, tokens, a workbench composer and chat shells) on react-aria-components, Tailwind v4 and shadcn conventions. Install with `npm i @brett_lamy/ui`, or add items from the shadcn registry at https://blamy.github.io/ui/r/<item>.json.',
    '',
    ...sections.flatMap((s) => [
      `## ${s}`,
      '',
      ...PAGE_LIST.filter((p) => p.section === s).map((p) => `- [${p.title}](${SITE}/md/${p.id}.md)`),
      '',
    ]),
    '## Registry',
    '',
    `- [registry.json](${SITE}/r/registry.json): every shadcn registry item (bl-ui base, components, blocks)`,
    '',
  ].join('\n');
  writeFileSync(join(DOCS, 'public/llms.txt'), llms);
  console.log(`pages-md: ${PAGE_LIST.length} pages → apps/docs/public/md, llms.txt`);
} catch (e) {
  console.error(`pages-md: ${e instanceof Error ? e.message : e}`);
  failed = true;
} finally {
  await server.close();
}
process.exit(failed ? 1 : 0);
