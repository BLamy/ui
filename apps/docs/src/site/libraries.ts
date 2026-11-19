/* The BL libraries: one npm package, `@brett_lamy/ui`, and the libraries inside it. Every library is a subpath of the
   package (`@brett_lamy/ui/audio`, `@brett_lamy/ui/markdown`, `@brett_lamy/ui/sdk/react/dialog`) and a set of items in
   the shadcn registry, so an app installs one package, or copies source, and bundles only the entries it imports.
   This manifest is the single source for the site's Libraries menu, the library pages, the roadmap's package and module
   maps, and for the entries themselves: tools/registry/package-exports.mjs reads `entry` and `modules` and writes
   packages/ui/src/libraries/<entry>.ts, the package's `exports`, and one registry item per library.

   `modules` lists the units of packages/ui/src a library owns; the core (`ui`) owns every unit no other library
   lists. libraries.test.ts checks the plan against the real imports: every unit has exactly one home, and no library
   imports from one it doesn't build on, but for the lazy links in LAYER_EXCEPTIONS.

   Docstream and docstream-editor were packages of their own until 2.0.1; since 6.0 they are libraries here like the
   rest (`@brett_lamy/ui/docstream/<entry>`, `@brett_lamy/ui/docstream-editor/<entry>`). UI SDK, the behavior layer,
   is inside the package too: our build of the `vendor/ui-sdk` submodule, at `@brett_lamy/ui/sdk/…`.

   `external` is every npm package a library's own modules import that the libraries it builds on don't already
   bring, marked "(optional peer)" when @brett_lamy/ui declares it one; libraries.test.ts checks both.

   Node reads this file too (type stripping), so it holds only erasable TypeScript: no enums, type-only imports. */
import type { IconName } from '@/lib/icon';

export type Category = 'foundation' | 'ui' | 'content' | 'data' | 'sandboxing' | 'platform';
/** `live`: on npm before 6.0, as `@brett_lamy/ui` or under a name of its own (docstream). `new`: an entry of
    `@brett_lamy/ui` that 6.0 adds. `planned`: not shipped yet. */
export type Status = 'live' | 'new' | 'planned';

export const STATUS_LABEL: Record<Status, string> = { live: 'On npm', new: 'New in 6.0', planned: 'Planned' };

export interface Library {
  id: string;
  name: string;
  /** What an app imports: the package, or the library's entry of it. */
  npm: string;
  category: Category;
  status: Status;
  icon: IconName;
  tagline: string;
  description: string;
  /** The library whose npm package carries this one: `ui`, for every library but the core itself. */
  partOf?: string;
  /** The generated entry that gathers the library: `@brett_lamy/ui/<entry>` re-exports every module of `modules`
      that has an entry of its own (packages/ui/src/libraries/<entry>.ts). Also the name of its registry item,
      `library-<entry>`, which installs all of them with the shadcn CLI. */
  entry?: string;
  /** Other entries of the package that belong to the library, kept apart for their size or their peers
      (`cloudflare` beside Diagram). */
  alsoAt?: string[];
  /** Packages this library used to be published as, frozen at their last version. */
  formerly?: Array<{ npm: string; last: string }>;
  /** The docs' route (`#/<docs>`), for libraries with docs. */
  docs?: string;
  /** Libraries it builds on (ids). */
  dependsOn: string[];
  /** npm packages it brings (beyond react). */
  external?: string[];
  /** The units of packages/ui/src the library owns. A trailing `*` takes every unit that starts with what comes
      before it (`lib/diagram-*`). */
  modules?: string[];
  /** What it's for, in a few lines. */
  highlights: string[];
  /** What its page shows first: blocks (registry/blocks/<slug>) and docs pages (pages/<id>.md), ahead of the ones
      showcase-graph.ts finds from the imports. For libraries every block uses (the import count can't rank them)
      and pages named for no unit of the library. */
  showcase?: { blocks?: string[]; pages?: string[] };
}

/** Categories, each with a chart color token (`chart-1` … `chart-5`) that marks its libraries. */
export const CATEGORIES: Array<{ id: Category; label: string; tone: 1 | 2 | 3 | 4 | 5 }> = [
  { id: 'foundation', label: 'Foundation', tone: 2 },
  { id: 'ui', label: 'UI', tone: 1 },
  { id: 'content', label: 'Content & AI', tone: 3 },
  { id: 'data', label: 'Data & state', tone: 4 },
  { id: 'sandboxing', label: 'Sandboxing', tone: 5 },
  // Six groups, five chart tones: the last group shares the first's, at the other end of every list.
  { id: 'platform', label: 'Platform & tooling', tone: 2 },
];

