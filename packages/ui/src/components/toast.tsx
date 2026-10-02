'use client';
import {
  createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type CSSProperties, type ReactNode, type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { mergeProps, useFocusWithin, useHover, useToast as useAriaToast, useToastRegion } from 'react-aria';
import { Button as AriaButton, UNSTABLE_ToastQueue as AriaToastQueue, type QueuedToast, type ToastState } from 'react-aria-components';
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from 'framer-motion';
import { Icon } from '@/lib/icon';
import { fades, springs } from '@/lib/motion';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { TextMorph } from '@/components/ui/text-morph';

/* ══ Toast — HUDs and banners ══
   Two looks, one queue:
   - `hud`: the dark "Copied" pill — an icon and a short label, centered, gone in a moment. Showing another HUD
     while one is up updates it in place (its label morphs) instead of stacking a second pill.
   - `banner`: a card with a title, an optional description and action, and a close button. Banners pile up like
     Sonner's: the newest sits in front and the ones before it peek out behind, a little smaller. Hover or focus
     the pile (or tap it on a touch screen) and it spreads into a list; timers pause while it does. Banners can be
     swiped away.
   The region and each toast come from react-aria (a landmark reachable with F6, role=alertdialog toasts whose
   content is announced as an alert, focus restored when the last one closes); the enter, exit and restacking
   run on springs, and collapse to fades under reduced motion.

     <Toaster />                         // once, near the root (or `inline` inside a positioned container)
     toast.hud('Password Copied')        // anywhere: HUD, updates the visible HUD in place
     toast('Saved', { description: 'Your changes are live.' })
     const id = toast.loading('Uploading…'); toast.update(id, { title: 'Uploaded', tone: 'success' })

   `toast` talks to the default queue; `createToastQueue()` makes an independent one for a `<Toaster queue>`
   (a block with its own HUD), and `useToast()` returns the API of the nearest Toaster's queue. */

export type ToastVariant = 'hud' | 'banner';
export type ToastTone = 'default' | 'success' | 'warning' | 'destructive';

export interface ToastData {
  /** Stable identity: showing a toast with the id of a visible one updates that toast in place. */
  id?: string;
  variant?: ToastVariant;
  title: string;
  description?: ReactNode;
  /** An `Icon` name or any node. HUDs default to a check for `success`. */
  icon?: string | ReactNode;
  tone?: ToastTone;
  /** A spinner in place of the icon, and no timeout until updated. */
  loading?: boolean;
  /** One action button (banners). Pressing it closes the toast unless the handler returns false. */
  action?: { label: string; onAction: () => void | boolean };
  /** Show the close button (banners; default true). */
  dismissible?: boolean;
}

export interface ToastOptions {
  /** Milliseconds before it closes (default 1600 for a HUD, 5000 for a banner; 0 = until closed). */
  timeout?: number;
  onClose?: () => void;
}

interface Entry { data: ToastData & { id: string }; rev: number }

const DEFAULT_TIMEOUT: Record<ToastVariant, number> = { hud: 1600, banner: 5000 };
let seq = 0;

/** A toast queue: react-aria's queue (visibility, timers, pause on hover) plus in-place updates by id. */
export class ToastQueue {
  /** The react-aria queue the region renders. */
  readonly aria: AriaToastQueue<Entry>;
  private listeners = new Set<() => void>();
  constructor(options: { maxVisibleToasts?: number } = {}) {
    this.aria = new AriaToastQueue<Entry>({ maxVisibleToasts: options.maxVisibleToasts ?? 5 });
  }

  private find(id: string) {
    return this.aria.visibleToasts.find((t) => t.content.data.id === id);
  }

  private emit() { this.listeners.forEach((l) => l()); }

  /** Subscribe to in-place updates (membership changes come from the react-aria queue). */
  subscribe(fn: () => void) {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  /** Show a toast (or update the visible one with the same id). Returns its id. */
  show(input: ToastData, options: ToastOptions = {}): string {
    const variant = input.variant ?? 'banner';
    // One HUD at a time: a new HUD takes over the visible one.
    const id = input.id ?? (variant === 'hud' ? this.aria.visibleToasts.find((t) => t.content.data.variant === 'hud')?.content.data.id : undefined) ?? `t${++seq}`;
    const data = { ...input, variant, id };
    const timeout = data.loading ? 0 : options.timeout ?? DEFAULT_TIMEOUT[variant];
    const existing = this.find(id);
    if (existing) {
      existing.content = { data, rev: existing.content.rev + 1 };
      existing.timeout = timeout || undefined;
      if (existing.timer && timeout) existing.timer.reset(timeout);
      else if (existing.timer && !timeout) existing.timer.pause();
      this.emit();
      return id;
    }
    this.aria.add({ data, rev: 0 }, { timeout: timeout || undefined, onClose: options.onClose });
    return id;
  }

  /** Patch a visible toast in place (title, tone, loading …). Restarts its timer, with the timeout it had (a
   *  loading toast has none, so it gets the default) unless `options.timeout` says otherwise. */
  update(id: string, patch: Partial<ToastData>, options: ToastOptions = {}) {
    const t = this.find(id);
    if (!t) return;
    const kept = t.content.data.loading ? undefined : t.timeout ?? 0;
    this.show({ ...t.content.data, loading: false, ...patch, id }, { ...options, timeout: options.timeout ?? kept, onClose: t.onClose });
  }

  /** Close one toast by id, or all of them. */
  dismiss(id?: string) {
    if (id == null) { this.aria.clear(); return; }
    const t = this.find(id);
    if (t) this.aria.close(t.key);
  }
}

/** The page's default queue (used by `toast()` and a `<Toaster>` without a `queue`). */
export const defaultToastQueue = new ToastQueue();

export function createToastQueue(options?: { maxVisibleToasts?: number }) {
  return new ToastQueue(options);
}

export interface ToastApi {
  (title: string, options?: Omit<ToastData, 'title'> & ToastOptions): string;
  /** The dark pill ("Copied"). */
  hud: (title: string, options?: Omit<ToastData, 'title' | 'variant'> & ToastOptions) => string;
  success: (title: string, options?: Omit<ToastData, 'title' | 'tone'> & ToastOptions) => string;
  warning: (title: string, options?: Omit<ToastData, 'title' | 'tone'> & ToastOptions) => string;
  error: (title: string, options?: Omit<ToastData, 'title' | 'tone'> & ToastOptions) => string;
  /** A spinner that stays until you `update` it. */
  loading: (title: string, options?: Omit<ToastData, 'title' | 'loading'> & ToastOptions) => string;
  update: (id: string, patch: Partial<ToastData>, options?: ToastOptions) => void;
  dismiss: (id?: string) => void;
  queue: ToastQueue;
}

function split(o: (Partial<ToastData> & ToastOptions) | undefined): [Partial<ToastData>, ToastOptions] {
  const { timeout, onClose, ...data } = o ?? {};
  return [data, { timeout, onClose }];
}

/** Bind the toast API to a queue. */
export function toastApi(queue: ToastQueue): ToastApi {
  const make = (extra: Partial<ToastData>) => (title: string, o?: Partial<ToastData> & ToastOptions) => {
    const [data, opts] = split(o);
    return queue.show({ ...extra, ...data, title } as ToastData, opts);
  };
  const api = make({}) as ToastApi;
  api.hud = make({ variant: 'hud' });
  api.success = make({ tone: 'success' });
  api.warning = make({ tone: 'warning' });
  api.error = make({ tone: 'destructive' });
  api.loading = make({ loading: true });
  api.update = (id, patch, options) => queue.update(id, patch, options);
  api.dismiss = (id) => queue.dismiss(id);
  api.queue = queue;
  return api;
}

/** Show a toast on the default queue: `toast('Saved')`, `toast.hud('Copied')`, `toast.update(id, …)`. */
export const toast: ToastApi = toastApi(defaultToastQueue);

const QueueContext = createContext<ToastQueue | null>(null);

/** The toast API for the nearest `<Toaster>`'s queue (the default queue outside one). */
export function useToast(): ToastApi {
  const q = useContext(QueueContext) ?? defaultToastQueue;
  const ref = useRef<{ q: ToastQueue; api: ToastApi } | null>(null);
  if (!ref.current || ref.current.q !== q) ref.current = { q, api: toastApi(q) };
  return ref.current.api;
}

/** Provide a queue to `useToast()` below (a `<Toaster queue>` does this for its children too). */
export function ToastProvider({ queue, children }: { queue: ToastQueue; children?: ReactNode }) {
  return <QueueContext.Provider value={queue}>{children}</QueueContext.Provider>;
}

/* ── Rendering ── */

function useQueueState(queue: ToastQueue): ToastState<Entry> {
  const aria = queue.aria;
  const visible = useSyncExternalStore(
    (fn) => aria.subscribe(fn),
    () => aria.visibleToasts,
    () => aria.visibleToasts,
  );
  // Re-render on in-place updates (the toast objects are mutated, the list identity isn't).
  useSyncExternalStore(
    (fn) => queue.subscribe(fn),
    () => visible.map((t) => t.content.rev).join(','),
    () => '',
  );
  return {
    visibleToasts: visible,
    add: (c, o) => aria.add(c, o),
    close: (k) => aria.close(k),
    pauseAll: () => aria.pauseAll(),
    resumeAll: () => aria.resumeAll(),
  };
}

export type ToasterPlacement = 'top' | 'bottom' | 'center' | 'top-end' | 'bottom-end';

export interface ToasterProps {
  /** Default: the page's default queue (`toast()`). */
  queue?: ToastQueue;
  /** Where the stack sits (default `bottom`; HUDs look best `bottom` or `center`). */
  placement?: ToasterPlacement;
  /** Render in place, absolutely positioned in the nearest positioned ancestor, instead of fixed over the
      viewport (portaled to <body>). For a toast area that belongs to one component or block. */
  inline?: boolean;
  /** Distance from the edge in px (default 24). */
  offset?: number;
  /** Show banners spread out as a list instead of piled up (the pile still spreads on hover and focus). */
  expand?: boolean;
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

const PLACEMENT: Record<ToasterPlacement, string> = {
  top: 'top-(--bl-toast-offset) left-1/2 -translate-x-1/2 items-center flex-col',
  bottom: 'bottom-(--bl-toast-offset) left-1/2 -translate-x-1/2 items-center flex-col-reverse',
  center: 'top-1/2 left-1/2 -translate-1/2 items-center flex-col',
  'top-end': 'top-(--bl-toast-offset) right-(--bl-toast-offset) items-end flex-col',
  'bottom-end': 'bottom-(--bl-toast-offset) right-(--bl-toast-offset) items-end flex-col-reverse',
};

/** The toast region. Mount once per queue. Children (optional) get `useToast()` bound to this queue. */
export function Toaster({ queue = defaultToastQueue, placement = 'bottom', inline, offset = 24, expand, className, style, children, ...props }: ToasterProps) {
  const state = useQueueState(queue);
  const [lingering, setLingering] = useState(false);
  const has = state.visibleToasts.length > 0;
  useEffect(() => { if (has) setLingering(true); }, [has]);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const show = has || lingering;
  const region = show ? (
    <Region state={state} placement={placement} inline={inline} offset={offset} expand={expand} className={className} style={style}
      aria-label={props['aria-label']} onSettled={() => { if (!queue.aria.visibleToasts.length) setLingering(false); }} />
  ) : null;
  return (
    <QueueContext.Provider value={queue}>
      {children}
      {inline ? region : mounted && region ? createPortal(region, document.body) : null}
    </QueueContext.Provider>
  );
}

/** Gap between cards when the pile is spread out, how far each card behind shows past the one in front, how much
    smaller each is, and how many show behind the front one (deeper ones hide behind the last). */
const GAP = 10;
const PEEK = 14;
const SCALE_STEP = 0.05;
const DEPTH = 3;
/** A card's height until it has been measured. */
const FALLBACK_H = 64;

function Region({ state, placement, inline, offset, expand, className, style, onSettled, ...props }: {
  state: ToastState<Entry>; placement: ToasterPlacement; inline?: boolean; offset: number; expand?: boolean; className?: string;
  style?: CSSProperties; onSettled: () => void; 'aria-label'?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const { regionProps } = useToastRegion(props, state, ref);
  const reduced = useReducedMotion();
  const edge = placement === 'bottom' || placement === 'bottom-end' ? 'bottom' : 'top';
  const huds = state.visibleToasts.filter((t) => t.content.data.variant === 'hud');
  const banners = state.visibleToasts.filter((t) => t.content.data.variant !== 'hud');

  // The pile spreads while the pointer or focus is on it, or after a tap on a touch screen (until the next tap elsewhere).
  const { hoverProps, isHovered } = useHover({});
  const [isFocusWithin, setFocusWithin] = useState(false);
  const { focusWithinProps } = useFocusWithin({ onFocusWithinChange: setFocusWithin });
  const [pinned, setPinned] = useState(false);
  useEffect(() => {
    if (!pinned) return;
    state.pauseAll();
    const away = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setPinned(false); };
    document.addEventListener('pointerdown', away, true);
    return () => { document.removeEventListener('pointerdown', away, true); state.resumeAll(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- pause and resume are the queue's, not per render
  }, [pinned]);
  const spread = !!expand || isHovered || isFocusWithin || pinned;

  // Card heights (measured by the cards) place the cards when spread and size the pile when not.
  const [heights, setHeights] = useState<Record<string, number>>({});
  const onHeight = useCallback((key: string, h: number) => setHeights((prev) => (prev[key] === h ? prev : { ...prev, [key]: h })), []);
  const heightOf = (key: string) => heights[key] ?? FALLBACK_H;
  const frontHeight = banners[0] ? heightOf(banners[0].key) : 0;
  let acc = 0;
  const offsets = banners.map((t) => { const at = acc; acc += heightOf(t.key) + GAP; return at; });
  const spreadHeight = Math.max(0, acc - GAP);
  const pileHeight = frontHeight + Math.min(Math.max(0, banners.length - 1), DEPTH - 1) * PEEK;

  // The pile stays mounted while its last cards leave.
  const [stackLive, setStackLive] = useState(false);
  useEffect(() => { if (banners.length) setStackLive(true); }, [banners.length]);

  return (
    <div
      {...mergeProps(regionProps, hoverProps, focusWithinProps, {
        onPointerDownCapture: (e: React.PointerEvent) => { if (e.pointerType === 'touch' && banners.length > 1) setPinned(true); },
      })}
      ref={ref}
      data-slot="toaster"
      data-placement={placement}
      className={cn(
        'pointer-events-none z-[1000] flex w-max max-w-[calc(100%-32px)] gap-2 outline-none',
        inline ? 'absolute' : 'fixed',
        PLACEMENT[placement],
        className,
      )}
      style={{ '--bl-toast-offset': `${offset}px`, ...style } as CSSProperties}
    >
      <AnimatePresence initial={true} onExitComplete={onSettled}>
        {huds.map((t) => <HudItem key={t.key} toast={t} state={state} fromTop={edge === 'top'} />)}
      </AnimatePresence>
      {stackLive ? (
        <motion.div
          data-slot="toast-stack"
          data-expanded={spread || undefined}
          className="pointer-events-auto relative w-[min(360px,calc(100vw-32px))]"
          initial={false}
          animate={{ height: spread ? spreadHeight : pileHeight }}
          transition={reduced ? { duration: 0.15 } : springs.smooth}
        >
          <AnimatePresence initial={true} onExitComplete={() => { if (!state.visibleToasts.some((t) => t.content.data.variant !== 'hud')) setStackLive(false); onSettled(); }}>
            {banners.map((t, index) => (
              <BannerItem
                key={t.key}
                toast={t}
                state={state}
                edge={edge}
                index={index}
                spread={spread}
                offset={offsets[index]}
                frontHeight={frontHeight}
                height={heights[t.key]}
                onHeight={onHeight}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      ) : null}
    </div>
  );
}

/** A toast's surface: the dark HUD pill (a fixed material, the same in light and dark, as on iOS) or the banner card. */
export const toastVariants = cva(
  'outline-none data-[focus-visible]:ring-2 focus-visible:ring-2 focus-visible:ring-[var(--primary)]',
  {
    variants: {
      variant: {
        hud: 'flex items-center gap-2 rounded-full bg-[rgba(30,30,32,.86)] px-4 py-2.5 text-detail font-semibold text-white shadow-[0_8px_30px_black] shadow-black/25 backdrop-blur-xl backdrop-saturate-150',
        banner: 'flex w-[min(360px,calc(100vw-32px))] items-start gap-3 rounded-2xl bg-card px-3.5 py-3 text-foreground shadow-[0_10px_34px_--alpha(black/16%),0_0_0_.5px_var(--border)]',
      },
    },
    defaultVariants: { variant: 'banner' },
  },
);

/** The icon's color per tone. */
export const toastIconVariants = cva('grid shrink-0 place-items-center', {
  variants: {
    tone: { default: 'text-primary', success: 'text-success', warning: 'text-warning', destructive: 'text-destructive' },
  },
  defaultVariants: { tone: 'default' },
});
/* HUDs use the bare glyph (on the dark pill); banners the filled circle SF uses in notifications. */
const TONE_ICON: Record<ToastVariant, Record<ToastTone, string | null>> = {
  hud: { default: null, success: 'check', warning: 'warning', destructive: 'xmark' },
  banner: { default: null, success: 'check-circle-fill', warning: 'warning-fill', destructive: 'xmark-circle-fill' },
};

function ToastIcon({ data, size }: { data: ToastData; size: number }) {
  const tone = data.tone ?? 'default';
  if (data.loading) {
    return (
      <span aria-hidden="true" className={cn(
        'inline-block shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent opacity-80 motion-reduce:animate-[spin_2s_linear_infinite]',
        size === 16 ? 'size-[14px]' : 'size-[18px]',
      )} />
    );
  }
  const icon = data.icon ?? TONE_ICON[data.variant ?? 'banner'][tone];
  if (icon == null) return null;
  return (
    <span aria-hidden="true" className={toastIconVariants({ tone })}>
      {typeof icon === 'string' ? <Icon name={icon} size={size} sw={data.variant === 'hud' ? 2.6 : 2.2} /> : icon}
    </span>
  );
}

/** The card itself, shared by both looks: icon, title, description, action and close button. */
function ToastCard({ toast: t, state, aria, cardRef, className, behind }: {
  toast: QueuedToast<Entry>; state: ToastState<Entry>; aria: ReturnType<typeof useAriaToast>;
  cardRef: RefObject<HTMLDivElement | null>; className?: string; behind?: boolean;
}) {
  const { toastProps, contentProps, titleProps, descriptionProps, closeButtonProps } = aria;
  const data = t.content.data;
  const hud = data.variant === 'hud';
  const { onPress: close, ...closeAria } = closeButtonProps as { onPress: () => void; 'aria-label': string };
  return (
    <div
      {...toastProps}
      ref={cardRef}
      data-slot="toast"
      data-variant={data.variant}
      data-tone={data.tone ?? 'default'}
      data-behind={behind || undefined}
      className={cn(toastVariants({ variant: hud ? 'hud' : 'banner' }), className)}
    >
      <ToastIcon data={data} size={hud ? 16 : 20} />
      <div {...contentProps} className={cn('min-w-0', !hud && 'flex-1 pt-px')}>
        <div {...titleProps} className={cn(hud ? 'whitespace-nowrap' : 'text-subhead font-semibold leading-snug')}>
          {hud ? <TextMorph>{data.title}</TextMorph> : data.title}
        </div>
        {!hud && data.description ? (
          <div {...descriptionProps} className="mt-0.5 text-[13.5px] leading-snug text-muted-foreground">{data.description}</div>
        ) : null}
      </div>
      {!hud && data.action ? (
        <AriaButton
          onPress={() => { if (data.action!.onAction() !== false) state.close(t.key); }}
          className="bl-btn shrink-0 cursor-pointer self-center rounded-full border-0 bg-secondary px-3 py-1.5 text-[13.5px] font-semibold text-primary outline-none transition-[background-color,scale] duration-spring-snappy ease-spring-snappy hover:bg-secondary-strong active:scale-95 data-[focus-visible]:ring-2 data-[focus-visible]:ring-[var(--primary)]"
        >
          {data.action.label}
        </AriaButton>
      ) : null}
      {!hud && data.dismissible !== false ? (
        <AriaButton
          {...closeAria}
          onPress={close}
          className="bl-btn -mt-0.5 -mr-1 grid size-7 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-muted-foreground outline-none transition-colors hover:bg-secondary hover:text-foreground data-[focus-visible]:ring-2 data-[focus-visible]:ring-[var(--primary)]"
        >
          <Icon name="x" size={14} sw={2.2} />
        </AriaButton>
      ) : null}
    </div>
  );
}

/** The HUD pill: one at a time, gone in a moment. */
function HudItem({ toast: t, state, fromTop }: { toast: QueuedToast<Entry>; state: ToastState<Entry>; fromTop: boolean }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const aria = useAriaToast({ toast: t }, state, ref);
  const reduced = useReducedMotion();
  const hidden = reduced ? { opacity: 0 } : { opacity: 0, y: fromTop ? -16 : 16, scale: 0.85, filter: 'blur(4px)' };
  return (
    <motion.div
      layout={reduced ? false : 'position'}
      initial={hidden}
      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
      exit={{ ...hidden, transition: reduced ? { duration: 0.12 } : { ...fades.out, y: springs.snappy, scale: springs.snappy } }}
      transition={reduced ? { duration: 0.15 } : { default: fades.in, y: springs.snappy, scale: springs.bouncy, layout: springs.smooth }}
      className="pointer-events-auto"
    >
      <ToastCard toast={t} state={state} aria={aria} cardRef={ref} />
    </motion.div>
  );
}

/** One banner in the pile. `index` 0 is the newest, in front. Piled, the ones behind sit `PEEK` px further in, a
    little smaller and clipped to the front card's height (so a tall card behind never pokes out), their content
    hidden; spread, each sits at its `offset` at its own size. */
function BannerItem({ toast: t, state, edge, index, spread, offset, frontHeight, height, onHeight }: {
  toast: QueuedToast<Entry>; state: ToastState<Entry>; edge: 'top' | 'bottom'; index: number; spread: boolean; offset: number;
  frontHeight: number; height: number | undefined; onHeight: (key: string, h: number) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const aria = useAriaToast({ toast: t }, state, ref);
  const reduced = useReducedMotion();
  // Tell the region how tall this card is: it places the cards when spread and sizes the pile when not.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => onHeight(t.key, el.offsetHeight);
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [t.key, onHeight]);

  const toward = edge === 'bottom' ? -1 : 1; // which way "further in" is: up from the bottom edge, down from the top
  const behind = !spread && index > 0;
  const layer = Math.min(index, DEPTH - 1);
  const enter = reduced ? { opacity: 0 } : { opacity: 0, y: -toward * 28, scale: 0.96, filter: 'blur(4px)' };
  const leave = reduced ? { opacity: 0, transition: { duration: 0.12 } }
    : index === 0 ? { opacity: 0, y: -toward * 20, scale: 0.96, filter: 'blur(4px)', transition: { ...fades.out, y: springs.snappy, scale: springs.snappy } }
      : { opacity: 0, scale: 0.92, transition: fades.out };
  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) > 90 || Math.abs(info.velocity.x) > 600) state.close(t.key);
  };
  return (
    <motion.div
      data-slot="toast-layer"
      data-index={index}
      className={cn(
        'absolute inset-x-0 flex flex-col',
        edge === 'bottom' ? 'bottom-0 justify-start origin-top' : 'top-0 justify-end origin-bottom',
        behind ? 'pointer-events-none overflow-hidden rounded-2xl' : 'pointer-events-auto',
      )}
      style={{ zIndex: 100 - index }}
      initial={enter}
      animate={{
        opacity: !spread && index >= DEPTH ? 0 : 1,
        y: toward * (spread ? offset : layer * PEEK),
        scale: spread || reduced ? 1 : 1 - layer * SCALE_STEP,
        filter: 'blur(0px)',
        height: behind ? frontHeight : height ?? 'auto',
      }}
      exit={leave}
      transition={reduced ? { duration: 0.15 } : { default: springs.smooth, y: springs.snappy, scale: springs.snappy, opacity: fades.in, filter: fades.in }}
      {...(!behind && !reduced ? { drag: 'x' as const, dragSnapToOrigin: true, dragElastic: 0.6, onDragEnd } : null)}
    >
      <ToastCard
        toast={t}
        state={state}
        aria={aria}
        cardRef={ref}
        behind={behind}
        className="shrink-0 *:transition-opacity *:duration-150 data-behind:shadow-[inset_0_0_0_.5px_var(--border)] data-behind:*:opacity-0"
      />
    </motion.div>
  );
}
