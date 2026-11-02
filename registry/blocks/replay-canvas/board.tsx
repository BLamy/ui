'use client';
/* The board: every page and layer state as a frame on the core Canvas, named above like a design tool's frames, and
   segues drawn from where the click landed to what it opened, labelled with what was clicked. Click a frame or a
   segue (its line or its label) to select it; double-click a frame to zoom to it. Selecting dims everything that
   isn't connected to the selection. */
import { useMemo, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { Canvas, CanvasFrame, useCanvas } from '@/components/ui/canvas';
import { fitCamera, unionRect, type Camera, type Rect } from '@/lib/canvas-math';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import type { AppMap, OverlayType, Recording, SegueKind } from './analyze';
import { ScreenFrame } from './frame';
import { frameKey, seguePath, type Crops, type FrameBox, type SeguePath } from './layout';

export type Selection = { kind: 'frame'; key: string } | { kind: 'segue'; id: string } | null;

export const LAYER_ICON: Record<OverlayType, string> = {
  dialog: 'square-on-square', menu: 'list', sheet: 'sidebar', popover: 'quote-bubble', toast: 'bell', panel: 'layers',
};

const SEGUE_STROKE: Record<SegueKind, string> = {
  navigate: 'stroke-primary', present: 'stroke-chart-2', update: 'stroke-warning', dismiss: 'stroke-muted-foreground',
};
const SEGUE_FILL: Record<SegueKind, string> = {
  navigate: 'fill-primary', present: 'fill-chart-2', update: 'fill-warning', dismiss: 'fill-muted-foreground',
};
const SEGUE_PILL: Record<SegueKind, string> = {
  navigate: 'bg-primary text-primary-foreground', present: 'bg-chart-2 text-background', update: 'bg-warning text-background', dismiss: 'bg-secondary text-muted-foreground',
};

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
  /** Which evidence each frame shows (index into its state's evidence), by frame key. */
  shown: Record<string, number>;
}

export function Board({ map, boxes, recordings, viewport, crops, onCrop, camera, onCameraChange, selection, onSelect, showDismiss, shown }: BoardProps) {
  const [hover, setHover] = useState<string | null>(null);
  const byKey = useMemo(() => new Map(boxes.map((b) => [b.key, b])), [boxes]);
  const paths = useMemo(() => {
    const out: SeguePath[] = [];
    for (const s of map.segues) {
      if (s.kind === 'dismiss' && !showDismiss) continue;
      const from = byKey.get(frameKey(s.from)), to = byKey.get(frameKey(s.to));
      if (from && to) out.push(seguePath(s, from, to, crops));
    }
    return out;
  }, [map.segues, byKey, crops, showDismiss]);
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
    if (segue) return { kind: 'segue', id: segue } as const;
    const frame = el.closest?.('[data-rc-frame]')?.getAttribute('data-rc-frame');
    return frame ? ({ kind: 'frame', key: frame } as const) : null;
  };

  const selectedBox = selection?.kind === 'frame' ? byKey.get(selection.key) : undefined;
  return (
    <Canvas
      aria-label="App map"
      camera={camera}
      onCameraChange={onCameraChange}
      fit={fit}
      className="size-full bg-secondary"
      onCanvasPointerDown={(e) => onSelect(pick(e))}
      onCanvasPointerMove={(e) => {
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
        const dim = related && !related.frames.has(box.key);
        return (
          <div key={box.key} className={cn('transition-opacity duration-200', dim && 'opacity-35')}>
            <FrameTitle box={box} />
            <div
              data-rc-frame={box.key}
              className={cn('absolute overflow-hidden', node.kind === 'page' ? 'bg-background shadow-lg' : 'drop-shadow-xl')}
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
      <Segues paths={paths} related={related?.segues ?? null} hover={hover} />
      {selectedBox && <CanvasFrame frame={{ ...selectedBox, rot: 0 }} />}
    </Canvas>
  );
}

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
        title={node.kind === 'overlay' ? node.type : node.route}
        className="absolute bottom-0 left-0 flex origin-bottom-left items-center gap-1.5 overflow-hidden whitespace-nowrap pb-1.5 text-footnote text-muted-foreground"
        style={{ transform: `scale(${1 / zoom})`, maxWidth: width }}
      >
        <Icon name={node.kind === 'page' ? 'doc' : LAYER_ICON[node.type]} size={13} sw={1.9} className="shrink-0" />
        {/* A later state is named by what it shows; its layer or page is the frame before it. */}
        <span className="truncate font-semibold text-foreground">{named ? state.label : node.label}</span>
        {roomy && node.kind === 'page' && node.route && <span className="shrink-0 rounded-ctl bg-background px-1.5 font-mono text-caption1">{node.route}</span>}
        {roomy && node.kind === 'overlay' && <span className="shrink-0 text-caption1 uppercase tracking-wide">{node.type}</span>}
        {roomy && seen > 1 && <span className="shrink-0 text-caption1">· seen in {seen}</span>}
      </div>
    </div>
  );
}

