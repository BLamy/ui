/* The docs sites the BL site mounts beside the ui docs — docstream's, the editor's, the roadmap and the libraries — each a DocsSite
   under its own hash prefix (`#/docstream/…`), loaded on first visit. None draws a header: the site's header is the
   only bar, and holds their search and navigation buttons through `controller`. */
import { lazy, Suspense } from 'react';
import type { DocsSiteController } from '@brett_lamy/ui/docstream/site';
import { Spinner } from '@/components/ui/spinner';
import type { EmbeddedDocsProps } from './embedded';

/** Route prefixes, longest first (`docstream-editor` before `docstream`). */
export const DOCS_SITES = ['docstream-editor', 'docstream', 'roadmap', 'libraries'] as const;
export type DocsSiteId = (typeof DOCS_SITES)[number];

const SITES = {
  docstream: lazy(() => import('./docstream-docs')),
  'docstream-editor': lazy(() => import('./editor-docs')),
  roadmap: lazy(() => import('./roadmap-docs')),
  libraries: lazy(() => import('./libraries-docs')),
} satisfies Record<DocsSiteId, unknown>;

export function LibraryDocs({ id, ...props }: EmbeddedDocsProps & { id: DocsSiteId; controller: DocsSiteController }) {
  const Site = SITES[id];
  return (
    <Suspense
      fallback={(
        <div role="status" className="grid h-full place-items-center bg-background text-footnote text-muted-foreground">
          <span className="flex items-center gap-2"><Spinner size={16} /> Loading the docs…</span>
        </div>
      )}
    >
      <Site {...props} />
    </Suspense>
  );
}
