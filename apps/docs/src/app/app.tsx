/* BL UI documentation: docstream's DocsSite over the docs' Markdown. Components and Blocks are the header's tabs; the
   sidebar comes from pages/nav.json (as a SUMMARY.md) and the blocks from pages/blocks.md, so every URL stays what it
   was (`#/composer`, `#/blocks`, `#/blocks/apple-notes`). */
import { useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { DocstreamEnvProvider } from '@brett_lamy/docstream';
import { DocsSite, type DocsPage, type DocsSiteTab } from '@brett_lamy/docstream/site';
import { AppearanceProvider, type Appearance } from '@/lib/theme';
import { demoResolver } from '../demos';
import { EnvKeychain } from '../env-keychain';
import { BLOCK_PAGES, NAV, SITE_BLOCKS, SITE_URL, pageMdPath, pageSource, pageUrl } from '../pages';
import './shell.css';

const THEME_KEY = 'bldocs-theme';

/* `?theme=` wins (handy for links and screenshots), then the saved choice, then the OS preference. */
function initialAppearance(): Appearance {
  if (typeof window === 'undefined') return 'light';
  const q = new URLSearchParams(window.location.search).get('theme');
  if (q === 'light' || q === 'dark') return q;
  const saved = window.localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

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
  // Blocks: the overview, then one wide page per block.
  summary.push('## Blocks', '', `* [Overview](${SITE_BLOCKS}/README.md)`);
  files[`${SITE_BLOCKS}/README.md`] = `---\nlayout: wide\n---\n\n${pageSource(SITE_BLOCKS)}`;
  for (const b of BLOCK_PAGES) {
    const file = `${b.id}.md`;
    summary.push(`* [${b.title}](${file})`);
    files[file] = `---\nlayout: wide\n---\n\n${pageSource(b.id)}`;
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

export default function App() {
  const files = useMemo(docsFiles, []);
  const [appearance, setAppearance] = useState<Appearance>(initialAppearance);
  return (
    <AppearanceProvider value={appearance}>
      <DocsSite
        files={files}
        tabs={TABS}
        title="BL UI"
        logo={<Logo />}
        links={[{ label: 'GitHub', href: GITHUB }]}
        theme={appearance}
        themeStorageKey={false}
        onThemeChange={(next) => {
          setAppearance(next);
          window.localStorage.setItem(THEME_KEY, next);
        }}
        accentColor="#0A84FF"
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
    </AppearanceProvider>
  );
}
