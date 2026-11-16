/* Docstream's documentation inside the BL site, at `#/docstream/<page>`: the playground's docs/ folder through DocsSite,
   with its live demos, live-code renderer, inline-demo runtime and citation previews. The playground
   (apps/docstream-playground) serves the same folder on its own; a page added there is a page here. */
import { useMemo } from 'react';
import { DocstreamRefContext, SourcePreview, createBundledSourceClient, type CitationPreviewResolver, type SourceReferenceRenderer } from '@brett_lamy/ui/docstream';
import { DocsSite, humanize, type BuildDocsTreeOptions } from '@brett_lamy/ui/docstream/site';
import { docstreamDemos } from './library-demos';
import { embeddedSiteProps, type EmbeddedDocsProps } from './embedded';
import { docstreamDemoRuntime, docstreamLiveRenderer, docstreamSourceModules } from './playground-parts';
import { BLMark, REPO_URL } from './site-parts';

const files = import.meta.glob('../../../docstream-playground/docs/**/*.{md,json,yaml,yml}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

// Folder names are humanized ("getting-started" → "Getting started"); these read better spelled out.
const FOLDER_TITLES: Record<string, string> = { ai: 'AI', media: 'Media & embeds' };
const treeOptions: BuildDocsTreeOptions = { folderTitle: (name) => FOLDER_TITLES[name] ?? humanize(name) };

/** The repo's sources for `{% source-ref %}` blocks, bundled. */
const sourceClient = createBundledSourceClient(docstreamSourceModules);

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

const DOCS_URL = 'https://blamy.github.io/ui/#/docstream';

export default function DocstreamDocs(props: EmbeddedDocsProps) {
  const sourceRenderer = useMemo<SourceReferenceRenderer>(() => (reference) => <SourcePreview reference={reference} client={sourceClient} />, []);
  return (
    <DocstreamRefContext.Provider value={{ resolveCitationPreview: citationPreviews }}>
      <DocsSite
        files={files}
        treeOptions={treeOptions}
        basePath="docstream"
        title="Docstream"
        logo={<BLMark />}
        links={[{ label: 'Source', href: `${REPO_URL}/tree/main/packages/ui/src/docstream` }]}
        liveRenderer={docstreamLiveRenderer}
        sourceRenderer={sourceRenderer}
        demoResolver={docstreamDemos}
        demoRuntime={docstreamDemoRuntime}
        pageActions={(page) => ({ transform: (md) => `${md.trim()}\n\n---\n\nSource: ${DOCS_URL}/${page.slug}\n` })}
        editUrl={(page) => `${REPO_URL}/edit/main/apps/docstream-playground/docs/${page.path}`}
        sidebarFooter={<>Part of <code>@brett_lamy/ui</code> since 6.0: <code>@brett_lamy/ui/docstream</code>.</>}
        {...embeddedSiteProps(props)}
      />
    </DocstreamRefContext.Provider>
  );
}
