import {
  Children, cloneElement, createContext, isValidElement, use, useEffect, useId, useLayoutEffect, useRef, useState,
  type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type ReactElement,
  type ReactNode,
} from 'react';
import {
  AnimatePresence, MotionConfig, Reorder, animate, motion, useDragControls, useMotionValue, useReducedMotion, useTransform,
  type AnimationPlaybackControls, type DragControls,
} from 'framer-motion';
import { Haptics } from '../lib/haptics';
import { Icon, IC } from '../lib/icon';
import { springs } from '../lib/motion';
import { chromeOffset, BLStickyCtx, useChromeHidden } from '../lib/theme';
import { cn } from '../lib/utils';
import { Slider } from './slider';
import { Switch } from './switch';

/* ══ List primitives (prototype BLList / BLSection / BLRow) ══
   A list works out its own sticky offset: whatever chrome sits above it (nav bar, none, …) plus its own
   header if it has one. `stickyTop` overrides both. */

export interface ListProps {
  children?: ReactNode;
  inset?: boolean;
  header?: ReactNode;
  stickyTop?: number;
  className?: string;
  style?: CSSProperties;
}

function ListBase({ children, inset, header, stickyTop, className, style }: ListProps) {
  const hRef = useRef<HTMLDivElement | null>(null);
  const [hh, setHh] = useState(0);
  const above = use(BLStickyCtx);
  const chromeHid = useChromeHidden();
  useLayoutEffect(() => {
    const el = hRef.current;
    if (!el) { setHh(0); return; }
    const m = () => setHh(el.offsetHeight); m();
    if (typeof ResizeObserver !== 'undefined') { const ro = new ResizeObserver(m); ro.observe(el); return () => ro.disconnect(); }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [header]);
  const top = stickyTop != null ? stickyTop : above + (header ? hh : 0);
  return (
    <BLStickyCtx.Provider value={top}>
      <div data-slot="list" className={cn(inset ? 'px-4 py-0' : 'p-0', className)} style={style}>
        {header ? (
          <div ref={hRef} className="sticky z-24 bg-bl-stick backdrop-blur-[10px] transition-[top] duration-spring-smooth ease-spring-smooth"
            style={{ top: chromeOffset(above, chromeHid) }}>{header}</div>
        ) : null}
        {children}
      </div>
    </BLStickyCtx.Provider>
  );
}

/* ── Section ── */

/** What a section tells each of its rows when it animates or reorders them. */
interface RowSlot {
  index: number;
  count: number;
  /** Present when the section has `onReorder`: the row shows a grip. */
  startDrag?: (e: ReactPointerEvent) => void;
  move?: (to: number) => void;
  dragging?: boolean;
}
const RowSlotCtx = createContext<RowSlot | null>(null);

export interface ListSectionProps {
  title?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  sticky?: boolean;
  innerRef?: (el: HTMLDivElement | null) => void;
  stickyTop?: number;
  /** Rows spring in on insert, collapse out on remove, and slide to their new place on reorder. Children must
   *  be keyed. Implied by `onReorder`. */
  animate?: boolean;
  /** Drag-to-reorder: every row shows a grip (drag it, or focus it and press ↑/↓). Called once per drop with
   *  the row's old and new index; reorder your data to match. Pass it only while reordering is allowed
   *  (say, in edit mode). */
  onReorder?: (from: number, to: number) => void;
  className?: string;
  style?: CSSProperties;
}

export function ListSection({
  title, footer, children, sticky, innerRef, stickyTop, animate: anim, onReorder, className, style,
}: ListSectionProps) {
  const ctxTop = use(BLStickyCtx);
  const top = chromeOffset(stickyTop != null ? stickyTop : ctxTop, useChromeHidden());
  const animated = !!(anim || onReorder);
  return (
    <div ref={innerRef} data-slot="list-section" className={cn(className)} style={style}>
      {title != null ? (sticky
        ? <div className="sticky z-20 bg-bl-stick px-4 py-[3px] text-[13.5px] font-semibold text-foreground backdrop-blur-[10px] transition-[top] duration-spring-smooth ease-spring-smooth"
            style={{ top }}>{title}</div>
        : <div className="px-4 pt-1 pb-[7px] text-[12.5px] font-medium tracking-[.4px] text-muted-foreground uppercase">{title}</div>) : null}
      <div className={cn('overflow-hidden', sticky ? 'rounded-none' : 'rounded-[12px]')}>
        {animated ? <AnimatedRows onReorder={onReorder}>{children}</AnimatedRows> : children}
      </div>
      {footer ? <div className="px-4 pt-[7px] pb-0 text-[12.8px] leading-[1.45] text-muted-foreground">{footer}</div> : null}
      <div className={sticky ? 'h-0' : 'h-[22px]'} />
    </div>
  );
}

function AnimatedRows({ children, onReorder }: { children?: ReactNode; onReorder?: (from: number, to: number) => void }) {
  const items = Children.toArray(children).filter(isValidElement) as ReactElement[];
  const keys = items.map((c) => String(c.key));
  // While a drag is in flight the section owns the order; the drop hands it back to the caller.
  const [order, setOrder] = useState<string[] | null>(null);
  const live = order && order.length === keys.length && order.every((k) => keys.includes(k)) ? order : keys;
  const byKey = new Map(items.map((c) => [String(c.key), c]));
  const reduced = useReducedMotion();
  const drop = (key: string) => {
    const from = keys.indexOf(key), to = live.indexOf(key);
    setOrder(null);
    if (from >= 0 && to >= 0 && from !== to) onReorder?.(from, to);
  };
  return (
    <MotionConfig reducedMotion="user">
      <Reorder.Group as="div" axis="y" values={live}
        onReorder={(next: string[]) => { if (next.join() !== live.join()) { Haptics.selection(); setOrder(next); } }}>
        <AnimatePresence initial={false}>
          {live.map((k, i) => (
            <AnimatedRow key={k} value={k} index={i} count={live.length} reduced={!!reduced}
              reorder={onReorder ? { drop, move: (to) => {
                const t = Math.max(0, Math.min(keys.length - 1, to));
                if (t === i) return;
                Haptics.selection(); onReorder(i, t);
              } } : undefined}>
              {byKey.get(k)}
            </AnimatedRow>
          ))}
        </AnimatePresence>
      </Reorder.Group>
    </MotionConfig>
  );
}

function AnimatedRow({ value, index, count, reduced, reorder, children }: {
  value: string; index: number; count: number; reduced: boolean;
  reorder?: { drop: (key: string) => void; move: (to: number) => void };
  children?: ReactNode;
}) {
  const controls: DragControls = useDragControls();
  const [dragging, setDragging] = useState(false);
  const slot: RowSlot = {
    index, count, dragging,
    startDrag: reorder ? (e) => { setDragging(true); controls.start(e); } : undefined,
    move: reorder?.move,
  };
  return (
    <Reorder.Item as="div" value={value} dragListener={false} dragControls={controls}
      className="relative"
      // Insert grows from nothing, remove collapses to nothing; neighbours ride the layout spring.
      initial={reduced ? false : { height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1, scale: dragging ? 1.02 : 1, zIndex: dragging ? 5 : 0,
        boxShadow: dragging ? '0 8px 24px rgba(0,0,0,.18)' : '0 0 0 rgba(0,0,0,0)' }}
      exit={reduced ? { opacity: 0, transition: { duration: 0.1 } } : { height: 0, opacity: 0 }}
      transition={reduced ? { duration: 0 } : { ...springs.smooth, opacity: { duration: 0.18 } }}
      onDragEnd={() => { setDragging(false); reorder?.drop(value); }}
      style={{ overflow: dragging ? 'visible' : 'hidden' }}>
      <RowSlotCtx.Provider value={slot}>{children}</RowSlotCtx.Provider>
    </Reorder.Item>
  );
}

/* ── Row ── */

/** A swipe action. In `leadingActions` / `trailingActions`, index 0 is the outermost button (nearest the screen
 *  edge) — the one a full swipe triggers. */
export interface ListRowAction {
  label: string;
  /** An icon name from the kit's set (`trash`, `mail`, `starF`, …) or any node; drawn above the label. */
  icon?: string | ReactNode;
  /** Background color (any CSS color). Default: red when destructive, else the tint. */
  tint?: string;
  /** Destructive actions slide the row away and collapse it before `onAction` runs (swipe to delete). */
  destructive?: boolean;
  onAction: () => void;
}

const openRows = new Set<() => void>();

export interface ListRowProps {
  title?: ReactNode;
  subtitle?: ReactNode;
  leading?: ReactNode;
  /** Display content before the accessory (a value, a badge). Controls placed here work too. */
  trailing?: ReactNode;
  /** `chevron` / `check`, or a control (Switch, Slider, Button). A control makes the row a plain container. */
  accessory?: 'chevron' | 'check' | ReactNode;
  checked?: boolean;
  selected?: boolean;
  /** When defined (true/false), the row is in edit mode and reserves/animates the checkmark gutter. */
  edit?: boolean;
  /** Makes the row a button. Without it the row is a plain container. */
  onPress?: () => void;
  /** Shorthand for a destructive trailing "Delete" action (kept outermost). */
  onDelete?: () => void;
  /** Revealed by swiping right. */
  leadingActions?: ListRowAction[];
  /** Revealed by swiping left. */
  trailingActions?: ListRowAction[];
  /** A long swipe triggers the outermost action. Default `true` (both sides). */
  fullSwipe?: boolean | 'leading' | 'trailing';
  /** Without `onPress`, pressing the row toggles the switch/checkbox inside it. Default true. */
  labelToggles?: boolean;
  divider?: boolean;
  center?: boolean;
  destructive?: boolean;
  rowRole?: string;
  /** Return true to ignore swipe starts near an edge (e.g. under a back-gesture zone). */
  isEdge?: (clientX: number) => boolean;
  className?: string;
  style?: CSSProperties;
}

type Side = 'leading' | 'trailing';
const FULL = 0.55;
const actionW = (a: ListRowAction) => (a.icon ? 74 : 88);
const INTERACTIVE = 'button,input,select,textarea,a[href],label,[role=switch],[role=slider],[role=checkbox],[data-slot=slider]';

function ActionIcon({ icon }: { icon: ListRowAction['icon'] }) {
  if (typeof icon === 'string') return IC[icon] ? <Icon name={icon} size={20} sw={2.2} /> : null;
  return <>{icon}</>;
}

/** Row accessories that name themselves after the row's title. */
function labelled(node: ReactNode, id: string): ReactNode {
  if (!isValidElement(node) || (node.type !== Switch && node.type !== Slider)) return node;
  const pr = node.props as Record<string, unknown>;
  if (pr['aria-label'] || pr['aria-labelledby']) return node;
  return cloneElement(node as ReactElement<Record<string, unknown>>, { 'aria-labelledby': id });
}

export function ListRow(p: ListRowProps) {
  const slot = use(RowSlotCtx);
  const reduced = !!useReducedMotion();
  const id = useId();
  const titleId = id + '-t', subId = id + '-s', hintId = id + '-h';
  const x = useMotionValue(0);
  const [side, setSide] = useState<Side | null>(null);
  const [full, setFull] = useState(false);
  const [dead, setDead] = useState(false);
  const [closing, setClosing] = useState<number | null>(null);
  const el = useRef<HTMLDivElement | null>(null);
  const focusEl = useRef<HTMLElement | null>(null);
  const strip = useRef<HTMLDivElement | null>(null);
  const wrap = useRef<HTMLDivElement | null>(null);
  const g = useRef<{ x0: number; y0: number; base: number; on: boolean; fired: boolean } | null>(null);
  const run = useRef<AnimationPlaybackControls | null>(null);
  const me = useRef<() => void>(() => undefined);
  const swallow = useRef(false);
  const wantFocus = useRef(false);

  const trailing: ListRowAction[] = [
    ...(p.onDelete ? [{ label: 'Delete', destructive: true, onAction: p.onDelete }] : []),
    ...(p.trailingActions || []),
  ];
  const leading = p.leadingActions || [];
  const acts = (s: Side) => (s === 'leading' ? leading : trailing);
  const openW = (s: Side) => acts(s).reduce((w, a) => w + actionW(a), 0);
  const canFull = (s: Side) => p.fullSwipe === undefined || p.fullSwipe === true || p.fullSwipe === s;
  const swipeable = !p.edit && (leading.length > 0 || trailing.length > 0);

  useEffect(() => x.on('change', (v) => {
    const s: Side | null = v > 0.5 ? 'leading' : v < -0.5 ? 'trailing' : null;
    setSide((o) => (o === s ? o : s));
  }), [x]);
  const to = (target: number, velocity = 0) => {
    run.current?.stop();
    run.current = animate(x, target, reduced ? { duration: 0 } : { ...springs.snappy, velocity });
    return run.current;
  };
  const close = () => { setFull(false); to(0); };
  useEffect(() => {
    me.current = () => { if (x.get() !== 0) close(); };
    const f = () => me.current();
    openRows.add(f); return () => { openRows.delete(f); };
  });
  useEffect(() => { if (!p.onPress) focusEl.current = el.current; });
  const closeOthers = () => openRows.forEach((f) => { if (f !== me.current) f(); });

  const commit = (s: Side, a: ListRowAction) => {
    const w = el.current ? el.current.offsetWidth : 320;
    if (a.destructive) {
      Haptics.notification('warning');
      setFull(true);
      to(s === 'trailing' ? -w : w);
      setClosing(wrap.current ? wrap.current.offsetHeight : null);
      requestAnimationFrame(() => requestAnimationFrame(() => setDead(true)));
      setTimeout(() => a.onAction(), reduced ? 0 : 460);
    } else {
      Haptics.impact('light');
      a.onAction();
      setFull(false); to(0);
      focusEl.current?.focus({ preventScroll: true });
    }
  };

  const start = (e: ReactPointerEvent) => {
    if (!swipeable || e.button) return;
    if (p.isEdge && p.isEdge(e.clientX)) return;
    const t = e.target as HTMLElement;
    // Controls and action buttons keep their own gestures.
    if (t.closest('[data-row-control],[data-row-action],[data-row-grip]')) return;
    run.current?.stop();
    g.current = { x0: e.clientX, y0: e.clientY, base: x.get(), on: false, fired: false };
  };
  const mv = (e: ReactPointerEvent) => {
    const d = g.current; if (!d || !el.current) return;
    const dx = e.clientX - d.x0, dy = e.clientY - d.y0;
    if (!d.on) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.4) {
        d.on = true; closeOthers(); el.current.dataset.swiping = '';
        try { el.current.setPointerCapture(e.pointerId); } catch { /* noop */ }
      } else if (Math.abs(dy) > 12) { g.current = null; return; } else return;
    }
    const w = el.current.offsetWidth;
    let nx = d.base + dx;
    const s: Side | null = nx > 0 ? 'leading' : nx < 0 ? 'trailing' : null;
    if (s && !acts(s).length) nx = 0;
    if (s && acts(s).length) {
      const ow = openW(s), mag = Math.abs(nx), sign = Math.sign(nx);
      // Past the open width the row rubber-bands, unless a full swipe is allowed on this side.
      const lim = canFull(s) ? Math.min(mag, w * 0.92) : mag <= ow ? mag : ow + (mag - ow) * 0.25;
      nx = sign * lim;
      const f = canFull(s) && lim > w * FULL;
      // The full-swipe threshold is a detent: a tick crossing it, a lighter one backing out.
      if (f && !d.fired) { d.fired = true; Haptics.impact('medium'); } else if (!f && d.fired) { d.fired = false; Haptics.impact('light'); }
      setFull(f);
    }
    x.set(nx);
  };
  const end = () => {
    const d = g.current; g.current = null; if (!d || !d.on || !el.current) return;
    delete el.current.dataset.swiping;
    swallow.current = true; setTimeout(() => { swallow.current = false; }, 0);
    const w = el.current.offsetWidth, cur = x.get(), v = x.getVelocity();
    const s: Side | null = cur > 0 ? 'leading' : cur < 0 ? 'trailing' : null;
    if (!s || !acts(s).length) { close(); return; }
    // Release follows the finger's momentum: project where a flick would carry the row, then spring there.
    const proj = cur + v * 0.12, sign = s === 'leading' ? 1 : -1, mag = proj * sign;
    if (canFull(s) && d.fired && Math.abs(cur) > w * FULL) { commit(s, acts(s)[0]); return; }
    setFull(false);
    if (mag > openW(s) / 2) to(sign * openW(s), v); else to(0, v);
  };

  /* Keyboard: → reveals the trailing actions, ← the leading ones, Esc closes, Delete runs a destructive one. */
  const reveal = (s: Side) => {
    if (!acts(s).length) return false;
    closeOthers(); setFull(false);
    to((s === 'leading' ? 1 : -1) * openW(s));
    wantFocus.current = true;
    return true;
  };
  const onRowKey = (e: ReactKeyboardEvent) => {
    if (!swipeable) return;
    if (e.key === 'ArrowRight' && reveal('trailing')) e.preventDefault();
    else if (e.key === 'ArrowLeft' && reveal('leading')) e.preventDefault();
    else if (e.key === 'Escape' && x.get() !== 0) { close(); e.stopPropagation(); }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && e.target === e.currentTarget) {
      const a = trailing.find((t) => t.destructive);
      if (a) { e.preventDefault(); commit('trailing', a); }
    }
  };
  const onStripKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); focusEl.current?.focus({ preventScroll: true }); }
  };

  const onClickCapture = (e: React.MouseEvent) => {
    // A swipe's trailing click, or a tap on a row that is open, only closes it.
    if (swallow.current) { e.stopPropagation(); e.preventDefault(); return; }
    if (x.get() !== 0 && !(e.target as HTMLElement).closest('[data-row-action]')) { e.stopPropagation(); e.preventDefault(); close(); }
  };
  const onContainerClick = (e: React.MouseEvent) => {
    if (p.onPress || p.labelToggles === false) return;
    const t = e.target as HTMLElement;
    if (t.closest(INTERACTIVE)) return;
    // Pressing the row (its label) flips the switch it holds, like a <label>.
    el.current?.querySelector<HTMLElement>('[data-row-control] input[type=checkbox], [data-row-control] [role=switch]')?.click();
  };

  // Keyboard reveal: focus the first action once the strip has rendered.
  useEffect(() => {
    if (!side || !wantFocus.current) return;
    wantFocus.current = false;
    strip.current?.querySelector<HTMLElement>('button')?.focus({ preventScroll: true });
  }, [side]);
  const stripW = useTransform(x, (v) => Math.abs(v));
  const inEdit = p.edit !== undefined && p.edit !== null;
  const control = p.accessory != null && p.accessory !== 'chevron' && p.accessory !== 'check' ? p.accessory : null;
  const pressable = !!p.onPress;
  const allActs = [...leading, ...trailing];
  const focusable = pressable || (swipeable && allActs.length > 0);
  const hint = swipeable
    ? `Actions: ${allActs.map((a) => a.label).join(', ')}. ${[trailing.length && 'Right arrow', leading.length && 'left arrow'].filter(Boolean).join(' or ')} to reveal.`
    : null;

  // DOM order follows the screen (left → right), so Tab walks the buttons as they appear.
  const shown = side ? acts(side).map((a, i) => ({ a, i })) : [];
  if (side === 'trailing') shown.reverse();
  return (
    <div data-slot="list-row"
      ref={wrap}
      className={cn('relative overflow-hidden transition-[height,opacity] duration-spring-tray ease-spring-tray motion-reduce:transition-none', dead ? 'opacity-0' : 'opacity-100', p.className)}
      // Removal collapses from the measured height to 0 on the tray spring.
      style={{ ...p.style, height: dead ? 0 : closing ?? undefined }}>
      {side && shown.length ? (
        // The action strip tracks the swipe offset; a full swipe hands the whole strip to the outermost action.
        <motion.div ref={strip} data-slot="list-row-actions" onKeyDown={onStripKey}
          className={cn('absolute inset-y-0 flex overflow-hidden', side === 'leading' ? 'left-0' : 'right-0')}
          style={{ width: stripW }}>
          {shown.map(({ a, i }) => (
            <button key={a.label + i} type="button" data-row-action tabIndex={0}
              onClick={(e) => { e.stopPropagation(); commit(side, a); }}
              aria-label={a.label}
              className={cn(
                'bl-btn relative flex min-w-0 cursor-pointer overflow-hidden border-0 p-0 [font-family:inherit] text-white outline-none focus-visible:[box-shadow:inset_0_0_0_2px_#fff]',
                'transition-[flex-grow] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none',
                side === 'leading' ? 'justify-end' : 'justify-start',
              )}
              style={{
                background: a.tint || (a.destructive ? 'var(--bl-red)' : 'var(--bl-tint)'),
                flexGrow: full ? (i === 0 ? 1 : 0) : actionW(a), flexBasis: 0, flexShrink: 1,
              }}>
              {/* Content keeps its slot width, pinned to the row's edge, so it slides out from under the row. */}
              <span className="flex h-full shrink-0 flex-col items-center justify-center gap-[3px] px-2"
                style={{ width: actionW(a) }}>
                {a.icon ? <ActionIcon icon={a.icon} /> : null}
                <span className={cn('truncate font-semibold', a.icon ? 'text-[12px]' : 'text-[15px]')}>{a.label}</span>
              </span>
            </button>
          ))}
        </motion.div>
      ) : null}
      <motion.div ref={el} data-slot="list-row-content"
        data-tkrow={!pressable && focusable ? '' : undefined}
        tabIndex={!pressable && focusable ? 0 : undefined}
        role={!pressable && focusable ? 'group' : undefined}
        aria-labelledby={!pressable && focusable ? titleId : undefined}
        aria-describedby={!pressable && hint ? hintId : undefined}
        aria-keyshortcuts={!pressable && hint ? 'ArrowRight ArrowLeft Delete' : undefined}
        onKeyDown={!pressable ? onRowKey : undefined}
        onPointerDown={start} onPointerMove={mv} onPointerUp={end} onPointerCancel={end}
        onClickCapture={onClickCapture} onClick={onContainerClick}
        className={cn(
          // Type metrics a <button> would reset, so a host's body line-height or tracking doesn't reach the row.
          'relative box-border flex min-h-[46px] w-full touch-pan-y items-center gap-3 py-0 pl-4 text-left text-[17px] leading-[normal] tracking-[normal] outline-none',
          'focus-visible:[box-shadow:inset_0_0_0_2px_var(--bl-tint)]',
          // Trailing inset clears an IndexBar overlaying the list (it publishes --bl-index-bar-inset on its parent).
          'pr-[max(16px,calc(var(--bl-index-bar-inset,0px)+6px))]',
          p.destructive ? 'text-destructive' : 'text-foreground',
          p.selected ? 'bg-accent' : 'bg-card',
          (pressable || swipeable || (control && p.labelToggles !== false)) ? 'cursor-pointer' : 'cursor-default',
        )}
        // Swipe offset, driven by the gesture above.
        style={{ x }}>
        {pressable ? (
          // The press target spans the row beneath its content, so controls in the row are siblings of the button,
          // never nested inside it. Its name is the row's title and subtitle.
          <button ref={(b) => { focusEl.current = b; }} data-tkrow type="button" role={p.rowRole as never}
            aria-selected={p.rowRole ? (p.selected || p.checked || false) : undefined}
            aria-labelledby={p.subtitle ? `${titleId} ${subId}` : titleId}
            aria-describedby={hint ? hintId : undefined}
            aria-keyshortcuts={hint ? 'ArrowRight ArrowLeft Delete' : undefined}
            onKeyDown={onRowKey}
            onClick={() => p.onPress && p.onPress()}
            className="bl-btn bl-hl absolute inset-0 cursor-pointer border-0 bg-transparent p-0 outline-none focus-visible:[box-shadow:inset_0_0_0_2px_var(--bl-tint)]" />
        ) : null}
        {inEdit ? (
          <span aria-hidden="true" className={cn(
            'pointer-events-none relative flex shrink-0 items-center overflow-hidden transition-[width,opacity,margin-right] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none',
            p.edit ? 'mr-0 w-[30px] opacity-100' : '-mr-3 w-0 opacity-0',
          )}>
            <span className={cn(
              'box-border grid size-[22px] shrink-0 place-items-center rounded-[50%] transition-[background-color,scale] duration-spring-snappy ease-spring-bouncy',
              p.checked ? 'border-none bg-primary' : '[border:1.6px_solid_var(--bl-label3)] bg-transparent',
            )}>
              {p.checked ? <Icon name="check" size={13} sw={3} className="text-white transition-[scale,opacity] duration-spring-snappy ease-spring-bouncy starting:scale-50 starting:opacity-0" /> : null}
            </span>
          </span>
        ) : null}
        {p.leading ? <span className="pointer-events-none relative flex shrink-0 items-center">{p.leading}</span> : null}
        <div data-slot="list-row-body" className={cn(
          'pointer-events-none relative flex min-h-[46px] min-w-0 flex-1 items-center gap-2.5 px-0 py-[7px]',
          p.divider !== false && '[box-shadow:inset_0_-1px_0_var(--bl-sep)]',
          p.center ? 'justify-center' : 'justify-start',
        )}>
          <div className={cn('min-w-0', p.center ? 'flex-none' : 'flex-1')}>
            <div id={titleId} className="truncate leading-[1.3]">{p.title}</div>
            {p.subtitle ? <div id={subId} className="mt-px truncate text-[13px] text-muted-foreground">{p.subtitle}</div> : null}
          </div>
          {p.trailing ? (
            <span data-row-control="" className="flex shrink-0 items-center">
              {labelled(p.trailing, titleId)}
            </span>
          ) : null}
          {p.accessory === 'chevron' ? <Icon name="chev" size={15} sw={2.6} className="text-bl-label3" />
            : p.accessory === 'check' ? <span className="w-[22px] shrink-0">{p.checked ? <Icon name="check" size={20} sw={2.4} className="text-primary" /> : null}</span>
            : control ? <span data-row-control="" className="pointer-events-auto flex min-w-0 shrink-0 items-center">{labelled(control, titleId)}</span>
            : null}
          {slot?.startDrag ? (
            <button type="button" data-row-grip
              aria-label={`Reorder ${typeof p.title === 'string' ? p.title : 'row'}`}
              aria-describedby={id + '-g'}
              onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); slot.startDrag!(e); }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  e.preventDefault(); e.stopPropagation();
                  slot.move?.(slot.index + (e.key === 'ArrowUp' ? -1 : 1));
                }
              }}
              className={cn(
                'bl-btn pointer-events-auto -mr-2 grid h-[44px] w-[40px] shrink-0 cursor-grab touch-none place-items-center rounded-[8px] border-0 bg-transparent p-0 text-bl-label3 outline-none focus-visible:[box-shadow:inset_0_0_0_2px_var(--bl-tint)]',
                slot.dragging && 'cursor-grabbing',
              )}>
              <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true">
                <path d="M2 2h16M2 7h16M2 12h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
              <span id={id + '-g'} className="sr-only">Drag, or press up and down arrows, to move. Position {slot.index + 1} of {slot.count}.</span>
            </button>
          ) : null}
        </div>
        {hint ? <span id={hintId} className="sr-only">{hint}</span> : null}
      </motion.div>
    </div>
  );
}

/** Compound list API: `List`, `List.Section`, `List.Row` (also exported flat as ListSection / ListRow). */
export const List = Object.assign(ListBase, { Section: ListSection, Row: ListRow });
