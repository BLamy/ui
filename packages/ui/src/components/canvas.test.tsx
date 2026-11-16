// @vitest-environment happy-dom
import { memo, useEffect, useState } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Canvas, CanvasFrame, CanvasGuides, CanvasHandles, CanvasMarquee, CanvasMiniMap, createCanvasController, useCanvas, type CanvasViewportChangeDetails, type Viewport } from '@/components/ui/canvas';

/* happy-dom has no layout: the canvas is 400 × 300 at the page's origin, the minimap 184 × 120 at (200, 160), and a
   board item reports where the view puts it. */
const W = 400, H = 300;
const rect = (x: number, y: number, w: number, h: number) => ({ x, y, left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, toJSON: () => ({}) }) as DOMRect;
const original = HTMLElement.prototype.getBoundingClientRect;
beforeAll(() => {
  (globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
  HTMLElement.prototype.getBoundingClientRect = function (this: HTMLElement) {
    const slot = this.getAttribute('data-slot');
    if (slot === 'canvas') return rect(0, 0, W, H);
    if (slot === 'canvas-minimap') return rect(200, 160, 184, 120);
    const at = this.dataset.at;
    if (at) {
      // A board item at board point `at`, 40 × 40 at 100%: on screen where the board's transform puts it.
      const [bx, by] = at.split(',').map(Number);
      const board = this.closest<HTMLElement>('[data-slot="canvas-board"]');
      const m = /translate\(([-\d.e]+)px,\s*([-\d.e]+)px\) scale\(([-\d.e]+)\)/.exec(board?.getAttribute('style') ?? '');
      const [x, y, zoom] = m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 1];
      const rest = board?.parentElement;
      const sx = rest ? rest.scrollLeft : 0, sy = rest ? rest.scrollTop : 0;
      return rect(bx * zoom + x - sx, by * zoom + y - sy, 40 * zoom, 40 * zoom);
    }
    return original.call(this);
  };
});
afterAll(() => { HTMLElement.prototype.getBoundingClientRect = original; });
afterEach(cleanup);

type Change = [Viewport, CanvasViewportChangeDetails];

function Harness({ initial = { x: 0, y: 0, zoom: 1 }, onChange, ...props }: Partial<React.ComponentProps<typeof Canvas>> & { initial?: Viewport; onChange?: (v: Viewport, d: CanvasViewportChangeDetails) => void }) {
  const [viewport, setViewport] = useState(initial);
  return (
    <Canvas
      aria-label="Board"
      viewport={viewport}
      onViewportChange={(v, d) => { onChange?.(v, d); setViewport(v); }}
      fit={{ x: 0, y: 0, w: 800, h: 600 }}
      {...props}
    >
      <button type="button" data-at="1000,1000">Far card</button>
      <Zoom />
    </Canvas>
  );
}
function Zoom() {
  const { zoom, viewport } = useCanvas();
  return <output aria-label="view">{`${Math.round(viewport.x)} ${Math.round(viewport.y)} ${Math.round(zoom * 100)}`}</output>;
}

const board = () => screen.getByRole('application', { name: 'Board' });
const view = () => screen.getByLabelText('view').textContent;
const reasons = (fn: ReturnType<typeof vi.fn>) => (fn.mock.calls as Change[]).map(([, d]) => d.reason);

