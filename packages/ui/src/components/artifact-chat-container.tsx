'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { animate } from 'framer-motion';
import { Button as SdkButton } from '@ui-sdk/react/button';
import type { ChangeDetails } from '@ui-sdk/core';
import { cva } from 'class-variance-authority';
import type { SizeClass } from '@/lib/size-class';
import { SizeClassProvider, useSizeClass } from '@/lib/container';
import { springs } from '@/lib/motion';
import { usePresence } from '@/lib/presence';
import { prefersReducedMotion } from '@/lib/reduced-motion';
import { useControllableChange } from '@/lib/controllable-state';
import type { ChangeGiven } from '@/lib/change-details';
import { ThemeScope, ThemeScopeContext, themeScopeClass, type Appearance, type ThemeScopeState } from '@/lib/theme';
import { useKeptChildren, type KeptChildren } from '@/lib/kept-children';
import { focusRing } from '@/lib/primitives';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { ComposerOutlet, composerCardVariants } from '@/components/ui/composer/composer';
import {
  FloatingSheet,
  FloatingSheetBody,
  FloatingSheetFab,
  FloatingSheetFooter,
  type FloatingSheetAppearance,
  type FloatingSheetChangeDetails,
  type FloatingSheetFabAlign,
  type FloatingSheetFabSide,
  type FloatingSheetMinimizedChangeDetails,
  type FloatingSheetMinimizedChangeReason,
  type FloatingSheetSize,
  type FloatingSheetVariant,
} from '@/components/ui/floating-sheet';

/* ══ ArtifactChatContainer — a chat beside an artifact, or floating over it ══
   <ArtifactChatContainer>
     <ArtifactChatContainerContent>…the artifact…</ArtifactChatContainerContent>
     <ArtifactChatContainerChat>…the transcript…</ArtifactChatContainerChat>
     <ArtifactChatContainerComposer><Composer>…</Composer></ArtifactChatContainerComposer>
   </ArtifactChatContainer>
   On a wide container the chat is a column beside the content (`split`); on a compact one (or `layout="floating"`)
   it is a FloatingSheet over the content: the composer is its foot, the transcript its body, and it peeks, grows
   and folds into a FAB. The transcript and composer are rendered once and move between the two, so a draft, the
   caret and a streaming reply survive the switch. ══ */

/** The resolved presentation: the docked chat column, or the chat floating over the content. */
export type ArtifactChatLayout = 'split' | 'floating';
/** Which inline edge the docked column sits on (left / right in a left-to-right page). */
export type ArtifactChatSide = 'start' | 'end';
/** What `onOpenChange` receives: the floating sheet's details (`swipe`, `handle-press`, `handle-key`, `escape-key`,
    `outside-press`, `imperative`) with `cancel()`. */
export type ArtifactChatContainerOpenChangeDetails = FloatingSheetChangeDetails;
type OpenChangeReason = ArtifactChatContainerOpenChangeDetails['reason'];
/** Why the real composer came back or went: the working status pressed (`trigger-press`), the chat grown by its
    cap (`handle-press`, `handle-key`) or a drag (`swipe`), or code (`setComposing`, or `working` starting or
    stopping). */
export type ArtifactChatComposingChangeReason = 'trigger-press' | 'handle-press' | 'handle-key' | 'swipe' | 'imperative';
export type ArtifactChatComposingChangeDetails = ChangeDetails<ArtifactChatComposingChangeReason>;

export interface ArtifactChatContainerContextValue {
  /** The container's own size class (`compact` below `breakpoint`). */
  sizeClass: SizeClass;
  /** The resolved presentation. */
  layout: ArtifactChatLayout;
  /** Whether the floating chat has grown over the content. Always false while docked. */
  open: boolean;
  /** Grows the floating chat or brings it back to rest (`onOpenChange` hears `imperative`). */
  setOpen: (open: boolean, given?: ChangeGiven<OpenChangeReason>) => void;
  /** Whether the real composer shows, rather than the working status (while `working`). */
  composing: boolean;
  setComposing: (composing: boolean, given?: ChangeGiven<ArtifactChatComposingChangeReason>) => void;
  /** Whether the floating chat is folded into its FAB. */
  minimized: boolean;
  setMinimized: (minimized: boolean, given?: ChangeGiven<FloatingSheetMinimizedChangeReason>) => void;
}

const ArtifactChatContainerContext = createContext<ArtifactChatContainerContextValue | null>(null);

