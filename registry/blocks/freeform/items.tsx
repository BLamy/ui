/* How each kind of item draws on the board. All are absolutely placed in board units inside the canvas's scaled
   layer; none take pointer events (the canvas hits them by geometry), except the text being edited. */
import { memo, useEffect, useId, useLayoutEffect, useRef, type CSSProperties } from 'react';
import { StrokePath } from '@/components/ui/pencilkit/stroke-path';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { connectorGeometry, type Pt } from './geometry';
import { type BoxItem, type ConnectorItem, type ImageItem, type Item, type LinkItem, type ShapeItem, type StickyItem, type StrokeItem, type TextItem } from './model';
import { ART, LINK_ACCENT, SCENE } from './palette';
import { shapePath } from './shapes';

const frameStyle = (i: { x: number; y: number; w: number; h: number; rot: number }): CSSProperties => ({
  left: i.x, top: i.y, width: i.w, height: i.h, transform: i.rot ? `rotate(${i.rot}deg)` : undefined,
});

/* ── Text that edits in place ── */

/** Plain text that becomes editable in place. While editing the DOM owns the text (React renders nothing inside),
    so typing never fights a re-render; on blur it hands the text back and clears itself for React to redraw. */
export function EditableText({ value, editing, onCommit, onInput, className, style, selectAll = true }: {
  value: string; editing: boolean; onCommit: (text: string) => void; onInput?: (el: HTMLElement) => void;
  className?: string; style?: CSSProperties; selectAll?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!editing || !el) return;
    el.textContent = value;
    el.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    if (!selectAll) range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
    // Only when editing starts: later edits are the DOM's.
  }, [editing]);
  const done = () => {
    const el = ref.current;
    if (!el) return;
    const text = (el.innerText ?? el.textContent ?? '').replace(/\n$/, '');
    el.textContent = '';
    onCommit(text);
  };
  return (
    <div
      ref={ref}
      data-editing={editing || undefined}
      contentEditable={editing ? 'plaintext-only' : undefined}
      suppressContentEditableWarning
      spellCheck={editing}
      onBlur={editing ? done : undefined}
      onInput={editing ? (e) => onInput?.(e.currentTarget) : undefined}
      // Esc or ⌘↵ finishes; other keys belong to the text (the canvas ignores them while editing).
      onKeyDown={editing ? (e) => { e.stopPropagation(); if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) { e.preventDefault(); e.currentTarget.blur(); } } : undefined}
      onPointerDown={editing ? (e) => e.stopPropagation() : undefined}
      className={cn('whitespace-pre-wrap break-words outline-none', editing && 'pointer-events-auto cursor-text select-text', className)}
      style={style}
    >
      {editing ? null : value}
    </div>
  );
}

interface EditProps { editing: boolean; onText: (id: string, text: string) => void; onGrow: (id: string, h: number) => void }

/* ── Boxes ── */

function Sticky({ item, editing, onText }: { item: StickyItem } & EditProps) {
  return (
    <div
      className="relative flex size-full items-center justify-center rounded-[3px] p-[14px] text-center shadow-[0_10px_18px_-8px] shadow-black/35"
      style={{ background: item.color }}
    >
      {/* A little light from the top-left, like paper. */}
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[3px] bg-linear-to-br from-white/30 via-transparent to-black/5" />
      <EditableText
        value={item.text} editing={editing} onCommit={(t) => onText(item.id, t)}
        className="max-h-full max-w-full overflow-hidden font-medium leading-[1.25] text-black/80"
        style={{ fontSize: item.size }}
      />
    </div>
  );
}

