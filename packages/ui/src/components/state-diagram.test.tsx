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
    act(() => { fireEvent.click(screen.getByRole('button', { name: 'Undo' })); });
    await waitFor(() => expect(onConfigChange).toHaveBeenCalledTimes(2));
    expect(Object.keys((onConfigChange.mock.lastCall![0] as { states: object }).states)).toEqual(['closed', 'open', 'locked']);
  });

  it('says what XState says about a config it won’t have', async () => {
    render(<div style={{ position: 'relative', width: 900, height: 600 }}><StateDiagram config={{ id: 'bad', initial: 'nowhere', states: { a: {} } }} aria-label="Bad" /></div>);
    expect((await screen.findByRole('alert')).textContent).toMatch(/nowhere/);
  });
});
