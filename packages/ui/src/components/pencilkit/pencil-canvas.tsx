'use client';
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { bindDrag, type ChangeDetails, type PointerSample } from '@ui-sdk/core';
import { changeDetails } from '@/lib/change-details';
import { cn } from '@/lib/utils';
import {
  PK_INKS,
  PK_TOOLS,
  type PencilDrawTool,
  type PencilPoint,
  type PencilStroke,
  type PencilTool,
} from '@/components/ui/pencilkit/constants';
import { MemoStroke, StrokePath } from '@/components/ui/pencilkit/stroke-path';

/** Why the strokes changed: a stroke was drawn, or the eraser took some away. */
export type PencilStrokesChangeReason = 'draw' | 'erase';
export type PencilStrokesChangeDetails = ChangeDetails<PencilStrokesChangeReason>;

export interface PencilCanvasProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  /** Active tool. Default 'pen'. */
  tool?: PencilTool;
  /** Ink color for new strokes. Default PK_INKS[0]. */
  ink?: string;
  /** Width multiplier for new strokes (PK_W[i].m). Default 1. */
  width?: number;
  /** Controlled strokes. Omit for uncontrolled. */
  strokes?: PencilStroke[];
  /** Initial strokes when uncontrolled. */
  defaultStrokes?: PencilStroke[];
  /** Called with the new strokes and why (`details.reason`: `draw` or `erase`), before anything moves. When
   *  uncontrolled, `details.cancel()` keeps the strokes as they were. */
  onStrokesChange?: (strokes: PencilStroke[], details: PencilStrokesChangeDetails) => void;
  /** Empty-state hint content, shown only while the canvas has no strokes. */
  hint?: React.ReactNode;
  /** Small monospace status label rendered top-right (e.g. 'perfect-freehand@1.2.2'). */
  status?: React.ReactNode;
  /** Render the plain-stroke fallback instead of perfect-freehand outlines. Default false. */
  plain?: boolean;
}

export function PencilCanvas({
  tool = 'pen',
  ink = PK_INKS[0],
  width = 1,
  strokes: strokesProp,
  defaultStrokes,
  onStrokesChange,
  hint,
  status,
  plain = false,
  className,
  style,
  children,
  ...rest
}: PencilCanvasProps) {
  const controlled = strokesProp !== undefined;
  const [innerStrokes, setInnerStrokes] = useState<PencilStroke[]>(defaultStrokes || []);
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

  const pos = (e: { clientX: number; clientY: number; pressure: number }): PencilPoint => {
    const r = (box.current as HTMLDivElement).getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top, e.pressure > 0 ? e.pressure : 0.5];
  };

  const eraseAt = (e: PointerEvent) => {
    const p = pos(e), x = p[0], y = p[1];
    commit(
      (ss) =>
        ss.filter((st) => {
          const rad = 12 + (PK_TOOLS[st.tool].opt.size * st.w) / 2;
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

  // The stroke follows UI SDK's bindDrag (capture, document listeners, cancel), which reports once a frame with
  // the latest pointer event; that event's coalesced samples are every position since the last frame.
  const stopDrag = useRef<(() => void) | null>(null);
  useEffect(() => () => stopDrag.current?.(), []);

  const move = ({ event }: PointerSample) => {
    if (tool === 'eraser') return eraseAt(event);
    const s = live.current;
    if (!s) return;
    // An untrusted event has no coalesced samples, so it stands for itself.
    const coalesced = event.getCoalescedEvents?.() ?? [];
    for (const ev of coalesced.length ? coalesced : [event]) s.points.push(pos(ev));
    setV((v) => v + 1);
  };

  const end = (event: PointerEvent) => {
    stopDrag.current = null;
    if (tool === 'eraser') return;
    const s = live.current;
    live.current = null;
    if (s && s.points.length > 1) {
      s.done = true;
      commit((ss) => [...ss, s], 'draw', event);
    }
    // The live stroke is gone either way (committed, a tap, or canceled by the consumer).
    setV((v) => v + 1);
  };

  const down = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    stopDrag.current?.();
    stopDrag.current = bindDrag(e.currentTarget, e.nativeEvent, { onMove: move, onEnd: end });
    if (tool === 'eraser') return eraseAt(e.nativeEvent);
    live.current = {
      tool: tool as PencilDrawTool,
      color: ink,
      w: width,
      pen: e.pointerType === 'pen',
      points: [pos(e)],
      done: false,
    };
    setV((v) => v + 1);
  };

  return (
    <div
      ref={box}
      data-slot="pencil-canvas"
      onPointerDown={down}
      className={cn('absolute inset-0 cursor-crosshair touch-none', className)}
      style={style}
      {...rest}
    >
      <svg width="100%" height="100%" className="absolute inset-0 block">
        {strokes.map((s, i) => (
          <MemoStroke key={i} st={s} pf={!plain} />
        ))}
        {live.current ? <StrokePath st={live.current} pf={!plain} /> : null}
      </svg>
      {hint && !strokes.length && !live.current ? (
        <div data-slot="pencil-canvas-hint" className="pointer-events-none absolute inset-x-0 top-0 bottom-[90px] grid place-items-center">
          <div className="text-center text-tertiary-foreground">{hint}</div>
        </div>
      ) : null}
      {status != null ? (
        <div data-slot="pencil-canvas-status" className="pointer-events-none absolute top-2.5 right-3 font-mono text-[10.5px] text-tertiary-foreground">
          {status}
        </div>
      ) : null}
      {children}
    </div>
  );
}
