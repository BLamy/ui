// @vitest-environment happy-dom
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CloudflareDiagram, type CloudflareDiagramProps } from '@/components/ui/cloudflare-diagram';
import type { CloudflareEdge, CloudflareService } from '@/lib/cloudflare-services';
import type { CloudflareSystem } from '@/lib/cloudflare-system';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(cleanup);

const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 20)); });
// The Combobox reads change events, as its tests do; a kit Input reads input events.
const type = async (input: HTMLElement, text: string) => { fireEvent.change(input, { target: { value: text } }); await settle(); };
const write = async (input: HTMLElement, text: string) => { fireEvent.input(input, { target: { value: text } }); await settle(); };
const commit = async (input: HTMLElement, text: string) => {
  await write(input, text);
  fireEvent.keyDown(input, { key: 'Enter' });
  await settle();
};

const SERVICES: CloudflareService[] = [
  { id: 'api', kind: 'workers', label: 'API', at: { x: 0, y: 0 } },
  { id: 'files', kind: 'r2', label: 'Files', at: { x: 340, y: 0 } },
];
const EDGES: CloudflareEdge[] = [{ id: 'up', from: 'api', to: 'files', via: 'r2_buckets', binding: 'FILES', operations: ['put'] }];

/** The panel as a column, open, so it's there without a layout to measure (happy-dom has none). */
const shown = (props: Partial<CloudflareDiagramProps>) =>
  render(<div style={{ position: 'relative', width: 1200, height: 600 }}><CloudflareDiagram panelPresentation="column" defaultPanelOpen {...props} /></div>);
const panel = () => document.querySelector<HTMLElement>('[data-slot=cloudflare-panel]')!;
const field = (name: string) => document.querySelector<HTMLInputElement>(`[data-field="${name}"]`)!;

