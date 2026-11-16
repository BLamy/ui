// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMachine } from 'xstate';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { StateDiagram } from '@/components/ui/state-diagram';

/* StateDiagram in a page, on real XState and real ELK (in the page, as happy-dom has no worker): it draws the machine
   with one node per state, simulating lights where it is (`aria-current`) and offers the events it can take, and
   editing writes to the config. The panel is a column here (forced), as happy-dom has no layout to measure. Strict. */

beforeAll(() => { globalThis.__UI_SDK_STRICT__ = true; });
afterEach(cleanup);

const doors = createMachine({
  id: 'door',
  initial: 'closed',
  states: {
    closed: { on: { OPEN: 'open', LOCK: 'locked' } },
    open: { on: { CLOSE: 'closed' } },
    locked: { on: { UNLOCK: 'closed' } },
  },
});

const node = (name: RegExp) => screen.findByRole('button', { name });

describe('StateDiagram', () => {
  it('draws each state and transition, named for a screen reader', async () => {
    render(<div style={{ position: 'relative', width: 900, height: 600 }}><StateDiagram machine={doors} aria-label="Door" /></div>);
    expect(screen.getByRole('group', { name: 'Door' })).toBeTruthy();
    expect(await node(/^closed, state\./)).toBeTruthy();
    expect(await node(/^OPEN, edge from closed to open\.$/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^locked, state\./ })).toBeTruthy();
  });

  it('simulates: marks where it is, offers the events it can take, and moves on one', async () => {
    render(<div style={{ position: 'relative', width: 900, height: 600 }}><StateDiagram machine={doors} simulate panelPresentation="column" aria-label="Door" /></div>);
    const closed = await node(/^closed, state\./);
    await waitFor(() => expect(closed.getAttribute('aria-current')).toBe('true'));
    expect(screen.getByRole('heading', { name: 'Simulation' })).toBeTruthy();
    const open = await screen.findByRole('button', { name: 'OPEN' });
    expect(screen.getByRole('button', { name: 'LOCK' })).toBeTruthy();
    act(() => { fireEvent.click(open); });
    await waitFor(() => expect(screen.getByRole('button', { name: /^open, state\./ }).getAttribute('aria-current')).toBe('true'));
    expect(screen.getByRole('button', { name: /^closed, state\./ }).hasAttribute('aria-current')).toBe(false);
    expect(screen.getByRole('button', { name: 'CLOSE' })).toBeTruthy();
  });

  it('edits the config: Add state writes a new state, and Undo takes it back', async () => {
    const onConfigChange = vi.fn();
    render(<div style={{ position: 'relative', width: 900, height: 600 }}><StateDiagram machine={doors} editable onConfigChange={onConfigChange} panelPresentation="column" aria-label="Door" /></div>);
    const add = await screen.findByRole('button', { name: 'Add state' });
    act(() => { fireEvent.click(add); });
    await waitFor(() => expect(onConfigChange).toHaveBeenCalledTimes(1));
    const states = Object.keys((onConfigChange.mock.lastCall![0] as { states: object }).states);
    expect(states).toEqual(['closed', 'open', 'locked', 'state']);
    expect(onConfigChange.mock.lastCall![1].reason).toBe('edit');
    // Undo is the Diagram's toolbar's, driving the config's history: there's no Undo in the panel.
    expect(document.querySelector('[data-slot=edit-panel] [data-action=undo]')).toBeNull();
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Undo' })); });
    await waitFor(() => expect(onConfigChange).toHaveBeenCalledTimes(2));
    expect(onConfigChange.mock.lastCall![1].reason).toBe('undo');
    expect(Object.keys((onConfigChange.mock.lastCall![0] as { states: object }).states)).toEqual(['closed', 'open', 'locked']);
  });

  it('can be selected in without editable, as a picture you read', async () => {
    const onSelectionChange = vi.fn();
    render(<div style={{ position: 'relative', width: 900, height: 600 }}><StateDiagram machine={doors} onSelectionChange={onSelectionChange} aria-label="Door" /></div>);
    await node(/^open, state\./);
    act(() => { screen.getByRole('application', { name: 'Door board' }).focus(); });
    fireEvent.keyDown(document.activeElement!, { key: 'Home' });
    fireEvent.keyDown(document.activeElement!, { key: 'Enter' });
    await waitFor(() => expect(onSelectionChange).toHaveBeenCalled());
    const [selected] = onSelectionChange.mock.lastCall![0].nodes as string[];
    expect(document.querySelector(`[data-node="${selected}"]`)?.getAttribute('aria-pressed')).toBe('true');
    // Nothing to change it with.
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add state' })).toBeNull();
  });

  it('reads a machine’s source without running it', async () => {
    const source = `import { setup } from "xstate";
      export const door = setup({}).createMachine({ id: "door", initial: "shut", context: globalThis.mustNeverRun(), states: {
        shut: { on: { OPEN: { target: "ajar", guard: isAllowed } } }, ajar: { entry: () => globalThis.mustNeverRun() } } });`;
    render(<div style={{ position: 'relative', width: 900, height: 600 }}><StateDiagram source={source} aria-label="Door" /></div>);
    expect(await node(/^shut, state\./)).toBeTruthy();
    expect(await node(/^OPEN \[isAllowed\], edge from shut to ajar\.$/)).toBeTruthy();
  });

  it('says what it can’t read in a source', async () => {
    render(<div style={{ position: 'relative', width: 900, height: 600 }}><StateDiagram source="createMachine({ states: getStates() })" aria-label="Bad" /></div>);
    expect((await screen.findByRole('alert')).textContent).toMatch(/static machine config/);
  });

  it('shows an edit at once from defaultConfig, and only what’s passed back from config', async () => {
    const config = { id: 'door', initial: 'closed', states: { closed: {}, open: {} } };
    const onConfigChange = vi.fn();
    const { unmount } = render(<div style={{ position: 'relative', width: 900, height: 600 }}><StateDiagram defaultConfig={config} editable panelPresentation="column" aria-label="Door" /></div>);
    let add = await screen.findAllByRole('button', { name: 'Add state' });
    act(() => { fireEvent.click(add[0]!); });
    expect(await node(/^state, state\./)).toBeTruthy();
    unmount();
    render(<div style={{ position: 'relative', width: 900, height: 600 }}><StateDiagram config={config} onConfigChange={onConfigChange} editable panelPresentation="column" aria-label="Door" /></div>);
    add = await screen.findAllByRole('button', { name: 'Add state' });
    act(() => { fireEvent.click(add[0]!); });
    await waitFor(() => expect(onConfigChange).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: /^state, state\./ })).toBeNull();
  });

  it('says why a rename is refused under the field, which shows it’s invalid', async () => {
    render(<div style={{ position: 'relative', width: 900, height: 600 }}><StateDiagram machine={doors} editable defaultSelection={{ nodes: ['door.open'], edges: [] }} panelPresentation="column" aria-label="Door" /></div>);
    const name = await waitFor(() => { const f = document.querySelector<HTMLInputElement>('[data-field=name]'); expect(f).toBeTruthy(); return f!; });
    act(() => { fireEvent.input(name, { target: { value: 'closed' } }); });
    act(() => { fireEvent.keyDown(name, { key: 'Enter' }); });
    await waitFor(() => expect(name.closest('[data-invalid]')).toBeTruthy());
    expect(name.closest('[data-slot=field]')?.textContent).toMatch(/closed/);
    expect(document.querySelector('[data-slot=edit-refusal]')).toBeNull();
  });

  it('says what XState says about a config it won’t have', async () => {
    render(<div style={{ position: 'relative', width: 900, height: 600 }}><StateDiagram config={{ id: 'bad', initial: 'nowhere', states: { a: {} } }} aria-label="Bad" /></div>);
    expect((await screen.findByRole('alert')).textContent).toMatch(/nowhere/);
  });
});