export const LIBRARIES: Library[] = [
  /* ── Foundation ─────────────────────────────────────────────────────────────────────────────── */
  {
    id: 'ui-sdk', name: 'UI SDK', npm: '@brett_lamy/ui/sdk', partOf: 'ui', category: 'foundation', status: 'new', icon: 'layers',
    tagline: 'The behavior layer: our build of UI SDK, inside the package.',
    description: 'Every interactive part of the kit is a UI SDK part: keyboard, focus, selection, dismissal, popups, drag and drop and ARIA come from it. The package carries its own build of UI SDK (the `vendor/ui-sdk` submodule: upstream plus layer hosts, `bindLayer`\'s `when` and an exported `SlotProps`), so there is nothing else to install and one copy of its focus and layer state in the page. Wherever UI SDK\'s docs say `@ui-sdk/…`, write `@brett_lamy/ui/sdk/…`: `@brett_lamy/ui/sdk/core`, `@brett_lamy/ui/sdk/react/dialog`.',
    dependsOn: [],
    showcase: { blocks: ['interface-builder', 'apple-mail', 'split-view-demos'], pages: ['ui-sdk'] },
    highlights: ['`@brett_lamy/ui/sdk/react/<part>`: Dialog, Menu, Select, Tabs, Toolbar, Tree…', 'Layer hosts: popups that stay inside a framed app', 'Upstream\'s API, three small additions, nothing else'],
  },
  {
    id: 'tokens', name: 'Tokens', npm: '@brett_lamy/ui/tokens', partOf: 'ui', entry: 'tokens', category: 'foundation', status: 'new', icon: 'drop',
    tagline: 'Design tokens, themes, size classes and the class helpers everything else uses.',
    description: 'The single source of color, type, radius, shadow and spring timing: tokens.css generates its TypeScript twin, the bl-theme maps it onto Tailwind v4, and BLProvider, ThemeScope and `appearance` retint any subtree. The size-class scope (`compact` / `medium` / `regular`, measured on a container, never the viewport) lives here too, because the providers are what measure it, and so does syntax lexing, whose token classes the shared syntax palette colors: gpu-lexer behind one queue and adapter probe, with the synchronous lexer as its fallback (CodeEditor, docstream\'s fences, the editor and the replay DevTools all lex through it). The change details every kit callback hands out (`changeDetails`) are here too.',
    dependsOn: ['ui-sdk'], external: ['clsx', 'tailwind-merge', 'class-variance-authority', 'gpu-lexer'],
    modules: ['lib/tokens.generated.ts', 'lib/utils.ts', 'lib/theme.tsx', 'lib/theme-context.tsx', 'lib/primitives.ts', 'lib/size-class.ts', 'lib/container.ts', 'lib/syntax-lexer.ts', 'lib/syntax.ts', 'lib/webgpu.ts', 'lib/change-details.ts'],
    showcase: { blocks: ['interface-builder', 'apple-settings', 'split-view-demos'], pages: ['theming', 'styling', 'variants', 'utilities'] },
    highlights: ['tokens.css → tokens.generated.ts, one source of truth', 'BLProvider, ThemeScope, `appearance` and `tint`', 'Size classes from a container\'s own box', '`cn`, `cx` and the shared focus and surface recipes'],
  },
  {
    id: 'motion', name: 'Motion', npm: '@brett_lamy/ui/motion', partOf: 'ui', entry: 'motion', category: 'foundation', status: 'new', icon: 'pulse',
    tagline: 'iOS springs, morphs, presence and the gestures that drive them.',
    description: 'The springs every transition uses and reduced-motion handling, presence (exit animations that finish before unmount), the morphing parts (TextMorph, NumberMorph, Morph, AnimatedHeight, Swap, Celebrate) and the gestures behind sheets and stacks: edge swipe, pull to refresh and the large-title flight. The animation engine (framer-motion) is one lazy chunk, fetched at idle after a part that can animate mounts, so a Button or a List does not carry it.',
    dependsOn: ['tokens'], external: ['framer-motion'],
    modules: [
      'lib/motion.ts', 'lib/motion-lazy.ts', 'lib/motion-engine.ts', 'lib/reduced-motion.ts', 'lib/presence.ts', 'lib/morph-path.ts', 'lib/title-flight.ts', 'lib/edge-swipe.ts', 'lib/pull-to-refresh.ts',
      'components/text-morph.tsx', 'components/number-morph.tsx', 'components/animated-height.tsx', 'components/morph.tsx', 'components/celebrate.tsx', 'components/swap.tsx',
    ],
    showcase: { blocks: ['apple-reminders', 'saas-checkout', 'apple-mail'] },
    highlights: ['Springs matched to UIKit, `motion-reduce` everywhere', 'TextMorph, NumberMorph, Morph, AnimatedHeight, Swap', 'Edge swipe, pull to refresh, title flight'],
  },
  {
    id: 'icons', name: 'Icons', npm: '@brett_lamy/ui/icons', partOf: 'ui', entry: 'icons', category: 'foundation', status: 'new', icon: 'star',
    tagline: 'An SF Symbols–style icon set as typed React components.',
    description: 'Every glyph the kit draws, as one `<Icon name>` component with weights, aliases and search keywords, plus the chat, PencilKit, workbench and documents shape sets (the last drawn for docstream and its editor) and the file-type icons Tree uses. Icons animate between shapes, so they build on Motion.',
    dependsOn: ['tokens', 'motion'],
    modules: ['lib/icon.tsx', 'lib/icon-shapes/', 'lib/file-icons.tsx'],
    showcase: { blocks: ['apple-settings', 'vscode', 'apple-notes'], pages: ['icons'] },
    highlights: ['`<Icon name="paperplane" weight="semibold" />`', 'Aliases and keywords for pickers and search', 'File-type, folder and badge icons'],
  },

  /* ── UI ─────────────────────────────────────────────────────────────────────────────────────── */
  {
    id: 'ui', name: 'UI', npm: '@brett_lamy/ui', category: 'ui', status: 'live', icon: 'grid', docs: 'introduction',
    tagline: 'iOS-flavored components on UI SDK and Tailwind v4.',
    description: 'The core, and the package every other library ships in: controls, fields and pickers, the popups (Dialog with its views, Sheet, Popover, DropdownMenu, Select, Combobox, Toast) and the containers that make an app feel native — NavigationStack, SplitView, Tabs, AdaptivePane, Sidebar, List, Toolbar, DataTable — plus the workbench and debugging parts. `@brett_lamy/ui` itself exports the core; every module is also its own entry (`@brett_lamy/ui/dialog`) and its own shadcn registry item.',
    dependsOn: ['ui-sdk', 'tokens', 'motion', 'icons'],
    external: ['class-variance-authority', '@wterm/*', '@vscode/codicons'],
    showcase: { blocks: ['apple-notes', 'github-clone', 'interface-builder', 'apple-mail', 'saas-checkout', 'split-view-demos'] },
    highlights: ['NavigationStack, SplitView, Tabs, AdaptivePane, Sidebar, Dialog flows', 'One spelling per concept: `size`, `variant`, `tone`, `side`, `presentation`', 'Responsive by container: a sheet in a compact column, a popover in a wide one', 'Install from npm, or copy the source with the shadcn registry'],
  },
  {
    id: 'time', name: 'Time', npm: '@brett_lamy/ui/time', partOf: 'ui', entry: 'time', category: 'ui', status: 'new', icon: 'calendar',
    tagline: 'Dates, times and schedules: calendars, pickers and a cron editor.',
    description: 'Calendar, DateInput and DatePicker, NaturalTimeInput, which reads schedules written in plain English ("every weekday at 9am") and previews their next occurrences, and CronEditor, both on small in-browser parsers (gpu-time, gpu-cron).',
    dependsOn: ['ui'], external: ['gpu-time', 'gpu-cron', 'cronstrue'],
    modules: ['components/calendar.tsx', 'components/date-input.tsx', 'components/date-picker.tsx', 'components/natural-time-input.tsx', 'components/cron-editor.tsx', 'lib/calendar-months.ts', 'lib/gpu-time.ts', 'lib/gpu-cron.ts', 'lib/cron.ts', 'lib/schedule-preview.tsx'],
    highlights: ['Calendar, DateInput, DatePicker with ranges', 'NaturalTimeInput: "every weekday at 9am" → occurrences', 'CronEditor with next runs and plain-English descriptions'],
  },
  {
    id: 'canvas', name: 'Canvas', npm: '@brett_lamy/ui/canvas', partOf: 'ui', entry: 'canvas', category: 'ui', status: 'new', icon: 'pencil-tip',
    tagline: 'An infinite board and PencilKit drawing.',
    description: 'Canvas, a pannable, zoomable board with frames, handles, marquee selection, snapping guides and the geometry behind them, and PencilKit: pressure-aware ink, the tool palette, undo history and the annotator the Composer uses for images and screenshots.',
    dependsOn: ['ui'], external: ['perfect-freehand'],
    modules: ['components/canvas.tsx', 'lib/canvas-math.ts', 'lib/canvas-primitive.ts', 'components/pencilkit/'],
    highlights: ['Pan, zoom, select, resize, snap', 'PencilKit ink with the iPadOS tool palette', 'Annotate any image'],
  },
  {
    id: 'diagram', name: 'Diagram', npm: '@brett_lamy/ui/diagram', partOf: 'ui', entry: 'diagram', alsoAt: ['cloudflare'], category: 'ui', status: 'new', icon: 'network',
    tagline: 'Diagrams you can edit, state machines you can run, and Cloudflare systems.',
    description: 'Diagram, an editable node-and-edge drawing on Canvas with automatic layout (elkjs) and keyboard editing; DiagramFrame, the editor chrome around it; StateDiagram, which draws an xstate machine, edits it and simulates it; and CloudflareDiagram with the Cloudflare catalog, which reads and writes wrangler and workerd configs. The catalog is about 150 KB, so CloudflareDiagram has an entry of its own, `@brett_lamy/ui/cloudflare`.',
    dependsOn: ['ui', 'canvas'], external: ['elkjs (optional peer)', 'xstate (optional peer)', 'jsonc-parser', '@babel/parser'],
    modules: ['components/diagram*', 'components/state-diagram.tsx', 'components/cloudflare-diagram.tsx', 'lib/diagram-*', 'lib/state-diagram-*', 'lib/cloudflare-*', 'lib/use-font-version.ts', 'cloudflare.ts'],
    highlights: ['Automatic layout, keyboard editing, a minimap', 'Run an xstate machine on its own diagram', 'Cloudflare systems from wrangler.jsonc and workerd configs'],
  },
  {
    id: 'audio', name: 'Audio', npm: '@brett_lamy/ui/audio', partOf: 'ui', entry: 'audio', category: 'ui', status: 'new', icon: 'waveform',
    tagline: 'Waveforms, a playback clock and live-coded music.',
    description: 'Waveform, which draws any audio file and scrubs it, NowPlayingBars, the playback clock a player, a timeline and transport controls share (time, rate, loop, scrubbing, with no re-render per tick), and StrudelPlayer, docstream\'s Strudel widget as a component of its own.',
    dependsOn: ['ui', 'docstream'],
    modules: ['components/waveform.tsx', 'components/now-playing-bars.tsx', 'components/strudel-player.tsx', 'lib/playback.ts'],
    showcase: { blocks: ['strudel-studio', 'apple-music'] },
    highlights: ['Waveforms from any audio file', 'One playback clock for a player and its transport', 'StrudelPlayer: patterns you can edit while they play'],
  },
  {
    id: 'video', name: 'Video', npm: '@brett_lamy/ui/video', partOf: 'ui', entry: 'video', category: 'ui', status: 'new', icon: 'video',
    tagline: 'A video preview and a multi-track timeline that renders in the browser.',
    description: 'VideoPreview and a multi-track VideoTimeline with an FFmpeg (WebAssembly) renderer, and Filmstrip, which draws a clip\'s frames. The timeline and the preview follow Audio\'s playback clock. FFmpeg loads only when a render starts, from files the app serves.',
    dependsOn: ['ui', 'audio'],
    modules: [
      'components/video-preview.tsx', 'components/video-timeline.tsx', 'components/filmstrip.tsx',
      'lib/video-timeline-model.ts', 'lib/video-timeline-primitive.ts', 'lib/video-render.ts', 'lib/ffmpeg/',
    ],
    highlights: ['A timeline editor that renders with FFmpeg in a worker', 'Filmstrips from any video file', 'Preview and timeline on one clock'],
  },

  /* ── Content & AI ───────────────────────────────────────────────────────────────────────────── */
  {
    id: 'docstream', name: 'Docstream', npm: '@brett_lamy/ui/docstream', partOf: 'ui', category: 'content', status: 'live', icon: 'doc-text', docs: 'docstream',
    formerly: [{ npm: '@brett_lamy/docstream', last: '2.0.1' }],
    tagline: 'GitBook-flavored Markdown that renders while it streams.',
    description: 'A Markdown renderer for docs and AI answers: GitBook blocks (hints, tabs, steppers, cards), live React demos backed by real files, math, Mermaid, xstate machines and workerd configs drawn as diagrams, OpenAPI operations, citations, embeds, session replays and 3D models — and DocsSite, which turns a folder of Markdown into a site like this one. Part of @brett_lamy/ui since 6.0: import it from `@brett_lamy/ui/docstream` and its entries (`/site`, `/gitbook`, `/replay`…).',
    // Its glyphs are the kit's Icon set, and its lexing (lib/syntax) and callbacks' details (lib/change-details) are the kit's, with Tokens.
    dependsOn: ['ui-sdk', 'tokens', 'icons'],
    external: ['katex', 'yaml', 'rrweb', 'pele', 'acorn', 'framer-motion', 'xstate (optional peer)', '@strudel/web', '@brett_lamy/viz-engine (optional peer)', '@agent-wasm/core (optional peer)', 'vite (optional peer)'],
    modules: ['docstream/'],
    highlights: ['Streams safely: unfinished blocks render as they arrive', 'Live demos from real files, in an in-browser Vite', 'DocsSite: a GitBook-style site from a folder of Markdown', 'Byte-for-byte round trip, Markdown ↔ AST'],
  },
  {
    id: 'docstream-editor', name: 'Docstream Editor', npm: '@brett_lamy/ui/docstream-editor', partOf: 'ui', category: 'content', status: 'live', icon: 'square-pencil', docs: 'docstream-editor',
    formerly: [{ npm: '@brett_lamy/docstream-editor', last: '2.0.1' }],
    tagline: 'A WYSIWYG editor for docstream Markdown.',
    description: 'Tiptap-based editing of every docstream block — tables, tabs, hints, demos, embeds, math — with a slash menu, Markdown paste, file drops and a byte-stable round trip back to Markdown. MarkdownEditor and the Composer are built on it. Part of @brett_lamy/ui since 6.0, so it can no longer drift from the docstream it edits: import it from `@brett_lamy/ui/docstream-editor`.',
    dependsOn: ['docstream'], external: ['@tiptap/*'],
    modules: ['docstream-editor/'],
    highlights: ['Edit what docstream renders, and save the same Markdown', 'Slash menu, paste, drag-and-drop files', 'Source-file editing for demos'],
  },
  {
    id: 'markdown', name: 'Markdown', npm: '@brett_lamy/ui/markdown', partOf: 'ui', entry: 'markdown', category: 'content', status: 'new', icon: 'doc-text',
    tagline: 'MarkdownView and MarkdownEditor: docstream as two kit components.',
    description: 'The short way to docstream: MarkdownView renders Markdown (and a streaming answer) with the kit\'s look, MarkdownEditor edits it in place with the kit\'s toolbar, and both take the kit\'s prop spellings. Two of docstream\'s fences also stand on their own here: StlViewer for 3D models and TuiPreview for terminal apps. Reach for Docstream itself when you need its blocks, DocsSite or the AST.',
    dependsOn: ['ui', 'docstream', 'docstream-editor'],
    modules: ['components/markdown-view.tsx', 'components/markdown-editor.tsx', 'components/stl-viewer.tsx', 'components/tui-preview.tsx'],
    highlights: ['`<MarkdownView streaming>` for AI answers', '`<MarkdownEditor>` with a byte-stable round trip', 'StlViewer and TuiPreview outside a document'],
  },
  {
    id: 'composer', name: 'Composer', npm: '@brett_lamy/ui/composer', partOf: 'ui', entry: 'composer', category: 'content', status: 'new', icon: 'bubble',
    tagline: 'The chat surfaces: prompt box, transcript and the chat beside an artifact.',
    description: 'Composer, the prompt box as parts (card, editor, attachments, pills, compact and floating), with Conversation, MessageScroller and ArtifactChatContainer (docked, or floating on a FloatingSheet): everything a chat UI needs around a model, none of the model.',
    dependsOn: ['ui', 'canvas', 'markdown'],
    modules: ['components/composer/', 'components/conversation.tsx', 'components/message-scroller.tsx', 'components/artifact-chat-container.tsx', 'lib/message-scroller-context.ts', 'lib/message-scroller-primitive.ts'],
    highlights: ['A prompt box you assemble from parts', 'Transcripts that stay at the bottom while streaming', 'Docked or floating chat beside any artifact'],
  },
  {
    id: 'replay', name: 'Replay', npm: '@brett_lamy/ui/replay', partOf: 'ui', entry: 'replay', category: 'content', status: 'new', icon: 'play-rectangle',
    tagline: 'Record a session in the page, and play it back with DevTools.',
    description: 'The rrweb session recorder, which writes a recording to Sync\'s append-only streams so it can follow you to another device, and ReplayPreview, docstream\'s replay player as a component of its own: the page as it was, with a timeline, console, network and an element inspector.',
    dependsOn: ['docstream', 'sync'], external: ['rrweb'],
    modules: ['lib/session-recorder.ts', 'components/replay-preview.tsx'],
    highlights: ['Record with rrweb, one session per page load', 'ReplayPreview: timeline, console, network, inspector', 'Recordings sync across devices'],
  },

  /* ── Data & state ───────────────────────────────────────────────────────────────────────────── */
  {
    id: 'sql', name: 'SQL', npm: '@brett_lamy/ui/sql', partOf: 'ui', entry: 'sql', category: 'data', status: 'new', icon: 'table',
    tagline: 'A Postgres console for the browser.',
    description: 'SqlConsole — editor, results, schema tree, history, import and export — on PGlite. Its results and history are the core\'s DataTable and its schema is a Tree, so the library is the console itself.',
    dependsOn: ['ui', 'pglite'],
    modules: ['components/sql-console.tsx'],
    highlights: ['A full SQL console in one component', 'Typed result cells, CSV and JSON export', 'A schema browser on the database\'s own catalog'],
  },
  {
    id: 'pglite', name: 'PGlite', npm: '@brett_lamy/ui/pglite', partOf: 'ui', entry: 'pglite', category: 'data', status: 'new', icon: 'internaldrive',
    tagline: 'Postgres in the tab, as React hooks.',
    description: 'Headless hooks and helpers around PGlite (Postgres compiled to WebAssembly): open a persistent database, read its schema, import and export dumps and files, detect what storage the browser offers, split SQL into statements, and keep a database to one writing tab with a Web Lock. The schema reader names an icon per object kind, so it builds on Icons.',
    dependsOn: ['icons'], external: ['@electric-sql/pglite (optional peer)', '@electric-sql/pglite-tools (optional peer)'],
    modules: ['lib/pglite.tsx', 'lib/pglite-core.ts', 'lib/pglite-schema.ts', 'lib/pglite-files.ts', 'lib/pglite-transfer.ts', 'lib/pglite-storage.ts', 'lib/sql-lex.ts', 'lib/tab-lock.tsx'],
    highlights: ['`usePGlite` with IndexedDB or OPFS persistence', 'Dumps, archives and file import', 'No UI: bring your own, or use SQL'],
  },
  {
    id: 'filter', name: 'Filter', npm: '@brett_lamy/ui/filter', partOf: 'ui', entry: 'filter', category: 'data', status: 'new', icon: 'filter-circle',
    tagline: 'Filter bars, and filters you can type in plain English.',
    description: 'Filter — chips for fields, operators, dates and options on the kit\'s Toolbar — and FilterInput, which turns "open bugs from last week" into those chips with a small WebGPU model (gpu-query). The model never sees your field names: it reads a schema built from their labels and options.',
    dependsOn: ['ui'],
    modules: ['components/filter.tsx', 'components/filter-input.tsx', 'lib/filter-model.ts', 'lib/filter-query.ts', 'lib/gpu-query/'],
    highlights: ['Linear-style filter chips', 'Natural-language filters on a WebGPU model', 'A typed filter model you can serialize'],
  },
  {
    id: 'sync', name: 'Sync', npm: '@brett_lamy/ui/sync', partOf: 'ui', entry: 'sync', category: 'data', status: 'new', icon: 'cloud',
    tagline: 'Local-first state that survives reloads and follows you across devices.',
    description: 'usePersistentState for small settings, append-only local streams in the browser, and the Durable Streams client that mirrors them to a server and reads other devices\' streams back. Off until a server URL is set: nothing leaves the browser by default.',
    dependsOn: [],
    modules: ['lib/persistent-state.ts', 'lib/append-stream.ts', 'lib/durable-streams.ts'],
    showcase: { pages: ['hooks-state'] },
    highlights: ['`usePersistentState`, typed and versioned', 'Append-only local streams', 'Cloud sync on Durable Streams'],
  },

  /* ── Sandboxing ─────────────────────────────────────────────────────────────────────────────────
     Two ways to run code a person or a model wrote, in the tab. The names say which to reach for: Sandbox is the
     default for almost everyone; Linux VM is the heavy, experimental one for what Sandbox cannot do. Both are clients:
     the package carries the API, and the runtime (megabytes to gigabytes) is fetched when one starts, never part of
     the npm tarball. Sandbox ships in 6.0 (`lib/sandbox`, whose model is the interface the VM implements later);
     Linux VM is planned. */
  {
    id: 'sandbox', name: 'Sandbox', npm: '@brett_lamy/ui/sandbox', partOf: 'ui', entry: 'sandbox', category: 'sandboxing', status: 'new', icon: 'shield',
    tagline: 'Run Node-compatible code, a shell and npm in a Worker with an origin of its own. Light, and the one to start with.',
    description: 'The lightweight sandbox: a Node-compatible runtime in the browser (our fork of almostnode, BLamy/almostnode, published as `@agent-wasm/core`) with a virtual disk, a shell and npm installs. The code runs in a Worker with an origin of its own, so it has no DOM, cookies or localStorage and the browser refuses it the page\'s IndexedDB and caches; `sandbox.isolation` says what it got, and it never falls back to the page\'s origin unless you allow it. Almost everyone should use this one. The package carries the client only: `createSandbox` and `useSandbox` for the page, which load nothing, and `serveSandbox` for the two-line Worker your bundler builds with the runtime, an optional peer. Not in this version: dev-server previews, and a runtime served as files instead of installed.',
    dependsOn: [], external: ['@agent-wasm/core (optional peer)'],
    modules: ['lib/sandbox/'],
    highlights: ['JavaScript, npm packages and a shell, on a virtual disk', 'Isolated: an origin of its own, no access to the page or its storage', 'A few kilobytes on the page; the runtime loads in the Worker, on start', 'The default: reach for Linux VM only when this cannot do the job'],
  },
  {
    id: 'linux-vm', name: 'Linux VM', npm: '@brett_lamy/ui/linux-vm', partOf: 'ui', category: 'sandboxing', status: 'planned', icon: 'cube',
    tagline: 'A whole Linux computer in the tab. Heavy, slow and experimental: for what Sandbox cannot do.',
    description: 'A RISC-V machine emulated in WebAssembly (BLamy/wasm-vm) that boots a real Linux kernel: BusyBox, Alpine, native binaries, compilers, container images. Use it only when Sandbox cannot do the job, because it costs a great deal more: it downloads from about 40 MB to several hundred, runs programs many times slower than native, has no preview URLs yet, and is not optimized. It will share Sandbox\'s API (`createLinuxVM` gives the same files and `run`), so an app can start on Sandbox and move by changing an import.',
    dependsOn: ['sandbox'],
    highlights: ['A real kernel: native binaries, `apk` packages, compilers', 'Same API as Sandbox: files, run, dispose', 'Heavy: tens to hundreds of megabytes, far slower than native', 'Experimental: not optimized, no previews yet'],
  },

  /* ── Platform & tooling ─────────────────────────────────────────────────────────────────────── */
  {
    id: 'vault', name: 'Vault', npm: '@brett_lamy/ui/vault', partOf: 'ui', entry: 'vault', category: 'platform', status: 'new', icon: 'passkey',
    tagline: 'Passkey-locked, end-to-end encrypted storage.',
    description: 'A vault whose key never leaves a passkey (WebAuthn PRF): encrypt and store secrets in the browser, unlock with Face ID or Touch ID, and gate any screen behind it with VaultGate, which carries its own enrollment flow.',
    dependsOn: ['ui'],
    modules: ['lib/vault.ts', 'lib/vault-storage.ts', 'lib/vault-react.tsx', 'lib/passkey.ts', 'components/vault-gate.tsx'],
    showcase: { pages: ['passkey-vault', 'env-variables'] },
    highlights: ['Keys derived from a passkey, never stored', 'VaultGate locks any subtree', 'Works offline'],
  },
  {
    id: 'tailscale', name: 'Tailscale', npm: '@brett_lamy/ui/tailscale', partOf: 'ui', entry: 'tailscale', category: 'platform', status: 'new', icon: 'vpn',
    tagline: 'Reach your tailnet from a web page.',
    description: 'Join a tailnet from the browser (Tailscale compiled to WebAssembly), fetch from tailnet hosts, pick an exit node, and route a page\'s requests through a service worker — with the login and tailnet controls and an in-memory fake for tests.',
    dependsOn: ['ui'], external: ['@agent-wasm/tailscale-connect (optional peer)'],
    modules: ['lib/tailscale*', 'components/tailscale-controls.tsx'],
    highlights: ['`fetch` to tailnet hosts from a tab', 'A service-worker router for whole pages', 'A fake tailnet for tests'],
  },
  {
    id: 'opencode', name: 'OpenCode', npm: '@brett_lamy/ui/opencode', partOf: 'ui', category: 'platform', status: 'new', icon: 'terminal',
    tagline: 'The OpenCode agent, running in the page.',
    description: 'OpenCode in a component: its runtime in the browser (almost-node or agent-wasm), a preview of what it builds, and provider keys kept in a passkey Vault. The runtime is large and loads only when the component mounts; the component alone is also `@brett_lamy/ui/open-code`.',
    dependsOn: ['ui', 'vault'],
    modules: ['components/open-code.tsx', 'lib/open-code-*', 'opencode.ts'],
    highlights: ['A coding agent with no server of its own', 'Live preview of the app it writes', 'Keys locked behind a passkey'],
  },
];

