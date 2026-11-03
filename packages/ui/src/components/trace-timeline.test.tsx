// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode, createRef, useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ListRow } from '@/components/ui/list';
import { TraceTimeline, traceTimelineVariants, type TraceTimelineHandle, type TraceTimelineProps } from '@/components/ui/trace-timeline';
import type { TraceActivity, TraceLane, TraceRange, TraceStop } from '@/lib/trace-timeline';

const RANGE: TraceRange = { start: 0, end: 3_600_000 };
const LENGTH = 600;
const STOPS: Array<TraceStop<string>> = [
  { key: 'a', time: 600_000, caption: 'First', preview: 'The first stop', tone: 'info' },
  { key: 'b', time: 1_800_000, caption: 'Second', level: 2 },
  { key: 'c', time: 3_000_000, caption: 'Third', tone: 'error' },
];

type RectInit = { width: number; height: number; left?: number; top?: number };
/** happy-dom lays nothing out, so give the timeline a size: a rail 600 px tall and 44 wide on a 390 px window's right. */
function layOut(rail: RectInit = { left: 346, top: 0, width: 44, height: LENGTH }) {
  const rect = (r: RectInit) => ({ left: r.left ?? 0, top: r.top ?? 0, right: (r.left ?? 0) + r.width, bottom: (r.top ?? 0) + r.height, width: r.width, height: r.height, x: r.left ?? 0, y: r.top ?? 0, toJSON: () => ({}) }) as DOMRect;
  const isRoot = (el: Element) => el.getAttribute('data-slot') === 'trace-timeline';
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) { return isRoot(this) ? rail.width : 390; });
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) { return isRoot(this) ? rail.height : 844; });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) { return isRoot(this) ? rect(rail) : rect({ width: 390, height: 844 }); });
}

/** Frames run when the test says so, to count what happens in one. */
function manualFrames() {
  const queue = new Map<number, FrameRequestCallback>();
  let next = 1;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { queue.set(next, cb); return next++; });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { queue.delete(id); });
  return () => {
    const callbacks = [...queue.values()];
    queue.clear();
    act(() => callbacks.forEach((cb) => cb(0)));
  };
}

const slider = () => screen.getByRole('slider');
const pointer = (type: 'pointerDown' | 'pointerMove' | 'pointerUp' | 'pointerCancel', x: number, y: number, init: Partial<PointerEventInit> = {}) =>
  fireEvent[type](slider(), { pointerId: 1, pointerType: 'mouse', button: 0, clientX: x, clientY: y, ...init });
/** A position by how far out from the rail's inner edge and how far down it. */
const atRail = (pull: number, along: number) => [346 - pull, along] as const;

function rail(props: Partial<TraceTimelineProps<string>> = {}) {
  return <TraceTimeline range={RANGE} stops={STOPS} orientation="vertical" {...props} />;
}

beforeEach(() => layOut());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('ARIA', () => {
  it('is a slider with its range, value and text, in both orientations', () => {
    const { rerender } = render(rail({ defaultValue: 1_500_000, label: 'Session' }));
    const el = slider();
    expect(el.getAttribute('aria-label')).toBe('Session');
    expect(el.getAttribute('aria-valuemin')).toBe('0');
    expect(el.getAttribute('aria-valuemax')).toBe('3600000');
    expect(el.getAttribute('aria-valuenow')).toBe('1500000');
    expect(el.getAttribute('aria-valuetext')).toBe('25:00');
    expect(el.getAttribute('aria-orientation')).toBe('vertical');
    expect(el.getAttribute('tabindex')).toBe('0');
    expect(el.getAttribute('data-slot')).toBe('trace-timeline');
    rerender(rail({ defaultValue: 1_500_000, label: 'Session', orientation: 'horizontal' }));
    expect(slider().getAttribute('aria-orientation')).toBe('horizontal');
  });

  it('says the stop in its text when the value is on one', () => {
    render(rail({ defaultValue: 600_000 }));
    expect(slider().getAttribute('aria-valuetext')).toBe('10:00, First');
  });

  it('lets a host name it its own way and hears its handlers too', () => {
    const onPointerDown = vi.fn();
    const onBlur = vi.fn();
    const onValueChange = vi.fn();
    render(rail({ 'aria-label': 'Mine', onPointerDown, onBlur, onValueChange, stops: [] }));
    expect(slider().getAttribute('aria-label')).toBe('Mine');
    pointer('pointerDown', 360, 100);
    expect(onPointerDown).toHaveBeenCalledTimes(1);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    fireEvent.blur(slider());
    expect(onBlur).toHaveBeenCalledTimes(1);
  });

  it('takes className and style last, and exports its variants', () => {
    render(rail({ className: 'extra w-[50px]', style: { zIndex: 3 } }));
    expect(slider().className).toContain('extra');
    expect(slider().className).toContain('w-[50px]');
    expect(slider().className).not.toContain('w-(--tt-width)');
    expect(slider().style.zIndex).toBe('3');
    expect(traceTimelineVariants({ orientation: 'vertical', side: 'left' })).toContain('left-0');
    expect(traceTimelineVariants({ orientation: 'vertical', side: 'right' })).toContain('right-0');
  });
});