describe('Canvas', () => {
  it('is a named, focusable application whose board moves with one transform', () => {
    render(<Harness initial={{ x: 20, y: 10, zoom: 2 }} />);
    const root = board();
    expect(root.getAttribute('tabindex')).toBe('0');
    expect(root.getAttribute('aria-roledescription')).toBe('canvas');
    const world = root.querySelector('[data-slot="canvas-board"]')!;
    expect(world.getAttribute('style')).toMatch(/scale\(2\)/);
    expect(world.getAttribute('style')).toMatch(/--canvas-zoom: ?2/);
    // The pane scrolls, and Chrome would make a scroller with nothing tabbable in it a tab stop of its own.
    expect(root.querySelector('[data-slot="canvas-pane"]')!.getAttribute('tabindex')).toBe('-1');
  });

  it('leaves --canvas-zoom off the board when asked, and still moves it with one transform', () => {
    const controller = createCanvasController();
    render(<Canvas aria-label="Board" controller={controller} zoomVariable={false} />);
    const world = board().querySelector('[data-slot="canvas-board"]')!;
    act(() => { controller.zoomTo(2); });
    expect(world.getAttribute('style')).toMatch(/scale\(2\)/);
    expect(world.getAttribute('style')).not.toMatch(/--canvas-zoom/);
  });

  it('zooms with + and −, and goes back to 100% with 0', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.keyDown(board(), { key: '+' });
    expect(view()).toBe('-50 -37 125');
    fireEvent.keyDown(board(), { key: '-' });
    expect(view()).toMatch(/ 100$/);
    fireEvent.keyDown(board(), { key: '+' });
    fireEvent.keyDown(board(), { key: '0' });
    expect(view()).toMatch(/ 100$/);
    expect(reasons(onChange).every((r) => r === 'zoom-key')).toBe(true);
  });

  it('says the zoom a key leaves it at, in its own words', async () => {
    render(<Harness message={(zoom) => `Board at ${Math.round(zoom * 100)} percent`} />);
    fireEvent.keyDown(board(), { key: '=', metaKey: true });
    await act(() => new Promise((r) => setTimeout(r, 200)));
    expect(document.body.textContent).toContain('Board at 125 percent');
  });

  it('fits `fit` with ⌘0 and goes to 100% with ⌘1', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.keyDown(board(), { key: '0', metaKey: true });
    // 800 × 600 in 400 × 300 with 72 px of air: zoom (300 - 144) / 600.
    expect(view()).toBe('96 72 26');
    fireEvent.keyDown(board(), { key: '1', ctrlKey: true });
    expect(view()).toMatch(/ 100$/);
    expect(reasons(onChange)).toEqual(['zoom-key', 'zoom-key']);
  });

  it('pans with arrow keys the host leaves alone, and not with ones it takes', () => {
    const onChange = vi.fn();
    const onCanvasKeyDown = vi.fn((e: KeyboardEvent) => { if (e.key === 'ArrowUp') e.preventDefault(); });
    render(<Harness onChange={onChange} onCanvasKeyDown={onCanvasKeyDown} />);
    fireEvent.keyDown(board(), { key: 'ArrowRight' });
    expect(view()).toBe('-48 0 100');
    fireEvent.keyDown(board(), { key: 'ArrowDown', shiftKey: true });
    expect(view()).toBe('-48 -192 100');
    fireEvent.keyDown(board(), { key: 'ArrowUp' });
    expect(view()).toBe('-48 -192 100');
    expect(onCanvasKeyDown).toHaveBeenCalledTimes(3);
    expect(reasons(onChange)).toEqual(['move-key', 'move-key']);
  });

  it('leaves keys typed into the board alone', () => {
    const onChange = vi.fn();
    render(
      <Canvas aria-label="Board" onViewportChange={onChange}>
        <input aria-label="Note" />
      </Canvas>,
    );
    fireEvent.keyDown(screen.getByLabelText('Note'), { key: '-' });
    fireEvent.keyDown(screen.getByLabelText('Note'), { key: ' ' });
    expect(onChange).not.toHaveBeenCalled();
    expect(board().hasAttribute('data-panning')).toBe(false);
  });

  it('hands a plain press to the host in board units, and pans with Space held instead', () => {
    const onChange = vi.fn();
    const onCanvasPointerDown = vi.fn();
    const onCanvasPointerMove = vi.fn();
    render(<Harness initial={{ x: 100, y: 50, zoom: 2 }} onChange={onChange} onCanvasPointerDown={onCanvasPointerDown} onCanvasPointerMove={onCanvasPointerMove} />);
    fireEvent.pointerDown(board(), { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 140, clientY: 90 });
    expect(onCanvasPointerDown.mock.calls[0][1].board).toEqual({ x: 20, y: 20 });
    fireEvent.pointerUp(board(), { pointerId: 1, pointerType: 'mouse', clientX: 140, clientY: 90 });

    fireEvent.keyDown(board(), { key: ' ' });
    expect(board().hasAttribute('data-panning')).toBe(true);
    // The hand wins over any resting cursor the caller set.
    expect(board().className).toContain('cursor-grab!');
    fireEvent.pointerDown(board(), { pointerId: 2, pointerType: 'mouse', button: 0, clientX: 140, clientY: 90 });
    expect(board().hasAttribute('data-grabbing')).toBe(true);
    fireEvent.pointerMove(board(), { pointerId: 2, pointerType: 'mouse', clientX: 170, clientY: 100 });
    fireEvent.pointerUp(board(), { pointerId: 2, pointerType: 'mouse', clientX: 170, clientY: 100 });
    fireEvent.keyUp(board(), { key: ' ' });
    expect(view()).toBe('130 60 200');
    expect(onCanvasPointerDown).toHaveBeenCalledTimes(1);
    expect(onCanvasPointerMove).not.toHaveBeenCalled();
    expect(reasons(onChange)).toEqual(['drag']);
    expect(board().hasAttribute('data-grabbing')).toBe(false);
    expect(board().hasAttribute('data-panning')).toBe(false);
  });

  it('drags the view with the hand tool and the middle button', () => {
    const onCanvasPointerDown = vi.fn();
    const { rerender } = render(<Harness panning onCanvasPointerDown={onCanvasPointerDown} />);
    fireEvent.pointerDown(board(), { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(board(), { pointerId: 1, pointerType: 'mouse', clientX: 30, clientY: 10 });
    fireEvent.pointerUp(board(), { pointerId: 1, pointerType: 'mouse', clientX: 30, clientY: 10 });
    expect(view()).toBe('20 0 100');
    rerender(<Harness onCanvasPointerDown={onCanvasPointerDown} />);
    fireEvent.pointerDown(board(), { pointerId: 2, pointerType: 'mouse', button: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(board(), { pointerId: 2, pointerType: 'mouse', clientX: 10, clientY: 40 });
    fireEvent.pointerUp(board(), { pointerId: 2, pointerType: 'mouse', clientX: 10, clientY: 40 });
    expect(onCanvasPointerDown).not.toHaveBeenCalled();
  });

  it('turns a second finger into a pinch, and tells the host to drop its press', () => {
    const onChange = vi.fn();
    const onNavigationStart = vi.fn();
    const onCanvasPointerDown = vi.fn();
    const onCanvasPointerMove = vi.fn();
    render(<Harness onChange={onChange} onNavigationStart={onNavigationStart} onCanvasPointerDown={onCanvasPointerDown} onCanvasPointerMove={onCanvasPointerMove} />);
    fireEvent.pointerDown(board(), { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
    expect(onCanvasPointerDown).toHaveBeenCalledTimes(1);
    fireEvent.pointerDown(board(), { pointerId: 2, pointerType: 'touch', clientX: 200, clientY: 100 });
    expect(onNavigationStart).toHaveBeenCalledTimes(1);
    fireEvent.pointerMove(board(), { pointerId: 2, pointerType: 'touch', clientX: 300, clientY: 100 });
    expect(view()).toMatch(/ 200$/);
    expect(onCanvasPointerMove).not.toHaveBeenCalled();
    expect(reasons(onChange)).toEqual(['pinch']);
    fireEvent.pointerUp(board(), { pointerId: 2, pointerType: 'touch', clientX: 300, clientY: 100 });
    fireEvent.pointerUp(board(), { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
  });

  it('pans with the wheel and zooms at the pointer with ⌘ or a trackpad pinch', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    fireEvent.wheel(board(), { deltaX: 10, deltaY: 30 });
    expect(view()).toBe('-10 -30 100');
    // happy-dom's WheelEvent drops modifier keys from its init.
    const pinch = new WheelEvent('wheel', { deltaY: -50, clientX: 0, clientY: 0, bubbles: true, cancelable: true });
    Object.defineProperty(pinch, 'ctrlKey', { value: true });
    act(() => { board().dispatchEvent(pinch); });
    expect(pinch.defaultPrevented).toBe(true);
    expect(Number(view()!.split(' ')[2])).toBeGreaterThan(100);
    expect(reasons(onChange)).toEqual(['wheel', 'wheel']);
  });

  it('is driven from outside by its controller', () => {
    const onChange = vi.fn();
    const controller = createCanvasController();
    render(<Harness onChange={onChange} controller={controller} />);
    act(() => { controller.zoomBy(2); });
    expect(view()).toBe('-200 -150 200');
    act(() => { controller.fit(); });
    expect(view()).toBe('96 72 26');
    act(() => { controller.fit(null); });
    expect(view()).toBe('200 150 100');
    act(() => { controller.panBy(10, 0, { reason: 'move-key' }); });
    expect(controller.getViewport()).toEqual({ x: 210, y: 150, zoom: 1 });
    expect(controller.toCanvas(210, 150)).toEqual({ x: 0, y: 0 });
    expect(controller.visible()).toEqual({ x: -210, y: -150, w: 400, h: 300 });
    expect(reasons(onChange)).toEqual(['imperative', 'imperative', 'imperative', 'move-key']);
  });

  it('keeps the view where it is when a change is canceled', () => {
    render(<Canvas aria-label="Board" onViewportChange={(_, d) => d.cancel()}><Zoom /></Canvas>);
    fireEvent.keyDown(board(), { key: '+' });
    expect(view()).toBe('0 0 100');
  });

  it('brings a board item that takes focus into view', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    act(() => screen.getByRole('button', { name: 'Far card' }).focus());
    const last = (onChange.mock.calls as Change[]).at(-1)!;
    expect(last[1].reason).toBe('focus-in');
    // The card (1000…1040 at 100%) ends up inside the 400 × 300 view with 24 px of air.
    expect(-last[0].x + W).toBeGreaterThanOrEqual(1040);
    expect(-last[0].y + H).toBeGreaterThanOrEqual(1040);
  });

  it('turns the browser scrolling the board to a match (find in page) into a pan', () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const pane = board().querySelector<HTMLElement>('[data-slot="canvas-pane"]')!;
    const rest = { x: pane.scrollLeft, y: pane.scrollTop };
    expect(rest.x).toBeGreaterThan(0);
    act(() => {
      pane.scrollLeft = rest.x + 300;
      pane.scrollTop = rest.y + 120;
      pane.dispatchEvent(new Event('scroll'));
    });
    const last = (onChange.mock.calls as Change[]).at(-1)!;
    expect(last[1].reason).toBe('find-in-page');
    expect(last[0]).toMatchObject({ x: -300, y: -120, zoom: 1 });
  });

  it('moves the view to a press on the minimap, follows a drag, and puts it back on Escape', async () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} overlay={<CanvasMiniMap items={[{ x: 0, y: 0, w: 800, h: 600 }]} />} />);
    const map = board().querySelector<HTMLElement>('[data-slot="canvas-minimap"]')!;
    expect(map.getAttribute('aria-hidden')).toBe('true');
    fireEvent.pointerDown(map, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 292, clientY: 220 });
    expect(reasons(onChange)).toEqual(['track-press']);
    const pressed = view();
    expect(pressed).not.toBe('0 0 100');
    fireEvent.pointerMove(document, { pointerId: 1, pointerType: 'mouse', buttons: 1, clientX: 320, clientY: 240 });
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(reasons(onChange)).toContain('drag');
    expect(view()).not.toBe(pressed);
    fireEvent.keyDown(document, { key: 'Escape' });
    await act(() => new Promise((r) => setTimeout(r, 50)));
    expect(view()).toBe('0 0 100');
  });
});

