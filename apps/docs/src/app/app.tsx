/* BL UI documentation shell — pixel-faithful port of project/BL UI Docs.dc.html. */
import { useEffect, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { AppearanceProvider, type Appearance } from '@brett_lamy/ui';
import { GitbookStreamdown } from '@brett_lamy/docstream';
import { BLOCK_COUNT, demoResolver } from '../demos';
import { NAV, PAGES, PAGE_ORDER, pageMdPath, pageSource, pageUrl, SITE_URL } from '../pages';
import './shell.css';

const SCROLL_ID = 'bldocs-scroll';
const BLOCKS_ID = 'blocks';

/* Routes live in the hash — `#/composer`, `#/blocks` — so every page has a link and GitHub Pages needs no rewrites. */
function slugFromHash(): string {
  if (typeof window === 'undefined') return 'introduction';
  const id = window.location.hash.replace(/^#\/?/, '');
  return PAGES[id] ? id : 'introduction';
}
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

function ThemeToggle({ appearance, onToggle }: { appearance: Appearance; onToggle: () => void }) {
  const dark = appearance === 'dark';
  return (
    <button className="dk-theme" onClick={onToggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}>
      {dark
        ? <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4.2" /><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6" /></svg>
        : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1z" /></svg>}
    </button>
  );
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

function NavHeader({ onClose, theme }: { onClose?: () => void; theme: ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '16px 16px 10px' }}>
      <Logo />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: '-.2px', lineHeight: 1.1 }}>BL UI</div>
        <div style={{ fontSize: 10.5, color: 'var(--dk-muted)', fontWeight: 600, letterSpacing: '.4px' }}>DOCUMENTATION</div>
      </div>
      {theme}
      {onClose ? (
        <button onClick={onClose} aria-label="Close navigation" style={{ border: 0, background: 'none', cursor: 'pointer', padding: 6, color: 'var(--dk-muted)' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      ) : null}
    </div>
  );
}

function NavList({ slug, pick }: { slug: string; pick: (id: string) => void }) {
  const onBlocks = slug === BLOCKS_ID;
  return (
    <div className="dk-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 10px 10px' }}>
      <div className="dk-topnav">
        <button className="dk-topnav-item" data-page="docs" aria-current={!onBlocks ? 'page' : undefined} onClick={() => pick(onBlocks ? 'introduction' : slug)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5" /></svg>
          Docs
        </button>
        <button className="dk-topnav-item" data-page={BLOCKS_ID} aria-current={onBlocks ? 'page' : undefined} onClick={() => pick(BLOCKS_ID)}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="1.8" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8" /></svg>
          Blocks
          <span className="dk-topnav-count">{BLOCK_COUNT}</span>
        </button>
      </div>
      {NAV.sections.map((sec) => (
        <div key={sec.section}>
          <div style={{ padding: '16px 10px 5px', fontSize: 10.5, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--dk-muted)' }}>{sec.section}</div>
          {sec.pages.map((p) => {
            const active = p.id === slug;
            return (
              <button key={p.id} data-page={p.id} className="dk-nav" onClick={() => pick(p.id)}
                aria-current={active ? 'page' : undefined}
                style={active ? { background: 'var(--dk-active)', color: 'var(--dk-accent)', fontWeight: 600 } : undefined}>
                {p.title}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function NavFooter() {
  return (
    <div style={{ padding: '12px 16px', borderTop: '1px solid var(--dk-border)', fontSize: 12, lineHeight: 1.9 }}>
      <div><a href="https://github.com/BLamy/ui">GitHub repository →</a></div>
      <div style={{ fontSize: 10.5, color: 'var(--dk-faint)', fontFamily: 'ui-monospace,Menlo,monospace', marginTop: 4 }}>rendered with Docstream</div>
    </div>
  );
}

/** One page: its Markdown file through docstream — demos from the resolver, "Copy page" from page actions. */
function DocPage({ id, markdown }: { id: string; markdown: string }) {
  return (
    <div className="dk-md">
      <div className="wb-md">
        <GitbookStreamdown
          markdown={markdown}
          demoResolver={demoResolver}
          pageActions={{ markdownUrl: `${import.meta.env.BASE_URL}${pageMdPath(id)}`, pageUrl: pageUrl(id) }}
        />
      </div>
    </div>
  );
}

export default function App() {
  const [slug, setSlug] = useState(slugFromHash);
  useEffect(() => {
    const onHash = () => { setSlug(slugFromHash()); setNavOpen(false); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const [navOpen, setNavOpen] = useState(false);
  const [appearance, setAppearance] = useState<Appearance>(initialAppearance);
  useEffect(() => { document.documentElement.dataset.theme = appearance; }, [appearance]);
  const toggleTheme = () => setAppearance((a) => {
    const next = a === 'dark' ? 'light' : 'dark';
    window.localStorage.setItem(THEME_KEY, next);
    return next;
  });
  const theme = <ThemeToggle appearance={appearance} onToggle={toggleTheme} />;
  const [w, setW] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1400));
  useEffect(() => {
    const onR = () => setW(window.innerWidth);
    window.addEventListener('resize', onR);
    return () => window.removeEventListener('resize', onR);
  }, []);

  const page = PAGES[slug];
  const markdown = pageSource(slug);
  useEffect(() => { document.title = `${page.title} — BL UI`; }, [page.title]);
  const idx = PAGE_ORDER.indexOf(slug);
  const prev = idx > 0 ? PAGE_ORDER[idx - 1] : null;
  const next = idx >= 0 && idx < PAGE_ORDER.length - 1 ? PAGE_ORDER[idx + 1] : null;
  const toc: Array<{ text: string; h3: boolean }> = [];
  let fenced = false;
  markdown.split('\n').forEach((l) => {
    if (l.startsWith('```')) fenced = !fenced;
    if (fenced) return;
    // A titled tab set (`{% tabs title="Installation" %}`) renders as an h2 section heading.
    const m2 = l.match(/^## (.+)$/) ?? l.match(/^\{% tabs title="([^"]+)"/);
    const m3 = l.match(/^### (.+)$/);
    if (m2) toc.push({ text: m2[1].replace(/`/g, ''), h3: false });
    else if (m3) toc.push({ text: m3[1].replace(/`/g, ''), h3: true });
  });

  const fixedNav = w >= 900;
  const overlayNav = w < 900;
  const hasToc = !page.wide && toc.length > 0 && w >= 1220;

  const pick = (id: string) => {
    if (!PAGES[id]) return;
    if (window.location.hash !== '#/' + id) window.history.pushState(null, '', '#/' + id);
    setSlug(id); setNavOpen(false);
    setTimeout(() => { const sc = document.getElementById(SCROLL_ID); if (sc) sc.scrollTop = 0; }, 30);
  };

  /* Headings come from the page's Markdown only, so demos' own headings never shift the TOC index. */
  const jumpHead = (index: number) => {
    const sc = document.getElementById(SCROLL_ID); if (!sc) return;
    const h = sc.querySelectorAll('.dk-md :is(h2, h3):not(.docs-demo *)')[index];
    if (h) sc.scrollTop += h.getBoundingClientRect().top - sc.getBoundingClientRect().top - 22;
  };

  /* Links to another docs page (https://blamy.github.io/ui/#/<id> in the Markdown) navigate in place. */
  const onDocClick = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    const target = href.startsWith(`${SITE_URL}/#/`) ? href.slice(SITE_URL.length + 3) : null;
    if (target && PAGES[target]) { e.preventDefault(); pick(target); }
  };

  const drawerStyle: CSSProperties = {
    position: 'fixed', top: 0, bottom: 0, left: 0, width: 280, maxWidth: '85%', zIndex: 91, background: 'var(--dk-side)',
    boxShadow: navOpen ? '0 0 44px rgba(0,0,0,.25)' : 'none', display: 'flex', flexDirection: 'column',
    transform: navOpen ? 'none' : 'translateX(-102%)', transition: 'transform .38s cubic-bezier(.32,.72,0,1)',
  };
  const scrimStyle: CSSProperties = {
    position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,.35)',
    opacity: navOpen ? 1 : 0, pointerEvents: navOpen ? 'auto' : 'none', transition: 'opacity .3s',
  };

  const pn = (id: string | null, dir: 'prev' | 'next'): ReactNode => {
    if (!id) return null;
    return (
      <button className="dk-pn" onClick={() => pick(id)}
        style={dir === 'prev' ? { textAlign: 'left' } : { textAlign: 'right', marginLeft: 'auto' }}>
        <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--dk-muted)', marginBottom: 3 }}>
          {dir === 'prev' ? '← Previous' : 'Next →'}
        </span>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 650, color: 'var(--dk-fg)' }}>{PAGES[id]?.title || id}</span>
      </button>
    );
  };

  return (
    <AppearanceProvider value={appearance}>
    <div style={{ height: '100vh', display: 'flex', overflow: 'hidden' }}>
      {fixedNav ? (
        <div style={{ width: 262, flexShrink: 0, background: 'var(--dk-side)', borderRight: '1px solid var(--dk-border)', display: 'flex', flexDirection: 'column' }}>
          <NavHeader theme={theme} />
          <NavList slug={slug} pick={pick} />
          <NavFooter />
        </div>
      ) : null}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {overlayNav ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', height: 50, borderBottom: '1px solid var(--dk-border)', background: 'var(--dk-bg)', flexShrink: 0 }}>
            <button onClick={() => setNavOpen(true)} aria-label="Open navigation" style={{ border: 0, background: 'none', cursor: 'pointer', padding: 6, display: 'grid', color: 'var(--dk-icon)' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6.5h16M4 12h16M4 17.5h16" /></svg>
            </button>
            <span style={{ fontSize: 13.5, fontWeight: 700 }}>BL UI Docs</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--dk-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>/ {page.title}</span>
            {theme}
          </div>
        ) : null}
        <div id={SCROLL_ID} className="dk-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div className={page.wide ? 'dk-doc dk-doc-wide' : 'dk-doc'} onClick={onDocClick} style={{
            maxWidth: page.wide ? 1240 : 780, margin: '0 auto', boxSizing: 'border-box',
            padding: page.wide && w < 600 ? '26px 14px 90px' : '34px 34px 90px',
          }}>
            <div className="dk-pagehead">
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--dk-accent)' }}>{page.section}</div>
            </div>
            <DocPage key={slug} id={slug} markdown={markdown} />
            <div style={{ display: 'flex', gap: 12, marginTop: 44 }}>
              {pn(prev, 'prev')}
              {pn(next, 'next')}
            </div>
          </div>
        </div>
      </div>
      {hasToc ? (
        <div style={{ width: 198, flexShrink: 0, padding: '36px 20px 20px', borderLeft: '1px solid var(--dk-border2)' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--dk-muted)', marginBottom: 8 }}>On this page</div>
          {toc.map((t, i) => (
            <button key={i} className="dk-toc" onClick={() => jumpHead(i)} style={t.h3 ? { paddingLeft: 12 } : undefined}>{t.text}</button>
          ))}
        </div>
      ) : null}
      {overlayNav ? (
        <div>
          <div onClick={() => setNavOpen(false)} style={scrimStyle} />
          <div style={drawerStyle}>
            <NavHeader theme={theme} onClose={() => setNavOpen(false)} />
            <NavList slug={slug} pick={pick} />
            <NavFooter />
          </div>
        </div>
      ) : null}
    </div>
    </AppearanceProvider>
  );
}