export function useArtifactChatContainer(): ArtifactChatContainerContextValue {
  const value = useContext(ArtifactChatContainerContext);
  if (!value) {
    throw new Error('useArtifactChatContainer must be used within <ArtifactChatContainer>');
  }
  return value;
}

/* What the parts read from the root; not public. */
interface PartsContextValue {
  layout: ArtifactChatLayout;
  side: ArtifactChatSide;
  contentRef: RefObject<HTMLDivElement | null>;
  /** The Chat and Composer parts keep their children mounted (`useKeptChildren`) and hand the root their dock refs. */
  keepChat: (dock: KeptChildren['dock'] | null) => void;
  keepComposer: (dock: KeptChildren['dock'] | null) => void;
  scheme: Appearance | undefined;
  renderCard?: (card: ReactNode) => ReactNode;
}
const PartsContext = createContext<PartsContextValue | null>(null);

function useParts(part: string): PartsContextValue {
  const value = useContext(PartsContext);
  if (!value) throw new Error(`${part} must be used within <ArtifactChatContainer>`);
  return value;
}

/** The container: the chat column beside the content (`split`, on the `chatSide` edge), or the content full-bleed
    under the floating chat. ck-artifact-chat stays as a hook for hosts. */
export const artifactChatContainerVariants = cva(
  'ck-artifact-chat relative isolate h-full w-full min-h-0 min-w-0 overflow-hidden bg-background font-sans text-foreground',
  {
    variants: {
      layout: {
        split: 'grid',
        floating: 'block',
      },
      chatSide: { start: '', end: '' },
    },
    compoundVariants: [
      { layout: 'split', chatSide: 'start', class: 'grid-cols-[minmax(0,var(--ck-artifact-chat-width,400px))_minmax(0,1fr)]' },
      { layout: 'split', chatSide: 'end', class: 'grid-cols-[minmax(0,1fr)_minmax(0,var(--ck-artifact-chat-width,400px))]' },
    ],
    defaultVariants: { layout: 'split', chatSide: 'start' },
  },
);

export interface ArtifactChatContainerProps extends Omit<ComponentProps<'div'>, 'children'> {
  /**
   * `auto` (default) docks the chat beside the content while the container is at least `breakpoint` wide and floats
   * it below. `floating` always floats it over the content (maps, canvases, full-bleed artifacts); `split` always
   * docks it.
   */
  layout?: 'auto' | ArtifactChatLayout;
  /** The container width, px, below which `auto` floats the chat: the container's size class is `compact` under it
      (`data-size-class` on the root, and the size-class scope popups inside follow). Default 760. */
  breakpoint?: number;
  /** Width of the docked chat column. Default 400. */
  chatWidth?: number | string;
  /** Which inline edge the docked column sits on. Default `start`; `end` for an assistant beside an app's page. */
  chatSide?: ArtifactChatSide;
  /** Accessible name of the chat (the docked column's landmark, the floating sheet, and "Open …" on its FAB). */
  chatLabel?: string;
  /** Controlled state of the floating chat grown over the content. */
  open?: boolean;
  defaultOpen?: boolean;
  /** The floating chat grew or came back to rest. `details.cancel()` keeps it where it is. */
  onOpenChange?: (open: boolean, details: ArtifactChatContainerOpenChangeDetails) => void;
  /** Controlled fold of the floating chat into its FAB (a drag below rest folds it; the FAB unfolds it). */
  minimized?: boolean;
  defaultMinimized?: boolean;
  onMinimizedChange?: (minimized: boolean, details: FloatingSheetMinimizedChangeDetails) => void;
  /** The agent is working: the floating composer becomes a tappable status that brings the composer back. */
  working?: boolean;
  /** The status's text. Default "Working…". */
  workingLabel?: ReactNode;
  /** Controlled: whether the real composer shows while `working` (it hides when work starts, by default). */
  composing?: boolean;
  /** The composer showing or hiding while `working`. `details.cancel()` keeps it as it is. */
  onComposingChange?: (composing: boolean, details: ArtifactChatComposingChangeDetails) => void;
  /** Transcript kept visible above the floating composer while the chat rests (px, or a share of the container). */
  peek?: FloatingSheetSize;
  /** Inset of the floating chat from the container's edges. Default 12. */
  gutter?: number;
  /** The floating chat's look: `glass` (default) over the content, or an opaque `sheet`. */
  variant?: FloatingSheetVariant;
  /** Colour scheme of the chat surfaces (the column, the floating sheet, the composer's glass): `auto` (default)
      follows the page; `light` / `dark` let the chat disagree with it. */
  appearance?: FloatingSheetAppearance;
  /** The edge of the container the FAB rests on. Default `bottom`. */
  fabSide?: FloatingSheetFabSide;
  /** Where along that edge. Default `center`. */
  fabAlign?: FloatingSheetFabAlign;
  /** The FAB's face. Default: a sparkle. */
  fabIcon?: ReactNode;
  /** Hide the resting floating chat while the content scrolls down, or the shared chrome hides. Default true. */
  hideOnScroll?: boolean;
  children?: ReactNode;
}

