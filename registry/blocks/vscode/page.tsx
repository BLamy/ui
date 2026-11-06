'use client';
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties } from 'react';
import { AdaptivePane } from '@/components/ui/adaptive-pane';
import { TabView, TabViewBar, TabViewIndicator, TabViewList, TabViewSeparator, TabViewTab } from '@/components/ui/tab-view';
import { useContainerWidth } from '@/lib/container';
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

/** Below this the window shows one pane at a time. */
const NARROW_WIDTH = 640;

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
    <TabViewTab
      id={id}
      textValue={label}
      className="relative grid size-11 cursor-pointer place-items-center text-muted-foreground outline-none data-focus-visible:ring-2 data-focus-visible:ring-ring/45 data-focus-visible:ring-inset data-hovered:text-foreground data-selected:text-foreground"
      onPointerDownCapture={note}
      onPress={(event) => {
        if (store.narrow || (store.view !== id && store.lastSideView !== id)) return;
        store.toggleSidebar(!(event.pointerType === 'keyboard' ? store.sidebarOpen : wasOpen.current));
      }}
    >
      <TabViewIndicator />
      <span title={label} className="grid size-full place-items-center">
        <Icon name={icon} size={21} sw={1.6} />
      </span>
    </TabViewTab>
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
  const [host, width] = useContainerWidth<HTMLDivElement>();
  const narrow = width < NARROW_WIDTH;
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
      <div className="flex min-h-0 min-w-0 flex-1">
        {/* The rail, on its own: what it selects isn't a tab panel, because whatever a TabView holds, react-aria also
            renders in a hidden pass where a Workspace can't measure itself. */}
        <TabView
          placement="start"
          selectedKey={sidebarView ?? (narrow ? view : store.lastSideView)}
          onSelectionChange={(key) => {
            store.setView(key as ViewId);
            if (!narrow) store.toggleSidebar(true);
          }}
          className="shrink-0"
        >
          <TabViewBar variant="plain" className="w-11 shrink-0 items-center gap-0.5 border-e border-border bg-muted py-0.5">
            <TabViewList aria-label="Views" className="flex flex-col items-center gap-0.5">
              {SIDE_VIEWS.map((item) => <RailTab key={item.id} store={store} {...item} />)}
              {narrow ? <TabViewSeparator className="my-1 h-px w-6" /> : null}
              {narrow ? PANE_VIEWS.map((item) => <RailTab key={item.id} store={store} {...item} />) : null}
            </TabViewList>
          </TabViewBar>
        </TabView>
        <div className="relative flex min-h-0 min-w-0 flex-1">
          <AdaptivePane
            mode="column"
            columnWidth={narrow ? '100%' : 240}
            columnStyle={showSidebar ? undefined : { display: 'none' }}
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
    </div>
  );
}
