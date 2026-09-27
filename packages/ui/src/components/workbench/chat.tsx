import * as React from 'react';
import { useState } from 'react';
import { AnimatePresence, animate, motion } from 'framer-motion';
import { Button } from '../../lib/workbench/press';
import { cn } from '../../lib/workbench/util';
import { vib, tick } from '../../lib/workbench/haptics';
import { WIcon, type WIconName } from '../../lib/workbench/icons';
import { prefersReducedMotion, springs } from '../../lib/workbench/motion';
import { MarkdownView } from './markdown';
import { MessageScroller, type MessageScrollerItem } from './message-scroller';

/* ══ Conversation parts — an agent thread ══
   <Conversation empty={!thread}>
     <ConversationEmpty><ConversationGreeting title="What are we building?"/></ConversationEmpty>
     <ConversationMessages threadKey={thread.id} streaming>
       <UserMessage key="u1">…</UserMessage>
       <AssistantMessage key="a1"><WorkLog summary="Worked for 42s">…</WorkLog><MessageMarkdown markdown="…"/></AssistantMessage>
     </ConversationMessages>
     <ConversationComposer><SettledBanner/><WorkbenchComposer/></ConversationComposer>
     <ConversationSuggestions><Suggestion/>…</ConversationSuggestions>
   </Conversation>

   Empty, the greeting sits above a centred composer with suggestions under it. The first message turns it
   into the thread *around the same composer*: the greeting leaves, the composer flies down to its dock
   (draft and focus intact), and the first turn rises in. Keep the children in this order. */

type Div = { className?: string; style?: React.CSSProperties; children?: React.ReactNode };

const ConversationContext = React.createContext<{ empty: boolean }>({ empty: false });

export interface ConversationProps extends Div {
  /** no thread yet: show the empty state */
  empty?: boolean;
}
export function Conversation({ empty = false, className, style, children }: ConversationProps) {
  return (
    <ConversationContext.Provider value={{ empty }}>
      <div
        data-slot="conversation"
        data-empty={empty || undefined}
        className={cn('relative flex min-h-0 flex-1 flex-col', empty && 'wb-scroll overflow-y-auto px-5 py-7', className)}
        style={style}
      >
        {children}
      </div>
    </ConversationContext.Provider>
  );
}

