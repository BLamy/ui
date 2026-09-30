import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, animate, motion } from 'framer-motion';
import { collectSlots, defineSlot, useContainerWidth } from '@/lib/container';
import { springs } from '@/lib/motion';
import { useAppearance } from '@/lib/theme';
import { ChatColumn, ChatColumnComposer, ChatColumnTranscript } from '@/components/ui/chat-column';
import { cn } from '@/lib/utils';
import { FloatingChat, glassScopeProps, type FloatingChatFabPosition, type FloatingChatProps } from '@/components/ui/floating-chat';
import { sheetToneProps } from '@/components/ui/floating-sheet';
import { cva } from 'class-variance-authority';
import { ChatHostContext, ComposerPortal, createOutletStore, useAttachHost, usePersistentHost } from '@/lib/persistent-host';

export type ArtifactChatLayout = 'split' | 'floating';

export interface ArtifactChatContainerContextValue {
  width: number;
  /** The resolved presentation: docked chat column or the floating glass chat. */
  layout: ArtifactChatLayout;
  /** True when the floating layout is active. */
  compact: boolean;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  composing: boolean;
  setComposing: (composing: boolean) => void;
}

const ArtifactChatContainerContext = createContext<ArtifactChatContainerContextValue | null>(null);

export function useArtifactChatContainer(): ArtifactChatContainerContextValue {
  const value = useContext(ArtifactChatContainerContext);
  if (!value) {
    throw new Error('useArtifactChatContainer must be used within <ArtifactChatContainer>');
  }
  return value;
}

export type ArtifactChatContainerSlotChildren = ReactNode;

/** ck-artifact-chat__content stays as a hook for hosts that restyle the artifact pane. */
const contentClass = 'ck-artifact-chat__content min-h-0 min-w-0 overflow-auto bg-background';

/** The container: the chat column beside the content (`split`), or the content full-bleed under a floating chat.
    ck-artifact-chat stays as a hook for hosts. */
export const artifactChatContainerVariants = cva(
  'ck-artifact-chat relative isolate h-full w-full min-h-0 min-w-0 overflow-hidden bg-background text-foreground [font-family:var(--bl-font,-apple-system,BlinkMacSystemFont,"SF_Pro_Text",sans-serif)]',
  {
    variants: {
      layout: {
        split: 'grid',
        floating: 'block',
      },
      chatSide: { left: '', right: '' },
    },
    compoundVariants: [
      { layout: 'split', chatSide: 'left', class: 'grid-cols-[minmax(0,var(--ck-artifact-chat-width,400px))_minmax(0,1fr)]' },
      { layout: 'split', chatSide: 'right', class: 'grid-cols-[minmax(0,1fr)_minmax(0,var(--ck-artifact-chat-width,400px))]' },
    ],
    defaultVariants: { layout: 'split', chatSide: 'left' },
  },
);
export type ArtifactChatFabPosition = FloatingChatFabPosition;

