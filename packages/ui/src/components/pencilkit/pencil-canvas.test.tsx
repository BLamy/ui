// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PencilCanvas, type PencilStrokesChangeDetails } from '@/components/ui/pencilkit/pencil-canvas';
import { PencilActions, PencilToolbar } from '@/components/ui/pencilkit/pencil-toolbar';
import { Canvas } from '@/components/ui/canvas';
import { usePencilHistory } from '@/components/ui/pencilkit/use-pencil-history';
import type { PencilStroke, PencilTool } from '@/components/ui/pencilkit/constants';

(globalThis as { __UI_SDK_STRICT__?: boolean }).__UI_SDK_STRICT__ = true;
afterEach(cleanup);

const surface = () => document.querySelector<HTMLElement>('[data-slot=pencil-canvas]')!;
const paths = () => surface().querySelectorAll('svg path').length;

const frame = () => act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

/** One stroke from (x0, y) to (x1, y), as pointer events on the surface, one move per frame as browsers send them;
 *  then the task ends (the click a drag sends is swallowed within it). */
async function stroke(x0: number, x1: number, y = 20, pointerType = 'mouse') {
  const el = surface();
  fireEvent.pointerDown(el, { pointerId: 1, pointerType, button: 0, buttons: 1, clientX: x0, clientY: y, pressure: 0.5 });
  for (let x = x0 + 5; x <= x1; x += 5) {
    fireEvent.pointerMove(el, { pointerId: 1, pointerType, buttons: 1, clientX: x, clientY: y, pressure: 0.5 });
    await frame();
  }
  fireEvent.pointerUp(el, { pointerId: 1, pointerType, clientX: x1, clientY: y });
  await act(() => new Promise<void>((resolve) => setTimeout(resolve)));
}

