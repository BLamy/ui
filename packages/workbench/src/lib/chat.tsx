import * as React from 'react';
import { Button } from './press';
import { cn } from './util';
import { vib, tick } from './haptics';
import { WIcon } from './icons';
import { MarkdownView } from './markdown';
import { MessageScroller, type MessageScrollerItem } from './message-scroller';
import { Composer } from './composer';
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

export interface EmptyThreadProps {
  onSend: (text: string, imgs?: string[]) => void;
  streaming?: boolean;
  onStop?: () => void;
  className?: string;
  style?: React.CSSProperties;
}
export function EmptyThread({ onSend, streaming, onStop, className, style }: EmptyThreadProps) {
  const sug = ['Get the demo servers running', 'Explain the haptics engine', 'Diff my last change'];
  return (
    <div
      data-slot="empty-thread"
      className={cn('wb-scroll flex min-h-0 flex-1 flex-col items-center justify-center overflow-y-auto px-5 py-7', className)}
      style={style}
    >
      <div className="w-full max-w-[620px]">
        <div className="mb-[18px] text-center">
          <span className="inline-grid size-10 place-items-center rounded-[11px] bg-[linear-gradient(135deg,var(--wb-tint),#5E5CE6)]">
            <WIcon name="spark" size={21} sw={2.1} className="text-white" />
          </span>
          <div className="mt-3 text-[21px] font-bold tracking-[-.3px]">What are we building?</div>
          <div className="mt-1 text-[13.5px] text-wb-label2">Start a thread — ask anything about this workspace.</div>
        </div>
        <Composer onSend={onSend} streaming={streaming} onStop={onStop} autoFocus wide />
        <div className="mt-3.5 flex flex-wrap justify-center gap-[7px]">
          {sug.map((s) => (
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

/* The three typing dots, staggered by .18s. */
const DOT_ANIM = ['animate-[wbPulse_1s_0s_infinite]', 'animate-[wbPulse_1s_0.18s_infinite]', 'animate-[wbPulse_1s_0.36s_infinite]'];

export interface ChatViewProps {
  thread?: WorkbenchThread | null;
  streaming?: boolean;
  onSend: (text: string, imgs?: string[]) => void;
  onStop?: () => void;
  onUnsettle?: () => void;
  header?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}
export function ChatView({ thread, streaming, onSend, onStop, onUnsettle, header, className, style }: ChatViewProps) {
  if (!thread)
    return (
      <div data-slot="chat-view" className={cn('flex min-h-0 flex-1 flex-col', className)} style={style}>
        {header}
        <EmptyThread onSend={onSend} streaming={false} />
      </div>
    );
  const items: MessageScrollerItem[] = [];
  thread.msgs.forEach((m) => {
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
                  <span key={j} className={cn('size-1.5 rounded-[50%] bg-wb-label3', anim)} />
                ))}
              </div>
            ) : null}
          </div>
        ),
      });
  });
  return (
    <div data-slot="chat-view" className={cn('flex min-h-0 flex-1 flex-col', className)} style={style}>
      {header}
      <MessageScroller items={items} streaming={streaming} threadKey={thread.id} />
      <div className="mx-auto box-border w-full max-w-[780px] shrink-0 px-[22px] pt-2 pb-3.5">
        {thread.settled && onUnsettle ? <SettledBanner onUnsettle={onUnsettle} /> : null}
        <Composer onSend={onSend} streaming={streaming} onStop={onStop} />
      </div>
    </div>
  );
}
