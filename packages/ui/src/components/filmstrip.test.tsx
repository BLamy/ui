// @vitest-environment happy-dom
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Filmstrip } from '@/components/ui/filmstrip';

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;

/* happy-dom has no layout: every strip is 320 × 36, so 16:9 cells are 64 px and five fill it. */
const width = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
const height = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 320 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 36 });
});
afterAll(() => {
  if (width) Object.defineProperty(HTMLElement.prototype, 'clientWidth', width);
  if (height) Object.defineProperty(HTMLElement.prototype, 'clientHeight', height);
});
afterEach(cleanup);

const strip = () => document.querySelector<HTMLElement>('[data-slot=filmstrip]')!;

describe('Filmstrip', () => {
  it('tiles placeholder cells while there are no frames, then the frames nearest each cell', () => {
    const { rerender } = render(<Filmstrip frames={[]} aspect={16 / 9} />);
    expect(strip().hasAttribute('data-loading')).toBe(true);
    expect(strip().children).toHaveLength(5);
    const frames = Array.from({ length: 10 }, (_, i) => ({ time: i, src: `f${i}.png` }));
    rerender(<Filmstrip frames={frames} from={0} to={10} aspect={16 / 9} />);
    expect(strip().hasAttribute('data-loading')).toBe(false);
    const cells = [...strip().children] as HTMLElement[];
    expect(cells).toHaveLength(5);
    expect(cells.map((c) => c.style.getPropertyValue('--frame'))).toEqual(['url("f1.png")', 'url("f3.png")', 'url("f5.png")', 'url("f7.png")', 'url("f9.png")']);
  });

  it('stops shimmering when told the frames are not coming (loading={false}), and shimmers on request', () => {
    const { rerender } = render(<Filmstrip frames={[]} loading={false} aspect={16 / 9} />);
    expect(strip().hasAttribute('data-loading')).toBe(false);
    expect(strip().children).toHaveLength(0);
    rerender(<Filmstrip frames={[{ time: 0, src: 'a.png' }]} loading aspect={16 / 9} />);
    expect(strip().hasAttribute('data-loading')).toBe(true);
  });

  it('is decorative and passes its ref', () => {
    let el: HTMLDivElement | null = null;
    render(<Filmstrip frames={[]} ref={(node) => { el = node; }} />);
    expect(strip().getAttribute('aria-hidden')).toBe('true');
    expect(el).toBe(strip());
  });
});
