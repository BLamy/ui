'use client';
import { createContext, createElement, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode, type RefObject } from 'react';

/* ══ Diagram chrome — what floats over a board, so a fit can leave room for it ══
   A Diagram's toolbar and minimap, and a DiagramFrame's bar, sit over the board. Each reports how far it reaches in from
   its edge of the board to the nearest scope (the Diagram's own, or the frame board's around it), and a fit (the first
   view, ⌘0, the toolbar's Fit) keeps what it shows clear of them. Internal to the Diagram family. */

export interface DiagramInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export type DiagramChromeSide = keyof DiagramInsets;

export const NO_INSETS: DiagramInsets = { top: 0, right: 0, bottom: 0, left: 0 };

interface DiagramChromeScope {
  /** How far the chrome reported here reaches in from each edge, px. */
  insets: DiagramInsets;
  report: (id: string, side: DiagramChromeSide, px: number | null) => void;
  container: RefObject<HTMLElement | null>;
  /** The scope is a DiagramFrame's board, whose foot is the frame's bar. */
  frame: boolean;
  /** How tall the board in it would be for its drawing to be read whole (`diagramContentHeight`), px, as its Diagram says:
   *  what a frame sized to its content (`height="content"`) takes. */
  content: number | null;
  reportContent: (px: number | null) => void;
}

const DiagramChromeContext = createContext<DiagramChromeScope | null>(null);

/** A scope that collects the chrome over `container`. Provide the result with `DiagramChromeProvider`. */
export function useDiagramChromeScope(container: RefObject<HTMLElement | null>, { frame = false }: { frame?: boolean } = {}): DiagramChromeScope {
  const [reports, setReports] = useState<Record<string, { side: DiagramChromeSide; px: number }>>({});
  const report = useCallback((id: string, side: DiagramChromeSide, px: number | null) => {
    setReports((all) => {
      const was = all[id];
      if (px === null) {
        if (!was) return all;
        const { [id]: _gone, ...rest } = all;
        return rest;
      }
      if (was && was.side === side && Math.abs(was.px - px) < 0.5) return all;
      return { ...all, [id]: { side, px } };
    });
  }, []);
  const insets = useMemo(() => {
    const out = { ...NO_INSETS };
    for (const { side, px } of Object.values(reports)) out[side] = Math.max(out[side], px);
    return out;
  }, [reports]);
  const [content, setContent] = useState<number | null>(null);
  const reportContent = useCallback((px: number | null) => setContent((was) => (was === px || (was !== null && px !== null && Math.abs(was - px) < 0.5) ? was : px)), []);
  return useMemo(() => ({ insets, report, container, frame, content, reportContent }), [insets, report, container, frame, content, reportContent]);
}

export function DiagramChromeProvider({ value, children }: { value: DiagramChromeScope; children?: ReactNode }) {
  return createElement(DiagramChromeContext.Provider, { value }, children);
}

/** The nearest scope, if there is one. */
export function useDiagramChrome(): DiagramChromeScope | null {
  return useContext(DiagramChromeContext);
}

/** Reports `ref`'s element as chrome on `side` of the nearest scope while `active`, and keeps the report up to date as
 *  it or the board changes size. */
export function useDiagramChromeInset(ref: RefObject<HTMLElement | null>, side: DiagramChromeSide, active = true): void {
  const scope = useContext(DiagramChromeContext);
  const report = scope?.report;
  const container = scope?.container;
  const [id] = useState(() => Math.random().toString(36).slice(2));
  useLayoutEffect(() => {
    if (!report || !active) return undefined;
    let observer: ResizeObserver | null = null;
    let frame = 0;
    // A parent's ref is attached after its children's layout effects run, so the scope's element (the Diagram's root,
    // the frame's board) may not be there yet: wait a frame for it.
    const start = () => {
      const el = ref.current, box = container?.current;
      if (!el || !box) {
        if (typeof requestAnimationFrame === 'function' && frame >= 0) frame = requestAnimationFrame(start);
        return;
      }
      begin(el, box);
    };
    const begin = (el: HTMLElement, box: HTMLElement) => {
      const measure = () => {
        const r = el.getBoundingClientRect(), c = box.getBoundingClientRect();
        if (!r.width && !r.height) { report(id, side, null); return; }
        const px = side === 'top' ? r.bottom - c.top : side === 'bottom' ? c.bottom - r.top : side === 'left' ? r.right - c.left : c.right - r.left;
        report(id, side, Math.max(0, Math.min(px, side === 'top' || side === 'bottom' ? c.height / 2 : c.width / 2)));
      };
      measure();
      observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
      observer?.observe(el);
      observer?.observe(box);
    };
    start();
    return () => {
      if (frame > 0 && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(frame);
      frame = -1;
      observer?.disconnect();
      report(id, side, null);
    };
  }, [ref, side, active, report, container, id]);
}
