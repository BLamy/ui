/* Sample workspace for the Codex clone: chats with dot, and the documents dot keeps beside them. Swap these for
   your backend. */

/** One row of a transcript. */
export type ChatItem =
  | { id: string; kind: 'time'; label: string }
  | {
      id: string;
      kind: 'message';
      role: 'user' | 'dot';
      text: string;
      /** bullets under the text */
      list?: string[];
      /** a document dot made or changed: shown as a link chip (with its cover) under the message */
      doc?: string;
      /** "Read 1:20 AM", under the user's message */
      read?: string;
      live?: boolean;
      /** "Worked for 2m 16s", a collapsed work log above dot's reply (project threads) */
      worked?: string;
      /** a shell command dot ran, shown as a code card */
      code?: string;
    };

/** Where a thread's sources come from. */
export interface Source {
  icon: string;
  label: string;
  dim?: boolean;
}

export interface Chat {
  id: string;
  title: string;
  /** `dot`: a chat with dot, with documents beside it. `thread`: a task in a project — a wide transcript with the project's panel. */
  kind: 'dot' | 'thread';
  /** project folder a thread lives in */
  project?: string;
  /** a thread that is still working, or has a branch or pull request open */
  status?: 'running' | 'branch' | 'pr';
  /** how recently a thread was used (0 = latest), for Recents */
  recent?: number;
  /** lines changed by a thread: its panel's Changes row */
  changes?: { added: number; removed: number };
  sources?: Source[];
  /** replies that arrived while another chat was open */
  unread: number;
  items: ChatItem[];
  /** documents open beside this chat at first; the first is showing */
  docs: string[];
}

export interface Doc {
  id: string;
  emoji: string;
  title: string;
  /** a gradient painted under the title */
  cover?: string;
  /** GitBook-flavoured Markdown: `##` and `###` headings form the outline */
  body: string;
}

/** Cover art as named content constants (a gradient per document). */
const COVERS = {
  scratchpad: 'radial-gradient(120% 140% at 85% 20%, #F6C56A 0%, transparent 38%), radial-gradient(110% 120% at 10% 90%, #C0453A 0%, transparent 55%), linear-gradient(135deg, #1B2A4A, #3B2F5C 55%, #5B3A4A)',
  triage: 'radial-gradient(110% 130% at 15% 15%, #59C3A5 0%, transparent 50%), linear-gradient(135deg, #16323A, #24475A)',
  wasm: 'radial-gradient(100% 120% at 80% 10%, #E2B93B 0%, transparent 42%), linear-gradient(135deg, #2A2A34, #45304F)',
  docstream: 'radial-gradient(110% 120% at 20% 100%, #6C8CFF 0%, transparent 50%), linear-gradient(135deg, #1C2340, #2E2A5C)',
};

export const DOCS: Doc[] = [
  {
    id: 'scratchpad',
    emoji: '✨',
    title: 'Your Personal Scratchpad',
    cover: COVERS.scratchpad,
    body: `> ☝️ I made this little observatory for your Loop QA work: tangled journeys become clear paths, with dot helping undo the knot. This notebook keeps the focus on what users experience and what would prove a fix worked.

A shared notebook for your Loop QA work and understanding where users get frustrated. Current through September 29, 2026.

## Up next

- Investigate authentication blockers and infrastructure/job failures using the [prepared triage checklist](#doc-triage)
- Validate why users enter unwanted journeys and spend credits before choosing a fix
- Attach recordings and clearer root-cause evidence to support tickets

## Things I can help with

> Assign any tasks you want me to do by highlighting it and tagging me in a comment on it.

- [ ] Group actual support tickets by blocked user goal and confirmed cause
- [ ] Compare a proposed fix with the original failing journey and its recording
- [ ] Trace where users lose control of journey scope and credit spend

## Backlog & reminders

- Fullstory access remains unresolved; the latest reply asks about paid plans and session volume
- CircleCI integration PRs remain open with failing checks; local tests do not yet establish an end-to-end green path
- Sitemap proposal needs team alignment; shipping was not verified

## Recently completed

### September 23–24

- Reproduced the credit-spend jump on journeys that start from a saved recording
- Shared the first cut of the triage checklist with the support team
- Confirmed the auth blocker is the SSO redirect, not the session cookie

## Projects and topics

- **Loop QA** — journeys, recordings, and the triage checklist
- **wasm-vm** — performance and the Omarchy work
- **DocStream UI** and **Orly** — editor polish and the release train

## Support sources to reconcile

- Zendesk exports (weekly)
- The support inbox, forwarded threads
- Slack #support-escalations, pinned messages
`,
  },
  {
    id: 'triage',
    emoji: '🧭',
    title: 'Prepared triage checklist',
    cover: COVERS.triage,
    body: `Work top to bottom. Stop at the first step that explains the ticket, and record it.

## Authentication blockers

- [x] Does the user reach the SSO redirect?
- [ ] Is the callback URL on the allow-list for their workspace?
- [ ] Does a fresh session fix it?

## Infrastructure and job failures

- [ ] Find the job id in the recording's network panel
- [ ] Check the worker queue depth at the time of failure
- [ ] Look for the same failure in the last 24 hours

### What to attach

- The recording link, cut to the failing step
- The job id and the failing request
- One sentence on what the user was trying to do

## Closing the loop

- [ ] Reply with the cause in the user's words
- [ ] Link the ticket to the fix
`,
  },
  {
    id: 'wasm-status',
    emoji: '⚙️',
    title: 'wasm-vm status',
    cover: COVERS.wasm,
    body: `Where wasm-vm stands after the September 28 merge.

## Performance

- Cold start is down to 38 ms from 61 ms
- The interpreter loop is 1.4× faster on the fib benchmark
- Memory growth is still linear on long runs

## Omarchy work

- Merged September 28
- Follow-up: the packaging script still assumes a Linux \`/opt\` prefix

### Open questions

- Should the JIT flag default on?
- Do we keep the legacy bytecode format for one more release?

## Remaining work

- [ ] Re-run the full test suite on the merged branch
- [ ] Fix the long-run memory growth
- [ ] Write the release notes
`,
  },
  {
    id: 'docstream-notes',
    emoji: '📄',
    title: 'DocStream UI and Orly',
    cover: COVERS.docstream,
    body: `What is in flight across the two repos, so the next update starts from here.

## DocStream UI

- The editor's slash menu picks up the host theme
- Checklist rows share the app's round checkbox

### Next

- Outline hover card
- Comment threads in the margin

## Orly

- Release train is blocked on the changelog step
- The docs site build is green

## Release order

- [ ] docstream
- [ ] docstream-editor
- [ ] ui
`,
  },
];

