'use client';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { AdaptivePane } from '@/components/ui/adaptive-pane';
import { Tabs, TabsBar, TabsIndicator, TabsList, TabsSeparator, TabsTab } from '@/components/ui/tabs';
import { SizeClassProvider, useSizeClass } from '@/lib/container';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import type { Tailscale, TailscaleOptions } from '@/lib/tailscale';
import { TailscaleProvider, useOptionalTailscale, useTailscale } from '@/lib/tailscale-react';
import { createAlmostnodeRuntime } from './almostnode';
import { EditorArea } from './editor-area';
import { Explorer, ExplorerDialogs } from './explorer';
import { RunPanel } from './run-panel';
import type { VSCodeRuntime } from './runtime';
import { SearchPanel } from './search-panel';
import { StatusBar } from './status-bar';
import { VSCodeStore, type SidebarView, type ViewId } from './store';
import { vscodeTailnet } from './tailnet';

export interface VSCodeProps {
  /** Share an existing connection, such as the macOS desktop's. */
  controller?: Tailscale;
  /** Options for the standalone Tailscale device. */
  tailscale?: TailscaleOptions;
  /** What's behind the window: its files, terminals, scripts and status. Default: `createAlmostnodeRuntime()`, Node in
   *  the browser on a small starter project. A runtime you pass stays yours to dispose of. */
  runtime?: VSCodeRuntime;
  /** The file open to begin with, relative to the runtime's root. */
  initialFile?: string;
  /** The rail's tab to start on: a side panel, or in a narrow window also the editor or the terminal. */
  initialView?: ViewId;
  className?: string;
  style?: CSSProperties;
}

const SIDE_VIEWS: Array<{ id: SidebarView; icon: string; label: string }> = [
  { id: 'explorer', icon: 'copy', label: 'Explorer' },
  { id: 'search', icon: 'magnifyingglass', label: 'Search' },
  { id: 'run', icon: 'play', label: 'Run' },
];
const PANE_VIEWS: Array<{ id: ViewId; icon: string; label: string }> = [
  { id: 'editor', icon: 'doc', label: 'Editor' },
  { id: 'terminal', icon: 'terminal', label: 'Terminal' },
];

function RailTab({ store, id, icon, label }: { store: VSCodeStore; id: ViewId; icon: string; label: string }) {
  // Pressing the tab that's already selected opens or closes the sidebar, and a press selects before it ends.
  const wasOpen = useRef(false);
  const note = () => { wasOpen.current = store.view === id && store.sidebarOpen; };
  return (
    <TabsTab
      value={id}
      aria-label={label}
      className="relative grid size-11 cursor-pointer place-items-center text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-inset hover:text-foreground data-selected:text-foreground"
      onPointerDownCapture={note}
      onClick={(event) => {
        if (store.narrow || (store.view !== id && store.lastSideView !== id)) return;
        // Enter or Space clicks without a pointer (`detail` 0): the sidebar is read as it is now.
        store.toggleSidebar(!(event.detail === 0 ? store.sidebarOpen : wasOpen.current));
      }}
    >
      <span title={label} className="grid size-full place-items-center">
        <Icon name={icon} size={21} sw={1.6} />
      </span>
    </TabsTab>
  );
}

/** A VS Code window: a rail of views, editors and terminals you can arrange, and a Node runtime behind them all. */
export default function VSCode({ controller, tailscale, ...props }: VSCodeProps) {
  const shared = useOptionalTailscale(controller);
  const [options] = useState(() => tailscale ?? vscodeTailnet());
  return <TailscaleProvider tailscale={shared ?? undefined} options={options}><VSCodeWindow {...props} /></TailscaleProvider>;
}

