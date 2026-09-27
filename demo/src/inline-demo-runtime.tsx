/* Runs `{% demo %}` blocks that carry their files inline (a pasted, self-contained demo)
   when the site's resolver doesn't know them. The almost-node runtime is imported lazily
   from the playground entry, so it only loads once such a demo scrolls into view. */
import { Suspense, lazy } from 'react';
import type { InlineDemoRuntime } from '@brett_lamy/docstream';

const InlineDemoPreview = lazy(() =>
  import('../../src/playground').then((m) => ({ default: m.InlineDemoPreview })),
);

// Stable identity — it lands in the preview's effect deps.
const WORKSPACE_OPTIONS = {
  basePath: import.meta.env.BASE_URL.replace(/\/$/, ''),
};

export const demoRuntime: InlineDemoRuntime = (props) => (
  <Suspense fallback={<div className="docs-demo-runtime-status">Loading the almost-node runtime…</div>}>
    <InlineDemoPreview {...props} workspaceOptions={WORKSPACE_OPTIONS} />
  </Suspense>
);
