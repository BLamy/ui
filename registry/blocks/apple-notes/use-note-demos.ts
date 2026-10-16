import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { collectDemoNodes, createDemoVFS, useDemoResolver, type DemoResolver, type InlineDemoRuntime } from '@brett_lamy/docstream/demo';
import { parseMarkdown } from '@brett_lamy/docstream/gitbook';
import { createLocalDemoReader, type DemoDirectory } from './local-demo-files';

/** Added folders supply code and metadata to Docstream's live demo VFS, including updates from other editors. */
export function useNoteDemos(body: string, path: string, roots: DemoDirectory[]) {
  const inherited = useDemoResolver();
  const [vfs] = useState(createDemoVFS);
  const [runtime, setRuntime] = useState<InlineDemoRuntime>();
  const [error, setError] = useState<string>();
  const snapshot = useSyncExternalStore(vfs.subscribe, vfs.snapshot, vfs.snapshot);
  const resolver = useMemo<DemoResolver>(() => {
    const local = vfs.resolver({ runtime });
    const known = (src: string) => !!inherited && (!inherited.list || inherited.list().includes(src));
    return {
      list: () => [...new Set([...(inherited?.list?.() ?? []), ...Object.keys(snapshot)])],
      files: (src) => vfs.has(src) ? local.files(src) : inherited?.files(src) ?? local.files(src),
      meta: async (src) => ({ ...(known(src) && inherited ? await inherited.meta(src) : {}), ...(vfs.get(src)?.meta ?? {}) }),
      load: (src) => known(src) && inherited ? inherited.load(src) : local.load(src),
    };
  }, [inherited, snapshot, vfs, runtime]);
  const nodes = useMemo(() => collectDemoNodes(parseMarkdown(body)), [body]);
  const sources = [...new Set(nodes.filter((node) => node.src && !node.files?.length).map((node) => node.src))].sort().join('\n');
  const rootKey = roots.map((root) => root.path).join('\n');
  // Directory handles are stable for each mounted path; do not restart polling on every note render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const read = useMemo(() => createLocalDemoReader(roots, path), [rootKey, path]);
  useEffect(() => {
    let active = true; let timer: ReturnType<typeof setTimeout>;
    vfs.clear(); setError(undefined);
    if (!nodes.length) return;
    void import('@brett_lamy/docstream/playground').then((module) => {
      const basePath = new URL('.', document.baseURI).pathname.replace(/\/$/, '');
      if (active) setRuntime(() => module.createAlmostNodeDemoRuntime({ workspaceOptions: { basePath } }));
    }).catch((cause) => { if (active) setError(String(cause)); });
    const poll = async () => {
      let problem: string | undefined;
      for (const src of sources.split('\n').filter(Boolean)) {
        try {
          const example = await read(src, !inherited?.list?.().includes(src));
          if (!active) return;
          if (example) vfs.set(src, example.files, example.meta);
          else { vfs.delete(src); if (!inherited?.list?.().includes(src)) problem = `Example “${src}” wasn't found in your added folders.`; }
        } catch (cause) { problem = `Couldn't load “${src}”: ${cause instanceof Error ? cause.message : String(cause)}`; }
      }
      if (active) { setError(problem); timer = setTimeout(() => { void poll(); }, 1500); }
    };
    void poll();
    return () => { active = false; clearTimeout(timer); };
    // The source ids, document path and mounted roots govern file watching; typing prose doesn't restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources, read, vfs, inherited, !!nodes.length]);
  return { vfs, runtime, resolver, error };
}