/**
 * The one chat shell: a chat column docked beside an artifact on a wide container, a FloatingSheet over it on a
 * compact one. Its own box's size class picks the layout and is the size-class scope of what it renders.
 */
export function ArtifactChatContainer({
  layout: requestedLayout = 'auto',
  breakpoint = 760,
  chatWidth = 400,
  chatSide = 'start',
  chatLabel = 'Chat',
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  minimized: controlledMinimized,
  defaultMinimized = false,
  onMinimizedChange,
  working = false,
  workingLabel = 'Working…',
  composing: controlledComposing,
  onComposingChange,
  peek = 0,
  gutter = 12,
  variant = 'glass',
  appearance = 'auto',
  fabSide = 'bottom',
  fabAlign = 'center',
  fabIcon,
  hideOnScroll = true,
  children,
  className,
  style,
  ref,
  ...props
}: ArtifactChatContainerProps) {
  // Its own box's size class, starting from the enclosing scope's until measured.
  const [rootRef, sizeClass] = useSizeClass<HTMLDivElement>({ breakpoints: { medium: breakpoint, regular: Math.max(breakpoint + 1, 1024) } });
  // The first layout has painted: a layout before it is where the container starts, not a switch to animate.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let b = 0;
    const a = requestAnimationFrame(() => {
      b = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(a);
      cancelAnimationFrame(b);
    };
  }, []);
  const setRoot = useCallback(
    (el: HTMLDivElement | null) => {
      rootRef(el);
      if (typeof ref === 'function') ref(el);
      else if (ref) ref.current = el;
    },
    [rootRef, ref],
  );
  const scheme: Appearance | undefined = appearance === 'auto' ? undefined : appearance;
  const layout: ArtifactChatLayout =
    requestedLayout === 'auto' ? (sizeClass === 'compact' ? 'floating' : 'split') : requestedLayout;
  const floating = layout === 'floating';
  const end = chatSide === 'end';

  // Every change goes through these with its reason: the consumer hears it first and may cancel it.
  const [open, changeOpen] = useControllableChange<boolean, OpenChangeReason>(controlledOpen, defaultOpen, onOpenChange);
  const [minimized, changeMinimized] = useControllableChange<boolean, FloatingSheetMinimizedChangeReason>(controlledMinimized, defaultMinimized, onMinimizedChange);
  const [composing, changeComposing] = useControllableChange<boolean, ArtifactChatComposingChangeReason>(controlledComposing, !working, onComposingChange);
  useEffect(() => {
    // Work starting hides the composer and work stopping brings it back (uncontrolled; a controlled parent decides).
    if (controlledComposing === undefined) changeComposing(!working);
  }, [working]);
  useEffect(() => {
    // Growing the chat unfolds it.
    if (open && minimized) changeMinimized(false);
  }, [open]);
  const idle = floating && working && !composing;

  const onSheetOpenChange = (next: boolean, details: FloatingSheetChangeDetails) => {
    const given = { reason: details.reason, event: details.event, source: details.source };
    if (!changeOpen(next, given)) {
      details.cancel();
      return;
    }
    // Growing the chat while the agent works brings the composer back.
    if (next && idle && (details.reason === 'swipe' || details.reason === 'handle-press' || details.reason === 'handle-key')) {
      changeComposing(true, { reason: details.reason, event: details.event, source: details.source });
    }
  };

  // ── one chat, two layouts ──
  // The Chat and Composer parts render their children once and keep them mounted (`useKeptChildren`); the column's
  // or the floating sheet's docks take them in, so switching layouts keeps the draft, the caret and a streaming
  // reply. The composer then flies from its old place to its new one, and the artifact pane is revealed from its
  // old edges.
  const [chatKeep, setChatKeep] = useState<KeptChildren['dock'] | null>(null);
  const [composerKeep, setComposerKeep] = useState<KeptChildren['dock'] | null>(null);
  const keepChat = useCallback((dock: KeptChildren['dock'] | null) => setChatKeep(() => dock), []);
  const keepComposer = useCallback((dock: KeptChildren['dock'] | null) => setComposerKeep(() => dock), []);
  const [composerDock, setComposerDock] = useState<HTMLElement | null>(null);
  // A layout's docks claim the shared parts when they mount; a column that is leaving keeps quiet, so the floating
  // chat's docks keep them.
  const claimChat = useCallback((el: HTMLElement | null) => { if (el) chatKeep?.(el); }, [chatKeep]);
  const claimComposer = useCallback(
    (el: HTMLElement | null) => {
      if (!el) return;
      composerKeep?.(el);
      setComposerDock(el);
    },
    [composerKeep],
  );

  const contentRef = useRef<HTMLDivElement | null>(null);
  const shift = useRef<{ layout: boolean; composer: DOMRect | null; content: DOMRect | null } | null>(null);
  const lastFloating = useRef(floating);
  // The column slides in only when the layout switches to it, and out toward its own edge (data-starting-style and
  // data-ending-style); until the first layout has painted it comes and goes at once, and the composer stays put.
  const column = usePresence<HTMLDivElement>(!floating, { instant: !ready });
  if (!ready) lastFloating.current = floating;
  if (lastFloating.current !== floating && !shift.current && typeof window !== 'undefined') {
    const composerEl = composerDock?.querySelector('[data-slot="composer"]');
    shift.current = {
      layout: floating,
      composer: composerEl?.isConnected ? composerEl.getBoundingClientRect() : null,
      content: contentRef.current?.getBoundingClientRect() ?? null,
    };
  }
  useLayoutEffect(() => {
    lastFloating.current = floating;
    const snap = shift.current;
    // Wait until the new layout's composer dock has been attached.
    // Wait until the new layout's dock holds the composer.
    const composerEl = composerDock?.isConnected ? composerDock.querySelector<HTMLElement>('[data-slot="composer"]') : null;
    if (!snap || snap.layout !== floating || !composerEl) return;
    shift.current = null;
    if (prefersReducedMotion()) return;
    if (snap.composer) {
      const to = composerEl.getBoundingClientRect();
      const from = snap.composer;
      composerEl.style.width = `${from.width}px`;
      const held = composerEl.getBoundingClientRect();
      animate(
        composerEl,
        { x: [from.left - held.left, 0], y: [from.top - held.top, 0], width: [from.width, to.width] },
        {
          ...springs.smooth,
          onComplete: () => {
            composerEl.style.width = '';
            composerEl.style.transform = '';
          },
        },
      );
    }
    const content = contentRef.current;
    if (snap.content && content) {
      // The artifact pane's new box is revealed from the old one's edges.
      const to = content.getBoundingClientRect();
      const f = snap.content;
      const inset = `inset(${Math.max(0, f.top - to.top)}px ${Math.max(0, to.right - f.right)}px ${Math.max(0, to.bottom - f.bottom)}px ${Math.max(0, f.left - to.left)}px)`;
      if (inset !== 'inset(0px 0px 0px 0px)') {
        animate(content, { clipPath: [inset, 'inset(0px 0px 0px 0px)'] }, { ...springs.smooth, onComplete: () => (content.style.clipPath = '') });
      }
    }
  }, [floating, composerDock]);

  // While the agent works the floating composer's card becomes a tappable status; the real card stays mounted under it.
  const revealRef = useRef<(event: Event) => void>(() => undefined);
  const workingId = useId();
  revealRef.current = (event) => changeComposing(true, { reason: 'trigger-press', event });
  const renderCard = useCallback(
    (card: ReactNode) => (
      <div data-slot="artifact-chat-working-card" className="relative z-1 min-w-0">
        <SdkButton
          data-artifact-chat-working=""
          // Swaps in for the card with a soft rise; the real card waits, mounted, underneath.
          className={cn(
            composerCardVariants(),
            'min-h-row w-full flex-nowrap animate-[ck-in_var(--duration-spring-smooth)_var(--ease-spring-smooth)_both] cursor-pointer gap-2.5 px-3.5 py-1.5 text-left [font:inherit] text-foreground motion-reduce:animate-none',
            focusRing,
            variant === 'glass' && 'backdrop-blur-[16px]',
          )}
          // Named for what it does; the status it shows is its description.
          aria-label="Write a message"
          aria-describedby={workingId}
          onClick={(event) => revealRef.current(event.nativeEvent)}
        >
          <span className="grid animate-[ck-floating-working_1.8s_ease-in-out_infinite] place-items-center text-muted-foreground motion-reduce:animate-none" aria-hidden="true">
            <Icon name="sparkle" size={18} sw={1.9} />
          </span>
          <span id={workingId} className="min-w-0 flex-1 truncate text-subhead font-semibold text-muted-foreground">{workingLabel}</span>
          <Icon name="square-pencil" size={19} sw={1.9} />
        </SdkButton>
        <div data-inactive="" aria-hidden inert className="pointer-events-none invisible absolute inset-x-0 bottom-0">
          {card}
        </div>
      </div>
    ),
    [workingLabel, variant, workingId],
  );

  const value: ArtifactChatContainerContextValue = {
    sizeClass,
    layout,
    open: floating && open,
    setOpen: (next, given) => {
      changeOpen(next, given);
    },
    composing,
    setComposing: (next, given) => {
      changeComposing(next, given);
    },
    minimized,
    setMinimized: (next, given) => {
      changeMinimized(next, given);
    },
  };
  const parts: PartsContextValue = {
    layout,
    side: chatSide,
    contentRef,
    keepChat,
    keepComposer,
    scheme,
    renderCard: idle ? renderCard : undefined,
  };

  return (
    <ArtifactChatContainerContext.Provider value={value}>
      <PartsContext.Provider value={parts}>
        <SizeClassProvider value={sizeClass}>
          {/* light / dark paint the chat surfaces only (the docked column, the floating sheet, the composer's glass) in
              the bl-theme's `sheet` scope; the artifact keeps the page's theme. `auto` leaves every scope alone. */}
            <div
              {...props}
              ref={setRoot}
              data-slot="artifact-chat-container"
              data-layout={layout}
              data-appearance={scheme}
              data-chat-side={chatSide}
              className={cn(artifactChatContainerVariants({ layout, chatSide }), className)}
              style={{
                '--ck-artifact-chat-width': typeof chatWidth === 'number' ? `${chatWidth}px` : chatWidth,
                ...style,
              } as CSSProperties}
            >
              {/* The docked column: a landmark holding the docks for the shared transcript and composer. */}
              {column.mounted ? (
                <div
                  ref={column.ref}
                  data-slot="artifact-chat-column"
                  className={cn(
                    'z-2 flex min-h-0 min-w-0 transition-[translate,opacity] duration-spring-smooth ease-spring-smooth data-starting-style:opacity-0 data-ending-style:opacity-0 motion-reduce:transition-none',
                    end
                      ? 'col-start-2 row-start-1 data-starting-style:translate-x-8 data-ending-style:translate-x-12 rtl:data-starting-style:-translate-x-8 rtl:data-ending-style:-translate-x-12'
                      : 'data-starting-style:-translate-x-8 data-ending-style:-translate-x-12 rtl:data-starting-style:translate-x-8 rtl:data-ending-style:translate-x-12',
                    // Leaving, it's out of the flow over the full-bleed content.
                    column.leaving && cn('absolute inset-y-0 w-(--ck-artifact-chat-width)', end ? 'end-0' : 'start-0'),
                  )}
                >
                  {/* ck-artifact-chat__chat stays as a hook for hosts that restyle the docked column. */}
                  <aside
                    aria-label={chatLabel}
                    data-slot="artifact-chat-chat"
                    data-theme-scope={scheme ? 'sheet' : undefined}
                    className={cn('ck-artifact-chat__chat flex min-h-0 min-w-0 flex-1 flex-col border-border bg-card text-foreground', end ? 'border-s' : 'border-e', themeScopeClass(scheme))}
                  >
                    <div ref={claimChat} data-slot="artifact-chat-transcript-dock" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden" />
                    <div ref={claimComposer} data-slot="artifact-chat-composer-dock" className="min-w-0 shrink-0 p-2" />
                  </aside>
                </div>
              ) : null}
              {children}
              {floating ? (
                <FloatingSheet
                  open={open}
                  onOpenChange={onSheetOpenChange}
                  minimized={minimized}
                  onMinimizedChange={(next, details) => {
                    if (!changeMinimized(next, { reason: details.reason, event: details.event, source: details.source })) details.cancel();
                  }}
                  peek={peek}
                  gutter={gutter}
                  variant={variant}
                  appearance={appearance}
                  bodyAlign="end"
                  collapse="fab"
                  hideOnScroll={hideOnScroll}
                  scrollRef={contentRef}
                  aria-label={chatLabel}
                >
                  <FloatingSheetBody>
                    <div ref={claimChat} data-slot="artifact-chat-transcript-dock" className="flex h-full min-h-0 min-w-0 flex-col" />
                  </FloatingSheetBody>
                  {/* Presses on the padding around the composer go through to the cap's touch area behind it. */}
                  <FloatingSheetFooter className="pointer-events-none">
                    <div ref={claimComposer} data-slot="artifact-chat-composer-dock" className="pointer-events-none min-w-0 p-2" />
                  </FloatingSheetFooter>
                  <FloatingSheetFab side={fabSide} align={fabAlign} aria-label={`Open ${chatLabel}`}>{fabIcon ?? <Icon name="sparkle" size={22} sw={1.9} />}</FloatingSheetFab>
                </FloatingSheet>
              ) : null}
            </div>
        </SizeClassProvider>
      </PartsContext.Provider>
    </ArtifactChatContainerContext.Provider>
  );
}

