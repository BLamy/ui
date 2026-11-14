'use client';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { bindLayer, type ChangeDetails } from '@ui-sdk/core';
import { Button as SdkButton } from '@ui-sdk/react/button';
import { collectSlots, defineSlot } from '@/lib/container';
import { springCss } from '@/lib/motion';
import { themeScopeClass, useAppearance } from '@/lib/theme';
import { useControllableChange } from '@/lib/controllable-state';
import { cva } from 'class-variance-authority';
import { ComposerBump, ComposerBumpContent, ComposerBumpHandle, ComposerFab, ComposerOutlet, type ComposerBumpProgress } from '@/components/ui/composer/composer';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { sheetToneProps, useHideOnScroll, type FloatingSheetAppearance, type FloatingSheetFabPosition, type FloatingSheetTone } from '@/components/ui/floating-sheet';
import { ChatHostContext } from '@/lib/persistent-host';

export type FloatingChatFabPosition = FloatingSheetFabPosition;

/** Why the chat opened or closed: its handle was pressed or dragged (`swipe`), Escape, a press outside the chat
    (on the scrim or anywhere else), the FAB, or code (`setOpen` from `useFloatingChat`). */
export type FloatingChatOpenChangeReason = 'handle-press' | 'swipe' | 'escape-key' | 'outside-press' | 'trigger-press' | 'imperative';
/** What `onOpenChange` receives: `reason`, the `event` behind it when there is one, `source`, and `cancel()`. */
export type FloatingChatOpenChangeDetails = ChangeDetails<FloatingChatOpenChangeReason>;

/** Why the chat folded into its FAB or unfolded: dragged below rest (`swipe`), the FAB or the folded bump pressed
    (`trigger-press`), or code (`setMinimized`, or opening the chat while it is folded). */
export type FloatingChatMinimizedChangeReason = 'swipe' | 'trigger-press' | 'imperative';
export type FloatingChatMinimizedChangeDetails = ChangeDetails<FloatingChatMinimizedChangeReason>;

/** Why the real composer came back or went: the working status pressed (`trigger-press`), the chat opened by its
    handle (`handle-press`) or a drag (`swipe`), or code (`setComposing`, or `working` starting or stopping). */
export type FloatingChatComposingChangeReason = 'trigger-press' | 'handle-press' | 'swipe' | 'imperative';
export type FloatingChatComposingChangeDetails = ChangeDetails<FloatingChatComposingChangeReason>;

export interface FloatingChatContextValue {
  /** Whether the full transcript is revealed. */
  open: boolean;
  setOpen: (open: boolean) => void;
  /** 0 when only the composer floats, 1 when the transcript has grown to the top of the host. */
  progress: number;
  /** Whether the real composer is showing rather than the tappable working status. */
  composing: boolean;
  setComposing: (composing: boolean) => void;
  /** Whether the chat has been folded into its FAB. */
  minimized: boolean;
  setMinimized: (minimized: boolean) => void;
}

const FloatingChatContext = createContext<FloatingChatContextValue | null>(null);

export function useFloatingChat(): FloatingChatContextValue {
  const value = useContext(FloatingChatContext);
  if (!value) {
    throw new Error('useFloatingChat must be used within <FloatingChat>');
  }
  return value;
}