describe('Canvas API', () => {
  it('passes its ref, takes a resting cursor from the caller, and draws a focus ring over the board', () => {
    let el: HTMLDivElement | null = null;
    render(<Canvas aria-label="Board" ref={(node) => { el = node; }} className="cursor-crosshair" />);
    expect(el).toBe(board());
    expect(board().className).toContain('cursor-crosshair');
    expect(board().className).toContain('focus-visible:after:ring-2');
  });

  it('passes a div\'s other props to its root', () => {
    const onFocus = vi.fn();
    render(<Canvas aria-label="Board" id="board" data-testid="the-board" title="Board" onFocus={onFocus} />);
    const root = board();
    expect(root.id).toBe('board');
    expect(root.dataset.testid).toBe('the-board');
    expect(root.title).toBe('Board');
    act(() => root.focus());
    expect(onFocus).toHaveBeenCalled();
  });

  it('takes focus on a press without asking for the keyboard focus ring', () => {
    render(<Canvas aria-label="Board" />);
    const root = board();
    const focus = vi.spyOn(root, 'focus');
    fireEvent.pointerDown(root, { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 10, clientY: 10 });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true, focusVisible: false });
  });

  it('puts the minimap on a side and an end, in either text direction', () => {
    render(<Harness overlay={<CanvasMiniMap side="top" align="start" className="opacity-90" items={[]} />} />);
    const map = board().querySelector<HTMLElement>('[data-slot="canvas-minimap"]')!;
    expect(map.className).toMatch(/\btop-3\b/);
    expect(map.className).toMatch(/\bstart-3\b/);
    expect(map.className).toContain('opacity-90');
  });

  it('lets a pointer layer take a press before the host, and gives the host the rest', () => {
    const onCanvasPointerDown = vi.fn();
    const onCanvasPointerUp = vi.fn();
    const layer = { onPointerDown: vi.fn((e: PointerEvent) => e.button === 0 && e.shiftKey), onPointerMove: vi.fn(), onPointerUp: vi.fn() };
    function Layer() {
      const { addPointerLayer } = useCanvas();
      useEffect(() => addPointerLayer(layer), [addPointerLayer]);
      return null;
    }
    render(<Canvas aria-label="Board" onCanvasPointerDown={onCanvasPointerDown} onCanvasPointerUp={onCanvasPointerUp}><Layer /></Canvas>);
    fireEvent.pointerDown(board(), { pointerId: 1, pointerType: 'mouse', button: 0, shiftKey: true, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(board(), { pointerId: 1, pointerType: 'mouse', clientX: 20, clientY: 10 });
    fireEvent.pointerUp(board(), { pointerId: 1, pointerType: 'mouse', clientX: 20, clientY: 10 });
    expect(layer.onPointerMove).toHaveBeenCalledTimes(1);
    expect(layer.onPointerUp).toHaveBeenCalledTimes(1);
    expect(onCanvasPointerDown).not.toHaveBeenCalled();
    expect(onCanvasPointerUp).not.toHaveBeenCalled();
    fireEvent.pointerDown(board(), { pointerId: 2, pointerType: 'mouse', button: 0, clientX: 10, clientY: 10 });
    fireEvent.pointerUp(board(), { pointerId: 2, pointerType: 'mouse', clientX: 10, clientY: 10 });
    expect(onCanvasPointerDown).toHaveBeenCalledTimes(1);
    expect(onCanvasPointerUp).toHaveBeenCalledTimes(1);
  });

  it('converts a board point to the canvas\'s own pixels with toLocal, and to client pixels with toScreen, as its controller does', () => {
    const controller = createCanvasController();
    let ctx: ReturnType<typeof useCanvas> | null = null;
    function Probe() {
      ctx = useCanvas();
      return null;
    }
    render(<Canvas aria-label="Board" controller={controller} viewport={{ x: 10, y: 20, zoom: 2 }}><Probe /></Canvas>);
    vi.spyOn(board(), 'getBoundingClientRect').mockReturnValue({ left: 100, top: 50, right: 500, bottom: 350, width: 400, height: 300, x: 100, y: 50, toJSON: () => ({}) });
    expect(ctx!.toLocal({ x: 5, y: 5 })).toEqual({ x: 20, y: 30 });
    expect(ctx!.toScreen({ x: 5, y: 5 })).toEqual(controller.toScreen({ x: 5, y: 5 }));
  });
});

