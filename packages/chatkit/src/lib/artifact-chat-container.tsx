import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
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
  const dockRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(1200);
  const [dockHeight, setDockHeight] = useState(96);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultChatOpen);
  const [composing, setComposing] = useState(!working);
  const chromeHidden = useChromeHidden();
  const compact = width < breakpoint;
  const chatOpen = controlledChatOpen ?? uncontrolledOpen;

  const setChatOpen = (open: boolean) => {
    if (controlledChatOpen == null) setUncontrolledOpen(open);
    onChatOpenChange?.(open);
  };

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const measure = () => setWidth(root.offsetWidth);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const dock = dockRef.current;
    if (!dock || !compact) return;
    const measure = () => setDockHeight(dock.offsetHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(dock);
    return () => observer.disconnect();
  }, [compact, composing, working]);

  useEffect(() => {
    setComposing(!working);
  }, [working]);

  const slots: Record<string, ReactNode> = {};
  Children.forEach(children, (child) => {
    if (!isValidElement(child) || typeof child.type !== 'function') return;
    const name = (child.type as unknown as SlotComponent).__artifactChatSlot;
    if (name) slots[name] = (child.props as { children?: ReactNode }).children;
  });

  const drag = useRef({ active: false, y: 0 });
  const onHandleDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    drag.current = { active: true, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onHandleUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!drag.current.active) return;
    drag.current.active = false;
    const delta = event.clientY - drag.current.y;
    if (delta < -18) setChatOpen(true);
    else if (delta > 18) setChatOpen(false);
  };
  const toggleChat = () => {
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
  const hideDock = compact && hideOnScroll && chromeHidden && !chatOpen;

  return (
    <ArtifactChatContainerContext.Provider value={value}>
      <div
        ref={rootRef}
        data-slot="artifact-chat-container"
        data-layout={compact ? 'compact' : 'split'}
        className={cn('ck-artifact-chat', className)}
        style={{
          '--ck-artifact-chat-width': typeof chatWidth === 'number' ? `${chatWidth}px` : chatWidth,
          '--ck-artifact-dock-height': `${dockHeight}px`,
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
            <section
              aria-label="Full chat"
              aria-hidden={!chatOpen}
              className="ck-artifact-chat__sheet"
              data-open={chatOpen || undefined}
            >
              <div className="ck-artifact-chat__transcript">{slots.chat}</div>
            </section>
            <div
              ref={dockRef}
              className="ck-artifact-chat__dock"
              data-hidden={hideDock || undefined}
              data-working={working && !composing ? true : undefined}
            >
              <button
                type="button"
                className="ck-artifact-chat__handle"
                data-open={chatOpen || undefined}
                aria-label={chatOpen ? 'Collapse full chat' : 'Open full chat'}
                aria-expanded={chatOpen}
                onClick={toggleChat}
                onPointerDown={onHandleDown}
                onPointerUp={onHandleUp}
                onPointerCancel={() => { drag.current.active = false; }}
              >
                <span />
              </button>
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
