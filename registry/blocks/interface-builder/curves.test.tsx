// @vitest-environment happy-dom
import { MotionGlobalConfig } from 'framer-motion';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CurveEditor, SpringGraph } from './curves';
import { springSpec, type Ease, type SpringSpec } from './easing';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;
MotionGlobalConfig.skipAnimations = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

const slider = (name: string) => host.querySelector<HTMLElement>(`[role=slider][aria-label="${name}"]`)!;
const key = (el: HTMLElement, k: string, init: KeyboardEventInit = {}) =>
  act(() => { el.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init })); });

describe('CurveEditor', () => {
  it('makes each control point a focusable 2D slider with its range and both values read out', async () => {
    await act(async () => root.render(<CurveEditor ease={[0.25, 0.1, 0.25, 1]} onChange={() => {}} />));
    const p1 = slider('Control point 1');
    expect(p1.tabIndex).toBe(0);
    expect(p1.getAttribute('aria-roledescription')).toBe('2D slider');
    expect(p1.getAttribute('aria-valuemin')).toBe('0');
    expect(p1.getAttribute('aria-valuemax')).toBe('1');
    expect(p1.getAttribute('aria-valuenow')).toBe('0.25');
    expect(p1.getAttribute('aria-valuetext')).toBe('x 0.25, y 0.1');
    expect(slider('Control point 2').getAttribute('aria-valuetext')).toBe('x 0.25, y 1');
  });

  it('steps a point with the arrows (Shift ten times), Page Up/Down and Home/End, each a committed change', async () => {
    let ease: Ease = [0.25, 0.1, 0.25, 1];
    const changes: { ease: Ease; live: boolean }[] = [];
    const render = () => root.render(<CurveEditor ease={ease} onChange={(e, live) => { ease = e; changes.push({ ease: e, live }); render(); }} />);
    await act(async () => render());
    const p1 = slider('Control point 1');
    await key(p1, 'ArrowRight');
    expect(ease).toEqual([0.26, 0.1, 0.25, 1]);
    await key(p1, 'ArrowUp', { shiftKey: true });
    expect(ease).toEqual([0.26, 0.2, 0.25, 1]);
    await key(p1, 'Home');
    expect((ease as number[])[0]).toBe(0);
    await key(p1, 'End');
    expect((ease as number[])[0]).toBe(1);
    const y = (ease as number[])[1];
    await key(p1, 'PageDown');
    expect((ease as number[])[1]).toBeLessThan(y - 0.1);
    // Keys are checkpoints of their own, never live previews.
    expect(changes.every((c) => !c.live)).toBe(true);
    // The second point moves its own pair.
    await key(slider('Control point 2'), 'ArrowLeft');
    expect((ease as number[])[2]).toBe(0.24);
  });
});

describe('SpringGraph', () => {
  it('steps the first peak: right for a longer spring, up from no bounce for some', async () => {
    let spec: SpringSpec = springSpec(0.4, 0);
    const render = () => root.render(<SpringGraph spec={spec} onChange={(s) => { spec = s; render(); }} />);
    await act(async () => render());
    const peak = slider('Spring: ← → duration, ↑ ↓ bounce');
    expect(peak.getAttribute('aria-valuetext')).toBe('duration 0.4 seconds, bounce 0');
    expect(peak.getAttribute('aria-valuemin')).toBe('0');
    await key(peak, 'ArrowRight');
    expect(spec.duration).toBe(0.41);
    expect(spec.bounce).toBe(0);
    await key(peak, 'ArrowUp');
    expect(spec.bounce).toBeGreaterThan(0);
    expect(slider('Spring: ← → duration, ↑ ↓ bounce').getAttribute('aria-valuetext')).toBe(`duration ${spec.duration} seconds, bounce ${spec.bounce}`);
  });
});
