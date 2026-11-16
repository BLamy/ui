/* The BL site: one header over every page, and a hash router that picks what sits under it — the landing page, the
   libraries, a library's docs site, the roadmap, or the ui docs (every other `#/<page>`, as before). */
import { useEffect, useState, type MouseEvent } from 'react';
import { AppearanceProvider, type Appearance } from '@/lib/theme';
import App from '../app/app';
import { SITE_URL } from '../pages';
import { Landing } from './landing';
import { LibrariesIndex, LibraryPage } from './library-pages';
import { DOCS_SITES, LibraryDocs, type DocsSiteId } from './library-docs';
import { LIBRARY } from './libraries';
import { SiteHeader } from './site-header';
import './site.css';

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

const TITLES: Record<string, string> = { home: 'BL — React libraries for apps that feel native', libraries: 'Libraries — BL' };

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
  useEffect(() => { document.documentElement.dataset.theme = appearance; }, [appearance]);
  const toggleTheme = () => setAppearance((a) => {
    const next = a === 'dark' ? 'light' : 'dark';
    window.localStorage.setItem(THEME_KEY, next);
    return next;
  });

  const view = viewOf(route);
  useEffect(() => {
    if (view.kind === 'home' || view.kind === 'libraries') document.title = TITLES[view.kind];
    else if (view.kind === 'library') document.title = `${LIBRARY[view.id]?.name ?? 'Library'} — BL`;
    // Pages scroll from the top when the route changes (a docs site and the ui docs manage their own scroll).
    if (view.kind !== 'docs' && view.kind !== 'ui') document.getElementById('site-scroll')?.scrollTo(0, 0);
  }, [route]); // eslint-disable-line react-hooks/exhaustive-deps

  /* The pages link to each other by absolute URL (https://blamy.github.io/ui/#/<route>, so the Markdown works
     anywhere); on the site itself they navigate in place, on whichever host is serving it. */
  const onClickCapture = (e: MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as HTMLElement).closest('a');
    const href = a?.getAttribute('href') ?? '';
    if (!a || a.target === '_blank' || !href.startsWith(`${SITE_URL}/#/`) || window.location.origin === new URL(SITE_URL).origin) return;
    e.preventDefault();
    window.location.hash = href.slice(SITE_URL.length + 1);
  };

  return (
    <AppearanceProvider value={appearance}>
      <div className="site" onClickCapture={onClickCapture}>
        <SiteHeader current={route} appearance={appearance} onToggleTheme={toggleTheme} />
        <div className="site-body">
          {view.kind === 'home' ? <Landing />
            : view.kind === 'libraries' ? <LibrariesIndex />
            : view.kind === 'library' ? <LibraryPage id={view.id} />
            : view.kind === 'docs' ? <LibraryDocs id={view.id} appearance={appearance} />
            : <App />}
        </div>
      </div>
    </AppearanceProvider>
  );
}
