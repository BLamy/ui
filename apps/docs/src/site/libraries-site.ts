/* The libraries, at `#/libraries` and `#/libraries/<id>`, as docstream pages: a README that lists them all and one page
   per library, generated from the manifest (libraries.ts) and from what the code says each library is used by
   (`libraryShowcase`, src/site/showcase-graph.ts): the blocks that import it, running, and the docs pages of its parts,
   each with its first demo. Nothing here is written by hand, so a library, block or docs page added elsewhere shows up
   on its own. */
import { libraryShowcase } from 'virtual:bl-site-files';
import { BLOCK_PAGES, NAV, pageSource } from '../pages';
import { CATEGORIES, LIBRARIES, LIBRARY, LAYER_EXCEPTIONS, STATUS_LABEL, byCategory, type Library } from './libraries';
import { formatSize, gzipSize } from './landing/sizes';
import { REPO_URL } from './site-parts';

const SITE = 'https://blamy.github.io/ui/#';
const REGISTRY = 'https://blamy.github.io/ui/r';
/** Blocks a library page runs in place; the rest are linked. */
const LIVE_BLOCKS = 2;
/** Component demos a library page runs in place; the rest are linked. */
const LIVE_COMPONENTS = 6;

const pageLink = (l: Library) => `${l.id}.md`;
/** The shadcn item that installs the whole library. */
const registryItemOf = (l: Library) => (l.id === 'ui' ? 'library-ui' : l.entry ? `library-${l.entry}` : null);

/** The first sentence of a text, for a card. */
function firstSentence(text: string): string {
  const m = /^(.+?[.!?])(\s|$)/.exec(text.replace(/\s+/g, ' ').trim());
  return (m?.[1] ?? text).trim();
}

/** A table cell holds HTML: Markdown's backticks become <code>, and the rest is escaped. */
function cell(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.split('`').map((part, i) => (i % 2 ? `<code>${part}</code>` : part)).join('');
}

function cards(rows: Array<{ title: string; body: string; href?: string; more?: string }>): string {
  if (!rows.length) return '';
  const tr = rows.map((r) => `<tr><td><strong>${cell(r.title)}</strong></td><td>${cell(r.body)}${r.href ? ` <a href="${r.href}">${r.more ?? 'Open'} →</a>` : ''}</td></tr>`);
  return `<table data-view="cards"><thead><tr><th></th><th></th></tr></thead><tbody>\n${tr.join('\n')}\n</tbody></table>`;
}

