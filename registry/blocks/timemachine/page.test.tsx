// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionInfo } from '@/lib/session-recorder';
import { CloudPanel } from './cloud';
import TimeMachine from './page';

/* Two recorded sessions, in place of this browser's (empty) store. */
const now = Date.now();
const SESSIONS: SessionInfo[] = [
  { id: 's-new', startedAt: now - 60_000, endedAt: now - 30_000, events: 40, url: '/', title: 'Desktop', width: 1280, height: 800, device: 'Chrome', live: false, local: true },
  { id: 's-old', startedAt: now - 3_600_000, endedAt: now - 3_500_000, events: 90, url: '/', title: 'Desktop', width: 1280, height: 800, device: 'Chrome', live: false, local: true },
];
let fake = false;
vi.mock('@/lib/session-recorder', async (load) => {
  const real = await load<typeof import('@/lib/session-recorder')>();
  return { ...real, useSessions: () => (fake ? SESSIONS : real.useSessions()), readSession: async (id: string) => (fake ? [] : real.readSession(id)) };
});

/* happy-dom lays nothing out: the split view is `width` px wide. */
let width = 1200;
const clientWidth = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth')
  ?? Object.getOwnPropertyDescriptor(Element.prototype, 'clientWidth')!;
Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
  configurable: true,
  get(this: HTMLElement) { return this.getAttribute('aria-label') === 'Time Machine' ? width : clientWidth.get!.call(this); },
});
afterAll(() => { Object.defineProperty(HTMLElement.prototype, 'clientWidth', clientWidth); });

let element: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  element = document.createElement('div');
  document.body.append(element);
  root = createRoot(element);
});
afterEach(async () => {
  fake = false;
  width = 1200;
  await act(async () => root.unmount());
  element.remove();
  vi.unstubAllGlobals();
});
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });

it('the storage bar is a Meter, and the storage popover is named by its title', async () => {
  await act(async () => root.render(<TimeMachine />));
  await settle();
  const meter = element.querySelector<HTMLElement>('[role="meter"]')!;
  expect(meter).toBeTruthy();
  expect(meter.getAttribute('aria-label')).toBe('Browser storage');
  expect(meter.getAttribute('aria-valuemin')).toBe('0');
  expect(meter.getAttribute('aria-valuemax')).toBe('100');
  expect(meter.hasAttribute('aria-valuenow')).toBe(true);

  const trigger = element.querySelector<HTMLElement>('[aria-label="Where sessions are stored"]')!;
  await act(async () => trigger.click());
  await settle();
  const popover = document.querySelector<HTMLElement>('[data-slot="popover-content"]')!;
  expect(popover.hasAttribute('aria-label')).toBe(false);
  expect(document.getElementById(popover.getAttribute('aria-labelledby')!)?.textContent).toBe('Storage');
});

it('Cloud’s settings are Inputs in Fields: named by their labels, described by their hints', async () => {
  await act(async () => root.render(<CloudPanel />));
  const cloud = [...element.querySelectorAll<HTMLElement>('[role="radio"]')].find((r) => r.textContent === 'Cloud')!;
  await act(async () => cloud.click());
  await settle();
  const server = element.querySelector<HTMLInputElement>('input[placeholder^="https://"]')!;
  expect(server.getAttribute('data-slot')).toBe('input');
  expect(document.getElementById(server.getAttribute('aria-labelledby') ?? '')?.textContent ?? element.querySelector(`label[for="${server.id}"]`)?.textContent).toBe('Server');
  expect(document.getElementById(server.getAttribute('aria-describedby')!)?.textContent).toContain('Durable Streams endpoint');
});

describe('Time Machine on a SplitView', () => {
  const item = (id: string) => [...element.querySelectorAll<HTMLElement>('[aria-label="Sessions"] li button')][SESSIONS.findIndex((s) => s.id === id)];
  const detail = () => element.querySelector<HTMLElement>('[aria-label="Session"]')!;
  const back = () => detail().querySelector<HTMLElement>('button[aria-label="Back to Sessions"]');

  it('tiles the list and the detail when there is room: the newest session is selected, a pick shows another', async () => {
    fake = true;
    await act(async () => root.render(<TimeMachine />));
    await settle();
    expect(item('s-new').getAttribute('aria-current')).toBe('true');
    expect(back()).toBeNull();
    const before = detail().querySelector('h2')!.textContent;
    await act(async () => item('s-old').click());
    await settle();
    expect(item('s-old').getAttribute('aria-current')).toBe('true');
    expect(detail().querySelector('h2')!.textContent).not.toBe(before);
  });

  it('compact, a pick pushes the detail; its back button and Escape pop to the list, which never remounts', async () => {
    fake = true;
    width = 400;
    await act(async () => root.render(<TimeMachine />));
    await settle();
    const list = element.querySelector('[aria-label="Sessions"]')!;
    const firstRow = item('s-old');
    expect(list.hasAttribute('inert')).toBe(false);
    expect(detail().hasAttribute('inert')).toBe(true);

    await act(async () => item('s-old').click());
    await settle();
    expect(detail().hasAttribute('inert')).toBe(false);
    expect(list.hasAttribute('inert')).toBe(true);
    await act(async () => back()!.click());
    await settle();
    expect(list.hasAttribute('inert')).toBe(false);
    expect(element.querySelector('[aria-label="Sessions"]')).toBe(list);
    expect(item('s-old')).toBe(firstRow);

    await act(async () => item('s-new').click());
    await settle();
    expect(detail().hasAttribute('inert')).toBe(false);
    await act(async () => { detail().querySelector('h2')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); });
    await settle();
    expect(list.hasAttribute('inert')).toBe(false);
  });
});