function Segues({ paths, related, hover }: { paths: SeguePath[]; related: Set<string> | null; hover: string | null }) {
  const { zoom } = useCanvas();
  const w = 2 / zoom;
  const head = 12 / zoom;
  return (
    <>
      <svg className="pointer-events-none absolute top-0 left-0 overflow-visible" width={1} height={1} aria-hidden="true">
        {paths.map(({ segue: s, d, start, end, angle }) => {
          const on = hover === s.id || related?.has(s.id);
          const dim = related && !related.has(s.id);
          const a1 = angle + Math.PI - 0.45, a2 = angle + Math.PI + 0.45;
          return (
            <g key={s.id} className={cn('transition-opacity duration-200', dim && 'opacity-20')}>
              <path d={d} fill="none" className="[pointer-events:stroke] stroke-transparent" strokeWidth={14 / zoom} data-rc-segue={s.id} />
              <path d={d} fill="none" className={SEGUE_STROKE[s.kind]} strokeWidth={on ? w * 1.8 : w} strokeDasharray={s.kind === 'dismiss' ? `${6 / zoom} ${5 / zoom}` : undefined} />
              <circle cx={start.x} cy={start.y} r={on ? 7 / zoom : 5 / zoom} className={cn(SEGUE_FILL[s.kind], 'stroke-background')} strokeWidth={2 / zoom} />
              <path
                d={`M ${end.x} ${end.y} L ${end.x + Math.cos(a1) * head} ${end.y + Math.sin(a1) * head} L ${end.x + Math.cos(a2) * head} ${end.y + Math.sin(a2) * head} Z`}
                className={SEGUE_FILL[s.kind]}
              />
            </g>
          );
        })}
      </svg>
      {paths.map(({ segue: s, mid }) => {
        const on = hover === s.id || related?.has(s.id);
        const dim = related && !related.has(s.id);
        // Labels crowd a zoomed-out board: there they show for the hovered segue and the selection's.
        if (zoom < LABEL_ZOOM && !on) return null;
        const recs = new Set(s.evidence.map((e) => e.recording)).size;
        return (
          <div key={s.id} className="absolute" style={{ left: mid.x, top: mid.y }}>
            <div
              data-rc-segue={s.id}
              className={cn(
                'absolute flex cursor-pointer items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-caption1 font-medium shadow-md transition-opacity duration-200',
                SEGUE_PILL[s.kind], dim && 'opacity-25', on && 'ring-2 ring-background',
              )}
              style={{ transform: `translate(-50%, -50%) scale(${1 / zoom})` }}
            >
              <span>{actionVerb(s.action)} “{s.label}”</span>
              {recs > 1 && <span className="rounded-full bg-background/25 px-1.5">×{recs}</span>}
            </div>
          </div>
        );
      })}
    </>
  );
}
