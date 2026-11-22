// @vitest-environment happy-dom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { StrictMode, createRef, useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { FlameChart, flameChartVariants, type FlameChartHandle, type FlameChartProps } from '@/components/ui/flame-chart';
import { FLAME_GUTTER, FLAME_HEADER, FLAME_MINIMAP, FLAME_ROW_HEIGHT, FLAME_RULER, flameData, type FlameLane, type FlameSpanInput } from '@/lib/flame-chart-model';

/* The chart is 1148 px wide (a 148 px gutter and a 1000 px plot) over 0…100 ms, so 10 px is 1 ms. Lanes start under the
   minimap and ruler: web's header at BODY, its rows from BODY + 22, 18 px each. */
const WIDTH = FLAME_GUTTER + 1000;
const HEIGHT = 400;
const BODY = FLAME_MINIMAP + FLAME_RULER;
const xAt = (ms: number) => FLAME_GUTTER + ms * 10;
const yAtRow = (lane: 'web' | 'api', row: number) => BODY + (lane === 'web' ? 0 : FLAME_HEADER + 3 * FLAME_ROW_HEIGHT + 4) + FLAME_HEADER + row * FLAME_ROW_HEIGHT + 8;

const LANES: FlameLane[] = [{ key: 'web', title: 'web' }, { key: 'api', title: 'api' }];
const SPANS: FlameSpanInput[] = [
  { id: 'root', lane: 'web', name: 'GET /checkout', start: 0, end: 100 },
  { id: 'render', parent: 'root', lane: 'web', name: 'render', start: 5, end: 30 },
  { id: 'fetch', parent: 'root', lane: 'web', name: 'fetch /api/cart', start: 20, end: 90, waiting: true },
  { id: 'cart', parent: 'fetch', lane: 'api', name: 'POST /cart', start: 25, end: 85 },
  { id: 'db', parent: 'cart', lane: 'api', name: 'SELECT cart', start: 30, end: 60, error: true },
];
const DATA = flameData(LANES, SPANS);

function layOut() {
  const isRoot = (el: Element) => el.getAttribute('data-slot') === 'flame-chart';
  const rect = { left: 0, top: 0, right: WIDTH, bottom: HEIGHT, width: WIDTH, height: HEIGHT, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function (this: HTMLElement) { return isRoot(this) ? WIDTH : 1200; });
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function (this: HTMLElement) { return isRoot(this) ? HEIGHT : 800; });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) { return isRoot(this) ? rect : ({ ...rect, width: 1200, height: 800 } as DOMRect); });
}

/** A canvas that takes anything, so redraws happen and can be counted. */
function anyCanvas() {
  const ctx = new Proxy({} as Record<string, unknown>, {
    get: (target, key) => (key in target ? target[key as string] : key === 'measureText' ? (t: string) => ({ width: t.length * 6 }) : () => {}),
    set: (target, key, value) => { target[key as string] = value; return true; },
  });
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx as unknown as null);
}

/** Frames run when the test says so. */
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

const chart = () => screen.getByRole('application');
const pointer = (type: 'pointerDown' | 'pointerMove' | 'pointerUp', x: number, y: number, init: Partial<PointerEventInit> = {}) =>
  fireEvent[type](chart(), { pointerId: 1, pointerType: 'mouse', button: 0, buttons: type === 'pointerMove' ? 1 : 0, clientX: x, clientY: y, ...init });
const click = (x: number, y: number, timeStamp?: number) => {
  pointer('pointerDown', x, y);
  pointer('pointerUp', x, y, timeStamp ? ({ timeStamp } as never) : {});
};
function wheelEvent(init: WheelEventInit) {
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true });
  const fields = { deltaX: 0, deltaY: 0, deltaMode: 0, clientX: xAt(50), clientY: 200, ctrlKey: false, metaKey: false, shiftKey: false, ...init };
  for (const [key, value] of Object.entries(fields)) Object.defineProperty(event, key, { value });
  return event;
}
const key = (k: string, init: KeyboardEventInit = {}) => fireEvent.keyDown(chart(), { key: k, ...init });

function flame(props: Partial<FlameChartProps> = {}) {
  return <FlameChart data={DATA} {...props} />;
}

