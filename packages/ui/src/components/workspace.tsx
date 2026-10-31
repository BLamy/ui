'use client';

import { useMemo, type HTMLAttributes } from 'react';
import {
  Workspace as ResizableWorkspace,
  Separator,
  TabCloseButton,
  useParentTabset,
  useParentTabsetState,
  type WorkspaceClassNames,
  type WorkspaceProps as ResizableWorkspaceProps,
  type TabNode,
  type TabRenderProps,
  type TabCloseButtonProps,
} from 'react-resizable-panels';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';

export {
  useWorkspaceRef,
  useWorkspaceCallbackRef,
  useParentWorkspace,
  useParentTab,
  useParentTabState,
  useParentTabset,
  useParentTabsetState,
} from 'react-resizable-panels';
export type {
  WorkspaceModel,
  WorkspaceModelInput,
  WorkspaceImperativeHandle,
  WorkspaceChangedMeta,
  WorkspaceChangeReason,
  WorkspaceClassNames,
  WorkspaceStyles,
  WorkspaceNode,
  TabNode,
  TabsetNode,
  SplitNode,
  TabDropTarget,
  TabRenderProps,
} from 'react-resizable-panels';

export type WorkspaceProps<
  TabData = unknown,
  TabsetData = unknown,
> = ResizableWorkspaceProps<TabData, TabsetData>;

const workspaceClasses: WorkspaceClassNames = {
  tabset: 'flex min-h-0 flex-col overflow-hidden bg-background text-foreground',
  header: 'flex min-h-9 min-w-0 items-center border-b border-border bg-muted',
  tabList: 'flex min-w-0 flex-1 items-stretch gap-0.5 overflow-auto px-1',
  tab: 'group flex max-w-56 shrink-0 cursor-default items-center gap-2 border-r border-border px-3 py-2 text-xs text-muted-foreground outline-none hover:text-foreground data-[tab-selected]:bg-background data-[tab-selected]:text-foreground data-[tab-selected]:shadow-hairline-b focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
  toolbar: 'flex shrink-0 items-center gap-1 px-1.5',
  tabPanels: 'relative min-h-0 flex-1 bg-background',
  tabContent: 'h-full min-h-0 w-full overflow-auto',
  dropIndicator: 'rounded-md border-2 border-tint bg-primary/15',
  dragPreview:
    'rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground shadow-lg',
};

function renderTab(tab: TabNode, props: TabRenderProps) {
  return (
    <div {...props}>
      <span className="truncate">{tab.title ?? tab.id}</span>
      <WorkspaceTabCloseButton />
    </div>
  );
}

function renderSeparator(orientation: 'horizontal' | 'vertical') {
  return (
    <Separator
      className={cn(
        'shrink-0 bg-border outline-none transition-colors hover:bg-primary focus-visible:bg-primary data-[separator-active]:bg-primary',
        orientation === 'horizontal' ? 'w-1' : 'h-1',
      )}
    />
  );
}

function renderToolbar() {
  return <WorkspaceToolbar />;
}

/** A dockable workspace: draggable tabs, edge splits and resizable groups. Moving a tab preserves its React state. */
export function Workspace<TabData = unknown, TabsetData = unknown>({
  className,
  classNames,
  renderTab: tab = renderTab,
  renderSeparator: separator = renderSeparator,
  renderTabsetToolbar = renderToolbar,
  ...props
}: WorkspaceProps<TabData, TabsetData>) {
  const mergedClasses = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(workspaceClasses).map(([key, value]) => [
          key,
          cn(value, classNames?.[key as keyof WorkspaceClassNames]),
        ]),
      ),
    [classNames],
  );
  return (
    <ResizableWorkspace
      data-slot="workspace"
      {...props}
      className={cn(
        'h-full min-h-0 min-w-0 overflow-hidden font-sans rounded-xl border border-border bg-background text-foreground',
        className,
      )}
      classNames={mergedClasses}
      renderTab={tab}
      renderSeparator={separator}
      renderTabsetToolbar={renderTabsetToolbar}
    />
  );
}

export function WorkspaceTabCloseButton({
  className,
  children,
  ...props
}: TabCloseButtonProps) {
  return (
    <TabCloseButton
      {...props}
      className={cn(
        'flex size-5 shrink-0 appearance-none border-0 bg-transparent p-0 items-center justify-center rounded text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      {children ?? <Icon name="xmark" size={12} />}
    </TabCloseButton>
  );
}

/** Optional controls after a tab list; children can add app-specific actions using useParentTabset(). */
export function WorkspaceToolbar({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const tabset = useParentTabset();
  const state = useParentTabsetState();
  return (
    <div {...props} className={cn('flex items-center gap-1', className)}>
      {children}
      {tabset && state && !state.isRoot && (
        <button
          type="button"
          aria-label={state.isMaximized ? 'Restore pane' : 'Maximize pane'}
          className="flex size-7 appearance-none items-center border-0 bg-transparent p-0 justify-center rounded text-muted-foreground outline-none hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() =>
            state.isMaximized ? tabset.restore() : tabset.maximize()
          }
        >
          <Icon
            name={state.isMaximized ? 'arrows-collapse' : 'arrows-expand'}
            size={14}
          />
        </button>
      )}
    </div>
  );
}
