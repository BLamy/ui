// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MotionGlobalConfig } from 'framer-motion';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DeliveryTrackingDemo } from './delivery-tracking-demo';

MotionGlobalConfig.skipAnimations = true;

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
  await act(async () => root.unmount());
  element.remove();
  vi.unstubAllGlobals();
});
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });

it('renders the order over the map-chat block’s TileMap', async () => {
  await act(async () => root.render(<DeliveryTrackingDemo stage={1} autoAdvance={false} style={{ width: 400, height: 800 }} />));
  await settle();
  expect(element.textContent).toContain('Preparing your order');
  expect(element.querySelector('[data-slot="tile-map"], [aria-roledescription="map"], [role="application"]')).toBeTruthy();
  // Hover-card triggers have a role that carries their name: the address is a link, each menu tile an article.
  const address = element.querySelector<HTMLAnchorElement>('a[href^="https://maps.apple.com/"]')!;
  expect(address.getAttribute('data-slot')).toBe('hover-card-trigger');
  const tiles = [...element.querySelectorAll<HTMLElement>('article[data-slot="hover-card-trigger"]')];
  expect(tiles.map((t) => t.getAttribute('aria-label'))).toContain('Baguette');
  expect(element.querySelector('div[data-slot="hover-card-trigger"][aria-label]')).toBeNull();
});

it('reduced motion: the car jumps to the next stage instead of tweening', async () => {
  const matchMedia = vi.fn((query: string) => ({ matches: query.includes('reduce'), media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal('matchMedia', matchMedia);
  await act(async () => root.render(<DeliveryTrackingDemo stage={0} autoAdvance={false} style={{ width: 400, height: 800 }} />));
  await act(async () => root.render(<DeliveryTrackingDemo stage={2} autoAdvance={false} style={{ width: 400, height: 800 }} />));
  await settle();
  expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)');
  expect(element.textContent).toContain('Your order is ready');
});
