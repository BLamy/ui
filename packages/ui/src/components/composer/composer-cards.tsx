'use client';
import * as React from 'react';
import { useRef, useState } from 'react';
import { animate, AnimatePresence, usePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Icon } from '@/lib/icon';
import { prefersReducedMotion, springs } from '@/lib/motion';
import { insertMarkdown } from '@/components/ui/markdown-editor';
import { MORPH_REACH as REACH, morphNeck as neck, roundedRectPath as roundedRect, toDropShadow, type MorphBox as Box } from '@/lib/morph-path';
import { ComposerButton, useComposer, type ComposerAttachment } from '@/components/ui/composer/composer';

/* ══ ComposerCards — cards that morph out of the composer like a drop of liquid ══

   <Composer …>
     <ComposerCards side="top">                        ← above the card (or above a top bump: see below)
       {suggest ? <ComposerMorphCard key="notion">…</ComposerMorphCard> : null}
     </ComposerCards>
     <ComposerCard>…</ComposerCard>
     <ComposerCards side="bottom">…</ComposerCards>
   </Composer>

   A card added to the tray grows out of the surface next to it: the composer's card, or — when the composer has a
   bump on that side (an `attached` or `detached` ComposerBump, the "nub") — the outermost bump, so the card comes out
   of the nub rather than the main card. A card added beyond another card grows out of that card. It starts inside its
   source, blurred, and slides out; while the two are closer than a few pixels their outlines are one shape that
   necks in and pinches off (a metaball), then the card stands on its own. Removing a card plays it backwards: the
   card sinks back into its source. The joined outline is drawn as one SVG path under the composer, in the source's
   own fill, border and shadow (read from its computed style), so the joined and separate states look the same.

   ComposerQueue builds on it: sending while a reply streams turns the draft into a card that morphs out of the top,
   and when the reply ends the card merges back in and is sent into the chat. */

/** How far a card's content is blurred while it is still inside its source (px). */
const INSIDE_BLUR = 10;

interface Look {
  bg: string;
  border: string;
  borderWidth: number;
  radius: number;
  shadow: string;
  /** The shadow as CSS filter drop-shadows, for the joined outline. */
  dropShadow: string;
}

interface TrayValue {
  side: 'top' | 'bottom';
  gap: number;
  /** Redraws the joined outline from the surfaces' current boxes (cards call it every animation frame). */
  draw: () => void;
  /** False while the tray's first render lays out: cards that are there from the start don't morph in. */
  mounted: React.RefObject<boolean>;
}
const TrayContext = React.createContext<TrayValue | null>(null);

function useTray(): TrayValue {
  const ctx = React.useContext(TrayContext);
  if (!ctx) throw new Error('ComposerMorphCard must be used within <ComposerCards>');
  return ctx;
}

/** The surface cards grow out of on `side`: the outermost attached or detached bump there, else the composer's card. */
function findSource(root: HTMLElement, side: 'top' | 'bottom'): HTMLElement | null {
  const stack = root.querySelector<HTMLElement>(':scope > [data-slot="composer-stack"]');
  const bumps = Array.from(stack?.querySelectorAll<HTMLElement>(':scope > [data-slot="composer-bump"]') ?? []).filter(
    (b) => b.dataset.side === side && b.dataset.variant !== 'flush' && b.getBoundingClientRect().height > 0,
  );
  if (bumps.length) {
    const edge = (b: HTMLElement) => (side === 'top' ? b.getBoundingClientRect().top : -b.getBoundingClientRect().bottom);
    return bumps.reduce((a, b) => (edge(b) < edge(a) ? b : a));
  }
  return root.querySelector<HTMLElement>('[data-slot="composer-card"]');
}

function readLook(source: HTMLElement): Look {
  const cs = getComputedStyle(source);
  const borderWidth = parseFloat(cs.borderLeftWidth) || parseFloat(cs.borderTopWidth) || 0;
  return {
    bg: cs.backgroundColor,
    border: parseFloat(cs.borderLeftWidth) ? cs.borderLeftColor : cs.borderTopColor,
    borderWidth,
    radius: parseFloat(cs.borderTopLeftRadius) || 0,
    shadow: cs.boxShadow,
    dropShadow: toDropShadow(cs.boxShadow),
  };
}

