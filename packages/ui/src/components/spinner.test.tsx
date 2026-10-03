// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Spinner, spinnerAnimations, type SpinnerAnimation, type SpinnerVariant } from '@/components/ui/spinner';

/** How many animated parts each loader has. */
const PARTS: Record<string, [selector: string, count: number | number[]]> = {
  orbit: ['.bl-ld-orbit-dot', 8],
  beacon: ['.bl-ld-beacon-indicator__bar', 5],
  matrix: ['.bl-ld-matrix-indicator__dot', 9],
  cells: ['.bl-ld-cell-indicator__cell', 4],
  register: ['.bl-ld-register-indicator__bit', 6],
  bands: ['.bl-ld-band-indicator__segment', 3],
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
  loop: ['.bl-ld-lp-run', [1, 3, 1]], // `trail` has three runners, one per variant otherwise
  relay: ['.bl-ld-rl-node', 3],
};

const root = (c: HTMLElement) => c.querySelector('[data-slot=spinner]') as HTMLElement;
const delaysOf = (c: HTMLElement, sel: string) => [...c.querySelectorAll<HTMLElement>(sel)].map((e) => e.style.getPropertyValue('--bl-ld-delay'));

describe('spinnerAnimations', () => {
  it('lists ios and the twenty loaders, three variants each', () => {
    expect(spinnerAnimations.map((a) => a.id)).toEqual([
      'ios', 'orbit', 'beacon', 'matrix', 'cells', 'register', 'bands', 'lift',
      'steps', 'cradle', 'hourglass', 'balance', 'fanout', 'battery', 'bloom', 'sonar', 'gyro', 'coalesce', 'crystal', 'loop', 'relay',
    ]);
    for (const a of spinnerAnimations.filter((x) => x.id !== 'ios')) expect(a.variants).toHaveLength(3);
    expect(spinnerAnimations[0].variants).toEqual([]);
  });
});

describe('Spinner loaders', () => {
  it.each(Object.entries(PARTS))('%s renders its parts for every variant, each with its own timing', (animation, [sel, count]) => {
    const variants = spinnerAnimations.find((a) => a.id === animation)?.variants ?? [];
    expect(variants).toHaveLength(3);
    for (const [i, variant] of variants.entries()) {
      const { container, unmount } = render(<Spinner animation={animation as SpinnerAnimation} variant={variant as SpinnerVariant} />);
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

  it('variants differ in their timing', () => {
    const chase = render(<Spinner animation="orbit" variant="chase" />);
    const oppose = render(<Spinner animation="orbit" variant="oppose" />);
    expect(delaysOf(chase.container, '.bl-ld-orbit-dot')).not.toEqual(delaysOf(oppose.container, '.bl-ld-orbit-dot'));
    expect(delaysOf(chase.container, '.bl-ld-orbit-dot')[7]).toBe('840ms');
  });

  it('falls back to the first variant for an unknown one', () => {
    const { container } = render(<Spinner animation="matrix" variant={'nope' as SpinnerVariant} />);
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
    expect(root(render(<Spinner animation="bands" paused />).container).hasAttribute('data-paused')).toBe(true);
    expect(root(render(<Spinner animation="bands" />).container).hasAttribute('data-paused')).toBe(false);
  });

  it('is decorative unless given a label', () => {
    const plain = root(render(<Spinner animation="cells" />).container);
    expect(plain.getAttribute('aria-hidden')).toBe('true');
    expect(plain.getAttribute('role')).toBeNull();
    const named = root(render(<Spinner animation="cells" label="Saving" />).container);
    expect(named.getAttribute('role')).toBe('status');
    expect(named.getAttribute('aria-label')).toBe('Saving');
    expect(named.getAttribute('aria-hidden')).toBeNull();
  });

  it('merges className and style onto the root', () => {
    const el = root(render(<Spinner animation="orbit" className="text-primary" style={{ margin: 3 }} />).container);
    expect(el.className).toContain('bl-ld');
    expect(el.className).toContain('text-primary');
    expect(el.style.margin).toBe('3px');
  });
});

describe('Spinner ios (the default)', () => {
  it('is the eight-spoke svg, unchanged', () => {
    const { container } = render(<Spinner spin size={30} />);
    const svg = root(container);
    expect(svg.tagName.toLowerCase()).toBe('svg');
    expect(svg.getAttribute('width')).toBe('30');
    expect(svg.querySelectorAll('rect')).toHaveLength(8);
    expect(svg.getAttribute('class')).toContain('animate-[blSpin_.75s_steps(8)_infinite]');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });
  it('defaults to 22px and only spins when asked', () => {
    const svg = root(render(<Spinner />).container);
    expect(svg.getAttribute('width')).toBe('22');
    expect(svg.getAttribute('class')).not.toContain('blSpin');
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
