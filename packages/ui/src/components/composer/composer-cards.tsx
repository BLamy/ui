'use client';
import * as React from 'react';
import { useRef, useState } from 'react';
import { animateIn, animateOut, createFocusRecovery, type ChangeDetails, type FocusRecovery } from '@ui-sdk/core';
import { cn } from '@/lib/utils';
import { Icon } from '@/lib/icon';
import { insertMarkdown } from '@/components/ui/markdown-editor';
import { MORPH_REACH as REACH, morphNeck as neck, roundedRectPath as roundedRect, toDropShadow, type MorphBox as Box } from '@/lib/morph-path';
import { ComposerButton, useComposer, type ComposerAttachment } from '@/components/ui/composer/composer';
import { usePresenceList } from '@/lib/presence';
import { prefersReducedMotion } from '@/lib/motion';
import { useAppearance } from '@/lib/theme';
import { useControllableChange } from '@/lib/controllable-state';

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
  /** Keeps focus in the tray when a card leaves holding it. */
  recovery: FocusRecovery;
}
const TrayContext = React.createContext<TrayValue | null>(null);

/** Whether a tray's card is still among its children, or leaving (and what to call once it has sunk back). */
const CardPresenceContext = React.createContext<{ key: string; present: boolean; exited: () => void } | null>(null);

