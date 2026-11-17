// @vitest-environment happy-dom
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createAgent } from '@ui-sdk/react/agent';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Diagram, DiagramToolbar, createDiagramController, useDiagram, useDiagramHistory, type DiagramData, type DiagramDataChangeDetails } from '@/components/ui/diagram';
import { DiagramFrame, DiagramFrameBoard, DiagramFramePanel } from '@/components/ui/diagram-frame';
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
  { id: 'inbox', title: 'Inbox', x: 0, y: 0, w: 100, h: 40 },
  { id: 'triage', title: 'Triage', x: 200, y: 0, w: 100, h: 40 },
  { id: 'archive', title: 'Archive', x: 400, y: 0, w: 100, h: 40 },
  { id: 'alone', title: 'Alone', x: 200, y: 200, w: 100, h: 40 },
];
const EDGES: DiagramEdge[] = [
  { id: 'sort', from: 'inbox', to: 'triage', title: 'sort' },
  { id: 'done', from: 'triage', to: 'archive', title: 'done' },
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

  it('drops the ring when focus goes on to the toolbar over the board', () => {
    render(<Diagram aria-label="Mail" nodes={NODES} edges={EDGES} overlay={<DiagramToolbar />} />);
    board().focus();
    key('Home');
    expect(document.querySelectorAll('[data-slot=diagram-ring][data-focused]')).toHaveLength(1);
    act(() => { screen.getByRole('button', { name: 'Zoom out' }).focus(); });
    expect(document.querySelectorAll('[data-slot=diagram-ring][data-focused]')).toHaveLength(0);
  });

  it('keeps the zoom off its board, and hands it in steps to the parts that scale by it', () => {
    render(<Diagram aria-label="Mail" nodes={NODES} edges={EDGES}><span data-testid="mine" /></Diagram>);
    const world = document.querySelector('[data-slot=canvas-board]')!;
    expect(world.getAttribute('style')).toMatch(/scale\(/);
    expect(world.getAttribute('style')).not.toMatch(/--canvas-zoom/);
    expect(screen.getByTestId('mine').parentElement!.style.getPropertyValue('--canvas-zoom')).not.toBe('');
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

  it('undoes for an owner that keeps copies of the arrays it was handed', () => {
    function Copying({ onChange }: { onChange: (data: DiagramData, details: DiagramDataChangeDetails) => void }) {
      const [data, setData] = useState<DiagramData>({ nodes: NODES, edges: EDGES });
      return (
        <Diagram aria-label="Mail" nodes={data.nodes} edges={data.edges} editable onDataChange={(next, details) => { onChange(next, details); setData({ nodes: [...next.nodes], edges: [...next.edges] }); }} />
      );
    }
    const onChange = vi.fn();
    render(<Copying onChange={onChange} />);
    board().focus();
    key('Home');
    key('ArrowRight', { shiftKey: true });
    key('ArrowRight', { shiftKey: true });
    const x = () => parseFloat((document.querySelector('[data-node=inbox]') as HTMLElement).style.left);
    expect(x()).toBe(16);
    key('z', { metaKey: true });
    expect(onChange.mock.lastCall![1].reason).toBe('undo');
    expect(x()).toBe(8);
    key('z', { metaKey: true });
    expect(x()).toBe(0);
    key('z', { metaKey: true, shiftKey: true });
    expect(onChange.mock.lastCall![1].reason).toBe('redo');
    expect(x()).toBe(8);
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

describe('Diagram, one history', () => {
  /** Something bigger than the diagram, with its own history: the diagram's undo is that history's. */
  function Owner({ onStep }: { onStep?: (reason: string) => void }) {
    const [names, setNames] = useState(['Inbox', 'Triage']);
    const history = useDiagramHistory(names, (to, details) => { onStep?.(details.reason); setNames(to); });
    const nodes = names.map((title, i) => ({ id: `n${i}`, title, x: i * 200, y: 0, w: 100, h: 40 }));
    return (
      <>
        <button type="button" onClick={() => { const next = [...names, `Folder ${names.length + 1}`]; history.record(names, next); setNames(next); }}>Add</button>
        <button type="button" onClick={() => setNames(['Replaced'])}>Replace</button>
        <Diagram aria-label="Mail" nodes={nodes} edges={[]} editable history={history} overlay={<DiagramToolbar />} />
      </>
    );
  }

  it('drives a history it was handed, from its toolbar and from ⌘Z / ⇧⌘Z / ⌘Y, wherever focus is in it', () => {
    const onStep = vi.fn();
    render(<Owner onStep={onStep} />);
    const undo = () => screen.getByRole('button', { name: 'Undo' });
    expect(undo().hasAttribute('data-disabled')).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('button', { name: /^Folder 3/ })).toBeTruthy();
    expect(undo().hasAttribute('data-disabled')).toBe(false);
    fireEvent.click(undo());
    expect(onStep).toHaveBeenLastCalledWith('undo');
    expect(screen.queryByRole('button', { name: /^Folder 3/ })).toBeNull();
    // From the board,
    board().focus();
    key('z', { metaKey: true, shiftKey: true });
    expect(onStep).toHaveBeenLastCalledWith('redo');
    expect(screen.getByRole('button', { name: /^Folder 3/ })).toBeTruthy();
    // and from the toolbar.
    act(() => { screen.getByRole('button', { name: 'Zoom in' }).focus(); });
    key('z', { ctrlKey: true });
    expect(onStep).toHaveBeenLastCalledWith('undo');
    key('y', { ctrlKey: true });
    expect(onStep).toHaveBeenCalledTimes(4);
    expect(screen.getByRole('button', { name: /^Folder 3/ })).toBeTruthy();
  });

  it('starts over when what it holds the history of changes from outside', () => {
    render(<Owner />);
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByRole('button', { name: 'Undo' }).hasAttribute('data-disabled')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Replace' }));
    expect(screen.getByRole('button', { name: 'Undo' }).hasAttribute('data-disabled')).toBe(true);
  });

  it('keeps no history of its own while it has one handed to it, and its controller and agent reach that one', () => {
    const controller = createDiagramController();
    const onDataChange = vi.fn();
    const undo = vi.fn();
    render(<Diagram aria-label="Mail" defaultNodes={NODES} defaultEdges={EDGES} editable controller={controller} onDataChange={onDataChange} history={{ canUndo: true, canRedo: false, undo, redo: () => {} }} />);
    act(() => { controller.select({ nodes: ['alone'], edges: [] }); });
    act(() => { controller.deleteSelection(); });
    expect(onDataChange.mock.lastCall![1].reason).toBe('delete');
    expect(controller.canUndo()).toBe(true);
    expect(controller.canRedo()).toBe(false);
    act(() => { controller.undo(); });
    expect(undo).toHaveBeenCalledTimes(1);
    expect(onDataChange).toHaveBeenCalledTimes(1);
    expect(controller.redo()).toBe(false);
  });

  it('leaves ⌘Z alone in a field, and has no undo when read-only', () => {
    const undo = vi.fn();
    render(<Diagram aria-label="Mail" nodes={NODES} edges={EDGES} history={{ canUndo: true, canRedo: true, undo, redo: undo }} overlay={<input aria-label="Find" />} />);
    act(() => { screen.getByRole('textbox', { name: 'Find' }).focus(); });
    key('z', { metaKey: true });
    expect(undo).not.toHaveBeenCalled();
    cleanup();
    render(<Diagram aria-label="Mail" nodes={NODES} edges={EDGES} overlay={<DiagramToolbar />} />);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(document.getElementById(board().getAttribute('aria-describedby')!)?.textContent).not.toMatch(/undoes/);
  });
});

describe('Diagram, read-only', () => {
  it('selects and reads without `editable`: nothing moves, connects or is deleted', () => {
    const onSelectionChange = vi.fn();
    render(<Diagram aria-label="Mail" nodes={NODES} edges={EDGES} onSelectionChange={onSelectionChange} />);
    board().focus();
    key('Home');
    key('Enter');
    expect(onSelectionChange.mock.lastCall).toEqual([{ nodes: ['inbox'], edges: [] }, expect.objectContaining({ reason: 'keyboard' })]);
    expect(screen.getByRole('button', { name: /^Inbox/ }).getAttribute('aria-pressed')).toBe('true');
    key('Delete');
    key('ArrowRight', { shiftKey: true });
    expect(screen.getByRole('button', { name: /^Inbox/ })).toBeTruthy();
    expect(document.getElementById(board().getAttribute('aria-describedby')!)?.textContent).not.toMatch(/Delete deletes/);
  });

  it('is a plain picture with selectable={false}', () => {
    render(<Diagram aria-label="Mail" nodes={NODES} edges={EDGES} selectable={false} />);
    expect(screen.getByRole('button', { name: /^Inbox/ }).hasAttribute('aria-pressed')).toBe(false);
  });
});

describe('Diagram, what it shows', () => {
  it('draws focus apart from selection: both together, and each alone', () => {
    render(<Diagram aria-label="Mail" defaultNodes={NODES} defaultEdges={EDGES} defaultSelection={{ nodes: ['inbox', 'triage'], edges: [] }} />);
    board().focus();
    key('Home');
    const ring = (id: string) => document.querySelector<HTMLElement>(`[data-slot=diagram-ring][data-ring-of=${id}]`)!;
    // Focused and selected: the fill and line, and the ring past a gap.
    expect(ring('inbox').hasAttribute('data-focused')).toBe(true);
    expect(ring('inbox').hasAttribute('data-selected')).toBe(true);
    expect(ring('inbox').className).toMatch(/bg-primary\/12/);
    expect(ring('inbox').className).toMatch(/var\(--ring\)/);
    // Selected only: the fill and line, no ring.
    expect(ring('triage').className).toMatch(/bg-primary\/12/);
    expect(ring('triage').className).not.toMatch(/var\(--ring\)/);
    // Focused only: the ring, and no fill.
    key('PageDown');
    key('PageDown');
    const only = document.querySelector<HTMLElement>('[data-slot=diagram-ring][data-focused]:not([data-selected])');
    expect(only).not.toBeNull();
    expect(only!.className).not.toMatch(/bg-primary/);
  });

  it('bands a focused edge, apart from the selected edge’s color', () => {
    render(<Diagram aria-label="Mail" nodes={NODES} edges={EDGES} />);
    board().focus();
    key('Home');
    key(']');
    expect(document.querySelector('[data-slot=diagram-edge-focus] path')?.getAttribute('d')).toBe(document.activeElement?.getAttribute('d'));
  });

  it('shows an error in place of the empty state', () => {
    render(<Diagram aria-label="Mail" nodes={[]} error="It can’t be drawn." />);
    expect(screen.getByRole('alert').textContent).toBe('It can’t be drawn.');
    expect(document.querySelector('[data-slot=diagram-empty]')).toBeNull();
  });

  it('hands overlay parts only the controller’s methods', () => {
    let seen: Record<string, unknown> | null = null;
    function Peek() { seen = useDiagram().diagram as unknown as Record<string, unknown>; return null; }
    render(<Diagram aria-label="Mail" nodes={NODES} edges={EDGES} overlay={<Peek />} />);
    expect(seen).not.toBeNull();
    expect('internal' in seen!).toBe(false);
    expect(Object.keys(seen!).sort()).toEqual(['canRedo', 'canUndo', 'clearSelection', 'connect', 'deleteSelection', 'getData', 'getSelection', 'moveNodes', 'redo', 'select', 'selectAll', 'undo']);
  });

  it('spells its shortcuts for the platform', () => {
    render(<Diagram aria-label="Mail" defaultNodes={NODES} defaultEdges={EDGES} editable />);
    const keys = document.getElementById(board().getAttribute('aria-describedby')!)!.textContent!;
    expect(keys).not.toMatch(/Command\+/);
    expect(keys).toMatch(/(⌘|Ctrl\+)Z undoes/);
    expect(keys).toMatch(/(⌘|Ctrl\+)0 fits/);
  });

  it('puts its toolbar at the top in a frame, where the foot is the bar’s, and at the foot elsewhere', () => {
    render(<Diagram aria-label="Mail" nodes={NODES} edges={EDGES} overlay={<DiagramToolbar />} />);
    expect(screen.getByRole('toolbar', { name: 'Diagram tools' }).getAttribute('data-side')).toBe('bottom');
    cleanup();
    render(
      <DiagramFrame presentation="column">
        <DiagramFrameBoard>
          <Diagram aria-label="Mail" nodes={NODES} edges={EDGES} overlay={<DiagramToolbar />} />
        </DiagramFrameBoard>
        <DiagramFramePanel title="Mail">Body</DiagramFramePanel>
      </DiagramFrame>,
    );
    expect(screen.getByRole('toolbar', { name: 'Diagram tools' }).getAttribute('data-side')).toBe('top');
  });
});

describe('Diagram, a card’s items', () => {
  const CARDS: DiagramNode[] = [
    { id: 'paused', title: 'Paused', entry: true, x: 0, y: 0, w: 140, h: 90, sections: [{ id: 'entry', title: 'Entry actions', items: [{ title: 'onPause', icon: 'bolt' }, { id: 'log', title: 'log' }] }] },
    { id: 'playing', title: 'Playing', x: 300, y: 0, w: 140, h: 40 },
  ];
  const LABELLED: DiagramEdge[] = [{ id: 'play', from: 'paused', to: 'playing', title: 'play', sections: [{ items: [{ title: 'onPlay' }] }] }];
  const status = () => document.querySelector('[data-slot=diagram-status]')!.textContent;

  it('goes into a card’s items and an edge label’s with Alt+↓, along them with the arrows, presses with Enter, and out with Escape', () => {
    const onAction = vi.fn();
    render(<Diagram aria-label="Player" nodes={CARDS} edges={LABELLED} editable onAction={onAction} />);
    act(() => board('Player').focus());
    key('Home');
    expect(document.activeElement?.getAttribute('data-node')).toBe('paused');
    key('ArrowDown', { altKey: true });
    // Focus stays on the card, the item has the ring, and it's said aloud.
    expect(document.activeElement?.getAttribute('data-node')).toBe('paused');
    expect(document.querySelector('[data-slot=diagram-item][data-focused]')?.getAttribute('data-item')).toBe('onPause');
    expect(status()).toBe('onPause, Entry actions, in Paused. Enter presses it.');
    key('ArrowDown');
    expect(document.querySelector('[data-slot=diagram-item][data-focused]')?.getAttribute('data-item')).toBe('log');
    key('Enter');
    expect(onAction).toHaveBeenLastCalledWith({ kind: 'node', id: 'paused', section: 'entry', item: 'log' }, expect.objectContaining({ reason: 'enter-key' }));
    // Pressing an item selects its card.
    expect(screen.getByRole('button', { name: /^Paused, node/ }).getAttribute('aria-pressed')).toBe('true');
    key('Escape');
    expect(document.querySelector('[data-slot=diagram-item][data-focused]')).toBeNull();
    expect(document.querySelector('[data-slot=diagram-ring][data-focused]')?.getAttribute('data-ring-of')).toBe('paused');
    // An edge label's items, the same way.
    key(']');
    expect(document.activeElement?.getAttribute('data-edge')).toBe('play');
    key('ArrowDown', { altKey: true });
    expect(document.querySelector('[data-slot=diagram-edge-label] [data-slot=diagram-item][data-focused]')?.getAttribute('data-item')).toBe('onPlay');
    key('Enter');
    expect(onAction).toHaveBeenLastCalledWith({ kind: 'edge', id: 'play', section: '0', item: 'onPlay' }, expect.objectContaining({ reason: 'enter-key' }));
  });

  it('reports a press on an item, and keeps items as words when the diagram can’t be edited', () => {
    const onAction = vi.fn();
    const { unmount } = render(<Diagram aria-label="Player" nodes={CARDS} edges={LABELLED} editable onAction={onAction} />);
    const chip = document.querySelector<HTMLElement>('[data-slot=diagram-item][data-item=onPause]')!;
    expect(chip.hasAttribute('data-pressable')).toBe(true);
    fireEvent.pointerDown(chip, { pointerId: 1, button: 0, clientX: 30, clientY: 50 });
    fireEvent.pointerUp(chip, { pointerId: 1, button: 0, clientX: 30, clientY: 50 });
    expect(onAction).toHaveBeenLastCalledWith({ kind: 'node', id: 'paused', section: 'entry', item: 'onPause' }, expect.objectContaining({ reason: 'press' }));
    unmount();
    render(<Diagram aria-label="Player" nodes={CARDS} edges={LABELLED} onAction={onAction} />);
    expect(document.querySelector('[data-slot=diagram-item][data-pressable]')).toBeNull();
    act(() => board('Player').focus());
    key('Home');
    key('ArrowDown', { altKey: true });
    // Read-only: Alt+↓ has nowhere to go in a card that holds nothing.
    expect(document.querySelector('[data-slot=diagram-item][data-focused]')).toBeNull();
  });

  it('draws the anatomy: a header strip, sections, the entry marker, and a label that is a card', () => {
    render(<Diagram aria-label="Player" nodes={CARDS} edges={LABELLED} />);
    const card = document.querySelector('[data-slot=diagram-node][data-node=paused]')!;
    expect(card.querySelector('[data-slot=diagram-node-title]')?.textContent).toBe('Paused');
    expect(card.querySelector('[data-slot=diagram-section-title]')?.textContent).toBe('Entry actions');
    expect(card.querySelectorAll('[data-slot=diagram-item]')).toHaveLength(2);
    expect(card.querySelector('[data-slot=diagram-entry]')).not.toBeNull();
    expect(document.querySelector('[data-slot=diagram-edge-label]')?.getAttribute('data-shape')).toBe('card');
    // A screen reader hears the sections with the card, and the label's with its edge.
    expect(screen.getByRole('button', { name: /^Paused, node, where it starts\. Entry actions: onPause, log\./ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'play, edge from Paused to Playing. onPlay.' })).toBeTruthy();
  });
});
