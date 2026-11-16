// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTitleFlight } from '@/lib/title-flight';

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;

/* The flight runs on animation frames and reads the time from them. The test owns both, so what it sees does not
   depend on how busy the machine is: `frames(n)` runs n frames 16 ms apart. */
let now = 0;
let queued = new Map<number, FrameRequestCallback>();
let handle = 0;
beforeEach(() => {
  now = 0;
  queued = new Map();
  handle = 0;
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    queued.set(++handle, callback);
    return handle;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    queued.delete(id);
  });
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});
const frames = (count: number) => {
  for (let i = 0; i < count; i++) {
    now += 16;
    const due = [...queued.values()];
    queued.clear();
    for (const callback of due) callback(now);
  }
};

const box = (el: HTMLElement, x: number, width: number) => {
  el.getBoundingClientRect = () => new DOMRect(x, 10, width, 22);
  return el;
};

function stack() {
  const cont = box(document.createElement('div'), 0, 390);
  const from = box(document.createElement('span'), 150, 90);
  const to = box(document.createElement('span'), 30, 70);
  from.textContent = 'Settings';
  to.textContent = 'Settings';
  cont.append(from, to);
  document.body.append(cont);
  const flight = createTitleFlight(cont, { parts: () => ({}) });
  return { cont, from, to, flight };
}

describe('createTitleFlight', () => {
  it("flies copies of the title on UI SDK's spring and puts the real labels back once it is at rest", () => {
    const { cont, from, to, flight } = stack();
    flight.fly(() => [from, to, null]);
    // One frame to start, then 64 ms of the spring.
    frames(5);
    const layer = cont.querySelector<HTMLElement>('[data-slot=navigation-title-flight]');
    expect(layer).not.toBeNull();
    expect(from.style.visibility).toBe('hidden');
    // Under way: the copy that arrives is somewhere between where the title was and where it goes.
    const arriving = layer!.children[1] as HTMLElement;
    const x = Number(/translate\(([-\d.]+)px/.exec(arriving.style.transform)?.[1]);
    expect(x).toBeLessThan(150);
    expect(x).toBeGreaterThan(30);
    // Three seconds on: at rest.
    frames(190);
    expect(queued.size).toBe(0);
    expect(cont.querySelector('[data-slot=navigation-title-flight]')).toBeNull();
    expect(from.style.visibility).toBe('');
    expect(to.style.visibility).toBe('');
    flight.destroy();
  });

  it('destroy ends a flight under way at once', () => {
    const { cont, from, to, flight } = stack();
    flight.fly(() => [from, to, null]);
    frames(5);
    expect(cont.querySelector('[data-slot=navigation-title-flight]')).not.toBeNull();
    flight.destroy();
    expect(cont.querySelector('[data-slot=navigation-title-flight]')).toBeNull();
    expect(from.style.visibility).toBe('');
  });
});
