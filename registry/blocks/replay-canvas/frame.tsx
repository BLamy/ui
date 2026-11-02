'use client';
/* One frame on the board: the recording paused at a moment, drawn by rrweb at the recorded size. A page frame hides the
   layers that were open over it; a layer frame shows only the layer — its panel, not the backdrop behind it — and is
   cropped to it, measured in the replayed page itself, so a modal is the size it was. Frames mount a few at a time
   (each is a Replayer of its own). */
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
  className?: string;
}

export function ScreenFrame({ events, evidence, viewport, crop, onCrop, order, className }: ScreenFrameProps) {
  const stage = useRef<ReplayStageHandle>(null);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const report = useRef(onCrop);
  report.current = onCrop;

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), order * STAGGER);
    return () => clearTimeout(t);
  }, [order]);

  const scope = useRef(() => false);
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
    if (!evidence.path) return true;
    const layer = elementAtPath(doc, evidence.path);
    if (!layer) return false;
    const panel = panelOf(layer, viewport.w, viewport.h) as HTMLElement;
    for (const el of [doc.documentElement, doc.body]) el.style.setProperty('background', 'transparent', 'important');
    doc.body.style.setProperty('visibility', 'hidden', 'important');
    panel.style.setProperty('visibility', 'visible', 'important');
    const r = panel.getBoundingClientRect();
    if (r.width > 2 && r.height > 2) report.current?.({ x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) });
    return true;
  };

  // Scope once the player has drawn the moment, and again after late layout (fonts, images).
  useEffect(() => {
    if (!ready) return;
    const timers = [0, 120, 600].map((ms) => setTimeout(() => scope.current(), ms));
    return () => timers.forEach(clearTimeout);
  }, [ready]);

  const layer = !!evidence.path;
  const off = layer && crop ? crop : { x: 0, y: 0 };
  return (
    <div
      data-slot="replay-canvas-frame"
      className={cn('pointer-events-none relative size-full overflow-hidden', !layer && 'bg-background', !ready && 'animate-pulse bg-muted', className)}
    >
      {mounted && (
        <div className="absolute" style={{ left: -off.x, top: -off.y, width: viewport.w, height: viewport.h, visibility: !layer || crop ? 'visible' : 'hidden' }}>
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
    </div>
  );
}