export const DOT_CHATS: Chat[] = [
  {
    id: 'dot',
    kind: 'dot',
    title: 'Your dot',
    unread: 0,
    docs: ['scratchpad'],
    items: [
      { id: 'dot-t1', kind: 'time', label: 'Sep 29, 8:40 PM' },
      {
        id: 'dot-m1',
        kind: 'message',
        role: 'dot',
        text: 'I made us a scratchpad for projects and to-dos. I’ll keep it updated as we go. Here are a few things we can start with:',
        list: [
          'Trace Loop QA’s reported frustrations to tickets, causes, and verified fixes using the prepared checklist',
          'Review what’s shipped and what still needs validation, starting with CircleCI and session capture',
        ],
        doc: 'scratchpad',
      },
      { id: 'dot-t2', kind: 'time', label: 'Sep 30, 1:20 AM' },
      { id: 'dot-m2', kind: 'message', role: 'user', text: 'what about wasmvm can you tell me how that’s doing?' },
      {
        id: 'dot-m3',
        kind: 'message',
        role: 'dot',
        text: 'The last check showed wasm-vm’s performance and Omarchy work merged on September 28. I’ll check the latest changes, tests, and remaining work.',
        doc: 'wasm-status',
      },
      { id: 'dot-m4', kind: 'message', role: 'user', text: 'I also really care about my docstream ui and orly repos.', read: 'Read 1:20 AM' },
      { id: 'dot-m5', kind: 'message', role: 'dot', text: 'Got it, DocStream UI and Orly matter too. I’ll include both alongside wasmvm in this update.', doc: 'docstream-notes' },
    ],
  },
  {
    id: 'loopqa',
    kind: 'dot',
    title: 'Loop QA triage',
    unread: 0,
    docs: ['triage'],
    items: [
      { id: 'lq-t1', kind: 'time', label: 'Sep 28, 4:12 PM' },
      { id: 'lq-m1', kind: 'message', role: 'user', text: 'can you turn the support tickets into something I can work through?' },
      {
        id: 'lq-m2',
        kind: 'message',
        role: 'dot',
        text: 'I grouped them by what the user was trying to do, then by the cause I could confirm. This is the order I’d work in:',
        list: ['Authentication blockers', 'Infrastructure and job failures', 'Everything else'],
        doc: 'triage',
      },
      { id: 'lq-m3', kind: 'message', role: 'user', text: 'start with auth — that’s where most of the credits are going', read: 'Read 4:14 PM' },
    ],
  },
  {
    id: 'wasm',
    kind: 'dot',
    title: 'wasm-vm',
    unread: 0,
    docs: ['wasm-status'],
    items: [
      { id: 'wv-t1', kind: 'time', label: 'Sep 28, 9:05 PM' },
      { id: 'wv-m1', kind: 'message', role: 'user', text: 'did the Omarchy branch land?' },
      { id: 'wv-m2', kind: 'message', role: 'dot', text: 'Yes — it merged on September 28. Cold start is down to 38 ms. I wrote the numbers up here.', doc: 'wasm-status' },
    ],
  },
  {
    id: 'docstream',
    kind: 'dot',
    title: 'DocStream UI and Orly',
    unread: 0,
    docs: ['docstream-notes'],
    items: [
      { id: 'ds-t1', kind: 'time', label: 'Sep 27, 11:30 AM' },
      { id: 'ds-m1', kind: 'message', role: 'user', text: 'what’s the release order for docstream, the editor and ui?' },
      { id: 'ds-m2', kind: 'message', role: 'dot', text: 'docstream first, then the editor, then ui — each pins the one before it. Checklist is in the notes.', doc: 'docstream-notes' },
    ],
  },
];

