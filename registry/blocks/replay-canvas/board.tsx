'use client';
/* The board: every page and layer state as a frame on the core Canvas, named above like a design tool's frames, and
   segues drawn from where the click landed to what it opened, labelled with what was clicked. Click a frame or a
   segue (its line, its dot or its label) to select it; double-click a frame to zoom to it. Selecting dims everything
   that isn't connected to the selection. With arrows hidden only the dots where clicks landed stay; selecting one
   draws its arrow. Resting the pointer on a frame or a segue previews it in a hover card: what it is, where it was
   seen and how often.
   Segues are drawn per journey (a recording), each journey in its own color: a segue several journeys took is
   several curves side by side, each with its own dot. Pressing a dot follows that journey: its curves, numbered in
   the order it took them, stand out (arrows hidden or not), the frames it reached stay lit, and the rest fades, so
   zoomed out it reads as one path through the app. */
import { useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Canvas, CanvasFrame, CanvasMiniMap, useCanvas } from '@/components/ui/canvas';
import { HoverCard, HoverCardHeader, useHoverCard } from '@/components/ui/hover-card';
import { formatReplayTime } from '@/components/ui/replay-preview';
import { fitCamera, unionRect, type Camera, type Rect } from '@/lib/canvas-math';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import type { AppMap, ChromeType, Evidence, MapNode, OverlayType, Recording, Segue, SegueKind } from './analyze';
import { ScreenFrame } from './frame';
import { frameKey, seguePath, type Crops, type FrameBox } from './layout';

export type Selection = { kind: 'frame'; key: string } | { kind: 'segue'; id: string } | null;

export const LAYER_ICON: Record<OverlayType, string> = {
  dialog: 'square-on-square', menu: 'list', sheet: 'sidebar', popover: 'quote-bubble', toast: 'bell', panel: 'layers',
};
const CHROME_ICON: Record<ChromeType, string> = { header: 'list', nav: 'list', sidebar: 'sidebar', footer: 'list' };

/** A page, a layer or shared chrome, as an icon. */
export const nodeIcon = (n: MapNode) => (n.kind === 'page' ? 'doc' : n.kind === 'chrome' ? CHROME_ICON[n.type] : LAYER_ICON[n.type]);

const SEGUE_PILL: Record<SegueKind, string> = {
  navigate: 'bg-primary text-primary-foreground', present: 'bg-chart-2 text-background', update: 'bg-warning text-background', dismiss: 'bg-secondary text-muted-foreground',
};

/** What each kind of segue does, as the inspector and hover cards say it. */
export const KIND_TEXT: Record<SegueKind, string> = {
  navigate: 'Goes to another page',
  present: 'Opens a layer over the page',
  update: 'Changes what’s on screen',
  dismiss: 'Closes a layer',
};

/** A recording, as a journey through the app: its color on the board. */
export interface Journey {
  id: string;
  name: string;
  color: string;
}

/** Journey colors, in the order recordings are added. */
export const JOURNEY_COLORS = ['#0a84ff', '#ff9f0a', '#30d158', '#bf5af2', '#ff375f', '#64d2ff', '#ffd60a', '#ac8e68', '#5e5ce6', '#66d4cf'];

/** Screen px between the curves of journeys that took the same segue. */
const JOURNEY_SPACING = 7;

/** Below this zoom only the hovered and selected segues are labelled. */
const LABEL_ZOOM = 0.42;

export const actionVerb = (a: 'click' | 'contextmenu') => (a === 'contextmenu' ? 'Right-click' : 'Click');

export interface BoardProps {
  map: AppMap;
  boxes: FrameBox[];
  recordings: Map<string, Recording>;
  viewport: { w: number; h: number };
  crops: Crops;
  onCrop: (key: string, rect: Rect) => void;
  camera: Camera;
  onCameraChange: (c: Camera) => void;
  selection: Selection;
  onSelect: (s: Selection) => void;
  showDismiss: boolean;
  /** Draw every segue's arrow; off, only their dots show, and a selected segue's arrow. */
  showArrows: boolean;
  /** The board in a corner, the view outlined (press or drag on it to move there). */
  showMiniMap: boolean;
  /** Which evidence each frame shows (index into its state's evidence), by frame key. */
  shown: Record<string, number>;
  /** The recordings as journeys, with their colors. */
  journeys: Journey[];
  /** The journey being followed. */
  journey: string | null;
  onJourney: (id: string | null) => void;
}

