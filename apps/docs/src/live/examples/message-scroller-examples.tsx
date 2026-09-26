/* MessageScroller page — a reply streaming in (scroll up and the jump pill rises and says so; tap it and the
   view glides back on a spring), and turns that rise into place as they arrive. Registered in live-core. */
import { useEffect, useRef, useState } from 'react';
import { MarkdownView, MessageScroller, type MessageScrollerItem } from '@brett_lamy/workbench';
import type { LiveSpec } from '../frame';

const ANSWER =
  'The scroller anchors each new turn near the top, then **follows the live edge** only while you are there.\n\n' +
  '- Scroll up mid-reply and following stops.\n- The jump pill rises in and widens to say a reply is streaming.\n- Tap it and the view glides back to the newest line on a spring — interruptible, so a scroll catches it.\n\n' +
  'New turns rise into place rather than appearing, and a thread you open is simply there: nothing replays.\n\n' +
  Array.from({ length: 6 }, (_, i) => `${i + 1}. A line of the streamed answer, long enough to push the live edge below the fold.`).join('\n');

function bubble(text: string) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '8px 0' }}>
      <div style={{ maxWidth: '80%', background: 'var(--wb-fill2)', borderRadius: '12px 12px 4px 12px', padding: '8px 12px', fontSize: 13.5 }}>{text}</div>
    </div>
  );
}

const streamCode = `import { MessageScroller, MarkdownView } from '@brett_lamy/ui'

// While \`streaming\`, the scroller follows the live edge. Scroll up and it lets go; the jump pill rises in
// ("Streaming ↓"), and tapping it springs the view back down.
export default function Streaming({ reply, done }: { reply: string; done: boolean }) {
  const items = [
    { id: 'u1', anchor: true, node: <UserBubble>Explain the scroller</UserBubble> },
    { id: 'a1', node: <MarkdownView markdown={reply} streaming={!done} /> },
  ]
  return <MessageScroller items={items} streaming={!done} threadKey="t1" />
}`;

const turnsCode = `import { MessageScroller } from '@brett_lamy/ui'

// Items that arrive after the thread opened rise into place — the user's turn up from the composer,
// the reply beneath it. The ones the thread opened with are simply there.
export default function Turns({ messages }) {
  const items = messages.map((m) => ({ id: m.id, anchor: m.role === 'user', node: <Row message={m} /> }))
  return <MessageScroller items={items} threadKey="t1" />
}`;

export const MESSAGE_SCROLLER_EXAMPLES: Record<string, LiveSpec> = {
  scroller_streaming: {
    title: 'MessageScroller · streaming and the jump pill', theme: 'wb', h: 420,
    code: streamCode,
    Render: function StreamingLive() {
      const [shown, setShown] = useState(0);
      const [run, setRun] = useState(0);
      useEffect(() => {
        // Reduced motion: the whole answer at once (and a stable frame for screenshots).
        if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
          setShown(ANSWER.length);
          return;
        }
        setShown(0);
        const id = setInterval(() => setShown((n) => (n >= ANSWER.length ? n : n + 6)), 60);
        return () => clearInterval(id);
      }, [run]);
      const done = shown >= ANSWER.length;
      const items: MessageScrollerItem[] = [
        { id: 'u1', anchor: true, node: bubble('Explain how the scroller follows a reply.') },
        { id: 'a1', node: <div style={{ margin: '4px 0 12px' }}><MarkdownView markdown={ANSWER.slice(0, shown)} streaming={!done} /></div> },
      ];
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 360, borderRadius: 12, overflow: 'hidden', background: 'var(--wb-bg)', border: '1px solid var(--wb-sep)' }}>
          <MessageScroller items={items} streaming={!done} threadKey={'stream' + run} />
          <div style={{ padding: 10, borderTop: '1px solid var(--wb-sep)', flexShrink: 0, fontSize: 12, color: 'var(--wb-label2)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1 }}>{done ? 'Done.' : 'Streaming — scroll up to let go of the live edge.'}</span>
            <button type="button" className="wb-btn" onClick={() => setRun((r) => r + 1)} style={{ border: 0, borderRadius: 8, background: 'var(--wb-fill2)', color: 'var(--wb-label)', font: 'inherit', fontSize: 12, padding: '6px 10px', cursor: 'pointer' }}>
              Replay
            </button>
          </div>
        </div>
      );
    },
  },
  scroller_turns: {
    title: 'MessageScroller · turns rise into place', theme: 'wb', h: 400,
    code: turnsCode,
    Render: function TurnsLive() {
      const [msgs, setMsgs] = useState([
        { id: 'u0', user: true, text: 'Opened with this turn — no animation.' },
        { id: 'a0', user: false, text: 'Messages already in a thread are just there when it opens.' },
      ]);
      const n = useRef(0);
      const t = useRef<ReturnType<typeof setTimeout> | null>(null);
      useEffect(() => () => { if (t.current) clearTimeout(t.current); }, []);
      const send = () => {
        n.current++;
        const k = n.current;
        setMsgs((m) => [...m, { id: 'u' + k, user: true, text: `Turn ${k}: rising up from the composer.` }]);
        t.current = setTimeout(() => setMsgs((m) => [...m, { id: 'a' + k, user: false, text: 'And the reply settles in beneath it.' }]), 420);
      };
      const items: MessageScrollerItem[] = msgs.map((m) => ({
        id: m.id,
        anchor: m.user,
        node: m.user ? bubble(m.text) : <div style={{ margin: '4px 0 12px', fontSize: 13.5, lineHeight: 1.55 }}>{m.text}</div>,
      }));
      return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 340, borderRadius: 12, overflow: 'hidden', background: 'var(--wb-bg)', border: '1px solid var(--wb-sep)' }}>
          <MessageScroller items={items} threadKey="turns" />
          <div style={{ padding: 10, borderTop: '1px solid var(--wb-sep)', flexShrink: 0 }}>
            <button type="button" className="wb-btn" onClick={send} style={{ width: '100%', border: 0, borderRadius: 9, background: 'var(--wb-tint)', color: '#fff', font: 'inherit', fontWeight: 600, fontSize: 13, padding: '9px 0', cursor: 'pointer' }}>
              Send a turn
            </button>
          </div>
        </div>
      );
    },
  },
};