export const LIBRARY: Record<string, Library> = Object.fromEntries(LIBRARIES.map((l) => [l.id, l]));
export const byCategory = (c: Category) => LIBRARIES.filter((l) => l.category === c);
export const libraryRoute = (l: Library) => `libraries/${l.id}`;
const CATEGORY = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<Category, (typeof CATEGORIES)[number]>;
export const categoryOf = (l: Library) => CATEGORY[l.category];

/** The npm package a library ships in: its own, or its `partOf` library's. */
export const packageOf = (l: Library): Library => (l.partOf ? LIBRARY[l.partOf] : l);
/** Every npm package name the plan publishes (subpath entries aside): one, the core's. */
export const packageNames = (l: Library): string[] => (l.partOf ? [] : [l.npm]);

/** Does a module pattern (`lib/diagram-*`, `components/composer/`, `cloudflare.ts`) take this unit? */
export const takes = (pattern: string, unit: string) => (pattern.endsWith('*') ? unit.startsWith(pattern.slice(0, -1)) : unit === pattern);
/** The library a unit of packages/ui/src belongs to: the one that lists it, else the core. */
export const ownerOf = (unit: string): Library => LIBRARIES.find((l) => l.modules?.some((m) => takes(m, unit))) ?? LIBRARY.ui;

