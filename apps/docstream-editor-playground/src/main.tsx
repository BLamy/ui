import { StrictMode, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { DemoFullscreen, demoFromSearch } from '@brett_lamy/ui/docstream';
import { DocsSite, humanize, type BuildDocsTreeOptions } from '@brett_lamy/ui/docstream/site';
// The library's stylesheet first (as the installation page tells an app to; it carries the editor's sheet, layered, so
// that isn't imported again), then docstream's: the kit's parts docstream draws (a workerd config's CloudflareDiagram) need it.
import '@brett_lamy/ui/styles.css';
import '@brett_lamy/ui/docstream/styles.css';
import './site.css';
import { demoResolver } from './demos';
import { liveRenderer } from './live-renderer';
import { useGithubEnv } from './github-env';

/* The whole site is the docs/ folder, published by docstream's DocsSite: the sidebar comes from
   the folders, and every page is rendered by docstream. Live editors are {% demo %} folders. */
const files = import.meta.glob('../docs/**/*.{md,json,yaml,yml,capnp}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const FOLDER_TITLES: Record<string, string> = { api: 'API' };
const treeOptions: BuildDocsTreeOptions = { folderTitle: (name) => FOLDER_TITLES[name] ?? humanize(name) };

const Logo = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="8" fill="var(--primary)" />
    <path d="M9 10.5h9M9 16h7M9 21.5h5" stroke="var(--primary-foreground)" strokeWidth="2.6" strokeLinecap="round" />
    <path d="m18.5 22.5 5.5-5.5 1.8 1.8-5.5 5.5-2.4.6z" fill="var(--primary-foreground)" />
  </svg>
);

const GITHUB = 'https://github.com/BLamy/docstream-editor';
const SITE = 'https://blamy.github.io/docstream-editor/';

function App() {
  // Pages that declare `env: [GITHUB_TOKEN]` get it from a GitHub sign-in (see github-env.tsx).
  const github = useGithubEnv();
  // Re-render the footer when the keychain changes (a token saved or forgotten).
  const saved = useSyncExternalStore(github.keychain.subscribe, () => github.keychain.names.join(','));
  return (
    <>
    <DocsSite
      files={files}
      treeOptions={treeOptions}
      title="docstream-editor"
      logo={<Logo />}
      links={[
        { label: 'GitHub', href: GITHUB },
        { label: 'npm', href: 'https://www.npmjs.com/package/@brett_lamy/ui/docstream-editor' },
        { label: 'docstream', href: 'https://blamy.github.io/docstream/' },
      ]}
      themeStorageKey="docstream-editor-demo-theme"
      liveRenderer={liveRenderer}
      demoResolver={demoResolver}
      envHost={github.host}
      pageActions={(page) => ({ transform: (md) => `${md.trim()}\n\n---\n\nSource: ${SITE}#/${page.slug}\n` })}
      editUrl={(page) => `${GITHUB}/edit/main/demo/docs/${page.path}`}
      sidebarFooter={<>
        A folder of Markdown, published with docstream's <a href="https://blamy.github.io/docstream/#/docs-site">DocsSite</a>.
        {saved ? <> Your keychain holds {saved.split(',').join(', ')}. <button type="button" className="gh-env-forget" onClick={() => void github.keychain.reset()}>Forget</button></> : null}
      </>}
    />
    {github.dialog}
    </>
  );
}

/** `?demo=<page>/<example>` renders one demo alone (the viewer's "Open in new tab"). */
function Fullscreen({ src, variant }: { src: string; variant?: string }) {
  const theme = new URLSearchParams(location.search).get('theme') ?? localStorage.getItem('docstream-editor-demo-theme');
  document.documentElement.dataset.theme = theme === 'dark' || (!theme && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
  return <div data-docstream=""><DemoFullscreen src={src} variant={variant} resolver={demoResolver} /></div>;
}

function Root() {
  const deepLink = demoFromSearch();
  return deepLink ? <Fullscreen src={deepLink.src} variant={deepLink.variant} /> : <App />;
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode><Root /></StrictMode>
);