const navTitle = new Map(NAV.sections.flatMap((s) => s.pages.map((p) => [p.id, p.title] as const)));
/** A docs page's lede: the first paragraph under its title. */
function ledeOf(id: string): string {
  const body = pageSource(id).replace(/^---\n[\s\S]*?\n---\n/, '');
  const para = body.split(/\n\s*\n/).map((p) => p.trim()).find((p) => p && !/^(#|\{%|```|<|\||>|-|\*|!\[)/.test(p));
  return para ? firstSentence(para.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\*\*/g, '')) : '';
}
const blockMeta = new Map(BLOCK_PAGES.map((b) => [b.id.replace(/^blocks\//, ''), b]));

/** The blocks a page shows: the library's own, else (a library nothing imports directly, like the editor) those of
    the libraries built on it. */
function blocksOf(lib: Library) {
  const own = libraryShowcase[lib.id]?.blocks ?? [];
  if (own.length) return { blocks: own, via: [] as Library[] };
  const via = LIBRARIES.filter((l) => l.dependsOn.includes(lib.id) && (libraryShowcase[l.id]?.blocks.length ?? 0) > 0);
  const seen = new Set<string>();
  const blocks = via.flatMap((l) => libraryShowcase[l.id]!.blocks).filter((b) => !seen.has(b.slug) && seen.add(b.slug));
  return { blocks, via };
}

function libraryPage(lib: Library): string {
  const out: string[] = [];
  const size = gzipSize(lib.id);
  const item = registryItemOf(lib);
  const show = libraryShowcase[lib.id] ?? { blocks: [], pages: [] };
  const { blocks, via } = blocksOf(lib);
  const deps = lib.dependsOn.map((d) => LIBRARY[d]!);
  const usedBy = LIBRARIES.filter((l) => l.dependsOn.includes(lib.id));

  out.push(`---\ndescription: ${JSON.stringify(lib.tagline)}\nlayout: wide\n---`);
  out.push(`# ${lib.name}`);
  out.push(lib.description);
  const facts = [
    `\`${lib.id === 'ui-sdk' ? '@brett_lamy/ui/sdk/…' : lib.npm}\``,
    `**${STATUS_LABEL[lib.status]}**`,
    size ? `${formatSize(size)} gzip` : null,
    lib.docs ? `[Read the docs](${SITE}/${lib.docs})` : null,
    `[Source](${sourceOf(lib)})`,
  ].filter(Boolean);
  out.push(facts.join(' · '));

  if (lib.id === 'linux-vm') {
    out.push('{% hint style="warning" %}\nPlanned, heavy and experimental. Almost every app wants [Sandbox](sandbox.md): a Worker with an origin of its own, a few kilobytes on the page.\n{% endhint %}');
  } else if (lib.status === 'planned') {
    out.push(`{% hint style="info" %}\nPlanned: it will be an entry of \`@brett_lamy/ui\`, \`${lib.npm}\`, like every other library.\n{% endhint %}`);
  }

  out.push(cards(lib.highlights.map((h) => ({ title: h, body: '' }))));

  // The blocks: the best few running, the rest as cards.
  if (blocks.length) {
    const live = blocks.filter((b) => !b.heavy).slice(0, LIVE_BLOCKS);
    const rest = blocks.filter((b) => !live.includes(b));
    out.push(`## Built with ${lib.name}`);
    out.push(via.length
      ? `Nothing imports ${lib.name} by itself: apps reach it through ${via.map((l) => `[${l.name}](${pageLink(l)})`).join(' and ')}. These do.`
      : `Whole apps from the [blocks](${SITE}/blocks) that use it, running here. Each is a few readable files; the shadcn CLI copies one into your project with only the parts it imports.`);
    for (const b of live) {
      const meta = blockMeta.get(b.slug);
      out.push(`### ${meta?.title ?? b.slug}`);
      if (meta?.description) out.push(firstSentence(meta.description));
      out.push(`{% demo src="blocks/${b.slug}" layout="multi" title="registry/blocks/${b.slug}" %}`);
      out.push(`{% command %}npx shadcn@latest add ${REGISTRY}/${b.slug}.json{% endcommand %}`);
    }
    if (rest.length) {
      if (live.length) out.push(`### Also built with ${lib.name}`);
      out.push(cards(rest.map((b) => {
        const meta = blockMeta.get(b.slug);
        return { title: meta?.title ?? b.slug, body: meta?.description ? firstSentence(meta.description) : '', href: `${SITE}/blocks/${b.slug}`, more: b.heavy ? 'Run it' : 'Open' };
      })));
    }
  }

  // The components: their first demos running, the rest as cards.
  if (show.pages.length) {
    const live = show.pages.filter((p) => p.demo).slice(0, LIVE_COMPONENTS);
    const rest = show.pages.filter((p) => !live.includes(p));
    out.push(lib.id === 'ui' ? '## The components' : `## What's in ${lib.name}`);
    for (const p of live) {
      out.push(`### [${navTitle.get(p.id) ?? p.id}](${SITE}/${p.id})`);
      const lede = ledeOf(p.id);
      if (lede) out.push(lede);
      out.push(`{% demo src="${p.demo}" %}`);
    }
    if (rest.length) {
      if (live.length) out.push(`### And ${rest.length} more`);
      out.push(cards(rest.map((p) => ({ title: navTitle.get(p.id) ?? p.id, body: ledeOf(p.id), href: `${SITE}/${p.id}`, more: 'Docs' }))));
    }
  }

  // Docstream and its editor have docs sites of their own.
  if (lib.docs && !show.pages.length && lib.id !== 'ui') {
    out.push(`{% content-ref url="${SITE}/${lib.docs}" %}\nThe ${lib.name} docs: every block and option, with live examples\n{% endcontent-ref %}`);
  }

  if (lib.status !== 'planned') {
    out.push('## Install');
    const importLine = lib.id === 'ui-sdk' ? "import { Dialog } from '@brett_lamy/ui/sdk/react/dialog';" : `import { … } from '${lib.npm}';`;
    const npmTab = `{% tab title="npm" %}\nOne package for every library. Your bundle carries only the entries you import.\n\n{% command %}npm install @brett_lamy/ui{% endcommand %}\n\n\`\`\`tsx lineNumbers="false"\n${importLine}\n\`\`\`\n{% endtab %}`;
    const shadcnTab = item
      ? `{% tab title="shadcn CLI" %}\nCopies the library's source into your project, with the parts it imports.\n\n{% command %}npx shadcn@latest add ${REGISTRY}/${item}.json{% endcommand %}\n{% endtab %}`
      : null;
    out.push(`{% tabs sync="install-method" %}\n${[npmTab, shadcnTab].filter(Boolean).join('\n\n')}\n{% endtabs %}`);
  }

  out.push('## How it fits');
  const rows: Array<[string, string]> = [
    ['Builds on', deps.length ? deps.map((d) => `[${d.name}](${pageLink(d)})`).join(', ') : 'No other BL library'],
    ['Used by', usedBy.length ? usedBy.map((d) => `[${d.name}](${pageLink(d)})`).join(', ') : 'Nothing else in BL: it\'s a leaf'],
  ];
  if (lib.alsoAt?.length) rows.push(['Also at', lib.alsoAt.map((e) => `\`@brett_lamy/ui/${e}\``).join(', ')]);
  if (lib.external?.length) rows.push(['Brings from npm', lib.external.map((e) => `\`${e}\``).join(', ')]);
  for (const f of lib.formerly ?? []) rows.push(['Was', `\`${f.npm}\`, frozen at ${f.last}. [Migrating](${SITE}/roadmap/migration)`]);
  out.push(`| | |\n| --- | --- |\n${rows.map(([k, v]) => `| ${k} | ${v.replace(/\|/g, '\\|')} |`).join('\n')}`);
  if (lib.modules?.length) {
    const changes = LAYER_EXCEPTIONS.filter((c) => lib.modules?.includes(c.unit)).map((c) => c.why);
    out.push(`<details>\n<summary>Its code: ${lib.modules.length} ${lib.modules.length === 1 ? 'unit' : 'units'} of packages/ui/src</summary>\n\n${lib.modules.map((m) => `- \`packages/ui/src/${m}\``).join('\n')}${changes.length ? `\n\n${changes.join('\n\n')}` : ''}\n\n</details>`);
  }
  return out.filter(Boolean).join('\n\n') + '\n';
}

const TREE = `${REPO_URL}/tree/main`;
/** Where a library's code lives. */
function sourceOf(lib: Library): string {
  if (lib.id === 'ui-sdk') return `${TREE}/vendor`;
  if (lib.id === 'sandbox') return 'https://github.com/BLamy/almostnode';
  if (lib.id === 'linux-vm') return 'https://github.com/BLamy/wasm-vm';
  if (lib.entry) return `${TREE}/packages/ui/src/libraries/${lib.entry}.ts`;
  if (lib.id === 'docstream' || lib.id === 'docstream-editor') return `${TREE}/packages/ui/src/${lib.id}`;
  return `${TREE}/packages/ui/src`;
}

function indexPage(): string {
  const out = [
    '---\ndescription: One npm package, @brett_lamy/ui, and every BL library inside it as an entry of its own.\nlayout: wide\n---',
    '# Libraries',
    'Install one thing, `@brett_lamy/ui`, and import the entries you use: `@brett_lamy/ui/audio`, `@brett_lamy/ui/markdown`, `@brett_lamy/ui/diagram`. Your bundle carries only those. Or copy a library\'s source with the shadcn CLI. Each page shows the apps built with the library, running, and its parts with their demos. How they fit together is in [the package map](' + SITE + '/roadmap/packages).',
    '{% command %}npm install @brett_lamy/ui{% endcommand %}',
  ];
  for (const c of CATEGORIES) {
    out.push(`## ${c.label}`);
    out.push(cards(byCategory(c.id).map((l) => {
      const size = gzipSize(l.id);
      return { title: l.name, body: `${l.tagline} ${l.id === 'ui-sdk' ? '`@brett_lamy/ui/sdk/…`' : `\`${l.npm}\``}${size ? ` · ${formatSize(size)}` : ''}${l.status === 'planned' ? ' · Planned' : ''}`, href: pageLink(l), more: 'See it' };
    })));
  }
  return out.join('\n\n') + '\n';
}

/** The sidebar: a group per category. */
function summary(): string {
  return ['# Table of contents', '* [All libraries](README.md)', ...CATEGORIES.map((c) => `## ${c.label}\n\n${byCategory(c.id).map((l) => `* [${l.name}](${pageLink(l)})`).join('\n')}`)].join('\n\n') + '\n';
}

/** The libraries site, as DocsSite files. */
export const LIBRARY_FILES: Record<string, string> = {
  'SUMMARY.md': summary(),
  'README.md': indexPage(),
  ...Object.fromEntries(LIBRARIES.map((l) => [pageLink(l), libraryPage(l)])),
};