function VSCodeWindow({ runtime, initialFile, initialView, className, style }: VSCodeProps) {
  const tailscale = useTailscale();
  const [store] = useState(() => new VSCodeStore(runtime ?? createAlmostnodeRuntime({ tailscale }), { initialFile, initialView }));
  // Only a runtime made here is this window's to end. Like the store, it's chosen when the window mounts.
  const [owned] = useState(() => !runtime);
  useEffect(() => {
    store.mount();
    return () => store.unmount(owned ? () => store.runtime.dispose?.() : undefined);
  }, [store, owned]);
  // A compact window shows one pane at a time.
  const [host, sizeClass] = useSizeClass<HTMLDivElement>();
  const narrow = sizeClass === 'compact';
  const started = useRef(false);
  useLayoutEffect(() => {
    store.setNarrow(narrow);
    // Where it starts is read once. The rail has no editor or terminal tab in a wide window.
    if (started.current) return;
    started.current = true;
    if (initialView && (narrow || (initialView !== 'editor' && initialView !== 'terminal'))) store.setView(initialView);
  }, [store, narrow]);
  useSyncExternalStore(store.subscribe, store.getVersion);
  const view = store.view;
  const sidebarView = view === 'editor' || view === 'terminal' ? null : view;
  const lastSideView = store.lastSideView;
  const showSidebar = narrow ? !!sidebarView : store.sidebarOpen;
  const showMain = !narrow || !sidebarView;
  return (
    <div
      ref={host}
      data-slot="vscode"
      data-narrow={narrow || undefined}
      className={cn('@container/vscode relative flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-background font-sans text-foreground', className)}
      style={style}
    >
      {/* The window is a size-class scope: its popups (the Explorer's dialogs) are trays when it is compact. */}
      <SizeClassProvider value={sizeClass}>
        <div className="flex min-h-0 min-w-0 flex-1">
          {/* The rail, on its own: what it selects isn't a tab panel. The side panels stay mounted beside the
              editors, and the editors and terminals are panes of one Workspace. */}
          <Tabs<ViewId>
            variant="plain"
            side="start"
            value={sidebarView ?? (narrow ? view : store.lastSideView)}
            onValueChange={(value) => {
              if (!value) return;
              store.setView(value);
              if (!narrow) store.toggleSidebar(true);
            }}
            className="shrink-0"
          >
            <TabsBar className="w-11 shrink-0 items-center gap-0.5 border-e border-border bg-muted py-0.5">
              <TabsList aria-label="Views" className="flex flex-col items-center gap-0.5">
                {SIDE_VIEWS.map((item) => <RailTab key={item.id} store={store} {...item} />)}
                {narrow ? <TabsSeparator className="my-1 h-px w-6" /> : null}
                {narrow ? PANE_VIEWS.map((item) => <RailTab key={item.id} store={store} {...item} />) : null}
                <TabsIndicator />
              </TabsList>
            </TabsBar>
          </Tabs>
          <div className="relative flex min-h-0 min-w-0 flex-1">
            <AdaptivePane
              presentation="column"
              open={showSidebar}
              columnWidth={narrow ? '100%' : 240}
              resizable={!narrow}
              minWidth={160}
            >
              {/* The panels stay mounted, so that the Explorer keeps which folders are open. */}
              <div className={cn('h-full min-h-0 bg-sidebar text-sidebar-foreground', !narrow && 'border-e border-border')}>
                {SIDE_VIEWS.map(({ id, label }) => (
                  <section key={id} aria-label={label} hidden={(sidebarView ?? lastSideView) !== id} className="h-full min-h-0 overflow-hidden">
                    {id === 'explorer' ? <Explorer store={store} /> : id === 'search' ? <SearchPanel store={store} /> : <RunPanel store={store} />}
                  </section>
                ))}
              </div>
            </AdaptivePane>
            <main className={cn('min-h-0 min-w-0 flex-1', !showMain && 'hidden')}>
              <EditorArea store={store} />
            </main>
          </div>
        </div>
        <StatusBar store={store} />
        <ExplorerDialogs store={store} />
      </SizeClassProvider>
    </div>
  );
}