describe('keyboard', () => {
  function setup(props: Partial<TraceTimelineProps<string>> = {}) {
    const onValueChange = vi.fn();
    const onViewChange = vi.fn();
    render(rail({ defaultValue: 1_500_000, onValueChange, onViewChange, ...props }));
    return { onValueChange, onViewChange, key: (key: string, init = {}) => fireEvent.keyDown(slider(), { key, ...init }), now: () => Number(slider().getAttribute('aria-valuenow')) };
  }
  const PIXEL = RANGE.end / LENGTH;

  it('nudges a pixel with the arrows by default, ten with shift', () => {
    const { key, now, onValueChange } = setup();
    key('ArrowDown');
    expect(now()).toBeCloseTo(1_500_000 + PIXEL, 3);
    expect(onValueChange.mock.calls[0][1]).toEqual({ phase: 'end', stop: null });
    key('ArrowUp');
    expect(now()).toBeCloseTo(1_500_000, 3);
    key('ArrowRight', { shiftKey: true });
    expect(now()).toBeCloseTo(1_500_000 + 10 * PIXEL, 3);
    key('ArrowLeft', { shiftKey: true });
    expect(now()).toBeCloseTo(1_500_000, 3);
  });

  it('nudges by `step` when given one', () => {
    const { key, now } = setup({ step: 100 });
    key('ArrowDown');
    expect(now()).toBe(1_500_100);
    key('ArrowDown', { shiftKey: true });
    expect(now()).toBe(1_501_100);
  });

  it('on a strip, up is later like any slider', () => {
    layOut({ width: 664, height: 200 });
    const { key, now } = setup({ orientation: 'horizontal', step: 100 });
    key('ArrowUp');
    expect(now()).toBe(1_500_100);
    key('ArrowDown');
    expect(now()).toBe(1_500_000);
    key('ArrowRight');
    expect(now()).toBe(1_500_100);
  });

  it('goes to the previous and next stop with PageUp and PageDown, reporting it', () => {
    const { key, now, onValueChange } = setup();
    key('PageDown');
    expect(now()).toBe(1_800_000);
    expect(onValueChange.mock.calls[0][1].stop.key).toBe('b');
    expect(onValueChange.mock.calls[0][1].phase).toBe('end');
    key('PageDown');
    expect(now()).toBe(3_000_000);
    key('PageDown');
    expect(now()).toBe(3_000_000);
    key('PageUp');
    expect(now()).toBe(1_800_000);
    key('PageUp');
    expect(now()).toBe(600_000);
    key('PageUp');
    expect(now()).toBe(600_000);
  });

  it('goes to the ends with Home and End', () => {
    const { key, now } = setup();
    key('End');
    expect(now()).toBe(3_600_000);
    key('Home');
    expect(now()).toBe(0);
  });

  it('zooms with + and -, around the playhead, and fits with 0', () => {
    const { key, onViewChange } = setup();
    key('+');
    const view = onViewChange.mock.lastCall?.[0] as TraceRange;
    expect(view.end - view.start).toBeCloseTo(1_800_000, 3);
    // The playhead was 5/12 of the way along, and it still is.
    expect((1_500_000 - view.start) / (view.end - view.start)).toBeCloseTo(1_500_000 / 3_600_000, 9);
    key('=');
    expect((onViewChange.mock.lastCall?.[0] as TraceRange).end - (onViewChange.mock.lastCall?.[0] as TraceRange).start).toBeCloseTo(900_000, 3);
    key('-');
    expect((onViewChange.mock.lastCall?.[0] as TraceRange).end - (onViewChange.mock.lastCall?.[0] as TraceRange).start).toBeCloseTo(1_800_000, 3);
    key('0');
    expect(onViewChange.mock.lastCall?.[0]).toEqual({ start: 0, end: 3_600_000 });
  });

  it('brings the view along when a key takes the playhead out of it', () => {
    const { key, onViewChange } = setup({ defaultView: { start: 0, end: 360_000 }, defaultValue: 100_000 });
    key('End');
    const view = onViewChange.mock.lastCall?.[0] as TraceRange;
    expect(view.end).toBe(3_600_000);
    expect(view.end - view.start).toBeCloseTo(360_000, 3);
  });

  it('leaves other keys and a host that handles the key alone', () => {
    const inner = vi.fn();
    const { key, now, onValueChange } = setup({ onKeyDown: (e) => { inner(e.key); if (e.key === 'Home') e.preventDefault(); } });
    key('x');
    key('Home');
    expect(inner).toHaveBeenCalledTimes(2);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(now()).toBe(1_500_000);
  });

  it('leaves combinations with Cmd and the like to the browser', () => {
    const { key, now, onViewChange } = setup();
    key('0', { metaKey: true });
    key('=', { ctrlKey: true });
    key('ArrowDown', { altKey: true });
    expect(onViewChange).not.toHaveBeenCalled();
    expect(now()).toBe(1_500_000);
  });

  it('shows the stop a key lands on in the card for a moment', () => {
    vi.useFakeTimers();
    const { key } = setup();
    key('PageDown');
    expect(document.querySelector('[data-slot=trace-timeline-card]')?.textContent).toContain('Second');
    act(() => { vi.advanceTimersByTime(1600); });
    expect(document.querySelector('[data-slot=trace-timeline-card]')).toBeNull();
  });
});

