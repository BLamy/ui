/* The BL site: one header over every page, and a hash router that picks what sits under it — the landing page, the
   libraries, a docs site of its own (docstream, the editor, the roadmap), or the ui docs (every other `#/<page>`, as
   before, including `#/blocks/<slug>`). `?demo=`, `?render` and `?harness=` never get here: main.tsx serves them bare. */
import { useEffect, useState, type MouseEvent } from 'react';
import { AppearanceProvider, BLProvider, type Appearance } from '@/lib/theme';
import App from '../app/app';
import { SITE_URL } from '../pages';
import { Landing } from './landing';
import { DOCS_SITES, LibraryDocs, type DocsSiteId } from './library-docs';
import { LibrariesIndex, LibraryPage } from './library-pages';
import { LIBRARY } from './libraries';
import { SiteHeader, type SiteArea } from './site-header';
import { UNDER_HEADER } from './embedded';

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

/** The route: the hash path, without `#/` and the in-page anchor. */
const routeFromHash = () => window.location.hash.replace(/^#\/?/, '').split('#')[0];

type View =
  | { kind: 'home' }
  | { kind: 'libraries' }
  | { kind: 'library'; id: string }
  | { kind: 'docs'; id: DocsSiteId }
  | { kind: 'ui' };

function viewOf(route: string): View {
  if (!route) return { kind: 'home' };
  if (route === 'libraries') return { kind: 'libraries' };
  if (route.startsWith('libraries/')) return { kind: 'library', id: route.slice('libraries/'.length) };
  const site = DOCS_SITES.find((s) => route === s || route.startsWith(`${s}/`));
  if (site) return { kind: 'docs', id: site };
  return { kind: 'ui' };
}

const AREA: Record<View['kind'], SiteArea> = { home: 'home', libraries: 'libraries', library: 'libraries', docs: 'library-docs', ui: 'docs' };

function titleOf(view: View): string | null {
  if (view.kind === 'home') return 'BL — React libraries for apps that feel native';
  if (view.kind === 'libraries') return 'Libraries — BL';
  if (view.kind === 'library') return `${LIBRARY[view.id]?.name ?? 'Library'} — BL`;
  return null; // A docs site keeps the title in step with its page.
}

/* The pages link to each other by absolute URL (https://blamy.github.io/ui/#/<route>, so the Markdown works anywhere);
   on another host serving the site (a dev server, a preview) a plain click navigates in place instead. */
function followSiteLinks(e: MouseEvent) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = (e.target as HTMLElement).closest('a');
  const href = a?.getAttribute('href') ?? '';
  if (!a || a.target === '_blank' || !href.startsWith(`${SITE_URL}/#/`) || window.location.origin === new URL(SITE_URL).origin) return;
  e.preventDefault();
  window.location.hash = href.slice(SITE_URL.length + 1);
}

export default function Site() {
  const [route, setRoute] = useState(routeFromHash);
  useEffect(() => {
    const onHash = () => setRoute(routeFromHash());
    window.addEventListener('hashchange', onHash);
    window.addEventListener('popstate', onHash);
    return () => {
      window.removeEventListener('hashchange', onHash);
      window.removeEventListener('popstate', onHash);
    };
  }, []);

  const [appearance, setAppearance] = useState<Appearance>(initialAppearance);
  useEffect(() => {
    document.documentElement.dataset.theme = appearance;
  }, [appearance]);
  const toggleAppearance = () => setAppearance((a) => {
    const next = a === 'dark' ? 'light' : 'dark';
    window.localStorage.setItem(THEME_KEY, next);
    return next;
  });

  const view = viewOf(route);
  useEffect(() => {
    const title = titleOf(viewOf(route));
    if (title) document.title = title;
    // A page of the site starts at its top (the docs sites keep their own scroll).
    document.getElementById('site-scroll')?.scrollTo(0, 0);
  }, [route]);

  return (
    <AppearanceProvider value={appearance}>
      <div className="flex h-dvh flex-col overflow-hidden" onClickCapture={followSiteLinks}>
        <SiteHeader route={route} area={AREA[view.kind]} appearance={appearance} onToggleAppearance={toggleAppearance} />
        <div className="min-h-0 flex-1">
          {view.kind === 'docs' ? <LibraryDocs id={view.id} appearance={appearance} />
            : view.kind === 'ui' ? <App appearance={appearance} height={UNDER_HEADER} />
            : (
              <BLProvider appearance={appearance} className="bg-background select-text">
                {view.kind === 'home' ? <Landing /> : view.kind === 'libraries' ? <LibrariesIndex /> : <LibraryPage id={view.id} />}
              </BLProvider>
            )}
        </div>
      </div>
    </AppearanceProvider>
  );
}