describe('PencilCanvas', () => {
  it('commits a drawn stroke with its tool, ink and points, and hides the empty state', async () => {
    const onStrokesChange = vi.fn();
    render(<PencilCanvas tool="marker" ink="tomato" widthScale={2} emptyState="Draw here" onStrokesChange={onStrokesChange} />);
    expect(surface().hasAttribute('data-empty')).toBe(true);
    expect(screen.getByText('Draw here')).toBeTruthy();
    await stroke(10, 60);
    expect(onStrokesChange).toHaveBeenCalledTimes(1);
    const [strokes, details] = onStrokesChange.mock.calls[0] as [PencilStroke[], PencilStrokesChangeDetails];
    expect(details).toMatchObject({ reason: 'draw', canceled: false });
    expect(details.event?.type).toBe('pointerup');
    expect(strokes).toHaveLength(1);
    expect(strokes[0]).toMatchObject({ tool: 'marker', ink: 'tomato', widthScale: 2, pressure: false, complete: true });
    expect(strokes[0].points.length).toBeGreaterThan(5);
    expect(paths()).toBeGreaterThan(0);
    expect(screen.queryByText('Draw here')).toBeNull();
    expect(surface().hasAttribute('data-empty')).toBe(false);
  });

  it('is a named drawing (an image) and draws nothing while disabled', async () => {
    const onStrokesChange = vi.fn();
    const { rerender } = render(<PencilCanvas disabled onStrokesChange={onStrokesChange} />);
    expect(screen.getByRole('img', { name: 'Drawing' })).toBeTruthy();
    await stroke(10, 60);
    expect(onStrokesChange).not.toHaveBeenCalled();
    rerender(<PencilCanvas aria-label="Signature" onStrokesChange={onStrokesChange} />);
    expect(screen.getByRole('img', { name: 'Signature' })).toBeTruthy();
  });

  it('drops a tap (a single point) and ignores a secondary mouse button', async () => {
    const onStrokesChange = vi.fn();
    render(<PencilCanvas onStrokesChange={onStrokesChange} />);
    fireEvent.pointerDown(surface(), { pointerId: 1, pointerType: 'mouse', button: 0, clientX: 5, clientY: 5 });
    fireEvent.pointerUp(surface(), { pointerId: 1, pointerType: 'mouse', clientX: 5, clientY: 5 });
    fireEvent.pointerDown(surface(), { pointerId: 2, pointerType: 'mouse', button: 2, clientX: 5, clientY: 5 });
    fireEvent.pointerMove(surface(), { pointerId: 2, pointerType: 'mouse', clientX: 40, clientY: 5 });
    fireEvent.pointerUp(surface(), { pointerId: 2, pointerType: 'mouse', clientX: 40, clientY: 5 });
    expect(onStrokesChange).not.toHaveBeenCalled();
  });

  it('marks pen strokes and erases the strokes the eraser crosses', async () => {
    const onStrokesChange = vi.fn();
    const { rerender } = render(<PencilCanvas tool="pen" onStrokesChange={onStrokesChange} />);
    await stroke(10, 60, 20, 'pen');
    expect((onStrokesChange.mock.calls[0][0] as PencilStroke[])[0].pressure).toBe(true);
    await stroke(10, 60, 200);
    expect((onStrokesChange.mock.lastCall![0] as PencilStroke[])).toHaveLength(2);
    rerender(<PencilCanvas tool="eraser" onStrokesChange={onStrokesChange} />);
    fireEvent.pointerDown(surface(), { pointerId: 3, pointerType: 'mouse', button: 0, clientX: 30, clientY: 20 });
    fireEvent.pointerUp(surface(), { pointerId: 3, pointerType: 'mouse', clientX: 30, clientY: 20 });
    const [left, details] = onStrokesChange.mock.lastCall as [PencilStroke[], PencilStrokesChangeDetails];
    expect(details.reason).toBe('erase');
    expect(left).toHaveLength(1);
    expect(left[0].points[0][1]).toBe(200);
    // Erasing over empty paper changes nothing, so it reports nothing.
    const calls = onStrokesChange.mock.calls.length;
    fireEvent.pointerDown(surface(), { pointerId: 4, pointerType: 'mouse', button: 0, clientX: 300, clientY: 400 });
    fireEvent.pointerUp(surface(), { pointerId: 4, pointerType: 'mouse', clientX: 300, clientY: 400 });
    expect(onStrokesChange).toHaveBeenCalledTimes(calls);
  });

  it('keeps an uncontrolled canvas as it was when the consumer cancels', async () => {
    render(<PencilCanvas onStrokesChange={(_s, details) => details.cancel()} />);
    await stroke(10, 60);
    expect(paths()).toBe(0);
  });

  it("reads every coalesced sample of a frame's move", async () => {
    const onStrokesChange = vi.fn();
    render(<PencilCanvas onStrokesChange={onStrokesChange} />);
    fireEvent.pointerDown(surface(), { pointerId: 1, pointerType: 'pen', button: 0, buttons: 1, clientX: 0, clientY: 0, pressure: 0.5 });
    const move = new PointerEvent('pointermove', { pointerId: 1, pointerType: 'pen', buttons: 1, clientX: 30, clientY: 0, pressure: 0.5, bubbles: true });
    const samples = [10, 20, 30].map((x) => new PointerEvent('pointermove', { pointerId: 1, clientX: x, clientY: 0, pressure: 0.7 }));
    Object.defineProperty(move, 'getCoalescedEvents', { value: () => samples });
    surface().dispatchEvent(move);
    await frame();
    fireEvent.pointerUp(surface(), { pointerId: 1, pointerType: 'pen', clientX: 30, clientY: 0 });
    const [strokes] = onStrokesChange.mock.calls[0] as [PencilStroke[]];
    expect(strokes[0].points.map((p) => p[0])).toEqual([0, 10, 20, 30]);
  });

  it('follows the stroke after the pointer leaves the surface, until it lifts', async () => {
    const onStrokesChange = vi.fn();
    render(<PencilCanvas onStrokesChange={onStrokesChange} />);
    fireEvent.pointerDown(surface(), { pointerId: 7, pointerType: 'mouse', button: 0, buttons: 1, clientX: 10, clientY: 10, pressure: 0.5 });
    // Moves outside the canvas reach the document: bindDrag follows them there.
    fireEvent.pointerMove(document.body, { pointerId: 7, pointerType: 'mouse', buttons: 1, clientX: 50, clientY: 10, pressure: 0.5 });
    fireEvent.pointerUp(document.body, { pointerId: 7, pointerType: 'mouse', clientX: 50, clientY: 10 });
    expect((onStrokesChange.mock.calls[0][0] as PencilStroke[])[0].points.at(-1)?.[0]).toBe(50);
  });
});

function Sketch({ tool = 'pen' }: { tool?: PencilTool }) {
  const h = usePencilHistory();
  return (
    <>
      <PencilCanvas tool={tool} strokes={h.strokes} onStrokesChange={h.onStrokesChange} />
      <PencilToolbar>
        <PencilActions onUndo={h.undo} onRedo={h.redo} onClear={h.clear} canUndo={h.canUndo} canRedo={h.canRedo} canClear={h.canClear} />
      </PencilToolbar>
      <output data-testid="count">{h.strokes.length}</output>
    </>
  );
}

