import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { Haptics, useChromeHidden } from '@touchkit/ui';
import { ChatIcon, chatIconPaths } from './chat-icon';
import { cn } from './cn';

export interface ArtifactChatContainerContextValue {
  width: number;
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

interface SlotComponent {
  (props: { children?: ArtifactChatContainerSlotChildren }): null;
  __artifactChatSlot: string;
}

function slot(name: string): SlotComponent {
  const Slot = (() => null) as unknown as SlotComponent;
  Slot.__artifactChatSlot = name;
  return Slot;
}

/** Height of the grabber cap row at the top of the floating overlay. */
const CAP_HEIGHT = 26;
/** Horizontal and bottom inset of the collapsed floating composer. */
const FLOATING_GUTTER = 20;
/** The overlay's top and bottom borders are outside its flex children. */
const OVERLAY_BORDER_HEIGHT = 2;
/** Pointer travel below which a cap drag counts as a tap. */
const TAP_SLOP = 4;

export interface ArtifactChatContainerProps {
  /** Switches from the side-by-side layout to the floating composer at this container width. */
  breakpoint?: number;
  /** Width of the docked chat column. */
  chatWidth?: number | string;
  /** Controlled state for the compact full-chat drawer. */
  chatOpen?: boolean;
  defaultChatOpen?: boolean;
  onChatOpenChange?: (open: boolean) => void;
  /** Collapses the compact composer into a tappable working status. */
  working?: boolean;
  workingLabel?: ReactNode;
  /** Called when the working status is tapped before the composer is revealed. */
  onAdd?: () => void;
  /** Follow NavigationStack/List scroll chrome, like TabBar. */
  hideOnScroll?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function ArtifactChatContainer({
  breakpoint = 760,
  chatWidth = 400,
  chatOpen: controlledChatOpen,
  defaultChatOpen = false,
  onChatOpenChange,
  working = false,
  workingLabel = 'Working…',
  onAdd,
  hideOnScroll = true,
  children,
  className,
  style,
}: ArtifactChatContainerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);
  const [height, setHeight] = useState(800);
  const [footHeight, setFootHeight] = useState(74);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultChatOpen);
  const [composing, setComposing] = useState(!working);
  /** Live height of the growing chat surface while the cap is being dragged. */
  const [dragReveal, setDragReveal] = useState<number | null>(null);
  const chromeHidden = useChromeHidden();
  const compact = width < breakpoint;
  const chatOpen = controlledChatOpen ?? uncontrolledOpen;
  const revealId = useId();

  const setChatOpen = (open: boolean) => {
    if (controlledChatOpen == null) setUncontrolledOpen(open);
    onChatOpenChange?.(open);
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => {
      setWidth(root.offsetWidth);
      setHeight(root.offsetHeight);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const foot = footRef.current;
    if (!foot || !compact) return;
    const measure = () => setFootHeight(foot.offsetHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(foot);
    return () => observer.disconnect();
  }, [compact, composing, working]);

  useEffect(() => {
    setComposing(!working);
  }, [working]);

  // The collapsed overlay footprint the artifact scrolls clear of.
  const dockHeight = footHeight + CAP_HEIGHT;
  // At the end of the drag the cap reaches the very top edge and the composer reaches
  // the bottom edge. The compact glass has literally become the full-page chat.
  const maxReveal = Math.max(0, height - dockHeight - OVERLAY_BORDER_HEIGHT);
  const reveal = dragReveal ?? (chatOpen ? maxReveal : 0);
  const dragging = dragReveal != null;
  const expanded = reveal > 0;
  const grown = maxReveal > 0 ? reveal / maxReveal : 0;

  const closeRef = useRef(() => setChatOpen(false));
  closeRef.current = () => setChatOpen(false);
  useEffect(() => {
    if (!compact || !chatOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [compact, chatOpen]);

  const slots: Record<string, ReactNode> = {};
  Children.forEach(children, (child) => {
    if (!isValidElement(child) || typeof child.type !== 'function') return;
    const name = (child.type as unknown as SlotComponent).__artifactChatSlot;
    if (name) slots[name] = (child.props as { children?: ReactNode }).children;
  });

  const drag = useRef({ active: false, y: 0, from: 0, moved: false });

  const onCapDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    drag.current = { active: true, y: event.clientY, from: chatOpen ? maxReveal : 0, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onCapMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag.current.active) return;
    const delta = drag.current.y - event.clientY;
    if (!drag.current.moved && Math.abs(delta) < TAP_SLOP) return;
    drag.current.moved = true;
    // Dragging the cap pulls the chat surface out of it one-to-one with the pointer.
    setDragReveal(Math.max(0, Math.min(maxReveal, drag.current.from + delta)));
  };

  const endDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag.current.active) return;
    const { moved, from } = drag.current;
    drag.current.active = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (!moved) {
      setDragReveal(null);
      return;
    }
    const settled = Math.max(0, Math.min(maxReveal, from + (drag.current.y - event.clientY)));
    const open = settled > maxReveal * 0.35;
    setDragReveal(null);
    if (open !== chatOpen) {
      Haptics.selection();
      setChatOpen(open);
    }
  };

  const cancelDrag = () => {
    drag.current.active = false;
    setDragReveal(null);
  };