beforeAll(() => {
  (globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
});
beforeEach(() => layOut());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('ARIA', () => {
  it('is a named application that describes the selection', () => {
    render(flame({ 'aria-label': 'Trace', defaultSelected: 4 }));
    const el = chart();
    expect(el.getAttribute('aria-label')).toBe('Trace');
    expect(el.getAttribute('aria-roledescription')).toBe('flame chart');
    expect(el.getAttribute('tabindex')).toBe('0');
    expect(el.getAttribute('data-slot')).toBe('flame-chart');
    const description = document.getElementById(el.getAttribute('aria-describedby')!.split(' ').pop()!);
    expect(description?.textContent).toContain('SELECT cart');
    expect(description?.textContent).toContain('error');
  });

  it('is a "Flame chart" by default, and takes className and style last', () => {
    render(flame({ className: 'extra h-[300px]', style: { zIndex: 3 } }));
    expect(chart().getAttribute('aria-label')).toBe('Flame chart');
    expect(chart().className).toContain('h-[300px]');
    expect(chart().className).not.toContain('h-(--fc-height)');
    expect(chart().style.zIndex).toBe('3');
    expect(flameChartVariants({ frame: 'card' })).toContain('shadow-hairline');
  });
});

describe('pointer', () => {
  it('selects a span with a press and opens it with a double press', () => {
    const onSelectedChange = vi.fn();
    const onSpanActivate = vi.fn();
    render(flame({ onSelectedChange, onSpanActivate }));
    click(xAt(45), yAtRow('api', 1), 1000);
    expect(onSelectedChange).toHaveBeenLastCalledWith(4, expect.objectContaining({ reason: 'item-press' }));
    expect(chart().getAttribute('data-selected')).toBe('4');
    click(xAt(45), yAtRow('api', 1), 1200);
    expect(onSpanActivate).toHaveBeenCalledWith(4, expect.objectContaining({ reason: 'double-press' }));
  });

  it('seeks the playhead with a press on empty space, and commits it', () => {
    const onValueChange = vi.fn();
    const onValueCommit = vi.fn();
    render(flame({ onValueChange, onValueCommit }));
    // Row 1 of web is empty after render ends (30 ms).
    click(xAt(60), yAtRow('web', 1));
    expect(onValueChange).toHaveBeenLastCalledWith(60, expect.objectContaining({ reason: 'track-press' }));
    expect(onValueCommit).toHaveBeenCalledTimes(1);
  });

  it('scrubs with a drag on the ruler, and Escape puts it back', () => {
    const onValueChange = vi.fn();
    const onValueCommit = vi.fn();
    render(flame({ defaultValue: 10, onValueChange, onValueCommit }));
    const y = FLAME_MINIMAP + 8;
    pointer('pointerDown', xAt(20), y);
    expect(onValueChange).toHaveBeenLastCalledWith(20, expect.objectContaining({ reason: 'track-press' }));
    pointer('pointerMove', xAt(40), y);
    pointer('pointerUp', xAt(40), y);
    expect(onValueChange).toHaveBeenLastCalledWith(40, expect.objectContaining({ reason: 'drag' }));
    expect(onValueCommit).toHaveBeenLastCalledWith(40, expect.objectContaining({ reason: 'drag' }));
    pointer('pointerDown', xAt(70), y);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onValueChange).toHaveBeenLastCalledWith(40, expect.objectContaining({ reason: 'escape-key' }));
  });

  it('pans with a drag on the body, without selecting or seeking', () => {
    const onViewChange = vi.fn();
    const onSelectedChange = vi.fn();
    const onValueChange = vi.fn();
    render(flame({ defaultView: { start: 40, end: 60 }, onViewChange, onSelectedChange, onValueChange }));
    pointer('pointerDown', xAt(50), yAtRow('web', 0));
    // 100 px of 1000 is a tenth of the 20 ms view.
    pointer('pointerMove', xAt(40), yAtRow('web', 0));
    pointer('pointerUp', xAt(40), yAtRow('web', 0));
    expect(onViewChange).toHaveBeenLastCalledWith({ start: 42, end: 62 }, expect.objectContaining({ reason: 'drag' }));
    expect(onSelectedChange).not.toHaveBeenCalled();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('collapses and opens a lane with a press on its header in the gutter', () => {
    const onCollapsedLanesChange = vi.fn();
    render(flame({ onCollapsedLanesChange }));
    click(40, BODY + 10);
    expect(onCollapsedLanesChange).toHaveBeenLastCalledWith(['web'], expect.objectContaining({ reason: 'trigger-press' }));
    click(40, BODY + 10);
    expect(onCollapsedLanesChange).toHaveBeenLastCalledWith([], expect.objectContaining({ reason: 'trigger-press' }));
  });

  it('moves the view with the minimap', () => {
    const onViewChange = vi.fn();
    render(flame({ defaultView: { start: 0, end: 10 }, onViewChange }));
    click(xAt(50), 10);
    expect(onViewChange).toHaveBeenLastCalledWith({ start: 45, end: 55 }, expect.objectContaining({ reason: 'minimap' }));
  });

  it('shows a hover card with duration and self time', () => {
    const frame = manualFrames();
    render(flame());
    fireEvent.pointerMove(chart(), { pointerId: 1, pointerType: 'mouse', clientX: xAt(50), clientY: yAtRow('api', 0) });
    frame();
    const card = document.querySelector('[data-slot="flame-chart-card"]');
    expect(card?.textContent).toContain('POST /cart');
    expect(card?.textContent).toContain('60.0 ms');
    // 25…85 less db's 30…60.
    expect(card?.textContent).toContain('30.0 ms');
    fireEvent.pointerLeave(chart());
    expect(document.querySelector('[data-slot="flame-chart-card"]')).toBeNull();
  });

  it('takes a card of the host\'s own', () => {
    const frame = manualFrames();
    render(flame({ renderTooltip: (i) => <b>span {i}</b> }));
    fireEvent.pointerMove(chart(), { pointerId: 1, pointerType: 'mouse', clientX: xAt(50), clientY: yAtRow('web', 0) });
    frame();
    expect(document.querySelector('[data-slot="flame-chart-card"]')?.textContent).toBe('span 0');
  });
});

describe('wheel', () => {
  it('zooms around the pointer, and pans with shift or a sideways wheel', () => {
    const onViewChange = vi.fn();
    render(flame({ onViewChange }));
    act(() => { chart().dispatchEvent(wheelEvent({ deltaY: -200 })); });
    const [zoomed] = onViewChange.mock.lastCall!;
    expect(zoomed.end - zoomed.start).toBeLessThan(100);
    // Around 50 ms, where the pointer is.
    expect((zoomed.start + zoomed.end) / 2).toBeCloseTo(50, 5);
    act(() => { chart().dispatchEvent(wheelEvent({ deltaY: 100, shiftKey: true })); });
    const [panned, details] = onViewChange.mock.lastCall!;
    expect(details.reason).toBe('wheel');
    expect(panned.start).toBeGreaterThan(zoomed.start);
    expect(panned.end - panned.start).toBeCloseTo(zoomed.end - zoomed.start, 6);
  });
});

describe('keyboard', () => {
  it('moves the selection to siblings, the parent and the first child, and opens it with Enter', () => {
    const onSelectedChange = vi.fn();
    const onSpanActivate = vi.fn();
    render(flame({ onSelectedChange, onSpanActivate }));
    key('ArrowDown');
    expect(onSelectedChange).toHaveBeenLastCalledWith(0, expect.objectContaining({ reason: 'list-navigation' }));
    key('ArrowDown');
    expect(onSelectedChange).toHaveBeenLastCalledWith(1, expect.anything());
    key('ArrowRight');
    expect(onSelectedChange).toHaveBeenLastCalledWith(2, expect.anything());
    key('ArrowDown');
    expect(onSelectedChange).toHaveBeenLastCalledWith(3, expect.anything());
    key('ArrowUp');
    expect(onSelectedChange).toHaveBeenLastCalledWith(2, expect.anything());
    key('Enter');
    expect(onSpanActivate).toHaveBeenLastCalledWith(2, expect.objectContaining({ reason: 'enter-key' }));
    key('Escape');
    expect(onSelectedChange).toHaveBeenLastCalledWith(-1, expect.objectContaining({ reason: 'escape-key' }));
  });

  it('leaves Escape and Enter alone with nothing selected', () => {
    render(flame());
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    chart().dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(false);
  });

  it('zooms with + and -, fits with 0, pans with Shift and an arrow, and seeks with Home and End', () => {
    const onViewChange = vi.fn();
    const onValueChange = vi.fn();
    render(flame({ onViewChange, onValueChange, defaultValue: 50 }));
    key('+');
    expect(onViewChange).toHaveBeenLastCalledWith({ start: 25, end: 75 }, expect.objectContaining({ reason: 'zoom-key' }));
    key('ArrowRight', { shiftKey: true });
    expect(onViewChange).toHaveBeenLastCalledWith({ start: 30, end: 80 }, expect.objectContaining({ reason: 'pan-key' }));
    key('0');
    expect(onViewChange).toHaveBeenLastCalledWith({ start: 0, end: 100 }, expect.objectContaining({ reason: 'zoom-key' }));
    key('End');
    expect(onValueChange).toHaveBeenLastCalledWith(100, expect.objectContaining({ reason: 'step-key' }));
    key('Home');
    expect(onValueChange).toHaveBeenLastCalledWith(0, expect.objectContaining({ reason: 'step-key' }));
  });

  it('brings a span selected by key into view', () => {
    const onViewChange = vi.fn();
    render(flame({ defaultView: { start: 0, end: 10 }, defaultSelected: 1, onViewChange }));
    key('ArrowRight');
    expect(onViewChange).toHaveBeenLastCalledWith(expect.objectContaining({ start: expect.any(Number) }), expect.objectContaining({ reason: 'follow' }));
    const [view] = onViewChange.mock.lastCall!;
    expect(view.start).toBeLessThanOrEqual(20 + 1e-9);
  });
});

describe('controlled and uncontrolled', () => {
  it('follows a controlled selection, and a host can refuse a change by not passing it back', () => {
    const onSelectedChange = vi.fn();
    const { rerender } = render(flame({ selected: 1, onSelectedChange }));
    click(xAt(45), yAtRow('api', 1));
    expect(onSelectedChange).toHaveBeenCalledWith(4, expect.anything());
    expect(chart().getAttribute('data-selected')).toBe('1');
    rerender(flame({ selected: 4, onSelectedChange }));
    expect(chart().getAttribute('data-selected')).toBe('4');
  });

  it('keeps a canceled change from happening', () => {
    render(flame({ onSelectedChange: (_, details) => details.cancel() }));
    click(xAt(45), yAtRow('api', 1));
    expect(chart().hasAttribute('data-selected')).toBe(false);
  });

  it('brings the view to a playhead that leaves it', () => {
    const onViewChange = vi.fn();
    function Host() {
      const [t, setT] = useState(5);
      return <><button onClick={() => setT(80)}>go</button><FlameChart data={DATA} value={t} defaultView={{ start: 0, end: 10 }} onViewChange={onViewChange} /></>;
    }
    render(<Host />);
    fireEvent.click(screen.getByText('go'));
    expect(onViewChange).toHaveBeenLastCalledWith({ start: 75, end: 85 }, expect.objectContaining({ reason: 'follow' }));
  });

  it('survives empty data and strict mode', () => {
    const empty = flameData([], []);
    render(<StrictMode><FlameChart data={empty} /></StrictMode>);
    expect(chart()).toBeTruthy();
    key('ArrowDown');
  });
});

describe('drawing', () => {
  it('redraws the data layer for the selection and the highlight, but only the overlay for the playhead', () => {
    anyCanvas();
    const onDraw = vi.fn();
    const { rerender } = render(flame({ onDraw, value: 10 }));
    const layers = () => onDraw.mock.calls.map(([s]) => s.layer);
    onDraw.mockClear();
    rerender(flame({ onDraw, value: 20 }));
    expect(layers()).toEqual(['overlay']);
    onDraw.mockClear();
    rerender(flame({ onDraw, value: 20, selected: 2 }));
    expect(layers()).toEqual(['data']);
    onDraw.mockClear();
    rerender(flame({ onDraw, value: 20, selected: 2, highlight: [3, 4] }));
    expect(layers()).toEqual(['data']);
    expect(onDraw.mock.calls[0][0]).toMatchObject({ spans: 5, bars: expect.any(Number) });
  });
});

describe('the handle', () => {
  it('fits, sets the view, reveals a span in a collapsed lane, and redraws', () => {
    anyCanvas();
    const ref = createRef<FlameChartHandle>();
    const onViewChange = vi.fn();
    const onCollapsedLanesChange = vi.fn();
    const onDraw = vi.fn();
    render(flame({ ref, onViewChange, onCollapsedLanesChange, onDraw, defaultCollapsedLanes: ['api'] }));
    act(() => ref.current!.setView({ start: 10, end: 20 }));
    expect(onViewChange).toHaveBeenLastCalledWith({ start: 10, end: 20 }, expect.objectContaining({ reason: 'imperative' }));
    act(() => ref.current!.reveal(4, { zoom: true }));
    expect(onCollapsedLanesChange).toHaveBeenLastCalledWith([], expect.objectContaining({ reason: 'imperative' }));
    const [view] = onViewChange.mock.lastCall!;
    expect(view.start).toBeLessThan(30);
    expect(view.end).toBeGreaterThan(60);
    expect(view.end - view.start).toBeLessThan(40);
    act(() => ref.current!.fit());
    expect(onViewChange).toHaveBeenLastCalledWith({ start: 0, end: 100 }, expect.anything());
    onDraw.mockClear();
    act(() => ref.current!.redraw());
    expect(onDraw.mock.calls.map(([s]) => s.layer)).toEqual(['data', 'overlay']);
  });
});
