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
import { Button } from 'react-aria-components';
import { Haptics, collectSlots, defineSlot, springCss, useAppearance, useChromeHidden } from '@brett_lamy/ui';
import { ComposerBump, ComposerBumpContent, ComposerBumpHandle, ComposerFab, ComposerOutlet, type ComposerBumpProgress } from '@brett_lamy/workbench';
import { ChatIcon, chatIconPaths } from './chat-icon';
import { cn } from './cn';
import type { FloatingSheetAppearance, FloatingSheetFabPosition, FloatingSheetTone } from './floating-sheet';
import { ChatHostContext } from './persistent-host';

export type FloatingChatFabPosition = FloatingSheetFabPosition;

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
  onOpenChange?: (open: boolean) => void;
  /** Collapses the composer card into a tappable working status. */
  working?: boolean;
  workingLabel?: ReactNode;
  /** Called when the working status is tapped before the composer is revealed. */
  onAdd?: () => void;
  /** Controlled composer visibility while `working`; defaults to hiding the composer whenever work starts. */
  composing?: boolean;
  onComposingChange?: (composing: boolean) => void;
  /** Follow NavigationStack/List scroll chrome, like TabBar. */
  hideOnScroll?: boolean;
  /** A scroller whose direction also hides and restores the floating composer. */
  scrollRef?: RefObject<HTMLElement | null>;
  /** Resting position after the chat is dragged down into its FAB. */
  fabPosition?: FloatingChatFabPosition;
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

/** Where the folded FAB rests. */
const fabPlacement: Record<FloatingSheetFabPosition, string> = {
  'top-left': 'top-(--ck-chat-gutter) left-(--ck-chat-gutter)',
  'top-center': 'top-(--ck-chat-gutter) left-1/2 -translate-x-1/2',
  'top-right': 'top-(--ck-chat-gutter) right-(--ck-chat-gutter)',
  'center-left': 'top-1/2 left-(--ck-chat-gutter) -translate-y-1/2',
  'center-right': 'top-1/2 right-(--ck-chat-gutter) -translate-y-1/2',
  'bottom-left': 'bottom-(--ck-chat-gutter) left-(--ck-chat-gutter)',
  'bottom-center': 'bottom-[max(var(--ck-chat-gutter),20px)] left-1/2 -translate-x-1/2',
  'bottom-right': 'bottom-(--ck-chat-gutter) right-(--ck-chat-gutter)',
};

