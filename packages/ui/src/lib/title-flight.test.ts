// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest';
import { createTitleFlight } from '@/lib/title-flight';

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;

afterEach(() => document.body.replaceChildren());

const box = (el: HTMLElement, x: number, width: number) => {
  el.getBoundingClientRect = () => new DOMRect(x, 10, width, 22);
  return el;
};
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  it("flies copies of the title on UI SDK's spring and puts the real labels back once it is at rest", async () => {
    const { cont, from, to, flight } = stack();
    flight.fly(() => [from, to, null]);
    await wait(60);
    const layer = cont.querySelector<HTMLElement>('[data-slot=navigation-title-flight]');
    expect(layer).not.toBeNull();
    expect(from.style.visibility).toBe('hidden');
    // Under way: the copy that arrives is somewhere between where the title was and where it goes.
    const arriving = layer!.children[1] as HTMLElement;
    const x = Number(/translate\(([-\d.]+)px/.exec(arriving.style.transform)?.[1]);
    expect(x).toBeLessThan(150);
    expect(x).toBeGreaterThan(30);
    await wait(1500);
    expect(cont.querySelector('[data-slot=navigation-title-flight]')).toBeNull();
    expect(from.style.visibility).toBe('');
    expect(to.style.visibility).toBe('');
    flight.destroy();
  });

  it('destroy ends a flight under way at once', async () => {
    const { cont, from, to, flight } = stack();
    flight.fly(() => [from, to, null]);
    await wait(60);
    flight.destroy();
    expect(cont.querySelector('[data-slot=navigation-title-flight]')).toBeNull();
    expect(from.style.visibility).toBe('');
  });
});