function Shape({ item, editing, onText }: { item: ShapeItem } & EditProps) {
  const stroke = item.stroke ?? 'currentColor';
  return (
    <div className="relative size-full" style={{ opacity: item.opacity }}>
      <svg className="absolute inset-0 overflow-visible" width={item.w} height={item.h} aria-hidden="true">
        <path
          d={shapePath(item.shape, item.w, item.h)}
          fill={item.fill ?? 'none'}
          stroke={item.sw ? stroke : 'none'}
          strokeWidth={item.sw}
          strokeDasharray={item.dashed ? `${item.sw * 3} ${item.sw * 2.4}` : undefined}
          strokeLinejoin="round"
        />
      </svg>
      <div className="absolute inset-[8%] flex items-center" style={{ justifyContent: item.align === 'left' ? 'flex-start' : item.align === 'right' ? 'flex-end' : 'center' }}>
        <EditableText
          value={item.text} editing={editing} onCommit={(t) => onText(item.id, t)}
          className={cn('max-h-full max-w-full overflow-hidden leading-[1.25]', item.fill && !item.textColor && 'text-black/80')}
          style={{ fontSize: item.size, fontWeight: item.bold ? 700 : 500, textAlign: item.align, color: item.textColor ?? undefined }}
        />
      </div>
    </div>
  );
}

function Text({ item, editing, onText, onGrow }: { item: TextItem } & EditProps) {
  return (
    <EditableText
      value={item.text} editing={editing} onCommit={(t) => onText(item.id, t)}
      // The box grows with its text.
      onInput={(el) => onGrow(item.id, el.offsetHeight)}
      className="w-full leading-[1.3]"
      style={{ fontSize: item.size, fontWeight: item.bold ? 700 : 400, fontStyle: item.italic ? 'italic' : undefined, textAlign: item.align, color: item.color ?? undefined }}
    />
  );
}

