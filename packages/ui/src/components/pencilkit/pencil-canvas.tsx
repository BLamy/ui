'use client';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { bindDrag, type ChangeDetails, type PointerSample } from '@ui-sdk/core';
import { useCanvas, type CanvasContextValue } from '@/components/ui/canvas';
import { changeDetails } from '@/lib/change-details';
import { cn } from '@/lib/utils';
import {
  pencilInks,
  pencilTools,
  type PencilDrawTool,
  type PencilPoint,
  type PencilStroke,
  type PencilTool,
} from '@/components/ui/pencilkit/constants';
import { StrokePath } from '@/components/ui/pencilkit/stroke-path';

/* ══ PencilCanvas — freehand ink on perfect-freehand ══
   On its own it fills its positioned parent (`absolute inset-0`) and points are in its own pixels:

     <div className="relative h-80"><PencilCanvas tool="pen" ink={ink} strokes={strokes} onStrokesChange={set} /></div>

   Inside a `<Canvas>` it is the board's drawing layer: it draws in board units under the canvas's pan and zoom, takes
   presses before the canvas's host (`useCanvas().addPointerLayer`), and leaves Space-drag, pinch and the wheel to the
   canvas. A host that keeps strokes in its own model (to interleave them with other items) passes `strokes={[]}`
   and adds the drawn stroke from `onStrokesChange` (`next.at(-1)`). `disabled` hands presses back to the host. */

/** Why the strokes changed: a stroke was drawn, or the eraser took some away. */
export type PencilStrokesChangeReason = 'draw' | 'erase';
export type PencilStrokesChangeDetails = ChangeDetails<PencilStrokesChangeReason>;

/** On its own, PencilCanvas is a `div` (with the drawing's `svg` inside) and takes a div's props. On a Canvas it is
 *  the drawing's `svg` alone: `ref`, `className`, `style`, `id`, `aria-*` and `data-*` reach it, and `children`,
 *  `emptyState` and the other div props don't apply (a board item has no box to hold them). */
export interface PencilCanvasProps extends Omit<React.ComponentProps<'div'>, 'onChange' | 'ref'> {
  /** The root: the `div` on its own, the `svg` on a Canvas. */
  ref?: React.Ref<HTMLDivElement | SVGSVGElement>;
  /** Active tool. Default `pen`. */
  tool?: PencilTool;
  /** Ink for new strokes, any CSS color. Default the theme-following black (`pencilInks[0].value`). */
  ink?: string;
  /** How much new strokes scale the tool's nib (a `pencilWidths` scale, what `PencilWidthPicker` picks); not px.
   *  Default 1. */
  widthScale?: number;
  /** Controlled strokes. Omit for uncontrolled. */
  strokes?: PencilStroke[];
  /** Initial strokes when uncontrolled. */
  defaultStrokes?: PencilStroke[];
  /** Called with the new strokes and why (`details.reason`: `draw` or `erase`), before anything moves. When
   *  uncontrolled, `details.cancel()` keeps the strokes as they were. */
  onStrokesChange?: (strokes: PencilStroke[], details: PencilStrokesChangeDetails) => void;
  /** Shown centered while there are no strokes (an `EmptyState`, a line of text). Not on a Canvas. */
  emptyState?: React.ReactNode;
  /** `freehand` (default) draws perfect-freehand's pressure outlines; `plain` draws the raw polylines. */
  variant?: 'freehand' | 'plain';
  /** Takes no presses (a read-only drawing; on a Canvas, the host's tool is not a drawing one). */
  disabled?: boolean;
  /** The drawing's accessible name (default "Drawing"). */
  'aria-label'?: string;
}

const NO_STROKES: PencilStroke[] = [];

