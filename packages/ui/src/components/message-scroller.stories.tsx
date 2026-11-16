import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import { ConversationAssistantMessage, ConversationUserMessage } from '@/components/ui/conversation';
import { MessageScroller, MessageScrollerItem } from '@/components/ui/message-scroller';
import { AppearanceProvider, ThemeScope, type Appearance } from '@/lib/theme';

/* A transcript in a sized panel: the scroller fills what it is given, so the frame is `w-full max-w-…` and a
   phone-sized canvas shows the narrow layout. */
function Frame({ appearance = 'light', height = 380, children, footer }: { appearance?: Appearance; height?: number; children: ReactNode; footer?: ReactNode }) {
  return (
    <AppearanceProvider value={appearance}>
      <ThemeScope className="grid min-h-dvh place-items-center bg-background p-4 font-sans text-foreground">
        <div className="flex w-full max-w-[460px] flex-col overflow-hidden rounded-card border border-border bg-background" style={{ height }}>
          {children}
          {footer ? <div className="shrink-0 border-t border-border p-2.5">{footer}</div> : null}
        </div>
      </ThemeScope>
    </AppearanceProvider>
  );
}

const meta: Meta<typeof MessageScroller> = {
  title: 'Organisms/MessageScroller',
  component: MessageScroller,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof MessageScroller>;

interface Msg {
  id: string;
  user: boolean;
  text: string;
}
const message = (m: Msg) =>
  m.user ? (
    <ConversationUserMessage key={m.id} value={m.id}>
      {m.text}
    </ConversationUserMessage>
  ) : (
    <ConversationAssistantMessage key={m.id} value={m.id} className="text-detail leading-[1.55]">
      {m.text}
    </ConversationAssistantMessage>
  );

const long = (n: number, what = 'an earlier reply') => Array.from({ length: n }, (_, i) => `Line ${i + 1} of ${what} that gives the thread real scroll height.`).join(' ');
const THREAD: Msg[] = [
  { id: 'u1', user: true, text: 'First turn — scrolled far off-screen above.' },
  { id: 'a1', user: false, text: long(14) },
  { id: 'u2', user: true, text: 'Second turn — also above the fold.' },
  { id: 'a2', user: false, text: long(14) },
  { id: 'u3', user: true, text: 'Last turn — the thread opens anchored here.' },
  { id: 'a3', user: false, text: long(40, 'the latest reply') },
];

function Turns({ appearance }: { appearance?: Appearance }) {
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: 'u1', user: true, text: 'How does anchoring work?' },
    { id: 'a1', user: false, text: 'Each new turn scrolls near the top with a peek of the previous one — the reply streams into the room below without moving your view.' },
  ]);
  const n = useRef(1);
  const add = () => {
    const i = ++n.current;
    setMsgs((m) => [...m, { id: `u${i}`, user: true, text: `Turn ${i} — watch me anchor to the top.` }]);
    setTimeout(() => setMsgs((m) => [...m, { id: `a${i}`, user: false, text: 'Replies grow into the room below the anchor. Scroll up and following stops; the pill jumps back to the live edge.' }]), 380);
  };
  return (
    <Frame appearance={appearance} footer={<Button className="w-full" onClick={add}>Send a turn</Button>}>
      <MessageScroller threadKey="live">{msgs.map(message)}</MessageScroller>
    </Frame>
  );
}

/** Send a turn: it anchors near the top, the reply rises in under it. */
export const Default: Story = { render: () => <Turns /> };

export const Dark: Story = { render: () => <Turns appearance="dark" /> };

/** A phone-sized column: set `--message-gutter` (and `--message-column-width`) to fit the host. */
export const Narrow: Story = {
  parameters: { viewport: { defaultViewport: 'mobile1' } },
  render: () => (
    <Frame height={520}>
      <MessageScroller threadKey="narrow" aria-label="Thread" style={{ '--message-gutter': '12px' } as CSSProperties}>
        {THREAD.map(message)}
      </MessageScroller>
    </Frame>
  ),
};

function StreamingDemo({ appearance }: { appearance?: Appearance }) {
  const words = 'Following the live edge is conditional. The scroller sticks to the bottom only while you are there. Any upward intent — wheel, touch, ArrowUp, PageUp or Home — releases it, and the view stays put while the reply keeps growing below. While released and streaming, the pill reads Streaming; pressing it scrolls to the end and follows again.'.split(' ');
  const [shown, setShown] = useState(0);
  const [run, setRun] = useState(0);
  useEffect(() => {
    setShown(0);
    const id = setInterval(() => setShown((n) => Math.min(words.length, n + 2)), 120);
    return () => clearInterval(id);
  }, [run]);
  const streaming = shown < words.length;
  return (
    <Frame appearance={appearance} footer={<Button variant="secondary" className="w-full" onClick={() => setRun((r) => r + 1)}>{streaming ? 'Streaming… scroll up to release' : 'Replay stream'}</Button>}>
      <MessageScroller threadKey={`stream-${run}`} streaming={streaming}>
        {message({ id: 'u1', user: true, text: 'Stream me a long explanation of the release rules.' })}
        {message({ id: 'a1', user: false, text: words.slice(0, shown).join(' ') })}
      </MessageScroller>
    </Frame>
  );
}

/** A reply streams; scroll up and the pill says "Streaming" until you jump back. */
export const Streaming: Story = { render: () => <StreamingDemo /> };

/** A thread opens anchored at its last user turn (the previous reply peeking above). Its reply runs well past the
    fold, so the jump pill shows. */
export const OpensAtLastAnchor: Story = {
  render: () => (
    <Frame>
      <MessageScroller threadKey="anchored">{THREAD.map(message)}</MessageScroller>
    </Frame>
  ),
};

/** The jump pill's streaming look on first paint: the thread opens at its last turn, away from the live edge of a
    reply that is still arriving, so the pill widens to "● Streaming ⌄". The previous reply fades under the top edge. */
export const JumpPillStreaming: Story = {
  render: () => (
    <Frame>
      <MessageScroller threadKey="anchored-streaming" streaming>{THREAD.map(message)}</MessageScroller>
    </Frame>
  ),
};

export const JumpPillStreamingDark: Story = {
  render: () => (
    <Frame appearance="dark">
      <MessageScroller threadKey="anchored-streaming-dark" streaming>{THREAD.map(message)}</MessageScroller>
    </Frame>
  ),
};

/** Any block can be an item: here plain notes, one of them an anchor. */
export const PlainItems: Story = {
  render: () => (
    <Frame height={300}>
      <MessageScroller threadKey="plain" aria-label="Activity">
        {['Build started', 'Tests passed', 'Deploy queued', 'Deployed to production'].map((t, i) => (
          <MessageScrollerItem key={t} value={`e${i}`} anchor={i === 2} className="py-2 text-footnote text-muted-foreground">
            {t}
          </MessageScrollerItem>
        ))}
      </MessageScroller>
    </Frame>
  ),
};
