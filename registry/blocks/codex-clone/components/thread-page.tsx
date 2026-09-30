import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { TextArea, TextField } from 'react-aria-components';
import {
  Button,
  Icon,
  IconButton,
  IndexBar,
  SplitViewHeader,
  cn,
  useSplitView,
} from '@brett_lamy/ui';
import type { Chat, ChatItem } from '../lib/data';
import type { CodexState } from '../lib/use-codex';
import { Typing } from './chat-pane';

type Message = Extract<ChatItem, { kind: 'message' }>;

/** A project thread's messages: yours in a soft bubble at the right, dot's as plain text with its work log and commands. */
function Turn({ m }: { m: Message }) {
  if (m.role === 'user') {
    return (
      <div data-turn={m.id} className="flex flex-col items-end pt-3">
        <div className="max-w-[80%] rounded-2xl bg-secondary px-4 py-2.5 text-[14.5px] leading-[1.5] whitespace-pre-wrap">
          {m.text}
        </div>
        {m.read && (
          <div className="mt-1 mr-1 text-[11px] text-muted-foreground">
            {m.read}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3 text-[14.5px] leading-[1.6]">
      {m.worked && (
        <div className="flex items-center gap-1 border-b border-border pb-2 text-[13px] text-muted-foreground">
          {m.worked}
          <Icon name="chevron-right" size={12} sw={2.4} />
        </div>
      )}
      {m.text ? (
        m.text.split('\n\n').map((p, i) => <p key={i}>{p}</p>)
      ) : m.live ? (
        <Typing />
      ) : null}
      {m.code && (
        <div className="rounded-2xl bg-secondary px-4 py-3">
          <div className="mb-2 flex items-center gap-2 text-[13px] text-muted-foreground">
            <span aria-hidden="true" className="font-mono">
              &lt;/&gt;
            </span>
            Bash
          </div>
          <code className="block font-mono text-[12.5px] break-all text-foreground">
            {m.code}
          </code>
        </div>
      )}
    </div>
  );
}

/** The thread's turns as an IndexBar rail: a dash per message of yours, a card with the message and the start of the reply. */
function TurnRail({
  items,
  active,
  onJump,
}: {
  items: ChatItem[];
  active?: string;
  onJump: (id: string) => void;
}) {
  const turns = items.flatMap((m, i) => {
    if (m.kind !== 'message' || m.role !== 'user') return [];
    const reply = items
      .slice(i + 1)
      .find((n) => n.kind === 'message' && n.role === 'dot');
    return [
      {
        key: m.id,
        caption: m.text,
        preview: reply?.kind === 'message' ? reply.text : undefined,
        trailing: (
          <Icon
            name="bookmark"
            size={14}
            className="mt-0.5 shrink-0 text-muted-foreground"
          />
        ),
      },
    ];
  });
  if (turns.length < 2) return null;
  return (
    // The wrapper (no display of its own) is what the container query hides.
    <div className="@max-[899px]:hidden">
      <IndexBar
        variant="wave"
        side="left"
        label="Jump to message"
        items={turns}
        value={active}
        previewLines={3}
        previewWidth={360}
        onJump={(id) => onJump(String(id))}
        className="top-1/2 left-1 -translate-y-1/2"
      />
    </div>
  );
}

/** "Do anything": a roomy field over its controls. */
function ThreadComposer({
  onSend,
  disabled,
}: {
  onSend: (text: string) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState('');
  const send = () => {
    if (!text.trim() || disabled) return;
    onSend(text);
    setText('');
  };
  return (
    <div className="shrink-0 px-6 pt-2 pb-5">
      <div className="mx-auto w-full max-w-[820px] rounded-2xl bg-secondary px-4 pt-3 pb-2.5 shadow-[inset_0_0_0_1px_var(--border)]">
        <TextField aria-label="Message" value={text} onChange={setText}>
          <TextArea
            rows={1}
            placeholder="Do anything"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            className="box-border block min-h-7 w-full resize-none border-0 bg-transparent p-0 text-[14.5px] text-foreground [font-family:inherit] outline-none placeholder:text-tertiary-foreground"
          />
        </TextField>
        <div className="mt-2 flex items-center gap-1">
          <IconButton
            name="plus"
            label="Attach"
            size={18}
            className="size-8 rounded-full"
          />
          <Button
            variant="ghost"
            className="h-8 gap-1.5 rounded-full px-2 text-[13px] font-normal text-muted-foreground data-hovered:bg-accent"
          >
            <Icon name="shield" size={14} />
            Approve for me
          </Button>
          <span className="flex-1" />
          <Button
            variant="ghost"
            className="h-8 gap-1 rounded-full px-2 text-[13px] font-normal text-muted-foreground data-hovered:bg-accent"
          >
            <Icon name="bolt-fill" size={12} />
            <span className="text-foreground">GPT-6 Luna</span> Medium
            <Icon name="chevron-down" size={11} sw={2.4} />
          </Button>
          <IconButton
            name="mic"
            label="Dictate"
            size={17}
            className="size-8 rounded-full"
          />
          <Button
            aria-label="Send"
            size="icon"
            isDisabled={!text.trim() || disabled}
            onPress={send}
            className="size-8 bg-foreground text-background data-disabled:opacity-60"
          >
            <Icon name="arrow-up" size={16} sw={2.4} />
          </Button>
        </div>
      </div>
    </div>
  );
}

/** The thread's side panel: its project, the lines it changed, and what it read. */
function ThreadPanel({ chat }: { chat: Chat }) {
  return (
    <aside
      data-slot="thread-panel"
      aria-label="Thread details"
      className="w-[340px] shrink-0 p-3 @max-[899px]:hidden"
    >
      <div className="rounded-2xl bg-secondary/60 px-4 py-3 shadow-[inset_0_0_0_1px_var(--border)]">
        <div className="flex items-center justify-between text-[14px] text-muted-foreground">
          {chat.project}
          <IconButton name="ellipsis" label="Project actions" size={16} />
        </div>
        {chat.changes && (
          <div className="mt-1 flex items-center gap-2.5 py-1.5 text-[14px]">
            <Icon name="doc" size={16} className="text-muted-foreground" />
            <span className="flex-1">Changes</span>
            <span className="tabular-nums text-success">
              +{chat.changes.added.toLocaleString()}
            </span>
            <span className="tabular-nums text-destructive">
              −{chat.changes.removed.toLocaleString()}
            </span>
          </div>
        )}
        {chat.sources && (
          <>
            <div className="mt-3 flex items-center justify-between text-[14px] text-muted-foreground">
              Sources
              <IconButton name="plus" label="Add source" size={16} />
            </div>
            {chat.sources.map((src) => (
              <div
                key={src.label}
                className={cn(
                  'flex items-center gap-2.5 py-1.5 text-[14px]',
                  src.dim && 'text-tertiary-foreground',
                )}
              >
                <Icon
                  name={src.icon}
                  size={16}
                  className="shrink-0 text-muted-foreground"
                />
                <span className="min-w-0 truncate">{src.label}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </aside>
  );
}

/** A project thread: a wide transcript with a turn rail in its margin, the composer under it, and the thread's panel at the right. */
export function ThreadContent({ codex }: { codex: CodexState }) {
  const { current: chat, streaming } = codex;
  const s = useSplitView();
  const [panel, setPanel] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);
  const [turn, setTurn] = useState<string>();

  // Stick to the newest message while already at the bottom; a thread opens at its end.
  const last = chat.items[chat.items.length - 1];
  const tail = last?.kind === 'message' ? last.text.length : 0;
  const stick = useRef(true);
  const threadId = useRef(chat.id);
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    if (threadId.current !== chat.id) {
      threadId.current = chat.id;
      stick.current = true;
    }
    if (stick.current) el.scrollTop = el.scrollHeight;
  }, [chat.id, chat.items.length, tail]);

  // The turn in view: the last of your messages that has scrolled to within 140px of the top.
  const measure = () => {
    const el = scroller.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + 140;
    const seen = [...el.querySelectorAll<HTMLElement>('[data-turn]')].filter(
      (t) => t.getBoundingClientRect().top <= top,
    );
    setTurn(
      seen[seen.length - 1]?.dataset.turn ??
        el.querySelector<HTMLElement>('[data-turn]')?.dataset.turn,
    );
  };
  useEffect(measure, [chat.id, chat.items.length]);

  const jump = (id: string) => {
    const el = scroller.current;
    const t = el?.querySelector<HTMLElement>(`[data-turn="${id}"]`);
    if (el && t)
      el.scrollTo({
        top:
          el.scrollTop +
          t.getBoundingClientRect().top -
          el.getBoundingClientRect().top -
          24,
        behavior: 'smooth',
      });
  };

  return (
    <>
      <SplitViewHeader
        title={s.collapsed ? chat.title : undefined}
        leading={
          <span className="flex min-w-0 items-center gap-2.5 pl-2.5 text-[14px] font-medium">
            <Icon
              name="folder"
              size={16}
              className="shrink-0 text-muted-foreground"
            />
            <span className="truncate">{chat.title}</span>
          </span>
        }
        trailing={
          <>
            <IconButton name="ellipsis" label="Thread actions" size={17} />
            <IconButton
              name="sidebar-right"
              label="Toggle thread panel"
              size={17}
              active={panel}
              onPress={() => setPanel((p) => !p)}
            />
          </>
        }
      />
      <div className="@container relative flex min-h-0 flex-1">
        <div className="relative flex min-w-0 flex-1 flex-col">
          <div
            ref={scroller}
            onScroll={(e) => {
              const el = e.currentTarget;
              stick.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 48;
              measure();
            }}
            className="bl-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto"
          >
            <div className="mx-auto flex min-h-full w-full max-w-[820px] flex-col justify-end gap-5 px-6 py-6">
              {chat.items.length === 0 && (
                <div className="grid flex-1 place-items-center py-24 text-[14px] text-muted-foreground">
                  Nothing here yet — ask for anything.
                </div>
              )}
              {chat.items.map((i) =>
                i.kind === 'time' ? (
                  <div
                    key={i.id}
                    className="text-center text-[12px] text-muted-foreground"
                  >
                    {i.label}
                  </div>
                ) : (
                  <Turn key={i.id} m={i} />
                ),
              )}
            </div>
          </div>
          <TurnRail
            key={chat.id}
            items={chat.items}
            active={turn}
            onJump={jump}
          />
          <ThreadComposer onSend={codex.send} disabled={streaming} />
        </div>
        {panel && !s.collapsed && <ThreadPanel chat={chat} />}
      </div>
    </>
  );
}