export function PencilCanvas({
  tool = 'pen',
  ink = pencilInks[0].value,
  widthScale = 1,
  strokes: strokesProp,
  defaultStrokes,
  onStrokesChange,
  emptyState,
  variant = 'freehand',
  disabled = false,
  'aria-label': ariaLabel = 'Drawing',
  className,
  style,
  children,
  ref,
  ...rest
}: PencilCanvasProps) {
  const board = useCanvas({ optional: true });
  const controlled = strokesProp !== undefined;
  const [innerStrokes, setInnerStrokes] = useState<PencilStroke[]>(defaultStrokes ?? NO_STROKES);
  const strokes = controlled ? (strokesProp as PencilStroke[]) : innerStrokes;
  const strokesRef = useRef(strokes);
  strokesRef.current = strokes;
  const [, setV] = useState(0);
  const live = useRef<PencilStroke | null>(null);
  const box = useRef<HTMLDivElement | null>(null);

  const notify = useRef(onStrokesChange);
  notify.current = onStrokesChange;
  const commit = (fn: (prev: PencilStroke[]) => PencilStroke[], reason: PencilStrokesChangeReason, event: Event) => {
    const next = fn(strokesRef.current);
    if (next === strokesRef.current || (reason === 'erase' && next.length === strokesRef.current.length)) return;
    const details = changeDetails({ reason, event });
    notify.current?.(next, details);
    if (details.canceled || controlled) return;
    strokesRef.current = next;
    setInnerStrokes(next);
  };

  /** A pointer sample in the drawing's units: board units on a Canvas, the element's pixels on its own. */
  const at = (e: { clientX: number; clientY: number; pressure: number }, canvas: CanvasContextValue | null): PencilPoint => {
    const pressure = e.pressure > 0 ? e.pressure : 0.5;
    if (canvas) {
      const p = canvas.toBoard(e);
      return [p.x, p.y, pressure];
    }
    const r = (box.current as HTMLDivElement).getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top, pressure];
  };

  // The latest props for the handlers below, which a Canvas or bindDrag holds on to between renders.
  const latest = useRef({ tool, ink, widthScale, board, disabled });
  latest.current = { tool, ink, widthScale, board, disabled };

  const eraseAt = (e: PointerEvent) => {
    const { board: canvas } = latest.current;
    const p = at(e, canvas), x = p[0], y = p[1];
    // The eraser's reach is 12 screen px past the stroke's half width.
    const reach = 12 / (canvas?.zoom ?? 1);
    commit(
      (ss) =>
        ss.filter((st) => {
          const rad = reach + (pencilTools[st.tool].options.size * st.widthScale) / 2;
          for (let i = 0; i < st.points.length; i += 2) {
            const dx = st.points[i][0] - x,
              dy = st.points[i][1] - y;
            if (dx * dx + dy * dy < rad * rad) return false;
          }
          return true;
        }),
      'erase',
      e,
    );
  };

  const begin = (e: PointerEvent) => {
    const { tool: t, ink, widthScale, board: canvas } = latest.current;
    if (t === 'eraser') return eraseAt(e);
    live.current = { tool: t as PencilDrawTool, ink, widthScale, pressure: e.pointerType === 'pen', points: [at(e, canvas)], complete: false };
    setV((v) => v + 1);
  };

  const extend = (event: PointerEvent) => {
    if (latest.current.tool === 'eraser') return eraseAt(event);
    const s = live.current;
    if (!s) return;
    // An untrusted event has no coalesced samples, so it stands for itself.
    const coalesced = event.getCoalescedEvents?.() ?? [];
    for (const ev of coalesced.length ? coalesced : [event]) s.points.push(at(ev, latest.current.board));
    setV((v) => v + 1);
  };

  const finish = (event: PointerEvent | null) => {
    const s = live.current;
    live.current = null;
    if (s && event && s.points.length > 1) commit((ss) => [...ss, { ...s, complete: true }], 'draw', event);
    // The live stroke is gone either way (committed, a tap, or canceled).
    setV((v) => v + 1);
  };

  // On a Canvas: a pointer layer, asked for each press before the host.
  useEffect(() => {
    if (!board) return;
    return board.addPointerLayer({
      onPointerDown: (event) => {
        if (latest.current.disabled) return false;
        if (event.pointerType === 'mouse' && event.button !== 0) return false;
        begin(event);
        return true;
      },
      onPointerMove: (event) => extend(event),
      onPointerUp: (event) => finish(event),
      onCancel: () => finish(null),
    });
    // The layer reads the latest props through `latest`; it is added once per canvas.
  }, [board?.addPointerLayer]);

  // On its own: the stroke follows UI SDK's bindDrag (capture, document listeners, cancel), which reports once a
  // frame with the latest pointer event; that event's coalesced samples are every position since the last frame.
  const stopDrag = useRef<(() => void) | null>(null);
  useEffect(() => () => stopDrag.current?.(), []);

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    stopDrag.current?.();
    stopDrag.current = bindDrag(e.currentTarget, e.nativeEvent, {
      onMove: ({ event }: PointerSample) => extend(event),
      onEnd: (event: PointerEvent) => { stopDrag.current = null; finish(event); },
    });
    begin(e.nativeEvent);
  };

  const ink$ = (
    <>
      {strokes.map((s, i) => (
        <StrokePath key={i} stroke={s} variant={variant} />
      ))}
      {live.current ? <StrokePath stroke={live.current} variant={variant} /> : null}
    </>
  );

  // The div keeps its own ref (`box`, for pointer positions) and the caller's.
  const setBox = React.useCallback(
    (el: HTMLDivElement | null) => {
      box.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref) (ref as React.RefObject<HTMLDivElement | null>).current = el;
    },
    [ref],
  );

  if (board) {
    // In board units: a zero-sized svg at the board's origin whose ink overflows it, like every board item. Only the
    // props an svg can carry reach it.
    const svgProps = Object.fromEntries(Object.entries(rest).filter(([k]) => k === 'id' || k.startsWith('aria-') || k.startsWith('data-')));
    return (
      <svg
        {...svgProps}
        ref={ref as React.Ref<SVGSVGElement>}
        data-slot="pencil-canvas"
        role="img"
        aria-label={ariaLabel}
        data-disabled={disabled ? '' : undefined}
        className={cn('pointer-events-none absolute top-0 left-0 overflow-visible', className)}
        style={style}
        width="1"
        height="1"
      >
        {ink$}
      </svg>
    );
  }

  const empty = !strokes.length && !live.current;
  return (
    <div
      ref={setBox}
      data-slot="pencil-canvas"
      data-empty={empty ? '' : undefined}
      data-disabled={disabled ? '' : undefined}
      onPointerDown={down}
      className={cn('absolute inset-0 cursor-crosshair touch-none data-disabled:cursor-default', className)}
      style={style}
      {...rest}
    >
      <svg role="img" aria-label={ariaLabel} width="100%" height="100%" className="absolute inset-0 block">
        {ink$}
      </svg>
      {emptyState != null && empty ? (
        <div data-slot="pencil-canvas-empty" className="pointer-events-none absolute inset-0 grid place-items-center text-center text-tertiary-foreground">
          {emptyState}
        </div>
      ) : null}
      {children}
    </div>
  );
}