describe('usePencilHistory with PencilActions', () => {
  const count = () => screen.getByTestId('count').textContent;
  const action = (name: string) => screen.getByRole('button', { name });

  it('undoes, redoes and clears, and a new stroke drops the redo stack', async () => {
    render(<Sketch />);
    expect(screen.getByRole('group', { name: 'History' })).toBeTruthy();
    expect(action('Undo').getAttribute('aria-disabled') ?? String((action('Undo') as HTMLButtonElement).disabled)).toMatch(/true/);
    await stroke(10, 60, 20);
    await stroke(10, 60, 80);
    expect(count()).toBe('2');
    fireEvent.click(action('Undo'));
    expect(count()).toBe('1');
    fireEvent.click(action('Redo'));
    expect(count()).toBe('2');
    fireEvent.click(action('Undo'));
    await stroke(10, 60, 140);
    expect(count()).toBe('2');
    fireEvent.click(action('Redo'));
    expect(count()).toBe('2');
    fireEvent.click(action('Clear'));
    expect(count()).toBe('0');
    expect(paths()).toBe(0);
    // A clear is a step too.
    fireEvent.click(action('Undo'));
    expect(count()).toBe('2');
  });

  it('brings erased strokes back on undo, and leaves the others alone', async () => {
    const { rerender } = render(<Sketch />);
    await stroke(10, 60, 20);
    await stroke(10, 60, 200);
    expect(count()).toBe('2');
    rerender(<Sketch tool="eraser" />);
    fireEvent.pointerDown(surface(), { pointerId: 9, pointerType: 'mouse', button: 0, clientX: 30, clientY: 20 });
    fireEvent.pointerUp(surface(), { pointerId: 9, pointerType: 'mouse', clientX: 30, clientY: 20 });
    expect(count()).toBe('1');
    fireEvent.click(action('Undo'));
    expect(count()).toBe('2');
    fireEvent.click(action('Redo'));
    expect(count()).toBe('1');
  });
});

describe('PencilCanvas on a Canvas', () => {
  /** A press, a few moves and a release on the canvas's root, which hands them to its pointer layers. */
  async function drawOn(root: HTMLElement, x0: number, x1: number, y: number) {
    fireEvent.pointerDown(root, { pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, clientX: x0, clientY: y, pressure: 0.5 });
    for (let x = x0 + 10; x <= x1; x += 10) fireEvent.pointerMove(root, { pointerId: 1, pointerType: 'mouse', buttons: 1, clientX: x, clientY: y, pressure: 0.5 });
    fireEvent.pointerUp(root, { pointerId: 1, pointerType: 'mouse', clientX: x1, clientY: y });
  }

  it('is the board\'s drawing layer: it takes the press before the host and draws in board units', async () => {
    const onStrokesChange = vi.fn();
    const onCanvasPointerDown = vi.fn();
    render(
      <Canvas viewport={{ x: 100, y: 50, zoom: 2 }} onCanvasPointerDown={onCanvasPointerDown}>
        <PencilCanvas tool="pen" onStrokesChange={onStrokesChange} />
      </Canvas>,
    );
    const root = screen.getByRole('application');
    await drawOn(root, 100, 140, 50);
    expect(onCanvasPointerDown).not.toHaveBeenCalled();
    const [strokes] = onStrokesChange.mock.lastCall as [PencilStroke[]];
    // Client (100, 50) is the board's origin under this view; 40 px across at 2× is 20 board units.
    expect(strokes[0].points[0].slice(0, 2)).toEqual([0, 0]);
    expect(strokes[0].points.at(-1)?.[0]).toBe(20);
    // It renders no box of its own: a zero-sized svg in the board layer.
    expect(surface().tagName.toLowerCase()).toBe('svg');
  });

  it('passes ref, id, aria-* and data-* to its svg, and its ref to the div on its own', () => {
    let boardRef: Element | null = null;
    const { unmount } = render(
      <Canvas>
        <PencilCanvas ref={(el) => { boardRef = el; }} id="ink" aria-label="Sketch" data-layer="ink" />
      </Canvas>,
    );
    expect(boardRef).toBe(surface());
    expect(surface().tagName.toLowerCase()).toBe('svg');
    expect(surface().getAttribute('id')).toBe('ink');
    expect(surface().getAttribute('aria-label')).toBe('Sketch');
    expect(surface().getAttribute('data-layer')).toBe('ink');
    unmount();
    const ref = { current: null as HTMLDivElement | SVGSVGElement | null };
    render(<div className="relative"><PencilCanvas ref={ref} /></div>);
    expect(ref.current).toBe(surface());
    expect(surface().tagName.toLowerCase()).toBe('div');
  });

  it('hands presses back to the host while disabled', async () => {
    const onStrokesChange = vi.fn();
    const onCanvasPointerDown = vi.fn();
    render(
      <Canvas onCanvasPointerDown={onCanvasPointerDown}>
        <PencilCanvas disabled onStrokesChange={onStrokesChange} />
      </Canvas>,
    );
    await drawOn(screen.getByRole('application'), 10, 60, 20);
    expect(onCanvasPointerDown).toHaveBeenCalledTimes(1);
    expect(onStrokesChange).not.toHaveBeenCalled();
  });
});