function boxOf(el: HTMLElement, origin: DOMRect): Box {
  const b = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  const half = Math.min(b.width, b.height) / 2;
  const radius = (v: string) => Math.min(half, parseFloat(v) || 0);
  return {
    left: b.left - origin.left,
    top: b.top - origin.top,
    right: b.right - origin.left,
    bottom: b.bottom - origin.top,
    r: [radius(cs.borderTopLeftRadius), radius(cs.borderTopRightRadius), radius(cs.borderBottomRightRadius), radius(cs.borderBottomLeftRadius)],
  };
}

/** Hides (or restores) a surface's own fill, border and shadow while the joined outline draws it. Instantly: the
    composer card transitions these, which would leave a fading seam. */
function setMerged(el: HTMLElement, merged: boolean) {
  if (merged === (el.dataset.morphMerged === 'true')) return;
  if (merged) {
    el.dataset.morphMerged = 'true';
    el.style.setProperty('transition', 'none', 'important');
    el.style.setProperty('background-color', 'transparent', 'important');
    el.style.setProperty('border-color', 'transparent', 'important');
    el.style.setProperty('box-shadow', 'none', 'important');
  } else {
    delete el.dataset.morphMerged;
    el.style.removeProperty('background-color');
    el.style.removeProperty('border-color');
    el.style.removeProperty('box-shadow');
    // Commit the restored look before transitions come back, so it doesn't fade in.
    void el.offsetWidth;
    el.style.removeProperty('transition');
  }
}

export interface ComposerCardsProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Above the composer (`top`, default) or below it. */
  side?: 'top' | 'bottom';
  /** Space between a card and the surface it came out of, at rest (px, at least REACH so they separate). */
  gap?: number;
  /** Morph in the cards that are there when the tray mounts (default: they are simply there). */
  animateOnMount?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}

/**
 * A tray of ComposerMorphCards on one side of the composer. Place it among the Composer's children (it orders itself
 * outside the bumps on its side). Cards are keyed children: add one and it morphs out, remove it and it sinks back.
 */
