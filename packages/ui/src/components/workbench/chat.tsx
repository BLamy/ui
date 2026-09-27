import * as React from 'react';
import { Button } from '../../lib/workbench/press';
import { cn } from '../../lib/workbench/util';
import { vib, tick } from '../../lib/workbench/haptics';
import { WIcon } from '../../lib/workbench/icons';
import { AnimatePresence, animate, motion } from 'framer-motion';
import { prefersReducedMotion, springs } from '../../lib/workbench/motion';
import { MarkdownView } from './markdown';
import { MessageScroller, type MessageScrollerItem } from './message-scroller';
import { WorkbenchComposer, stripAttachmentRefs } from './workbench-composer';
import type { ComposerAttachment } from './composer';
import type { WorkbenchThread, WorkbenchTrace } from './thread-sidebar';

/* ══ Chat ══ */
export interface SettledBannerProps {
  onUnsettle: () => void;
  className?: string;
  style?: React.CSSProperties;
}
export function SettledBanner({ onUnsettle, className, style }: SettledBannerProps) {
  return (
    <div
      data-slot="settled-banner"
      className={cn('mb-2.5 flex items-center gap-[11px] rounded-xl border border-wb-sep bg-wb-card px-3 py-2.5', className)}
      style={style}
    >
      <WIcon name="checkC" size={20} sw={1.8} className="text-wb-green" />
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-[650]">This thread is settled</div>
        <div className="mt-px text-[12px] text-wb-label2">Sending a message moves it back to Active in the sidebar.</div>
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

/** Adapts Composer's onSubmit(markdown, attachments) to the demo's onSend(text, imageSrcs). */
const toSend = (onSend: (text: string, imgs?: string[]) => void) => (markdown: string, attachments: ComposerAttachment[]) =>
  onSend(stripAttachmentRefs(markdown), attachments.flatMap((a) => (a.src ? [a.src] : [])));

const SUGGESTIONS = ['Get the demo servers running', 'Explain the haptics engine', 'Diff my last change'];

/** The empty thread's greeting (above the composer). */
function EmptyThreadHero() {
  return (
    <div data-slot="empty-thread-hero" className="mb-[18px] text-center">
      <span className="inline-grid size-10 place-items-center rounded-[11px] bg-[linear-gradient(135deg,var(--wb-tint),#5E5CE6)]">
        <WIcon name="spark" size={21} sw={2.1} className="text-white" />
      </span>
      <div className="mt-3 text-[21px] font-bold tracking-[-.3px]">What are we building?</div>
      <div className="mt-1 text-[13.5px] text-wb-label2">Start a thread — ask anything about this workspace.</div>
    </div>
  );
}

/** The empty thread's suggestion chips (below the composer). */
function EmptyThreadSuggestions({ onSend }: { onSend: (text: string) => void }) {
  return (
    <div data-slot="empty-thread-suggestions" className="mt-3.5 flex flex-wrap justify-center gap-[7px]">
      {SUGGESTIONS.map((s) => (
        <Button
          key={s}
          className="wb-btn wb-hl cursor-pointer rounded-[99px] border border-wb-sep bg-transparent px-[13px] py-1.5 text-[12.5px] text-wb-label2"
          onPress={() => {
            vib([8]);
            onSend(s);
          }}
        >
          {s}
        </Button>
      ))}
    </div>
  );
}

export interface EmptyThreadProps {
  onSend: (text: string, imgs?: string[]) => void;
  streaming?: boolean;
  onStop?: () => void;
  /** Replaces the default WorkbenchComposer. */
  composer?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}
export function EmptyThread({ onSend, streaming, onStop, composer, className, style }: EmptyThreadProps) {
  return (
    <div
      data-slot="empty-thread"
      className={cn('wb-scroll flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-5 py-7', className)}
      style={style}
    >
      <div className="w-full max-w-[620px]">
        <EmptyThreadHero />
        {composer ?? <WorkbenchComposer onSubmit={toSend(onSend)} streaming={streaming} onStop={onStop} autoFocus />}
        <EmptyThreadSuggestions onSend={onSend} />
      </div>
    </div>
  );
}

/* WorkTrace — the "Worked for Ns" row. The compact row renders by default, and a rich expandable trace
   can be passed as children — it renders in the prototype's expanded wrapper. */
export interface WorkTraceProps {
  meta: string;
  trace?: WorkbenchTrace;
  /** expanded trace UI (e.g. a Thinking accordion); when provided it replaces the compact row */
  children?: React.ReactNode;
  className?: string;
}
export function WorkTrace({ meta, children, className }: WorkTraceProps) {
  if (children)
    return (
      <div data-slot="work-trace" className={cn('mt-0.5 mb-2.5', className)}>
        {children}
      </div>
    );
  return (
    <div data-slot="work-trace" className={cn('mt-0.5 mb-1.5 flex items-center gap-[5px] text-[12px] text-wb-label3', className)}>
      <WIcon name="clock" size={12.5} sw={2} />
      {meta}
      <WIcon name="chevR" size={11} sw={2.4} />
    </div>
  );
}

/* The three typing dots: a soft wave, staggered by .18s. */
const DOT_ANIM = ['animate-[wbPulse_1s_0s_infinite]', 'animate-[wbPulse_1s_0.18s_infinite]', 'animate-[wbPulse_1s_0.36s_infinite]'];

export interface ChatViewProps {
  thread?: WorkbenchThread | null;
  streaming?: boolean;
  onSend: (text: string, imgs?: string[]) => void;
  onStop?: () => void;
  onUnsettle?: () => void;
  header?: React.ReactNode;
  /** Replaces the default WorkbenchComposer (compose your own from the Composer parts). */
  composer?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A thread: messages in a MessageScroller over the composer. With no thread it is the empty state — a greeting,
 * the composer centred, suggestions under it — and sending the first message turns it into the thread *around
 * the same composer*: the greeting leaves, the composer travels down to its dock, the first messages rise in.
 */
export function ChatView({ thread, streaming, onSend, onStop, onUnsettle, header, composer, className, style }: ChatViewProps) {
  const empty = !thread;
  const dock = React.useRef<HTMLDivElement>(null);
  // The composer is one element in both states; FLIP it from where it was when the state flips.
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

  const items: MessageScrollerItem[] = [];
  thread?.msgs.forEach((m) => {
    if (m.role === 'user')
      items.push({
        id: m.id,
        anchor: true,
        node: (
          <div className="my-2.5 flex justify-end">
            <div className="grid max-w-[78%] justify-items-end gap-1.5">
              {m.imgs && m.imgs.length ? (
                <div className="flex flex-wrap justify-end gap-1.5">
                  {m.imgs.map((s, j) => (
                    <img key={j} src={s} alt="attachment" className="h-[110px] max-w-[210px] rounded-xl border border-wb-sep object-cover" />
                  ))}
                </div>
              ) : null}
              {m.md ? (
                <div className="rounded-[14px_14px_4px_14px] bg-wb-fill2 px-[13px] py-[9px] text-[14px] leading-[1.5] whitespace-pre-wrap">{m.md}</div>
              ) : null}
            </div>
          </div>
        ),
      });
    else
      items.push({
        id: m.id,
        node: (
          <div className="mt-1 mb-3.5">
            {m.meta ? <WorkTrace meta={m.meta} trace={m.trace} /> : null}
            <MarkdownView markdown={m.md} streaming={m.live} />
            {m.live && !m.md ? (
              <div className="flex gap-[5px] py-1.5">
                {DOT_ANIM.map((anim, j) => (
                  <span key={j} className={cn('size-1.5 rounded-[50%] bg-wb-label3 motion-reduce:animate-none', anim)} />
                ))}
              </div>
            ) : null}
          </div>
        ),
      });
  });
  const composerNode = composer ?? (
    <WorkbenchComposer onSubmit={toSend(onSend)} streaming={empty ? false : streaming} onStop={onStop} autoFocus={empty} />
  );
  return (
    <div data-slot="chat-view" data-empty={empty || undefined} className={cn('flex min-h-0 flex-1 flex-col', className)} style={style}>
      {header}
      {/* Keyed children keep the composer dock the same element whether the thread is empty or not. */}
      <div className={cn('relative flex min-h-0 flex-1 flex-col', empty && 'wb-scroll overflow-y-auto px-5 py-7')}>
        <div key="top" className={cn('relative flex min-h-0 flex-1 flex-col', empty && 'justify-end')}>
          <AnimatePresence mode="popLayout" initial={false}>
            {empty ? (
              <motion.div
                key="hero"
                className="mx-auto w-full max-w-[620px]"
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -24, scale: 0.97, filter: 'blur(4px)' }}
                transition={springs.smooth}
              >
                <EmptyThreadHero />
              </motion.div>
            ) : (
              <motion.div
                key="thread"
                className="flex min-h-0 flex-1 flex-col"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                <MessageScroller items={items} streaming={streaming} threadKey={thread.id} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div
          key="dock"
          ref={dock}
          data-slot="chat-view-composer"
          className={cn('mx-auto box-border w-full shrink-0', empty ? 'max-w-[620px]' : 'max-w-[780px] px-[22px] pt-2 pb-3.5')}
        >
          {!empty && thread.settled && onUnsettle ? <SettledBanner onUnsettle={onUnsettle} /> : null}
          {composerNode}
        </div>
        <div key="bottom" className={cn('relative min-h-0', empty ? 'flex-1' : 'flex-none')}>
          <AnimatePresence mode="popLayout" initial={false}>
            {empty ? (
              <motion.div
                key="suggestions"
                className="mx-auto w-full max-w-[620px]"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 12 }}
                transition={springs.snappy}
              >
                <EmptyThreadSuggestions onSend={onSend} />
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
