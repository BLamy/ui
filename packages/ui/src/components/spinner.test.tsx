// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Spinner, spinnerAnimations } from '@/components/ui/spinner';

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;

/** How many animated parts each loader has. */
const PARTS: Record<string, [selector: string, count: number | number[]]> = {
  orbit: ['.bl-ld-orbit-dot', 8],
  bars: ['.bl-ld-beacon-indicator__bar', 5],
  matrix: ['.bl-ld-matrix-indicator__dot', 9],
  merge: ['.bl-ld-cell-indicator__cell', 4],
  encode: ['.bl-ld-register-indicator__bit', 6],
  scan: ['.bl-ld-band-indicator__segment', 3],
  lift: ['.bl-ld-lift-queue-indicator__level', 4],
  // BL UI's own loaders: the parts that carry the staggered timing.
  steps: ['.bl-ld-st-dot', 4],
  cradle: ['.bl-ld-cr-arm', 5],
  hourglass: ['.bl-ld-hg-glass', 1],
  balance: ['.bl-ld-ba-beam', 1],
  fanout: ['.bl-ld-fo-leaf', 3],
  battery: ['.bl-ld-ba2-cell', 4],
  bloom: ['.bl-ld-bloom-dot', 13],
  sonar: ['.bl-ld-sonar', 1],
  gyro: ['.bl-ld-gy-ring', 3],
  coalesce: ['.bl-ld-co-dot', 8],
  crystal: ['.bl-ld-ct-facet', 6],
  loop: ['.bl-ld-lp-run', [1, 3, 1]], // `trail` has three runners, one per pattern otherwise
  relay: ['.bl-ld-rl-node', 3],
  robot: ['.bl-ld-rb-eye', 2],
  kettle: ['.bl-ld-kt-steam', 3],
};

const root = (c: HTMLElement) => c.querySelector('[data-slot=spinner]') as HTMLElement;
const delaysOf = (c: HTMLElement, sel: string) => [...c.querySelectorAll<HTMLElement>(sel)].map((e) => e.style.getPropertyValue('--bl-ld-delay'));

describe('spinnerAnimations', () => {
  it('lists ios and the twenty-two loaders, three patterns each, with ids that match their labels', () => {
    expect(spinnerAnimations.map((a) => a.id)).toEqual([
      'ios', 'orbit', 'bars', 'matrix', 'merge', 'encode', 'scan', 'lift',
      'steps', 'cradle', 'hourglass', 'balance', 'fanout', 'battery', 'bloom', 'sonar', 'gyro', 'coalesce', 'crystal', 'loop', 'relay', 'robot', 'kettle',
    ]);
    for (const a of spinnerAnimations.filter((x) => x.id !== 'ios')) expect(a.patterns).toHaveLength(3);
    expect(spinnerAnimations[0].patterns).toEqual([]);
    for (const a of spinnerAnimations) expect(a.label.toLowerCase()).toBe(a.id);
  });
});

