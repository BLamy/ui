import { useLayoutEffect, useRef, useState } from 'react';
import { Input, TextField } from 'react-aria-components';
import { Button } from '@/components/ui/button';
import { HoverCard, HoverCardTrigger } from '@/components/ui/hover-card';
import { SplitViewHeader, SplitViewSupplementary, useSplitView } from '@/components/ui/split-view';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import type { ChatItem, Doc } from '../lib/data';
import type { CodexState } from '../lib/use-codex';
import { outlineOf } from './doc-outline';
import { DotOrb } from './dot-orb';

type Message = Extract<ChatItem, { kind: 'message' }>;

/** The first paragraph of a document's Markdown (callouts, headings, lists and tables skipped), as plain text. */
const leadOf = (markdown: string) =>
  markdown
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .find((p) => p && !/^(>|#|[-*+] |\d+\. |\||```|\{%)/.test(p))
    ?.replace(/[*_`[\]]|\(([^)]*)\)/g, '') ?? '';

/** A document link's hover card: a strip of its cover, emoji and title, its opening paragraph and its sections —
    what the document is about before you open it beside the chat. */
function DocCard({ doc }: { doc: Doc }) {
  const sections = outlineOf(doc.body).filter((o) => o.level === 2);
  return (
    <div className="-m-4">
      <div className="h-12 rounded-t-[14px] bg-(image:--doc-cover)" style={{ '--doc-cover': doc.cover } as React.CSSProperties} />
      <div className="px-4 pt-2.5 pb-4">
        <div className="flex items-center gap-2">
          <span className="text-[18px] leading-none" aria-hidden="true">{doc.emoji}</span>
          <span className="min-w-0 truncate font-serif text-headline font-bold">{doc.title}</span>
        </div>
        <p className="mt-2 mb-0 line-clamp-3 text-footnote leading-[1.45] text-muted-foreground">{leadOf(doc.body)}</p>
        {sections.length > 0 && (
          <ul className="mt-3 mb-0 list-none space-y-1 border-t border-border p-0 pt-2.5 text-footnote">
            {sections.slice(0, 5).map((o) => (
              <li key={o.text} className="flex items-center gap-2 truncate">
                <span className="h-px w-2.5 shrink-0 bg-tertiary-foreground" aria-hidden="true" />
                {o.text}
              </li>
            ))}
            {sections.length > 5 && <li className="pl-[18px] text-tertiary-foreground">{sections.length - 5} more sections</li>}
          </ul>
        )}
      </div>
    </div>
  );
}

/** A document dot made, as a link chip with its cover under it. Opens the document beside the chat; resting on the
    chip previews it (DocCard). */
function DocLink({ codex, id }: { codex: CodexState; id: string }) {
  const s = useSplitView();
  const doc = codex.doc(id);
  if (!doc) return null;
  const open = () => {
    codex.workspace.open(id);
    s.show('detail');
  };
  return (
    <div className="mt-2 flex flex-col items-start gap-2">
      <HoverCardTrigger>
        <Button variant="secondary" onPress={open} className="h-auto rounded-full px-3.5 py-1.5 text-detail font-normal underline decoration-muted-foreground underline-offset-2">
          {doc.title}
        </Button>
        <HoverCard placement="top start"><DocCard doc={doc} /></HoverCard>
      </HoverCardTrigger>
      <Button
        aria-label={`Open ${doc.title}`}
        onPress={open}
        className="relative aspect-[1.75] h-auto w-[252px] max-w-full flex-col items-start justify-end gap-0 overflow-hidden rounded-2xl bg-(image:--doc-cover) p-3.5 text-left text-white shadow-[inset_0_0_0_1px_--alpha(white/10%)]"
        // the document's own cover
        style={{ '--doc-cover': doc.cover } as React.CSSProperties}
      >
        <span className="text-[22px] leading-none" aria-hidden="true">
          {doc.emoji}
        </span>
        <span className="mt-1.5 font-serif text-title leading-[1.05] font-bold whitespace-normal drop-shadow-[0_1px_2px_--alpha(black/45%)]">{doc.title}</span>
      </Button>
    </div>
  );
}

export function Typing() {
  return (
    <span className="flex h-5 items-center gap-1" role="status" aria-label="dot is typing">
      {[0, 150, 300].map((d) => (
        <span key={d} className="size-1.5 animate-pulse rounded-full bg-muted-foreground" style={{ animationDelay: `${d}ms` }} />
      ))}
    </span>
  );
}

function Bubble({ codex, m }: { codex: CodexState; m: Message }) {
  const mine = m.role === 'user';
  return (
    <div className={cn('flex flex-col', mine ? 'items-end' : 'items-start')}>
      <div className={cn('max-w-[86%] rounded-sheet px-3.5 py-2 text-[14.5px] leading-[1.4]', mine ? 'bg-primary text-primary-foreground' : 'bg-secondary text-foreground')}>
        {m.text || !m.live ? m.text : <Typing />}
        {m.list && (
          <ul className="mt-1.5 list-disc space-y-1 pl-5">
            {m.list.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
      </div>
      {m.doc && <DocLink codex={codex} id={m.doc} />}
      {m.read && <div className="mt-1 mr-1 text-caption2 text-muted-foreground">{m.read}</div>}
    </div>
  );
}

/** Text field with attach, dictate and send. */
function Composer({ onSend, disabled }: { onSend: (text: string) => void; disabled: boolean }) {
  const [text, setText] = useState('');
  const send = () => {
    if (!text.trim() || disabled) return;
    onSend(text);
    setText('');
  };
  return (
    <div className="shrink-0 px-3 pt-2 pb-3">
      <div className="flex h-11 items-center gap-1 rounded-full bg-secondary pr-1.5 pl-1 shadow-hairline">
        <Button
          variant="quiet"
          size="icon-sm"
          aria-label="Attach"
          title="Attach"
          className="size-8 rounded-full"
        >
          <Icon name="plus" size={18} sw={1.7} />
        </Button>
        <TextField aria-label="Message" value={text} onChange={setText} className="min-w-0 flex-1">
          <Input
            placeholder="Send a message"
            onKeyDown={(e) => e.key === 'Enter' && send()}
            className="box-border w-full min-w-0 border-0 bg-transparent px-1.5 text-[14.5px] text-foreground [font-family:inherit] outline-none placeholder:text-tertiary-foreground"
          />
        </TextField>
        <Button
          variant="quiet"
          size="icon-sm"
          aria-label="Dictate"
          title="Dictate"
          className="size-8 rounded-full"
        >
          <Icon name="mic" size={17} sw={1.7} />
        </Button>
        <Button aria-label="Send" size="icon" isDisabled={!text.trim() || disabled} onPress={send} className="size-8 bg-primary text-primary-foreground data-disabled:opacity-60">
          <Icon name="arrow-up" size={16} sw={2.4} />
        </Button>
      </div>
    </div>
  );
}

/** The current chat: its transcript over a composer. Each chat opens scrolled to its latest message. */
export function ChatPane({ codex }: { codex: CodexState }) {
  const { current, streaming } = codex;
  const s = useSplitView();
  const scroller = useRef<HTMLDivElement>(null);
  // Follow the newest message (and the reply as it streams) while already at the bottom.
  const last = current.items[current.items.length - 1];
  const tail = last?.kind === 'message' ? last.text.length : 0;
  const stick = useRef(true);
  const chatId = useRef(current.id);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (chatId.current !== current.id) {
      chatId.current = current.id;
      stick.current = true;
    }
    if (stick.current) el.scrollTop = el.scrollHeight;
  }, [current.id, current.items.length, tail]);

  return (
    <SplitViewSupplementary aria-label="Chat" width={390} minWidth={320} maxWidth={520}>
      <SplitViewHeader
        title={current.title}
        leading={
          s.collapsed ? undefined : (
            <span className="flex items-center gap-2 pl-2 text-detail font-semibold">
              <DotOrb size={22} />
              dot
            </span>
          )
        }
        trailing={<Button variant="quiet" size="icon-sm" aria-label="Call dot" title="Call dot"><Icon name="phone" size={18} sw={1.7} /></Button>}
      />
      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
        }}
        className="bl-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
      >
        <div className="flex min-h-full flex-col justify-end gap-2 px-4 py-3">
          {current.items.length === 0 && (
            <div className="grid flex-1 place-items-center py-16 text-center">
              <div>
                <DotOrb size={56} className="mx-auto" />
                <div className="mt-3 text-subhead font-semibold">Start a chat with dot</div>
                <div className="mt-1 text-footnote text-muted-foreground">Ask anything — what dot writes up lands beside it.</div>
              </div>
            </div>
          )}
          {current.items.map((i) =>
            i.kind === 'time' ? (
              <div key={i.id} className="my-2 text-center text-caption text-muted-foreground">
                {i.label}
              </div>
            ) : (
              <Bubble key={i.id} codex={codex} m={i} />
            ),
          )}
        </div>
      </div>
      <Composer onSend={codex.send} disabled={streaming} />
    </SplitViewSupplementary>
  );
}
