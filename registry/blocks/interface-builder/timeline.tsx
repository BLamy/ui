/* The motion timeline, Framer's: every appear animation in the scene on one clock. A track per node, its bar from
   when it starts to when it comes to rest, drawn with its curve (a spring's overshoot rises above the bar); a
   repeated node's instances are its stagger. The clock is a slider (UI SDK's): press or drag on the ruler or the
   tracks, or focus its playhead and use the arrows, to scrub: the canvas holds that instant of the scene's appear
   (Esc lets go); Play runs it for real. The bars are `timelineBars` (UI SDK's spans): drag one, or focus it and use
   the arrows, to change when it starts (its delay); drag its end, or Shift with the arrows, to change how long it
   takes (a tween's duration, a spring's time). A click on a bar or a track's name selects its node. */
import { useMemo, useState, type CSSProperties } from 'react';
import { createParts } from '@ui-sdk/react/primitive';
import { Slider, SliderControl, SliderThumb, SliderTrack } from '@ui-sdk/react/slider';
import { PlainButton } from '@/components/ui/plain-button';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { appearSchedule, instanceKey, scheduleLength, type Slot } from './appear';
import { nodeLabel } from './catalog';
import { describe, sample, type TransitionSpec } from './easing';
import { valueOf } from './expr';
import type { Node } from './model';
import { designScope } from './scope';
import { useBuilder } from './store';
import { timelineBars, type TimelineBar, type TimelineBarsChangeDetails } from './timeline-bars';
import { walk } from './tree';

const LABEL_W = 168;
const ROW_H = 30;

const { Root: Bars, Track: BarTrack, Bar: BarPart } = createParts(timelineBars, { root: 'div', track: 'div', bar: 'div' });