export const PROJECTS = ['loop-qa', 'jev-ultrafast-rlcd', 'ui', 'docstream', 'orly', 'wasm-vm', 'slack-clone', 'github-clone', 'minimax'];

const thread = (id: string, project: string, title: string, recent?: number, status?: Chat['status']): Chat => ({ id, kind: 'thread', project, title, recent, status, unread: 0, items: [], docs: [] });

/** Project threads. Most are empty; the first has a real transcript. */
export const THREADS: Chat[] = [
  {
    ...thread('stack-merge', 'github-clone', 'Stack and merge PRs then run QA', 3),
    changes: { added: 19213, removed: 1950 },
    sources: [
      { icon: 'link', label: 'pr-4650--loop-qa-j63k5x.netlify.app' },
      { icon: 'globe', label: 'GitHub' },
      { icon: 'globe', label: 'Web search' },
      { icon: 'link', label: 'View all', dim: true },
    ],
    items: [
      { id: 'sm-m0', kind: 'message', role: 'user', text: 'plese merge the prs' },
      {
        id: 'sm-m0a',
        kind: 'message',
        role: 'dot',
        text: 'Merged all seven open PRs, #71–#77, into main. I retargeted #72–#76 to main as their predecessors landed. For #77, I resolved the conflict in the sitemap config and re-ran the checks before merging.',
      },
      { id: 'sm-t1', kind: 'time', label: 'Wednesday 9:11 PM' },
      { id: 'sm-m1', kind: 'message', role: 'user', text: 'that still seems like it ran against the main loop qa please set the env var so it goes to our pr preview and make sure sitemaps are enabled on that pr preview for the project' },
      {
        id: 'sm-m2',
        kind: 'message',
        role: 'dot',
        worked: 'Worked for 2m 16s',
        text: 'Confirmed: the open project is Electric Forest PR 4650 Preview, targeting the PR preview URL.\n\nI enabled its sightmap polish pass. The project’s Site map page already shows 1,704 of 2,359 mapped items. The pass will run the next time QA runs; I did not start another run.\n\nFor CLI commands, select this project with:',
        code: 'REPLAY_QA_PROJECT_ID=proj-electric-forest-pr-4650-preview-muejywvf replayqa <command>',
      },
      { id: 'sm-m2b', kind: 'message', role: 'dot', text: 'I verified that setting resolves to the PR preview URL. The variable is scoped to that command invocation.' },
      { id: 'sm-m3', kind: 'message', role: 'user', text: 'please create a project on that host and do a test run against it' },
      {
        id: 'sm-m4',
        kind: 'message',
        role: 'dot',
        text: 'Created the Replay QA project on the PR preview host, with Sightmap enabled.\n\nThe initial test run is active. It has 13 journeys; the latest status showed journeys still running and queued, with no completed outcomes yet.',
      },
    ],
    docs: [],
  },
  thread('lq1', 'loop-qa', 'can you give me an overall ex…', 5),
  thread('lq2', 'loop-qa', 'Create PR for replay-qa', undefined, 'pr'),
  thread('lq3', 'loop-qa', 'Locate public routes OpenAPI'),
  thread('lq4', 'loop-qa', 'Add multiple named API tokens'),
  thread('lq5', 'loop-qa', 'Fix collapsed video and browser'),
  thread('lq6', 'loop-qa', 'Trace the credit-spend jump'),
  thread('lq7', 'loop-qa', 'Recording fails to attach'),
  thread('gc2', 'github-clone', 'setup-token', 9),
  thread('gc3', 'github-clone', 'Start app locally', undefined, 'branch'),
  thread('gc4', 'github-clone', 'Clarify prenup fee shifting', undefined, 'branch'),
  thread('r1', 'jev-ultrafast-rlcd', 'Finish Jev explainers', 0, 'running'),
  thread('r2', 'wasm-vm', 'Improve Omarchy responsiveness', 1, 'running'),
  thread('r3', 'orly', 'Publish repo and locate WebContainer', 4),
  thread('r4', 'jev-ultrafast-rlcd', 'Jev Ultrafast Docs Setup', 6),
  thread('r5', 'docstream', 'Fix DocStream default types', 7, 'pr'),
  thread('r6', 'jev-ultrafast-rlcd', 'Open Jev Documentation preview', 8),
  thread('r7', 'ui', 'Add charts to finetuning dashboard', 10),
];

/** Canned replies dot streams, in turn. */
export const REPLIES = [
  'On it. I’ll look through the latest changes first, then check what still needs validation and add what I find to the notes.',
  'Here’s what I’d do next: confirm the cause on the two newest tickets, attach the recordings, then update the checklist so the fix has something to be measured against.',
  'That’s in the notes now. Tell me if you want it ordered differently — I can also break it into smaller tasks.',
];

export const CHATS: Chat[] = [...DOT_CHATS, ...THREADS];
