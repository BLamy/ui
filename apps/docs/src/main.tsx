import { lazy, StrictMode, Suspense } from 'react';
import * as ReactDOM from 'react-dom/client';
import '@brett_lamy/ui/styles.css';
// ui's sheet compiled with the registry blocks' Tailwind classes (loaded last, so it's the superset that wins).
import '@brett_lamy/registry/styles.css';
// Docstream's renderer sheet, in the same order dev loads it (after ui's). Imported here, not only through
// lazily-loaded modules, so the production build ships it in the entry CSS. (The editor's sheet comes layered
// inside ui's stylesheet — an unlayered copy here would outrank the kit's editor rules and every utility.)
import '@brett_lamy/docstream/styles.css';
import { DemoFullscreen, demoFromSearch } from '@brett_lamy/docstream';
import { AppearanceProvider } from '@/lib/theme';
import Site from './site/site';
import RenderPage from './app/render-page';
import { demoResolver } from './demos';
import MotionTools, { initMotionTools } from './motion-tools';

// Before anything renders: the slow-motion clock and the reduced-motion stand-in (⌥M opens the panel).
const motionParams = initMotionTools();

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

/* `?demo=<page>/<example>` (or `blocks/<slug>`, with `&variant=`) renders one demo full screen — the demo viewer's
   "Open in new tab" link. `&theme=dark|light`, else the docs' saved / OS appearance. */
const demo = demoFromSearch();
/* A library's own demos are namespaced: `?demo=docstream:<page>/<example>` (its docs site writes those links). */
const LIBRARY_DEMOS = {
  docstream: () => import('docstream-playground/demos'),
  'docstream-editor': () => import('docstream-editor-playground/demos'),
} as const;
const libraryDemo = demo && /^(docstream-editor|docstream):(.+)$/.exec(demo.src);
const LibraryDemo = libraryDemo ? lazy(() => LIBRARY_DEMOS[libraryDemo[1] as keyof typeof LIBRARY_DEMOS]().then((m) => ({
  default: () => <DemoFullscreen src={libraryDemo[2]} variant={demo?.variant} resolver={m.demoResolver} style={{ width: '100vw', height: '100dvh' }} />,
}))) : null;
const search = new URLSearchParams(window.location.search);
/* `?render[&resolver=0]` renders arbitrary docstream Markdown like a page (the Copy page round-trip check). */
const render = search.has('render');
/* `?harness=<name>` (dev server only) renders Tailscale components on an in-memory tailnet for tools/e2e. It is test
   tooling, not a demo, and the production build drops it. */
const harness = import.meta.env.DEV ? search.get('harness') : null;
const E2eHarness = import.meta.env.DEV ? lazy(() => import('./e2e-harness')) : null;
const theme = search.get('theme') ?? window.localStorage.getItem('bldocs-theme');
const appearance = theme === 'dark' || theme === 'light' ? theme : window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
if (demo || render || harness) document.documentElement.dataset.theme = appearance;

root.render(
  <StrictMode>
    {harness && E2eHarness ? (
      <AppearanceProvider value={appearance}>
        <Suspense fallback={null}><E2eHarness name={harness} /></Suspense>
      </AppearanceProvider>
    ) : LibraryDemo ? (
      <AppearanceProvider value={appearance}>
        <div data-docstream=""><Suspense fallback={null}><LibraryDemo /></Suspense></div>
      </AppearanceProvider>
    ) : demo ? (
      <AppearanceProvider value={appearance}>
        <DemoFullscreen src={demo.src} variant={demo.variant} resolver={demoResolver} style={{ width: '100vw', height: '100dvh' }} />
      </AppearanceProvider>
    ) : render ? (
      <AppearanceProvider value={appearance}>
        <RenderPage resolver={search.get('resolver') !== '0'} />
      </AppearanceProvider>
    ) : <Site />}
    <MotionTools initiallyOpen={motionParams} />
  </StrictMode>,
);