export function Board({ map, boxes, recordings, viewport, crops, onCrop, camera, onCameraChange, selection, onSelect, showDismiss, showArrows, showMiniMap, shown, journeys, journey, onJourney }: BoardProps) {
  const [hover, setHover] = useState<string | null>(null);
  const byKey = useMemo(() => new Map(boxes.map((b) => [b.key, b])), [boxes]);
  // One hover card for the board, anchored to the frame or segue under the pointer.
  const peek = useHoverCard();
  const [peeked, setPeeked] = useState<Exclude<Selection, null> | null>(null);
  const peekAt = useRef<HTMLElement | null>(null);
  const onPeek = (e: ReactPointerEvent) => {
    if (e.pointerType === 'touch' || e.buttons) return;
    const el = (e.target as Element).closest?.('[data-rc-segue],[data-rc-frame]') as HTMLElement | null;
    if (!el) { peekAt.current = null; peek.triggerProps.onPointerLeave(e); return; }
    if (el === peekAt.current) return;
    peekAt.current = el;
    peek.close();
    const segue = el.getAttribute('data-rc-segue');
    setPeeked(segue ? { kind: 'segue', id: segue } : { kind: 'frame', key: el.getAttribute('data-rc-frame')! });
    peek.triggerProps.onPointerEnter(e);
  };
  // Each segue with its ends and the journeys that took it, in the recordings' order.
  const routes = useMemo(() => {
    const order = new Map(journeys.map((j, i) => [j.id, i]));
    const out: SegueRoute[] = [];
    for (const s of map.segues) {
      if (s.kind === 'dismiss' && !showDismiss) continue;
      const from = byKey.get(frameKey(s.from)), to = byKey.get(frameKey(s.to));
      const took = [...new Set(s.evidence.map((e) => e.recording))].filter((id) => order.has(id)).sort((a, b) => order.get(a)! - order.get(b)!);
      if (from && to) out.push({ segue: s, from, to, journeys: took });
    }
    return out;
  }, [map.segues, byKey, showDismiss, journeys]);

  // The journey being followed: its segues in the order it took them, and the frames it reached.
  const followed = useMemo(() => {
    if (!journey) return null;
    const firstAt = (s: { evidence: Evidence[] }) => Math.min(...s.evidence.filter((e) => e.recording === journey).map((e) => e.time));
    const steps = map.segues.filter((s) => s.evidence.some((e) => e.recording === journey)).sort((a, b) => firstAt(a) - firstAt(b));
    const frames = new Set<string>();
    for (const n of [...map.pages, ...map.overlays, ...map.chrome]) {
      for (const st of n.states) if (st.evidence.some((e) => e.recording === journey)) frames.add(`${n.id}/${st.id}`);
    }
    for (const s of steps) { frames.add(frameKey(s.from)); frames.add(frameKey(s.to)); }
    return { step: new Map(steps.map((s, i) => [s.id, i + 1])), frames };
  }, [journey, map]);
  const fit = useMemo(() => unionRect(boxes), [boxes]);

  // What the selection touches: its segues and the frames at their ends.
  const related = useMemo(() => {
    if (!selection) return null;
    const segues = new Set<string>(), frames = new Set<string>();
    for (const s of map.segues) {
      const hit = selection.kind === 'segue' ? s.id === selection.id : frameKey(s.from) === selection.key || frameKey(s.to) === selection.key;
      if (hit) { segues.add(s.id); frames.add(frameKey(s.from)); frames.add(frameKey(s.to)); }
    }
    if (selection.kind === 'frame') frames.add(selection.key);
    return { segues, frames };
  }, [selection, map.segues]);

  const pick = (e: ReactPointerEvent | ReactMouseEvent) => {
    const el = e.target as Element;
    const segue = el.closest?.('[data-rc-segue]')?.getAttribute('data-rc-segue');
    // A journey's dot (or curve) follows that journey.
    const took = el.closest?.('[data-rc-journey]')?.getAttribute('data-rc-journey');
    if (took && e.type === 'pointerdown') onJourney(took);
    if (segue) return { kind: 'segue', id: segue } as const;
    const frame = el.closest?.('[data-rc-frame]')?.getAttribute('data-rc-frame');
    return frame ? ({ kind: 'frame', key: frame } as const) : null;
  };

  const selectedBox = selection?.kind === 'frame' ? byKey.get(selection.key) : undefined;
  return (
    // React derives pointer leave from the tree, so this box-less wrapper hears the pointer leave the board.
    <div className="contents" onPointerLeave={(e) => { peekAt.current = null; peek.triggerProps.onPointerLeave(e); }}>
      <Canvas
        aria-label="App map"
        camera={camera}
        onCameraChange={onCameraChange}
        fit={fit}
        className="size-full bg-secondary"
        overlay={showMiniMap && boxes.length ? (
          <CanvasMiniMap items={boxes.map((b) => ({
            id: b.key, x: b.x, y: b.y, w: b.w, h: b.h,
            className: selection?.kind === 'frame' && selection.key === b.key ? 'fill-primary' : related?.frames.has(b.key) ? 'fill-primary/45' : undefined,
          }))} />
        ) : null}
        onCanvasPointerDown={(e) => { peek.close(); const p = pick(e); if (!p) onJourney(null); onSelect(p); }}
        onNavigationStart={peek.close}
        onCanvasPointerMove={(e) => {
          onPeek(e);
          const p = pick(e);
          const next = p?.kind === 'segue' ? p.id : null;
          if (next !== hover) setHover(next);
        }}
        onCanvasDoubleClick={(e) => {
          const p = pick(e);
          const box = p?.kind === 'frame' ? byKey.get(p.key) : undefined;
          const host = (e.currentTarget as HTMLElement).getBoundingClientRect();
          if (box) onCameraChange(fitCamera({ ...box, y: box.y - 40, h: box.h + 40 }, { width: host.width, height: host.height }, 48));
        }}
      >
        {boxes.map((box, i) => {
          const node = box.node;
          const state = node.states.find((s) => s.id === box.state)!;
          const ev = state.evidence[Math.min(shown[box.key] ?? 0, state.evidence.length - 1)];
          const rec = ev && recordings.get(ev.recording);
          const dim = followed ? !followed.frames.has(box.key) : related && !related.frames.has(box.key);
          return (
            <div key={box.key} className={cn('transition-opacity duration-200', dim && 'opacity-35')}>
              <FrameTitle box={box} />
              <div
                data-rc-frame={box.key}
                className={cn('absolute overflow-hidden', node.kind === 'overlay' ? 'drop-shadow-xl' : 'bg-background shadow-lg')}
                style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
              >
                {rec && (
                  <ScreenFrame
                    key={`${ev.recording}@${ev.time}`}
                    events={rec.events}
                    evidence={ev}
                    viewport={viewport}
                    crop={crops[box.key]}
                    onCrop={(r) => onCrop(box.key, r)}
                    order={i}
                  />
                )}
              </div>
            </div>
          );
        })}
        <Segues routes={routes} crops={crops} journeys={journeys} related={related?.segues ?? null} hover={hover}
          followed={followed?.step ?? null} journey={journey} showArrows={showArrows} selected={selection?.kind === 'segue' ? selection.id : null} />
        {selectedBox && <CanvasFrame frame={{ ...selectedBox, rot: 0 }} />}
        {peeked && (
          <HoverCard {...peek.cardProps} triggerRef={peekAt} placement={peeked.kind === 'frame' ? 'end top' : 'top'}>
            <Peek target={peeked} map={map} byKey={byKey} recordings={recordings} />
          </HoverCard>
        )}
      </Canvas>
    </div>
  );
}

