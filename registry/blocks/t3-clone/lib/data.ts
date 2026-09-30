import type { SurfaceAgent, SurfaceDiffFile, SurfaceKind } from '../components/workbench/surfaces';
import type { TermLine } from '../components/workbench/terminal';

/* Sample workspace for the T3 Code clone. Swap these for your agent backend. */

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

- \`Haptics.boot()\` now runs at import, so the polyfill wraps the DOM **before** your first tap
- the CDN import is pinned to \`ios-vibrator-pro-max@3.0.3\` with a fallback host
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
  { t: '  VITE v6.0.3  ready in 412 ms', c: '#7EE0B8' },
  { t: '' },
  { t: '  ➜  Local:   http://localhost:3000/', c: '#8AB4FF' },
  { t: '  ➜  Network: http://192.168.1.24:3000/', c: '#8AB4FF' },
];

/* ── Per-thread workspace ──
   A thread owns more than its messages: the terminals open beside it and the surface (browser, files, diff…)
   showing in the right panel. Switching threads switches all of it. */

export interface TerminalSession {
  id: string;
  title: string;
  /** scrollback, kept here so a session survives thread switches and is shared by the dock and the panel */
  lines: TermLine[];
}
export interface ThreadWorkspace {
  terminals: TerminalSession[];
  /** id of the terminal showing */
  terminal: string;
  /** surface open in the right panel; `null` shows the picker */
  surface: SurfaceKind | null;
  /** file selected in the Files surface */
  file: string;
}

const G = '#7EE0B8';
const B = '#8AB4FF';
const R = '#FF8A80';
const devServer = (name: string, port: number, pid: number): TermLine[] => [
  { t: `nohup npm run dev --prefix ${name} > ${name}.log 2>&1 &`, p: true },
  { t: `[1] ${pid}` },
  { t: `tail -f ${name}.log`, p: true },
  { t: '  VITE v6.0.3  ready in 388 ms', c: G },
  { t: `  ➜  Local:   http://localhost:${port}/`, c: B },
  { t: '  [vite] hot updated: /src/App.tsx' },
];

/** A shell with nothing in it yet: what a new thread — or a new terminal — starts with. */
export const blankTerminal = (id: string, title = 'zsh'): TerminalSession => ({ id, title, lines: [] });
export const blankWorkspace = (): ThreadWorkspace => ({ terminals: [blankTerminal('term-1')], terminal: 'term-1', surface: null, file: 'cookbook/src/App.tsx' });

