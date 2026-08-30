import { useState, useEffect, useRef } from 'react';
import { vib } from '../lib/haptics';
import { WorkbenchShell } from '../lib/workbench-shell';
import type { WorkbenchThread } from '../lib/thread-sidebar';
import type { TermLine } from '../lib/terminal';
import type { SurfaceKind } from '../lib/surfaces';
import { WBSidebarSlot, WBMainSlot, WBDockSlot, WBDockSheetSlot, WBPanelSlot, WBTabsSlot } from '../lib/slots';

/* ══ demo replies (markdown exercising the renderer) ══ */
export const REPLY_SERVERS = `Both servers are now running detached and won't be killed by the tool's session limits.

| App | URL | PID | Log |
| --- | --- | --- | --- |
| app-builder | http://localhost:3000 | 5229 | app-builder.log |
| agent-kanban | http://localhost:3001 | 7099 | agent-kanban.log |

To stop them later:

\`\`\`bash
kill 5229 7099
# or
lsof -ti :3000 :3001 | xargs kill
\`\`\`

Both apps hot-reload — edit \`src/\` and the browser surface refreshes on save.`;
export const REPLY_COMPONENT = `The scroller anchors each new turn near the top of the viewport, keeps a peek of the previous reply, and only follows the live edge while you're already there.

\`\`\`jsx
<MessageScroller
  items={msgs.map(m => ({ id: m.id, anchor: m.role === 'user', node: <Message m={m}/> }))}
  streaming={isStreaming}
  threadKey={thread.id}
/>
\`\`\`

1. **Anchoring** — a new user message scrolls to the top with ~52px of the previous turn peeking above.
2. **Follow output** — replies grow into the room below; the view never moves while you read.
3. **Release** — any upward scroll intent (wheel, touch, keys) stops the following instantly.
4. **Jump back** — the pill at the bottom returns you to the live edge and re-engages following.`;
export const REPLY_REVIEW = `## Review notes

Checked the haptics path end to end:

- \`Haptics.boot()\` now runs at import, so the polyfill wraps the DOM **before** your first tap
- the CDN import is pinned to \`ios-vibrator-pro-max@3.0.3\` with a fallback host
- a pre-existing \`navigator.vibrate\` stub is deleted on Safari — it was silently blocking the install gate

> On iOS 18.4+ only a real click grants vibration (~1s). Drags vibrate through the overlay-switch trick instead, so mid-scrub ticks keep working.

---

Next: run **Settings → Haptics Playground** on the device and read the \`engine:\` line — it now reports exactly which path is live.`;
export const REPLIES = [REPLY_SERVERS, REPLY_COMPONENT, REPLY_REVIEW];

export const SEED_THREADS: WorkbenchThread[] = [
  {
    id: 't1',
    title: 'can you get this running',
    age: '2d',
    settled: true,
    msgs: [
      { id: 't1u1', role: 'user', md: 'can you get the demo servers running? app-builder and agent-kanban both need to be up.' },
      {
        id: 't1a1',
        role: 'assistant',
        md: REPLY_SERVERS,
        meta: 'Worked for 1m 4s',
        trace: {
          steps: ['Read package.json scripts in both apps', 'Started app-builder on :3000 (pid 5229)', 'Started agent-kanban on :3001 (pid 7099)', 'Health-checked both URLs — 200 OK'],
          code: 'nohup npm run dev --prefix app-builder > app-builder.log 2>&1 &\nnohup npm run dev --prefix agent-kanban > agent-kanban.log 2>&1 &\ncurl -sf localhost:3000 && curl -sf localhost:3001',
        },
      },
    ],
  },
  {
    id: 't2',
    title: 'wire the A–Z index haptics',
    age: '5d',
    settled: true,
    msgs: [
      { id: 't2u1', role: 'user', md: 'wire the A–Z index scrub to selection ticks' },
      {
        id: 't2a1',
        role: 'assistant',
        md: REPLY_REVIEW,
        meta: 'Worked for 42s',
        trace: {
          steps: ['Traced IndexBar pointer handlers', 'Wired Haptics.selection() to letter changes', 'Debounced repeat ticks within one letter'],
          code: 'if (letter !== last.current) {\n  last.current = letter\n  Haptics.selection()\n}',
        },
      },
    ],
  },
  {
    id: 't3',
    title: 'credenza height morph jitter',
    age: '6d',
    settled: true,
    msgs: [
      { id: 't3u1', role: 'user', md: 'the credenza jumps between share states — can you smooth the height morph?' },
      {
        id: 't3a1',
        role: 'assistant',
        md: REPLY_COMPONENT,
        meta: 'Worked for 58s',
        trace: {
          steps: ['Reproduced the jump between share states', 'Measured target height before commit', 'Springed height via transform, not layout'],
          search: [
            ['developer.apple.com', 'sheet detent height animation'],
            ['github.com/emilkowalski', 'vaul height morph'],
          ],
          code: 'const h = ref.current.offsetHeight\nsetSpring({height: h, config: {tension: 300, friction: 30}})',
        },
      },
    ],
  },
  { id: 't4', title: 'refactor SplitView breakpoints', age: '12d', settled: true, msgs: [] },
  { id: 't5', title: 'export vCard from share tray', age: '14d', settled: true, msgs: [] },
  { id: 't6', title: 'dark mode contrast pass', age: '21d', settled: true, msgs: [] },
  { id: 't7', title: 'reuse OAuth client between apps', age: '24d', settled: true, msgs: [] },
  { id: 't8', title: 'start MCP inspector on boot', age: '25d', settled: true, msgs: [] },
  { id: 't9', title: 'plan dynamic OAuth flows', age: '28d', settled: true, msgs: [] },
  { id: 't10', title: 'ship v0.1 checklist', age: '30d', settled: true, msgs: [] },
];

