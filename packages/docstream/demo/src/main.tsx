import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DemoFullscreen, createViteSourceClient, demoFromSearch } from '@brett_lamy/docstream';
import '@brett_lamy/docstream/styles.css';
import './site.css';
import { demoResolver } from './demos';
import { DocstreamDocs } from './site';

/* The playground: docstream's docs on their own, served by this package's Vite dev server (`pnpm nx dev
   docstream-playground`). In dev, `{% source-ref %}` blocks read the live files through the docstreamSources plugin.
   The published docs are the same component inside the BL site (apps/docs, `#/docstream`). */
const sourceClient = import.meta.env.DEV ? createViteSourceClient() : undefined;

/** `?demo=<page>/<example>` renders one demo alone (the viewer's "Open in new tab"). */
function Fullscreen({ src, variant }: { src: string; variant?: string }) {
  const theme = new URLSearchParams(location.search).get('theme') ?? localStorage.getItem('docstream-demo-theme');
  document.documentElement.dataset.theme = theme === 'dark' || (!theme && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  return <div data-docstream=""><DemoFullscreen src={src} variant={variant} resolver={demoResolver} /></div>;
}

function Root() {
  const deepLink = demoFromSearch();
  return deepLink ? <Fullscreen src={deepLink.src} variant={deepLink.variant} /> : <DocstreamDocs sourceClient={sourceClient} themeStorageKey="docstream-demo-theme" />;
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode><Root /></StrictMode>
);
