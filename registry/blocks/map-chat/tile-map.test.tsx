// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { MapView } from './geo';
import { TileMap, type MapPin, type TileMapViewportChangeDetails } from './tile-map';

let element: HTMLDivElement;
let root: Root;
beforeEach(() => {
  (globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  // happy-dom lays nothing out: every element is a 400 × 300 box at the origin, so the map measures a frame.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300, toJSON: () => ({}) } as DOMRect);
  element = document.createElement('div');
  document.body.append(element);
  root = createRoot(element);
});
afterEach(async () => {
  await act(async () => root.unmount());
  element.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const VIEW: MapView = { center: { lat: 51.5, lng: -0.12 }, zoom: 12 };
const PINS: MapPin[] = [{ id: 'cafe', position: { lat: 51.5, lng: -0.12 }, label: 'Cafe' }];

async function mount(props: Partial<Parameters<typeof TileMap>[0]> = {}) {
  const changes: { view: MapView; details: TileMapViewportChangeDetails }[] = [];
  const onMapClick = vi.fn();
  const onPinClick = vi.fn();
  await act(async () => {
    root.render(
      <TileMap view={VIEW} pins={PINS} animate={false} tileUrl={() => 'data:,'} attribution={null}
        onViewChange={(view, details) => changes.push({ view, details })} onMapClick={onMapClick} onPinClick={onPinClick} {...props} />,
    );
  });
  const map = element.querySelector<HTMLElement>('[role=application]')!;
  // The first measurement put the camera on `view`.
  expect(changes.map((c) => c.details.reason)).toEqual(['imperative']);
  changes.length = 0;
  return { map, changes, onMapClick, onPinClick, last: () => changes[changes.length - 1] };
}

const key = (el: HTMLElement, k: string, init: KeyboardEventInit = {}) =>
  act(async () => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })); });
const pointer = (el: Element, type: string, x: number, y: number, pointerId = 1, pointerType = 'mouse') =>
  act(async () => { el.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, pointerId, pointerType, button: 0, buttons: type === 'pointerup' ? 0 : 1, bubbles: true, cancelable: true })); });

it('is a focusable, named map: the arrows pan it, + and - zoom a level, 0 goes back to its view', async () => {
  const { map, last } = await mount();
  expect(map.getAttribute('aria-roledescription')).toBe('map');
  expect(map.getAttribute('aria-label')).toBe('Map');
  expect(map.tabIndex).toBe(0);
  map.focus();

  await key(map, 'ArrowRight');
  expect(last().details.reason).toBe('move-key');
  expect(last().details.event?.type).toBe('keydown');
  expect(typeof last().details.cancel).toBe('function');
  expect(last().view.center.lng).toBeGreaterThan(VIEW.center.lng);
  expect(last().view.zoom).toBeCloseTo(12);

  await key(map, 'ArrowUp', { shiftKey: true });
  expect(last().view.center.lat).toBeGreaterThan(VIEW.center.lat);

  await key(map, '+');
  expect(last().details.reason).toBe('zoom-key');
  expect(last().view.zoom).toBeCloseTo(13);
  await key(map, '-');
  await key(map, '-');
  expect(last().view.zoom).toBeCloseTo(11);

  await key(map, '0');
  expect(last().details.reason).toBe('imperative');
  expect(last().details.source).toBe('programmatic');
  expect(typeof last().details.cancel).toBe('function');
  expect(last().view.zoom).toBeCloseTo(12);
  expect(last().view.center.lng).toBeCloseTo(VIEW.center.lng);
});

it('a press that does not move is a tap; one that moves past the threshold drags the map', async () => {
  const { map, changes, onMapClick, last } = await mount();
  await pointer(map, 'pointerdown', 100, 100);
  await pointer(map, 'pointermove', 101, 101);
  await pointer(map, 'pointerup', 101, 101);
  expect(onMapClick).toHaveBeenCalledTimes(1);
  expect(changes).toHaveLength(0);

  await pointer(map, 'pointerdown', 100, 100);
  await pointer(map, 'pointermove', 120, 100);
  await pointer(map, 'pointermove', 160, 100);
  expect(map.hasAttribute('data-dragging')).toBe(true);
  expect(last().details.reason).toBe('drag');
  // Dragging right brings the west into view.
  expect(last().view.center.lng).toBeLessThan(VIEW.center.lng);
  await pointer(map, 'pointerup', 160, 100);
  expect(map.hasAttribute('data-dragging')).toBe(false);
  expect(onMapClick).toHaveBeenCalledTimes(1);
});

it('a press on a pin is its click, not a tap on the map', async () => {
  const { map, onMapClick, onPinClick } = await mount();
  const pin = map.querySelector<HTMLButtonElement>('[data-pin=cafe]')!;
  expect(pin.getAttribute('aria-label')).toBe('Cafe');
  await pointer(pin, 'pointerdown', 200, 150);
  await pointer(pin, 'pointerup', 200, 150);
  await act(async () => { pin.click(); });
  expect(onPinClick).toHaveBeenCalledWith(PINS[0]);
  expect(onMapClick).not.toHaveBeenCalled();
});

it('the wheel pans, and with Ctrl it zooms at the pointer', async () => {
  const { map, last } = await mount();
  await act(async () => { map.dispatchEvent(new WheelEvent('wheel', { deltaY: 40, clientX: 200, clientY: 150, bubbles: true, cancelable: true })); });
  expect(last().details.reason).toBe('wheel');
  expect(last().view.zoom).toBeCloseTo(12);
  expect(last().view.center.lat).toBeLessThan(VIEW.center.lat);
  // happy-dom's WheelEvent drops the modifier keys from its init.
  const pinch = new WheelEvent('wheel', { deltaY: -40, clientX: 200, clientY: 150, bubbles: true, cancelable: true });
  Object.defineProperty(pinch, 'ctrlKey', { value: true });
  await act(async () => { map.dispatchEvent(pinch); });
  expect(last().view.zoom).toBeGreaterThan(12);
});

it('stays put and out of the tab order when not interactive', async () => {
  const { map, changes } = await mount({ interactive: false });
  expect(map.hasAttribute('tabindex')).toBe(false);
  await key(map, 'ArrowRight');
  await pointer(map, 'pointerdown', 100, 100);
  await pointer(map, 'pointermove', 160, 100);
  await pointer(map, 'pointerup', 160, 100);
  expect(changes).toHaveLength(0);
});