export const TERM_SEED: TermLine[] = [
  { t: 'npm run dev', p: true },
  { t: '> cookbook@0.1.0 dev' },
  { t: '> vite' },
  { t: '' },
  { t: '  VITE v6.0.3  ready in 412 ms', c: '#7EE0B8' },
  { t: '' },
  { t: '  ➜  Local:   http://localhost:3000/', c: '#8AB4FF' },
  { t: '  ➜  Network: http://192.168.1.24:3000/', c: '#8AB4FF' },
];

/* ══ WorkbenchDemo — the assembled demo composition on WorkbenchShell (prototype's `Workbench` root) ══ */
export interface WorkbenchDemoProps {
  tint?: string;
  terminal?: boolean | null;
  surface?: SurfaceKind | 'none' | null;
}
export function WorkbenchDemo(props: WorkbenchDemoProps) {
  const [threads, setThreads] = useState<WorkbenchThread[]>(SEED_THREADS);
  const [cur, setCur] = useState<string | null>('t1');
  const [surfKind, setSurfKind] = useState<SurfaceKind | null>(props.surface && props.surface !== 'none' ? props.surface : null);
  const [streamId, setStreamId] = useState<[string, string] | null>(null);
  const sTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const rIdx = useRef(0);
  useEffect(() => {
    if (props.surface != null) setSurfKind(props.surface === 'none' ? null : props.surface);
  }, [props.surface]);
  useEffect(
    () => () => {
      if (sTimer.current) clearInterval(sTimer.current);
    },
    []
  );
  const thread = threads.find((t) => t.id === cur) || null;
  const upd = (tid: string, fn: (t: WorkbenchThread) => WorkbenchThread) => setThreads((ts) => ts.map((t) => (t.id === tid ? fn(t) : t)));
  const stop = () => {
    if (sTimer.current) clearInterval(sTimer.current);
    if (streamId) {
      const [tid, mid] = streamId;
      upd(tid, (t) => ({ ...t, msgs: t.msgs.map((m) => (m.id === mid ? { ...m, live: false, meta: 'Stopped' } : m)) }));
      setStreamId(null);
    }
  };
  const send = (text: string, imgs?: string[]) => {
    if (sTimer.current) clearInterval(sTimer.current);
    let tid = cur;
    const uid = 'u' + Date.now(),
      aid = 'a' + Date.now();
    if (!tid) {
      tid = 'n' + Date.now();
      const base = text || 'Image';
      const title = base.length > 44 ? base.slice(0, 42) + '…' : base;
      setThreads((ts) => [{ id: tid as string, title, age: 'now', settled: false, msgs: [] }, ...ts]);
      setCur(tid);
    }
    upd(tid, (t) => ({
      ...t,
      settled: false,
      msgs: [...t.msgs, { id: uid, role: 'user', md: text, imgs: imgs && imgs.length ? imgs : undefined }, { id: aid, role: 'assistant', md: '', live: true }],
    }));
    const reply = REPLIES[rIdx.current++ % REPLIES.length];
    const words = reply.split(' ');
    const t0 = Date.now();
    let i = 0;
    setStreamId([tid, aid]);
    sTimer.current = setInterval(() => {
      i += 3 + Math.floor(Math.random() * 5);
      if (i >= words.length) {
        if (sTimer.current) clearInterval(sTimer.current);
        const secs = Math.max(1, Math.round((Date.now() - t0) / 1000));
        upd(tid as string, (t) => ({
          ...t,
          msgs: t.msgs.map((m) =>
            m.id === aid
              ? {
                  ...m,
                  md: reply,
                  live: false,
                  meta: 'Worked for ' + secs + 's',
                  trace: {
                    steps: ['Parsed the request', 'Scanned workbench.jsx for the relevant region', 'Drafted and streamed the reply'],
                    code: 'grep -n "' + (t.title || 'workbench').slice(0, 24) + '" workbench.jsx',
                  },
                }
              : m
          ),
        }));
        setStreamId(null);
        vib([10, 60, 14]);
      } else {
        const part = words.slice(0, i).join(' ');
        upd(tid as string, (t) => ({ ...t, msgs: t.msgs.map((m) => (m.id === aid ? { ...m, md: part } : m)) }));
      }
    }, 90);
  };
  const streaming = !!streamId && !!thread && streamId[0] === thread.id;
  return (
    <WorkbenchShell tint={props.tint} terminal={props.terminal}>
      <WorkbenchShell.Sidebar>
        <WBSidebarSlot threads={threads} cur={cur} setCur={setCur} />
      </WorkbenchShell.Sidebar>
      <WorkbenchShell.Main>
        <WBMainSlot
          thread={thread}
          streaming={streaming}
          onSend={send}
          onStop={stop}
          setCur={setCur}
          onUnsettle={() => thread && upd(thread.id, (t) => ({ ...t, settled: false }))}
        />
      </WorkbenchShell.Main>
      <WorkbenchShell.Dock>
        <WBDockSlot seed={TERM_SEED} />
      </WorkbenchShell.Dock>
      <WorkbenchShell.DockSheet>
        <WBDockSheetSlot seed={TERM_SEED} />
      </WorkbenchShell.DockSheet>
      <WorkbenchShell.Panel>
        <WBPanelSlot kind={surfKind} onOpen={setSurfKind} />
      </WorkbenchShell.Panel>
      <WorkbenchShell.TabBar>
        <WBTabsSlot kind={surfKind} onOpen={setSurfKind} />
      </WorkbenchShell.TabBar>
    </WorkbenchShell>
  );
}