export function ComposerCards({ side = 'top', gap = 8, animateOnMount = false, className, style, children, ref, ...props }: ComposerCardsProps) {
  const trayRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const strokeRef = useRef<SVGPathElement | null>(null);
  const fillRef = useRef<SVGPathElement | null>(null);
  const mounted = useRef(animateOnMount);
  const merged = useRef(new Set<HTMLElement>());
  const look = useRef<Look | null>(null);
  const [cardLook, setCardLook] = useState<Look | null>(null);
  const restGap = Math.max(REACH, gap);

  // The Composer root, found from the tray: its ref is not attached yet when the tray first lays out.
  const getRoot = () => trayRef.current?.closest<HTMLElement>('[data-slot="composer"]') ?? null;

  const draw = React.useCallback(() => {
    const tray = trayRef.current;
    const root = tray?.closest<HTMLElement>('[data-slot="composer"]');
    const svg = svgRef.current;
    if (!root || !tray || !svg) return;
    const source = findSource(root, side);
    if (!source) return;
    // The tray (and so its cards) spans the source's width.
    const stack = tray.parentElement;
    if (stack) {
      const s = stack.getBoundingClientRect();
      const b = source.getBoundingClientRect();
      tray.style.marginLeft = `${Math.max(0, b.left - s.left)}px`;
      tray.style.marginRight = `${Math.max(0, s.right - b.right)}px`;
    }
    const cards = Array.from(tray.querySelectorAll<HTMLElement>(':scope > [data-slot="composer-morph-frame"] > [data-slot="composer-morph-card"]'));
    // Innermost first: the source, then the card next to it, and so on outwards.
    const chain = [source, ...(side === 'top' ? cards.reverse() : cards)];
    const origin = root.getBoundingClientRect();
    const boxes = chain.map((el) => boxOf(el, origin));
    const joined = boxes.map((box, i) => {
      if (i === 0) return false;
      const inner = boxes[i - 1];
      return (side === 'top' ? inner.top - box.bottom : box.top - inner.bottom) < REACH;
    });
    const inSkin = chain.map((_, i) => joined[i] || !!joined[i + 1]);
    if (!inSkin.some(Boolean)) {
      svg.style.display = 'none';
      merged.current.forEach((el) => setMerged(el, false));
      merged.current.clear();
      return;
    }
    // Read the source's look before hiding it (its computed style is its own only while nothing is merged).
    if (!look.current || !merged.current.size) look.current = readLook(source);
    const parts: string[] = [];
    boxes.forEach((box, i) => {
      if (!inSkin[i]) return;
      parts.push(roundedRect(box));
      if (!joined[i]) return;
      const inner = boxes[i - 1];
      parts.push(side === 'top' ? neck(box, inner) : neck(inner, box));
    });
    const d = parts.join('');
    const lk = look.current;
    strokeRef.current?.setAttribute('d', d);
    strokeRef.current?.setAttribute('stroke', lk.border);
    strokeRef.current?.setAttribute('stroke-width', String(lk.borderWidth * 2));
    fillRef.current?.setAttribute('d', d);
    fillRef.current?.setAttribute('fill', lk.bg);
    svg.style.filter = lk.dropShadow;
    svg.style.display = '';
    chain.forEach((el, i) => {
      setMerged(el, inSkin[i]);
      if (inSkin[i]) merged.current.add(el);
      else merged.current.delete(el);
    });
  }, [side]);

  // The cards wear the source's material: fill, border, corner radius and shadow, read from its computed style.
  React.useLayoutEffect(() => {
    const root = getRoot();
    if (!root) return;
    // The joined outline sits under everything in the composer.
    const isolation = root.style.isolation;
    root.style.isolation = 'isolate';
    const refresh = () => {
      const source = findSource(root, side);
      if (!source || merged.current.size) return;
      const next = readLook(source);
      look.current = next;
      setCardLook((prev) => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };
    refresh();
    draw();
    mounted.current = true;
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => draw());
    ro?.observe(root);
    // A theme change restyles the source.
    const mo = typeof MutationObserver === 'undefined' ? null : new MutationObserver(refresh);
    mo?.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
    const scheme = typeof matchMedia === 'undefined' ? null : matchMedia('(prefers-color-scheme: dark)');
    scheme?.addEventListener('change', refresh);
    const settle = merged.current;
    return () => {
      ro?.disconnect();
      mo?.disconnect();
      scheme?.removeEventListener('change', refresh);
      settle.forEach((el) => setMerged(el, false));
      settle.clear();
      root.style.isolation = isolation;
    };
  }, [side, draw]);

  const value = React.useMemo<TrayValue>(() => ({ side, gap: restGap, draw, mounted }), [side, restGap, draw]);
  const lookStyle = cardLook
    ? ({
        '--composer-morph-bg': cardLook.bg,
        '--composer-morph-border': cardLook.border,
        '--composer-morph-border-width': `${cardLook.borderWidth}px`,
        '--composer-morph-radius': `${cardLook.radius}px`,
        '--composer-morph-shadow': cardLook.shadow,
      } as React.CSSProperties)
    : undefined;

  return (
    <TrayContext.Provider value={value}>
      <div
        ref={(el) => {
          trayRef.current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref) ref.current = el;
        }}
        data-slot="composer-cards"
        data-side={side}
        className={cn('flex min-w-0 flex-col', side === 'top' ? 'order-[-2]' : 'order-2', className)}
        style={{ ...lookStyle, ...style }}
        {...props}
      >
        <AnimatePresence initial={animateOnMount}>{children}</AnimatePresence>
      </div>
      {/* The joined outline: positioned against the Composer root (the tray is not positioned), under its content. */}
      <svg ref={svgRef} aria-hidden="true" data-slot="composer-morph-skin" className="pointer-events-none absolute top-0 left-0 -z-1 size-px overflow-visible" style={{ display: 'none' }}>
        <path ref={strokeRef} fill="none" />
        <path ref={fillRef} />
      </svg>
    </TrayContext.Provider>
  );
}

export interface ComposerMorphCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Called when the card has sunk back into its source after being removed. */
  onExited?: () => void;
  ref?: React.Ref<HTMLDivElement>;
}

