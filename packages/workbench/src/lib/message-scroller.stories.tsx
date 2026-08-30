import { useRef, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { MessageScroller } from './message-scroller';
import { WorkbenchTheme } from './theme';
import '../styles.css';

const meta: Meta<typeof MessageScroller> = {
  title: 'Organisms/MessageScroller',
  component: MessageScroller,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <WorkbenchTheme style={{ minHeight: 480, padding: 24, display: 'grid', placeItems: 'center' }}>
        <Story />
      </WorkbenchTheme>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof MessageScroller>;

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}
const bubble = (m: Msg) =>
  m.role === 'user' ? (
    <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '8px 0' }}>
      <div style={{ maxWidth: '80%', background: 'var(--wb-fill2)', borderRadius: '12px 12px 4px 12px', padding: '8px 12px', fontSize: 13.5 }}>{m.text}</div>
    </div>
  ) : (
    <div style={{ margin: '4px 0 12px', fontSize: 13.5, lineHeight: 1.55 }}>{m.text}</div>
  );

function ScrollerDemo() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { id: 'u1', role: 'user', text: 'How does anchoring work?' },
    {
      id: 'a1',
      role: 'assistant',
      text: 'Each new turn scrolls near the top of the viewport with a peek of the previous one — the reply streams into the room below without moving your view.',
    },
  ]);
  const n = useRef(1);
  const add = () => {
    n.current++;
    const uid = 'u' + n.current,
      aid = 'a' + n.current;
    setMsgs((m) => [...m, { id: uid, role: 'user', text: 'Turn ' + n.current + ' — watch me anchor to the top.' }]);
    setTimeout(
      () =>
        setMsgs((m) => [
          ...m,
          {
            id: aid,
            role: 'assistant',
            text: 'Replies grow into the reserved room below the anchor. Scroll up mid-reply and following stops; the pill at the bottom jumps back to the live edge.',
          },
        ]),
      380
    );
  };
  const items = msgs.map((m) => ({ id: m.id, anchor: m.role === 'user', node: bubble(m) }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 340, width: 420, borderRadius: 12, overflow: 'hidden', background: 'var(--wb-bg)', border: '1px solid var(--wb-sep)' }}>
      <MessageScroller items={items} streaming={false} threadKey="live" />
      <div style={{ padding: 10, borderTop: '1px solid var(--wb-sep)', flexShrink: 0 }}>
        <button
          className="wb-btn"
          onClick={add}
          style={{ width: '100%', border: 0, borderRadius: 9, background: 'var(--wb-tint)', color: '#fff', fontFamily: 'inherit', fontWeight: 600, fontSize: 13, padding: '9px 0', cursor: 'pointer' }}
        >
          Send a turn
        </button>
      </div>
    </div>
  );
}

export const Interactive: Story = {
  render: () => <ScrollerDemo />,
};

/* streaming — the reply grows below the anchor; scroll up to release following and the
   "Streaming" pill appears; pressing it jumps back to the live edge and re-engages. */
function StreamingDemo() {
  const [msgs, setMsgs] = useState<Msg[]>([{ id: 'u1', role: 'user', text: 'Stream me a long explanation of the release rules.' }]);
  const [streaming, setStreaming] = useState(false);
  const t = useRef<ReturnType<typeof setInterval> | null>(null);
  const words =
    ('Following the live edge is conditional. The scroller only sticks to the bottom while you are already there. ' +
      'Any upward intent — wheel, touch move, ArrowUp, PageUp or Home — releases it instantly, and the view stays put while the reply keeps growing below. ' +
      'While released and streaming, the pill at the bottom reads Streaming with a pulsing dot; pressing it scrolls smoothly to the end and re-engages following. ' +
      'Reaching the bottom by hand re-engages it too. This is the exact shadcn message-scroller semantic the workbench chat uses for every turn.').split(' ');
  const start = () => {
    if (t.current) clearInterval(t.current);
    setMsgs([{ id: 'u1', role: 'user', text: 'Stream me a long explanation of the release rules.' }, { id: 'a1', role: 'assistant', text: '' }]);
    setStreaming(true);
    let i = 0;
    t.current = setInterval(() => {
      i += 2;
      if (i >= words.length) {
        if (t.current) clearInterval(t.current);
        setStreaming(false);
        setMsgs((m) => m.map((x) => (x.id === 'a1' ? { ...x, text: words.join(' ') } : x)));
      } else setMsgs((m) => m.map((x) => (x.id === 'a1' ? { ...x, text: words.slice(0, i).join(' ') } : x)));
    }, 120);
  };
  const items = msgs.map((m) => ({ id: m.id, anchor: m.role === 'user', node: bubble(m) }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 340, width: 420, borderRadius: 12, overflow: 'hidden', background: 'var(--wb-bg)', border: '1px solid var(--wb-sep)' }}>
      <MessageScroller items={items} streaming={streaming} threadKey="stream" />
      <div style={{ padding: 10, borderTop: '1px solid var(--wb-sep)', flexShrink: 0 }}>
        <button
          className="wb-btn"
          onClick={start}
          style={{ width: '100%', border: 0, borderRadius: 9, background: 'var(--wb-tint)', color: '#fff', fontFamily: 'inherit', fontWeight: 600, fontSize: 13, padding: '9px 0', cursor: 'pointer' }}
        >
          {streaming ? 'Streaming… scroll up to release' : 'Replay stream'}
        </button>
      </div>
    </div>
  );
}
export const Streaming: Story = { render: () => <StreamingDemo /> };

/* defaultScrollPosition — a thread opens anchored at its LAST user turn (with the previous
   reply peeking above), not at the very bottom; the jump-to-latest chevron is showing. */
function LastAnchorDemo() {
  const long = (n: number) =>
    Array.from({ length: n }, (_, i) => 'Line ' + (i + 1) + ' of an earlier reply that gives the thread real scroll height.').join(' ');
  const msgs: Msg[] = [
    { id: 'u1', role: 'user', text: 'First turn — scrolled far off-screen above.' },
    { id: 'a1', role: 'assistant', text: long(14) },
    { id: 'u2', role: 'user', text: 'Second turn — also above the fold.' },
    { id: 'a2', role: 'assistant', text: long(14) },
    { id: 'u3', role: 'user', text: 'Last turn — the thread opens anchored here.' },
    { id: 'a3', role: 'assistant', text: long(18) },
  ];
  const items = msgs.map((m) => ({ id: m.id, anchor: m.role === 'user', node: bubble(m) }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 380, width: 420, borderRadius: 12, overflow: 'hidden', background: 'var(--wb-bg)', border: '1px solid var(--wb-sep)' }}>
      <MessageScroller items={items} streaming={false} threadKey="anchored" />
    </div>
  );
}
export const OpensAtLastAnchor: Story = { render: () => <LastAnchorDemo /> };