interface Track {
  node: Node;
  /** Its instances' slots (one, or one per row of a repeat). */
  slots: Slot[];
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(2)}s`;
/** Whether a transition's length is its own to change: a tween's duration, a time spring's. */
const stretches = (t: TransitionSpec) => t.type === 'tween' || (t.type === 'spring' && t.mode === 'time');

export function Timeline({ sceneId, frameAt, onFrameAt, onPlay }: { sceneId: string; frameAt: number | null; onFrameAt: (ms: number | null) => void; onPlay: () => void }) {
  const b = useBuilder();
  const scene = b.doc.scenes.find((s) => s.id === sceneId) ?? null;
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

  // Each track's first instance is its bar; the rest of a repeat follow it.
  const bars = useMemo<TimelineBar[]>(() => tracks.map((t) => {
    const start = t.slots[0].start;
    const end = start + Math.max(10, sample(t.node.motion!.appear!.transition).duration);
    return { id: t.node.id, track: t.node.id, start, end, resizable: stretches(t.node.motion!.appear!.transition), label: `${nodeLabel(t.node, b.doc)}, ${seconds(start)} to ${seconds(end)}` };
  }), [tracks, b.doc]);

  // A bar that moved changes its delay; one that stretched, its duration.
  const onBarsChange = (next: TimelineBar[], details: TimelineBarsChangeDetails) => {
    const bar = next.find((x) => x.id === details.id);
    const was = bars.find((x) => x.id === details.id);
    if (!bar || !was) return;
    const moved = (bar.start - was.start) / 1000;
    const stretched = details.action === 'resize' ? (bar.end - bar.start - (was.end - was.start)) / 1000 : 0;
    b.updateNode(bar.id, (n) => {
      const a = n.motion?.appear;
      if (!a) return n;
      const t = a.transition;
      const delay = Math.max(0, Math.round((t.delay + moved) * 100) / 100);
      const transition = stretched && t.type !== 'instant' ? { ...t, delay, duration: Math.max(0.05, Math.round((t.duration + stretched) * 100) / 100) } : { ...t, delay };
      return { ...n, motion: { ...n.motion, appear: { ...a, transition } } };
    });
  };

  const selected = b.selection.kind === 'node' ? b.selection.ids : [];
  const ticks = useMemo(() => {
    const step = total <= 1500 ? 100 : total <= 4000 ? 250 : 500;
    return Array.from({ length: Math.floor(total / step) + 1 }, (_, i) => i * step);
  }, [total]);
  const playhead = frameAt ?? hover;
  const at = (ms: number) => `${(ms / total) * 100}%`;
  /** Where an instant sits across the whole row (the label column, then the lane). */
  const across = (ms: number) => `calc(${LABEL_W}px + (100% - ${LABEL_W}px) * ${ms / total})`;

  return (
    <div
      data-slot="ib-timeline"
      className="relative flex max-h-64 min-h-28 flex-col text-caption select-none"
      onKeyDown={(e) => { if (e.key === 'Escape' && frameAt != null) { e.preventDefault(); onFrameAt(null); } }}
    >
      <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border px-2">
        <PlainButton
          aria-label="Play the appear"
          onClick={() => { onFrameAt(null); onPlay(); }}
          className="grid size-7 cursor-pointer place-items-center rounded-md border-0 bg-primary text-primary-foreground outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon name="play" size={12} sw={2} />
        </PlainButton>
        <span className="font-semibold">{scene?.name ?? 'Scene'}</span>
        <span className="text-muted-foreground tabular-nums">
          {frameAt != null ? seconds(frameAt) : 'At rest'} · {seconds(total)}
        </span>
        {frameAt != null ? (
          <PlainButton onClick={() => onFrameAt(null)} className="ml-auto cursor-pointer rounded-md border-0 bg-secondary px-2 py-1 text-caption outline-none hover:bg-secondary-strong focus-visible:ring-2 focus-visible:ring-ring">
            Let go (Esc)
          </PlainButton>
        ) : <span className="ml-auto text-muted-foreground">Drag on the timeline to scrub · drag a bar to move it</span>}
      </div>

      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <div
          className="relative min-h-full"
          onPointerMove={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            const f = (e.clientX - r.left - LABEL_W) / (r.width - LABEL_W);
            setHover(e.buttons || f < 0 ? null : Math.min(1, f) * total);
          }}
          onPointerLeave={() => setHover(null)}
        >
          {/* The clock: the ruler and the empty stretches of the tracks are its press area, the playhead its thumb. */}
          <Slider
            value={frameAt ?? 0}
            onValueChange={(v) => onFrameAt(Math.round(v as number))}
            min={0}
            max={total}
            step={10}
            largeStep={100}
            format={(ms) => seconds(ms)}
            className="absolute inset-y-0 right-0"
            style={{ left: LABEL_W }}
          >
            <SliderControl className="absolute inset-0 cursor-ew-resize touch-none">
              {/* The rail is the ruler's band, so the playhead's head stays on the ruler as the tracks scroll. */}
              <SliderTrack className="sticky top-0 block h-6 w-full">
                <SliderThumb
                  aria-label="Scrub"
                  className={cn(
                    'z-30 h-6 w-3 outline-none',
                    'after:absolute after:-top-px after:left-px after:size-[11px] after:rotate-45 after:rounded-[2px] after:bg-primary after:content-[""]',
                    'has-focus-visible:after:ring-2 has-focus-visible:after:ring-ring',
                    frameAt == null && 'not-has-focus-visible:opacity-0',
                  )}
                />
              </SliderTrack>
            </SliderControl>
          </Slider>

          {/* The ruler */}
          <div className="pointer-events-none sticky top-0 z-10 flex h-6 border-b border-border bg-card">
            <div className="shrink-0 border-r border-border" style={{ width: LABEL_W }} />
            <div className="relative flex-1">
              {ticks.map((ms) => (
                <span key={ms} className="absolute top-0 h-full border-l border-border/70" style={{ left: at(ms) }}>
                  {ms % (ticks[1] * 2 || 1) === 0 ? <span className="absolute top-1 left-1 text-caption2 text-muted-foreground tabular-nums">{ms === 0 ? '0' : `${ms / 1000}s`}</span> : null}
                </span>
              ))}
            </div>
          </div>

          {tracks.length ? (
            <Bars bars={bars} onBarsChange={onBarsChange} max={total} step={10} className="pointer-events-none relative">
              {({ bars: shown }) => tracks.map((t) => {
                const on = selected.includes(t.node.id);
                const tr = t.node.motion!.appear!.transition;
                const len = sample(tr).duration;
                const bar = shown.find((x) => x.id === t.node.id)!;
                return (
                  <div key={t.node.id} className={cn('flex border-b border-border/60', on && 'bg-primary/6')} style={{ height: ROW_H }}>
                    <PlainButton
                      onClick={() => b.selectNode(t.node.id)}
                      className={cn('pointer-events-auto flex shrink-0 cursor-pointer items-center gap-1.5 truncate border-0 border-r border-border bg-card px-2 text-left text-caption outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset', on ? 'font-semibold text-primary' : 'text-foreground')}
                      style={{ width: LABEL_W }}
                    >
                      <span className="truncate">{nodeLabel(t.node, b.doc)}</span>
                      {t.slots.length > 1 ? <span className="shrink-0 text-muted-foreground">×{t.slots.length}</span> : null}
                    </PlainButton>
                    <BarTrack value={t.node.id} className="flex-1">
                      {/* The rest of a repeat: its stagger, following the bar. */}
                      {t.slots.slice(1).map((s, i) => (
                        <BarCurve key={i} spec={s.transition} className="absolute top-1 bottom-1 min-w-1 opacity-60" style={{ left: at(s.start + bar.start - t.slots[0].start), width: at(len) }} selected={on} />
                      ))}
                      <BarPart
                        value={t.node.id}
                        title={describe(tr)}
                        onClick={() => b.selectNode(t.node.id)}
                        className={cn(
                          'pointer-events-auto top-1 bottom-1 min-w-1 cursor-grab overflow-hidden rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring data-dragging:cursor-grabbing',
                          on ? 'bg-primary/22 ring-1 ring-primary' : 'bg-primary/12',
                        )}
                      >
                        <BarCurve spec={t.slots[0].transition} />
                        {bar.resizable ? <span data-span-edge="end" className="absolute inset-y-0 right-0 w-2 cursor-ew-resize after:absolute after:inset-y-1 after:right-0.5 after:w-1 after:rounded-full after:bg-primary/50 after:content-['']" /> : null}
                      </BarPart>
                    </BarTrack>
                  </div>
                );
              })}
            </Bars>
          ) : (
            <div className="relative px-3 py-5 text-muted-foreground">
              Nothing in {scene?.name ?? 'this scene'} animates in yet. Give an element an Appear effect in the Motion inspector and it shows up here, on the scene's clock.
            </div>
          )}

          {/* The playhead: where the canvas is held, or where the pointer would scrub to. */}
          {playhead != null ? (
            <span
              aria-hidden="true"
              className={cn('pointer-events-none absolute top-0 bottom-0 z-20 w-px', frameAt != null ? 'bg-primary' : 'bg-primary/40')}
              style={{ left: across(playhead) }}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** One instance's curve: progress over time across its bar, a spring's overshoot above the top. Inside a bar it
    fills it; on its own (the rest of a repeat) it is the bar. */
function BarCurve({ spec, selected, className, style }: { spec: TransitionSpec; selected?: boolean; className?: string; style?: CSSProperties }) {
  const path = useMemo(() => {
    const s = sample(spec);
    const n = 32;
    const pts = Array.from({ length: n + 1 }, (_, i) => {
      const v = s.at((s.duration * i) / n);
      return `${((i / n) * 100).toFixed(2)},${(100 - v * 70).toFixed(2)}`;
    });
    return `M ${pts.join(' L ')}`;
  }, [spec]);
  const svg = (
    <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible">
      <path d={path} fill="none" stroke="var(--primary)" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
    </svg>
  );
  if (!className) return svg;
  return <span aria-hidden="true" className={cn('overflow-hidden rounded-md', selected ? 'bg-primary/22 ring-1 ring-primary' : 'bg-primary/12', className)} style={style}>{svg}</span>;
}
