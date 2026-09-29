import type { SurfaceAgent, SurfaceDiffFile } from './surfaces';
import { TERMINAL_COLORS, type TermLine } from './terminal';

/* Story fixtures: a sample workspace for the Workbench stories (the t3-clone block carries its own copy). */

export interface Step {
  title: string;
  detail?: string;
  code?: string;
}
export interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  images?: string[];
  /** still streaming */
  live?: boolean;
  /** "Worked for 42s" */
  summary?: string;
  steps?: Step[];
}
export interface Thread {
  id: string;
  title: string;
  age: string;
  settled: boolean;
  messages: Message[];
}

export const PROJECT = 'cookbook';

const REPLY_SERVERS = `Both servers are now running detached and won't be killed by the tool's session limits.

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

const REPLY_COMPONENT = `The scroller anchors each new turn near the top of the viewport, keeps a peek of the previous reply, and only follows the live edge while you're already there.

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

const REPLY_REVIEW = `## Review notes

Checked the haptics path end to end:

- \`Haptics.boot()\` now runs at import, so the shim wraps the DOM **before** your first tap
- the CDN import is pinned to \`buzzkit@3.0.3\` with a fallback host
- a pre-existing \`navigator.vibrate\` stub is deleted on Safari — it was silently blocking the install gate

> On iOS 18.4+ only a real click grants vibration (~1s). Drags vibrate through the overlay-switch trick instead, so mid-scrub ticks keep working.

---

Next: run **Settings → Haptics Playground** on the device and read the \`engine:\` line — it now reports exactly which path is live.`;

/** Canned replies the fake agent streams, in turn. */
export const REPLIES = [REPLY_SERVERS, REPLY_COMPONENT, REPLY_REVIEW];

export const SUGGESTIONS = ['Get the demo servers running', 'Explain the haptics engine', 'Diff my last change'];

const empty = (id: string, title: string, age: string): Thread => ({ id, title, age, settled: true, messages: [] });

export const THREADS: Thread[] = [
  {
    id: 't1',
    title: 'can you get this running',
    age: '2d',
    settled: true,
    messages: [
      { id: 't1u1', role: 'user', text: 'can you get the demo servers running? app-builder and agent-kanban both need to be up.' },
      {
        id: 't1a1',
        role: 'assistant',
        text: REPLY_SERVERS,
        summary: 'Worked for 1m 4s',
        steps: [
          { title: 'Read package.json scripts in both apps' },
          { title: 'Started app-builder on :3000', detail: 'pid 5229', code: 'nohup npm run dev --prefix app-builder > app-builder.log 2>&1 &' },
          { title: 'Started agent-kanban on :3001', detail: 'pid 7099', code: 'nohup npm run dev --prefix agent-kanban > agent-kanban.log 2>&1 &' },
          { title: 'Health-checked both URLs', detail: '200 OK', code: 'curl -sf localhost:3000 && curl -sf localhost:3001' },
        ],
      },
    ],
  },
  {
    id: 't2',
    title: 'wire the A–Z index haptics',
    age: '5d',
    settled: true,
    messages: [
      { id: 't2u1', role: 'user', text: 'wire the A–Z index scrub to selection ticks' },
      {
        id: 't2a1',
        role: 'assistant',
        text: REPLY_REVIEW,
        summary: 'Worked for 42s',
        steps: [
          { title: 'Traced IndexBar pointer handlers' },
          { title: 'Wired Haptics.selection() to letter changes', code: 'if (letter !== last.current) {\n  last.current = letter\n  Haptics.selection()\n}' },
          { title: 'Debounced repeat ticks within one letter' },
        ],
      },
    ],
  },
  {
    id: 't3',
    title: 'credenza height morph jitter',
    age: '6d',
    settled: true,
    messages: [
      { id: 't3u1', role: 'user', text: 'the credenza jumps between share states — can you smooth the height morph?' },
      {
        id: 't3a1',
        role: 'assistant',
        text: REPLY_COMPONENT,
        summary: 'Worked for 58s',
        steps: [
          { title: 'Reproduced the jump between share states' },
          { title: 'Searched', detail: 'vaul height morph · github.com/emilkowalski' },
          { title: 'Springed height via transform, not layout', code: 'const h = ref.current.offsetHeight\nsetSpring({ height: h })' },
        ],
      },
    ],
  },
  empty('t4', 'refactor SplitView breakpoints', '12d'),
  empty('t5', 'export vCard from share tray', '14d'),
  empty('t6', 'dark mode contrast pass', '21d'),
  empty('t7', 'reuse OAuth client between apps', '24d'),
  empty('t8', 'start MCP inspector on boot', '25d'),
  empty('t9', 'plan dynamic OAuth flows', '28d'),
  empty('t10', 'ship v0.1 checklist', '30d'),
];

export const TERMINAL_SEED: TermLine[] = [
  { t: 'npm run dev', p: true },
  { t: '> cookbook@0.1.0 dev' },
  { t: '> vite' },
  { t: '' },
  { t: '  VITE v6.0.3  ready in 412 ms', c: TERMINAL_COLORS.green },
  { t: '' },
  { t: '  ➜  Local:   http://localhost:3000/', c: TERMINAL_COLORS.blue },
  { t: '  ➜  Network: http://192.168.1.24:3000/', c: TERMINAL_COLORS.blue },
];

export const FILES = [
  'cookbook/src/components/Credenza.tsx',
  'cookbook/src/components/SideDrawer.tsx',
  'cookbook/src/components/MessageScroller.tsx',
  'cookbook/src/haptics.ts',
  'cookbook/src/App.tsx',
  'cookbook/blui.jsx',
  'cookbook/workbench.jsx',
  'cookbook/package.json',
  'cookbook/vite.config.js',
];

export const DIFF: { before: SurfaceDiffFile; after: SurfaceDiffFile } = {
  before: {
    name: 'src/haptics.ts',
    contents: `export async function bootHaptics() {
  if (navigator.vibrate) return
  await import('https://esm.run/buzzkit')
}`,
  },
  after: {
    name: 'src/haptics.ts',
    contents: `export async function bootHaptics() {
  if (isBlockingStub(navigator.vibrate)) delete navigator.vibrate
  await import('https://esm.sh/buzzkit@3.0.3')
  window.addEventListener('bl-vib', reportHaptic)
}`,
  },
};

export const AGENTS: SurfaceAgent[] = [
  { name: 'docs-writer', status: 'running', detail: 'writing message-scroller.md · 2m 14s' },
  { name: 'test-runner', status: 'passed', detail: '42 passed · 0 failed · 18s' },
  { name: 'lint', status: 'passed', detail: 'no issues · 4s' },
  { name: 'bundle-size', status: 'queued', detail: 'waiting on test-runner' },
];
