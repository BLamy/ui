/* The docs sites the BL site mounts beside the ui docs — docstream's, the editor's and the roadmap — each a DocsSite
   under its own hash prefix (`#/docstream/…`), loaded on first visit. */
import { lazy, Suspense } from 'react';
import { Spinner } from '@/components/ui/spinner';
import type { EmbeddedDocsProps } from './embedded';

/** Route prefixes, longest first (`docstream-editor` before `docstream`). */
export const DOCS_SITES = ['docstream-editor', 'docstream', 'roadmap'] as const;
export type DocsSiteId = (typeof DOCS_SITES)[number];

const SITES = {
  docstream: lazy(() => import('./docstream-docs')),
  'docstream-editor': lazy(() => import('./editor-docs')),
  roadmap: lazy(() => import('./roadmap-docs')),
} satisfies Record<DocsSiteId, unknown>;

export function LibraryDocs({ id, ...props }: EmbeddedDocsProps & { id: DocsSiteId }) {
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