export type ArtifactChatContainerContentProps = ComponentProps<'div'>;

/** The artifact. It stays mounted, in place, across layouts: beside the column when docked, full-bleed under the
    floating chat (which hides while it scrolls down). A plain element, not a landmark: pass `role="main"` (or
    `role="region"` with an `aria-label`) when it is the page's main content. */
export function ArtifactChatContainerContent({ className, ref, ...props }: ArtifactChatContainerContentProps) {
  const { layout, side, contentRef } = useParts('ArtifactChatContainerContent');
  return (
    <div
      ref={(el) => {
        contentRef.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      }}
      data-slot="artifact-chat-content"
      // ck-artifact-chat__content stays as a hook for hosts that restyle the artifact pane.
      className={cn(
        'ck-artifact-chat__content min-h-0 min-w-0 overflow-auto bg-background',
        layout === 'floating' ? 'absolute inset-0' : cn('relative', side === 'end' && 'col-start-1 row-start-1'),
        className,
      )}
      {...props}
    />
  );
}

/** The scope a chat part publishes to popups opened inside it: the `sheet` scope in an explicit appearance. */
function useChatScope(scheme: Appearance | undefined): ThemeScopeState | null {
  return useMemo(() => (scheme ? { scope: 'sheet', appearance: scheme } : null), [scheme]);
}

