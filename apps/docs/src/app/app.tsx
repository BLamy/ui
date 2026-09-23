/* BL UI documentation shell — pixel-faithful port of project/BL UI Docs.dc.html. */
import { useEffect, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { AppearanceProvider, type Appearance } from '@brett_lamy/ui';
import { MarkdownView } from '@brett_lamy/workbench';
import { NAV, PAGES, PAGE_ORDER } from '../content';
import { DocsLive } from '../live/docs-live';
import { AppDemoBlock, HapticsDemoBlock, PencilDemoBlock, WorkbenchDemoBlock } from '../live/demo-blocks';

const SCROLL_ID = 'bldocs-scroll';
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
  return (
    <div className="dk-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 10px 10px' }}>
      {NAV.map((sec) => (
        <div key={sec.section}>
          <div style={{ padding: '16px 10px 5px', fontSize: 10.5, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--dk-muted)' }}>{sec.section}</div>
          {sec.pages.map((p) => {
            const active = p === slug;
            return (
              <button key={p} data-page={p} className="dk-nav" onClick={() => pick(p)}
                aria-current={active ? 'page' : undefined}
                style={active ? { background: 'var(--dk-active)', color: 'var(--dk-accent)', fontWeight: 600 } : undefined}>
                {PAGES[p]?.title || p}
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
      <div><a href="https://github.com/BLamy/ui/tree/main/project">Prototype source →</a></div>
      <div><a href="https://github.com/BLamy/ui">GitHub repository →</a></div>
      <div style={{ fontSize: 10.5, color: 'var(--dk-faint)', fontFamily: 'ui-monospace,Menlo,monospace', marginTop: 4 }}>rendered with Docstream</div>
    </div>
  );
}

interface Seg { key: string; md?: string; demo?: string; live?: string }

function parseSegs(slug: string, md: string): Seg[] {
  const segs: Seg[] = [];
  const parts = (md || '').split(/^%%(demo|live):(\w+)%%$/m);
  for (let i = 0; i < parts.length; i += 3) {
    const text = parts[i];
    if (text && text.trim()) segs.push({ key: slug + '-m' + i, md: text.trim() });
    const kind = parts[i + 1];
    const name = parts[i + 2];
    if (!kind) continue;
    segs.push({ key: slug + '-x' + i, [kind]: name } as Seg);
  }
  return segs;
}

function DemoBlock({ name }: { name: string }) {
  if (name === 'haptics') return <HapticsDemoBlock />;
  if (name === 'workbench') return <WorkbenchDemoBlock />;
  if (name === 'pencil') return <PencilDemoBlock />;
  if (name === 'app') return <AppDemoBlock />;
  return null;
}

export default function App() {
  const [slug, setSlug] = useState('introduction');
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

  const page = PAGES[slug] || { id: slug, section: '', title: '', markdown: '' };
  const idx = PAGE_ORDER.indexOf(slug);
  const prev = idx > 0 ? PAGE_ORDER[idx - 1] : null;
  const next = idx >= 0 && idx < PAGE_ORDER.length - 1 ? PAGE_ORDER[idx + 1] : null;
  // The public distribution is a single package; workspace package names stay internal.
  const publicMarkdown = page.markdown
    .replace(/@brett_lamy\/(?:chatkit|workbench|pencilkit)\b/g, '@brett_lamy/ui')
    .replace(/pnpm add @brett_lamy\/ui(?: @brett_lamy\/ui)+ react react-dom/g, 'npm i @brett_lamy/ui');
  const segs = parseSegs(slug, publicMarkdown);
  const toc: Array<{ text: string; h3: boolean }> = [];
  let fenced = false;
  publicMarkdown.split('\n').forEach((l) => {
    if (l.startsWith('```')) fenced = !fenced;
    if (fenced) return;
    const m2 = l.match(/^## (.+)$/);
    const m3 = l.match(/^### (.+)$/);
    if (m2) toc.push({ text: m2[1], h3: false });
    else if (m3) toc.push({ text: m3[1], h3: true });
  });

  const fixedNav = w >= 900;
  const overlayNav = w < 900;
  const hasToc = toc.length > 0 && w >= 1220;

  const pick = (id: string) => {
    if (!PAGES[id]) return;
    setSlug(id); setNavOpen(false);
    setTimeout(() => { const sc = document.getElementById(SCROLL_ID); if (sc) sc.scrollTop = 0; }, 30);
  };

  /* Headings come from markdown segments only, so live demos' own headings never shift the TOC index. */
  const jumpHead = (index: number) => {
    const sc = document.getElementById(SCROLL_ID); if (!sc) return;
    const h = sc.querySelectorAll('.dk-md h2, .dk-md h3')[index];
    if (h) sc.scrollTop += h.getBoundingClientRect().top - sc.getBoundingClientRect().top - 22;
  };

  /* Internal page links: [Text](#page-id) navigates when the target matches a page id. */
  const onDocClick = (e: MouseEvent) => {
    const a = (e.target as HTMLElement).closest('a');
    if (!a) return;
    const href = a.getAttribute('href') || '';
    if (!href.startsWith('#')) return;
    const target = href.slice(1);
    if (PAGES[target]) { e.preventDefault(); pick(target); }
    else e.preventDefault(); /* the prototype's dead '#' links — don't jump the scroller */
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
          <div className="dk-doc" onClick={onDocClick} style={{ maxWidth: 780, margin: '0 auto', padding: '34px 34px 90px', boxSizing: 'border-box' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: 'var(--dk-accent)', marginBottom: 2 }}>{page.section}</div>
            {segs.map((seg) => (
              <div key={seg.key}>
                {seg.md ? <div className="dk-md"><MarkdownView markdown={seg.md} /></div> : null}
                {seg.demo ? <DemoBlock name={seg.demo} /> : null}
                {seg.live ? <DocsLive demo={seg.live} /> : null}
              </div>
            ))}
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
