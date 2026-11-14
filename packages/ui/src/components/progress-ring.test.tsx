// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { CountdownRing, ProgressRing, useCountdown } from '@/components/ui/progress-ring';

declare global { var __UI_SDK_STRICT__: boolean | undefined }
globalThis.__UI_SDK_STRICT__ = true;

afterEach(() => { cleanup(); vi.useRealTimers(); });

const arc = (root: Element) => root.querySelector('[data-slot="progress-ring-arc"]') as SVGCircleElement;

describe('ProgressRing', () => {
  it('is a named progressbar whose arc is as long as its value', () => {
    render(<ProgressRing aria-label="Coverage" value={25} size="lg" />);
    const ring = screen.getByRole('progressbar', { name: 'Coverage' });
    expect(ring.getAttribute('aria-valuenow')).toBe('25');
    expect(ring.getAttribute('aria-valuetext')).toBe('25%');
    const circumference = Number(arc(ring).getAttribute('stroke-dasharray'));
    expect(Number(arc(ring).getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference * 0.75);
    expect(ring.style.getPropertyValue('--ring-px')).toBe('44px');
    // No number in the middle unless asked for.
    expect(ring.querySelector('[data-slot="progress-value"]')).toBeNull();
  });

  it('shows the value in the middle, or content of your own', () => {
    const shown = render(<ProgressRing aria-label="Coverage" value={85} size="xl" showValue />);
    // The default percentage is a NumberMorph, whose rolling digits read as one number.
    expect(screen.getByRole('progressbar').querySelector('[data-slot="progress-value"] [data-slot="number-morph"] .sr-only')!.textContent).toBe('85%');
    shown.unmount();
    const custom = render(<ProgressRing aria-label="Files" value={3} max={12} size="xl" showValue format={(value) => `${value}/12`} />);
    expect(screen.getByRole('progressbar').querySelector('[data-slot="progress-value"]')!.textContent).toBe('3/12');
    custom.unmount();
    render(<ProgressRing aria-label="Downloading" value={42} size="lg"><span data-testid="stop">■</span></ProgressRing>);
    expect(screen.getByTestId('stop')).toBeTruthy();
    expect(screen.getByRole('progressbar').querySelector('[data-slot="progress-value"]')).toBeNull();
  });

  it('hides the arc at zero and spins a quarter arc while indeterminate', () => {
    const empty = render(<ProgressRing aria-label="Empty" value={0} />);
    expect(arc(empty.container).getAttribute('opacity')).toBe('0');
    empty.unmount();
    const { container } = render(<ProgressRing aria-label="Loading" size="lg" showValue />);
    const ring = screen.getByRole('progressbar');
    expect(ring.hasAttribute('aria-valuenow')).toBe(false);
    expect(ring.hasAttribute('data-indeterminate')).toBe(true);
    expect(container.querySelector('svg')!.getAttribute('class')).toContain('animate-spin');
    const circumference = Number(arc(ring).getAttribute('stroke-dasharray'));
    expect(Number(arc(ring).getAttribute('stroke-dashoffset'))).toBeCloseTo(circumference * 0.75);
    expect(ring.querySelector('[data-slot="progress-value"]')).toBeNull();
  });

  it('takes a tone, or colors of its own as variables', () => {
    render(<ProgressRing aria-label="Done" value={100} tone="success" color="teal" trackColor="gray" />);
    const ring = screen.getByRole('progressbar');
    expect(ring.className).toContain('[--ring-color:var(--color-success)]');
    expect(ring.style.getPropertyValue('--ring-color')).toBe('teal');
    expect(ring.style.getPropertyValue('--ring-track')).toBe('gray');
    expect(ring.hasAttribute('data-complete')).toBe(true);
  });
});

describe('ProgressRing sizes', () => {
  it('keeps the value out of rings too small to hold it', () => {
    const small = render(<ProgressRing aria-label="Small" value={55} showValue />);
    expect(screen.getByRole('progressbar').style.getPropertyValue('--ring-px')).toBe('28px');
    expect(screen.getByRole('progressbar').querySelector('[data-slot="progress-value"]')).toBeNull();
    small.unmount();
    render(<ProgressRing aria-label="Large" value={55} size="lg" showValue />);
    expect(screen.getByRole('progressbar').querySelector('[data-slot="progress-value"]')).not.toBeNull();
  });

  it('draws a dim full ring instead of a still quarter arc under reduced motion', () => {
    const { container } = render(<ProgressRing aria-label="Loading" />);
    expect(arc(container).getAttribute('class')).toContain('motion-reduce:[stroke-dashoffset:0]');
    expect(arc(container).getAttribute('class')).toContain('motion-reduce:opacity-35');
  });
});

describe('CountdownRing', () => {
  it('is a timer named by the seconds left, which turns urgent near the end', () => {
    const { rerender } = render(<CountdownRing remaining={12} duration={30} />);
    const ring = screen.getByRole('timer', { name: '12 seconds left' });
    expect(ring.hasAttribute('data-urgent')).toBe(false);
    rerender(<CountdownRing remaining={1} duration={30} />);
    expect(screen.getByRole('timer', { name: '1 second left' }).hasAttribute('data-urgent')).toBe(true);
  });

  it('takes urgentAt, urgentColor, a ref and DOM props', () => {
    let node: HTMLSpanElement | null = null;
    render(<CountdownRing remaining={12} urgentAt={15} urgentColor="purple" ref={(n) => { node = n; }} id="otp" />);
    const ring = screen.getByRole('timer');
    expect(node).toBe(ring);
    expect(ring.id).toBe('otp');
    expect(ring.hasAttribute('data-urgent')).toBe(true);
    expect(ring.style.getPropertyValue('--ring-urgent')).toBe('purple');
  });
});

describe('useCountdown', () => {
  it('counts whole seconds down on the wall clock, and starts over at zero', () => {
    vi.useFakeTimers();
    const onEnd = vi.fn();
    const { result } = renderHook(() => useCountdown(3, { onEnd }));
    expect(result.current.remaining).toBe(3);
    act(() => { vi.advanceTimersByTime(1000); });
    expect(result.current.remaining).toBe(2);
    act(() => { vi.advanceTimersByTime(2000); });
    expect(onEnd).toHaveBeenCalledTimes(1);
    expect(result.current.remaining).toBe(3);
    expect(result.current.period).toBe(1);
  });
});