export interface ArtifactChatContainerProps {
  /**
   * `auto` docks the chat beside the content above `breakpoint` and floats it below.
   * `floating` always floats the chat over the content (maps, canvases, full-bleed
   * artifacts); `split` always docks it.
   */
  layout?: 'auto' | ArtifactChatLayout;
  /** Switches from the side-by-side layout to the floating composer at this container width. */
  breakpoint?: number;
  /** Width of the docked chat column. */
  chatWidth?: number | string;
  /** Which edge the docked chat column sits on. Default `left`; `right` for an assistant beside an app's page. */
  chatSide?: 'left' | 'right';
  /** Controlled state for the floating full-chat drawer. */
  chatOpen?: boolean;
  defaultChatOpen?: boolean;
  onChatOpenChange?: (open: boolean) => void;
  /** Collapses the floating composer into a tappable working status. */
  working?: boolean;
  workingLabel?: ReactNode;
  /** Called when the working status is tapped before the composer is revealed. */
  onAdd?: () => void;
  /** Follow NavigationStack/List scroll chrome, like TabBar. */
  hideOnScroll?: boolean;
  /** Resting position after the floating chat is dragged down into its FAB. */
  fabPosition?: ArtifactChatFabPosition;
  /** Controlled fold of the floating chat into its FAB (dragging below rest folds it; the FAB unfolds it). */
  minimized?: boolean;
  defaultMinimized?: boolean;
  onMinimizedChange?: (minimized: boolean) => void;
  /** Transcript height that stays visible above the floating composer while the chat is closed. */
  peek?: number;
  /** Floating surface style: glass over the content, or an opaque card. */
  appearance?: FloatingChatProps['appearance'];
  /**
   * Colour scheme of the chat surfaces (docked column, floating glass, embedded Composer).
   * Defaults to the ambient `AppearanceProvider` value, else `auto`: inherit the host's --bl-* tokens.
   */
  tone?: FloatingChatProps['tone'];
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/* Composition: useContainerWidth resolves the layout; split renders ChatColumn beside the content,
   floating renders the content full-bleed under a FloatingChat. */
export function ArtifactChatContainer({
  layout: requestedLayout = 'auto',
  breakpoint = 760,
  chatWidth = 400,
  chatSide = 'left',
  chatOpen: controlledChatOpen,
  defaultChatOpen = false,
  onChatOpenChange,
  working = false,
  workingLabel = 'Working…',
  onAdd,
  hideOnScroll = true,
  fabPosition = 'bottom-center',
  minimized,
  defaultMinimized,
  onMinimizedChange,
  peek = 0,
  appearance,
  tone: toneProp,
  children,
  className,
  style,
}: ArtifactChatContainerProps) {
  const [rootRef, width] = useContainerWidth();
  const ambient = useAppearance();
  const tone: NonNullable<FloatingChatProps['tone']> = toneProp ?? ambient ?? 'auto';
  const toneProps = sheetToneProps(tone);
  const glassScope = glassScopeProps(tone);
  const contentRef = useRef<HTMLElement>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultChatOpen);
  const [composing, setComposing] = useState(!working);
  const layout: ArtifactChatLayout =
    requestedLayout === 'auto' ? (width < breakpoint ? 'floating' : 'split') : requestedLayout;
  const compact = layout === 'floating';
  const right = chatSide === 'right';
  const edge = right ? 1 : -1;
  const chatOpen = controlledChatOpen ?? uncontrolledOpen;

  const setChatOpen = (open: boolean) => {
    if (controlledChatOpen == null) setUncontrolledOpen(open);
    onChatOpenChange?.(open);
  };

  useEffect(() => {
    setComposing(!working);
  }, [working]);

  const slots = collectSlots(children);

  // ── one chat, two layouts ──
  // The composer and the transcript are rendered once and re-attached to the column or the floating sheet
  // (see persistent-host.tsx), so switching layouts keeps the draft, the caret and a streaming reply. The
  // composer then flies from its old place to its new one, and the artifact pane springs to its new edge.
  const composerHost = usePersistentHost('artifact-chat-composer');
  const chatHost = usePersistentHost('artifact-chat-transcript');
  const outlet = useMemo(createOutletStore, []);
  const [composerDock, setComposerDock] = useState<HTMLElement | null>(null);
  const [chatDock, setChatDock] = useState<HTMLElement | null>(null);
  const hostCtx = useMemo(() => ({ outlet, composerDock: setComposerDock, chatDock: setChatDock }), [outlet]);
  useAttachHost(composerHost, composerDock);
  useAttachHost(chatHost, chatDock);

