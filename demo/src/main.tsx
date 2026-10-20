import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DemoFullscreen, DocstreamRefContext, SourcePreview, createBundledSourceClient, createViteSourceClient, demoFromSearch, type CitationPreviewResolver, type SourceReferenceRenderer } from '@brett_lamy/docstream';
import { DocsSite, humanize, type BuildDocsTreeOptions } from '@brett_lamy/docstream/site';
import '@brett_lamy/docstream/styles.css';
import './site.css';
import { demoResolver } from './demos';
import { demoRuntime } from './inline-demo-runtime';
import * as ButtonModule from './examples/Button';
import * as ButtonStoriesModule from './examples/Button.stories';
import { liveRenderer } from './live-renderer';

/* The whole site is the docs/ folder: DocsSite keeps the Markdown, builds the sidebar from the
   folders, and renders every page through docstream. Add a file there and it's on the site. */
const files = import.meta.glob('../docs/**/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

// Folder names are humanized ("getting-started" → "Getting started"); these read better spelled out.
const FOLDER_TITLES: Record<string, string> = { ai: 'AI', media: 'Media & embeds' };
const treeOptions: BuildDocsTreeOptions = { folderTitle: (name) => FOLDER_TITLES[name] ?? humanize(name) };

const bundledSourceClient = createBundledSourceClient({
  'Button.tsx': ButtonModule,
  'Button.stories.tsx': ButtonStoriesModule,
});
const sourceClient = import.meta.env.DEV ? createViteSourceClient() : bundledSourceClient;
const sourceRenderer: SourceReferenceRenderer = (reference) => <SourcePreview reference={reference} client={sourceClient} />;
const citationPreviews: CitationPreviewResolver = (citation) => {
  if (citation.url?.includes('trends.google.com')) {
    return {
      title: 'Explore what the world is searching',
      description: 'Compare search interest for ice cream flavors across regions and time ranges with Google Trends.',
      siteName: 'Google Trends',
      image: 'https://ssl.gstatic.com/trends_nrtr/4116_RC01/embed_loader.gif',
    };
  }
  if (citation.url?.includes('scoopdata.io')) {
    return {
      title: citation.label ?? 'ScoopData Q3 report',
      description: 'Quarterly category performance, seasonal shifts, and the signals behind this period’s strongest movers.',
      siteName: 'ScoopData',
      image: 'https://images.unsplash.com/photo-1570197788417-0e82375c9371?auto=format&fit=crop&w=640&q=80',
    };
  }
  return null;
};

const Logo = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="8" fill="var(--primary)" />
    <path d="M9 10.5h9M9 16h14M9 21.5h6" stroke="var(--primary-foreground)" strokeWidth="2.6" strokeLinecap="round" />
    <circle cx="21.5" cy="21.5" r="2" fill="var(--primary-foreground)" />
  </svg>
);

const GITHUB = 'https://github.com/BLamy/docstream';
const SITE = 'https://blamy.github.io/docstream/';

function App() {
  return (
    <DocstreamRefContext.Provider value={{ resolveCitationPreview: citationPreviews }}>
      <DocsSite
        files={files}
        treeOptions={treeOptions}
        title="docstream"
        logo={<Logo />}
        links={[
          { label: 'GitHub', href: GITHUB },
          { label: 'npm', href: 'https://www.npmjs.com/package/@brett_lamy/docstream' },
        ]}
        themeStorageKey="docstream-demo-theme"
        liveRenderer={liveRenderer}
        sourceRenderer={sourceRenderer}
        demoResolver={demoResolver}
        demoRuntime={demoRuntime}
        pageActions={(page) => ({ transform: (md) => `${md.trim()}\n\n---\n\nSource: ${SITE}#/${page.slug}\n` })}
        editUrl={(page) => `${GITHUB}/edit/main/demo/docs/${page.path}`}
        sidebarFooter={<>This site is a folder of Markdown, rendered by <a href="#/docs-site">DocsSite</a>.</>}
      />
    </DocstreamRefContext.Provider>
  );
}

/** `?demo=<page>/<example>` renders one demo alone (the viewer's "Open in new tab"). */
function Fullscreen({ src, variant }: { src: string; variant?: string }) {
  const theme = new URLSearchParams(location.search).get('theme') ?? localStorage.getItem('docstream-demo-theme');
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