describe('controlled and uncontrolled', () => {
  it('holds its value when nobody else does, and follows `value` when somebody does', () => {
    render(rail({ defaultValue: 100 }));
    fireEvent.keyDown(slider(), { key: 'End' });
    expect(slider().getAttribute('aria-valuenow')).toBe('3600000');
    cleanup();
    const onValueChange = vi.fn();
    const { rerender } = render(rail({ value: 100, onValueChange }));
    fireEvent.keyDown(slider(), { key: 'End' });
    expect(onValueChange.mock.calls[0][0]).toBe(3_600_000);
    expect(slider().getAttribute('aria-valuenow')).toBe('100');
    rerender(rail({ value: 200, onValueChange }));
    expect(slider().getAttribute('aria-valuenow')).toBe('200');
  });

  it('clamps a value to the range', () => {
    render(rail({ value: 99_999_999 }));
    expect(slider().getAttribute('aria-valuenow')).toBe('3600000');
  });

  it('keeps the view and the value when the host swaps orientation', () => {
    function Host() {
      const [vertical, setVertical] = useState(false);
      return (
        <div>
          <button onClick={() => setVertical((v) => !v)}>swap</button>
          <TraceTimeline range={RANGE} stops={STOPS} orientation={vertical ? 'vertical' : 'horizontal'} defaultValue={1_500_000} defaultView={{ start: 1_400_000, end: 1_700_000 }} />
        </div>
      );
    }
    render(<Host />);
    const stopsNow = () => document.querySelectorAll('[data-slot=trace-timeline-stop]').length;
    expect(stopsNow()).toBe(0);
    fireEvent.click(screen.getByText('swap'));
    expect(slider().getAttribute('aria-orientation')).toBe('vertical');
    expect(slider().getAttribute('aria-valuenow')).toBe('1500000');
    // Only the stop in the view shows, so the zoom came across.
    expect(stopsNow()).toBe(0);
    fireEvent.keyDown(slider(), { key: '0' });
    expect(stopsNow()).toBe(3);
    fireEvent.click(screen.getByText('swap'));
    expect(slider().getAttribute('aria-valuenow')).toBe('1500000');
  });

  it('starts over from the whole range when a new range comes and nobody holds the view', () => {
    const onViewChange = vi.fn();
    const { rerender } = render(rail({ defaultView: { start: 0, end: 1000 }, onViewChange }));
    rerender(rail({ range: { start: 0, end: 5000 }, defaultView: { start: 0, end: 1000 }, onViewChange }));
    expect(onViewChange).toHaveBeenLastCalledWith({ start: 0, end: 5000 });
  });

  it('sees an inline view with the same numbers as the same view', () => {
    const draws: string[] = [];
    const ctx = new Proxy({}, { get: (_, key) => (key === 'measureText' ? () => ({ width: 10 }) : () => {}), set: () => true });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as null);
    const props = { lanes: [{ key: 'a', density: { times: [1] } }], onDraw: (s: { layer: string }) => draws.push(s.layer) };
    const { rerender } = render(rail({ ...props, view: { start: 0, end: 1000 } }));
    expect(draws.filter((d) => d === 'data').length).toBeGreaterThan(0);
    draws.length = 0;
    rerender(rail({ ...props, view: { start: 0, end: 1000 }, lanes: [{ key: 'a', density: { times: props.lanes[0].density.times } }] }));
    expect(draws).toEqual([]);
    rerender(rail({ ...props, view: { start: 0, end: 2000 } }));
    expect(draws).toContain('data');
  });

  it('survives an empty range and no data', () => {
    render(<TraceTimeline range={{ start: 5, end: 5 }} orientation="vertical" />);
    for (const key of ['ArrowDown', 'PageDown', 'End', '+', '0']) fireEvent.keyDown(slider(), { key });
    pointer('pointerDown', 360, 100);
    pointer('pointerUp', 360, 100);
    expect(slider().getAttribute('aria-valuenow')).toBe('5');
  });

  it('survives strict mode', () => {
    render(<StrictMode>{rail({ defaultValue: 5 })}</StrictMode>);
    expect(slider().getAttribute('aria-valuenow')).toBe('5');
  });
});