/** Keeps a part's children mounted and hands its dock ref to the root, which docks them in the current layout. */
function useKeptPart(children: ReactNode, keep: (dock: KeptChildren['dock'] | null) => void, slot: string): ReactNode {
  const kept = useKeptChildren(children, { slot });
  useLayoutEffect(() => {
    keep(kept.dock);
    return () => keep(null);
  }, [keep, kept.dock]);
  return kept.portal;
}

/** The transcript (a Conversation, a MessageScroller…): the docked column's body, or the floating sheet's growing
    body. Rendered once and moved between them; popups opened inside it wear the chat's appearance. */
export function ArtifactChatContainerChat({ children }: { children?: ReactNode }) {
  const { keepChat, scheme } = useParts('ArtifactChatContainerChat');
  const scope = useChatScope(scheme);
  return useKeptPart(scope ? <ThemeScopeContext.Provider value={scope}>{children}</ThemeScopeContext.Provider> : children, keepChat, 'artifact-chat-transcript');
}

/** The Composer: pinned under the docked transcript, or the floating sheet's foot. It wears the bl-theme's `glass`
    scope in the chat's appearance; while `working` floats, its card is swapped for the working status. */
export function ArtifactChatContainerComposer({ children }: { children?: ReactNode }) {
  const { keepComposer, scheme, renderCard } = useParts('ArtifactChatContainerComposer');
  return useKeptPart(
    <ThemeScope scope="glass" appearance={scheme} className="pointer-events-auto min-w-0">
      <ComposerOutlet renderCard={renderCard}>{children}</ComposerOutlet>
    </ThemeScope>,
    keepComposer,
    'artifact-chat-composer',
  );
}
