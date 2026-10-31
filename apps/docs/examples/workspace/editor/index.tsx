import { useState } from 'react';
import { Icon } from '@/lib/icon';
import {
  Workspace,
  WorkspaceToolbar,
  useParentTabset,
  type WorkspaceModelInput,
  type TabNode,
} from '@/components/ui/workspace';

type View = 'about' | 'counter' | 'notes' | 'nested' | 'scratchpad';
const model: WorkspaceModelInput<View> = {
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
const nestedModel: WorkspaceModelInput<View> = {
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
      <button
        type="button"
        className="appearance-none rounded-lg border-0 bg-primary px-4 py-2 font-sans text-sm text-primary-foreground"
        onClick={() => setCount(count + 1)}
      >
        Increment
      </button>
      <p className="max-w-60 text-center text-xs text-muted-foreground">
        Drag this tab into another pane. The counter keeps its value.
      </p>
    </div>
  );
}

function Toolbar() {
  const tabset = useParentTabset<View>();
  return (
    <WorkspaceToolbar>
      <button
        type="button"
        aria-label="Add scratchpad"
        className="flex size-7 appearance-none items-center border-0 bg-transparent p-0 justify-center rounded text-muted-foreground hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring"
        onClick={() =>
          tabset?.addTab({
            id: crypto.randomUUID(),
            title: 'Scratchpad',
            data: 'scratchpad',
          })
        }
      >
        <Icon name="plus" size={14} />
      </button>
    </WorkspaceToolbar>
  );
}

function renderTabContent(tab: TabNode<View>) {
  switch (tab.data) {
    case 'counter':
      return <Counter />;
    case 'nested':
      return (
        <div className="h-full p-2">
          <Workspace
            aria-label="Nested workspace"
            defaultModel={nestedModel}
            renderTabContent={renderTabContent}
            renderTabsetToolbar={Toolbar}
          />
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
            Resize with the dividers. Arrow keys focus tabs, Enter selects, and
            Delete closes. Pane controls add a scratchpad or maximize the group.
          </p>
          <p className="text-muted-foreground">
            Counters, notes and nested workspaces stay mounted when you move
            them.
          </p>
        </div>
      );
  }
}

export default function WorkspaceExample() {
  return (
    <Workspace
      aria-label="Editor workspace"
      defaultModel={model}
      renderTabContent={renderTabContent}
      renderTabsetToolbar={Toolbar}
    />
  );
}