export interface FloatingChatProps {
  /** Controlled state for the revealed full chat. */
  open?: boolean;
  defaultOpen?: boolean;
  /** The chat opened or closed. Call `details.cancel()` to keep it as it is. */
  onOpenChange?: (open: boolean, details: FloatingChatOpenChangeDetails) => void;
  /** Collapses the composer card into a tappable working status. */
  working?: boolean;
  workingLabel?: ReactNode;
  /** Called when the working status is tapped before the composer is revealed. */
  onAdd?: () => void;
  /** Controlled composer visibility while `working`; defaults to hiding the composer whenever work starts. */
  composing?: boolean;
  /** The composer showing or hiding while `working`. Call `details.cancel()` to keep it as it is. */
  onComposingChange?: (composing: boolean, details: FloatingChatComposingChangeDetails) => void;
  /** Follow NavigationStack/List scroll chrome, like TabBar. */
  hideOnScroll?: boolean;
  /** A scroller whose direction also hides and restores the floating composer. */
  scrollRef?: RefObject<HTMLElement | null>;
  /** Resting position after the chat is dragged down into its FAB. */
  fabPosition?: FloatingChatFabPosition;
  /** Controlled fold into the FAB (dragging below rest folds it; the FAB unfolds it). */
  minimized?: boolean;
  defaultMinimized?: boolean;
  /** The chat folding into its FAB or unfolding. Call `details.cancel()` to keep it as it is. */
  onMinimizedChange?: (minimized: boolean, details: FloatingChatMinimizedChangeDetails) => void;
  /** Inset of the floating composer from the host edges. */
  gutter?: number;
  /**
   * Height of transcript kept visible above the composer while the chat is closed, so the
   * newest reply peeks out (maps, dashboards). `0` shows the composer alone.
   */
  peek?: number;
  /** Glass over the host, or opaque cards. */
  appearance?: FloatingSheetAppearance;
  /**
   * Colour scheme of the surfaces. Defaults to the ambient `AppearanceProvider` value, else `auto`
   * (inherit the host's tokens).
   */
  tone?: FloatingSheetTone;
  /** Accessible name for the revealed transcript region. */
  label?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** The layer. --ck-sheet-surface / --ck-sheet-line are the RGB triplets the glass mixes its alphas into (dark glass
    unless the tone is light). ck-floating-chat keeps the host's palette for the transcript (styles.css). */
export const floatingChatVariants = cva(
  'ck-floating-chat pointer-events-none absolute inset-0 z-40 text-foreground [font-family:var(--bl-font,-apple-system,BlinkMacSystemFont,"SF_Pro_Text",sans-serif)]',
  {
    variants: {
      tone: {
        auto: '[--ck-sheet-line:255,255,255] [--ck-sheet-surface:18,18,22]',
        dark: '[--ck-sheet-line:255,255,255] [--ck-sheet-surface:18,18,22]',
        light: '[--ck-sheet-line:0,0,0] [--ck-sheet-surface:250,250,252]',
      },
    },
    defaultVariants: { tone: 'auto' },
  },
);

/** The transcript's bump on top of the composer: glass that firms up as it grows, or an opaque card. */
export const floatingChatBumpVariants = cva('ck-floating-chat__bump', {
  variants: {
    appearance: {
      glass:
        'border-[color:rgba(var(--ck-sheet-line),.14)] bg-[color:rgba(var(--ck-sheet-surface),calc(.5_+_.4_*_var(--bump-progress,0)))] [box-shadow:inset_0_1px_0_color-mix(in_srgb,var(--color-white)_12%,transparent)] backdrop-blur-[16px]',
      sheet: 'border-[color:rgba(var(--ck-sheet-line),.1)] bg-(--ck-host-card)',
    },
  },
  defaultVariants: { appearance: 'glass' },
});

/** The FAB the chat folds into: glazed or opaque, resting at one of eight spots. */
export const floatingChatFabVariants = cva('absolute border-[color:rgba(var(--ck-sheet-line),.14)] text-foreground', {
  variants: {
    appearance: {
      glass: 'bg-[color:rgba(var(--ck-sheet-surface),.62)]',
      sheet: 'bg-card',
    },
    position: {
      'top-left': 'top-(--ck-chat-gutter) left-(--ck-chat-gutter)',
      'top-center': 'top-(--ck-chat-gutter) left-1/2 -translate-x-1/2',
      'top-right': 'top-(--ck-chat-gutter) right-(--ck-chat-gutter)',
      'center-left': 'top-1/2 left-(--ck-chat-gutter) -translate-y-1/2',
      'center-right': 'top-1/2 right-(--ck-chat-gutter) -translate-y-1/2',
      'bottom-left': 'bottom-(--ck-chat-gutter) left-(--ck-chat-gutter)',
      'bottom-center': 'bottom-[max(var(--ck-chat-gutter),20px)] left-1/2 -translate-x-1/2',
      'bottom-right': 'bottom-(--ck-chat-gutter) right-(--ck-chat-gutter)',
    },
  },
  defaultVariants: { appearance: 'glass', position: 'bottom-center' },
});

/** The embedded Workbench Composer's theme scope: the bl-theme's `glass` (dark unless the chat's tone is light). */
export function glassScopeProps(tone: FloatingSheetTone) {
  return { 'data-theme-scope': 'glass' as const, className: themeScopeClass(tone === 'light' ? 'light' : 'dark') };
}

/**
 * The floating chat: the host's Workbench `Composer` floats over any positioned host, and the transcript
 * hangs off a draggable top bump of that composer (added through a `ComposerOutlet`, so the composer itself
 * is whatever the host composed). Drag the bump's handle up and the transcript grows to the top of the host
 * over a scrim; release snaps open or closed. Open, the chat is a layer in UI SDK's stack (`bindLayer`): Escape or
 * a press outside it (the scrim included) closes it, after any popup opened from inside it. Drag it down past rest to
 * fold everything into a FAB.
 */
export function FloatingChat({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  working = false,
  workingLabel = 'Working…',
  onAdd,
  composing: controlledComposing,
  onComposingChange,
  hideOnScroll = true,
  scrollRef,
  fabPosition = 'bottom-center',
  minimized: controlledMinimized,
  defaultMinimized = false,
  onMinimizedChange,
  gutter = 16,
  peek = 0,
  appearance = 'glass',
  tone: toneProp,
  label = 'Full chat',
  children,
  className,
  style,
}: FloatingChatProps) {
  const ambient = useAppearance();
  const tone: FloatingSheetTone = toneProp ?? ambient ?? 'auto';
  const toneProps = sheetToneProps(tone);
  const glassScope = glassScopeProps(tone);
  const layerRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const [bump, setBump] = useState<ComposerBumpProgress>({ progress: 0, reveal: 0, minimize: 0, dragging: false, settling: false });
  // Inside ArtifactChatContainer the composer and transcript are shared with the docked layout: this chat
  // gives them docks and reports its outlet instead of rendering its own copies.
  const shared = useContext(ChatHostContext);
  // Every change goes through these with its reason: the consumer hears it first and may cancel it.
  const [open, changeOpen] = useControllableChange<boolean, FloatingChatOpenChangeReason>(controlledOpen, defaultOpen, onOpenChange);
  const setOpen = (next: boolean) => changeOpen(next);
  // The bump reports only the new state: a change while it was being dragged is a swipe, any other a handle press
  // (whose click is kept here on its way to the bump).
  const bumpRef = useRef(bump);
  bumpRef.current = bump;
  const handleClick = useRef<Event | undefined>(undefined);
  const [composing, setComposing] = useControllableChange<boolean, FloatingChatComposingChangeReason>(controlledComposing, !working, onComposingChange);
  const [minimized, setMinimized] = useControllableChange<boolean, FloatingChatMinimizedChangeReason>(controlledMinimized, defaultMinimized, onMinimizedChange);
  useEffect(() => {
    // Work starting hides the composer and work stopping brings it back (uncontrolled; a controlled parent decides).
    if (controlledComposing === undefined) setComposing(!working);
  }, [working]);
  useEffect(() => {
    // Opening the chat unfolds it.
    if (open && minimized) setMinimized(false);
  }, [open]);

  const slots = collectSlots(children);
  const idle = working && !composing;
  const expanded = bump.reveal > 0;
  const hidden = useHideOnScroll(hideOnScroll, scrollRef) && !expanded;
  const glass = appearance === 'glass';
  // Glass blurs what's behind the card; an opaque sheet gives the card the host's card colour.
  const composerClass = cn('ck-floating-chat__composer', glass ? '[&_[data-slot=composer-card]]:backdrop-blur-[16px]' : '[--card:var(--ck-host-card)]');
  const fold = bump.minimize;

  const revealComposer = (event: Event) => {
    setComposing(true, { reason: 'trigger-press', event });
    onAdd?.();
  };

  // While the agent works the card becomes a tappable status; the real card stays mounted underneath.
  const idleRef = useRef(idle);
  idleRef.current = idle;
  const labelRef = useRef(workingLabel);
  labelRef.current = workingLabel;
  const revealRef = useRef(revealComposer);
  revealRef.current = revealComposer;
  const renderCard = useCallback(
    (card: ReactNode) =>
      idle ? (
        <div data-slot="floating-chat-card" className="relative z-1 min-w-0">
          <SdkButton
            data-floating-chat-working=""
            // Swaps in for the card with a soft rise; the real card waits, mounted, underneath.
            className={cn(
              'box-border flex min-h-row w-full animate-[ck-in_var(--duration-spring-smooth)_var(--ease-spring-smooth)_both] cursor-pointer items-center gap-[10px] rounded-[15px] border border-border bg-card px-[15px] py-1.5 text-left [font:inherit] text-foreground shadow-[0_6px_24px_black] shadow-black/7 dark:shadow-black/28 outline-none motion-reduce:animate-none focus-visible:ring-2 focus-visible:ring-primary/60',
              glass && 'backdrop-blur-[16px]',
            )}
            onClick={(event) => revealRef.current(event.nativeEvent)}
          >
            <span className="grid animate-[ck-floating-working_1.8s_ease-in-out_infinite] place-items-center text-muted-foreground motion-reduce:animate-none" aria-hidden="true">
              <Icon name="sparkle" size={18} sw={1.9} />
            </span>
            <span className="min-w-0 flex-1 truncate text-subhead font-[560] text-muted-foreground">{labelRef.current}</span>
            <Icon name="plus" size={20} sw={1.9} />
            <span className="sr-only">Add something new</span>
          </SdkButton>
          <div data-inactive="" aria-hidden inert className="pointer-events-none invisible absolute inset-x-0 bottom-0">
            {card}
          </div>
        </div>
      ) : (
        card
      ),
    // Rebuilt only when the card's look changes; the label and reveal are read through refs.
    [idle, workingLabel, glass],
  );

  const parts = (
    <ComposerBump
      side="top"
      draggable
      open={open}
      onOpenChange={(next) => {
        const event = handleClick.current;
        handleClick.current = undefined;
        const why = bumpRef.current.dragging ? ({ reason: 'swipe' } as const) : ({ reason: 'handle-press', event } as const);
        // Opening the chat while the agent works always brings the composer back.
        if (next && idleRef.current) {
          setComposing(true, why);
          onAdd?.();
        }
        changeOpen(next, why);
      }}
      // Escape belongs to the chat's own layer (below), which also hears outside presses.
      closeOnEscape={false}
      peek={peek}
      bounds={layerRef}
      boundsInset={gutter}
      minimizable
      minimized={minimized}
      // The bump folds on a drag below rest and unfolds on a press of the folded bump.
      onMinimizedChange={(next, details) => {
        if (!setMinimized(next, { reason: details.reason === 'drag' ? 'swipe' : 'trigger-press', event: details.event })) details.cancel();
      }}
      onProgressChange={setBump}
      data-slot="floating-chat-bump"
      className={floatingChatBumpVariants({ appearance })}
    >
      {/* The bump sits inside the Composer's glass scope; the transcript on it takes the host's palette back
          (ck-floating-chat__transcript, styles.css). */}
      <ComposerBumpContent label={label}>
        {shared ? (
          <div ref={shared.chatDock} data-slot="floating-chat-transcript" className="ck-floating-chat__transcript flex h-full min-h-0 min-w-0 flex-col" />
        ) : (
          <div data-slot="floating-chat-transcript" className="ck-floating-chat__transcript contents">
            {slots.chat}
          </div>
        )}
      </ComposerBumpContent>
      <ComposerBumpHandle
        label={open ? 'Collapse chat' : 'Expand chat'}
        className="pt-px [&>[data-bump-grip]]:top-px"
        onClick={(event) => {
          handleClick.current = event.nativeEvent;
        }}
      />
    </ComposerBump>
  );

  // Report the outlet every render (the bump's props follow this chat's state).
  useLayoutEffect(() => {
    shared?.outlet.set({ parts, renderCard, className: composerClass });
  });
  useLayoutEffect(() => () => shared?.outlet.set(null), [shared]);

  // Open, the chat is a layer: Escape and presses outside the dock (the scrim, the page) close it, and a popup
  // opened from the composer or transcript closes first.
  useEffect(() => {
    const el = dockRef.current;
    if (!open || !el) return;
    return bindLayer(el, {
      onDismiss: (reason, event) => {
        if (reason === 'window-blur') return;
        changeOpen(false, { reason, event });
      },
    });
  }, [open]);

  // Follow the finger while it drags; on release the scrim and the dock spring to rest (their transitions run again).
  const driving = bump.dragging;
  // Folding into the FAB, the dock shrinks toward where the FAB sits while the FAB grows out of it.
  const foldOrigin = fabPosition.endsWith('left') ? 'bottom left' : fabPosition.endsWith('right') ? 'bottom right' : 'bottom center';

  const value: FloatingChatContextValue = {
    open,
    setOpen,
    progress: bump.progress,
    composing,
    setComposing,
    minimized,
    setMinimized,
  };

  return (
    <FloatingChatContext.Provider value={value}>
      <div
        ref={layerRef}
        data-slot="floating-chat"
        data-appearance={appearance}
        data-tone={tone === 'auto' ? undefined : tone}
        data-theme-scope={toneProps['data-theme-scope']}
        data-open={open || undefined}
        data-expanded={expanded || undefined}
        data-dragging={bump.dragging || undefined}
        data-minimized={minimized || undefined}
        data-hidden={hidden || undefined}
        className={cn(floatingChatVariants({ tone }), toneProps.className, className)}
        style={{ '--ck-chat-gutter': `${gutter}px`, '--ck-chat-fold': fold, '--ck-chat-progress': bump.progress, ...style } as CSSProperties}
      >
        {/* Dims the host as far as the transcript has grown, and keeps presses off the host while open: a press on it
            is an outside press of the chat's layer, which closes it. Decorative, so it is out of the tab order and the
            accessibility tree. Mounted only while the chat is open or growing. */}
        {open || bump.progress > 0 ? (
          <div
            aria-hidden="true"
            data-slot="floating-chat-scrim"
            className={cn(
              'absolute inset-0 z-0 bg-black opacity-[calc(.16*var(--ck-chat-progress))] motion-reduce:[transition:none]',
              open ? 'pointer-events-auto' : 'pointer-events-none',
            )}
            // The bump's spring writes progress every frame; only other changes transition.
            style={{ transition: driving ? 'none' : springCss('opacity', 'smooth') }}
          />
        ) : null}
        <div
          ref={dockRef}
          data-slot="floating-chat-dock"
          className={cn(
            'ck-floating-chat__dock absolute inset-x-(--ck-chat-gutter) bottom-(--ck-chat-gutter) z-2 min-w-0 motion-reduce:[transition:none]!',
            minimized || hidden ? 'pointer-events-none' : 'pointer-events-auto',
            hidden ? 'translate-y-[calc(100%_+_44px)] opacity-0' : '',
          )}
          style={{
            transformOrigin: foldOrigin,
            transition: driving ? 'none' : springCss(['transform', 'opacity'], 'smooth'),
            ...(!hidden
              ? { opacity: Math.max(0, 1 - fold * 1.4), transform: fold ? `translateY(${fold * 10}px) scale(${1 - fold * 0.72}, ${1 - fold * 0.5})` : undefined }
              : null),
          }}
          aria-hidden={minimized || undefined}
          inert={minimized || undefined}
        >
          {/* The embedded Workbench Composer paints with the bl-theme's `glass` scope. */}
          {shared ? (
            <div
              ref={shared.composerDock}
              data-slot="floating-chat-composer"
              data-theme-scope={glassScope['data-theme-scope']}
              className={cn('min-w-0', glassScope.className)}
            />
          ) : (
            <div data-slot="floating-chat-composer" data-theme-scope={glassScope['data-theme-scope']} className={cn('min-w-0', glassScope.className)}>
              <ComposerOutlet parts={parts} renderCard={renderCard} className={composerClass}>
                {slots.composer}
              </ComposerOutlet>
            </div>
          )}
        </div>
        {/* The same FAB a Composer folds into, placed and glazed for the floating layer. */}
        <ComposerFab
          data-slot="floating-chat-fab"
          aria-label="Open chat"
          className={cn(
            floatingChatFabVariants({ appearance, position: fabPosition }),
            minimized ? 'pointer-events-auto' : 'pointer-events-none',
          )}
          style={{
            opacity: fold,
            // Grows out of the folding dock.
            scale: 0.6 + 0.4 * fold,
            transition: driving ? 'none' : springCss(['opacity', 'scale'], 'snappy'),
            ...(glass ? { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } : null),
          }}
          onClick={(event) => {
            changeOpen(false, { reason: 'trigger-press', event: event.nativeEvent });
            setMinimized(false, { reason: 'trigger-press', event: event.nativeEvent });
          }}
        >
          <Icon name="sparkle" size={22} sw={1.9} />
        </ComposerFab>
      </div>
    </FloatingChatContext.Provider>
  );
}

FloatingChat.Chat = defineSlot('chat');
FloatingChat.Composer = defineSlot('composer');
FloatingChat.Context = FloatingChatContext;
FloatingChat.useFloatingChat = useFloatingChat;
