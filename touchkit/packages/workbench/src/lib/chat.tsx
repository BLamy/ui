import * as React from 'react';
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
      className={cn(className)}
      style={{ display: 'flex', alignItems: 'center', gap: 11, border: '1px solid var(--wb-sep)', background: 'var(--wb-card)', borderRadius: 12, padding: '10px 12px', margin: '0 0 10px', ...style }}
    >
      <WIcon name="checkC" size={20} sw={1.8} style={{ color: 'var(--wb-green)' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 650 }}>This thread is settled</div>
        <div style={{ fontSize: 12, color: 'var(--wb-label2)', marginTop: 1 }}>Sending a message moves it back to Active in the sidebar.</div>
      </div>
      <button
        type="button"
        className="wb-btn wb-hl"
        onClick={() => {
          tick();
          onUnsettle();
        }}
        style={{ border: '1px solid var(--wb-sep)', background: 'none', color: 'var(--wb-label)', fontSize: 12.5, fontWeight: 600, borderRadius: 8, padding: '6px 12px', cursor: 'pointer', flexShrink: 0 }}
      >
        Un-settle
      </button>
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
      className={cn('wb-scroll', className)}
      style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '28px 20px', ...style }}
    >
      <div style={{ width: '100%', maxWidth: 620 }}>
        <div style={{ textAlign: 'center', marginBottom: 18 }}>
          <span style={{ width: 40, height: 40, borderRadius: 11, background: 'linear-gradient(135deg, var(--wb-tint), #5E5CE6)', display: 'inline-grid', placeItems: 'center' }}>
            <WIcon name="spark" size={21} sw={2.1} style={{ color: '#fff' }} />
          </span>
          <div style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-.3px', marginTop: 12 }}>What are we building?</div>
          <div style={{ fontSize: 13.5, color: 'var(--wb-label2)', marginTop: 4 }}>Start a thread — ask anything about this workspace.</div>
        </div>
        <Composer onSend={onSend} streaming={streaming} onStop={onStop} autoFocus wide />
        <div style={{ display: 'flex', gap: 7, justifyContent: 'center', flexWrap: 'wrap', marginTop: 14 }}>
          {sug.map((s) => (
            <button
              key={s}
              type="button"
              className="wb-btn wb-hl"
              onClick={() => {
                vib([8]);
                onSend(s);
              }}
              style={{ border: '1px solid var(--wb-sep)', background: 'none', color: 'var(--wb-label2)', fontSize: 12.5, borderRadius: 99, padding: '6px 13px', cursor: 'pointer' }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* WorkTrace — the "Worked for Ns" row. The prototype expanded it into Beautiful UI's Thinking trace when
   beautiful.jsx was loaded; here the compact row renders by default, and a rich expandable trace (e.g.
   Beautiful UI's Thinking) can be passed as children — it renders in the prototype's expanded wrapper. */
export interface WorkTraceProps {
  meta: string;
  trace?: WorkbenchTrace;
  /** expanded trace UI (e.g. a Thinking accordion); when provided it replaces the compact row */
  children?: React.ReactNode;
}
export function WorkTrace({ meta, children }: WorkTraceProps) {
  if (children) return <div data-slot="work-trace" style={{ margin: '2px 0 10px' }}>{children}</div>;
  return (
    <div data-slot="work-trace" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--wb-label3)', margin: '2px 0 6px' }}>
      <WIcon name="clock" size={12.5} sw={2} />
      {meta}
      <WIcon name="chevR" size={11} sw={2.4} />
    </div>
  );
}

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
      <div data-slot="chat-view" className={cn(className)} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', ...style }}>
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
          <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '10px 0' }}>
            <div style={{ maxWidth: '78%', display: 'grid', gap: 6, justifyItems: 'end' }}>
              {m.imgs && m.imgs.length ? (
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  {m.imgs.map((s, j) => (
                    <img key={j} src={s} alt="attachment" style={{ height: 110, maxWidth: 210, objectFit: 'cover', borderRadius: 12, border: '1px solid var(--wb-sep)' }} />
                  ))}
                </div>
              ) : null}
              {m.md ? (
                <div style={{ background: 'var(--wb-fill2)', borderRadius: '14px 14px 4px 14px', padding: '9px 13px', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{m.md}</div>
              ) : null}
            </div>
          </div>
        ),
      });
    else
      items.push({
        id: m.id,
        node: (
          <div style={{ margin: '4px 0 14px' }}>
            {m.meta ? <WorkTrace meta={m.meta} trace={m.trace} /> : null}
            <MarkdownView markdown={m.md} streaming={m.live} />
            {m.live && !m.md ? (
              <div style={{ display: 'flex', gap: 5, padding: '6px 0' }}>
                {[0, 1, 2].map((j) => (
                  <span key={j} style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--wb-label3)', animation: 'wbPulse 1s ' + j * 0.18 + 's infinite' }} />
                ))}
              </div>
            ) : null}
          </div>
        ),
      });
  });
  return (
    <div data-slot="chat-view" className={cn(className)} style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', ...style }}>
      {header}
      <MessageScroller items={items} streaming={streaming} threadKey={thread.id} />
      <div style={{ flexShrink: 0, padding: '8px 22px 14px', maxWidth: 780, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
        {thread.settled && onUnsettle ? <SettledBanner onUnsettle={onUnsettle} /> : null}
        <Composer onSend={onSend} streaming={streaming} onStop={onStop} />
      </div>
    </div>
  );
}
