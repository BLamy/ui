/* The motion timeline, Framer's: every appear animation in the scene on one clock. A track per node, its bar from
   when it starts to when it comes to rest, drawn with its curve (a spring's overshoot rises above the bar); a
   repeated node's instances are its stagger. Press or drag on the ruler or the tracks to scrub: the canvas holds
   that instant of the scene's appear (Esc lets go); Play runs it for real. Drag a bar to change when it starts (its
   delay), its end to change how long it takes (a tween's duration, a spring's time); click a track's name to select
   its node. */
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { PlainButton } from '@/components/ui/plain-button';
import { useContainerWidth } from '@/lib/container';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { appearSchedule, instanceKey, scheduleLength, type Slot } from './appear';
import { nodeLabel } from './catalog';
import { describe, sample, type TransitionSpec } from './easing';
import { valueOf } from './expr';
import type { Node } from './model';
import { designScope } from './scope';
import { useBuilder } from './store';
import { walk } from './tree';

const LABEL_W = 168;
const ROW_H = 30;
/** Grab this close to a bar's end (px) to change its length instead of moving it. */
const EDGE = 7;

interface Track {
  node: Node;
  /** Its instances' slots (one, or one per row of a repeat). */
  slots: Slot[];
}

type Drag =
  | { k: 'scrub' }
  | { k: 'move'; node: string; x0: number; delay0: number; moved: boolean }
  | { k: 'length'; node: string; x0: number; dur0: number };