/** Content above the composer while the conversation is empty; leaves upward when the thread starts. */
export function ConversationEmpty({ className, children }: Div) {
  const { empty } = React.useContext(ConversationContext);
  return (
    <div data-slot="conversation-empty" className={cn('relative flex min-h-0 flex-col justify-end', empty ? 'flex-1' : 'flex-none')}>
      <AnimatePresence mode="popLayout" initial={false}>
        {empty ? (
          <motion.div
            key="empty"
            className={cn('mx-auto w-full max-w-[620px]', className)}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -24, scale: 0.97, filter: 'blur(4px)' }}
            transition={springs.smooth}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export interface ConversationGreetingProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** replaces the tinted spark tile */
  icon?: React.ReactNode;
  className?: string;
}
export function ConversationGreeting({ title, description, icon, className }: ConversationGreetingProps) {
  return (
    <div data-slot="conversation-greeting" className={cn('mb-[18px] text-center', className)}>
      {icon ?? (
        <span className="inline-grid size-10 place-items-center rounded-[11px] bg-[linear-gradient(135deg,var(--wb-tint),#5E5CE6)]">
          <WIcon name="spark" size={21} sw={2.1} className="text-white" />
        </span>
      )}
      <div className="mt-3 text-[21px] font-bold tracking-[-.3px]">{title}</div>
      {description != null ? <div className="mt-1 text-[13.5px] text-wb-label2">{description}</div> : null}
    </div>
  );
}

export interface ConversationMessagesProps {
  /** identifies the thread; switching it re-opens the scroller at the last anchor */
  threadKey?: string | null;
  streaming?: boolean;
  /** px of the previous turn left peeking above a new anchor */
  peek?: number;
  /** keyed messages; `UserMessage`s anchor the scroll */
  children?: React.ReactNode;
}
/** The thread's messages in a MessageScroller: new turns anchor near the top, replies grow below. */
export function ConversationMessages({ threadKey, streaming, peek, children }: ConversationMessagesProps) {
  const { empty } = React.useContext(ConversationContext);
  const items: MessageScrollerItem[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const props = child.props as { anchor?: boolean };
    items.push({ id: String(child.key), anchor: props.anchor ?? child.type === UserMessage, node: child });
  });
  return (
    <div data-slot="conversation-messages" className={cn('relative flex min-h-0 flex-col', empty ? 'flex-none' : 'flex-1')}>
      <AnimatePresence mode="popLayout" initial={false}>
        {!empty ? (
          <motion.div key="thread" className="flex min-h-0 flex-1 flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
            <MessageScroller items={items} streaming={streaming} threadKey={threadKey} peek={peek} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Docks the composer: centred while empty, at the bottom of the thread after. The same element in both
    states, so it FLIPs from one place to the other. */
export function ConversationComposer({ className, style, children }: Div) {
  const { empty } = React.useContext(ConversationContext);
  const dock = React.useRef<HTMLDivElement>(null);
  const before = React.useRef<DOMRect | null>(null);
  const last = React.useRef(empty);
  if (last.current !== empty && !before.current && dock.current) before.current = dock.current.getBoundingClientRect();
  React.useLayoutEffect(() => {
    last.current = empty;
    const from = before.current;
    before.current = null;
    const el = dock.current;
    if (!from || !el || prefersReducedMotion()) return;
    const to = el.getBoundingClientRect();
    animate(
      el,
      { x: [from.left - to.left, 0], y: [from.top - to.top, 0], width: [from.width, to.width] },
      { ...springs.smooth, onComplete: () => ((el.style.width = ''), (el.style.transform = '')) },
    );
  }, [empty]);
  return (
    <div
      ref={dock}
      data-slot="conversation-composer"
      className={cn('mx-auto box-border w-full shrink-0', empty ? 'max-w-[620px]' : 'max-w-[780px] px-[22px] pt-2 pb-3.5', className)}
      style={style}
    >
      {children}
    </div>
  );
}

/** Suggestion chips under the empty composer. */
export function ConversationSuggestions({ className, children }: Div) {
  const { empty } = React.useContext(ConversationContext);
  return (
    <div data-slot="conversation-suggestions" className={cn('relative min-h-0', empty ? 'flex-1' : 'flex-none')}>
      <AnimatePresence mode="popLayout" initial={false}>
        {empty ? (
          <motion.div
            key="suggestions"
            className={cn('mx-auto mt-3.5 flex w-full max-w-[620px] flex-wrap justify-center gap-[7px]', className)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={springs.snappy}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
export function Suggestion({ onPress, className, children }: { onPress?: () => void; className?: string; children?: React.ReactNode }) {
  return (
    <Button
      data-slot="suggestion"
      className={cn('wb-btn wb-hl cursor-pointer rounded-[99px] border border-wb-sep bg-transparent px-[13px] py-1.5 text-[12.5px] text-wb-label2', className)}
      onPress={() => {
        vib([8]);
        onPress?.();
      }}
    >
      {children}
    </Button>
  );
}

/* ── Messages ── */
export interface UserMessageProps {
  /** image attachments, shown above the bubble */
  images?: string[];
  /** anchors the scroller (default true) */
  anchor?: boolean;
  className?: string;
  children?: React.ReactNode;
}
export function UserMessage({ images, className, children }: UserMessageProps) {
  return (
    <div data-slot="user-message" className={cn('my-2.5 flex justify-end', className)}>
      <div className="grid max-w-[78%] justify-items-end gap-1.5">
        {images && images.length ? (
          <div className="flex flex-wrap justify-end gap-1.5">
            {images.map((s, j) => (
              <img key={j} src={s} alt="attachment" className="h-[110px] max-w-[210px] rounded-xl border border-wb-sep object-cover" />
            ))}
          </div>
        ) : null}
        {children != null && children !== '' ? (
          <div className="rounded-[14px_14px_4px_14px] bg-wb-fill2 px-[13px] py-[9px] text-[14px] leading-[1.5] whitespace-pre-wrap">{children}</div>
        ) : null}
      </div>
    </div>
  );
}

export function AssistantMessage({ className, children }: { anchor?: boolean; className?: string; children?: React.ReactNode }) {
  return (
    <div data-slot="assistant-message" className={cn('mt-1 mb-3.5', className)}>
      {children}
    </div>
  );
}

/* The three typing dots: a soft wave, staggered by .18s. */
const DOT_ANIM = ['animate-[wbPulse_1s_0s_infinite]', 'animate-[wbPulse_1s_0.18s_infinite]', 'animate-[wbPulse_1s_0.36s_infinite]'];
export function TypingIndicator({ className }: { className?: string }) {
  return (
    <div data-slot="typing-indicator" role="status" aria-label="Thinking" className={cn('flex gap-[5px] py-1.5', className)}>
      {DOT_ANIM.map((anim, j) => (
        <span key={j} className={cn('size-1.5 rounded-[50%] bg-wb-label3 motion-reduce:animate-none', anim)} />
      ))}
    </div>
  );
}

/** The reply body: streaming markdown, and the typing dots until the first token. */
export function MessageMarkdown({ markdown = '', streaming }: { markdown?: string; streaming?: boolean }) {
  return (
    <>
      <MarkdownView markdown={markdown} streaming={streaming} />
      {streaming && !markdown ? <TypingIndicator /> : null}
    </>
  );
}

/* ── Work log ── */
export interface WorkLogProps {
  /** the collapsed row, e.g. "Worked for 1m 4s" */
  summary: React.ReactNode;
  defaultOpen?: boolean;
  /** ToolCall rows; with none the row is static */
  children?: React.ReactNode;
  className?: string;
}
/** "Worked for Ns" — expands (on a spring) into the tool calls behind the reply. */
export function WorkLog({ summary, defaultOpen = false, children, className }: WorkLogProps) {
  const [open, setOpen] = useState(defaultOpen);
  const has = React.Children.count(children) > 0;
  const row = 'flex items-center gap-[5px] text-[12px] text-wb-label3';
  const chevron = (
    <motion.span className="grid" animate={{ rotate: open ? 90 : 0 }} transition={springs.snappy}>
      <WIcon name="chevR" size={11} sw={2.4} />
    </motion.span>
  );
  return (
    <div data-slot="work-log" data-open={open || undefined} className={cn('mt-0.5 mb-1.5', className)}>
      {has ? (
        <Button
          aria-expanded={open}
          className={cn(row, 'wb-btn cursor-pointer border-0 bg-transparent p-0 leading-[inherit]')}
          onPress={() => {
            tick();
            setOpen(!open);
          }}
        >
          <WIcon name="clock" size={12.5} sw={2} />
          {summary}
          {chevron}
        </Button>
      ) : (
        <div className={row}>
          <WIcon name="clock" size={12.5} sw={2} />
          {summary}
          <WIcon name="chevR" size={11} sw={2.4} />
        </div>
      )}
      <AnimatePresence initial={false}>
        {open && has ? (
          <motion.div
            key="calls"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springs.smooth}
            className="overflow-hidden"
          >
            <div className="mt-1.5 mb-1 ml-[5px] grid gap-1.5 border-l border-wb-sep pl-3">{children}</div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export interface ToolCallProps {
  icon?: WIconName;
  /** what the agent did */
  title: React.ReactNode;
  /** secondary text: a URL, a path, a count */
  detail?: React.ReactNode;
  /** a command or snippet, shown in a mono well */
  code?: string;
  status?: 'done' | 'running' | 'error';
  className?: string;
}
/** One step in a WorkLog. */
export function ToolCall({ icon = 'check', title, detail, code, status = 'done', className }: ToolCallProps) {
  return (
    <div data-slot="tool-call" data-status={status} className={cn('grid gap-1 text-[12.5px] text-wb-label2', className)}>
      <div className="flex min-w-0 items-center gap-2">
        {status === 'running' ? (
          <span className="grid size-[13px] shrink-0 place-items-center">
            <span className="size-[7px] animate-[wbPulse_1.2s_infinite] rounded-full bg-wb-tint motion-reduce:animate-none" />
          </span>
        ) : (
          <WIcon name={status === 'error' ? 'x' : icon} size={13} sw={2} className={status === 'error' ? 'text-wb-red' : 'text-wb-label3'} />
        )}
        <span className="min-w-0 truncate">{title}</span>
        {detail != null ? <span className="min-w-0 truncate text-[11.5px] text-wb-label3">{detail}</span> : null}
      </div>
      {code ? <pre className="wb-scroll m-0 overflow-x-auto rounded-lg bg-wb-well px-2.5 py-2 font-mono text-[11.5px] leading-[1.55] text-wb-label2">{code}</pre> : null}
    </div>
  );
}

/* ── Settled ── */
export interface SettledBannerProps {
  onUnsettle: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}
/** Above the composer of a settled thread; sending (or Un-settle) moves it back to Active. */
export function SettledBanner({
  onUnsettle,
  title = 'This thread is settled',
  description = 'Sending a message moves it back to Active in the sidebar.',
  className,
  style,
}: SettledBannerProps) {
  return (
    <div
      data-slot="settled-banner"
      className={cn('mb-2.5 flex items-center gap-[11px] rounded-xl border border-wb-sep bg-wb-card px-3 py-2.5', className)}
      style={style}
    >
      <WIcon name="checkC" size={20} sw={1.8} className="text-wb-green" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-[650]">{title}</div>
        <div className="mt-px text-[12px] text-wb-label2">{description}</div>
      </div>
      <Button
        className="wb-btn wb-hl shrink-0 cursor-pointer rounded-lg border border-wb-sep bg-transparent px-3 py-1.5 text-[12.5px] font-semibold text-wb-label"
        onPress={() => {
          tick();
          onUnsettle();
        }}
      >
        Un-settle
      </Button>
    </div>
  );
}
