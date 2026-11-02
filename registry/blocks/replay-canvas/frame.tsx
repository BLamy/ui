'use client';
/* One frame on the board: the recording paused at a moment, drawn by rrweb at the recorded size. A page frame hides the
   layers that were open over it; a layer frame shows only the layer — its panel, not the backdrop behind it — and is
   cropped to it, measured in the replayed page itself, so a modal is the size it was. The page's content (without
   shared chrome), a part an update changed and the chrome itself are cropped the same way, on the page's own
   background. Frames mount a few at a time (each is a Replayer of its own). */
import { useEffect, useRef, useState } from 'react';
import { ReplayStage, type ReplayEvent, type ReplayStageHandle } from '@/components/ui/replay-preview';
import type { Rect } from '@/lib/canvas-math';
import { cn } from '@/lib/utils';
import type { Evidence } from './analyze';
import { elementAtPath } from './vdom';

const SCOPE_CSS = '*, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }';
/** Mount frames this far apart (ms) so the board doesn't build every Replayer in one frame. */
const STAGGER = 70;

/** The part of a layer worth drawing: a full-screen layer (a backdrop) shows its dialog, not itself. */
function panelOf(el: Element, vw: number, vh: number): Element {
  const full = vw * vh;
  const area = (e: Element) => { const r = e.getBoundingClientRect(); return r.width * r.height; };
  if (area(el) < full * 0.8) return el;
  const dialog = el.querySelector('[role=dialog], [role=alertdialog], [aria-modal=true], dialog');
  if (dialog && area(dialog) > 0 && area(dialog) < full * 0.8) return dialog;
  const queue = [...el.children];
  while (queue.length) {
    const c = queue.shift()!;
    const a = area(c);
    if (a > full * 0.02 && a < full * 0.8 && c.textContent?.trim()) return c;
    queue.push(...c.children);
  }
  return el;
}

/** The visible text, images and fields in `region` of the replayed page, as rects (stopping at `limit`). */
function inked(doc: Document, region: Rect, limit = Infinity): DOMRect[] {
  const view = doc.defaultView;
  const out: DOMRect[] = [];
  if (!doc.body || !view) return out;
  for (const el of doc.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2 || r.right < region.x || r.bottom < region.y || r.left > region.x + region.w || r.top > region.y + region.h) continue;
    const media = /^(IMG|SVG|CANVAS|VIDEO|INPUT|TEXTAREA|SELECT|BUTTON)$/i.test(el.tagName);
    if (!media && ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent?.trim())) continue;
    const cs = view.getComputedStyle(el);
    if (cs.visibility !== 'visible' || cs.opacity === '0' || cs.display === 'none') continue;
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

/** Whether anything shows in `region` of the replayed page. */
const shows = (doc: Document, region: Rect) => inked(doc, region, 1).length > 0;

/** Air kept around a page's content when its frame is trimmed to it. */
const TRIM_PAD = 32;

export interface ScreenFrameProps {
  events: ReplayEvent[];
  evidence: Evidence;
  /** Recorded viewport (px). */
  viewport: { w: number; h: number };
  /** Where a layer sits in the viewport, once measured (a page frame is the whole viewport). */
  crop?: Rect;
  onCrop?: (rect: Rect) => void;
  /** Mount order. */
  order: number;
  /** It came out blank (nothing visible inside it): another moment of the same state may do better. */
  onBlank?: () => void;
  className?: string;
}

