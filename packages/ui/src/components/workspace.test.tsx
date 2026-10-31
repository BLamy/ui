// @vitest-environment jsdom
import { createRef, useState } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  Workspace,
  type WorkspaceImperativeHandle,
  type WorkspaceModelInput,
} from './workspace';

// jsdom has no layout observer. The real workspace still owns its model, portals and DOM events.
beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe = vi.fn();
      unobserve = vi.fn();
      disconnect = vi.fn();
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const model: WorkspaceModelInput = {
  version: 1,
  root: {
    type: 'split',
    orientation: 'horizontal',
    children: [
      {
        type: 'tabset',
        id: 'left',
        tabs: [{ id: 'counter', title: 'Counter', data: null }],
      },
      {
        type: 'tabset',
        id: 'right',
        tabs: [{ id: 'notes', title: 'Notes', data: null, disableClose: true }],
      },
    ],
  },
};

function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>Count {count}</button>;
}
function content(tab: { id: string }) {
  return tab.id === 'counter' ? (
    <Counter />
  ) : (
    <textarea aria-label="Draft" defaultValue="Keep this draft" />
  );
}

it('preserves component and DOM state when moving a tab between groups and splitting at an edge', async () => {
  const ref = createRef<WorkspaceImperativeHandle>();
  const changed = vi.fn();
  render(
    <Workspace
      defaultModel={model}
      workspaceRef={ref}
      onModelChanged={changed}
      renderTabContent={content}
    />,
  );
  const counter = await screen.findByRole('button', { name: 'Count 0' });
  fireEvent.click(counter);
  const draft = screen.getByRole('textbox', { name: 'Draft' });
  fireEvent.change(draft, { target: { value: 'Unsaved work' } });
  act(() =>
    ref.current?.moveTab('counter', { tabsetId: 'right', region: 'center' }),
  );
  expect(screen.getByRole('button', { name: 'Count 1' })).toBe(counter);
  act(() =>
    ref.current?.moveTab('notes', { tabsetId: 'right', region: 'bottom' }),
  );
  expect(screen.getByRole('textbox', { name: 'Draft' })).toBe(draft);
  expect((draft as HTMLTextAreaElement).value).toBe('Unsaved work');
  expect(screen.getByRole('button', { name: 'Count 1' })).toBe(counter);
  await waitFor(() =>
    expect(changed.mock.calls.some(([, meta]) => meta.reason === 'move')).toBe(
      true,
    ),
  );
});

it('supports pane controls and keyboard close while respecting protected tabs', async () => {
  const ref = createRef<WorkspaceImperativeHandle>();
  render(
    <Workspace
      defaultModel={model}
      workspaceRef={ref}
      renderTabContent={content}
    />,
  );
  await screen.findByRole('button', { name: 'Count 0' });
  expect(screen.queryByRole('button', { name: 'Close Notes' })).toBeNull();
  fireEvent.click(screen.getAllByRole('button', { name: 'Maximize pane' })[0]);
  expect(ref.current?.getModel().maximizedTabsetId).toBe('left');
  fireEvent.click(screen.getByRole('button', { name: 'Restore pane' }));
  expect(ref.current?.getModel().maximizedTabsetId).toBeUndefined();
  fireEvent.keyDown(screen.getByRole('tab', { name: /Counter/ }), {
    key: 'Delete',
  });
  expect(screen.queryByRole('tab', { name: /Counter/ })).toBeNull();
  expect(screen.getByRole('tab', { name: 'Notes' })).toBeTruthy();
});
