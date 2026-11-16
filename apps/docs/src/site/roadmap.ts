/* The roadmap site's files: the hand-written pages in apps/docs/roadmap/, plus three generated from the library
   manifest and the code — the package map, the module map, and the docs-coverage report — so they can't go stale. */
import { uiModules } from 'virtual:bl-site-files';
import { CATEGORIES, LIBRARIES, LIBRARY, REMOVED_SHIMS, SPLIT_CHANGES, byCategory, type Library } from './libraries';

const written = import.meta.glob('../../roadmap/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const uiIndex = import.meta.glob('../../../../packages/ui/src/index.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const uiPages = import.meta.glob('../../pages/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const SITE = 'https://blamy.github.io/ui/#';
const link = (l: Library) => `[${l.name}](${SITE}/libraries/${l.id})`;
const status = (l: Library) => (l.status === 'live' ? 'On npm' : 'Planned');

function packagesPage(): string {
  const graph = [
    '```mermaid',
    'flowchart RL',
    ...LIBRARIES.map((l) => `  ${l.id.replace(/-/g, '_')}["${l.name}"]`),
    ...LIBRARIES.flatMap((l) => l.dependsOn.map((d) => `  ${l.id.replace(/-/g, '_')} --> ${d.replace(/-/g, '_')}`)),
    '```',
  ].join('\n');
  const sections = CATEGORIES.map((c) => [
    `## ${c.label}`,
    ...byCategory(c.id).map((l) => [
      `### ${l.name}`,
      `\`${l.npm}\` · **${status(l)}** · [library page](${SITE}/libraries/${l.id})${l.docs ? ` · [docs](${SITE}/${l.docs})` : ''}`,
      l.description,
      `| Builds on | Brings from npm | Modules from ui |\n| --- | --- | --- |\n| ${l.dependsOn.map((d) => link(LIBRARY[d])).join(', ') || '—'} | ${(l.external ?? []).map((e) => `\`${e}\``).join(', ') || '—'} | ${l.modules?.length ?? (l.id === 'ui' ? 'the rest' : '—')} |`,
    ].join('\n\n')),
  ].join('\n\n'));
  return [
    '---\ndescription: Every BL library — what it owns, what it builds on, and what it brings from npm.\n---',
    '# Package map',
    `${LIBRARIES.length} packages in five groups. An arrow points at what a package builds on; nothing points up a tier.`,
    graph,
    ...sections,
  ].join('\n\n') + '\n';
}

function modulePage(): string {
  const files = uiModules;
  const owner = (file: string) => {
    for (const l of LIBRARIES) for (const m of l.modules ?? []) if (m.endsWith('/') ? file.startsWith(m) : file === m) return l;
    return null;
  };
  const rows = files.map((f) => {
    const l = owner(f);
    const shim = REMOVED_SHIMS.includes(f);
    return `| \`${f}\` | ${shim ? 'removed in 7.0 (import from docstream)' : l ? link(l) : `${link(LIBRARY.ui)} (stays)`} |`;
  });
  const moving = files.filter((f) => owner(f)).length;
  return [
    '---\ndescription: Every file in packages/ui/src and the package it moves to in the split.\n---',
    '# Module map',
    `Of the ${files.length} source files in \`packages/ui/src\` (tests and stories aside), ${moving} move to another package, ${REMOVED_SHIMS.length} are docstream re-exports that go in 7.0, and the rest stay in the core. The table is generated from the plan's manifest (\`apps/docs/src/site/libraries.ts\`), and a test checks it against the code: every listed module exists, none is listed twice, and no package would import from one it doesn't build on.`,
    '## Code changes beyond moving files',
    SPLIT_CHANGES.map((c) => `- **\`${c.unit}\`** imports \`${c.imports}\`. ${c.change}`).join('\n'),
    '## Every file',
    `| File | Moves to |\n| --- | --- |\n${rows.join('\n')}`,
  ].join('\n\n') + '\n';
}

function docsPage(): string {
  const index = Object.values(uiIndex)[0] ?? '';
  const pages = Object.values(uiPages).join('\n');
  const missing = new Map<string, string[]>();
  let total = 0;
  for (const m of index.matchAll(/export\s+\{([^}]+)\}\s+from\s+'\.\/([^']+)'/g)) {
    for (const raw of m[1].split(',')) {
      const name = raw.trim().split(/\s+as\s+/).pop() ?? '';
      if (!name || raw.trim().startsWith('type ') || /Props$/.test(name)) continue;
      total++;
      if (!new RegExp(`\\b${name.replace(/\$/g, '\\$')}\\b`).test(pages)) missing.set(m[2], [...(missing.get(m[2]) ?? []), name]);
    }
  }
  const count = [...missing.values()].reduce((n, v) => n + v.length, 0);
  const rows = [...missing].map(([mod, names]) => `| \`${mod}\` | ${names.map((n) => `\`${n}\``).join(', ')} |`);
  return [
    '---\ndescription: How each library\'s docs are built, and which of @brett_lamy/ui\'s exports no page mentions yet.\n---',
    '# Docs',
    '## One docs folder per library',
    'Each package gets a `docs/` folder: Markdown pages, numbered for order, with the live examples they embed in `docs/examples/<page>/<example>/`. The site mounts every folder with docstream\'s DocsSite — sidebar from the folders, search, an outline, "Copy page" — under `#/<library>`, exactly as [docstream\'s docs](https://blamy.github.io/ui/#/docstream) work today. A test per package holds its docs to the same rules: every page round-trips, every relative link resolves, every `{% demo %}` has a folder.',
    '## Where the ui pages go',
    'The 130-odd pages under today\'s sidebar move to the library that owns what they describe: the Calendar, DatePicker, TimeInput and CronEditor pages to Time, SqlConsole and PGlite to SQL and PGlite, the Composer pages to Composer, and so on. Guides that span libraries (Theming, Styling, the registry, Working with LLMs) stay at the top of the site.',
    '## Not documented yet',
    `Of the ${total} names \`@brett_lamy/ui\` exports (props types aside), **${count}** aren't mentioned on any docs page. They are what the split's docs fill in first — mostly the headless helpers behind the components:`,
    `| Module | Exports no page mentions |\n| --- | --- |\n${rows.join('\n')}`,
    '{% hint style="info" %}\nThis report is computed from `packages/ui/src/index.ts` and `apps/docs/pages/` when the site builds, so it shrinks as pages are written.\n{% endhint %}',
  ].join('\n\n') + '\n';
}

/** The roadmap site, as DocsSite files. */
export const ROADMAP_FILES: Record<string, string> = {
  ...Object.fromEntries(Object.entries(written).map(([p, text]) => [p.replace('../../roadmap/', ''), text])),
  '01-packages.md': packagesPage(),
  '02-module-map.md': modulePage(),
  '04-docs.md': docsPage(),
};
