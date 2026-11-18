/* BL UI documentation: docstream's DocsSite over the docs' Markdown. Components and Blocks are its tabs (each has its
   own sidebar); the sidebar comes from pages/nav.json (as a SUMMARY.md) and the blocks from pages/blocks.md, so every
   URL stays what it was (`#/composer`, `#/blocks`, `#/blocks/apple-notes`). The BL site (../site/site.tsx) puts its
   header above it, and that is the only bar: this DocsSite has no header of its own (`header={false}`). The site's
   header links to the two tabs as Docs and Blocks, has the GitHub link and the only appearance switch, and holds this
   site's search and navigation buttons through `controller`; the title, mark and tabs here head the navigation
   drawer. */
import { useMemo, type MouseEvent, type ReactNode } from 'react';
import { DocstreamEnvProvider } from '@brett_lamy/ui/docstream';
import { DocsSite, type DocsPage, type DocsSiteController, type DocsSiteTab } from '@brett_lamy/ui/docstream/site';
import type { Appearance } from '@/lib/theme';
import { demoResolver } from '../demos';
import { EnvKeychain } from '../env-keychain';
import { BLOCK_PAGES, NAV, SITE_BLOCKS, SITE_URL, pageMdPath, pageSource, pageUrl } from '../pages';
import './shell.css';

function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" style={{ flexShrink: 0 }} aria-hidden="true">
      <defs>
        <linearGradient id="dklg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0A84FF" /><stop offset="1" stopColor="#5E5CE6" />
        </linearGradient>
      </defs>
      <rect width="34" height="34" rx="8.5" fill="url(#dklg)" />
      <path d="M8 15.5v3M12.25 11.5v11M17 7.5v19M21.75 11.5v11M26 15.5v3" stroke="#fff" strokeWidth="2.3" strokeLinecap="round" />
    </svg>
  );
}

const TABS: DocsSiteTab[] = [
  { title: 'Components', path: '' },
  { title: 'Blocks', path: SITE_BLOCKS },
];

/* Links to another docs page are written as https://blamy.github.io/ui/#/<id> (so a copied page still works elsewhere);
   in the site a plain click on one changes the hash, which DocsSite routes in place. */
function followSiteLinks(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const href = (e.target as HTMLElement).closest('a')?.getAttribute('href') ?? '';
  if (!href.startsWith(`${SITE_URL}/#/`)) return;
  e.preventDefault();
  window.location.hash = href.slice(SITE_URL.length + 1);
}

/** A page in the wide layout: `layout: wide` added to its frontmatter (a block page's carries its `env`). */
const wide = (source: string) => (source.startsWith('---\n') ? `---\nlayout: wide\n${source.slice(4)}` : `---\nlayout: wide\n---\n\n${source}`);

/** The docs as DocsSite's virtual file system: a SUMMARY.md for the sidebar, one file per page. */
function docsFiles(): Record<string, string> {
  const files: Record<string, string> = {};
  const summary: string[] = ['# Table of contents', ''];
  for (const { section, pages } of NAV.sections) {
    summary.push(`## ${section}`, '');
    for (const p of pages) {
      summary.push(`* [${p.title}](${p.id}.md)`);
      files[`${p.id}.md`] = pageSource(p.id);
    }
    summary.push('');
  }
  // Pages outside the components list: the block shells (listed under Blocks below) and any pointer an old name leaves.
  for (const p of NAV.standalone) if (p.id !== SITE_BLOCKS) files[`${p.id}.md`] = pageSource(p.id);
  // Blocks: the overview, then one wide page per block.
  const overview = NAV.standalone.find((p) => p.id === SITE_BLOCKS);
  summary.push('## Blocks', '', `* [${overview?.title ?? 'Overview'}](${SITE_BLOCKS}/README.md)`);
  // The shells some blocks are built from, documented like components (ChatShell, WorkbenchShell): nav.json lists them
  // as standalone pages of the Blocks section, so they sit with the blocks rather than among the library's components.
  for (const p of NAV.standalone) if (p.section === 'Blocks' && p.id !== SITE_BLOCKS) summary.push(`* [${p.title}](${p.id}.md)`);
  files[`${SITE_BLOCKS}/README.md`] = wide(pageSource(SITE_BLOCKS));
  for (const b of BLOCK_PAGES) {
    const file = `${b.id}.md`;
    summary.push(`* [${b.title}](${file})`);
    files[file] = wide(pageSource(b.id));
  }
  files['SUMMARY.md'] = summary.join('\n') + '\n';
  return files;
}

/** A page's content, in the wrappers the docs' content styles hang on; pages that declare `env` get the keychain. */
function renderPage(page: DocsPage, content: ReactNode) {
  const wide = page.frontmatter.layout === 'wide';
  const body = <div className={wide ? 'dk-doc dk-doc-wide' : 'dk-doc'} onClick={followSiteLinks}><div className="dk-md"><div className="wb-md">{content}</div></div></div>;
  if (!Array.isArray(page.frontmatter.env) && typeof page.frontmatter.env !== 'string') return body;
  return <EnvKeychain>{(host) => <DocstreamEnvProvider host={host}>{body}</DocstreamEnvProvider>}</EnvKeychain>;
}

const GITHUB = 'https://github.com/BLamy/ui';

/** `appearance` comes from the site (its header switches it); `height` is the room under the site's header;
    `controller` is the one the site's header holds this site's search and navigation buttons with. */
export default function App({ appearance, height, controller }: { appearance: Appearance; height?: string; controller: DocsSiteController }) {
  const files = useMemo(docsFiles, []);
  return (
      <DocsSite
        files={files}
        tabs={TABS}
        title="BL UI"
        logo={<Logo />}
        header={false}
        controller={controller}
        appearance={appearance}
        appearanceStorageKey={false}
        height={height}
        tint="#0A84FF"
        demoResolver={demoResolver}
        documentProperties={false}
        pageActions={(page) => {
          const id = page.slug || 'introduction';
          return { markdownUrl: `${import.meta.env.BASE_URL}${pageMdPath(id)}`, pageUrl: pageUrl(id) };
        }}
        editUrl={(page) => (page.path.startsWith(`${SITE_BLOCKS}/`) ? undefined : `${GITHUB}/edit/main/apps/docs/pages/${page.path}`)}
        documentTitle={(page) => `${page.title} — BL UI`}
        renderPage={renderPage}
        sidebarFooter={<span style={{ fontSize: 11, opacity: 0.7 }}>Rendered with Docstream</span>}
      />
  );
}
