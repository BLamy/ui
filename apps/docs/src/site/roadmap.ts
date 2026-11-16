/* The roadmap site's files: the hand-written pages in apps/docs/roadmap/, plus three generated from the library manifest
   and the code — the package map, the module map and the docs-coverage report — so they can't go stale. */
import { uiUnits } from 'virtual:bl-site-files';
import { CATEGORIES, LIBRARIES, LIBRARY, SPLIT_CHANGES, STATUS_LABEL, byCategory, ownerOf, packageNames, packageOf, type Library } from './libraries';

const written = import.meta.glob('../../roadmap/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const uiIndex = import.meta.glob('../../../../packages/ui/src/index.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const uiPages = import.meta.glob('../../pages/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const SITE = 'https://blamy.github.io/ui/#';
const link = (l: Library) => `[${l.name}](${SITE}/libraries/${l.id})`;
const node = (id: string) => id.replace(/-/g, '_');

function packagesPage(): string {
  // Libraries that ship inside another package are drawn inside it.
  const hosts = LIBRARIES.filter((l) => LIBRARIES.some((m) => m.partOf === l.id));
  const graph = [
    '```mermaid',
    'flowchart RL',
    ...hosts.flatMap((h) => [
      `  subgraph ${node(h.id)}_pkg["${h.npm}"]`,
      ...LIBRARIES.filter((l) => l.id === h.id || l.partOf === h.id).map((l) => `    ${node(l.id)}["${l.name}"]`),
      '  end',
    ]),
    ...LIBRARIES.filter((l) => !l.partOf && !hosts.includes(l)).map((l) => `  ${node(l.id)}["${l.name}${l.status === 'planned' ? ' (planned)' : ''}"]`),
    ...LIBRARIES.flatMap((l) => l.dependsOn.map((d) => `  ${node(l.id)} --> ${node(d)}`)),
    '```',
  ].join('\n');
  const npmRows = [
    ...LIBRARIES.flatMap((l) => packageNames(l).map((name) => `| \`${name}\` | ${link(l)} | ${STATUS_LABEL[l.status]} |`)),
    ...LIBRARIES.flatMap((l) => (l.formerly ?? []).map((f) => `| \`${f.npm}\` | ${link(l)} | Frozen at ${f.last}: now \`${l.npm}\` |`)),
  ];
  const sections = CATEGORIES.map((c) => [
    `## ${c.label}`,
    ...byCategory(c.id).map((l) => [
      `### ${l.name}`,
      `\`${l.npm}\` · **${STATUS_LABEL[l.status]}**${l.partOf ? ` · ships in \`${packageOf(l).npm}\`` : ''} · [library page](${SITE}/libraries/${l.id})${l.docs ? ` · [docs](${SITE}/${l.docs})` : ''}`,
      l.description,
      `| Builds on | Brings from npm | Units from packages/ui/src |\n| --- | --- | --- |\n| ${l.dependsOn.map((d) => link(LIBRARY[d])).join(', ') || '—'} | ${(l.external ?? []).map((e) => `\`${e}\``).join(', ') || '—'} | ${l.modules?.length ? l.modules.map((m) => `\`${m}\``).join(', ') : l.id === 'ui' ? 'everything no other library lists' : '—'} |`,
    ].join('\n\n')),
  ].join('\n\n'));
  return [
    '---\ndescription: Every BL library — what it owns, what it builds on, what it brings from npm, and which npm package it ships in.\n---',
    '# Package map',
    `${LIBRARIES.length} libraries in ${CATEGORIES.length} groups. An arrow points at what a library builds on; libraries drawn inside a box ship in that npm package. Nothing points up a tier, and no two packages need each other — \`libraries.test.ts\` checks both against the code.`,
    graph,
    '## On npm',
    `| Package | Library | Status |\n| --- | --- | --- |\n${npmRows.join('\n')}`,
    ...sections,
  ].join('\n\n') + '\n';
}

function modulePage(): string {
  const rows = uiUnits.map((u) => {
    const l = ownerOf(u);
    const pkg = packageOf(l);
    return `| \`${u}\` | ${link(l)} | \`${pkg.npm}\`${l.status === 'planned' ? ' (planned)' : ''} |`;
  });
  const moving = uiUnits.filter((u) => ownerOf(u).status === 'planned').length;
  return [
    '---\ndescription: Every unit of packages/ui/src and the library it belongs to after the split.\n---',
    '# Module map',
    `Of the ${uiUnits.length} units of \`packages/ui/src\` — a file of \`components/\` or \`lib/\`, a folder there, docstream and its editor as one folder each, and the package's entry files — ${moving} move to a planned package and the rest stay in \`@brett_lamy/ui\`, docstream and the editor among them. The table is generated from the plan (\`apps/docs/src/site/libraries.ts\`), and a test checks it against the code: every listed unit exists, none is listed twice, and no library would import from one it doesn't build on.`,
    '## Code changes beyond moving files',
    SPLIT_CHANGES.map((c) => `- **\`${c.unit}\`** imports \`${c.imports}\`. ${c.change}`).join('\n'),
    '## Every unit',
    `| Unit | Library | Ships in |\n| --- | --- | --- |\n${rows.join('\n')}`,
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
    'A library\'s docs are a folder of Markdown pages, numbered for order, with the live examples they embed beside them (`examples/<page>/<example>/`). The site mounts each folder with docstream\'s DocsSite — sidebar from the folders, search, an outline, "Copy page" — under `#/<library>`. Docstream\'s and the editor\'s work this way today: their folders are `apps/docstream-playground/docs` and `apps/docstream-editor-playground/docs`, served on their own by the playgrounds and here at [#/docstream](https://blamy.github.io/ui/#/docstream) and [#/docstream-editor](https://blamy.github.io/ui/#/docstream-editor). Each planned package gets the same when it lands.',
    '## Where the ui pages go',
    `The ${Object.keys(uiPages).length} pages under today's sidebar move to the library that owns what they describe: Calendar, DatePicker, NaturalTimeInput and CronEditor to Time; Diagram, StateDiagram and CloudflareDiagram to Diagram; SqlConsole to SQL and PGlite to PGlite; the Composer pages to Composer; and so on. Guides that span libraries (Theming, Styling, the registry, Working with LLMs) stay at the top of the site, and every \`#/<page>\` link keeps working.`,
    '## Not documented yet',
    `Of the ${total} names \`@brett_lamy/ui\` exports from its barrel (props types aside), **${count}** aren't mentioned on any docs page. They are what the split's docs fill in first — mostly the headless helpers behind the components:`,
    rows.length ? `| Module | Exports no page mentions |\n| --- | --- |\n${rows.join('\n')}` : 'None: every export is on a page.',
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
