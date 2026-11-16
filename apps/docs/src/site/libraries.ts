/* The BL libraries — the ones on npm today and the ones @brett_lamy/ui splits into. This manifest is the single source
   for the site's Libraries menu, the library pages and the plan's package and module maps. `modules` lists the files
   (relative to packages/ui/src) that move into a planned package; libraries.test.ts checks that every module in ui
   has exactly one home and that no package would import from a package it doesn't depend on. */
import type { IconName } from '@/lib/icon';

export type Category = 'foundation' | 'ui' | 'content' | 'data' | 'platform';
/** `live`: published and documented here. `planned`: its code is in @brett_lamy/ui today and moves out in the split. */
export type Status = 'live' | 'planned';

export interface Library {
  id: string;
  name: string;
  npm: string;
  category: Category;
  status: Status;
  icon: IconName;
  tagline: string;
  description: string;
  /** The docs' route (`#/<docs>`), for live libraries. */
  docs?: string;
  /** Libraries it builds on (ids). */
  dependsOn: string[];
  /** npm packages it brings (beyond react). */
  external?: string[];
  /** For planned libraries: the modules that move here from packages/ui/src. */
  modules?: string[];
  /** What it's for, in a few lines. */
  highlights: string[];
}

export const CATEGORIES: Array<{ id: Category; label: string; tone: string }> = [
  { id: 'foundation', label: 'Foundation', tone: 'green' },
  { id: 'ui', label: 'UI', tone: 'blue' },
  { id: 'content', label: 'Content & AI', tone: 'orange' },
  { id: 'data', label: 'Data & state', tone: 'red' },
  { id: 'platform', label: 'Platform & tooling', tone: 'yellow' },
];