  const toggleChat = () => {
    // Pointer drags settle in endDrag; only real taps should toggle.
    if (drag.current.moved) {
      drag.current.moved = false;
      return;
    }
    Haptics.selection();
    setChatOpen(!chatOpen);
  };

  const revealComposer = () => {
    Haptics.selection();
    setComposing(true);
    onAdd?.();
  };

  const value: ArtifactChatContainerContextValue = {
    width,
    compact,
    chatOpen,
    setChatOpen,
    composing,
    setComposing,
  };
  const hideDock = compact && hideOnScroll && chromeHidden && !expanded;

  return (
    <ArtifactChatContainerContext.Provider value={value}>
      <div
        ref={rootRef}
        data-slot="artifact-chat-container"
        data-layout={compact ? 'compact' : 'split'}
        data-dragging={dragging || undefined}
        className={cn('ck-artifact-chat', className)}
        style={{
          '--ck-artifact-chat-width': typeof chatWidth === 'number' ? `${chatWidth}px` : chatWidth,
          '--ck-artifact-dock-height': `${dockHeight}px`,
          '--ck-artifact-reveal': `${reveal}px`,
          '--ck-artifact-inline-gutter': `${FLOATING_GUTTER * (1 - grown)}px`,
          '--ck-artifact-bottom-gutter': `${FLOATING_GUTTER * (1 - grown)}px`,
          '--ck-artifact-radius': `${28 * (1 - grown)}px`,
          // Fades the glass from composer-light to conversation-dark as it grows.
          '--ck-artifact-scrim-opacity': `${0.24 * grown}`,
          '--ck-artifact-border-alpha': `${0.16 + 0.04 * grown}`,
          '--ck-artifact-bg-alpha': `${0.38 + 0.46 * grown}`,
          '--ck-artifact-shadow-y': `${14 + 20 * grown}px`,
          '--ck-artifact-shadow-blur': `${34 + 30 * grown}px`,
          '--ck-artifact-shadow-alpha': `${0.32 + 0.22 * grown}`,
          '--ck-artifact-blur': `${18 + 18 * grown}px`,
          '--ck-artifact-divider-alpha': `${0.09 * grown}`,
          ...style,
        } as CSSProperties}
      >
        {compact ? (
          <>
            <main className="ck-artifact-chat__content">{slots.content}</main>
            <button
              type="button"
              aria-label="Close full chat"
              aria-hidden={!chatOpen}
              tabIndex={chatOpen ? 0 : -1}
              className="ck-artifact-chat__scrim"
              data-open={chatOpen || undefined}
              onClick={() => setChatOpen(false)}
            />
            <div
              className="ck-artifact-chat__overlay"
              data-open={chatOpen || undefined}
              data-expanded={expanded || undefined}
              data-dragging={dragging || undefined}
              data-hidden={hideDock || undefined}
              data-working={working && !composing ? true : undefined}
            >
              <button
                type="button"
                className="ck-artifact-chat__cap"
                data-open={chatOpen || undefined}
                aria-label={chatOpen ? 'Collapse full chat' : 'Open full chat'}
                aria-expanded={chatOpen}
                aria-controls={revealId}
                onClick={toggleChat}
                onPointerDown={onCapDown}
                onPointerMove={onCapMove}
                onPointerUp={endDrag}
                onPointerCancel={cancelDrag}
              >
                <span className="ck-artifact-chat__grip" />
              </button>
              <div
                id={revealId}
                role="region"
                aria-label="Full chat"
                aria-hidden={!expanded}
                inert={!expanded}
                className="ck-artifact-chat__reveal"
              >
                {/* Laid out at its full grown height so the visible window slides up over a
                    stable transcript instead of reflowing on every drag frame. */}
                <div className="ck-artifact-chat__transcript" style={{ height: maxReveal }}>
                  {slots.chat}
                </div>
              </div>
              <div ref={footRef} className="ck-artifact-chat__foot">
                {working && !composing ? (
                  <button type="button" className="ck-artifact-chat__working" onClick={revealComposer}>
                    <span className="ck-artifact-chat__working-icon" aria-hidden="true">
                      <ChatIcon d={chatIconPaths.spark} size={18} />
                    </span>
                    <span className="ck-artifact-chat__working-label">{workingLabel}</span>
                    <ChatIcon d={chatIconPaths.plus} size={20} />
                    <span className="ck-sr-only">Add something new</span>
                  </button>
                ) : (
                  <div className="ck-artifact-chat__composer">{slots.composer}</div>
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            <aside className="ck-artifact-chat__chat">
              <div className="ck-artifact-chat__transcript">{slots.chat}</div>
              <div className="ck-artifact-chat__composer">{slots.composer}</div>
            </aside>
            <main className="ck-artifact-chat__content">{slots.content}</main>
          </>
        )}
      </div>
    </ArtifactChatContainerContext.Provider>
  );
}

ArtifactChatContainer.Chat = slot('chat');
ArtifactChatContainer.Composer = slot('composer');
ArtifactChatContainer.Content = slot('content');
ArtifactChatContainer.Context = ArtifactChatContainerContext;
ArtifactChatContainer.useContainer = useArtifactChatContainer;
