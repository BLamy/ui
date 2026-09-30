import { StrictMode } from 'react';
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
import App from './app/app';
import RenderPage from './app/render-page';
import { demoResolver } from './demos';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

/* `?demo=<page>/<example>` (or `blocks/<slug>`, with `&variant=`) renders one demo full screen — the demo viewer's
   "Open in new tab" link. `&theme=dark|light`, else the docs' saved / OS appearance. */
const demo = demoFromSearch();
const search = new URLSearchParams(window.location.search);
/* `?render[&resolver=0]` renders arbitrary docstream Markdown like a page (the Copy page round-trip check). */
const render = search.has('render');
const theme = search.get('theme') ?? window.localStorage.getItem('bldocs-theme');
const appearance = theme === 'dark' || theme === 'light' ? theme : window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
if (demo || render) document.documentElement.dataset.theme = appearance;

root.render(
  <StrictMode>
    {demo ? (
      <AppearanceProvider value={appearance}>
        <DemoFullscreen src={demo.src} variant={demo.variant} resolver={demoResolver} style={{ width: '100vw', height: '100dvh' }} />
      </AppearanceProvider>
    ) : render ? (
      <AppearanceProvider value={appearance}>
        <RenderPage resolver={search.get('resolver') !== '0'} />
      </AppearanceProvider>
    ) : <App />}
  </StrictMode>,
);