describe('CloudflareDiagram, read-only', () => {
  it('can be selected in, as a picture you read, and says what’s selected in the panel', async () => {
    const onSelectionChange = vi.fn();
    shown({ services: SERVICES, edges: EDGES, onSelectionChange });
    await settle();
    const board = screen.getByRole('application', { name: 'Cloudflare services board' });
    act(() => { board.focus(); });
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    await settle();
    expect(onSelectionChange.mock.calls.at(-1)?.[0]).toEqual({ nodes: ['api'], edges: [] });
    // Nothing moves or is deleted.
    fireEvent.keyDown(document.activeElement!, { key: 'Delete' });
    await settle();
    expect(document.querySelector('[data-node=api]')).toBeTruthy();
    expect(panel().querySelector('[data-slot=cloudflare-description]')).toBeTruthy();
  });

  it('is a picture with a panel that only reads: no search, no fields, nothing to delete or undo', async () => {
    shown({ services: SERVICES, edges: EDGES, defaultSelection: { nodes: [], edges: ['up'] } });
    await settle();
    expect(screen.getByRole('group', { name: 'Cloudflare services' })).toBeTruthy();
    expect(panel()).toBeTruthy();
    expect(within(panel()).queryByRole('combobox')).toBeNull();
    expect(within(panel()).queryByRole('textbox')).toBeNull();
    expect(within(panel()).queryByRole('checkbox')).toBeNull();
    expect(within(panel()).queryByRole('button', { name: 'Delete' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    // What it uses is still said, and what it is, in words.
    expect(panel().querySelector('[data-slot=cloudflare-binding-name]')?.textContent).toContain('FILES');
    expect(panel().querySelector('[data-operation=put]')?.getAttribute('data-used')).toBe('');
    expect(panel().textContent).toContain('CC-BY-4.0');
  });

  it('says how to start when there is nothing in it', async () => {
    shown({ services: [] });
    await settle();
    expect(screen.getByText('No services yet')).toBeTruthy();
    expect(screen.getByText('This system has no services to draw.')).toBeTruthy();
  });
});

describe('CloudflareDiagram, its panel', () => {
  /** A column panel left to its own default: closed until something's selected. */
  const left = (props: Partial<CloudflareDiagramProps>) =>
    render(<div style={{ position: 'relative', width: 1200, height: 600 }}><CloudflareDiagram panelPresentation="column" {...props} /></div>);
  const pane = () => document.querySelector<HTMLElement>('[data-slot=diagram-frame][data-open]');

  it('is closed with nothing selected, its button on the bar, and opens on a selection, named for it, with the keys left on the board', async () => {
    left({ services: SERVICES, edges: EDGES });
    await settle();
    expect(pane()).toBeNull();
    expect(screen.getByRole('button', { name: 'Services' })).toBeTruthy();
    const board = screen.getByRole('application', { name: 'Cloudflare services board' });
    act(() => { board.focus(); });
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    await settle();
    expect(pane()).toBeTruthy();
    expect(board.contains(document.activeElement)).toBe(true);
    // Titled by what's selected: its name and its product, which also names the panel and is said as it changes.
    expect(document.querySelector('[data-slot=adaptive-pane-title]')?.textContent).toBe('API · Workers');
    expect(screen.getByRole('region', { name: 'API, Workers' }).contains(panel())).toBe(true);
    expect(document.querySelector('[data-slot=cloudflare-panel-status]')?.textContent).toBe('API, Workers');
  });

  it('names a connection by its name on env and its two ends, and a wrong one in the catalog’s words', async () => {
    left({ services: SERVICES, edges: [...EDGES, { id: 'odd', from: 'files', to: 'api', via: 'd1_databases' }], defaultSelection: { nodes: [], edges: ['up'] } });
    await settle();
    expect(document.querySelector('[data-slot=adaptive-pane-title]')?.textContent).toBe('FILES · API → Files');
    expect(document.querySelector('[data-slot=cloudflare-panel-status]')?.textContent).toBe('FILES, from API to Files');
    cleanup();
    left({ services: SERVICES, edges: [{ id: 'odd', from: 'files', to: 'api', via: 'd1_databases' }], defaultSelection: { nodes: [], edges: ['odd'] } });
    await settle();
    expect(panel().textContent).not.toContain('d1_databases');
  });

  it('is open from the start when it’s editable and there’s nothing yet: it has the search', async () => {
    left({ services: [], editable: true });
    await settle();
    expect(pane()).toBeTruthy();
    expect(within(panel()).getByRole('combobox')).toBeTruthy();
  });
});

describe('CloudflareDiagram, editable', () => {
  it('renames a service in the panel, with onDataChange(system, details), and undoes it', async () => {
    const onDataChange = vi.fn();
    shown({ editable: true, defaultServices: SERVICES, defaultEdges: EDGES, defaultSelection: { nodes: ['files'], edges: [] }, onDataChange });
    await settle();
    await commit(field('label'), 'Uploads');
    expect(onDataChange).toHaveBeenCalledTimes(1);
    const [system, details] = onDataChange.mock.calls[0] as [CloudflareSystem, { reason: string }];
    expect(details.reason).toBe('edit');
    expect(system.services.find((s) => s.id === 'files')?.label).toBe('Uploads');
    expect(document.querySelector('[data-node=files] [data-slot=diagram-node-title]')?.textContent).toBe('Uploads');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await settle();
    expect(onDataChange.mock.calls[1]?.[1].reason).toBe('undo');
    expect(document.querySelector('[data-node=files] [data-slot=diagram-node-title]')?.textContent).toBe('Files');
    expect((screen.getByRole('button', { name: 'Redo' }) as HTMLButtonElement).hasAttribute('data-disabled')).toBe(false);
  });

  it('keeps what it has when a change is canceled', async () => {
    shown({ editable: true, defaultServices: SERVICES, defaultEdges: EDGES, defaultSelection: { nodes: ['files'], edges: [] }, onDataChange: (_, details) => details.cancel() });
    await settle();
    await commit(field('label'), 'Uploads');
    expect(document.querySelector('[data-node=files] [data-slot=diagram-node-title]')?.textContent).toBe('Files');
  });

  it('refuses a binding name that can’t be on env, and says why', async () => {
    const onDataChange = vi.fn();
    shown({ editable: true, defaultServices: SERVICES, defaultEdges: EDGES, defaultSelection: { nodes: [], edges: ['up'] }, onDataChange });
    await settle();
    await commit(field('binding-name'), '1 bad');
    expect(onDataChange).not.toHaveBeenCalled();
    // The refusal is the field's error: under it, and the field is invalid.
    expect(panel().querySelector('[data-part=refusal]')?.textContent).toContain('can’t be a name on env');
    expect(field('binding-name').closest('[data-invalid]')).toBeTruthy();
    await commit(field('binding-name'), 'UPLOADS');
    expect(onDataChange.mock.calls[0]?.[0].edges[0].binding).toBe('UPLOADS');
  });

  it('chooses operations in the catalog’s order, whatever order they were checked in', async () => {
    const onDataChange = vi.fn();
    shown({ editable: true, defaultServices: SERVICES, defaultEdges: EDGES, defaultSelection: { nodes: [], edges: ['up'] }, onDataChange });
    await settle();
    fireEvent.click(within(panel()).getByRole('checkbox', { name: /^get\(/ }));
    await settle();
    const ops = (onDataChange.mock.calls.at(-1)?.[0] as CloudflareSystem).edges[0]?.operations ?? [];
    expect([...ops].sort()).toEqual(['get', 'put']);
    expect(ops.indexOf('get')).toBeLessThan(ops.indexOf('put'));
  });

  it('adds a service from a search of the catalog, selects it, and empties the search', async () => {
    const onDataChange = vi.fn();
    function Controlled() {
      const [system, setSystem] = useState<CloudflareSystem>({ services: SERVICES, edges: EDGES });
      return <CloudflareDiagram editable panelPresentation="column" defaultPanelOpen services={system.services} edges={system.edges} onDataChange={(next, details) => { onDataChange(next, details); setSystem(next); }} />;
    }
    render(<div style={{ position: 'relative', width: 1200, height: 600 }}><Controlled /></div>);
    await settle();
    const search = screen.getByRole('combobox', { name: 'Search Cloudflare’s services' }) as HTMLInputElement;
    await type(search, 'd1');
    const option = screen.getAllByRole('option').find((o) => o.getAttribute('data-kind') === 'd1');
    expect(option).toBeTruthy();
    fireEvent.click(option!);
    await settle();
    expect(onDataChange.mock.calls[0]?.[1].reason).toBe('add');
    expect((onDataChange.mock.calls[0]?.[0] as CloudflareSystem).services.map((s) => s.kind)).toEqual(['workers', 'r2', 'd1']);
    expect(search.value).toBe('');
    expect(panel().querySelector('[data-slot=cloudflare-description]')).toBeTruthy();
  });

  it('brings what it adds into view, with a reveal the Diagram doesn’t leave to its keys', async () => {
    const onViewportChange = vi.fn();
    shown({ editable: true, defaultServices: SERVICES, defaultEdges: EDGES, defaultViewport: { x: -9000, y: -9000, zoom: 1 }, onViewportChange });
    await settle();
    onViewportChange.mockClear();
    await type(screen.getByRole('combobox', { name: 'Search Cloudflare’s services' }), 'd1');
    fireEvent.click(screen.getAllByRole('option').find((o) => o.getAttribute('data-kind') === 'd1')!);
    await settle();
    // `focus-in` is what the Diagram cancels (its keys follow focus themselves), so the board stayed where it was.
    expect(onViewportChange.mock.calls.map(([, details]) => details.reason)).toContain('imperative');
    const [to] = onViewportChange.mock.calls.at(-1)!;
    expect(to).not.toEqual({ x: -9000, y: -9000, zoom: 1 });
  });

  it('gives focus back to “Open its machine” when the machine’s closed, once the panel isn’t inert', async () => {
    const machine = { id: 'room', initial: 'idle', states: { idle: { on: { GO: 'busy' } }, busy: {} } };
    shown({ editable: true, defaultServices: [{ id: 'room', kind: 'durable-objects', label: 'Room', machine, at: { x: 0, y: 0 } }], defaultSelection: { nodes: ['room'], edges: [] } });
    await settle();
    fireEvent.click(panel().querySelector<HTMLElement>('[data-action=open-machine]')!);
    await settle();
    expect(document.querySelector('[data-state-diagram]')).toBeTruthy();
    expect(panel().closest('[inert]')).toBeTruthy();
    fireEvent.click(document.querySelector<HTMLElement>('[data-slot=diagram-frame-cover-back]')!);
    await settle();
    await settle();
    expect(document.querySelector('[data-state-diagram]')).toBeNull();
    const opener = panel().querySelector<HTMLElement>('[data-action=open-machine]')!;
    expect(opener.closest('[inert]')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('lists what’s wrong, with a way to each, and a connection the catalog says there isn’t is drawn as wrong', async () => {
    shown({ editable: true, defaultServices: SERVICES, defaultEdges: [{ id: 'bad', from: 'files', to: 'api', via: 'r2_buckets' }] });
    await settle();
    const issue = panel().querySelector('[data-slot=cloudflare-issue][data-edge=bad]')!;
    expect(issue.getAttribute('data-severity')).toBe('error');
    expect(document.querySelector('[data-slot=diagram-edge][data-edge=bad]')?.getAttribute('data-tone')).toBe('destructive');
    fireEvent.click(within(issue as HTMLElement).getByRole('button', { name: 'Show it' }));
    await settle();
    expect(panel().querySelector('[data-slot=cloudflare-edge-problem]')?.textContent).toBeTruthy();
  });
});

describe('CloudflareDiagram, its anatomy', () => {
  const ROOM = { id: 'room', initial: 'empty', states: { empty: { on: { JOIN: 'empty' } } } };
  const WITH_ROOM: CloudflareService[] = [...SERVICES, { id: 'room', kind: 'durable-objects', label: 'Room', host: 'api', machine: ROOM, at: { x: 40, y: 200 } }];

  it('opens a service’s machine from its Machine chip, when editing', async () => {
    const onAction = vi.fn();
    const onOpenMachineChange = vi.fn();
    shown({ editable: true, defaultServices: WITH_ROOM, defaultEdges: EDGES, onAction, onOpenMachineChange });
    await settle();
    const chip = document.querySelector<HTMLElement>('[data-slot=diagram-item][data-owner=room][data-section=machine]');
    expect(chip?.getAttribute('data-pressable')).toBe('');
    fireEvent.pointerDown(chip!, { button: 0, pointerId: 1, isPrimary: true });
    fireEvent.pointerUp(chip!, { button: 0, pointerId: 1, isPrimary: true });
    fireEvent.click(chip!);
    await settle();
    expect(onOpenMachineChange).toHaveBeenCalledWith('room', expect.objectContaining({ reason: 'press' }));
    expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ kind: 'node', id: 'room', section: 'machine' }), expect.anything());
    expect(document.querySelector('[data-state-diagram]')).not.toBeNull();
  });

  it('read-only, a chip is words, not a button', async () => {
    shown({ services: WITH_ROOM, edges: EDGES });
    await settle();
    const chip = document.querySelector('[data-slot=diagram-item][data-owner=room][data-section=machine]');
    expect(chip).not.toBeNull();
    expect(chip?.hasAttribute('data-pressable')).toBe(false);
    expect(document.querySelector('[data-slot=diagram-port]')).toBeNull();
  });

  it('gives the system’s name and account back with every change', async () => {
    const onDataChange = vi.fn();
    shown({ editable: true, title: 'Uploads', accountId: 'acc-1', defaultServices: SERVICES, defaultEdges: EDGES, defaultSelection: { nodes: ['files'], edges: [] }, onDataChange });
    await settle();
    expect(document.querySelector('[data-node="cloudflare:system"] [data-slot=diagram-node-title]')?.textContent).toBe('Uploads');
    await commit(field('label'), 'Bucket');
    expect(onDataChange.mock.calls[0]?.[0]).toMatchObject({ name: 'Uploads', accountId: 'acc-1' });
  });
});

/* Editing keeps the board: what an edit didn't touch stays where it was, in the system it reports (`at`), and undo puts it
   all back. The layout itself is the invariant suite's (lib/diagram-invariants.test.ts); this is the component's part. */
describe('CloudflareDiagram, editing keeps the board', () => {
  const PLACED: CloudflareService[] = [
    { id: 'api', kind: 'workers', label: 'API', at: { x: 40, y: 120 } },
    { id: 'files', kind: 'r2', label: 'Files', at: { x: 40, y: 420 } },
    { id: 'jobs', kind: 'queues', label: 'Jobs', at: { x: 360, y: 420 } },
  ];
  const PLACED_EDGES: CloudflareEdge[] = [
    { id: 'api-files', from: 'api', to: 'files', via: 'r2_buckets', binding: 'FILES', operations: ['put'] },
    { id: 'files-jobs', from: 'files', to: 'jobs', via: 'events', operations: ['object-create'] },
  ];
  function Controlled({ onChange, start = PLACED, edges = PLACED_EDGES, ...props }: Partial<CloudflareDiagramProps> & { onChange: (s: CloudflareSystem, d: { reason: string }) => void; start?: CloudflareService[]; edges?: CloudflareEdge[] }) {
    const [system, setSystem] = useState<CloudflareSystem>({ services: start, edges });
    return <CloudflareDiagram editable panelPresentation="column" defaultPanelOpen services={system.services} edges={system.edges} onDataChange={(next, details) => { onChange(next, details); setSystem(next); }} {...props} />;
  }
  const at = (s: CloudflareSystem, id: string) => s.services.find((x) => x.id === id)?.at;
  const boxOf = (s: CloudflareSystem, id: string) => {
    const n = document.querySelector<HTMLElement>(`[data-slot=diagram-node][data-node="${id}"]`);
    const p = at(s, id)!;
    return { x: p.x, y: p.y, w: parseFloat(n?.parentElement?.style.width || n?.style.width || '0'), h: parseFloat(n?.parentElement?.style.height || n?.style.height || '0') };
  };

  it('adds a service from the catalog in free room beside what’s selected; nothing else moves, and undo puts it all back', async () => {
    const onChange = vi.fn();
    render(<div style={{ position: 'relative', width: 1200, height: 700 }}><Controlled onChange={onChange} defaultSelection={{ nodes: ['api'], edges: [] }} /></div>);
    await settle();
    await type(screen.getByRole('combobox', { name: 'Search Cloudflare’s services' }), 'kv');
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Search Cloudflare’s services' }), { key: 'Enter' });
    await settle();
    const [added, details] = onChange.mock.calls.at(-1) as [CloudflareSystem, { reason: string }];
    expect(details.reason).toBe('add');
    for (const s of PLACED) expect(at(added, s.id)).toEqual(s.at);
    const kv = added.services.find((s) => !PLACED.some((p) => p.id === s.id))!;
    expect(kv.at).toBeTruthy();
    await settle();
    // Clear of every card, beside the selected one.
    const mine = boxOf(added, kv.id);
    for (const s of PLACED) {
      const o = boxOf(added, s.id);
      expect(mine.x < o.x + o.w && o.x < mine.x + mine.w && mine.y < o.y + o.h && o.y < mine.y + mine.h, `${kv.id} on ${s.id}`).toBe(false);
    }
    const api = boxOf(added, 'api');
    expect(Math.hypot(mine.x - api.x, mine.y - api.y)).toBeLessThan(600);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await settle();
    const [undone, why] = onChange.mock.calls.at(-1) as [CloudflareSystem, { reason: string }];
    expect(why.reason).toBe('undo');
    expect(undone.services).toEqual(PLACED);
  });

  it('deletes a service and leaves the rest where they were', async () => {
    const onChange = vi.fn();
    render(<div style={{ position: 'relative', width: 1200, height: 700 }}><Controlled onChange={onChange} defaultSelection={{ nodes: ['files'], edges: [] }} /></div>);
    await settle();
    fireEvent.click(within(panel()).getByRole('button', { name: 'Delete' }));
    await settle();
    const [left] = onChange.mock.calls.at(-1) as [CloudflareSystem];
    expect(left.services.map((s) => s.id)).toEqual(['api', 'jobs']);
    expect(at(left, 'api')).toEqual(PLACED[0]!.at);
    expect(at(left, 'jobs')).toEqual(PLACED[2]!.at);
  });

  it('has Tidy up in its toolbar, with its shortcut, which lays the board out again as one step that undo takes back', async () => {
    const onChange = vi.fn();
    render(<div style={{ position: 'relative', width: 1200, height: 700 }}><Controlled onChange={onChange} /></div>);
    await settle();
    const tidy = screen.getByRole('button', { name: 'Tidy up' });
    expect(tidy.closest('[role=toolbar]')).toBeTruthy();
    fireEvent.click(tidy);
    for (let i = 0; i < 100 && !onChange.mock.calls.length; i++) await settle();
    const [tidied, details] = onChange.mock.calls.at(-1) as [CloudflareSystem, { reason: string }];
    expect(details.reason).toBe('tidy');
    expect(tidied.services.every((s) => s.at)).toBe(true);
    expect(tidied.services.map((s) => s.at)).not.toEqual(PLACED.map((s) => s.at));
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await settle();
    expect((onChange.mock.calls.at(-1) as [CloudflareSystem])[0].services).toEqual(PLACED);
  });

  it('“Add a service” opens the panel on the search, ready to type', async () => {
    render(<div style={{ position: 'relative', width: 1200, height: 700 }}><CloudflareDiagram editable panelPresentation="column" defaultServices={PLACED} defaultEdges={PLACED_EDGES} /></div>);
    await settle();
    fireEvent.click(screen.getByRole('button', { name: 'Add a service' }));
    await settle();
    await settle();
    expect(document.activeElement).toBe(screen.getByRole('combobox', { name: 'Search Cloudflare’s services' }));
  });

  it('calls a connection by one name in the panel, on the board and to a screen reader', async () => {
    render(<div style={{ position: 'relative', width: 1200, height: 700 }}><CloudflareDiagram panelPresentation="column" services={PLACED} edges={PLACED_EDGES} defaultSelection={{ nodes: [], edges: ['files-jobs'] }} /></div>);
    await settle();
    const label = document.querySelector('[data-slot=diagram-edge-label][data-edge=files-jobs]')?.textContent ?? '';
    expect(label).toContain('event notification');
    expect(document.querySelector('[data-slot=adaptive-pane-title]')?.textContent).toBe('event notification · Files → Jobs');
    expect(document.querySelector('[data-slot=cloudflare-panel-status]')?.textContent).toBe('event notification, from Files to Jobs');
    expect(document.querySelector('[data-slot=diagram-edge][data-edge=files-jobs]')?.getAttribute('aria-label')).toMatch(/^event notification/);
  });
});
