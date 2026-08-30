import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { cn, Haptics } from '@touchkit/ui';
import {
  PK_INKS,
  PK_TOOLS,
  PMONO,
  type PencilDrawTool,
  type PencilPoint,
  type PencilStroke,
  type PencilTool,
} from './constants';
import { MemoStroke, StrokePath } from './stroke-path';

export type PencilStrokesChangeSource = 'draw' | 'erase';

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
  onStrokesChange?: (strokes: PencilStroke[], source: PencilStrokesChangeSource) => void;
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
  const erasing = useRef(false);

  useEffect(() => {
    if (erasing.current) Haptics.selection();
  }, [strokes.length]);

  const commit = (fn: (prev: PencilStroke[]) => PencilStroke[], source: PencilStrokesChangeSource) => {
    const next = fn(strokesRef.current);
    if (next === strokesRef.current) return;
    strokesRef.current = next;
    if (!controlled) setInnerStrokes(next);
    if (onStrokesChange) onStrokesChange(next, source);
  };

  const pos = (e: { clientX: number; clientY: number; pressure: number }): PencilPoint => {
    const r = (box.current as HTMLDivElement).getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top, e.pressure > 0 ? e.pressure : 0.5];
  };

  const eraseAt = (e: React.PointerEvent) => {
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
      'erase'
    );
  };

  const down = (e: React.PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (tool === 'eraser') {
      erasing.current = true;
      eraseAt(e);
      return;
    }
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

  const move = (e: React.PointerEvent) => {
    if (tool === 'eraser') {
      if (erasing.current) eraseAt(e);
      return;
    }
    const s = live.current;
    if (!s) return;
    const ne = e.nativeEvent as PointerEvent;
    const evs: { clientX: number; clientY: number; pressure: number }[] =
      ne && ne.getCoalescedEvents ? ne.getCoalescedEvents() : [e];
    for (const ev of evs) s.points.push(pos(ev));
    setV((v) => v + 1);
  };

  const up = () => {
    if (tool === 'eraser') {
      erasing.current = false;
      return;
    }
    const s = live.current;
    live.current = null;
    if (s && s.points.length > 1) {
      s.done = true;
      commit((ss) => [...ss, s], 'draw');
    } else setV((v) => v + 1);
  };

  return (
    <div
      ref={box}
      data-slot="pencil-canvas"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      className={cn(className)}
      style={{ position: 'absolute', inset: 0, touchAction: 'none', cursor: 'crosshair', ...style }}
      {...rest}
    >
      <svg width="100%" height="100%" style={{ display: 'block', position: 'absolute', inset: 0 }}>
        {strokes.map((s, i) => (
          <MemoStroke key={i} st={s} pf={!plain} />
        ))}
        {live.current ? <StrokePath st={live.current} pf={!plain} /> : null}
      </svg>
      {hint && !strokes.length && !live.current ? (
        <div
          data-slot="pencil-canvas-hint"
          style={{ position: 'absolute', inset: '0 0 90px', display: 'grid', placeItems: 'center', pointerEvents: 'none' }}
        >
          <div style={{ textAlign: 'center', color: 'var(--tk-label3)' }}>{hint}</div>
        </div>
      ) : null}
      {status != null ? (
        <div
          data-slot="pencil-canvas-status"
          style={{ position: 'absolute', top: 10, right: 12, fontFamily: PMONO, fontSize: 10.5, color: 'var(--tk-label3)', pointerEvents: 'none' }}
        >
          {status}
        </div>
      ) : null}
      {children}
    </div>
  );
}