export const LIBRARIES: Library[] = [
  /* ── Foundation ─────────────────────────────────────────────────────────────────────────────── */
  {
    id: 'tokens', name: 'Tokens', npm: '@brett_lamy/tokens', category: 'foundation', status: 'planned', icon: 'drop',
    tagline: 'Design tokens, themes and the class helpers everything else uses.',
    description: 'The single source of color, type, radius, shadow and spring timing: tokens.css generates its TypeScript twin, theme.css maps it onto Tailwind v4, and ThemeScope / AppearanceProvider retint any subtree. The token generator and the literal-color lint ship as a CLI, so an app can hold its own styles to the same rules.',
    dependsOn: [], external: ['clsx', 'tailwind-merge'],
    modules: ['lib/tokens.generated.ts', 'lib/utils.ts', 'lib/theme.tsx', 'components/workbench-theme.tsx'],
    highlights: ['tokens.css → tokens.generated.ts, one source of truth', 'BLProvider, AppearanceProvider, ThemeScope and tint variables', '`cn`, the type scale and press helpers', 'A CLI: build the tokens, lint for stray literals'],
  },
  {
    id: 'icons', name: 'Icons', npm: '@brett_lamy/icons', category: 'foundation', status: 'planned', icon: 'star',
    tagline: 'An SF Symbols–style icon set as typed React components.',
    description: 'Every glyph the library draws, as one `<Icon name>` component with weights, aliases, categories and search keywords — plus the chat, PencilKit and workbench shape sets. Tree-shakes to the icons you name.',
    dependsOn: ['tokens'],
    modules: ['lib/icon.tsx', 'lib/icon-shapes/'],
    highlights: ['`<Icon name="paperplane" weight="semibold" />`', 'Aliases, categories and keywords for pickers and search', 'Chat, PencilKit and workbench shape sets'],
  },
  {
    id: 'motion', name: 'Motion', npm: '@brett_lamy/motion', category: 'foundation', status: 'planned', icon: 'pulse',
    tagline: 'iOS springs, morphs and the gestures that drive them.',
    description: 'The springs every transition uses, FLIP helpers and reduced-motion handling, the morphing primitives (TextMorph, NumberMorph, IconSwap, Morph, AnimatedHeight) and the gesture hooks behind sheets and stacks: edge swipe, drawer swipe, sheet drag, pull to refresh and the large-title flight.',
    dependsOn: ['tokens', 'icons'], external: ['framer-motion'],
    modules: [
      'lib/motion.ts', 'lib/morph-path.ts', 'lib/title-flight.ts', 'lib/sheet-drag.ts', 'lib/edge-swipe.ts', 'lib/drawer-swipe.ts', 'lib/pull-to-refresh.ts',
      'components/text-morph.tsx', 'components/number-morph.tsx', 'components/icon-swap.tsx', 'components/animated-height.tsx', 'components/morph.tsx', 'components/celebrate.tsx',
    ],
    highlights: ['`springs` and `useSpringTransition`, matched to UIKit', 'TextMorph, NumberMorph, IconSwap, Morph, AnimatedHeight', 'Edge swipe, sheet drag, pull to refresh, title flight', 'Reduced motion respected everywhere'],
  },

  /* ── UI ─────────────────────────────────────────────────────────────────────────────────────── */
  {
    id: 'ui', name: 'UI', npm: '@brett_lamy/ui', category: 'ui', status: 'live', icon: 'grid', docs: 'introduction',
    tagline: 'iOS-flavored components on React Aria, Tailwind v4 and cva.',
    description: 'The core: accessible primitives (Button, Dialog, Select, Tabs, Menus, fields, pickers) and the containers that make an app feel native — NavigationStack, SplitView, TabView, List, Sheet, Credenza, SideDrawer, Sidebar, CommandMenu, Toast. Copy the source with the shadcn registry, or install the package. After the split it keeps only this core; everything else moves to the libraries beside it.',
    dependsOn: ['tokens', 'icons', 'motion'], external: ['react-aria-components', 'react-aria', 'class-variance-authority', '@pierre/trees'],
    highlights: ['NavigationStack, SplitView, TabView, List, Sheet, Credenza', 'Every primitive on React Aria: keyboard, focus and screen readers', 'cva variants and CSS-variable themes', 'Install from npm, or copy the source with the shadcn registry'],
  },
  {
    id: 'time', name: 'Time', npm: '@brett_lamy/time', category: 'ui', status: 'planned', icon: 'calendar',
    tagline: 'Dates, times and schedules — calendars, pickers and a cron editor.',
    description: 'Calendar and RangeCalendar, DateField, TimeField and the date pickers on @internationalized/date, plus TimeInput, which reads schedules written in plain English ("every weekday at 9am"), and CronEditor — both on small in-browser parsers (gpu-time, gpu-cron).',
    dependsOn: ['ui'], external: ['@internationalized/date', 'gpu-time', 'gpu-cron', 'cronstrue'],
    modules: ['components/calendar.tsx', 'components/date-field.tsx', 'components/date-picker.tsx', 'components/time-input.tsx', 'components/cron-editor.tsx', 'lib/gpu-time.ts', 'lib/gpu-cron.ts', 'lib/cron.ts'],
    highlights: ['Calendar, RangeCalendar, DatePicker, DateRangePicker', 'TimeInput: "every weekday at 9am" → occurrences and an RRULE', 'CronEditor with next runs and plain-English descriptions'],
  },
  {
    id: 'canvas', name: 'Canvas', npm: '@brett_lamy/canvas', category: 'ui', status: 'planned', icon: 'pencil-tip',
    tagline: 'An infinite board and PencilKit drawing.',
    description: 'Canvas — a pannable, zoomable board with frames, handles, marquee selection, snapping guides and the geometry behind them — and PencilKit: pressure-aware ink, the tool palette, undo history and an annotator for images and screenshots.',
    dependsOn: ['ui'], external: ['perfect-freehand'],
    modules: ['components/canvas.tsx', 'lib/canvas-math.ts', 'components/pencilkit/'],
    highlights: ['Pan, zoom, select, resize, rotate, snap', 'PencilKit ink with the iPadOS tool palette', 'Annotate any image'],
  },
  {
    id: 'media', name: 'Media', npm: '@brett_lamy/media', category: 'ui', status: 'planned', icon: 'video',
    tagline: 'Video, audio and session recording in the browser.',
    description: 'VideoPreview and a multi-track VideoTimeline with an FFmpeg (WebAssembly) renderer, Waveform, Filmstrip and NowPlayingBars, and the rrweb session recorder whose recordings docstream\'s replay player plays back.',
    dependsOn: ['ui', 'sync'], external: ['rrweb'],
    modules: [
      'components/video-preview.tsx', 'components/video-timeline.tsx', 'components/waveform.tsx', 'components/filmstrip.tsx', 'components/now-playing-bars.tsx',
      'lib/playback.ts', 'lib/video-timeline.ts', 'lib/video-render.ts', 'lib/ffmpeg/', 'lib/session-recorder.ts',
    ],
    highlights: ['A timeline editor that renders with FFmpeg in a worker', 'Waveforms and filmstrips from any media file', 'Record sessions with rrweb, replay them in docstream'],
  },

  /* ── Content & AI ───────────────────────────────────────────────────────────────────────────── */
  {
    id: 'docstream', name: 'Docstream', npm: '@brett_lamy/docstream', category: 'content', status: 'live', icon: 'doc-text', docs: 'docstream',
    tagline: 'GitBook-flavored Markdown that renders while it streams.',
    description: 'A Markdown renderer for docs and AI answers: GitBook blocks (hints, tabs, steppers, cards), live React demos backed by real files, math, diagrams, OpenAPI operations, citations, embeds, session replays and 3D models — and DocsSite, which turns a folder of Markdown into a site like this one.',
    dependsOn: [], external: ['katex', 'pele', 'yaml', 'rrweb', '@strudel/web', 'lucide-react'],
    highlights: ['Streams safely: unfinished blocks render as they arrive', 'Live demos from real files, in an in-browser Vite', 'DocsSite: a GitBook-style site from a folder of Markdown', 'Byte-for-byte round trip, Markdown ↔ AST'],
  },
  {
    id: 'docstream-editor', name: 'Editor', npm: '@brett_lamy/docstream-editor', category: 'content', status: 'live', icon: 'square-pencil', docs: 'docstream-editor',
    tagline: 'A WYSIWYG editor for docstream Markdown.',
    description: 'Tiptap-based editing of every docstream block — tables, tabs, hints, demos, embeds, math — with a slash menu, Markdown paste, file drops and a byte-stable round trip back to Markdown. Released in lockstep with docstream.',
    dependsOn: ['docstream'], external: ['@tiptap/*'],
    highlights: ['Edit what docstream renders, and save the same Markdown', 'Slash menu, paste, drag-and-drop files', 'Source-file editing for demos'],
  },
  {
    id: 'markdown', name: 'Markdown', npm: '@brett_lamy/markdown', category: 'content', status: 'planned', icon: 'textformat',
    tagline: 'Docstream and its editor, dressed in the BL theme.',
    description: 'MarkdownView and MarkdownEditor: docstream\'s renderer and editor wired to the BL tokens, with reference chips, a slash menu, Markdown paste and inline images. Moving them here takes docstream (and Tiptap) out of the core package\'s dependencies.',
    dependsOn: ['tokens', 'docstream', 'docstream-editor'],
    modules: ['components/markdown-view.tsx', 'components/markdown-editor.tsx'],
    highlights: ['Themed Markdown in one component', 'A WYSIWYG editor that saves Markdown', 'Keeps docstream out of @brett_lamy/ui'],
  },
  {
    id: 'composer', name: 'Composer', npm: '@brett_lamy/composer', category: 'content', status: 'planned', icon: 'bubble',
    tagline: 'The chat surfaces: prompt box, transcript and floating chat.',
    description: 'Composer — the prompt box as parts (card, editor, attachments, pills, bumps, compact and FAB collapse) — with ChatColumn, Conversation, MessageScroller, FloatingChat and ArtifactChatContainer: everything a chat UI needs around a model, none of the model.',
    dependsOn: ['ui', 'canvas', 'markdown', 'docstream-editor'],
    modules: [
      'components/composer/', 'components/chat-column.tsx', 'components/conversation.tsx', 'components/message-scroller.tsx', 'components/floating-chat.tsx',
      'components/artifact-chat-container.tsx', 'lib/persistent-host.tsx',
    ],
    highlights: ['A prompt box you assemble from parts', 'Transcripts that stick to the bottom while streaming', 'Floating and docked chat beside any artifact'],
  },

  /* ── Data & state ───────────────────────────────────────────────────────────────────────────── */
  {
    id: 'sql', name: 'SQL', npm: '@brett_lamy/sql', category: 'data', status: 'planned', icon: 'table',
    tagline: 'A Postgres console for the browser.',
    description: 'SqlConsole — editor, results, schema tree, import and export — on PGlite, plus its parts: SqlEditor with highlighting and statement splitting, ResultTable with typed cells and CSV / JSON export, SchemaTree.',
    dependsOn: ['ui', 'pglite'],
    modules: ['components/sql-console.tsx', 'components/sql-editor.tsx', 'components/result-table.tsx', 'components/schema-tree.tsx', 'lib/sql-format.ts'],
    highlights: ['A full SQL console in one component', 'Typed result cells, CSV and JSON export', 'Schema browser on the database\'s own catalog'],
  },
  {
    id: 'pglite', name: 'PGlite', npm: '@brett_lamy/pglite', category: 'data', status: 'planned', icon: 'internaldrive',
    tagline: 'Postgres in the tab, as React hooks.',
    description: 'Headless hooks and helpers around PGlite (Postgres compiled to WebAssembly): open a persistent database, read its schema, import and export dumps and files, detect what storage the browser offers, split SQL into statements, and keep a database to one writing tab with a Web Lock.',
    dependsOn: [], external: ['@electric-sql/pglite (peer)'],
    modules: ['lib/pglite.tsx', 'lib/pglite-core.ts', 'lib/pglite-schema.ts', 'lib/pglite-files.ts', 'lib/pglite-transfer.ts', 'lib/pglite-storage.ts', 'lib/sql-lex.ts', 'lib/tab-lock.tsx'],
    highlights: ['`usePGlite` with IndexedDB or OPFS persistence', 'Dumps, archives and file import', 'No UI: bring your own, or use SQL'],
  },
  {
    id: 'filter', name: 'Filter', npm: '@brett_lamy/filter', category: 'data', status: 'planned', icon: 'filter-circle',
    tagline: 'Filter bars, and filters you can type in plain English.',
    description: 'Filter — chips for fields, operators, dates and options — and FilterInput, which turns "open bugs from last week" into those chips with a small WebGPU model (gpu-query). The model never sees your field names: it reads a schema built from their labels and options.',
    dependsOn: ['ui'],
    modules: ['components/filter.tsx', 'components/filter-input.tsx', 'lib/filter.ts', 'lib/filter-query.ts', 'lib/gpu-query/'],
    highlights: ['Linear-style filter chips', 'Natural-language filters on a WebGPU model', 'A typed filter model you can serialize'],
  },
  {
    id: 'sync', name: 'Sync', npm: '@brett_lamy/sync', category: 'data', status: 'planned', icon: 'cloud',
    tagline: 'Local-first state that survives reloads and follows you across devices.',
    description: 'usePersistentState for small settings, LocalStreams — append-only logs in the browser — and the Durable Streams client that mirrors them to a server and reads other devices\' streams back. Off until a server URL is set: nothing leaves the browser by default.',
    dependsOn: [],
    modules: ['lib/persistent-state.ts', 'lib/append-stream.ts', 'lib/durable-streams.ts'],
    highlights: ['`usePersistentState`, typed and versioned', 'Append-only local streams', 'Cloud sync on Durable Streams'],
  },

  /* ── Platform & tooling ─────────────────────────────────────────────────────────────────────── */
  {
    id: 'vault', name: 'Vault', npm: '@brett_lamy/vault', category: 'platform', status: 'planned', icon: 'passkey',
    tagline: 'Passkey-locked, end-to-end encrypted storage.',
    description: 'A vault whose key never leaves a passkey (WebAuthn PRF): encrypt and store secrets in the browser, unlock with Face ID or Touch ID, and gate any screen behind it with VaultGate and the enrollment dialog.',
    dependsOn: ['ui'],
    modules: ['lib/vault.ts', 'lib/vault-storage.ts', 'lib/vault-react.tsx', 'lib/passkey.ts', 'components/vault-gate.tsx', 'components/passkey-enroll-dialog.tsx'],
    highlights: ['Keys derived from a passkey, never stored', 'VaultGate locks any subtree', 'Works offline'],
  },
  {
    id: 'tailscale', name: 'Tailscale', npm: '@brett_lamy/tailscale', category: 'platform', status: 'planned', icon: 'network',
    tagline: 'Reach your tailnet from a web page.',
    description: 'Join a tailnet from the browser (Tailscale compiled to WebAssembly), fetch from tailnet hosts, pick an exit node, and route a page\'s requests through a service worker — with a login button, a tailnet menu and an in-memory fake for tests.',
    dependsOn: ['ui'], external: ['@agent-wasm/tailscale-connect (peer)'],
    modules: [
      'lib/tailscale.ts', 'lib/tailscale-policy.ts', 'lib/tailscale-exit.ts', 'lib/tailscale-connect.ts', 'lib/tailscale-react.tsx', 'lib/tailscale-fake.ts', 'lib/tailscale-router/',
      'components/tailscale-login-button.tsx', 'components/tailscale-menu.tsx',
    ],
    highlights: ['`fetch` to tailnet hosts from a tab', 'A service-worker router for whole pages', 'A fake tailnet for tests'],
  },
  {
    id: 'registry', name: 'Registry', npm: '@brett_lamy/registry', category: 'platform', status: 'planned', icon: 'cube',
    tagline: 'Turn a component library into a shadcn registry.',
    description: 'The build behind blamy.github.io/ui/r: one registry item per module, dependencies computed from real imports, theme items generated from your tokens — as a CLI for any library that imports itself through aliases. The app blocks stay a private, registry-only package.',
    dependsOn: [], external: ['typescript'],
    highlights: ['One item per module, dependencies from imports', 'Theme items from your tokens', '`--check` for CI'],
  },
];

export const LIBRARY: Record<string, Library> = Object.fromEntries(LIBRARIES.map((l) => [l.id, l]));
export const byCategory = (c: Category) => LIBRARIES.filter((l) => l.category === c);
export const libraryRoute = (l: Library) => `libraries/${l.id}`;

/** Code changes the split needs beyond moving files (each one an import the layering would otherwise forbid). */
export const SPLIT_CHANGES: Array<{ unit: string; imports: string; change: string }> = [
  {
    unit: 'components/pencilkit/', imports: '@/components/ui/composer/annotator',
    change: 'PencilKitAnnotator implements the composer\'s annotator contract, and imports its props type from there. The contract (`ComposerAnnotatorProps`) moves into Canvas as `AnnotatorProps`; Composer re-exports it under its old name.',
  },
];

/** The repo's docstream re-export shims, which the split removes: import these from docstream directly. */
export const REMOVED_SHIMS = ['components/replay-preview.tsx', 'components/stl-viewer.tsx', 'components/strudel-player.tsx', 'components/strudel-rack.tsx', 'components/strudel-syntax.tsx'];