/** A generated picture: a sky gradient with a scene drawn over it. */
function ImageArt({ art }: { art: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  const a = ART[art % ART.length];
  return (
    <svg viewBox="0 0 100 70" preserveAspectRatio="xMidYMid slice" className="block size-full" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={a.from} /><stop offset="1" stopColor={a.to} /></linearGradient>
      </defs>
      <rect width="100" height="70" fill={`url(#${id})`} />
      {a.scene === 'sun' ? <><circle cx="68" cy="26" r="11" fill="white" opacity=".85" /><path d="M0 52 Q25 40 50 50 T100 46 V70 H0Z" fill="black" opacity=".22" /></> : null}
      {a.scene === 'hills' ? <><path d="M0 48 Q22 28 46 46 T100 40 V70 H0Z" fill="black" opacity=".2" /><path d="M0 58 Q30 44 60 56 T100 52 V70 H0Z" fill="black" opacity=".28" /></> : null}
      {a.scene === 'city' ? <g fill={SCENE.skyline} opacity=".75">{[[6, 34, 9], [17, 24, 10], [29, 40, 8], [39, 18, 11], [52, 32, 9], [64, 26, 10], [77, 38, 8], [87, 22, 9]].map(([x, y, w]) => <rect key={x} x={x} y={y} width={w} height={70 - y} />)}</g> : null}
      {a.scene === 'torii' ? <g fill={SCENE.torii}><rect x="26" y="26" width="5" height="34" /><rect x="69" y="26" width="5" height="34" /><rect x="20" y="22" width="60" height="6" rx="1" /><rect x="25" y="33" width="50" height="4" /></g> : null}
      {a.scene === 'waves' ? <><path d="M0 44 Q12 36 25 44 T50 44 T75 44 T100 44 V70 H0Z" fill="white" opacity=".3" /><path d="M0 54 Q12 46 25 54 T50 54 T75 54 T100 54 V70 H0Z" fill="white" opacity=".3" /></> : null}
      {a.scene === 'moon' ? <><circle cx="70" cy="22" r="9" fill={SCENE.moon} /><g fill="white" opacity=".8">{[[12, 12], [30, 24], [44, 10], [20, 40], [56, 30]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="0.9" />)}</g></> : null}
    </svg>
  );
}

function Image({ item }: { item: ImageItem }) {
  const polaroid = !!item.caption;
  return (
    <figure className={cn('m-0 flex size-full flex-col overflow-hidden shadow-[0_12px_24px_-10px] shadow-black/40', polaroid ? 'rounded-[3px] bg-white p-2' : 'rounded-[5px]')}>
      <div className="min-h-0 flex-1 overflow-hidden rounded-[2px]">
        {item.src ? <img src={item.src} alt="" draggable={false} className="block size-full object-cover" /> : <ImageArt art={item.art ?? 0} />}
      </div>
      {polaroid ? <figcaption className="shrink-0 pt-1.5 pb-0.5 text-center text-subhead font-medium text-black/75">{item.caption}</figcaption> : null}
    </figure>
  );
}

function LinkCard({ item }: { item: LinkItem }) {
  return (
    <div className="flex size-full items-center gap-3 rounded-card border border-border bg-card p-3 shadow-[0_8px_18px_-10px] shadow-black/30">
      <span className="grid size-[52px] shrink-0 place-items-center rounded-panel text-white" style={{ background: LINK_ACCENT }}><Icon name="globe" size={28} sw={1.8} /></span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="line-clamp-2 text-subhead leading-[1.25] font-semibold">{item.title}</span>
        <span className="truncate text-footnote text-muted-foreground">{item.url}</span>
      </span>
    </div>
  );
}

/* ── Strokes and connectors: drawn in board coordinates, so their boxes are zero-sized and overflow. ── */

function Stroke({ item }: { item: StrokeItem }) {
  return (
    <svg className="pointer-events-none absolute top-0 left-0 overflow-visible" width="1" height="1" aria-hidden="true">
      <StrokePath st={{ tool: item.tool, color: item.color, w: item.width, pen: item.pen, points: item.points, done: true }} />
    </svg>
  );
}

function arrowHead(tip: Pt, dir: Pt, size: number): string {
  const bx = tip.x - dir.x * size, by = tip.y - dir.y * size;
  const px = -dir.y * size * 0.55, py = dir.x * size * 0.55;
  return `${tip.x},${tip.y} ${bx + px},${by + py} ${bx - px},${by - py}`;
}

export function Connector({ item, byId, preview }: { item: ConnectorItem; byId: Map<string, Item>; preview?: boolean }) {
  const g = connectorGeometry(item, byId);
  const color = item.color ?? 'currentColor';
  const size = 9 + item.width * 2.6;
  return (
    <svg className="pointer-events-none absolute top-0 left-0 overflow-visible" width="1" height="1" aria-hidden="true" opacity={preview ? 0.7 : 1}>
      <path
        d={g.d} fill="none" stroke={color} strokeWidth={item.width} strokeLinecap="round" strokeLinejoin="round"
        strokeDasharray={item.dashed || preview ? `${item.width * 3} ${item.width * 2.6}` : undefined}
      />
      {item.heads !== 'none' ? <polygon points={arrowHead(g.end, g.endDir, size)} fill={color} stroke={color} strokeWidth="1" strokeLinejoin="round" /> : null}
      {item.heads === 'both' ? <polygon points={arrowHead(g.start, g.startDir, size)} fill={color} stroke={color} strokeWidth="1" strokeLinejoin="round" /> : null}
    </svg>
  );
}

/* ── One item ── */

const BoxView = memo(function BoxView({ item, editing, onText, onGrow }: { item: BoxItem } & EditProps) {
  return (
    <div data-item={item.id} className="pointer-events-none absolute" style={frameStyle(item)}>
      {item.kind === 'sticky' ? <Sticky item={item} editing={editing} onText={onText} onGrow={onGrow} />
        : item.kind === 'shape' ? <Shape item={item} editing={editing} onText={onText} onGrow={onGrow} />
        : item.kind === 'text' ? <Text item={item} editing={editing} onText={onText} onGrow={onGrow} />
        : item.kind === 'image' ? <Image item={item} />
        : <LinkCard item={item} />}
    </div>
  );
});

const StrokeView = memo(Stroke);

export function ItemView({ item, byId, editing, onText, onGrow }: { item: Item; byId: Map<string, Item> } & EditProps) {
  if (item.kind === 'connector') return <Connector item={item} byId={byId} />;
  if (item.kind === 'stroke') return <StrokeView item={item} />;
  return <BoxView item={item} editing={editing} onText={onText} onGrow={onGrow} />;
}

/** Keeps the board from scrolling the page behind it (wheel) — used by the canvas. */
export function useNonPassive(ref: React.RefObject<HTMLElement | null>, type: 'wheel', handler: (e: WheelEvent) => void) {
  const h = useRef(handler);
  h.current = handler;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fn = (e: WheelEvent) => h.current(e);
    el.addEventListener(type, fn, { passive: false });
    return () => el.removeEventListener(type, fn);
  }, [ref, type]);
}