describe('Spinner loaders', () => {
  it.each(Object.entries(PARTS))('%s renders its parts for every pattern, each with its own timing', (animation, [sel, count]) => {
    const variants = spinnerAnimations.find((a) => a.id === animation)?.patterns ?? [];
    expect(variants).toHaveLength(3);
    for (const [i, variant] of variants.entries()) {
      const { container, unmount } = render(<Spinner animation={animation as 'orbit'} pattern={variant as never} />);
      const parts = [...container.querySelectorAll<HTMLElement>(sel)];
      expect(parts, `${animation}/${variant}`).toHaveLength(Array.isArray(count) ? count[i] : count);
      for (const p of parts) {
        // Gyro's rings each read their own cycle length (--bl-ld-d0…2) from the root.
        expect(p.style.getPropertyValue('--bl-ld-d')).toMatch(/^(\d+ms|var\(--bl-ld-d\d\))$/);
        expect(p.style.getPropertyValue('--bl-ld-delay')).toMatch(/^\d+ms$/);
      }
      expect(container.querySelector('[data-variant]')?.getAttribute('data-variant')).toBe(variant);
      unmount();
    }
  });

  it('patterns differ in their timing', () => {
    const chase = render(<Spinner animation="orbit" pattern="chase" />);
    const oppose = render(<Spinner animation="orbit" pattern="oppose" />);
    expect(delaysOf(chase.container, '.bl-ld-orbit-dot')).not.toEqual(delaysOf(oppose.container, '.bl-ld-orbit-dot'));
    expect(delaysOf(chase.container, '.bl-ld-orbit-dot')[7]).toBe('840ms');
  });

  it('falls back to the first pattern for an unknown one', () => {
    const { container } = render(<Spinner animation="matrix" pattern={'nope' as never} />);
    expect(container.querySelector('[data-variant]')?.getAttribute('data-variant')).toBe('diagonal');
  });

  it('scales a 24px design to the size, clamped to 12–160', () => {
    const at = (size: number) => root(render(<Spinner animation="orbit" size={size} />).container);
    expect(at(48).style.getPropertyValue('--bl-ld-size')).toBe('48px');
    expect(at(48).style.getPropertyValue('--bl-ld-scale')).toBe('2');
    expect(at(4).style.getPropertyValue('--bl-ld-size')).toBe('12px');
    expect(at(999).style.getPropertyValue('--bl-ld-size')).toBe('160px');
    expect(at(Number.NaN).style.getPropertyValue('--bl-ld-size')).toBe('32px');
  });

  it('clamps speed to 0.25–3', () => {
    const speed = (n: number) => root(render(<Spinner animation="lift" speed={n} />).container).style.getPropertyValue('--bl-ld-speed');
    expect(speed(1.5)).toBe('1.5');
    expect(speed(0)).toBe('0.25');
    expect(speed(10)).toBe('3');
  });

  it('marks itself paused when asked', () => {
    expect(root(render(<Spinner animation="scan" paused />).container).hasAttribute('data-paused')).toBe(true);
    expect(root(render(<Spinner animation="scan" />).container).hasAttribute('data-paused')).toBe(false);
  });

  it('is decorative unless given a label', () => {
    const plain = root(render(<Spinner animation="merge" />).container);
    expect(plain.getAttribute('aria-hidden')).toBe('true');
    expect(plain.getAttribute('role')).toBeNull();
    const named = root(render(<Spinner animation="merge" label="Saving" />).container);
    expect(named.getAttribute('role')).toBe('status');
    // A live region announces its text, so the label is text inside it; status takes its name from the attribute.
    expect(named.getAttribute('aria-label')).toBe('Saving');
    expect(named.textContent).toBe('Saving');
    expect(named.querySelector('.sr-only')?.textContent).toBe('Saving');
    expect(named.querySelector('.bl-ld-stage')?.getAttribute('aria-hidden')).toBe('true');
    expect(named.getAttribute('aria-hidden')).toBeNull();
  });

  it('takes aria-label as its name, as label', () => {
    const named = root(render(<Spinner animation="merge" aria-label="Syncing" />).container);
    expect(named.getAttribute('role')).toBe('status');
    expect(named.getAttribute('aria-label')).toBe('Syncing');
    expect(named.querySelector('.sr-only')?.textContent).toBe('Syncing');
    expect(named.getAttribute('aria-hidden')).toBeNull();
  });

  it('passes ref and DOM props through', () => {
    let node: HTMLSpanElement | null = null;
    const el = root(render(<Spinner animation="orbit" ref={(n) => { node = n; }} id="busy" data-test="x" />).container);
    expect(node).toBe(el);
    expect(el.id).toBe('busy');
    expect(el.dataset.test).toBe('x');
  });

  it('keeps a stable ref across renders: the caller\'s callback ref is not detached and re-attached', () => {
    const calls: (HTMLSpanElement | null)[] = [];
    const ref = (n: HTMLSpanElement | null) => { calls.push(n); };
    const { rerender } = render(<Spinner ref={ref} speed={1} />);
    rerender(<Spinner ref={ref} speed={2} />);
    rerender(<Spinner ref={ref} speed={3} />);
    expect(calls.filter((n) => n === null)).toHaveLength(0);
    expect(calls).toHaveLength(1);
  });

  it('merges className and style onto the root', () => {
    const el = root(render(<Spinner animation="orbit" className="text-primary" style={{ margin: 3 }} />).container);
    expect(el.className).toContain('bl-ld');
    expect(el.className).toContain('text-primary');
    expect(el.style.margin).toBe('3px');
  });
});

describe('Spinner ios (the default)', () => {
  it('is the eight-spoke svg, turning by default', () => {
    const { container } = render(<Spinner size={30} />);
    const el = root(container);
    expect(el.style.width).toBe('30px');
    expect(el.querySelectorAll('svg rect')).toHaveLength(8);
    expect(el.getAttribute('class')).toContain('animate-[blSpin_.75s_steps(8)_infinite]');
    expect(el.getAttribute('aria-hidden')).toBe('true');
  });
  it('defaults to 22px and holds still when paused', () => {
    const el = root(render(<Spinner paused />).container);
    expect(el.style.width).toBe('22px');
    expect(el.getAttribute('class')).not.toContain('blSpin');
    expect(el.hasAttribute('data-paused')).toBe(true);
  });
  it('names itself with text when labelled', () => {
    const el = root(render(<Spinner label="Loading" />).container);
    expect(el.getAttribute('role')).toBe('status');
    expect(el.textContent).toBe('Loading');
    expect(el.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Spinner cradle', () => {
  /* In SVG a positive `rotate` is clockwise, which swings a hanging ball to the LEFT. The end balls must lift away from
     the row (left one to the left, right one to the right) so they strike the others instead of passing through them. */
  const css = readFileSync(resolve(__dirname, '../styles.css'), 'utf8');
  const angles = (name: string) => {
    const body = css.match(new RegExp(`@keyframes ${name}\\{(.*)\\}`))?.[1] ?? '';
    return [...body.matchAll(/rotate:(-?\d+)deg/g)].map((m) => Number(m[1]));
  };

  it('lifts the left ball to the left and the right ball to the right', () => {
    expect(Math.max(...angles('bl-ld-cr-l'))).toBeGreaterThan(0);
    expect(Math.min(...angles('bl-ld-cr-l'))).toBe(0);
    expect(Math.min(...angles('bl-ld-cr-r'))).toBeLessThan(0);
    expect(Math.max(...angles('bl-ld-cr-r'))).toBe(0);
  });
});
