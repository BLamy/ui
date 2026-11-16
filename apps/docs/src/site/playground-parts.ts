/* What docstream's and the editor's docs borrow from their playgrounds (apps/docstream-playground,
   apps/docstream-editor-playground): the live-code renderers, the inline-demo runtime and the sources the
   `{% source-ref %}` pages point at. The playgrounds are TypeScript projects of their own, outside this one's root,
   so they come in through eager globs — bundled exactly like imports, typed by the shapes below, and checked by their
   own projects rather than pulled into this one. */
import type { BundledSourceModule, InlineDemoRuntime, LivePreviewRenderer } from '@brett_lamy/ui/docstream';

const one = <T>(modules: Record<string, T>): T => {
  const [first] = Object.values(modules);
  if (!first) throw new Error('A playground module the site uses has moved');
  return first;
};

export const docstreamLiveRenderer = one(import.meta.glob<{ liveRenderer: LivePreviewRenderer }>('../../../docstream-playground/src/live-renderer.tsx', { eager: true })).liveRenderer;
export const docstreamDemoRuntime = one(import.meta.glob<{ demoRuntime: InlineDemoRuntime }>('../../../docstream-playground/src/inline-demo-runtime.tsx', { eager: true })).demoRuntime;
export const editorLiveRenderer = one(import.meta.glob<{ liveRenderer: LivePreviewRenderer }>('../../../docstream-editor-playground/src/live-renderer.tsx', { eager: true })).liveRenderer;

/** `Button.tsx` and `Button.stories.tsx`, by file name, for docstream's bundled source client. */
export const docstreamSourceModules: Record<string, BundledSourceModule> = Object.fromEntries(
  Object.entries(import.meta.glob<BundledSourceModule>('../../../docstream-playground/src/examples/Button{,.stories}.tsx', { eager: true }))
    .map(([path, module]) => [path.slice(path.lastIndexOf('/') + 1), module]),
);