/** A card in a ComposerCards tray. Give it a stable `key`; it morphs out when added and sinks back when removed. */
export function ComposerMorphCard({ onExited, className, children, ref, ...props }: ComposerMorphCardProps) {
  const tray = useTray();
  const [isPresent, safeToRemove] = usePresence();
  const frameRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const progress = useRef(tray.mounted.current ? 0 : 1);
  const control = useRef<{ stop: () => void } | null>(null);
  const exited = useRef(onExited);
  exited.current = onExited;
  const { side, gap, draw } = tray;

  /** Lays the card out `t` of the way from inside its source (0) to its resting place (1). */
  const apply = React.useCallback(
    (t: number) => {
      progress.current = t;
      const frame = frameRef.current;
      const card = cardRef.current;
      const body = bodyRef.current;
      if (!frame || !card || !body) return;
      if (t >= 1) {
        frame.style.removeProperty('height');
        frame.style.removeProperty('padding');
        frame.style.removeProperty('pointer-events');
        card.style.removeProperty('position');
        card.style.removeProperty('inset');
        body.style.removeProperty('filter');
        body.style.removeProperty('opacity');
      } else {
        const height = card.offsetHeight;
        // The frame holds the card plus the gap; it grows from nothing, so the card starts inside its source.
        frame.style.height = `${Math.max(0, (height + gap) * t)}px`;
        frame.style.padding = '0';
        frame.style.pointerEvents = 'none';
        card.style.position = 'absolute';
        card.style.inset = side === 'top' ? '0 0 auto 0' : 'auto 0 0 0';
        body.style.filter = `blur(${(INSIDE_BLUR * (1 - t)).toFixed(2)}px)`;
        body.style.opacity = Math.min(1, Math.max(0, (t - 0.1) / 0.6)).toFixed(3);
      }
      draw();
    },
    [draw, gap, side],
  );

  const run = React.useCallback(
    (to: number, done?: () => void) => {
      control.current?.stop();
      if (prefersReducedMotion()) {
        apply(to);
        done?.();
        return;
      }
      control.current = animate(progress.current, to, {
        ...springs.smooth,
        restDelta: 0.001,
        onUpdate: apply,
        onComplete: () => {
          apply(to);
          done?.();
        },
      });
    },
    [apply],
  );

  React.useLayoutEffect(() => {
    if (progress.current < 1) {
      apply(progress.current);
      run(1);
    }
    return () => control.current?.stop();
    // Mount only: later changes go through presence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (isPresent) {
      if (progress.current < 1) run(1);
      return;
    }
    run(0, () => {
      exited.current?.();
      safeToRemove?.();
      // The source may still be marked merged with this card; draw once more without it.
      requestAnimationFrame(draw);
    });
  }, [isPresent, run, safeToRemove, draw]);

  return (
    <div ref={frameRef} data-slot="composer-morph-frame" className={cn('relative min-w-0 shrink-0', side === 'top' ? 'pb-(--composer-morph-gap)' : 'pt-(--composer-morph-gap)')} style={{ '--composer-morph-gap': `${gap}px` } as React.CSSProperties}>
      <div
        ref={(el) => {
          cardRef.current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref) ref.current = el;
        }}
        data-slot="composer-morph-card"
        data-state={isPresent ? 'open' : 'closing'}
        className={cn(
          'box-border min-w-0 overflow-hidden border-solid',
          'border-(length:--composer-morph-border-width,1px) border-(--composer-morph-border,var(--border)) bg-(--composer-morph-bg,var(--card))',
          'rounded-(--composer-morph-radius,15px) [box-shadow:var(--composer-morph-shadow,none)]',
          className,
        )}
        inert={!isPresent || undefined}
        {...props}
      >
        <div ref={bodyRef} data-slot="composer-morph-body" className="min-w-0">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── Queue ── */
export interface ComposerQueueItem {
  id: string;
  /** The queued draft as Markdown (attachment chips as `attachment:` refs, as in onSubmit). */
  markdown: string;
  attachments: ComposerAttachment[];
}

export interface ComposerQueueProps extends Omit<ComposerCardsProps, 'children' | 'onChange'> {
  /** Controlled queue. */
  items?: ComposerQueueItem[];
  defaultItems?: ComposerQueueItem[];
  onItemsChange?: (items: ComposerQueueItem[]) => void;
  /** Send the first queued message by itself once the reply ends (default true). */
  autoSend?: boolean;
  /** Draws a queued message's card (default: its text, attachment count, and Edit / Send now / Remove). */
  renderItem?: (item: ComposerQueueItem, actions: ComposerQueueActions) => React.ReactNode;
}

export interface ComposerQueueActions {
  /** Merges the card back into the composer and puts its text back in the draft. */
  edit: () => void;
  /** Stops the reply (if one is streaming) and sends this message now. */
  sendNow: () => void;
  /** Takes the card out of the queue. */
  remove: () => void;
}

let queueSeq = 0;
const queueId = () => `queued-${Date.now().toString(36)}-${(queueSeq++).toString(36)}`;

/** The queued message's text for the card: attachment chips become their names. */
function previewText(markdown: string) {
  return markdown
    .replace(/!\[([^\]]*)\]\(attachment:[^)]*\)/g, '[$1]')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Message queueing for a chat Composer. While `streaming`, sending puts the draft in a card that morphs out of the top
 * of the composer (out of a top bump, when there is one); when the reply ends the first card merges back in and goes
 * to `onSubmit`, then the next after the following reply. Cards can be edited (back into the draft), sent now (stops
 * the reply), or removed.
 */