export function Timeline({ sceneId, frameAt, onFrameAt, onPlay }: { sceneId: string; frameAt: number | null; onFrameAt: (ms: number | null) => void; onPlay: () => void }) {
  const b = useBuilder();
  const scene = b.doc.scenes.find((s) => s.id === sceneId) ?? null;
  const [box, width] = useContainerWidth<HTMLDivElement>(800);
  const drag = useRef<Drag | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  // The schedule the canvas plays, with as many rows of a repeat as its list has.
  const { tracks, total } = useMemo(() => {
    if (!scene) return { tracks: [] as Track[], total: 1000 };
    const scope = designScope(b.doc, scene);
    const count = (n: Node) => {
      const list = n.repeat ? valueOf<unknown>(n.repeat.each, scope, []) : [];
      return Array.isArray(list) ? Math.max(1, list.length) : 1;
    };
    const schedule = appearSchedule(scene.root, count);
    const out: Track[] = [];
    walk(scene.root, (n) => {
      if (n.motion?.appear?.trigger !== 'mount') return;
      const slots = n.repeat
        ? Array.from({ length: count(n) }, (_, i) => schedule.get(instanceKey(n.id, i))).filter((s): s is Slot => !!s)
        : [schedule.get(n.id)].filter((s): s is Slot => !!s);
      if (slots.length) out.push({ node: n, slots });
    });
    return { tracks: out, total: Math.max(1000, Math.ceil((scheduleLength(schedule) + 150) / 250) * 250) };
  }, [b.doc, scene]);

  const lane = Math.max(120, width - LABEL_W - 16);
  const pxPerMs = lane / total;
  const msAt = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    return r ? Math.max(0, Math.min(total, (clientX - r.left - LABEL_W) / pxPerMs)) : 0;
  };
  const selected = b.selection.kind === 'node' ? b.selection.ids : [];

  const setTransition = (id: string, fn: (t: TransitionSpec) => TransitionSpec) =>
    b.updateNode(id, (n) => (n.motion?.appear ? { ...n, motion: { ...n.motion, appear: { ...n.motion.appear, transition: fn(n.motion.appear.transition) } } } : n), false);

  const onDown = (e: ReactPointerEvent) => {
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const bar = (e.target as Element).closest<HTMLElement>('[data-ib-bar]');
    const node = bar ? tracks.find((t) => t.node.id === bar.dataset.ibBar)?.node : null;
    const t = node?.motion?.appear?.transition;
    if (node && t) {
      b.begin();
      const r = bar!.getBoundingClientRect();
      drag.current = (t.type === 'tween' || (t.type === 'spring' && t.mode === 'time')) && r.right - e.clientX <= EDGE
        ? { k: 'length', node: node.id, x0: e.clientX, dur0: t.duration }
        : { k: 'move', node: node.id, x0: e.clientX, delay0: t.delay, moved: false };
      return;
    }
    drag.current = { k: 'scrub' };
    onFrameAt(Math.round(msAt(e.clientX)));
  };
  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d) { setHover(msAt(e.clientX)); return; }
    // Snapped to 10ms (⇧ for 50ms).
    const snap = (ms: number) => Math.round(ms / (e.shiftKey ? 50 : 10)) * (e.shiftKey ? 50 : 10);
    if (d.k === 'scrub') onFrameAt(Math.round(msAt(e.clientX)));
    else if (d.k === 'move') {
      d.moved ||= Math.abs(e.clientX - d.x0) > 2;
      const delay = Math.max(0, snap(d.delay0 * 1000 + (e.clientX - d.x0) / pxPerMs)) / 1000;
      setTransition(d.node, (t) => ({ ...t, delay }));
    } else {
      const dur = Math.max(0.05, snap(d.dur0 * 1000 + (e.clientX - d.x0) / pxPerMs) / 1000);
      setTransition(d.node, (t) => (t.type === 'instant' ? t : { ...t, duration: dur }));
    }
  };
  const onUp = () => {
    const d = drag.current;
    drag.current = null;
    // A bar pressed and let go without moving selects its node.
    if (d?.k === 'move' && !d.moved) b.selectNode(d.node);
  };

  const ticks = useMemo(() => {
    const step = total <= 1500 ? 100 : total <= 4000 ? 250 : 500;
    return Array.from({ length: Math.floor(total / step) + 1 }, (_, i) => i * step);
  }, [total]);
  const playhead = frameAt ?? hover;

  return (
    <div
      ref={box}
      data-slot="ib-timeline"
      className="relative flex max-h-64 min-h-28 flex-col text-caption select-none"
      tabIndex={-1}
      onKeyDown={(e) => { if (e.key === 'Escape' && frameAt != null) { e.preventDefault(); onFrameAt(null); } }}
    >
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-2">
        <PlainButton
          aria-label="Play the appear"
          onPress={() => { onFrameAt(null); onPlay(); }}
          className="grid size-7 cursor-pointer place-items-center rounded-md border-0 bg-primary text-primary-foreground outline-none hover:opacity-90 data-focus-visible:ring-2 data-focus-visible:ring-ring"
        >
          <Icon name="play" size={12} sw={2} />
        </PlainButton>
        <span className="font-semibold">{scene?.name ?? 'Scene'}</span>
        <span className="text-muted-foreground tabular-nums">
          {frameAt != null ? `${(frameAt / 1000).toFixed(2)}s` : 'At rest'} · {(total / 1000).toFixed(2)}s
        </span>
        {frameAt != null ? (
          <PlainButton onPress={() => onFrameAt(null)} className="ml-auto cursor-pointer rounded-md border-0 bg-secondary px-2 py-1 text-caption outline-none hover:bg-secondary-strong data-focus-visible:ring-2 data-focus-visible:ring-ring">
            Let go (Esc)
          </PlainButton>
        ) : <span className="ml-auto text-muted-foreground">Drag on the timeline to scrub · drag a bar to move it</span>}
      </div>

      <div
        className="relative min-h-0 flex-1 overflow-y-auto"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onPointerLeave={() => setHover(null)}
      >
        {/* The ruler */}
        <div className="sticky top-0 z-10 flex h-6 border-b border-border bg-card">
          <div className="shrink-0 border-r border-border" style={{ width: LABEL_W }} />
          <div className="relative flex-1 cursor-ew-resize">
            {ticks.map((ms) => (
              <span key={ms} className="absolute top-0 h-full border-l border-border/70" style={{ left: ms * pxPerMs }}>
                {ms % (ticks[1] * 2 || 1) === 0 ? <span className="absolute top-1 left-1 text-caption2 text-muted-foreground tabular-nums">{ms === 0 ? '0' : `${ms / 1000}s`}</span> : null}
              </span>
            ))}
          </div>
        </div>

        {tracks.length ? tracks.map((t) => {
          const on = selected.includes(t.node.id);
          const tr = t.node.motion!.appear!.transition;
          const len = sample(tr).duration;
          return (
            <div key={t.node.id} className={cn('flex border-b border-border/60', on && 'bg-primary/6')} style={{ height: ROW_H }}>
              <PlainButton
                onPress={() => b.selectNode(t.node.id)}
                className={cn('flex shrink-0 cursor-pointer items-center gap-1.5 truncate border-0 border-r border-border bg-transparent px-2 text-left text-caption outline-none data-focus-visible:ring-2 data-focus-visible:ring-ring data-focus-visible:ring-inset', on ? 'font-semibold text-primary' : 'text-foreground')}
                style={{ width: LABEL_W }}
              >
                <span className="truncate">{nodeLabel(t.node, b.doc)}</span>
                {t.slots.length > 1 ? <span className="shrink-0 text-muted-foreground">×{t.slots.length}</span> : null}
              </PlainButton>
              <div className="relative flex-1 cursor-ew-resize">
                {t.slots.map((s, i) => (
                  <Bar key={i} node={t.node.id} first={i === 0} left={s.start * pxPerMs} width={Math.max(4, len * pxPerMs)} spec={s.transition} selected={on} title={describe(tr)} />
                ))}
              </div>
            </div>
          );
        }) : (
          <div className="px-3 py-5 text-muted-foreground">
            Nothing in {scene?.name ?? 'this scene'} animates in yet. Give an element an Appear effect in the Motion inspector and it shows up here, on the scene's clock.
          </div>
        )}

        {/* The playhead: where the canvas is held, or where the pointer would scrub to. */}
        {playhead != null ? (
          <span
            aria-hidden="true"
            className={cn('pointer-events-none absolute top-0 bottom-0 z-20 w-px', frameAt != null ? 'bg-primary' : 'bg-primary/40')}
            style={{ left: LABEL_W + playhead * pxPerMs }}
          >
            {frameAt != null ? <span className="absolute -top-px -left-[5px] size-[11px] rotate-45 rounded-[2px] bg-primary" /> : null}
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** One instance's bar: when it runs, and its curve (progress over time, a spring's overshoot above the top). */
function Bar({ node, first, left, width, spec, selected, title }: { node: string; first: boolean; left: number; width: number; spec: TransitionSpec; selected: boolean; title: string }) {
  const path = useMemo(() => {
    const s = sample(spec);
    const n = 32;
    const pts = Array.from({ length: n + 1 }, (_, i) => {
      const v = s.at((s.duration * i) / n);
      return `${((i / n) * 100).toFixed(2)},${(100 - v * 70).toFixed(2)}`;
    });
    return `M ${pts.join(' L ')}`;
  }, [spec]);
  return (
    <div
      data-ib-bar={first ? node : undefined}
      title={title}
      className={cn(
        'absolute top-1 bottom-1 overflow-hidden rounded-md',
        first ? 'cursor-grab active:cursor-grabbing' : 'pointer-events-none',
        selected ? 'bg-primary/22 ring-1 ring-primary' : 'bg-primary/12',
        !first && 'opacity-60',
      )}
      style={{ left, width }}
    >
      <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
        <path d={path} fill="none" stroke="var(--primary)" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
      </svg>
      {first ? <span className="absolute inset-y-1 right-0.5 w-1 rounded-full bg-primary/50" /> : null}
    </div>
  );
}