  const contentRef2 = useRef<HTMLElement | null>(null);
  const shift = useRef<{ layout: boolean; composer: DOMRect | null; content: DOMRect | null } | null>(null);
  const lastCompact = useRef(compact);
  // The column slides in only when the layout switches to it, not on first paint.
  const [switched, setSwitched] = useState(false);
  if (lastCompact.current !== compact && !shift.current && typeof window !== 'undefined') {
    const composerEl = composerHost?.querySelector('[data-slot="composer"]');
    shift.current = {
      layout: compact,
      composer: composerEl?.isConnected ? composerEl.getBoundingClientRect() : null,
      content: contentRef2.current?.getBoundingClientRect() ?? null,
    };
  }
  useLayoutEffect(() => {
    if (lastCompact.current !== compact) setSwitched(true);
    lastCompact.current = compact;
    const snap = shift.current;
    // Wait until the new layout's composer dock has been attached.
    if (!snap || snap.layout !== compact || !composerDock?.isConnected || composerHost?.parentNode !== composerDock) return;
    shift.current = null;
    if (typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const composerEl = composerHost?.querySelector<HTMLElement>('[data-slot="composer"]');
    if (snap.composer && composerEl) {
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
    const content = contentRef2.current;
    if (snap.content && content) {
      // The artifact pane's new box is revealed from the old one's edges.
      const to = content.getBoundingClientRect();
      const f = snap.content;
      const inset = `inset(${Math.max(0, f.top - to.top)}px ${Math.max(0, to.right - f.right)}px ${Math.max(0, to.bottom - f.bottom)}px ${Math.max(0, f.left - to.left)}px)`;
      if (inset !== 'inset(0px 0px 0px 0px)') {
        animate(content, { clipPath: [inset, 'inset(0px 0px 0px 0px)'] }, { ...springs.smooth, onComplete: () => (content.style.clipPath = '') });
      }
    }
  }, [compact, composerDock]);

  const value: ArtifactChatContainerContextValue = {
    width,
    layout,
    compact,
    chatOpen,
    setChatOpen,
    composing,
    setComposing,
  };

  return (
    <ArtifactChatContainerContext.Provider value={value}>
      <div
        ref={rootRef}
        data-slot="artifact-chat-container"
        data-layout={compact ? 'compact' : 'split'}
        // light/dark: the bl-theme's `sheet` scope in that appearance; `auto` leaves the host's theme alone.
        data-tone={tone === 'auto' ? undefined : tone}
        data-theme-scope={toneProps['data-theme-scope']}
        data-chat-side={chatSide}
        className={cn(artifactChatContainerVariants({ layout, chatSide }), toneProps.className, className)}
        style={{
          '--ck-artifact-chat-width': typeof chatWidth === 'number' ? `${chatWidth}px` : chatWidth,
          ...style,
        } as CSSProperties}
      >
        {/* The column (split) — its composer and transcript are docks for the shared ones. */}
        <AnimatePresence mode="popLayout" initial={false}>
          {!compact ? (
            <motion.div
              key="column"
              data-slot="artifact-chat-column"
              className={cn('z-2 flex min-h-0 min-w-0', right && 'col-start-2 row-start-1')}
              // It slides in from, and back out toward, its own edge.
              initial={switched ? { x: 32 * edge, opacity: 0 } : false}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 48 * edge, opacity: 0 }}
              transition={springs.smooth}
            >
              <ChatColumn className={cn('flex-1', right && 'border-r-0 border-l')}>
                <ChatColumnTranscript>
                  <div ref={setChatDock} data-slot="artifact-chat-transcript-dock" className="flex h-full min-h-0 min-w-0 flex-col" />
                </ChatColumnTranscript>
                <ChatColumnComposer>
                  {/* The embedded Workbench Composer paints with the bl-theme's `glass` scope. */}
                  <div
                    ref={setComposerDock}
                    data-slot="artifact-chat-composer-dock"
                    data-theme-scope={glassScope['data-theme-scope']}
                    className={cn('min-w-0', glassScope.className)}
                  />
                </ChatColumnComposer>
              </ChatColumn>
            </motion.div>
          ) : null}
        </AnimatePresence>
        {/* The artifact stays mounted across layouts (same position in the tree). */}
        <main
          ref={(el) => {
            contentRef.current = el;
            contentRef2.current = el;
          }}
          data-slot="artifact-chat-content"
          className={cn(contentClass, compact ? 'absolute inset-0 pb-0' : cn('relative', right && 'col-start-1 row-start-1'))}
        >
          {slots.content}
        </main>
        {compact ? (
          <ChatHostContext.Provider value={hostCtx}>
            <FloatingChat
              open={chatOpen}
              onOpenChange={setChatOpen}
              working={working}
              workingLabel={workingLabel}
              onAdd={onAdd}
              composing={composing}
              onComposingChange={setComposing}
              hideOnScroll={hideOnScroll}
              scrollRef={contentRef}
              fabPosition={fabPosition}
              minimized={minimized}
              defaultMinimized={defaultMinimized}
              onMinimizedChange={onMinimizedChange}
              peek={peek}
              appearance={appearance}
              tone={tone}
            />
          </ChatHostContext.Provider>
        ) : null}
        {/* Rendered once; they live in whichever dock the layout provides. */}
        <ComposerPortal store={outlet} host={composerHost}>
          {slots.composer}
        </ComposerPortal>
        {chatHost ? createPortal(slots.chat, chatHost) : null}
      </div>
    </ArtifactChatContainerContext.Provider>
  );
}

ArtifactChatContainer.Chat = defineSlot('chat');
ArtifactChatContainer.Composer = defineSlot('composer');
ArtifactChatContainer.Content = defineSlot('content');
ArtifactChatContainer.Context = ArtifactChatContainerContext;
ArtifactChatContainer.useContainer = useArtifactChatContainer;
