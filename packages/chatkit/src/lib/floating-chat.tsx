import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { Haptics } from '@touchkit/ui';
import { ChatIcon, chatIconPaths } from './chat-icon';
import { cn } from './cn';
import {
  FloatingSheet,
  useFloatingSheet,
  type FloatingSheetAppearance,
  type FloatingSheetFabPosition,
  type FloatingSheetTone,
} from './floating-sheet';

export type FloatingChatFabPosition = FloatingSheetFabPosition;

export interface FloatingChatContextValue {
  /** Whether the full transcript is revealed. */
  open: boolean;
  setOpen: (open: boolean) => void;
  /** 0 when only the composer floats, 1 when the glass has grown into the full-page chat. */
  progress: number;
  /** Whether the real composer is showing rather than the tappable working status. */
  composing: boolean;
  setComposing: (composing: boolean) => void;
  /** Whether the surface has been folded into its FAB. */
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

interface SlotComponent {
  (props: { children?: ReactNode }): null;
  __floatingChatSlot: string;
}

function slot(name: string): SlotComponent {
  const Slot = (() => null) as unknown as SlotComponent;
  Slot.__floatingChatSlot = name;
  return Slot;
}

export interface FloatingChatProps {
  /** Controlled state for the revealed full chat. */
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Collapses the composer into a tappable working status. */
  working?: boolean;
  workingLabel?: ReactNode;
  /** Called when the working status is tapped before the composer is revealed. */
  onAdd?: () => void;
  /** Controlled composer visibility while `working`; defaults to hiding the composer whenever work starts. */
  composing?: boolean;
  onComposingChange?: (composing: boolean) => void;
  /** Follow NavigationStack/List scroll chrome, like TabBar. */
  hideOnScroll?: boolean;
  /** A scroller whose direction also hides and restores the floating surface. */
  scrollRef?: RefObject<HTMLElement | null>;
  /** Resting position after the chat is dragged down into its FAB. */
  fabPosition?: FloatingChatFabPosition;
  /** Inset of the collapsed floating composer from the host edges. */
  gutter?: number;
  /**
   * Height of transcript kept visible above the composer while the chat is closed, so the
   * newest reply peeks out of the glass (maps, dashboards). `0` shows the composer alone.
   */
  peek?: number;
  /** Glass over the host, or an opaque card. */
  appearance?: FloatingSheetAppearance;
  /** Colour scheme of the surface; `auto` inherits the host's tokens. */
  tone?: FloatingSheetTone;
  /** Accessible name for the revealed transcript region. */
  label?: string;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/**
 * The floating glass chat surface: a FloatingSheet whose body is the transcript and whose
 * foot is the composer. It fills its positioned host (`position: relative` or any other
 * containing block) as a pointer-transparent layer, so it can float over a map, an artifact,
 * a NavigationStack screen, or anything else. Drag the cap upward to grow the composer into
 * the full-page chat, drag it down past the closed position to fold everything into a FAB.
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
  gutter = 20,
  peek = 0,
  appearance = 'glass',
  tone = 'auto',
  label = 'Full chat',
  children,
  className,
  style,
}: FloatingChatProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const [uncontrolledComposing, setUncontrolledComposing] = useState(!working);
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

  const slots: Record<string, ReactNode> = {};
  Children.forEach(children, (child) => {
    if (!isValidElement(child) || typeof child.type !== 'function') return;
    const name = (child.type as unknown as SlotComponent).__floatingChatSlot;
    if (name) slots[name] = (child.props as { children?: ReactNode }).children;
  });

  const idle = working && !composing;

  const revealComposer = () => {
    Haptics.selection();
    setComposing(true);
    onAdd?.();
  };

  return (
    <FloatingSheet
      open={open}
      onOpenChange={(next) => {
        // Opening the chat while the agent works always brings the composer back.
        if (next && idle) {
          setComposing(true);
          onAdd?.();
        }
        setOpen(next);
      }}
      peek={peek}
      gutter={gutter}
      appearance={appearance}
      tone={tone}
      bodyAlign="end"
      fabPosition={fabPosition}
      fabIcon={<ChatIcon d={chatIconPaths.spark} size={22} />}
      hideOnScroll={hideOnScroll}
      scrollRef={scrollRef}
      label={label}
      className={cn('ck-floating-chat', className)}
      style={style}
    >
      <FloatingSheet.Body>
        <ChatContext composing={composing} setComposing={setComposing}>
          {slots.chat}
        </ChatContext>
      </FloatingSheet.Body>
      <FloatingSheet.Foot>
        <ChatContext composing={composing} setComposing={setComposing}>
          {idle ? (
            <button type="button" className="ck-floating-chat__working" onClick={revealComposer}>
              <span className="ck-floating-chat__working-icon" aria-hidden="true">
                <ChatIcon d={chatIconPaths.spark} size={18} />
              </span>
              <span className="ck-floating-chat__working-label">{workingLabel}</span>
              <ChatIcon d={chatIconPaths.plus} size={20} />
              <span className="ck-sr-only">Add something new</span>
            </button>
          ) : null}
          <div
            className="ck-floating-chat__composer"
            data-inactive={idle || undefined}
            aria-hidden={idle}
            inert={idle}
          >
            {slots.composer}
          </div>
        </ChatContext>
      </FloatingSheet.Foot>
    </FloatingSheet>
  );
}

/** Joins the sheet's geometry with the chat's composing state for `useFloatingChat`. */
function ChatContext({
  composing,
  setComposing,
  children,
}: {
  composing: boolean;
  setComposing: (composing: boolean) => void;
  children?: ReactNode;
}) {
  const sheet = useFloatingSheet();
  const value: FloatingChatContextValue = {
    open: sheet.open,
    setOpen: sheet.setOpen,
    progress: sheet.progress,
    composing,
    setComposing,
    minimized: sheet.minimized,
    setMinimized: sheet.setMinimized,
  };
  return <FloatingChatContext.Provider value={value}>{children}</FloatingChatContext.Provider>;
}

FloatingChat.Chat = slot('chat');
FloatingChat.Composer = slot('composer');
FloatingChat.Context = FloatingChatContext;
FloatingChat.useFloatingChat = useFloatingChat;
