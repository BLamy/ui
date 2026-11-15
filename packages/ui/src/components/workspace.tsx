'use client';

import { Fragment, createContext, memo, useCallback, useContext, useId, useLayoutEffect, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { createParts, usePart, usePrimitive, type PartProps } from '@ui-sdk/react/primitive';
import { Resizable, ResizableHandle, ResizablePanel } from '@ui-sdk/react/resizable';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@ui-sdk/react/tabs';
import { SizeClassProvider, useSizeClass } from '@/lib/container';
import { Icon } from '@/lib/icon';
import { cn, cx } from '@/lib/utils';
import {
  minSizeOf,
  splitSizes,
  workspaceTabsets,
  type SplitNode,
  type TabNode,
  type WorkspaceTabSide,
  type TabsetNode,
  type WorkspaceMinSize,
  type WorkspaceNode,
} from '@/lib/workspace-model';
import { Tabs as KitTabs, TabsBar, TabsList as KitTabsList, TabsTab as KitTabsTab } from '@/components/ui/tabs';
import {
  workspace,
  type WorkspaceApi,
  type WorkspaceOptions,
  type WorkspaceState,
  type WorkspaceTabsetState,
} from '@/lib/workspace-primitive';

export { workspaceTabsets } from '@/lib/workspace-model';
export type {
  SplitNode,
  TabDropRegion,
  TabDropTarget,
  TabNode,
  TabsetNode,
  WorkspaceLayout,
  WorkspaceLayoutInput,
  WorkspaceMinSize,
  WorkspaceNode,
  WorkspaceNodeInput,
  WorkspaceOrientation,
  WorkspaceTabSide,
} from '@/lib/workspace-model';
export { createWorkspaceController } from '@/lib/workspace-primitive';
export type {
  WorkspaceAction,
  WorkspaceChangeOptions,
  WorkspaceController,
  WorkspaceLayoutChangeDetails,
  WorkspaceLayoutChangeReason,
  WorkspaceLayoutCommitDetails,
  WorkspaceState,
  WorkspaceTabsetState,
  WorkspaceTabState,
} from '@/lib/workspace-primitive';

/* ══ Workspace — a dockable layout of tabsets, for editors and tools ══
   The layout is a tree you can save (lib/workspace-model): splits hold tabsets, tabsets hold tabs. Each split is
   UI SDK's Resizable and each tabset its Tabs, both driven by the workspace primitive (lib/workspace-primitive),
   which owns the layout and moves tabs: along a strip, to another tabset, or onto an edge to split there, by
   pointer or from the keyboard (Space picks a tab up, the arrows move it, Space drops it, Escape puts it back).
   A tab's content is rendered once, into an element of its own that the tab's panel adopts, so moving a tab
   keeps its React state and its DOM. */

const parts = createParts(workspace, {
  split: 'div',
  tabset: 'div',
  header: 'div',
  tab: 'div',
  'tab-close': 'button',
  toolbar: 'div',
  maximize: 'button',
  panels: 'div',
  empty: 'div',
  'drop-indicator': 'div',
});

/** Classes for the parts a workspace renders from its layout. Each merges over the kit's own. */
export type WorkspaceClassNames = {
  /** A split: UI SDK's Resizable (`data-orientation`). */
  split?: string;
  /** The handle between two children of a split (`data-hovering`, `data-dragging`). */
  handle?: string;
  /** A tabset (`data-current`, `data-maximized`, `data-empty`, `data-tab-side`). */
  tabset?: string;
  /** The strip that holds a tabset's tabs and toolbar. */
  header?: string;
  tabList?: string;
  /** A tab with what sits beside it (`data-selected`, `data-moving`, `data-dragging`; its copy in flight has `data-drag-preview`). */
  tab?: string;
  /** The tab itself, inside `tab`. */
  tabTrigger?: string;
  toolbar?: string;
  /** Where a tabset shows its tabs' content. */
  tabPanels?: string;
  /** The panel of one tab. */
  tabContent?: string;
  /** Where a dragged tab would land in a tabset's content (`data-region`). */
  dropIndicator?: string;
};

const PLACED: Record<WorkspaceTabSide, { tabset: string; header: string; list: string; tab: string }> = {
  top: { tabset: 'flex-col', header: 'min-h-9 border-b', list: 'px-1', tab: 'border-e data-selected:shadow-hairline-b' },
  bottom: { tabset: 'flex-col-reverse', header: 'min-h-9 border-t', list: 'px-1', tab: 'border-e data-selected:shadow-hairline-t' },
  start: { tabset: 'flex-row', header: 'min-w-9 flex-col border-e', list: 'flex-col py-1', tab: 'border-b' },
  end: { tabset: 'flex-row-reverse', header: 'min-w-9 flex-col border-s', list: 'flex-col py-1', tab: 'border-b' },
};

const HANDLE =
  'shrink-0 bg-border outline-none transition-colors data-hovering:bg-primary focus-visible:bg-primary data-dragging:bg-primary data-[orientation=horizontal]:w-1 data-[orientation=vertical]:h-1';
// h-full: maximized, a tabset is out of its split, and would otherwise be only as tall as what's in it.
const TABSET = 'flex h-full min-h-0 min-w-0 overflow-hidden bg-background text-foreground';
const HEADER = 'flex min-w-0 items-center border-border bg-muted';
const TAB_LIST = 'flex min-h-0 min-w-0 flex-1 items-stretch gap-0.5 overflow-auto';
// The copy that follows the pointer is this element again, out of the strip, so it brings its own surface.
const TAB =
  'group relative flex max-w-56 shrink-0 cursor-default touch-none items-center gap-2 border-border px-3 py-2 text-xs text-muted-foreground select-none hover:text-foreground data-selected:bg-background data-selected:text-foreground data-moving:bg-accent data-moving:text-foreground data-dragging:opacity-50 has-[[role=tab]:focus-visible]:ring-2 has-[[role=tab]:focus-visible]:ring-ring/45 has-[[role=tab]:focus-visible]:ring-inset data-drag-preview:rounded-md data-drag-preview:border data-drag-preview:bg-background data-drag-preview:font-sans data-drag-preview:text-foreground data-drag-preview:shadow-lg';
// Its hit area covers the whole tab, under the close button.
const TAB_TRIGGER =
  'flex min-w-0 cursor-default appearance-none items-center gap-[inherit] border-0 bg-transparent p-0 text-inherit [font:inherit] outline-none after:absolute after:inset-0';
// On touch, the close button's and the tools' hit areas grow to 44px around what they draw.
const TAB_CLOSE =
  'relative flex size-5 shrink-0 appearance-none border-0 bg-transparent p-0 items-center justify-center rounded text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/45 pointer-coarse:after:absolute pointer-coarse:after:-inset-3';
const TOOLBAR = 'flex shrink-0 items-center gap-1 px-1.5';
const TOOL =
  'relative flex size-7 appearance-none items-center border-0 bg-transparent p-0 justify-center rounded text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/45 pointer-coarse:after:absolute pointer-coarse:after:-inset-2';
const TAB_PANELS = 'relative min-h-0 min-w-0 flex-1 bg-background';
const TAB_CONTENT = 'h-full min-h-0 w-full overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset';
const DROP_INDICATOR =
  'pointer-events-none absolute z-10 rounded-md border-2 border-tint bg-primary/15 data-[region=center]:inset-0 data-[region=left]:inset-y-0 data-[region=left]:left-0 data-[region=left]:w-1/2 data-[region=right]:inset-y-0 data-[region=right]:right-0 data-[region=right]:w-1/2 data-[region=top]:inset-x-0 data-[region=top]:top-0 data-[region=top]:h-1/2 data-[region=bottom]:inset-x-0 data-[region=bottom]:bottom-0 data-[region=bottom]:h-1/2';

const TAB_HINT =
  'Press Space or Enter to pick this tab up, then the arrow keys to move it along its pane or to another pane, and Space or Enter to drop it. Escape puts it back. Delete closes it.';

/** What `renderTabContent` gets besides the tab. */
export type WorkspaceTabContentState = {
  /** On show in its tabset. */
  selected: boolean;
  /** On show, and its tabset isn't behind a maximized one. */
  visible: boolean;
  /** The tabset holding the tab. */
  tabsetId: string;
};

export type WorkspaceProps<TabData = unknown, TabsetData = unknown> = WorkspaceOptions<TabData, TabsetData> &
  Omit<PartProps<'div', WorkspaceState<TabData, TabsetData>>, 'children' | 'defaultValue'> & {
    /** A tab's content. It renders again when its tab, its state or this function changes, so keep the function
     *  stable (`useCallback`) when content is expensive. */
    renderTabContent: (tab: TabNode<TabData>, state: WorkspaceTabContentState) => ReactNode;
    /** A tab in its strip: a `WorkspaceTab` around a `WorkspaceTabTrigger` and, to close it, a `WorkspaceTabClose`.
     *  Defaults to the tab's title and a close button. */
    renderTab?: (tab: TabNode<TabData>) => ReactNode;
    /** What follows a tabset's tabs. Defaults to `WorkspaceToolbar`, which maximizes and restores. */
    renderTabsetToolbar?: (tabset: TabsetNode<TabData, TabsetData>, state: WorkspaceTabsetState) => ReactNode;
    /** What a tabset without tabs shows. */
    renderEmptyTabset?: (tabset: TabsetNode<TabData, TabsetData>) => ReactNode;
    /** Whether a tab's content stays mounted while another tab is on show. Defaults to true; false unmounts it,
     *  and its state with it. Moving a tab never remounts its content. */
    keepMounted?: boolean | ((tab: TabNode<TabData>) => boolean);
    /** The narrowest a tabset gets, for those that don't say. */
    tabsetMinWidth?: WorkspaceMinSize;
    /** The shortest a tabset gets, for those that don't say. */
    tabsetMinHeight?: WorkspaceMinSize;
    /** What a screen reader hears after a tab's name: how to move and close it. */
    tabDescription?: string;
    /** `docked` lays the tabsets out in their splits; `tabs` shows every tab in one strip along the bottom, one at a time,
     *  with nothing to drag (a phone's layout). `auto` (the default) is `tabs` while the workspace's own box is compact
     *  (narrower than 640px) and `docked` otherwise. The workspace is a container, like SplitView: it measures its own
     *  box (a workspace in a narrow pane of a wide window is compact) and provides that size class as the scope of
     *  what it renders, so popups in a tab follow it. The layout is kept either way. */
    presentation?: WorkspacePresentation;
    classNames?: WorkspaceClassNames;
  };

export type WorkspacePresentation = 'auto' | 'docked' | 'tabs';

type AnyTab = TabNode<any>;
type AnyTabset = TabsetNode<any, any>;
type AnyNode = WorkspaceNode<any, any>;

type WorkspaceContextValue = {
  api: WorkspaceApi;
  classNames: WorkspaceClassNames;
  hintId: string;
  disabled: boolean;
  min: { width?: WorkspaceMinSize; height?: WorkspaceMinSize };
  keepMounted: boolean | ((tab: AnyTab) => boolean);
  /** The element a tab's content lives in, which its panel adopts. */
  host: (tabId: string) => HTMLElement | undefined;
  tab: (tabId: string) => AnyTab | undefined;
  renderTab?: (tab: AnyTab) => ReactNode;
  renderTabsetToolbar?: (tabset: AnyTabset, state: WorkspaceTabsetState) => ReactNode;
  renderEmptyTabset?: (tabset: AnyTabset) => ReactNode;
};
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
function useWorkspaceContext(part: string) {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error(`${part} must be rendered inside a Workspace.`);
  return context;
}
const TabContext = createContext<{ tab: AnyTab; placement: WorkspaceTabSide } | null>(null);
const PlacementContext = createContext<WorkspaceTabSide>('top');

/** A dockable workspace: tabs move between resizable tabsets and onto their edges, and keep their state as they go. */
export function Workspace<TabData = unknown, TabsetData = unknown>({
  layout,
  defaultLayout,
  onLayoutChange,
  onLayoutCommit,
  disabled,
  accepts,
  tabsetLabel,
  tabSide,
  controller,
  debug,
  renderTabContent,
  renderTab,
  renderTabsetToolbar,
  renderEmptyTabset,
  keepMounted = true,
  tabsetMinWidth,
  tabsetMinHeight,
  tabDescription = TAB_HINT,
  presentation = 'auto',
  classNames,
  className,
  ref,
  ...props
}: WorkspaceProps<TabData, TabsetData>) {
  const [measure, sizeClass] = useSizeClass<HTMLDivElement>({ initial: 'regular' });
  const tabsOnly = presentation === 'tabs' || (presentation === 'auto' && sizeClass === 'compact');
  const rootRef = useCallback(
    (el: HTMLDivElement | null) => {
      measure(el);
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    },
    [measure, ref],
  );
  const handle = usePrimitive(workspace, { layout, defaultLayout, onLayoutChange, onLayoutCommit, disabled, accepts, tabsetLabel, tabSide, controller, debug } as WorkspaceOptions<any, any>);
  const hintId = useId();
  const [hosts] = useState(() => new Map<string, HTMLElement>());
  const host = useCallback(
    (tabId: string) => {
      if (typeof document === 'undefined') return undefined;
      let el = hosts.get(tabId);
      if (!el) {
        el = document.createElement('div');
        el.className = 'contents';
        hosts.set(tabId, el);
      }
      return el;
    },
    [hosts],
  );
  const shared = useMemo(
    () => ({
      api: handle.api,
      classNames: classNames ?? {},
      hintId,
      disabled: !!disabled,
      min: { width: tabsetMinWidth, height: tabsetMinHeight },
      keepMounted: keepMounted as WorkspaceContextValue['keepMounted'],
      host,
      renderTab: renderTab as WorkspaceContextValue['renderTab'],
      renderTabsetToolbar: renderTabsetToolbar as WorkspaceContextValue['renderTabsetToolbar'],
      renderEmptyTabset: renderEmptyTabset as WorkspaceContextValue['renderEmptyTabset'],
    }),
    [handle.api, classNames, hintId, disabled, tabsetMinWidth, tabsetMinHeight, keepMounted, host, renderTab, renderTabsetToolbar, renderEmptyTabset],
  );
  return usePart(
    handle,
    'root',
    {},
    {
      ...props,
      ref: rootRef,
      ...({ 'data-presentation': tabsOnly ? 'tabs' : 'docked' } as Record<string, string>),
      className: cx('h-full min-h-0 min-w-0 overflow-hidden font-sans bg-background text-foreground', className),
      // A container, like SplitView: its own box is the scope of everything in it (a tab's popups included).
      children: (state) => (
        <SizeClassProvider value={sizeClass}>
          <WorkspaceView
            state={state}
            shared={shared}
            hosts={hosts}
            tabsOnly={tabsOnly}
            description={tabDescription}
            renderTabContent={renderTabContent as (tab: AnyTab, state: WorkspaceTabContentState) => ReactNode}
          />
        </SizeClassProvider>
      ),
    },
    'div',
  );
}

function WorkspaceView({
  state,
  shared,
  hosts,
  tabsOnly,
  description,
  renderTabContent,
}: {
  state: WorkspaceState<any, any>;
  shared: Omit<WorkspaceContextValue, 'tab'>;
  hosts: Map<string, HTMLElement>;
  tabsOnly: boolean;
  description: string;
  renderTabContent: (tab: AnyTab, state: WorkspaceTabContentState) => ReactNode;
}) {
  const { layout, lists, currentTabsetId } = state;
  const tabsets = useMemo(() => workspaceTabsets(layout), [layout]);
  const open = useMemo(() => new Map(tabsets.flatMap((tabset) => tabset.tabs.map((tab) => [tab.id, tab] as const))), [tabsets]);
  const context = useMemo(() => ({ ...shared, tab: (tabId: string) => open.get(tabId) }), [shared, open]);
  // A closed tab's element goes with it.
  useLayoutEffect(() => {
    for (const id of [...hosts.keys()]) if (!open.has(id)) hosts.delete(id);
  }, [hosts, open]);
  const maximized = tabsets.find((tabset) => tabset.id === layout.maximizedTabsetId);
  const only = layout.root.type === 'tabset';
  const tabsetProps = (tabset: AnyTabset) => ({
    ids: lists[tabset.id] ?? [],
    label: shared.api.internal.tabsetLabel(tabset.id),
    current: currentTabsetId === tabset.id,
    maximized: maximized === tabset,
    only,
  });
  return (
    <WorkspaceContext.Provider value={context}>
      <span id={shared.hintId} hidden>
        {description}
      </span>
      {tabsOnly ? (
        <TabsView tabsets={tabsets} currentTabsetId={currentTabsetId} />
      ) : maximized ? (
        <TabsetView node={maximized} {...tabsetProps(maximized)} />
      ) : (
        <NodeView node={layout.root} tabsetProps={tabsetProps} />
      )}
      {tabsets.flatMap((tabset) =>
        tabset.tabs.map((tab) => {
          const selected = tabset.selectedId === tab.id;
          const keep = typeof shared.keepMounted === 'function' ? shared.keepMounted(tab) : shared.keepMounted;
          const el = keep || selected ? shared.host(tab.id) : undefined;
          return el ? createPortal(<TabContent tab={tab} render={renderTabContent} selected={selected} visible={selected && (!maximized || maximized === tabset)} tabsetId={tabset.id} />, el, tab.id) : null;
        }),
      )}
    </WorkspaceContext.Provider>
  );
}

/** The compact presentation: every tab of every tabset in one strip along the bottom, the active tabset's tab on show.
 *  Picking a tab selects it in its tabset and makes that tabset the active one; nothing can be dragged. */
function TabsView({ tabsets, currentTabsetId }: { tabsets: AnyTabset[]; currentTabsetId: string | null }) {
  const { api, keepMounted } = useWorkspaceContext('The tab strip');
  const active = tabsets.find((tabset) => tabset.id === currentTabsetId) ?? tabsets.find((tabset) => tabset.tabs.length);
  const tabs = tabsets.flatMap((tabset) => tabset.tabs.map((tab) => ({ tab, tabsetId: tabset.id })));
  return (
    <KitTabs
      variant="plain"
      side="bottom"
      value={active?.selectedId ?? tabs[0]?.tab.id ?? null}
      onValueChange={(value, details) => {
        if (value === null) return;
        const owner = tabsets.find((tabset) => tabset.tabs.some((tab) => tab.id === value));
        if (!owner) return;
        // Already on show in its tabset: only that tabset becomes the active one.
        if (owner.selectedId !== value && !api.internal.select(value, details)) return details.cancel();
        api.internal.activate(owner.id);
      }}
      className="size-full"
    >
      <TabsBar className={cn(HEADER, PLACED.bottom.header)}>
        <KitTabsList aria-label="Tabs" className={cn(TAB_LIST, PLACED.bottom.list)}>
          {tabs.map(({ tab }) => (
            <KitTabsTab key={tab.id} value={tab.id} className={cn(TAB, PLACED.bottom.tab, 'touch-auto pointer-coarse:min-h-11 focus-visible:ring-2 focus-visible:ring-ring/45 focus-visible:ring-inset')}>
              <span className="truncate">{tab.title ?? tab.id}</span>
            </KitTabsTab>
          ))}
        </KitTabsList>
      </TabsBar>
      <div className={TAB_PANELS}>
        {tabs.map(({ tab }) => (
          <TabPanel key={tab.id} tab={tab} keepMounted={typeof keepMounted === 'function' ? keepMounted(tab) : keepMounted} />
        ))}
      </div>
    </KitTabs>
  );
}

const TabContent = memo(function TabContent({
  tab,
  render,
  ...state
}: WorkspaceTabContentState & { tab: AnyTab; render: (tab: AnyTab, state: WorkspaceTabContentState) => ReactNode }) {
  return render(tab, state);
});

type TabsetProps = {
  /** The tabset's tab ids as they show now: a tab on the move sits where it would drop. */
  ids: string[];
  /** What the tabset is called. */
  label: string;
  current: boolean;
  maximized: boolean;
  only: boolean;
};

function NodeView({ node, tabsetProps }: { node: AnyNode; tabsetProps: (tabset: AnyTabset) => TabsetProps }) {
  return node.type === 'tabset' ? <TabsetView node={node} {...tabsetProps(node)} /> : <SplitView node={node} tabsetProps={tabsetProps} />;
}

const layouts = new WeakMap<object, number[]>();
/** A split's shares, the same array for the same split, so Resizable sees a new layout only when one arrives. */
function layoutOf(node: SplitNode<any, any>) {
  let sizes = layouts.get(node);
  if (!sizes) layouts.set(node, (sizes = splitSizes(node)));
  return sizes;
}

function SplitView({ node, tabsetProps }: { node: SplitNode<any, any>; tabsetProps: (tabset: AnyTabset) => TabsetProps }) {
  const { api, classNames, disabled, min } = useWorkspaceContext('A split');
  return (
    // The split's own group part is the element Resizable renders, so one element is both: named for people
    // and agents by the workspace, laid out by Resizable.
    <Resizable
      render={<parts.Split value={node.id} />}
      orientation={node.orientation}
      layout={layoutOf(node)}
      disabled={disabled}
      onLayoutChange={(sizes, details) => {
        if (!api.internal.resize(node.id, sizes, details)) details.cancel();
      }}
      onLayoutCommit={(sizes, details) => api.internal.resized(node.id, sizes, details)}
      className={cn('size-full min-h-0 min-w-0', classNames.split)}
    >
      {node.children.map((child, index) => (
        <Fragment key={child.id}>
          {index > 0 ? <ResizableHandle aria-label={`Resize ${api.internal.tabsetLabel(workspaceTabsets(node.children[index - 1])[0].id)}`} className={cn(HANDLE, classNames.handle)} /> : null}
          <ResizablePanel minSize={minSizeOf(child, node.orientation, min)} className="min-h-0 min-w-0 overflow-hidden">
            <NodeView node={child} tabsetProps={tabsetProps} />
          </ResizablePanel>
        </Fragment>
      ))}
    </Resizable>
  );
}

// A resize gives a tabset a new size and nothing else, and its view never reads the size.
const sameTabset = (a: AnyTabset, b: AnyTabset) =>
  a === b || (a.id === b.id && a.tabs === b.tabs && a.selectedId === b.selectedId && a.tabSide === b.tabSide && a.data === b.data && a.keepWhenEmpty === b.keepWhenEmpty);
const sameIds = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((id, index) => id === b[index]);

const TabsetView = memo(
  function TabsetView({ node, ids, label, current, maximized, only }: TabsetProps & { node: AnyTabset }) {
    const { api, classNames, keepMounted, tab: tabOf, renderTab, renderTabsetToolbar, renderEmptyTabset } = useWorkspaceContext('A tabset');
    return (
      <parts.Tabset value={node.id} aria-label={label} className={(state) => cn(TABSET, PLACED[state.tabSide].tabset, classNames.tabset)}>
        {({ tabSide, empty, selectedTabId }) => (
          <PlacementContext.Provider value={tabSide}>
            <Tabs
              value={node.selectedId ?? null}
              orientation={tabSide === 'start' || tabSide === 'end' ? 'vertical' : 'horizontal'}
              onValueChange={(value, details) => {
                if (value !== null && !api.internal.select(value, details)) details.cancel();
              }}
              className="contents"
            >
              <parts.Header className={cn(HEADER, PLACED[tabSide].header, classNames.header)}>
                <TabsList aria-label={`${label} tabs`} className={cn(TAB_LIST, PLACED[tabSide].list, classNames.tabList)}>
                  {ids.map((id) => {
                    const tab = tabOf(id);
                    return tab ? <Fragment key={id}>{renderTab ? renderTab(tab) : <WorkspaceTab value={id} />}</Fragment> : null;
                  })}
                </TabsList>
                <div className={cn(TOOLBAR, classNames.toolbar)}>
                  {renderTabsetToolbar ? renderTabsetToolbar(node, { current, maximized, only, empty, selectedTabId, tabSide }) : <WorkspaceToolbar />}
                </div>
              </parts.Header>
              <parts.Panels className={cn(TAB_PANELS, classNames.tabPanels)}>
                {node.tabs.map((tab) => (
                  <TabPanel key={tab.id} tab={tab} keepMounted={typeof keepMounted === 'function' ? keepMounted(tab) : keepMounted} />
                ))}
                <parts.Empty className="size-full min-h-0 overflow-auto">{renderEmptyTabset?.(node)}</parts.Empty>
                <parts.DropIndicator className={cn(DROP_INDICATOR, classNames.dropIndicator)} />
              </parts.Panels>
            </Tabs>
          </PlacementContext.Provider>
        )}
      </parts.Tabset>
    );
  },
  (a, b) => sameTabset(a.node, b.node) && sameIds(a.ids, b.ids) && a.label === b.label && a.current === b.current && a.maximized === b.maximized && a.only === b.only,
);

/** A tab's panel, which adopts the element the tab's content is rendered into. */
function TabPanel({ tab, keepMounted }: { tab: AnyTab; keepMounted: boolean }) {
  const { host, classNames } = useWorkspaceContext('A tab panel');
  const el = host(tab.id);
  const adopt = useCallback(
    (panel: HTMLDivElement | null) => {
      if (panel && el && el.parentNode !== panel) panel.appendChild(el);
    },
    [el],
  );
  return <TabsPanel ref={adopt} value={tab.id} keepMounted={keepMounted} className={cn(TAB_CONTENT, classNames.tabContent)} />;
}

export type WorkspaceTabProps = ComponentProps<typeof parts.Tab>;

/** A tab in its strip, with what sits beside it. For `renderTab`: put a `WorkspaceTabTrigger` inside, and a
 *  `WorkspaceTabClose` to close it. On its own it shows the tab's title and a close button. */
export function WorkspaceTab({ value, className, children, ...props }: WorkspaceTabProps) {
  const { classNames, tab: tabOf } = useWorkspaceContext('WorkspaceTab');
  const placement = useContext(PlacementContext);
  const tab = tabOf(value);
  const context = useMemo(() => (tab ? { tab, placement } : null), [tab, placement]);
  if (!context) return null;
  return (
    <TabContext.Provider value={context}>
      <parts.Tab value={value} className={cx(cn(TAB, PLACED[placement].tab, classNames.tab), className)} {...props}>
        {children ?? (
          <>
            <WorkspaceTabTrigger />
            <WorkspaceTabClose />
          </>
        )}
      </parts.Tab>
    </TabContext.Provider>
  );
}

export type WorkspaceTabTriggerProps = Omit<ComponentProps<typeof TabsTab>, 'value'>;

/** The tab itself: UI SDK's `TabsTab`, for the `WorkspaceTab` around it. Shows the tab's title unless it has children. */
export function WorkspaceTabTrigger({ className, children, ...props }: WorkspaceTabTriggerProps) {
  const { classNames, hintId } = useWorkspaceContext('WorkspaceTabTrigger');
  const context = useContext(TabContext);
  if (!context) throw new Error('WorkspaceTabTrigger must be rendered inside a WorkspaceTab.');
  const { tab } = context;
  return (
    <TabsTab value={tab.id} aria-describedby={hintId} className={cx(cn(TAB_TRIGGER, classNames.tabTrigger), className)} {...props}>
      {children ?? <span className="truncate">{tab.title ?? tab.id}</span>}
    </TabsTab>
  );
}

export type WorkspaceTabCloseProps = Omit<ComponentProps<(typeof parts)['TabClose']>, 'value'>;

/** Closes the tab it is in. It renders nothing for a tab that can't be closed. `event.preventDefault()` in
 *  `onClick` keeps the tab open, like to ask about unsaved changes first. */
export function WorkspaceTabClose({ className, children, ...props }: WorkspaceTabCloseProps) {
  return (
    <parts.TabClose className={cx(TAB_CLOSE, className)} {...props}>
      {children ?? <Icon name="xmark" size={12} />}
    </parts.TabClose>
  );
}

export type WorkspaceToolbarProps = Omit<ComponentProps<typeof parts.Toolbar>, 'value' | 'children'> & { children?: ReactNode };

/** What follows a tabset's tabs: your own actions, then the button that maximizes and restores the tabset. */
export function WorkspaceToolbar({ className, children, ...props }: WorkspaceToolbarProps) {
  return (
    <parts.Toolbar className={cx('flex items-center gap-1', className)} {...props}>
      {children}
      <WorkspaceMaximize />
    </parts.Toolbar>
  );
}

export type WorkspaceMaximizeProps = Omit<ComponentProps<typeof parts.Maximize>, 'value'>;

/** Lets its tabset cover the others, and shows them again. It renders nothing in the only tabset. */
export function WorkspaceMaximize({ className, children, ...props }: WorkspaceMaximizeProps) {
  return (
    <parts.Maximize className={cx(TOOL, className)} {...props}>
      {children ?? ((state) => <Icon name={state.maximized ? 'arrows-collapse' : 'arrows-expand'} size={14} />)}
    </parts.Maximize>
  );
}