describe('the rail', () => {
  it('sits on its edge with insets, and draws one dash per stop', () => {
    render(rail({ top: 8, bottom: '2rem', side: 'left' }));
    expect(slider().style.getPropertyValue('--tt-top')).toBe('8px');
    expect(slider().style.getPropertyValue('--tt-bottom')).toBe('2rem');
    expect(slider().className).toContain('left-0');
    const dashes = [...document.querySelectorAll<HTMLElement>('[data-slot=trace-timeline-stop]')];
    expect(dashes).toHaveLength(3);
    expect(dashes.map((d) => d.getAttribute('data-tone'))).toEqual(['info', 'default', 'error']);
    expect(dashes[0].style.getPropertyValue('--y')).toBe('99px');
    expect(dashes[1].style.getPropertyValue('--len')).toBe('6px');
    expect(dashes[0].style.getPropertyValue('--len')).toBe('9px');
  });

  it('draws at most one dash per 10 px, however many stops there are', () => {
    const many: Array<TraceStop<string>> = Array.from({ length: 5000 }, (_, i) => ({ key: `s${i}`, time: (i / 5000) * RANGE.end, level: 1 + (i % 3) }));
    render(rail({ stops: many }));
    const dashes = document.querySelectorAll('[data-slot=trace-timeline-stop]');
    expect(dashes.length).toBeLessThanOrEqual(LENGTH / 10 + 1);
    const total = [...dashes].reduce((n, d) => n + Number(d.getAttribute('data-count')), 0);
    expect(total).toBe(5000);
  });

  it('swells dashes around the pointer as it hovers, and shows the card', () => {
    const frame = manualFrames();
    render(rail());
    const [x] = atRail(-10, 0);
    pointer('pointerMove', x, 100);
    frame();
    const [first, second] = [...document.querySelectorAll<HTMLElement>('[data-slot=trace-timeline-stop]')];
    // On a stop: it's full length.
    expect(first.style.getPropertyValue('--len')).toBe('28px');
    expect(second.style.getPropertyValue('--len')).toBe('6px');
    const card = document.querySelector('[data-slot=trace-timeline-card]');
    expect(card?.textContent).toContain('First');
    expect(card?.textContent).toContain('The first stop');
    expect(card?.textContent).toContain('10:00');
    fireEvent.pointerLeave(slider());
    expect(document.querySelector('[data-slot=trace-timeline-card]')).toBeNull();
    // Off a stop: it says the time, and the dash nearest swells by how close it is.
    pointer('pointerMove', x, 80);
    frame();
    expect(document.querySelector('[data-slot=trace-timeline-card]')?.textContent).toBe('8:00');
    expect(Number.parseFloat(first.style.getPropertyValue('--len'))).toBeGreaterThan(9);
    expect(Number.parseFloat(first.style.getPropertyValue('--len'))).toBeLessThan(28);
  });

  it('names the lane of the column under the pointer', () => {
    const frame = manualFrames();
    render(rail({ stops: [], lanes: [{ key: 'a', title: 'Browser', density: { times: [1] } }] }));
    // A column runs along the rail's outer edge.
    pointer('pointerMove', 390 - 5, 100);
    frame();
    expect(document.querySelector('[data-slot=trace-timeline-card]')?.textContent).toContain('Browser');
    pointer('pointerMove', 390 - 30, 100);
    frame();
    expect(document.querySelector('[data-slot=trace-timeline-card]')?.textContent).not.toContain('Browser');
  });

  it('never hovers for touch', () => {
    const frame = manualFrames();
    render(rail());
    pointer('pointerMove', 360, 100, { pointerType: 'touch' });
    frame();
    expect(document.querySelector('[data-slot=trace-timeline-card]')).toBeNull();
  });

  it('gives the card a slot for a thumbnail of the moment', () => {
    const frame = manualFrames();
    const renderPreview = vi.fn((time: number, stop: TraceStop<string> | null) => <img alt={stop?.caption ?? String(time)} />);
    render(rail({ renderPreview }));
    pointer('pointerMove', 360, 100);
    frame();
    expect(screen.getByAltText('First')).toBeTruthy();
    expect(renderPreview.mock.lastCall?.[0]).toBeCloseTo(600_000, 3);
    pointer('pointerMove', 360, 80);
    frame();
    expect(screen.getByAltText('480000')).toBeTruthy();
  });

  it('publishes how far rows run under it, with the same meaning as IndexBar, and cleans up', () => {
    const { rerender, container } = render(<div>{rail()}</div>);
    const host = container.firstChild as HTMLElement;
    expect(host.style.getPropertyValue('--bl-index-bar-inset')).toBe('44px');
    rerender(<div>{rail({ side: 'left' })}</div>);
    expect(host.style.getPropertyValue('--bl-index-bar-inset')).toBe('');
    rerender(<div>{rail({ insetContent: false })}</div>);
    expect(host.style.getPropertyValue('--bl-index-bar-inset')).toBe('');
    rerender(<div>{rail({ orientation: 'horizontal' })}</div>);
    expect(host.style.getPropertyValue('--bl-index-bar-inset')).toBe('');
    rerender(<div><ListRow title="Row" />{rail()}</div>);
    expect(host.style.getPropertyValue('--bl-index-bar-inset')).toMatch(/^\d+px$/);
  });
});