/** What a hover card says about a frame or a segue: what it is, how often it was seen, and in which recordings. */
function Peek({ target, map, byKey, recordings }: {
  target: Exclude<Selection, null>; map: AppMap; byKey: Map<string, FrameBox>; recordings: Map<string, Recording>;
}) {
  const nameOf = (key: string) => {
    const box = byKey.get(key);
    const state = box?.node.states.find((s) => s.id === box.state);
    return box ? (state && state.id !== 'base' && state.id !== 'open' ? state.label : box.node.label) : key;
  };
  const seen = (evidence: Evidence[]) => {
    const recs = [...new Set(evidence.map((e) => e.recording))];
    const first = evidence[0];
    return (
      <div className="mt-3 grid gap-1 text-footnote text-muted-foreground">
        <div>Seen {evidence.length}× in {recs.length} recording{recs.length === 1 ? '' : 's'}</div>
        {first && <div className="truncate">First at {formatReplayTime(first.time)} in {recordings.get(first.recording)?.name ?? first.recording}</div>}
      </div>
    );
  };
  if (target.kind === 'segue') {
    const s = map.segues.find((x) => x.id === target.id);
    if (!s) return null;
    return (
      <>
        <HoverCardHeader
          media={<span className={cn('grid size-9 place-items-center rounded-full', SEGUE_PILL[s.kind])}><Icon name={SEGUE_ICON[s.kind]} size={16} sw={2} /></span>}
          title={`${actionVerb(s.action)} “${s.label}”`}
          subtitle={KIND_TEXT[s.kind]}
        />
        <div className="mt-3 grid gap-1 text-footnote">
          <div className="truncate"><span className="text-muted-foreground">From </span>{nameOf(frameKey(s.from))}</div>
          <div className="truncate"><span className="text-muted-foreground">To </span>{nameOf(frameKey(s.to))}</div>
        </div>
        {seen(s.evidence)}
      </>
    );
  }
  const box = byKey.get(target.key);
  if (!box) return null;
  const node = box.node;
  const state = node.states.find((x) => x.id === box.state)!;
  return (
    <>
      <HoverCardHeader
        media={<span className="grid size-9 place-items-center rounded-ctl bg-secondary text-muted-foreground"><Icon name={nodeIcon(node)} size={17} sw={1.9} /></span>}
        title={nameOf(box.key)}
        subtitle={node.kind === 'page' ? node.route ?? 'Page'
          : node.kind === 'chrome' ? `Shared by ${node.pages.length} pages`
            : `${node.type} over ${nameOf(`${node.hosts[0]}/base`)}`}
      />
      {node.kind === 'chrome' && (
        <div className="mt-3 truncate text-footnote text-muted-foreground">{node.pages.map((id) => nameOf(`${id}/base`)).join(', ')}</div>
      )}
      {node.states.length > 1 && <div className="mt-3 text-footnote text-muted-foreground">{node.states.length} states · this is {node.states.indexOf(state) === 0 ? 'how it opens' : `“${state.label}”`}</div>}
      {seen(state.evidence)}
    </>
  );
}

