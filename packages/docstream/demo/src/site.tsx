/* docstream's documentation as one component: the docs/ folder through DocsSite, with the live demos, renderers and
   citation previews its pages use. The playground (main.tsx) mounts it on its own; the BL site mounts it under
   `#/docstream` beside the other libraries. Add a file under docs/ and it's a page in both. */
import { useMemo } from 'react';
import { DocstreamRefContext, SourcePreview, createBundledSourceClient, type CitationPreviewResolver, type SourceReferenceClient, type SourceReferenceRenderer } from '@brett_lamy/docstream';
import { DocsSite, humanize, type BuildDocsTreeOptions, type DocsSiteProps } from '@brett_lamy/docstream/site';
import { createDemoResolver } from './demos';
import { demoRuntime } from './inline-demo-runtime';
import * as ButtonModule from './examples/Button';
import * as ButtonStoriesModule from './examples/Button.stories';
import { liveRenderer } from './live-renderer';

/* The text files beside the pages (OpenAPI specs, …) come along as the site's assets. */
export const docstreamFiles = import.meta.glob('../docs/**/*.{md,json,yaml,yml}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

// Folder names are humanized ("getting-started" → "Getting started"); these read better spelled out.
const FOLDER_TITLES: Record<string, string> = { ai: 'AI', media: 'Media & embeds' };
const treeOptions: BuildDocsTreeOptions = { folderTitle: (name) => FOLDER_TITLES[name] ?? humanize(name) };

/** The repo's sources for `{% source-ref %}` blocks, bundled (the playground swaps in its Vite dev server's live copy). */
export const bundledSourceClient = createBundledSourceClient({
  'Button.tsx': ButtonModule,
  'Button.stories.tsx': ButtonStoriesModule,
});

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

export const DocstreamLogo = () => (
  <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
    <rect width="32" height="32" rx="8" fill="var(--primary)" />
    <path d="M9 10.5h9M9 16h14M9 21.5h6" stroke="var(--primary-foreground)" strokeWidth="2.6" strokeLinecap="round" />
    <circle cx="21.5" cy="21.5" r="2" fill="var(--primary-foreground)" />
  </svg>
);

export const REPO = 'https://github.com/BLamy/ui';
export const DOCS_URL = 'https://blamy.github.io/ui/#/docstream';

export interface DocstreamDocsProps extends Partial<DocsSiteProps> {
  /** Serves `{% source-ref %}` blocks. Defaults to the bundled copies. */
  sourceClient?: SourceReferenceClient;
  /** Namespaces the demos' "Open in new tab" links (`?demo=<prefix><page>/<example>`). */
  demoPrefix?: string;
}

/** The docstream docs site. Every DocsSite prop can be overridden (routing, basePath, theme, header links, …). */
export function DocstreamDocs({ sourceClient = bundledSourceClient, demoPrefix = '', ...props }: DocstreamDocsProps) {
  const demoResolver = useMemo(() => createDemoResolver(demoPrefix), [demoPrefix]);
  const sourceRenderer = useMemo<SourceReferenceRenderer>(() => (reference) => <SourcePreview reference={reference} client={sourceClient} />, [sourceClient]);
  return (
    <DocstreamRefContext.Provider value={{ resolveCitationPreview: citationPreviews }}>
      <DocsSite
        files={docstreamFiles}
        treeOptions={treeOptions}
        title="docstream"
        logo={<DocstreamLogo />}
        links={[
          { label: 'GitHub', href: `${REPO}/tree/main/packages/docstream` },
          { label: 'npm', href: 'https://www.npmjs.com/package/@brett_lamy/docstream' },
        ]}
        liveRenderer={liveRenderer}
        sourceRenderer={sourceRenderer}
        demoResolver={demoResolver}
        demoRuntime={demoRuntime}
        pageActions={(page) => ({ transform: (md) => `${md.trim()}\n\n---\n\nSource: ${DOCS_URL}/${page.slug}\n` })}
        editUrl={(page) => `${REPO}/edit/main/packages/docstream/demo/docs/${page.path}`}
        sidebarFooter={<>This site is a folder of Markdown, rendered by <a href="#/docstream/docs-site">DocsSite</a>.</>}
        {...props}
      />
    </DocstreamRefContext.Provider>
  );
}

export { createDemoResolver };