/** The controls of a tray's cards that are staying (not sinking back), in DOM order per card. */
function stayingCards(tray: HTMLElement | null): HTMLElement[] {
  return Array.from(tray?.querySelectorAll<HTMLElement>(':scope > [data-slot="composer-morph-frame"] > [data-slot="composer-morph-card"]:not([inert])') ?? []);
}
const CONTROLS = 'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const refreshLook = useRef<(() => void) | null>(null);
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
    // Reduced motion has no morph: a card is joined to the source only while it grows out or sinks back.
    if (!inSkin.some(Boolean) || prefersReducedMotion()) {
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
    refreshLook.current = refresh;
    const settle = merged.current;
    return () => {
      refreshLook.current = null;
      ro?.disconnect();
      mo?.disconnect();
      settle.forEach((el) => setMerged(el, false));
      settle.clear();
      root.style.isolation = isolation;
    };
  }, [side, draw]);

  // A ThemeScope or BLProvider switching appearance restyles the source too.
  const appearance = useAppearance();
  React.useLayoutEffect(() => refreshLook.current?.(), [appearance]);

  // Focus on a card that leaves (removed, sent, merged back) goes to the same control on the next card that stays,
  // else on the one before it, else to the composer's editor: never to the page.
  const composer = useComposer();
  const editorRef = useRef(composer.editor);
  editorRef.current = composer.editor;
  const lastFocused = useRef<HTMLElement | null>(null);
  const recovery = React.useMemo(
    () =>
      createFocusRecovery({
        fallback: (lost) => {
          const cards = stayingCards(trayRef.current).filter((c) => c !== lost.el);
          const next = cards.find((c) => lost.el.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING) ?? cards[cards.length - 1];
          if (next) {
            const was = lastFocused.current && lost.el.contains(lastFocused.current) ? lastFocused.current : null;
            const label = was?.getAttribute('aria-label');
            const controls = Array.from(next.querySelectorAll<HTMLElement>(CONTROLS));
            return (label ? controls.find((c) => c.getAttribute('aria-label') === label) : undefined) ?? controls[0] ?? null;
          }
          const editor = editorRef.current;
          if (editor && !editor.isDestroyed) editor.commands.focus('end');
          return null;
        },
      }),
    [],
  );
  const value = React.useMemo<TrayValue>(() => ({ side, gap: restGap, draw, mounted, recovery }), [side, restGap, draw, recovery]);
  // Removed cards stay until they have sunk back in.
  const cards = usePresenceList(React.Children.toArray(children).filter(React.isValidElement), (child) => String(child.key));
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
        onFocusCapture={(event) => {
          lastFocused.current = event.target as HTMLElement;
        }}
        className={cn('flex min-w-0 flex-col', side === 'top' ? 'order-[-2]' : 'order-2', className)}
        style={{ ...lookStyle, ...style }}
        {...props}
      >
        {cards.map((entry) => (
          <CardPresenceContext.Provider key={entry.key} value={entry}>
            {entry.item}
          </CardPresenceContext.Provider>
        ))}
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
  const presence = React.useContext(CardPresenceContext);
  const present = presence?.present ?? true;
  const frameRef = useRef<HTMLDivElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
  const appear = useRef(tray.mounted.current);
  const [morphing, setMorphing] = useState(appear.current);
  const exited = useRef(onExited);
  exited.current = onExited;
  const done = useRef(presence?.exited);
  done.current = presence?.exited;
  const { side, gap, draw, recovery } = tray;
  const key = presence?.key ?? '';

  // While it stays, the card is in the tray's focus recovery: leaving with focus inside, it hands focus on.
  React.useLayoutEffect(() => {
    const card = cardRef.current;
    if (!present || !card) return;
    return recovery.bind(card, { key, props: null });
  }, [present, recovery, key]);

  // While it morphs, the joined outline follows the card every frame.
  React.useEffect(() => {
    if (!morphing) return;
    let frame = requestAnimationFrame(function tick() {
      draw();
      frame = requestAnimationFrame(tick);
    });
    return () => {
      cancelAnimationFrame(frame);
      draw();
    };
  }, [morphing, draw]);

  // In, the frame grows from nothing (UI SDK's data-starting-style) so the card slides out of its source; out, it
  // shrinks back (data-ending-style) and the card sinks in.
  React.useLayoutEffect(() => {
    const frame = frameRef.current;
    const card = cardRef.current;
    if (!frame || !card) return;
    if (present && !appear.current) return;
    appear.current = true;
    frame.style.setProperty('--composer-morph-height', `${card.offsetHeight}px`);
    // The frame takes its explicit height before the transition starts, so the exit runs from it (not from `auto`).
    frame.setAttribute('data-morphing', '');
    void frame.offsetHeight;
    setMorphing(true);
    if (present) return animateIn(frame, () => setMorphing(false));
    return animateOut(frame, () => {
      setMorphing(false);
      exited.current?.();
      done.current?.();
      // The source may still be marked merged with this card; draw once more without it.
      requestAnimationFrame(draw);
    });
  }, [present, draw]);

  return (
    <div
      ref={frameRef}
      data-slot="composer-morph-frame"
      data-morphing={morphing || undefined}
      className={cn(
        'group/morph relative min-w-0 shrink-0',
        side === 'top' ? 'pb-(--composer-morph-gap)' : 'pt-(--composer-morph-gap)',
        // Morphing, the frame holds the card plus the gap, and grows from nothing (or shrinks back) on the smooth spring.
        'data-morphing:pointer-events-none data-morphing:h-[calc(var(--composer-morph-height,0px)+var(--composer-morph-gap))] data-morphing:p-0',
        'transition-[height] duration-spring-smooth ease-spring-smooth data-starting-style:h-0! data-ending-style:h-0! motion-reduce:transition-none',
      )}
      style={{ '--composer-morph-gap': `${gap}px` } as React.CSSProperties}
    >
      <div
        ref={(el) => {
          cardRef.current = el;
          if (typeof ref === 'function') ref(el);
          else if (ref) ref.current = el;
        }}
        data-slot="composer-morph-card"
        className={cn(
          'box-border min-w-0 overflow-hidden border-solid',
          'border-(length:--composer-morph-border-width,1px) border-(--composer-morph-border,var(--border)) bg-(--composer-morph-bg,var(--card))',
          'rounded-(--composer-morph-radius,15px) [box-shadow:var(--composer-morph-shadow,none)]',
          // It starts inside its source: pinned to the frame's edge that faces away from it.
          side === 'top' ? 'group-data-morphing/morph:absolute group-data-morphing/morph:inset-x-0 group-data-morphing/morph:top-0' : 'group-data-morphing/morph:absolute group-data-morphing/morph:inset-x-0 group-data-morphing/morph:bottom-0',
          className,
        )}
        inert={!present || undefined}
        {...props}
      >
        {/* Inside its source the content is blurred and clear; it sharpens as the card comes out. */}
        <div
          data-slot="composer-morph-body"
          className="min-w-0 transition-[opacity,filter] duration-spring-smooth ease-spring-smooth group-data-starting-style/morph:opacity-0 group-data-starting-style/morph:blur-[10px] group-data-ending-style/morph:opacity-0 group-data-ending-style/morph:blur-[10px] motion-reduce:transition-none"
        >
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

/** Why the queue changed: a draft queued while a reply streams, one sent (by itself or "Send now"), merged back
    to edit, removed, or code. */
export type ComposerQueueItemsChangeReason = 'queue' | 'send' | 'edit' | 'remove' | 'imperative';
export type ComposerQueueItemsChangeDetails = ChangeDetails<ComposerQueueItemsChangeReason>;

export interface ComposerQueueProps extends Omit<ComposerCardsProps, 'children' | 'onChange'> {
  /** Controlled queue. */
  items?: ComposerQueueItem[];
  defaultItems?: ComposerQueueItem[];
  /** Called before the queue changes; `details.cancel()` keeps the card where it is. */
  onItemsChange?: (items: ComposerQueueItem[], details: ComposerQueueItemsChangeDetails) => void;
  /** Send the first queued message by itself once the reply ends (default true). */
  autoSend?: boolean;
  /** Draws a queued message's card (default: its text, attachment count, and Edit / Send now / Remove). */
  renderItem?: (item: ComposerQueueItem, actions: ComposerQueueActions) => React.ReactNode;
}

/** A queued card's actions. Pass the event that triggered one (a click) so `onItemsChange` reports its source. */
export interface ComposerQueueActions {
  /** Merges the card back into the composer and puts its text back in the draft (focus goes to the editor). */
  edit: (event?: Event) => void;
  /** Stops the reply (if one is streaming) and sends this message now. */
  sendNow: (event?: Event) => void;
  /** Takes the card out of the queue. */
  remove: (event?: Event) => void;
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
  const [items, change] = useControllableChange<ComposerQueueItem[], ComposerQueueItemsChangeReason>(itemsProp, defaultItems, onItemsChange);
  const itemsRef = useRef(items);
  itemsRef.current = items;
  // Why a card left, so its exit knows what to do once it has merged back in.
  const leaving = useRef(new Map<string, { item: ComposerQueueItem; reason: 'send' | 'edit' | 'remove' }>());
  const feeding = useRef(false);
  const [settled, setSettled] = useState(0);
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  React.useEffect(() => {
    setQueue((markdown, attachments, event) => change((all) => [...all, { id: queueId(), markdown, attachments }], { reason: 'queue', event }));
    return () => setQueue(null);
  }, [setQueue, change]);

  const leave = React.useCallback(
    (id: string, reason: 'send' | 'edit' | 'remove', event?: Event) => {
      const item = itemsRef.current.find((i) => i.id === id);
      if (!item) return false;
      leaving.current.set(id, { item, reason });
      if (reason === 'send') feeding.current = true;
      if (change((all) => all.filter((i) => i.id !== id), { reason, event })) return true;
      // Canceled: the card stays.
      leaving.current.delete(id);
      if (reason === 'send') feeding.current = false;
      return false;
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
      item.attachments.forEach((a) => addAttachment(a));
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
          edit: (event) => {
            // Editing goes to the draft: focus moves there now, not to the next card.
            if (leave(item.id, 'edit', event)) {
              const editor = ctxRef.current.editor;
              if (editor && !editor.isDestroyed) editor.commands.focus('end');
            }
          },
          sendNow: (event) => {
            if (leave(item.id, 'send', event) && streaming) stop();
          },
          remove: (event) => leave(item.id, 'remove', event),
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
      <ComposerButton aria-label="Edit queued message" onClick={(event) => actions.edit(event.nativeEvent)}>
        <Icon name="square-pencil" size={14} />
      </ComposerButton>
      <ComposerButton aria-label="Send now" onClick={(event) => actions.sendNow(event.nativeEvent)}>
        <Icon name="arrow-up-compact" size={14} sw={2.2} />
      </ComposerButton>
      <ComposerButton aria-label="Remove from queue" onClick={(event) => actions.remove(event.nativeEvent)}>
        <Icon name="xmark-large" size={12} />
      </ComposerButton>
    </div>
  );
}