describe('Canvas overlay parts', () => {
  it('take className and style after their own', () => {
    render(
      <Canvas aria-label="Board">
        <CanvasFrame frame={{ x: 0, y: 0, w: 10, h: 10, rot: 0 }} className="outline-warning" style={{ opacity: 0.5 }} />
        <CanvasHandles handles={[{ id: 'nw', pt: { x: 0, y: 0 } }]} className="border-warning" />
        <CanvasMarquee rect={{ x: 0, y: 0, w: 5, h: 5 }} className="border-dashed" />
        <CanvasGuides guides={[{ x1: 0, y1: 0, x2: 10, y2: 0 }]} className="bg-warning" />
      </Canvas>,
    );
    const q = (slot: string) => board().querySelector<HTMLElement>(`[data-slot="${slot}"]`)!;
    expect(q('canvas-frame').className).toContain('outline-warning');
    expect(q('canvas-frame').style.opacity).toBe('0.5');
    expect(q('canvas-handle').className).toContain('border-warning');
    expect(q('canvas-marquee').className).toContain('border-dashed');
    expect(q('canvas-guide').className).toContain('bg-warning');
  });

  it('scale their lines in CSS from the board\'s --canvas-zoom, so a zoom does not render them again', () => {
    const controller = createCanvasController();
    let renders = 0;
    // Memoized, so only a context it reads could render it again.
    const Overlay = memo(function Overlay() {
      renders++;
      return (
        <>
          <CanvasFrame frame={{ x: 10, y: 10, w: 100, h: 50, rot: 0 }} dashed />
          <CanvasHandles handles={[{ id: 'nw', pt: { x: 10, y: 10 } }]} />
          <CanvasMarquee rect={{ x: 0, y: 0, w: 20, h: 20 }} />
        </>
      );
    });
    render(<Canvas aria-label="Board" controller={controller}><Overlay /></Canvas>);
    const world = board().querySelector('[data-slot="canvas-board"]')!;
    const frame = world.querySelector<HTMLElement>('[data-slot="canvas-frame"]')!;
    expect(frame.style.getPropertyValue('--canvas-frame-line')).toBe('calc(1.6px / var(--canvas-zoom, 1))');
    expect(frame.className).toMatch(/outline-dashed/);
    expect(world.querySelector<HTMLElement>('[data-slot="canvas-handle"]')!.style.getPropertyValue('--canvas-handle')).toBe('calc(10px / var(--canvas-zoom, 1))');
    expect(world.querySelector<HTMLElement>('[data-slot="canvas-marquee"]')!.style.getPropertyValue('--canvas-marquee-line')).toBe('calc(1px / var(--canvas-zoom, 1))');
    const before = renders;
    act(() => { controller.zoomTo(2); });
    expect(world.getAttribute('style')).toMatch(/--canvas-zoom: ?2/);
    expect(renders).toBe(before);
  });
});