describe('scrubbing', () => {
  const PIXEL = RANGE.end / LENGTH;

  it('jumps on the press, reports moves at most once a frame, and ends on release', () => {
    const frame = manualFrames();
    const onValueChange = vi.fn();
    render(rail({ stops: [], onValueChange, defaultValue: 0 }));
    pointer('pointerDown', 360, 200);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.lastCall?.[0]).toBeCloseTo(200 * PIXEL, 3);
    expect(onValueChange.mock.lastCall?.[1]).toEqual({ phase: 'start', stop: null });
    // Many events in one frame: one report.
    for (let y = 201; y < 260; y++) pointer('pointerMove', 360, y);
    expect(onValueChange).toHaveBeenCalledTimes(1);
    frame();
    expect(onValueChange).toHaveBeenCalledTimes(2);
    expect(onValueChange.mock.lastCall?.[0]).toBeCloseTo(259 * PIXEL, 3);
    expect(onValueChange.mock.lastCall?.[1].phase).toBe('move');
    // A frame with nothing new: no report.
    frame();
    expect(onValueChange).toHaveBeenCalledTimes(2);
    pointer('pointerMove', 360, 300);
    pointer('pointerUp', 360, 310);
    expect(onValueChange).toHaveBeenCalledTimes(3);
    expect(onValueChange.mock.lastCall?.[0]).toBeCloseTo(310 * PIXEL, 3);
    expect(onValueChange.mock.lastCall?.[1].phase).toBe('end');
    frame();
    expect(onValueChange).toHaveBeenCalledTimes(3);
  });

  it('snaps softly to a stop within about 6 px, and reports the stop', () => {
    const frame = manualFrames();
    const onValueChange = vi.fn();
    render(rail({ onValueChange }));
    pointer('pointerDown', 360, 96);
    expect(onValueChange.mock.lastCall?.[0]).toBe(600_000);
    expect(onValueChange.mock.lastCall?.[1].stop.key).toBe('a');
    pointer('pointerMove', 360, 110);
    frame();
    expect(onValueChange.mock.lastCall?.[0]).toBeCloseTo(110 * PIXEL, 3);
    expect(onValueChange.mock.lastCall?.[1].stop).toBeNull();
    pointer('pointerUp', 360, 110);
  });

  it('slows as the pointer pulls away, without moving the playhead when the speed changes, and says the speed', () => {
    const frame = manualFrames();
    const onValueChange = vi.fn();
    render(rail({ stops: [], onValueChange }));
    pointer('pointerDown', 360, 200);
    const start = onValueChange.mock.lastCall?.[0] as number;
    const speedText = () => document.querySelector('[data-slot=trace-timeline-speed]')?.textContent;
    frame();
    expect(speedText()).toContain('Full speed');
    const steps: Array<[number, string, number]> = [[60, 'Quarter speed', 1 / 4], [160, 'Sixteenth speed', 1 / 16], [260, 'Fine, 1/64 speed', 1 / 64]];
    let along = 200;
    let last = start;
    for (const [pull, words, gain] of steps) {
      pointer('pointerMove', ...atRail(pull, along));
      frame();
      // Pulling out moved nothing.
      expect(Number(slider().getAttribute('aria-valuenow'))).toBeCloseTo(last, 6);
      expect(speedText()).toContain(words);
      expect(document.querySelector('[data-slot=trace-timeline-card]')?.getAttribute('data-speed')).toBeTruthy();
      along += 64;
      pointer('pointerMove', ...atRail(pull, along));
      frame();
      const now = Number(slider().getAttribute('aria-valuenow'));
      expect(now - last).toBeCloseTo(64 * gain * PIXEL, 3);
      last = now;
    }
    pointer('pointerUp', ...atRail(260, along));
    expect(document.querySelector('[data-slot=trace-timeline-card]')).toBeNull();
  });

  it('brings the view along when the scrub goes past its edge', () => {
    const frame = manualFrames();
    const onViewChange = vi.fn();
    render(rail({ stops: [], defaultView: { start: 0, end: 600_000 }, onViewChange }));
    pointer('pointerDown', 360, 590);
    pointer('pointerMove', 360, 640);
    frame();
    const view = onViewChange.mock.lastCall?.[0] as TraceRange;
    expect(view.end - view.start).toBeCloseTo(600_000, 3);
    expect(view.end).toBeCloseTo(640 * 1000, 3);
    expect(Number(slider().getAttribute('aria-valuenow'))).toBeCloseTo(640 * 1000, 3);
    pointer('pointerUp', 360, 640);
  });

  it('measures the move after a zoom at the new zoom, without a jump', () => {
    const frame = manualFrames();
    const onValueChange = vi.fn();
    render(rail({ stops: [], onValueChange }));
    pointer('pointerDown', 360, 300);
    frame();
    const at = Number(slider().getAttribute('aria-valuenow'));
    // Ctrl and wheel while still pressed: twice as close, and the playhead stays.
    const wheelEvent = Object.assign(new Event('wheel', { bubbles: true, cancelable: true }), { deltaX: 0, deltaY: Math.log(0.5) * 100, deltaMode: 0, clientX: 360, clientY: 300, ctrlKey: true, metaKey: false, shiftKey: false });
    act(() => { slider().dispatchEvent(wheelEvent); });
    frame();
    expect(Number(slider().getAttribute('aria-valuenow'))).toBe(at);
    pointer('pointerMove', 360, 310);
    frame();
    // At full zoom out 10 px is 60 s, but the view is now about 60% of the hour (one notch caps at e^-0.5).
    const moved = Number(slider().getAttribute('aria-valuenow')) - at;
    expect(moved).toBeCloseTo(10 * PIXEL * Math.exp(-0.5), 0);
    pointer('pointerUp', 360, 310);
  });

  it('stays on the stop it snapped to through a zoom, instead of letting go at the new scale', () => {
    const frame = manualFrames();
    const onValueChange = vi.fn();
    render(rail({ onValueChange }));
    // 5 px past the stop at 100 px: snapped.
    pointer('pointerDown', 360, 105);
    expect(onValueChange.mock.lastCall?.[0]).toBe(600_000);
    // Zoomed in around the pointer, those 5 px would be more than the snap's reach.
    for (let i = 0; i < 4; i++) {
      const event = Object.assign(new Event('wheel', { bubbles: true, cancelable: true }), { deltaX: 0, deltaY: -50, deltaMode: 0, clientX: 360, clientY: 105, ctrlKey: true, metaKey: false, shiftKey: false });
      act(() => { slider().dispatchEvent(event); });
    }
    frame();
    // A sliver of a move: still on the stop.
    pointer('pointerMove', 360, 106);
    frame();
    expect(Number(slider().getAttribute('aria-valuenow'))).toBe(600_000);
    pointer('pointerUp', 360, 106);
  });

  it('ignores buttons other than the main one', () => {
    const onValueChange = vi.fn();
    render(rail({ onValueChange }));
    pointer('pointerDown', 360, 200, { button: 2 });
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('ends on a cancel, at the last position', () => {
    const onValueChange = vi.fn();
    render(rail({ stops: [], onValueChange }));
    pointer('pointerDown', 360, 200);
    pointer('pointerCancel', 360, 400);
    expect(onValueChange.mock.lastCall?.[1].phase).toBe('end');
    expect(onValueChange.mock.lastCall?.[0]).toBeCloseTo(200 * PIXEL, 3);
    // A lost capture after that changes nothing.
    fireEvent.lostPointerCapture(slider(), { pointerId: 1 });
    expect(onValueChange).toHaveBeenCalledTimes(2);
  });
});

describe('pinch, wheel and double press', () => {
  const touch = (type: 'pointerDown' | 'pointerMove' | 'pointerUp', id: number, y: number) =>
    fireEvent[type](slider(), { pointerId: id, pointerType: 'touch', clientX: 360, clientY: y });
  const span = (fn: ReturnType<typeof vi.fn>) => {
    const v = fn.mock.lastCall?.[0] as TraceRange;
    return v.end - v.start;
  };

  it('treats two active pointers as a pinch, taking back the first finger\'s jump', () => {
    const frame = manualFrames();
    const onValueChange = vi.fn();
    const onViewChange = vi.fn();
    render(rail({ stops: [], value: 1_000_000, onValueChange, onViewChange }));
    touch('pointerDown', 1, 250);
    expect(onValueChange.mock.lastCall?.[1].phase).toBe('start');
    touch('pointerDown', 2, 350);
    expect(onValueChange.mock.lastCall?.[0]).toBe(1_000_000);
    expect(onValueChange.mock.lastCall?.[1]).toEqual({ phase: 'end', stop: null });
    const calls = onValueChange.mock.calls.length;
    // Spread to twice the separation, around the same midpoint: half the span, and what was there stays there.
    touch('pointerMove', 1, 200);
    touch('pointerMove', 2, 400);
    frame();
    expect(span(onViewChange)).toBeCloseTo(1_800_000, 3);
    const view = onViewChange.mock.lastCall?.[0] as TraceRange;
    expect(view.start + (300 / 600) * (view.end - view.start)).toBeCloseTo(1_800_000, 3);
    // One finger lifts: the other doesn't start scrubbing.
    touch('pointerUp', 1, 200);
    touch('pointerMove', 2, 300);
    frame();
    touch('pointerUp', 2, 300);
    expect(onValueChange.mock.calls.length).toBe(calls);
  });

  // happy-dom's WheelEvent leaves out the modifiers and coordinates.
  const wheel = (init: WheelEventInit) => {
    const event = Object.assign(new Event('wheel', { bubbles: true, cancelable: true }), { deltaX: 0, deltaY: 0, deltaMode: 0, clientX: 360, clientY: 300, ctrlKey: false, metaKey: false, shiftKey: false, ...init });
    act(() => { slider().dispatchEvent(event); });
    return event;
  };

  it('zooms with ctrl and wheel (a trackpad pinch) around the pointer', () => {
    const onViewChange = vi.fn();
    render(rail({ onViewChange }));
    const event = wheel({ deltaY: -30, ctrlKey: true });
    expect(event.defaultPrevented).toBe(true);
    const view = onViewChange.mock.lastCall?.[0] as TraceRange;
    expect(view.end - view.start).toBeCloseTo(3_600_000 * Math.exp(-0.3), 0);
    expect(view.start + 0.5 * (view.end - view.start)).toBeCloseTo(1_800_000, 3);
  });

  it('pans with a plain wheel when zoomed, and leaves the wheel alone when not', () => {
    const onViewChange = vi.fn();
    render(rail({ onViewChange }));
    const ignored = wheel({ deltaY: 100 });
    expect(ignored.defaultPrevented).toBe(false);
    expect(onViewChange).not.toHaveBeenCalled();
    cleanup();
    render(rail({ onViewChange, defaultView: { start: 600_000, end: 1_200_000 } }));
    const panned = wheel({ deltaY: 60 });
    expect(panned.defaultPrevented).toBe(true);
    const view = onViewChange.mock.lastCall?.[0] as TraceRange;
    expect(view.end - view.start).toBeCloseTo(600_000, 3);
    expect(view.start).toBeCloseTo(600_000 + 60_000, 3);
  });

  it('on a strip, zooms with a plain wheel and pans with shift or a sideways wheel', () => {
    layOut({ width: 664, height: 200 });
    const onViewChange = vi.fn();
    render(rail({ orientation: 'horizontal', onViewChange, defaultView: { start: 600_000, end: 1_200_000 } }));
    wheel({ deltaY: -100, clientX: 364, clientY: 100 });
    const zoomed = onViewChange.mock.lastCall?.[0] as TraceRange;
    expect(zoomed.end - zoomed.start).toBeCloseTo(600_000 * Math.exp(-0.2), 0);
    expect(zoomed.start + 0.5 * (zoomed.end - zoomed.start)).toBeCloseTo(900_000, 3);
    const before = zoomed.start;
    wheel({ deltaX: 60, clientX: 364, clientY: 100 });
    expect((onViewChange.mock.lastCall?.[0] as TraceRange).start).toBeGreaterThan(before);
    const next = (onViewChange.mock.lastCall?.[0] as TraceRange).start;
    wheel({ deltaY: 60, shiftKey: true, clientX: 364, clientY: 100 });
    expect((onViewChange.mock.lastCall?.[0] as TraceRange).start).toBeGreaterThan(next);
  });

  it('resets the zoom on a double press on the rail, and leaves it on a strip', () => {
    const onViewChange = vi.fn();
    render(rail({ onViewChange, defaultView: { start: 600_000, end: 1_200_000 }, stops: [] }));
    pointer('pointerDown', 360, 300, { timeStamp: 1000 } as PointerEventInit);
    pointer('pointerUp', 360, 300);
    pointer('pointerDown', 360, 301);
    pointer('pointerUp', 360, 301);
    expect(onViewChange).toHaveBeenLastCalledWith({ start: 0, end: 3_600_000 });
    cleanup();
    layOut({ width: 664, height: 200 });
    const stripView = vi.fn();
    render(rail({ orientation: 'horizontal', onViewChange: stripView, defaultView: { start: 600_000, end: 1_200_000 }, stops: [] }));
    pointer('pointerDown', 300, 100);
    pointer('pointerUp', 300, 100);
    pointer('pointerDown', 300, 100);
    pointer('pointerUp', 300, 100);
    expect(stripView).not.toHaveBeenCalled();
  });

  it('does not take a drag for half a double press', () => {
    const onViewChange = vi.fn();
    render(rail({ onViewChange, defaultView: { start: 600_000, end: 1_200_000 }, stops: [] }));
    pointer('pointerDown', 360, 300);
    pointer('pointerMove', 360, 340);
    pointer('pointerUp', 360, 340);
    pointer('pointerDown', 360, 340);
    pointer('pointerUp', 360, 340);
    expect(onViewChange).not.toHaveBeenCalled();
  });
});

describe('the strip', () => {
  const lanes: TraceLane[] = [
    { key: 'a', title: 'A', density: { label: 'JS', times: new Float64Array([1000, 2000]) }, threads: [{ id: 1, label: 'T1' }, { id: 2, label: 'T2' }] },
    { key: 'b', title: 'B', density: { label: 'JS', times: new Float64Array([3000]) }, threads: [{ id: 1, label: 'T1' }] },
  ];
  // 22 ruler; lane a: 16 title, 26 density, 2 gap, then threads; lane b's title follows them.
  const rowsAt = { titleA: 30, threadOneA: 70, titleB: 100, request: 165 };

  beforeEach(() => layOut({ width: 664, height: 180 }));

  it('seeks on a press and drag in the plot, and only picks rows in the gutter', () => {
    const onValueChange = vi.fn();
    const onSelectThread = vi.fn();
    render(rail({ orientation: 'horizontal', lanes, stops: [], onValueChange, onSelectThread, focusedLane: 'a' }));
    pointer('pointerDown', 10, rowsAt.threadOneA);
    expect(onSelectThread).toHaveBeenCalledWith(1, 'a');
    expect(onValueChange).not.toHaveBeenCalled();
    pointer('pointerUp', 10, rowsAt.threadOneA);
    pointer('pointerDown', 64 + 300, rowsAt.threadOneA);
    expect(onValueChange.mock.lastCall?.[0]).toBeCloseTo(1_800_000, 3);
    pointer('pointerUp', 64 + 300, rowsAt.threadOneA);
  });

  it('focuses a lane when one of its rows is pressed', () => {
    const onFocusLane = vi.fn();
    render(rail({ orientation: 'horizontal', lanes, stops: [], onFocusLane, focusedLane: 'a' }));
    pointer('pointerDown', 200, rowsAt.titleA);
    pointer('pointerUp', 200, rowsAt.titleA);
    expect(onFocusLane).not.toHaveBeenCalled();
    pointer('pointerDown', 200, rowsAt.titleB);
    pointer('pointerUp', 200, rowsAt.titleB);
    expect(onFocusLane).toHaveBeenCalledWith('b');
  });

  it('selects a request near a press in its row', () => {
    const onSelectRequest = vi.fn();
    render(rail({ orientation: 'horizontal', lanes, stops: [], requests: [{ id: 'r', time: 1_800_000, from: 1_900_000, to: 2_000_000 }], onSelectRequest }));
    pointer('pointerDown', 64 + 300 + 5, rowsAt.request);
    pointer('pointerUp', 64 + 300 + 5, rowsAt.request);
    expect(onSelectRequest).toHaveBeenCalledWith('r');
    onSelectRequest.mockClear();
    pointer('pointerDown', 64 + 100, rowsAt.request);
    pointer('pointerUp', 64 + 100, rowsAt.request);
    expect(onSelectRequest).not.toHaveBeenCalled();
  });

  it('snaps to a stop only in the stops row, and shows its card there', () => {
    const frame = manualFrames();
    const onValueChange = vi.fn();
    render(rail({ orientation: 'horizontal', onValueChange }));
    const tick = 64 + 100;
    // 22 px of ruler, then the stops row. Elsewhere on the strip a press near a stop lands where it lands.
    pointer('pointerDown', tick + 3, 28);
    expect(onValueChange.mock.lastCall?.[0]).toBe(600_000);
    expect(onValueChange.mock.lastCall?.[1].stop.key).toBe('a');
    pointer('pointerUp', tick + 3, 28);
    pointer('pointerDown', tick + 3, 120);
    expect(onValueChange.mock.lastCall?.[0]).toBeCloseTo(103 * (RANGE.end / LENGTH), 3);
    expect(onValueChange.mock.lastCall?.[1].stop).toBeNull();
    pointer('pointerUp', tick + 3, 120);
    pointer('pointerMove', tick + 1, 28);
    frame();
    expect(document.querySelector('[data-slot=trace-timeline-card]')?.textContent).toContain('First');
    pointer('pointerMove', tick + 1, 120);
    frame();
    expect(document.querySelector('[data-slot=trace-timeline-card]')).toBeNull();
  });

  it('has no slow-scrub tiers: dragging off a strip keeps full speed, and no card without a reason for one', () => {
    const frame = manualFrames();
    const onValueChange = vi.fn();
    render(rail({ orientation: 'horizontal', stops: [], onValueChange }));
    pointer('pointerDown', 164, 100);
    pointer('pointerMove', 264, 500);
    frame();
    expect(onValueChange.mock.lastCall?.[0]).toBeCloseTo(((264 - 64) / 600) * RANGE.end, 3);
    expect(document.querySelector('[data-slot=trace-timeline-card]')).toBeNull();
    pointer('pointerUp', 264, 500);
  });
});

describe('activity', () => {
  const lanes: TraceLane[] = [
    { key: 'a', offset: 1000, threads: [{ id: 1 }] },
    { key: 'b', threads: [{ id: 2 }] },
  ];
  const answer = (id: number, n = 1): TraceActivity[] => [{ id, counts: new Array(n).fill(1) }];

  beforeEach(() => {
    vi.useFakeTimers();
    layOut({ width: 664, height: 200 });
  });
  const flush = async (ms: number) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };

  it('fetches per lane once the view settles, with edges in the lane\'s own time', async () => {
    const fetchActivity = vi.fn(async (_key: string, edges: Float64Array, _signal: AbortSignal) => answer(edges.length));
    render(rail({ orientation: 'horizontal', lanes, stops: [], fetchActivity }));
    expect(fetchActivity).not.toHaveBeenCalled();
    await flush(59);
    expect(fetchActivity).not.toHaveBeenCalled();
    await flush(2);
    expect(fetchActivity).toHaveBeenCalledTimes(2);
    const [[keyA, edgesA], [keyB, edgesB]] = fetchActivity.mock.calls;
    expect(keyA).toBe('a');
    expect(keyB).toBe('b');
    expect(edgesA.length).toBe(301);
    expect(edgesB[0]).toBe(0);
    expect(edgesA[0]).toBe(-1000);
    expect(edgesB[300]).toBe(3_600_000);
    expect(edgesA[300]).toBe(3_599_000);
  });

  it('debounces as the view moves, asking only for where it stopped', async () => {
    const fetchActivity = vi.fn(async () => answer(1));
    render(rail({ orientation: 'horizontal', lanes: [lanes[1]], stops: [], fetchActivity, activityDebounce: 60 }));
    await flush(61);
    fetchActivity.mockClear();
    for (let i = 1; i <= 5; i++) {
      fireEvent.keyDown(slider(), { key: '+' });
      await flush(20);
    }
    expect(fetchActivity).not.toHaveBeenCalled();
    await flush(41);
    expect(fetchActivity).toHaveBeenCalledTimes(1);
  });

  it('drops stale answers and aborts what it no longer wants', async () => {
    const resolvers: Array<(a: TraceActivity[]) => void> = [];
    const signals: AbortSignal[] = [];
    const fetchActivity = vi.fn((_key: string, _edges: Float64Array, signal: AbortSignal) => new Promise<TraceActivity[]>((resolve) => { resolvers.push(resolve); signals.push(signal); }));
    // A canvas that takes anything, so redraws happen and can be counted.
    const ctx = new Proxy({}, { get: (_, key) => (key === 'measureText' ? () => ({ width: 10 }) : () => {}), set: () => true });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as null);
    const rows: string[] = [];
    render(rail({ orientation: 'horizontal', lanes: [lanes[1]], stops: [], fetchActivity, onDraw: (s) => rows.push(s.layer) }));
    await flush(61);
    expect(fetchActivity).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(slider(), { key: '+' });
    await flush(61);
    expect(fetchActivity).toHaveBeenCalledTimes(2);
    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
    rows.length = 0;
    // The slow first answer arrives after the second was asked for: nothing is drawn.
    await act(async () => { resolvers[0](answer(2)); await vi.advanceTimersByTimeAsync(0); });
    expect(rows).toEqual([]);
    // The answer to the current question is.
    await act(async () => { resolvers[1](answer(2)); await vi.advanceTimersByTimeAsync(0); });
    expect(rows).toEqual(['data']);
  });

  it('does not refetch because a host re-rendered with new functions and a rebuilt lane list', async () => {
    const fetchActivity = vi.fn(async () => answer(1));
    const { rerender } = render(rail({ orientation: 'horizontal', lanes: [{ ...lanes[1] }], stops: [], fetchActivity: () => fetchActivity() }));
    await flush(61);
    expect(fetchActivity).toHaveBeenCalledTimes(1);
    rerender(rail({ orientation: 'horizontal', lanes: [{ ...lanes[1], threads: [{ id: 2 }] }], stops: [], fetchActivity: () => fetchActivity() }));
    await flush(100);
    expect(fetchActivity).toHaveBeenCalledTimes(1);
  });

  it('keeps going when a lane\'s fetch fails', async () => {
    const fetchActivity = vi.fn(async () => { throw new Error('gone'); });
    render(rail({ orientation: 'horizontal', lanes: [lanes[1]], stops: [], fetchActivity }));
    await flush(61);
    expect(fetchActivity).toHaveBeenCalledTimes(1);
  });

  it('asks a rail only about lanes it has no density for', async () => {
    layOut();
    const fetchActivity = vi.fn(async () => answer(1));
    render(rail({ lanes: [{ key: 'with', density: { times: [1] }, threads: [{ id: 1 }] }, { key: 'without', threads: [{ id: 1 }] }], fetchActivity }));
    await flush(61);
    expect(fetchActivity).toHaveBeenCalledTimes(1);
    expect((fetchActivity.mock.calls[0] as unknown as [string])[0]).toBe('without');
  });
});

describe('the handle', () => {
  it('fits, sets the view, gives the time at each pixel, and redraws', () => {
    const ref = createRef<TraceTimelineHandle>();
    const onViewChange = vi.fn();
    render(rail({ ref, onViewChange, defaultView: { start: 0, end: 600_000 } }));
    const handle = ref.current as TraceTimelineHandle;
    const times = handle.pixelTimes();
    expect(times).toHaveLength(LENGTH);
    expect(times[300]).toBeCloseTo(300_000, 3);
    act(() => handle.fit());
    expect(onViewChange).toHaveBeenLastCalledWith({ start: 0, end: 3_600_000 });
    act(() => handle.setView({ start: 1000, end: 2000 }));
    expect(onViewChange).toHaveBeenLastCalledWith({ start: 1000, end: 2000 });
    expect(() => handle.redraw()).not.toThrow();
    handle.focus();
    expect(document.activeElement).toBe(slider());
  });
});