/** What each sample thread had open: its own terminals, surface and file. Threads not listed start blank. */
export const WORKSPACES: Record<string, ThreadWorkspace> = {
  t1: {
    terminals: [{ id: 't1-dev', title: 'zsh — cookbook', lines: TERMINAL_SEED }],
    terminal: 't1-dev',
    surface: null,
    file: 'cookbook/src/App.tsx',
  },
  t2: {
    terminals: [
      {
        id: 't2-zsh',
        title: 'zsh — index',
        lines: [
          { t: 'rg -n "selection" src/components/IndexBar.tsx', p: true },
          { t: '41:  Haptics.selection()' },
          { t: '58:  // one selection tick per letter change' },
          { t: 'git status -s', p: true },
          { t: ' M src/components/IndexBar.tsx', c: G },
          { t: ' M src/haptics.ts', c: G },
        ],
      },
      {
        id: 't2-test',
        title: 'vitest',
        lines: [
          { t: 'npx vitest run index-bar', p: true },
          { t: ' ✓ IndexBar › ticks once per letter change (12ms)', c: G },
          { t: ' ✓ IndexBar › debounces repeat ticks (9ms)', c: G },
          { t: ' ✗ IndexBar › keyboard scrub does not tick twice', c: R },
          { t: '' },
          { t: ' Tests  2 passed | 1 failed (3)' },
        ],
      },
    ],
    terminal: 't2-zsh',
    surface: 'diff',
    file: 'cookbook/src/haptics.ts',
  },
  t3: {
    terminals: [
      {
        id: 't3-sb',
        title: 'storybook',
        lines: [
          { t: 'pnpm storybook', p: true },
          { t: '  Storybook 10.5 started', c: G },
          { t: '  Local:   http://localhost:6006/', c: B },
          { t: '  ✓ Credenza/HeightMorph compiled in 1.2s' },
        ],
      },
    ],
    terminal: 't3-sb',
    surface: 'files',
    file: 'cookbook/src/components/Credenza.tsx',
  },
  t4: {
    terminals: [
      { id: 't4-zsh', title: 'zsh — split-view', lines: [{ t: 'rg -n "breakpoint" packages/ui/src/components/split-view.tsx', p: true }, { t: '112:  wc: SplitViewWidthClass' }] },
      { id: 't4-web', title: 'docs :4417', lines: devServer('docs', 4417, 8121) },
    ],
    terminal: 't4-zsh',
    surface: 'browser',
    file: 'cookbook/src/App.tsx',
  },
};

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
  await import('https://esm.run/ios-vibrator-pro-max')
}`,
  },
  after: {
    name: 'src/haptics.ts',
    contents: `export async function bootHaptics() {
  if (isBlockingStub(navigator.vibrate)) delete navigator.vibrate
  await import('https://esm.sh/ios-vibrator-pro-max@3.0.3')
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

/* ── Command palette (⌘K) ── */

export interface Project {
  name: string;
  path: string;
  /** Monogram colour. */
  color: string;
}
export const PROJECTS: Project[] = [
  { name: 'cookbook', path: '~/Code/cookbook', color: '#30D158' },
  { name: 'wasm-vm', path: '~/Code/wasm-vm', color: '#FFD60A' },
  { name: 'loop-qa', path: '~/Code/loop-qa', color: '#FF375F' },
  { name: 'electric-forest', path: '~/Code/electric-forest', color: '#A4E34F' },
  { name: 'Codex', path: '~/Code', color: '#FF9F0A' },
  { name: 'jev-ultrafast', path: '~/Code/jev-ultrafast', color: '#FF9F0A' },
];

/** Folders "on disk" the Local folder source offers. */
export const LOCAL_FOLDERS = ['~/Code/ios-haptics', '~/Code/agent-kanban', '~/Code/app-builder', '~/Documents/notes'];

/** Repositories the GitHub source offers. */
export const GITHUB_REPOS = ['blamy/ui', 'blamy/docstream', 'pmndrs/zustand', 'emilkowalski/vaul', 'pacocoursey/cmdk'];

/** A stable, uuid-shaped id per thread (what "Copy thread ID" copies). */
export function threadUuid(id: string) {
  let h = 2166136261;
  for (const c of id) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  const hex = (n: number, len: number) => (n >>> 0).toString(16).padStart(len, '0').slice(-len);
  return `${hex(h, 8)}-${hex(h >>> 7, 4)}-4${hex(h >>> 3, 3)}-a${hex(h >>> 11, 3)}-${hex(Math.imul(h, 2654435761), 8)}${hex(h >>> 5, 4)}`;
}

export interface PullRequest {
  number: number;
  title: string;
  branch: string;
  author: string;
}
export const PULL_REQUESTS: PullRequest[] = [
  { number: 412, title: 'Spring the composer between centre and dock', branch: 'composer-fly', author: 'blamy' },
  { number: 409, title: 'Haptics: probe the TabView rail', branch: 'haptics-probe', author: 'blamy' },
  { number: 405, title: 'Credenza height morph without layout thrash', branch: 'credenza-morph', author: 'nat' },
  { number: 398, title: 'Detached dev servers survive tool timeouts', branch: 'detached-servers', author: 'blamy' },
];

/** Lines "Search project contents" greps through. */
export const CONTENT_INDEX: { file: string; line: number; text: string }[] = [
  { file: 'src/haptics.ts', line: 3, text: 'if (isBlockingStub(navigator.vibrate)) delete navigator.vibrate' },
  { file: 'src/haptics.ts', line: 4, text: "await import('https://esm.sh/ios-vibrator-pro-max@3.0.3')" },
  { file: 'src/haptics.ts', line: 5, text: "window.addEventListener('bl-vib', reportHaptic)" },
  { file: 'src/components/Credenza.tsx', line: 41, text: 'const h = ref.current.offsetHeight' },
  { file: 'src/components/Credenza.tsx', line: 42, text: 'setSpring({ height: h })' },
  { file: 'src/components/MessageScroller.tsx', line: 88, text: 'const anchor = items.findLast((i) => i.anchor)' },
  { file: 'src/components/MessageScroller.tsx', line: 120, text: 'if (following) el.scrollTop = el.scrollHeight' },
  { file: 'src/components/SideDrawer.tsx', line: 17, text: 'export function SideDrawer({ open, onClose, children })' },
  { file: 'src/App.tsx', line: 12, text: '<MessageScroller items={items} streaming={streaming} />' },
  { file: 'vite.config.js', line: 6, text: 'server: { port: 3000, strictPort: true }' },
  { file: 'package.json', line: 7, text: '"dev": "vite --host"' },
];

/** Accents the theme editor offers. */
export const TINTS = ['#0A84FF', '#30D158', '#FF9F0A', '#FF375F', '#BF5AF2', '#64D2FF'];
