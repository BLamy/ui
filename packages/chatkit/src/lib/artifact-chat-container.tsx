import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { cn } from './cn';
import { FloatingChat, type FloatingChatFabPosition, type FloatingChatProps } from './floating-chat';

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
export type ArtifactChatFabPosition = FloatingChatFabPosition;

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
  /** Transcript height that stays visible above the floating composer while the chat is closed. */
  peek?: number;
  /** Floating surface style: glass over the content, or an opaque card. */
  appearance?: FloatingChatProps['appearance'];
  /** Colour scheme of the floating surface; `auto` inherits the host's tokens. */
  tone?: FloatingChatProps['tone'];
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function ArtifactChatContainer({
  layout: requestedLayout = 'auto',
  breakpoint = 760,
  chatWidth = 400,
  chatOpen: controlledChatOpen,
  defaultChatOpen = false,
  onChatOpenChange,
  working = false,
  workingLabel = 'Working…',
  onAdd,
  hideOnScroll = true,
  fabPosition = 'bottom-center',
  peek = 0,
  appearance,
  tone,
  children,
  className,
  style,
}: ArtifactChatContainerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(1200);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultChatOpen);
  const [composing, setComposing] = useState(!working);
  const layout: ArtifactChatLayout =
    requestedLayout === 'auto' ? (width < breakpoint ? 'floating' : 'split') : requestedLayout;
  const compact = layout === 'floating';
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
    setComposing(!working);
  }, [working]);

  const slots: Record<string, ReactNode> = {};
  Children.forEach(children, (child) => {
    if (!isValidElement(child) || typeof child.type !== 'function') return;
    const name = (child.type as unknown as SlotComponent).__artifactChatSlot;
    if (name) slots[name] = (child.props as { children?: ReactNode }).children;
  });

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
        className={cn('ck-artifact-chat', className)}
        style={{
          '--ck-artifact-chat-width': typeof chatWidth === 'number' ? `${chatWidth}px` : chatWidth,
          ...style,
        } as CSSProperties}
      >
        {compact ? (
          <>
            <main ref={contentRef} className="ck-artifact-chat__content">{slots.content}</main>
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
              peek={peek}
              appearance={appearance}
              tone={tone}
            >
              <FloatingChat.Chat>{slots.chat}</FloatingChat.Chat>
              <FloatingChat.Composer>{slots.composer}</FloatingChat.Composer>
            </FloatingChat>
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