/** What each kind of segue does, as a glyph (the board's colors are journeys). */
export const SEGUE_ICON: Record<SegueKind, string> = { navigate: 'arrow-right', present: 'square-on-square', update: 'arrow-clockwise', dismiss: 'xmark' };

/** A frame's name tag, above its top-left corner at a constant size on screen. */
function FrameTitle({ box }: { box: FrameBox }) {
  const { zoom } = useCanvas();
  const node = box.node;
  const state = node.states.find((s) => s.id === box.state)!;
  const seen = node.recordings.length;
  // As wide as the frame and the air after it on screen; the name keeps priority over the extras.
  const width = Math.max(64, (box.w + 200) * zoom);
  const roomy = width > 320;
  const named = state.id !== 'base' && state.id !== 'open';
  return (
    <div className="pointer-events-none absolute" style={{ left: box.x, top: box.y }}>
      <div
        title={node.kind === 'overlay' ? node.type : node.kind === 'chrome' ? `Shared by ${node.pages.length} pages` : node.route}
        className="absolute bottom-0 left-0 flex origin-bottom-left items-center gap-1.5 overflow-hidden whitespace-nowrap pb-1.5 text-footnote text-muted-foreground"
        style={{ transform: `scale(${1 / zoom})`, maxWidth: width }}
      >
        <Icon name={nodeIcon(node)} size={13} sw={1.9} className="shrink-0" />
        {/* A later state is named by what it shows; its layer or page is the frame before it. */}
        <span className="truncate font-semibold text-foreground">{named ? state.label : node.label}</span>
        {roomy && node.kind === 'page' && node.route && <span className="shrink-0 rounded-ctl bg-background px-1.5 font-mono text-caption1">{node.route}</span>}
        {roomy && node.kind === 'overlay' && <span className="shrink-0 text-caption1 uppercase tracking-wide">{node.type}</span>}
        {roomy && node.kind === 'chrome' && <span className="shrink-0 text-caption1 uppercase tracking-wide">shared · {node.pages.length} pages</span>}
        {roomy && seen > 1 && <span className="shrink-0 text-caption1">· seen in {seen}</span>}
      </div>
    </div>
  );
}

interface SegueRoute {
  segue: Segue;
  from: FrameBox;
  to: FrameBox;
  /** The journeys that took it, in the recordings' order. */
  journeys: string[];
}