export function ComposerQueue({
  items: itemsProp,
  defaultItems = [],
  onItemsChange,
  autoSend = true,
  renderItem,
  side = 'top',
  'aria-label': ariaLabel = 'Queued messages',
  ...props
}: ComposerQueueProps) {
  const ctx = useComposer();
  const { streaming, setQueue, submit, stop } = ctx;
  const [inner, setInner] = useState(defaultItems);
  const items = itemsProp ?? inner;
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const change = React.useCallback(
    (next: ComposerQueueItem[]) => {
      itemsRef.current = next;
      if (itemsProp === undefined) setInner(next);
      onItemsChange?.(next);
    },
    [itemsProp, onItemsChange],
  );
  // Why a card left, so its exit knows what to do once it has merged back in.
  const leaving = useRef(new Map<string, { item: ComposerQueueItem; reason: 'send' | 'edit' | 'remove' }>());
  const feeding = useRef(false);
  const [settled, setSettled] = useState(0);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  React.useEffect(() => {
    setQueue((markdown, attachments) => change([...itemsRef.current, { id: queueId(), markdown, attachments }]));
    return () => setQueue(null);
  }, [setQueue, change]);

  const leave = React.useCallback(
    (id: string, reason: 'send' | 'edit' | 'remove') => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item) return;
      leaving.current.set(id, { item, reason });
      if (reason === 'send') feeding.current = true;
      change(itemsRef.current.filter((i) => i.id !== id));
    },
    [change],
  );

  const exited = (id: string) => {
    const left = leaving.current.get(id);
    leaving.current.delete(id);
    if (!left) return;
    const { item, reason } = left;
    if (reason === 'send') {
      feeding.current = false;
      submit(item.markdown, item.attachments);
      setSettled((n) => n + 1);
    } else if (reason === 'edit') {
      const { editor, addAttachment, setValue } = ctxRef.current;
      item.attachments.forEach(addAttachment);
      if (editor && !editor.isDestroyed) {
        editor.commands.clearContent(true);
        insertMarkdown(editor, item.markdown);
        editor.commands.focus('end');
      } else setValue(item.markdown);
    }
  };

  // The reply is over: the next queued message goes in.
  React.useEffect(() => {
    if (!autoSend || streaming || feeding.current || !items.length) return;
    leave(items[0].id, 'send');
  }, [autoSend, streaming, items, settled, leave]);

  return (
    <ComposerCards side={side} role="list" aria-label={ariaLabel} {...props}>
      {/* The oldest message sits against the composer (it goes in next); newer ones stack outwards, each growing
          out of the one before. Above the composer that is the reverse of the list. */}
      {(side === 'top' ? [...items].reverse() : items).map((item) => {
        const actions: ComposerQueueActions = {
          edit: () => leave(item.id, 'edit'),
          sendNow: () => {
            if (streaming) stop();
            leave(item.id, 'send');
          },
          remove: () => leave(item.id, 'remove'),
        };
        return (
          <ComposerMorphCard key={item.id} role="listitem" data-queue-id={item.id} onExited={() => exited(item.id)}>
            {renderItem ? renderItem(item, actions) : <QueuedMessage item={item} actions={actions} />}
          </ComposerMorphCard>
        );
      })}
    </ComposerCards>
  );
}

function QueuedMessage({ item, actions }: { item: ComposerQueueItem; actions: ComposerQueueActions }) {
  const text = previewText(item.markdown);
  const files = item.attachments.length;
  return (
    <div data-slot="composer-queued" className="flex min-w-0 items-center gap-2 py-1.5 ps-3 pe-1.5">
      <Icon name="clock-dial" size={14} className="shrink-0 text-foreground/60" />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-footnote text-foreground">{text || (files ? `${files} attachment${files === 1 ? '' : 's'}` : '')}</span>
        {text && files ? (
          <span className="text-caption2 text-foreground/70">
            {files} attachment{files === 1 ? '' : 's'}
          </span>
        ) : null}
      </div>
      <ComposerButton aria-label="Edit queued message" onPress={actions.edit}>
        <Icon name="square-pencil" size={14} />
      </ComposerButton>
      <ComposerButton aria-label="Send now" onPress={actions.sendNow}>
        <Icon name="arrow-up-compact" size={14} sw={2.2} />
      </ComposerButton>
      <ComposerButton aria-label="Remove from queue" onPress={actions.remove}>
        <Icon name="xmark-large" size={12} />
      </ComposerButton>
    </div>
  );
}
