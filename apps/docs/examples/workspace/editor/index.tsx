import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Workspace,
  WorkspaceToolbar,
  createWorkspaceController,
  type WorkspaceTabNode,
  type WorkspaceLayoutInput,
} from '@/components/ui/workspace';
import { Icon } from '@/lib/icon';

type View = 'about' | 'counter' | 'notes' | 'nested' | 'scratchpad';
const layout: WorkspaceLayoutInput<View> = {
  version: 1,
  root: {
    type: 'split',
    orientation: 'horizontal',
    children: [
      {
        type: 'tabset',
        id: 'about',
        size: 28,
        tabs: [{ id: 'about', title: 'About', data: 'about' }],
      },
      {
        type: 'split',
        orientation: 'vertical',
        children: [
          {
            type: 'tabset',
            id: 'editor',
            size: 65,
            selectedId: 'counter',
            tabs: [
              { id: 'counter', title: 'Counter', data: 'counter' },
              { id: 'notes', title: 'Notes', data: 'notes' },
              { id: 'nested', title: 'Nested panels', data: 'nested' },
            ],
          },
          {
            type: 'tabset',
            id: 'scratchpad',
            tabs: [
              { id: 'scratchpad', title: 'Scratchpad', data: 'scratchpad' },
            ],
          },
        ],
      },
    ],
  },
};
const nestedLayout: WorkspaceLayoutInput<View> = {
  version: 1,
  root: {
    type: 'split',
    orientation: 'horizontal',
    children: [
      {
        type: 'tabset',
        tabs: [{ id: 'nested-counter', title: 'Counter', data: 'counter' }],
      },
      {
        type: 'tabset',
        tabs: [{ id: 'nested-notes', title: 'Notes', data: 'notes' }],
      },
    ],
  },
};

function Counter() {
  const [count, setCount] = useState(0);
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
      <span className="text-4xl font-semibold tabular-nums">{count}</span>
      <Button size="sm" onClick={() => setCount(count + 1)}>
        Increment
      </Button>
      <p className="max-w-60 text-center text-xs text-foreground/70">
        Drag this tab into another pane. The counter keeps its value.
      </p>
    </div>
  );
}

function renderTabContent(tab: WorkspaceTabNode<View>) {
  switch (tab.data) {
    case 'counter':
      return <Counter />;
    case 'nested':
      return (
        <div className="h-full p-2">
          <Panes label="Nested workspace" defaultLayout={nestedLayout} />
        </div>
      );
    case 'notes':
      return (
        <textarea
          aria-label="Notes"
          className="h-full w-full appearance-none resize-none border-0 font-sans bg-background p-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          placeholder="Write a note. Move the tab; your draft stays here."
        />
      );
    case 'scratchpad':
      return (
        <textarea
          aria-label="Scratchpad"
          className="h-full w-full appearance-none resize-none border-0 font-sans bg-background p-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          placeholder="Type something, then drag this tab somewhere else…"
        />
      );
    default:
      return (
        <div className="space-y-4 p-4 text-sm leading-relaxed">
          <h2 className="font-semibold">Make room for your work.</h2>
          <p>
            Drag a tab into another tab list to move it. Drop it on an edge to
            split the pane, or in the center to join a group.
          </p>
          <p>
            Resize with the dividers. Arrow keys select tabs, Space picks one
            up to move it, and Delete closes. Pane controls add a scratchpad
            or maximize the group.
          </p>
          <p className="text-foreground/70">
            Counters, notes and nested workspaces stay mounted when you move
            them.
          </p>
        </div>
      );
  }
}

/** A workspace with its own controller, so each pane's toolbar can add a tab to that pane. */
function Panes({
  label,
  defaultLayout,
}: {
  label: string;
  defaultLayout: WorkspaceLayoutInput<View>;
}) {
  const [workspace] = useState(() => createWorkspaceController<View>());
  return (
    <Workspace
      aria-label={label}
      className="rounded-card border border-border"
      controller={workspace}
      defaultLayout={defaultLayout}
      renderTabContent={renderTabContent}
      renderTabsetToolbar={(tabset) => (
        <WorkspaceToolbar>
          <Button
            variant="quiet"
            size="icon-sm"
            aria-label="Add scratchpad"
            onClick={() =>
              workspace.addTab(
                {
                  id: crypto.randomUUID(),
                  title: 'Scratchpad',
                  data: 'scratchpad',
                },
                { tabsetId: tabset.id },
              )
            }
          >
            <Icon name="plus" size={14} />
          </Button>
        </WorkspaceToolbar>
      )}
    />
  );
}

export default function WorkspaceExample() {
  return <Panes label="Editor workspace" defaultLayout={layout} />;
}
