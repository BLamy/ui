/* Worktree Atlas — every Git worktree under the folders you open, grouped by repository. The sidebar folds each
   project open to its worktrees (right-click one to delete it, always through a confirmation Credenza), with a
   rail that switches between Files and Changes. The master column is the open worktree's file tree: every file
   (Files) or what it changes against main (Changes); the detail shows the picked file, or the diff in a
   @pierre/diffs view. One SplitView at every size: three columns on desktop, a floating sidebar on an iPad, a
   stack on the phone.
   Data comes from a `WorktreeSource`. By default that is the browser itself: open folders (File System Access)
   and Git is read in the page with isomorphic-git, no server or desktop app. Pass `source` to plug in another,
   such as a desktop app's Git CLI bridge, or `createDemoSource()` for the sample repositories. */
import { useMemo, useState, useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';
import { SplitView } from '@/components/ui/split-view';
import { Icon } from '@/lib/icon';
import { AppearanceProvider, BLProvider, useAppearance, type Appearance } from '@/lib/theme';
import { browserFoldersSupported, createBrowserSource } from './browser-source';
import { createDemoSource } from './data';
import { DeleteCredenza } from './delete-credenza';
import { DetailColumn } from './detail-column';
import { FileColumn } from './file-column';
import { ProjectsSidebar } from './sidebar';
import type { WorktreeSource } from './types';
import { useAtlas, type AtlasView } from './use-atlas';

export type { WorktreeSource } from './types';
export { createBrowserSource, createDemoSource };

export interface WorktreeAtlasProps {
  /** Light or dark. Defaults to the ambient AppearanceProvider, else light. */
  appearance?: Appearance;
  /** Where worktrees come from. Default: folders opened in this browser (sample data where that isn't supported). */
  source?: WorktreeSource;
  /** Worktree open at mount (wide layouts). */
  initialWorktree?: string | null;
  /** What the rail shows at mount: the checkout's files, or its changes against main (default). */
  initialView?: AtlasView;
}

/** An accent that reads as "developer tool": iOS indigo. */
const ATLAS_TINT = { light: '#5856D6', dark: '#5E5CE6' } as const;

/** The browser source, made once per mount, re-rendering whenever its folders change. */
function useBrowserSource(enabled: boolean) {
  const [store] = useState(() => {
    const listeners = new Set<() => void>();
    let version = 0;
    const source = enabled ? createBrowserSource({ onLocationsChange: () => { version++; for (const l of listeners) l(); } }) : null;
    return { source, subscribe: (l: () => void) => { listeners.add(l); return () => listeners.delete(l); }, version: () => version };
  });
  useSyncExternalStore(store.subscribe, store.version, store.version);
  return store.source;
}

function Welcome({ onAdd, onSample }: { onAdd: () => void; onSample: () => void }) {
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-background/80 p-6 backdrop-blur-md">
      <div className="w-full max-w-[420px] rounded-sheet bg-card p-7 text-center shadow-hairline">
        <span className="mx-auto grid size-14 place-items-center rounded-card bg-primary text-primary-foreground"><Icon name="layers" size={28} /></span>
        <h2 className="mt-4 text-title font-bold">Worktree Atlas</h2>
        <p className="mt-2 text-subhead leading-[1.45] text-muted-foreground">
          Open the folder your projects live in (and any folder your agents keep worktrees in, like <code className="font-mono">~/.codex</code>).
          Git is read right here in the browser; nothing is uploaded.
        </p>
        <div className="mt-5 grid gap-2">
          <Button size="pill" onPress={onAdd}>Open Folder…</Button>
          <Button size="pill" variant="secondary" onPress={onSample}>Try Sample Data</Button>
        </div>
      </div>
    </div>
  );
}

function Atlas({ source, initialWorktree, initialView, onSample, onLeaveSample }: Omit<WorktreeAtlasProps, 'appearance' | 'source'> & {
  source: WorktreeSource; onSample?: () => void; onLeaveSample?: () => void;
}) {
  const [compact, setCompact] = useState(false);
  const atlas = useAtlas(source, { worktree: initialWorktree, view: initialView });
  const welcome = onSample && atlas.scanned && atlas.locations.length === 0;
  return (
    <>
      <SplitView aria-label="Worktree Atlas" defaultCompactColumn={initialWorktree ? 'supplementary' : 'sidebar'} onWidthClassChange={(wc) => setCompact(wc === 'compact')}
        selection={{ sidebar: atlas.worktreeId, supplementary: atlas.filePath }}
        onSelectionChange={(sel) => {
          if (sel.sidebar !== undefined && sel.sidebar !== atlas.worktreeId) atlas.open(sel.sidebar);
          else if (sel.supplementary !== undefined && sel.supplementary !== atlas.filePath) atlas.openFile(sel.supplementary);
        }}>
        <ProjectsSidebar atlas={atlas} footer={onLeaveSample ? <Button size="sm" variant="secondary" onPress={onLeaveSample}>Open My Folders</Button> : null} />
        <FileColumn atlas={atlas} />
        <DetailColumn atlas={atlas} />
      </SplitView>
      <DeleteCredenza atlas={atlas} compact={compact} />
      {welcome ? <Welcome onAdd={() => void atlas.addLocation()} onSample={onSample} /> : null}
    </>
  );
}

export default function WorktreeAtlas({ appearance, source, initialWorktree = null, initialView = 'changes' }: WorktreeAtlasProps) {
  const ambient = useAppearance();
  const dark = (appearance ?? ambient) === 'dark';
  const browser = useBrowserSource(!source && browserFoldersSupported());
  const [sample, setSample] = useState(false);
  const demo = useMemo(() => (source || (browser && !sample) ? null : createDemoSource()), [source, browser, sample]);
  const active = source ?? demo ?? browser!;
  return (
    <AppearanceProvider value={dark ? 'dark' : 'light'}>
      <BLProvider tint={ATLAS_TINT[dark ? 'dark' : 'light']} className="bg-background">
        <Atlas key={active === browser ? 'browser' : 'other'} source={active} initialWorktree={initialWorktree} initialView={initialView}
          onSample={active === browser ? () => setSample(true) : undefined}
          onLeaveSample={browser && sample && !source ? () => setSample(false) : undefined} />
      </BLProvider>
    </AppearanceProvider>
  );
}
