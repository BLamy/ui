// @vitest-environment happy-dom
import { MotionGlobalConfig } from 'framer-motion';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createCanvasController } from '@/components/ui/canvas';
import type { AppMap, PageNode } from './analyze';
import { Board } from './board';

// The frames' rrweb stages are out of scope here: the board's hover card is.
vi.mock('./frame', () => ({ ScreenFrame: () => null }));
vi.mock('@/components/ui/replay-preview', () => ({ formatReplayTime: (ms: number) => `${Math.round(ms / 1000)}s` }));

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;
MotionGlobalConfig.skipAnimations = true;

const page = (id: string, label: string): PageNode => ({
  kind: 'page', id, label, route: `/${id}`, titles: [], recordings: ['r1'],
  states: [{ id: 'base', label, evidence: [{ recording: 'r1', time: 1000 }] }],
});
const pages = [page('home', 'Home'), page('settings', 'Settings')];
const map: AppMap = { pages, overlays: [], chrome: [], segues: [], entry: { node: 'home', state: 'base' }, recordings: [] };
const boxes = pages.map((node, i) => ({ key: `${node.id}/base`, node, state: 'base', cropped: false, x: i * 400, y: 0, w: 320, h: 240 }));

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.useFakeTimers();
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const wait = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });
const card = () => document.querySelector<HTMLElement>('[data-slot="hover-card-content"][data-open]');
const frame = (key: string) => host.querySelector<HTMLElement>(`[data-rc-frame="${key}"]`)!;
const enter = (el: Element) => act(() => { el.dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' })); });
const leave = (el: Element) => act(() => { el.dispatchEvent(new PointerEvent('pointerleave', { pointerType: 'mouse' })); });

function renderBoard() {
  return act(async () => root.render(
    <div style={{ width: 800, height: 600 }}>
      <Board map={map} boxes={boxes} recordings={new Map([['r1', { id: 'r1', name: 'Sign-up', events: [] }]])} viewport={{ w: 1280, h: 960 }}
        crops={{}} onCrop={() => {}} view={{ x: 0, y: 0, zoom: 1 }} onViewChange={() => {}} controller={createCanvasController()}
        selection={null} onSelect={() => {}} showDismiss showArrows showMiniMap={false} shown={{}} onShow={() => {}}
        journeys={[]} journey={null} onJourney={() => {}} />
    </div>,
  ));
}

it('makes each frame a named trigger of the board’s one hover card', async () => {
  await renderBoard();
  const home = frame('home/base');
  expect(home.getAttribute('data-slot')).toBe('hover-card-trigger');
  expect(home.getAttribute('aria-label')).toBe('Home');
  expect(home.getAttribute('role')).toBe('figure');
  await wait(100);
});

it('opens after HoverCard’s rest delay, moves to the next frame while open, and closes after leaving', async () => {
  await renderBoard();
  enter(frame('home/base'));
  await wait(300);
  expect(card()).toBeNull();
  await wait(400);
  expect(card()?.textContent).toMatch(/Home.*Seen 1× in 1 recording/);
  expect(frame('home/base').hasAttribute('data-open')).toBe(true);
  // Open, the card follows the pointer to the next frame straight away.
  leave(frame('home/base'));
  enter(frame('settings/base'));
  await wait(50);
  expect(card()?.textContent).toMatch(/Settings/);
  leave(frame('settings/base'));
  act(() => { document.body.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: 5, clientY: 5, bubbles: true })); });
  await wait(400);
  expect(card()).toBeNull();
});