/** Every library a library builds on, directly or through others. */
export function reach(id: string, seen = new Set<string>()): Set<string> {
  for (const dep of LIBRARY[id]?.dependsOn ?? []) if (!seen.has(dep)) { seen.add(dep); reach(dep, seen); }
  return seen;
}

/** Imports that go against the layering, each loaded lazily, so the library below still works without the one above:
    docstream sits under the core, and three of its fences draw with parts of Diagram, which sits over it. In one
    package nothing has to be installed for them; the fence's module graph just grows when a document uses one. */
export const LAYER_EXCEPTIONS: Array<{ unit: string; imports: string; why: string }> = [
  {
    unit: 'docstream/', imports: '@brett_lamy/ui/cloudflare',
    why: 'Docstream\'s capnp fence draws a workerd config with CloudflareDiagram, which it loads lazily from `@brett_lamy/ui/cloudflare` when the first capnp fence shows. Until it has loaded, and if it cannot, the fence shows the config\'s source.',
  },
  {
    unit: 'docstream/', imports: '@brett_lamy/ui/lib/state-diagram-source',
    why: 'Docstream\'s xstate fence writes its text form (the Mermaid statechart it shows where the diagram can\'t load) from a machine read by the kit\'s `parseXState`, so the fence and StateDiagram read a machine one way, in a module (`xstate/machine`) the fence loads lazily (Babel only, no ELK).',
  },
  {
    unit: 'docstream/', imports: '@brett_lamy/ui/lib/state-diagram-model',
    why: 'Docstream\'s xstate fence writes its text form from the kit\'s `machineToDraft`, so the fence and StateDiagram label a machine one way, in the same lazily loaded module (no React, no ELK).',
  },
  {
    unit: 'docstream/', imports: '@brett_lamy/ui/state-diagram',
    why: 'Docstream\'s xstate fence draws a machine with the kit\'s StateDiagram, read-only, which it loads lazily from `@brett_lamy/ui/state-diagram` when the first fence shows. Without it the fence shows its text form, or the machine\'s source when that can\'t load either.',
  },
];
