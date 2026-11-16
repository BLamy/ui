// @vitest-environment happy-dom
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createAgent } from '@ui-sdk/react/agent';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Diagram, DiagramToolbar, createDiagramController, type DiagramData, type DiagramDataChangeDetails } from '@/components/ui/diagram';
import type { DiagramEdge, DiagramNode, DiagramSelection } from '@/lib/diagram-model';
import { run, settle } from '../../test/agent-harness';

/* Diagram in a page: its keyboard contract (one tab stop, arrows along edges, Enter, Escape, Delete, ⌘Z), what it says
   to a screen reader, connecting by keyboard with validation, and the primitive's changes (`details.reason`,
   `details.cancel()`), through a controller and through the agent bridge. Strict: UI SDK's warnings fail it.
   happy-dom has no layout, so the diagram is 1000 × 700 (its size before measuring) and the canvas 800 × 600. */

const rect = (x: number, y: number, w: number, h: number) => ({ x, y, left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, toJSON: () => ({}) }) as DOMRect;
const original = HTMLElement.prototype.getBoundingClientRect;
beforeAll(() => {
  globalThis.__UI_SDK_STRICT__ = true;
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    return this.getAttribute('data-slot') === 'canvas' ? rect(0, 0, 800, 600) : original.call(this);
  };
});
afterAll(() => { HTMLElement.prototype.getBoundingClientRect = original; });
afterEach(cleanup);

const agent = createAgent();

const NODES: DiagramNode[] = [
  { id: 'inbox', label: 'Inbox', x: 0, y: 0, w: 100, h: 40 },
  { id: 'triage', label: 'Triage', x: 200, y: 0, w: 100, h: 40 },
  { id: 'archive', label: 'Archive', x: 400, y: 0, w: 100, h: 40 },
  { id: 'alone', label: 'Alone', x: 200, y: 200, w: 100, h: 40 },
];
const EDGES: DiagramEdge[] = [
  { id: 'sort', from: 'inbox', to: 'triage', label: 'sort' },
  { id: 'done', from: 'triage', to: 'archive', label: 'done' },
];