/** Every journey's curve of every segue, side by side where several took one; labels once per segue. */
function Segues({ routes, crops, journeys, related, hover, followed, journey, showArrows, selected }: {
  routes: SegueRoute[]; crops: Crops; journeys: Journey[]; related: Set<string> | null; hover: string | null;
  /** The followed journey's step number per segue. */
  followed: Map<string, number> | null; journey: string | null; showArrows: boolean; selected: string | null;
}) {
  const { zoom } = useCanvas();
  const w = 2 / zoom;
  const head = 12 / zoom;
  const color = useMemo(() => new Map(journeys.map((j) => [j.id, j.color])), [journeys]);
  const curves = useMemo(() => routes.flatMap((r) => r.journeys.map((id, i) => ({
    route: r, journey: id, path: seguePath(r.segue, r.from, r.to, crops, (i - (r.journeys.length - 1) / 2) * (JOURNEY_SPACING / zoom)),
  }))), [routes, crops, zoom]);
  // What stands out: the followed journey, else the selection's segues.
  const lit = (segue: string, id: string) => (journey ? id === journey : !related || related.has(segue));
  // Arrows hidden: only the selected segue's and the followed journey's are drawn.
  const drawn = (segue: string, id: string) => showArrows || segue === selected || (journey === id && !!followed?.has(segue));
  return (
    <>
      <svg className="pointer-events-none absolute top-0 left-0 overflow-visible" width={1} height={1} aria-hidden="true">
        {curves.map(({ route: { segue: s }, journey: id, path: { d, start, end, angle } }) => {
          const on = hover === s.id || (journey ? id === journey : related?.has(s.id));
          const a1 = angle + Math.PI - 0.45, a2 = angle + Math.PI + 0.45;
          const c = color.get(id) ?? 'var(--muted-foreground)';
          return (
            <g key={`${s.id}:${id}`} data-rc-journey={id} className={cn('transition-opacity duration-200', !lit(s.id, id) && (journey ? 'opacity-10' : 'opacity-20'))}>
              {drawn(s.id, id) && (
                <>
                  <path d={d} fill="none" className="[pointer-events:stroke] stroke-transparent" strokeWidth={10 / zoom} data-rc-segue={s.id} />
                  <path d={d} fill="none" stroke={c} strokeWidth={on ? w * 1.8 : w} strokeDasharray={s.kind === 'dismiss' ? `${6 / zoom} ${5 / zoom}` : undefined} />
                  <path d={`M ${end.x} ${end.y} L ${end.x + Math.cos(a1) * head} ${end.y + Math.sin(a1) * head} L ${end.x + Math.cos(a2) * head} ${end.y + Math.sin(a2) * head} Z`} fill={c} />
                </>
              )}
              <circle cx={start.x} cy={start.y} r={(on ? 7 : 5) / zoom} fill={c} className="cursor-pointer stroke-background [pointer-events:all]" strokeWidth={2 / zoom} data-rc-segue={s.id} />
            </g>
          );
        })}
      </svg>
      {/* The followed journey's steps, numbered on its dots. */}
      {followed && curves.filter((cv) => cv.journey === journey && followed.has(cv.route.segue.id)).map(({ route: { segue: s }, path: { start } }) => (
        <div key={`step:${s.id}`} className="pointer-events-none absolute" style={{ left: start.x, top: start.y }}>
          <span data-rc-step={followed.get(s.id)} className="absolute grid size-5 place-items-center rounded-full text-caption2 font-bold text-white shadow-md ring-2 ring-background"
            style={{ background: color.get(journey!), transform: `translate(-50%, -50%) scale(${1 / zoom})` }}>
            {followed.get(s.id)}
          </span>
        </div>
      ))}
      {routes.map(({ segue: s, from, to, journeys: took }) => {
        if (!showArrows && s.id !== selected && !(journey && took.includes(journey))) return null;
        const on = hover === s.id || related?.has(s.id) || (!!journey && took.includes(journey));
        const dim = journey ? !took.includes(journey) : related && !related.has(s.id);
        // Labels crowd a zoomed-out board: there they show for the hovered segue and the selection's.
        if (zoom < LABEL_ZOOM && !(hover === s.id || related?.has(s.id))) return null;
        const mid = seguePath(s, from, to, crops).mid;
        return (
          <div key={s.id} className="absolute" style={{ left: mid.x, top: mid.y }}>
            <div
              data-rc-segue={s.id}
              className={cn(
                'absolute flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full bg-popover px-2.5 py-1 text-caption1 font-medium text-foreground shadow-md transition-opacity duration-200',
                dim && 'opacity-25', on && 'ring-2 ring-primary/40',
              )}
              style={{ transform: `translate(-50%, -50%) scale(${1 / zoom})` }}
            >
              <span className="flex -space-x-1">
                {took.map((id) => <span key={id} className="size-2 rounded-full ring-1 ring-popover" style={{ background: color.get(id) }} />)}
              </span>
              <span>{actionVerb(s.action)} “{s.label}”</span>
            </div>
          </div>
        );
      })}
    </>
  );
}
