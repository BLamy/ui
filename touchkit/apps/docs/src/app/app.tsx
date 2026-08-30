/* TouchKit documentation shell — pixel-faithful port of project/TouchKit Docs.dc.html. */
import { useEffect, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { MarkdownView } from '@touchkit/workbench';
import { NAV, PAGES, PAGE_ORDER } from '../content';
import { DocsLive } from '../live/docs-live';
import { AppDemoBlock, HapticsDemoBlock, PencilDemoBlock, WorkbenchDemoBlock } from '../live/demo-blocks';

const SCROLL_ID = 'tkdocs-scroll';

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

function NavHeader({ onClose }: { onClose?: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '16px 16px 10px' }}>
      <Logo />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: '-.2px', lineHeight: 1.1 }}>TouchKit</div>
        <div style={{ fontSize: 10.5, color: '#8A8A94', fontWeight: 600, letterSpacing: '.4px' }}>DOCUMENTATION</div>
      </div>
      {onClose ? (
        <button onClick={onClose} aria-label="Close navigation" style={{ border: 0, background: 'none', cursor: 'pointer', padding: 6, color: '#8A8A94' }}>
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
          <div style={{ padding: '16px 10px 5px', fontSize: 10.5, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: '#8A8A94' }}>{sec.section}</div>
          {sec.pages.map((p) => {
            const active = p === slug;
            return (
              <button key={p} className="dk-nav" onClick={() => pick(p)}
                aria-current={active ? 'page' : undefined}
                style={active ? { background: 'rgba(10,132,255,.1)', color: '#0A84FF', fontWeight: 600 } : undefined}>
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
    <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(20,20,40,0.08)', fontSize: 12, lineHeight: 1.9 }}>
      <div><a href="TouchKit Demo.dc.html">Contacts demo →</a></div>
      <div><a href="Workbench.dc.html">Workbench demo →</a></div>
      <div><a href="PencilKit Demo.dc.html">PencilKit demo →</a></div>
      <div><a href="Chat Demo.dc.html">Chat demo →</a></div>
      <div style={{ fontSize: 10.5, color: '#9A9AA3', fontFamily: 'ui-monospace,Menlo,monospace', marginTop: 4 }}>rendered with TouchKit MarkdownView</div>
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
  const segs = parseSegs(slug, page.markdown);
  const toc: Array<{ text: string; h3: boolean }> = [];
  page.markdown.split('\n').forEach((l) => {
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

  const jumpHead = (text: string) => {
    const sc = document.getElementById(SCROLL_ID); if (!sc) return;
    const hs = sc.querySelectorAll('h2, h3');
    for (const h of Array.from(hs)) {
      if ((h.textContent || '').trim() === text) {
        sc.scrollTop += h.getBoundingClientRect().top - sc.getBoundingClientRect().top - 22;
        return;
      }
    }
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
    position: 'fixed', top: 0, bottom: 0, left: 0, width: 280, maxWidth: '85%', zIndex: 91, background: '#F6F6F8',
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
        <span style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#8A8A94', marginBottom: 3 }}>
          {dir === 'prev' ? '← Previous' : 'Next →'}
        </span>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 650, color: '#17171C' }}>{PAGES[id]?.title || id}</span>
      </button>
    );
  };

  return (
    <div style={{ height: '100vh', display: 'flex', overflow: 'hidden' }}>
      {fixedNav ? (
        <div style={{ width: 262, flexShrink: 0, background: '#F6F6F8', borderRight: '1px solid rgba(20,20,40,0.08)', display: 'flex', flexDirection: 'column' }}>
          <NavHeader />
          <NavList slug={slug} pick={pick} />
          <NavFooter />
        </div>
      ) : null}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {overlayNav ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px', height: 50, borderBottom: '1px solid rgba(20,20,40,0.08)', background: '#FCFCFD', flexShrink: 0 }}>
            <button onClick={() => setNavOpen(true)} aria-label="Open navigation" style={{ border: 0, background: 'none', cursor: 'pointer', padding: 6, display: 'grid', color: '#55555E' }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6.5h16M4 12h16M4 17.5h16" /></svg>
            </button>
            <span style={{ fontSize: 13.5, fontWeight: 700 }}>TouchKit Docs</span>
            <span style={{ fontSize: 12.5, color: '#8A8A94', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>/ {page.title}</span>
          </div>
        ) : null}
        <div id={SCROLL_ID} className="dk-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
          <div className="dk-doc" onClick={onDocClick} style={{ maxWidth: 780, margin: '0 auto', padding: '34px 34px 90px', boxSizing: 'border-box' }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: '#0A84FF', marginBottom: 2 }}>{page.section}</div>
            {segs.map((seg) => (
              <div key={seg.key}>
                {seg.md ? <MarkdownView markdown={seg.md} /> : null}
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
        <div style={{ width: 198, flexShrink: 0, padding: '36px 20px 20px', borderLeft: '1px solid rgba(20,20,40,0.06)' }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: '#8A8A94', marginBottom: 8 }}>On this page</div>
          {toc.map((t) => (
            <button key={t.text} className="dk-toc" onClick={() => jumpHead(t.text)} style={t.h3 ? { paddingLeft: 12 } : undefined}>{t.text}</button>
          ))}
        </div>
      ) : null}
      {overlayNav ? (
        <div>
          <div onClick={() => setNavOpen(false)} style={scrimStyle} />
          <div style={drawerStyle}>
            <NavHeader onClose={() => setNavOpen(false)} />
            <NavList slug={slug} pick={pick} />
            <NavFooter />
          </div>
        </div>
      ) : null}
    </div>
  );
}
