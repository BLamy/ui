import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DemoFullscreen, demoFromSearch } from '@brett_lamy/docstream';
import '@brett_lamy/docstream/styles.css';
import '@brett_lamy/docstream-editor/styles.css';
import './site.css';
import { demoResolver } from './demos';
import { EditorDocs } from './site';

/* The playground: the editor's docs on their own (`pnpm nx dev docstream-editor-playground`). The published docs are
   the same component inside the BL site (apps/docs, `#/docstream-editor`). */

/** `?demo=<page>/<example>` renders one demo alone (the viewer's "Open in new tab"). */
function Fullscreen({ src, variant }: { src: string; variant?: string }) {
  const theme = new URLSearchParams(location.search).get('theme') ?? localStorage.getItem('docstream-editor-demo-theme');
  document.documentElement.dataset.theme = theme === 'dark' || (!theme && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  return <div data-docstream=""><DemoFullscreen src={src} variant={variant} resolver={demoResolver} /></div>;
}

function Root() {
  const deepLink = demoFromSearch();
  return deepLink ? <Fullscreen src={deepLink.src} variant={deepLink.variant} /> : <EditorDocs themeStorageKey="docstream-editor-demo-theme" />;
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode><Root /></StrictMode>
);