/** Hidden by the shared chrome state or by scrolling `scrollRef` down. */
function useScrollHidden(hideOnScroll: boolean, scrollRef?: RefObject<HTMLElement | null>) {
  const chromeHidden = useChromeHidden();
  const [scrollHidden, setScrollHidden] = useState(false);
  useEffect(() => {
    const scroller = scrollRef?.current;
    if (!scroller || !hideOnScroll) {
      setScrollHidden(false);
      return;
    }
    let previous = scroller.scrollTop;
    const onScroll = () => {
      const next = scroller.scrollTop;
      const delta = next - previous;
      previous = next;
      if (next < 4) setScrollHidden(false);
      else if (delta > 3) setScrollHidden(true);
      else if (delta < -3) setScrollHidden(false);
    };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, [scrollRef, hideOnScroll]);
  return hideOnScroll && (chromeHidden || scrollHidden);
}

/**
 * The floating chat: the host's Workbench `Composer` floats over any positioned host, and the transcript
 * hangs off a draggable top bump of that composer (added through a `ComposerOutlet`, so the composer itself
 * is whatever the host composed). Drag the bump's handle up and the transcript grows to the top of the host
 * over a scrim; release snaps open or closed; Escape or the scrim closes it. Drag it down past rest to fold
 * everything into a FAB.
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
  const layerRef = useRef<HTMLDivElement>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const [uncontrolledComposing, setUncontrolledComposing] = useState(!working);
  const [minimized, setMinimized] = useState(false);
  const [bump, setBump] = useState<ComposerBumpProgress>({ progress: 0, reveal: 0, minimize: 0, dragging: false, settling: false });
  // Inside ArtifactChatContainer the composer and transcript are shared with the docked layout: this chat
  // gives them docks and reports its outlet instead of rendering its own copies.
  const shared = useContext(ChatHostContext);
  const open = controlledOpen ?? uncontrolledOpen;
  const composing = controlledComposing ?? uncontrolledComposing;

  const setOpen = (next: boolean) => {
    if (controlledOpen == null) setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const setComposing = (next: boolean) => {
    if (controlledComposing == null) setUncontrolledComposing(next);
    onComposingChange?.(next);
  };

  useEffect(() => {
    if (controlledComposing == null) setUncontrolledComposing(!working);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only resync when work starts or stops
  }, [working]);
  useEffect(() => {
    if (open) setMinimized(false);
  }, [open]);

  const slots = collectSlots(children);
  const idle = working && !composing;
  const expanded = bump.reveal > 0;
  const hidden = useScrollHidden(hideOnScroll, scrollRef) && !expanded;
  const glass = appearance === 'glass';
  const fold = bump.minimize;

  const revealComposer = () => {
    Haptics.selection();
    setComposing(true);
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
          <Button
            data-slot="floating-chat-working"
            // Swaps in for the card with a soft rise; the real card waits, mounted, underneath.
            className="box-border flex min-h-[46px] w-full animate-[ck-in_var(--duration-spring-smooth)_var(--ease-spring-smooth)_both] cursor-pointer items-center gap-[10px] rounded-[15px] border border-wb-sep bg-wb-card px-[15px] py-1.5 text-left [font:inherit] text-wb-label shadow-[0_6px_24px_var(--wb-shadow,rgba(0,0,0,.28))] outline-none motion-reduce:animate-none data-focus-visible:ring-2 data-focus-visible:ring-wb-tint/60"
            onPress={() => revealRef.current()}
          >
            <span className="grid animate-[ck-floating-working_1.8s_ease-in-out_infinite] place-items-center text-wb-label2 motion-reduce:animate-none" aria-hidden="true">
              <ChatIcon d={chatIconPaths.spark} size={18} />
            </span>
            <span className="min-w-0 flex-1 truncate text-[15px] font-[560] text-wb-label2">{labelRef.current}</span>
            <ChatIcon d={chatIconPaths.plus} size={20} />
            <span className="sr-only">Add something new</span>
          </Button>
          <div data-inactive="" aria-hidden inert className="pointer-events-none invisible absolute inset-x-0 bottom-0">
            {card}
          </div>
        </div>
      ) : (
        card
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [idle, workingLabel],
  );

  const parts = (
    <ComposerBump
      side="top"
      draggable
      open={open}
      onOpenChange={(next) => {
        // Opening the chat while the agent works always brings the composer back.
        if (next && idleRef.current) {
          setComposing(true);
          onAdd?.();
        }
        setOpen(next);
      }}
      peek={peek}
      bounds={layerRef}
      boundsInset={gutter}
      minimizable
      minimized={minimized}
      onMinimizedChange={setMinimized}
      onProgressChange={setBump}
      data-slot="floating-chat-bump"
      className={cn(
        'ck-floating-chat__bump',
        glass
          ? 'border-[color:rgba(var(--ck-sheet-line),.14)] bg-[color:rgba(var(--ck-sheet-surface),calc(.5_+_.4_*_var(--bump-progress,0)))] [box-shadow:inset_0_1px_0_rgba(255,255,255,.12)]'
          : 'border-[color:rgba(var(--ck-sheet-line),.1)] bg-[color:var(--bl-card,#fff)]',
      )}
    >
      <ComposerBumpContent label={label}>
        {shared ? <div ref={shared.chatDock} data-slot="floating-chat-transcript" className="flex h-full min-h-0 min-w-0 flex-col" /> : slots.chat}
      </ComposerBumpContent>
      <ComposerBumpHandle label={open ? 'Collapse chat' : 'Expand chat'} className="pt-px" />
    </ComposerBump>
  );

  // Report the outlet every render (the bump's props follow this chat's state).
  useLayoutEffect(() => {
    shared?.outlet.set({ parts, renderCard, className: 'ck-floating-chat__composer' });
  });
  useLayoutEffect(() => () => shared?.outlet.set(null), [shared]);

  const driving = bump.dragging || bump.settling;
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
        data-open={open || undefined}
        data-expanded={expanded || undefined}
        data-dragging={bump.dragging || undefined}
        data-minimized={minimized || undefined}
        data-hidden={hidden || undefined}
        // ck-floating-chat keys the tone token maps (and the glass overrides for the composer) in styles.css.
        className={cn(
          'ck-floating-chat pointer-events-none absolute inset-0 z-40 text-[color:var(--bl-label,#f5f5f7)] [font-family:var(--bl-font,-apple-system,BlinkMacSystemFont,"SF_Pro_Text",sans-serif)] [--ck-sheet-line:255,255,255] [--ck-sheet-surface:18,18,22]',
          className,
        )}
        style={{ '--ck-chat-gutter': `${gutter}px`, '--ck-chat-fold': fold, ...style } as CSSProperties}
      >
        {/* Dims the host as far as the transcript has grown. Mounted only while the chat is open or growing, so a
            closed chat leaves nothing over the host (the iOS haptics polyfill forwards taps by position). */}
        {open || bump.progress > 0 ? (
        <button
          type="button"
          aria-label="Close"
          aria-hidden={!open}
          tabIndex={open ? 0 : -1}
          data-slot="floating-chat-scrim"
          className={cn(
            'absolute inset-0 z-0 block border-0 bg-[#000] p-0 motion-reduce:[transition:none]',
            open ? 'pointer-events-auto' : 'pointer-events-none',
          )}
          // The bump's spring writes progress every frame; only other changes transition.
          style={{ opacity: 0.16 * bump.progress, transition: driving ? 'none' : springCss('opacity', 'smooth') }}
          onClick={() => setOpen(false)}
        />
        ) : null}
        <div
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
          {shared ? (
            <div ref={shared.composerDock} data-slot="floating-chat-composer" className="min-w-0" />
          ) : (
            <ComposerOutlet parts={parts} renderCard={renderCard} className="ck-floating-chat__composer">
              {slots.composer}
            </ComposerOutlet>
          )}
        </div>
        {/* The same FAB a Composer folds into, placed and glazed for the floating layer. */}
        <ComposerFab
          data-slot="floating-chat-fab"
          aria-label="Open chat"
          className={cn(
            'absolute border-[color:rgba(var(--ck-sheet-line),.14)] text-[color:var(--bl-label,#f5f5f7)]',
            glass ? 'bg-[color:rgba(var(--ck-sheet-surface),.62)]' : 'bg-[color:var(--bl-card,#fff)]',
            fabPlacement[fabPosition],
            minimized ? 'pointer-events-auto' : 'pointer-events-none',
          )}
          style={{
            opacity: fold,
            // Grows out of the folding dock.
            scale: 0.6 + 0.4 * fold,
            transition: driving ? 'none' : springCss(['opacity', 'scale'], 'snappy'),
            ...(glass ? { backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' } : null),
          }}
          onPress={() => {
            Haptics.selection();
            setOpen(false);
            setMinimized(false);
          }}
        >
          <ChatIcon d={chatIconPaths.spark} size={22} />
        </ComposerFab>
      </div>
    </FloatingChatContext.Provider>
  );
}

FloatingChat.Chat = defineSlot('chat');
FloatingChat.Composer = defineSlot('composer');
FloatingChat.Context = FloatingChatContext;
FloatingChat.useFloatingChat = useFloatingChat;
