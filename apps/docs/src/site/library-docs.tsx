/* The libraries' docs sites, each a DocsSite under its own hash prefix (`#/docstream/…`), loaded on first visit. They
   follow the site's theme and sit under its header. */
import { lazy, Suspense } from 'react';
import { DocsSite } from '@brett_lamy/docstream/site';
import type { Appearance } from '@/lib/theme';
import { BLMark } from './site-header';
import { ROADMAP_FILES } from './roadmap';

const DocstreamDocs = lazy(() => import('docstream-playground/site').then((m) => ({ default: m.DocstreamDocs })));
const EditorDocs = lazy(() => import('docstream-editor-playground/site').then((m) => ({ default: m.EditorDocs })));

/** The libraries with docs sites of their own, by route prefix. */
export const DOCS_SITES = ['docstream-editor', 'docstream', 'roadmap'] as const;
export type DocsSiteId = (typeof DOCS_SITES)[number];

const shared = (appearance: Appearance) => ({
  theme: appearance,
  themeToggle: false,
  themeStorageKey: false as const,
  applyThemeTo: 'site' as const,
  height: 'calc(100dvh - var(--site-header-h))',
});

export function LibraryDocs({ id, appearance }: { id: DocsSiteId; appearance: Appearance }) {
  return (
    <div className="site-docs">
      <Suspense fallback={<div className="site-loading">Loading the docs…</div>}>
        {id === 'docstream' ? <DocstreamDocs basePath="docstream" demoPrefix="docstream:" {...shared(appearance)} />
          : id === 'docstream-editor' ? <EditorDocs basePath="docstream-editor" demoPrefix="docstream-editor:" {...shared(appearance)} />
          : (
            <DocsSite
              files={ROADMAP_FILES}
              basePath="roadmap"
              title="Roadmap"
              logo={<BLMark size={24} />}
              editUrl={(page) => (/^0[124]-/.test(page.path) ? undefined : `https://github.com/BLamy/ui/edit/main/apps/docs/roadmap/${page.path}`)}
              sidebarFooter={<>The package and module maps are generated from <code>libraries.ts</code>; a test checks them against the code.</>}
              {...shared(appearance)}
            />
          )}
      </Suspense>
    </div>
  );
}