const board = (name = 'Mail') => screen.getByRole('application', { name: `${name} board` });
const focused = () => document.activeElement?.getAttribute('data-node') ?? document.activeElement?.getAttribute('data-edge') ?? null;
const key = (k: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(document.activeElement ?? board(), { key: k, ...init });

function Controlled({ onChange, refuse }: { onChange?: (data: DiagramData, details: DiagramDataChangeDetails) => void; refuse?: boolean }) {
  const [data, setData] = useState<DiagramData>({ nodes: NODES, edges: EDGES });
  const [selection, setSelection] = useState<DiagramSelection>({ nodes: [], edges: [] });
  return (
    <Diagram
      aria-label="Mail"
      nodes={data.nodes}
      edges={data.edges}
      selection={selection}
      onSelectionChange={setSelection}
      editable
      onDataChange={(next, details) => {
        onChange?.(next, details);
        if (refuse) { details.cancel(); return; }
        setData(next);
      }}
      overlay={<DiagramToolbar />}
    />
  );
}

describe('Diagram, by keyboard', () => {
  it('is one tab stop, a named group around a board that says what its keys do', () => {
    render(<Diagram aria-label="Mail" nodes={NODES} edges={EDGES} />);
    const group = screen.getByRole('group', { name: 'Mail' });
    expect(group.getAttribute('aria-roledescription')).toBe('diagram');
    expect(board().getAttribute('tabindex')).toBe('0');
    const keys = document.getElementById(board().getAttribute('aria-describedby')!);
    expect(keys?.textContent).toMatch(/Arrows move between nodes and along edges/);
    for (const el of group.querySelectorAll('[data-slot=diagram-node], [data-slot=diagram-edge]')) expect(el.getAttribute('tabindex')).toBe('-1');
  });

  it('says what each node and edge is, and what it connects to', () => {
    render(<Diagram aria-label="Mail" nodes={NODES} edges={EDGES} noun="folder" />);
    expect(screen.getByRole('button', { name: /^Triage, folder\. 1 going out: done to Archive\. 1 coming in: sort from Inbox\.$/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'sort, edge from Inbox to Triage.' })).toBeTruthy();
  });

  it('moves along edges with the arrows, through everything with Page Down, and rings what has focus', () => {
    render(<Diagram aria-label="Mail" nodes={NODES} edges={EDGES} />);
    board().focus();
    key('Home');
    expect(focused()).toBe('inbox');
    expect(document.querySelector('[data-slot=diagram-ring][data-focused]')?.getAttribute('data-ring-of')).toBe('inbox');
    key('ArrowRight');
    expect(focused()).toBe('triage');
    key('ArrowRight');
    expect(focused()).toBe('archive');
    key('ArrowLeft');
    expect(focused()).toBe('triage');
    key(']');
    expect(document.activeElement?.getAttribute('data-slot')).toBe('diagram-edge');
    // A node nothing's connected to is still reached: everything is, with Page Down.
    const seen = new Set<string>();
    for (let i = 0; i < 6; i++) { key('PageDown'); seen.add(focused()!); }
    expect(seen.has('alone')).toBe(true);
  });

  it('selects with Enter, adds with Shift+Enter, clears with Escape, and says why each time', () => {
    const onSelectionChange = vi.fn();
    const onAction = vi.fn();
    render(<Diagram aria-label="Mail" defaultNodes={NODES} defaultEdges={EDGES} selectable onSelectionChange={onSelectionChange} onAction={onAction} />);
    board().focus();
    key('Home');
    key('Enter');
    expect(onSelectionChange.mock.lastCall).toEqual([{ nodes: ['inbox'], edges: [] }, expect.objectContaining({ reason: 'keyboard' })]);
    expect(onAction).toHaveBeenCalledWith({ kind: 'node', id: 'inbox' }, expect.objectContaining({ reason: 'enter-key' }));
    expect(screen.getByRole('button', { name: /^Inbox/ }).getAttribute('aria-pressed')).toBe('true');
    key('ArrowRight');
    key('Enter', { shiftKey: true });
    expect(onSelectionChange.mock.lastCall![0]).toEqual({ nodes: ['inbox', 'triage'], edges: [] });
    key('Escape');
    expect(onSelectionChange.mock.lastCall).toEqual([{ nodes: [], edges: [] }, expect.objectContaining({ reason: 'escape-key' })]);
  });

  it('deletes what has focus, keeps focus nearby, and undoes it with ⌘Z', () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    board().focus();
    key('Home');
    key('ArrowRight');
    expect(focused()).toBe('triage');
    key('Delete');
    expect(onChange.mock.lastCall![1].reason).toBe('delete');
    expect(screen.queryByRole('button', { name: /^Triage/ })).toBeNull();
    // Both of its edges went with it.
    expect(document.querySelectorAll('[data-slot=diagram-edge]')).toHaveLength(0);
    expect(focused()).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Undo' }).hasAttribute('data-disabled')).toBe(false);
    key('z', { metaKey: true });
    expect(onChange.mock.lastCall![1].reason).toBe('undo');
    expect(screen.getByRole('button', { name: /^Triage/ })).toBeTruthy();
    key('z', { metaKey: true, shiftKey: true });
    expect(onChange.mock.lastCall![1].reason).toBe('redo');
    expect(screen.queryByRole('button', { name: /^Triage/ })).toBeNull();
  });

  it('nudges with Shift and an arrow, 8 at a time or 1 with Alt', () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    board().focus();
    key('Home');
    key('ArrowRight', { shiftKey: true });
    expect(onChange.mock.lastCall![0].nodes.find((n: DiagramNode) => n.id === 'inbox').x).toBe(8);
    expect(onChange.mock.lastCall![1].reason).toBe('move');
    key('ArrowDown', { shiftKey: true, altKey: true });
    expect(onChange.mock.lastCall![0].nodes.find((n: DiagramNode) => n.id === 'inbox').y).toBe(1);
  });

  it('refuses a change the owner cancels: the data and history stay as they were', () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} refuse />);
    board().focus();
    key('Home');
    key('Delete');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /^Inbox/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Undo' }).hasAttribute('data-disabled')).toBe(true);
  });

  it('connects by keyboard: C, arrows to choose, Enter; and says so at each step', () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);
    board().focus();
    key('Home');
    key('ArrowDown');
    expect(focused()).toBe('alone');
    key('c');
    const status = () => document.querySelector('[data-slot=diagram-status]')!.textContent;
    expect(status()).toMatch(/^Connecting from Alone\./);
    key('ArrowUp');
    expect(status()).toMatch(/^To Triage\. Enter connects\./);
    key('Enter');
    expect(status()).toBe('Connected Alone to Triage.');
    expect(onChange.mock.lastCall![1].reason).toBe('connect');
    expect(onChange.mock.lastCall![0].edges.some((e: DiagramEdge) => e.from === 'alone' && e.to === 'triage')).toBe(true);
  });

  it('won’t connect what isValidConnection refuses, and says why', () => {
    const onChange = vi.fn();
    render(<Diagram aria-label="Mail" defaultNodes={NODES} defaultEdges={EDGES} editable onDataChange={onChange} isValidConnection={(c) => (c.to === 'archive' ? 'Archive takes nothing new.' : true)} />);
    board().focus();
    key('Home');
    key('ArrowRight');
    key('c');
    key('ArrowRight');
    expect(document.querySelector('[data-slot=diagram-status]')!.textContent).toBe('To Archive. Can’t connect: Archive takes nothing new.');
    expect(document.querySelector('[data-slot=diagram-connection]')?.hasAttribute('data-invalid')).toBe(true);
    key('Enter');
    expect(onChange).not.toHaveBeenCalled();
    key('Escape');
    expect(document.querySelector('[data-slot=diagram-connection]')).toBeNull();
  });

  it('marks what’s current for a screen reader, apart from what’s selected', () => {
    render(<Diagram aria-label="Mail" nodes={NODES} edges={EDGES} current={{ nodes: ['triage'], edges: ['sort'] }} />);
    expect(screen.getByRole('button', { name: /^Triage/ }).getAttribute('aria-current')).toBe('true');
    expect(screen.getByRole('button', { name: /^sort, edge/ }).getAttribute('aria-current')).toBe('true');
    expect(screen.getByRole('button', { name: /^Inbox/ }).hasAttribute('aria-current')).toBe(false);
  });

  it('shows an empty state with no nodes, and a status while loading instead', () => {
    const { rerender } = render(<Diagram aria-label="Mail" nodes={[]} />);
    expect(screen.getByText('Nothing here yet').closest('[role=status]')).toBeTruthy();
    rerender(<Diagram aria-label="Mail" nodes={[]} loading />);
    expect(screen.queryByText('Nothing here yet')).toBeNull();
    expect(document.querySelector('[data-slot=diagram-loading]')?.textContent).toContain('Laying out');
  });
});

