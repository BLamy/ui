/* The roadmap site's files: the hand-written pages in apps/docs/roadmap/, plus three generated from the library manifest
   and the code — the package map, the module map and the docs-coverage report — so they can't go stale. */
import { uiUnits } from 'virtual:bl-site-files';
import { CATEGORIES, LIBRARIES, LIBRARY, LAYER_EXCEPTIONS, STATUS_LABEL, byCategory, ownerOf, type Library } from './libraries';

const written = import.meta.glob('../../roadmap/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const uiIndex = import.meta.glob('../../../../packages/ui/src/index.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const uiPages = import.meta.glob('../../pages/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const SITE = 'https://blamy.github.io/ui/#';
const link = (l: Library) => `[${l.name}](${SITE}/libraries/${l.id})`;
const node = (id: string) => id.replace(/-/g, '_');

/** `library-sizes.generated.json` (tools/size/measure.mjs): absent until the package has been built and measured. */
const sizeFiles = import.meta.glob('./library-sizes.generated.json', { import: 'default', eager: true }) as Record<string, { libraries?: Record<string, { gzip: number; lazy?: { gzip: number } }> }>;
const SIZES = Object.values(sizeFiles)[0]?.libraries ?? {};
const kb = (bytes: number) => `${(bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} kB`;
const sizeOf = (l: Library) => {
  const s = SIZES[l.id];
  if (!s) return '—';
  return s.lazy?.gzip ? `${kb(s.gzip)} (+${kb(s.lazy.gzip)} on demand)` : kb(s.gzip);
};
/** The shadcn item that installs a whole library: the core and every library with a generated entry have one. */
const registryItemOf = (l: Library) => (l.id === 'ui' ? 'library-ui' : l.entry ? `library-${l.entry}` : null);

function packagesPage(): string {
  const host = LIBRARY.ui;
  const graph = [
    '```mermaid',
    'flowchart RL',
    `  subgraph ${node(host.id)}_pkg["${host.npm}: the one npm package"]`,
    ...LIBRARIES.map((l) => `    ${node(l.id)}["${l.name}${l.status === 'planned' ? ' (planned)' : ''}"]`),
    '  end',
    ...LIBRARIES.flatMap((l) => l.dependsOn.map((d) => `  ${node(l.id)} --> ${node(d)}`)),
    '```',
  ].join('\n');
  const entryRows = LIBRARIES.map((l) => {
    const also = (l.alsoAt ?? []).map((e) => `, \`@brett_lamy/ui/${e}\``).join('');
    const item = registryItemOf(l);
    return `| ${link(l)} | \`${l.id === 'ui-sdk' ? '@brett_lamy/ui/sdk/…' : l.npm}\`${also} | ${item ? `\`${item}\`` : 'installs `@brett_lamy/ui`'} | ${sizeOf(l)} | ${STATUS_LABEL[l.status]} |`;
  });
  const frozen = LIBRARIES.flatMap((l) => (l.formerly ?? []).map((f) => `| \`${f.npm}\` | Frozen at ${f.last}: now \`${l.npm}\` |`));
  const sections = CATEGORIES.map((c) => [
    `## ${c.label}`,
    ...byCategory(c.id).map((l) => [
      `### ${l.name}`,
      `\`${l.npm}\` · **${STATUS_LABEL[l.status]}** · [library page](${SITE}/libraries/${l.id})${l.docs ? ` · [docs](${SITE}/${l.docs})` : ''}`,
      l.description,
      `| Builds on | Brings from npm | Units of packages/ui/src |\n| --- | --- | --- |\n| ${l.dependsOn.map((d) => link(LIBRARY[d])).join(', ') || '—'} | ${(l.external ?? []).map((e) => `\`${e}\``).join(', ') || '—'} | ${l.modules?.length ? l.modules.map((m) => `\`${m}\``).join(', ') : l.id === 'ui' ? 'everything no other library lists' : l.id === 'ui-sdk' ? 'the `vendor/ui-sdk` submodule, built into `dist/vendor/ui-sdk`' : '—'} |`,
    ].join('\n\n')),
  ].join('\n\n'));
  return [
    '---\ndescription: Every BL library — its entry of @brett_lamy/ui, its shadcn item, what it loads, what it builds on and what it brings from npm.\n---',
    '# Package map',
    `One npm package, \`${host.npm}\`, and ${LIBRARIES.length} libraries inside it, in ${CATEGORIES.length} groups. Each library is an entry of the package: an app installs one thing, imports the entries it uses, and its bundle carries nothing else. An arrow points at what a library builds on. Nothing points up a tier — \`libraries.test.ts\` checks that against the code.`,
    graph,
    '## Entries',
    `The package root is the core, with the foundation under it (${[...['tokens', 'motion', 'icons']].map((id) => link(LIBRARY[id])).join(', ')}). Every other library is imported from its own entry, and every module of every library is an entry too (\`@brett_lamy/ui/waveform\`). The shadcn item copies the same code into an app as source: \`npx shadcn@latest add https://blamy.github.io/ui/r/<item>.json\`.`,
    `| Library | Import | shadcn item | Loads (gzip) | Status |\n| --- | --- | --- | --- | --- |\n${entryRows.join('\n')}`,
    'Loads: everything the entry exports, minified and gzipped, with the npm packages it needs and without React or optional peers; "on demand" is what sits behind a dynamic import. An app that uses one component of a library loads less. `pnpm size` measures it from the built package, and CI fails when an entry grows past its budget (`tools/size/budget.json`).',
    ...(frozen.length ? ['## Former packages', `| Package | Now |\n| --- | --- |\n${frozen.join('\n')}`] : []),
    ...sections,
  ].join('\n\n') + '\n';
}

function modulePage(): string {
  const rows = uiUnits.map((u) => {
    const l = ownerOf(u);
    return `| \`${u}\` | ${link(l)} | \`${l.npm}\` |`;
  });
  const outside = uiUnits.filter((u) => ownerOf(u).id !== 'ui').length;
  return [
    '---\ndescription: Every unit of packages/ui/src and the library, and so the entry of @brett_lamy/ui, it belongs to.\n---',
    '# Module map',
    `Of the ${uiUnits.length} units of \`packages/ui/src\` — a file of \`components/\` or \`lib/\`, a folder there, docstream and its editor as one folder each, and the package's own entry files — ${uiUnits.length - outside} are the core, on the package root, and ${outside} belong to another library, on its entry. The table is generated from the plan (\`apps/docs/src/site/libraries.ts\`), and a test checks it against the code: every listed unit exists, none is listed twice, and no library imports from one it doesn't build on. The same plan writes the entries themselves (\`packages/ui/src/libraries/<entry>.ts\`) and the registry's \`library-<entry>\` items.`,
    '## Lazy links against the layering',
    LAYER_EXCEPTIONS.map((c) => `- **\`${c.unit}\`** imports \`${c.imports}\`. ${c.why}`).join('\n'),
    '## Every unit',
    `| Unit | Library | Import it from |\n| --- | --- | --- |\n${rows.join('\n')}`,
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
    'A library\'s docs are a folder of Markdown pages, numbered for order, with the live examples they embed beside them (`examples/<page>/<example>/`). The site mounts each folder with docstream\'s DocsSite — sidebar from the folders, search, an outline, "Copy page" — under `#/<library>`. Docstream\'s and the editor\'s work this way today: their folders are `apps/docstream-playground/docs` and `apps/docstream-editor-playground/docs`, served on their own by the playgrounds and here at [#/docstream](https://blamy.github.io/ui/#/docstream) and [#/docstream-editor](https://blamy.github.io/ui/#/docstream-editor). Each library gets the same as its pages move out of the one sidebar.',
    '## Where the ui pages go',
    `The ${Object.keys(uiPages).length} pages under today's sidebar move to the library that owns what they describe: Calendar, DatePicker, NaturalTimeInput and CronEditor to Time; Diagram, StateDiagram and CloudflareDiagram to Diagram; SqlConsole to SQL and PGlite to PGlite; the Composer pages to Composer; and so on. Guides that span libraries (Theming, Styling, the registry, Working with LLMs) stay at the top of the site, and every \`#/<page>\` link keeps working.`,
    '## Not documented yet',
    `Of the ${total} names the package root exports (props types aside), **${count}** aren't mentioned on any docs page. They are what the libraries' docs fill in first — mostly the headless helpers behind the components:`,
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