export function ScreenFrame({ events, evidence, viewport, crop, onCrop, order, onBlank, className }: ScreenFrameProps) {
  const stage = useRef<ReplayStageHandle>(null);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  /** Whether the element the frame is cropped to was found in the replayed page (`data-rc-scope`). */
  const [scoped, setScoped] = useState<'ok' | 'missing' | null>(null);
  /** Nothing visible in it, and no other moment to try: said so rather than left a white box. */
  const [empty, setEmpty] = useState(false);
  const report = useRef(onCrop);
  report.current = onCrop;
  const blank = useRef(onBlank);
  blank.current = onBlank;
  /** The region it last measured itself to, in the recorded viewport. */
  const cropOf = useRef<Rect | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), order * STAGGER);
    return () => clearTimeout(t);
  }, [order]);

  const scope = useRef<() => boolean>(() => false);
  scope.current = () => {
    const doc = stage.current?.getDocument?.();
    if (!doc?.body) return false;
    if (!doc.getElementById('rc-scope')) {
      const style = doc.createElement('style');
      style.id = 'rc-scope';
      style.textContent = SCOPE_CSS;
      doc.head?.append(style);
    }
    for (const path of evidence.hide ?? []) (elementAtPath(doc, path) as HTMLElement | null)?.style.setProperty('visibility', 'hidden', 'important');
    if (!evidence.path) {
      // A whole page is trimmed to where its content is, when that leaves much of the screen empty (a small app on
      // a big viewport): the frame shows the app, not the margins.
      const rects = inked(doc, { x: 0, y: 0, w: viewport.w, h: viewport.h });
      if (rects.length) {
        const x0 = Math.max(0, Math.min(...rects.map((r) => r.left)) - TRIM_PAD), y0 = Math.max(0, Math.min(...rects.map((r) => r.top)) - TRIM_PAD);
        const x1 = Math.min(viewport.w, Math.max(...rects.map((r) => r.right)) + TRIM_PAD), y1 = Math.min(viewport.h, Math.max(...rects.map((r) => r.bottom)) + TRIM_PAD);
        if ((x1 - x0) * (y1 - y0) < viewport.w * viewport.h * 0.8) {
          cropOf.current = { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
          report.current?.(cropOf.current);
        }
      }
      return true;
    }
    const layer = elementAtPath(doc, evidence.path);
    if (!layer) return false;
    // A layer shows its panel on nothing; a piece of the page is itself, on the page's background.
    const panel = (evidence.scope ? layer : panelOf(layer, viewport.w, viewport.h)) as HTMLElement;
    if (!evidence.scope) for (const el of [doc.documentElement, doc.body]) el.style.setProperty('background', 'transparent', 'important');
    doc.body.style.setProperty('visibility', 'hidden', 'important');
    panel.style.setProperty('visibility', 'visible', 'important');
    // What of it was on screen: a page's content can run far below the fold, where nobody saw it.
    const r = panel.getBoundingClientRect();
    const x0 = Math.max(0, r.left), y0 = Math.max(0, r.top), x1 = Math.min(viewport.w, r.right), y1 = Math.min(viewport.h, r.bottom);
    if (x1 - x0 <= 2 || y1 - y0 <= 2) {
      // There, but not on screen at that moment (emptied, collapsed): as good as missing, so the page is shown whole.
      for (const el of [doc.documentElement, doc.body]) el.style.removeProperty('background');
      doc.body.style.removeProperty('visibility');
      return false;
    }
    cropOf.current = { x: Math.round(x0), y: Math.round(y0), w: Math.round(x1 - x0), h: Math.round(y1 - y0) };
    report.current?.(cropOf.current);
    return true;
  };

  // Scope once the player has drawn the moment, and again after late layout (fonts, images).
  useEffect(() => {
    if (!ready) return;
    const timers = [0, 120, 600].map((ms, i, all) => setTimeout(() => {
      const ok = scope.current();
      if (i < all.length - 1) return;
      setScoped(ok ? 'ok' : 'missing');
      // Not found in the replayed page: the whole screen at that moment beats a blank frame.
      if (!ok && evidence.path) report.current?.({ x: 0, y: 0, w: viewport.w, h: viewport.h });
      const doc = stage.current?.getDocument?.();
      if (doc && !shows(doc, ok ? (cropOf.current ?? { x: 0, y: 0, w: viewport.w, h: viewport.h }) : { x: 0, y: 0, w: viewport.w, h: viewport.h })) {
        if (blank.current) blank.current();
        else setEmpty(true);
      }
    }, ms));
    return () => timers.forEach(clearTimeout);
  }, [ready]);

  const layer = !!evidence.path && !evidence.scope && scoped !== 'missing';
  const cropped = !!evidence.path && scoped !== 'missing';
  // A cropped frame, or a whole page trimmed to its content, is drawn from where its crop starts.
  const off = crop && (cropped || !evidence.path) ? crop : { x: 0, y: 0 };
  return (
    <div
      data-slot="replay-canvas-frame"
      data-rc-scope={scoped ?? undefined}
      data-rc-empty={empty || undefined}
      className={cn('pointer-events-none relative size-full overflow-hidden', !layer && 'bg-background', !ready && 'animate-pulse bg-muted', className)}
    >
      {mounted && (
        <div className="absolute" style={{ left: -off.x, top: -off.y, width: viewport.w, height: viewport.h, visibility: !cropped || crop ? 'visible' : 'hidden' }}>
          <ReplayStage
            ref={stage}
            events={events}
            initialTime={evidence.time}
            showMouse={false}
            skipInactive={false}
            onReady={() => setReady(true)}
          />
        </div>
      )}
      {empty && (
        // In board units: about as big as the page's own text would read at this frame's size.
        <div className="absolute inset-0 grid place-items-center bg-secondary text-center text-muted-foreground" style={{ fontSize: Math.max(16, viewport.w / 48) }}>
          Nothing visible here
        </div>
      )}
    </div>
  );
}