describe('Diagram, driven from outside', () => {
  it('selects, deletes, connects and undoes through a controller', async () => {
    const controller = createDiagramController();
    const onChange = vi.fn();
    render(<Diagram aria-label="Mail" defaultNodes={NODES} defaultEdges={EDGES} editable controller={controller} onDataChange={onChange} />);
    await settle();
    act(() => { controller.select({ nodes: ['archive'], edges: [] }); });
    expect(screen.getByRole('button', { name: /^Archive/ }).getAttribute('aria-pressed')).toBe('true');
    act(() => { controller.deleteSelection(); });
    expect(controller.getData().nodes.map((n) => n.id)).toEqual(['inbox', 'triage', 'alone']);
    expect(controller.connect({ from: 'alone', to: 'alone' })).toBe(true);
    expect(controller.connect({ from: 'inbox', to: 'triage' })).toMatch(/already/i);
    expect(controller.canUndo()).toBe(true);
    act(() => { controller.undo(); controller.undo(); });
    expect(controller.getData().nodes).toHaveLength(4);
    expect(onChange.mock.calls.map(([, d]) => d.reason)).toEqual(['delete', 'connect', 'undo', 'undo']);
  });

  it('is agent-ready: its actions reach onDataChange as the agent', async () => {
    const onChange = vi.fn();
    render(<Diagram aria-label="Agent mail" defaultNodes={NODES} defaultEdges={EDGES} editable onDataChange={onChange} />);
    await settle();
    const entry = agent.snapshot().find((e) => e.label === 'Agent mail' && !e.offPage);
    expect(entry).toMatchObject({ component: 'diagram', actions: expect.arrayContaining(['select', 'deleteSelection', 'connect', 'undo', 'redo', 'moveNodes']) });
    await run(agent, [{ ref: 'Agent mail', action: 'moveNodes', args: [['inbox'], 10, 0] }]);
    expect(onChange.mock.lastCall![1]).toMatchObject({ reason: 'move', source: 'agent' });
  });
});
