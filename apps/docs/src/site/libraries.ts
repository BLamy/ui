/* The BL libraries: what is on npm today, and what @brett_lamy/ui splits into. This manifest is the single source for
   the site's Libraries menu, the library pages, the roadmap's package and module maps, and the release placeholders
   (tools/release/placeholders.mjs). `modules` lists the units of packages/ui/src that move into a planned package;
   libraries.test.ts checks the plan against the real imports: every unit has exactly one home, no library imports
   from one it doesn't build on, and no two npm packages would need each other.

   Since 2026-11-16 docstream and docstream-editor are part of @brett_lamy/ui (the owner's decision): they ship as the
   library's entries (`@brett_lamy/ui/docstream/<entry>`, `@brett_lamy/ui/docstream-editor/<entry>`), and their own npm
   packages stop at 2.0.1. They stay libraries here, with their own docs, because they are one: the core never needs
   them to draw a button, and they never import the core.

   Node reads this file too (type stripping), so it holds only erasable TypeScript: no enums, type-only imports. */
import type { IconName } from '@/lib/icon';

export type Category = 'foundation' | 'ui' | 'content' | 'data' | 'platform';
/** `live`: on npm — a package of its own, or entries of one (`partOf`). `new`: published for the first time with 6.0.
    `planned`: its code is in @brett_lamy/ui today, and gets a package of its own in the split. */
export type Status = 'live' | 'new' | 'planned';

export const STATUS_LABEL: Record<Status, string> = { live: 'On npm', new: 'New in 6.0', planned: 'Planned' };

export interface Library {
  id: string;
  name: string;
  /** What an app imports: the package, or for a library that ships inside another, its entry. */
  npm: string;
  category: Category;
  status: Status;
  icon: IconName;
  tagline: string;
  description: string;
  /** The library whose npm package carries this one (docstream ships in `ui`). */
  partOf?: string;
  /** The npm packages it publishes, when that's more than `npm` (the UI SDK wrappers are two). */
  packages?: string[];
  /** Packages this library used to be published as, frozen at their last version. */
  formerly?: Array<{ npm: string; last: string }>;
  /** The docs' route (`#/<docs>`), for libraries with docs. */
  docs?: string;
  /** Libraries it builds on (ids). */
  dependsOn: string[];
  /** npm packages it brings (beyond react). */
  external?: string[];
  /** For planned libraries: the units of packages/ui/src that move here. A trailing `*` takes every unit that starts
      with what comes before it (`lib/diagram-*`). */
  modules?: string[];
  /** What it's for, in a few lines. */
  highlights: string[];
}

/** Categories, each with a chart color token (`chart-1` … `chart-5`) that marks its libraries. */
export const CATEGORIES: Array<{ id: Category; label: string; tone: 1 | 2 | 3 | 4 | 5 }> = [
  { id: 'foundation', label: 'Foundation', tone: 2 },
  { id: 'ui', label: 'UI', tone: 1 },
  { id: 'content', label: 'Content & AI', tone: 3 },
  { id: 'data', label: 'Data & state', tone: 4 },
  { id: 'platform', label: 'Platform & tooling', tone: 5 },
];

export const LIBRARIES: Library[] = [
  /* ── Foundation ─────────────────────────────────────────────────────────────────────────────── */
  {
    id: 'ui-sdk', name: 'UI SDK', npm: '@brett_lamy/ui-sdk-react', category: 'foundation', status: 'new', icon: 'layers',
    packages: ['@brett_lamy/ui-sdk-core', '@brett_lamy/ui-sdk-react'],
    tagline: 'The behavior layer: our fork of UI SDK, as two packages.',
    description: 'Every interactive part of the kit is a UI SDK part: keyboard, focus, selection, dismissal, popups, drag and drop and ARIA come from it. We build our fork (vendor/ui-sdk, upstream plus layer hosts, `bindLayer`\'s `when` and an exported `SlotProps`) into @brett_lamy/ui-sdk-core and @brett_lamy/ui-sdk-react, and import them under upstream\'s names, `@ui-sdk/core` and `@ui-sdk/react`, through npm aliases. They publish with @brett_lamy/ui 6.0, which depends on them.',
    dependsOn: [],
    highlights: ['`@ui-sdk/react/<part>`: Dialog, Menu, Select, Tabs, Toolbar, Tree…', 'Layer hosts: popups that stay inside a framed app', 'Upstream\'s API, three small additions, nothing else'],
  },
  {
    id: 'tokens', name: 'Tokens', npm: '@brett_lamy/tokens', category: 'foundation', status: 'planned', icon: 'drop',
    tagline: 'Design tokens, themes, size classes and the class helpers everything else uses.',
    description: 'The single source of color, type, radius, shadow and spring timing: tokens.css generates its TypeScript twin, the bl-theme maps it onto Tailwind v4, and BLProvider, ThemeScope and `appearance` retint any subtree. The size-class scope (`compact` / `medium` / `regular`, measured on a container, never the viewport) lives here too, because the providers are what measure it.',
    dependsOn: ['ui-sdk'], external: ['clsx', 'tailwind-merge', 'class-variance-authority'],
    modules: ['lib/tokens.generated.ts', 'lib/utils.ts', 'lib/theme.tsx', 'lib/theme-context.tsx', 'lib/primitives.ts', 'lib/size-class.ts', 'lib/container.ts'],
    highlights: ['tokens.css → tokens.generated.ts, one source of truth', 'BLProvider, ThemeScope, `appearance` and `tint`', 'Size classes from a container\'s own box', '`cn`, `cx` and the shared focus and surface recipes'],
  },
  {
    id: 'motion', name: 'Motion', npm: '@brett_lamy/motion', category: 'foundation', status: 'planned', icon: 'pulse',
    tagline: 'iOS springs, morphs, presence and the gestures that drive them.',
    description: 'The springs every transition uses and reduced-motion handling, presence (exit animations that finish before unmount), the morphing parts (TextMorph, NumberMorph, Morph, AnimatedHeight, Swap, Celebrate) and the gestures behind sheets and stacks: edge swipe, pull to refresh and the large-title flight.',
    dependsOn: ['tokens'], external: ['framer-motion'],
    modules: [
      'lib/motion.ts', 'lib/reduced-motion.ts', 'lib/presence.ts', 'lib/morph-path.ts', 'lib/title-flight.ts', 'lib/edge-swipe.ts', 'lib/pull-to-refresh.ts',
      'components/text-morph.tsx', 'components/number-morph.tsx', 'components/animated-height.tsx', 'components/morph.tsx', 'components/celebrate.tsx', 'components/swap.tsx',
    ],
    highlights: ['Springs matched to UIKit, `motion-reduce` everywhere', 'TextMorph, NumberMorph, Morph, AnimatedHeight, Swap', 'Edge swipe, pull to refresh, title flight'],
  },
  {
    id: 'icons', name: 'Icons', npm: '@brett_lamy/icons', category: 'foundation', status: 'planned', icon: 'star',
    tagline: 'An SF Symbols–style icon set as typed React components.',
    description: 'Every glyph the kit draws, as one `<Icon name>` component with weights, aliases and search keywords, plus the chat, PencilKit and workbench shape sets and the file-type icons Tree uses. Icons animate between shapes, so they build on Motion.',
    dependsOn: ['tokens', 'motion'],
    modules: ['lib/icon.tsx', 'lib/icon-shapes/', 'lib/file-icons.tsx'],
    highlights: ['`<Icon name="paperplane" weight="semibold" />`', 'Aliases and keywords for pickers and search', 'File-type, folder and badge icons'],
  },

  /* ── UI ─────────────────────────────────────────────────────────────────────────────────────── */
  {
    id: 'ui', name: 'UI', npm: '@brett_lamy/ui', category: 'ui', status: 'live', icon: 'grid', docs: 'introduction',
    tagline: 'iOS-flavored components on UI SDK and Tailwind v4.',
    description: 'The core: controls, fields and pickers, the popups (Dialog with its views, Sheet, Popover, DropdownMenu, Select, Combobox, Toast) and the containers that make an app feel native — NavigationStack, SplitView, Tabs, AdaptivePane, Sidebar, List, Toolbar, DataTable — plus the workbench and debugging parts, and MarkdownView and MarkdownEditor on docstream. Every module is its own entry (`@brett_lamy/ui/dialog`) and its own shadcn registry item. After the split it keeps this core, with docstream and its editor; the libraries beside it take the rest.',
    dependsOn: ['ui-sdk', 'tokens', 'motion', 'icons', 'docstream', 'docstream-editor'],
    external: ['class-variance-authority', '@wterm/*', 'gpu-lexer', '@vscode/codicons'],
    highlights: ['NavigationStack, SplitView, Tabs, AdaptivePane, Sidebar, Dialog flows', 'One spelling per concept: `size`, `variant`, `tone`, `side`, `presentation`', 'Responsive by container: a sheet in a compact column, a popover in a wide one', 'Install from npm, or copy the source with the shadcn registry'],
  },
  {
    id: 'time', name: 'Time', npm: '@brett_lamy/time', category: 'ui', status: 'planned', icon: 'calendar',
    tagline: 'Dates, times and schedules: calendars, pickers and a cron editor.',
    description: 'Calendar, DateInput and DatePicker, NaturalTimeInput, which reads schedules written in plain English ("every weekday at 9am") and previews their next occurrences, and CronEditor, both on small in-browser parsers (gpu-time, gpu-cron).',
    dependsOn: ['ui'], external: ['gpu-time', 'gpu-cron', 'cronstrue'],
    modules: ['components/calendar.tsx', 'components/date-input.tsx', 'components/date-picker.tsx', 'components/natural-time-input.tsx', 'components/cron-editor.tsx', 'lib/calendar-months.ts', 'lib/gpu-time.ts', 'lib/gpu-cron.ts', 'lib/cron.ts', 'lib/schedule-preview.tsx'],
    highlights: ['Calendar, DateInput, DatePicker with ranges', 'NaturalTimeInput: "every weekday at 9am" → occurrences', 'CronEditor with next runs and plain-English descriptions'],
  },
  {
    id: 'canvas', name: 'Canvas', npm: '@brett_lamy/canvas', category: 'ui', status: 'planned', icon: 'pencil-tip',
    tagline: 'An infinite board and PencilKit drawing.',
    description: 'Canvas, a pannable, zoomable board with frames, handles, marquee selection, snapping guides and the geometry behind them, and PencilKit: pressure-aware ink, the tool palette, undo history and the annotator the Composer uses for images and screenshots.',
    dependsOn: ['ui'], external: ['perfect-freehand'],
    modules: ['components/canvas.tsx', 'lib/canvas-math.ts', 'lib/canvas-primitive.ts', 'components/pencilkit/'],
    highlights: ['Pan, zoom, select, resize, snap', 'PencilKit ink with the iPadOS tool palette', 'Annotate any image'],
  },
  {
    id: 'diagram', name: 'Diagram', npm: '@brett_lamy/diagram', category: 'ui', status: 'planned', icon: 'network',
    tagline: 'Diagrams you can edit, state machines you can run, and Cloudflare systems.',
    description: 'Diagram, an editable node-and-edge drawing on Canvas with automatic layout (elkjs) and keyboard editing; DiagramFrame, the editor chrome around it; StateDiagram, which draws an xstate machine, edits it and simulates it; and CloudflareDiagram with the Cloudflare catalog, which reads and writes wrangler and workerd configs. The catalog is about 150 KB, so it has an entry of its own (`@brett_lamy/ui/cloudflare` today).',
    dependsOn: ['ui', 'canvas'], external: ['elkjs', 'xstate', 'jsonc-parser'],
    modules: ['components/diagram*', 'components/state-diagram.tsx', 'components/cloudflare-diagram.tsx', 'lib/diagram-*', 'lib/state-diagram-*', 'lib/cloudflare-*', 'lib/use-font-version.ts', 'cloudflare.ts'],
    highlights: ['Automatic layout, keyboard editing, a minimap', 'Run an xstate machine on its own diagram', 'Cloudflare systems from wrangler.jsonc and workerd configs'],
  },
  {
    id: 'media', name: 'Media', npm: '@brett_lamy/media', category: 'ui', status: 'planned', icon: 'video',
    tagline: 'Video, audio and session recording in the browser.',
    description: 'VideoPreview and a multi-track VideoTimeline with an FFmpeg (WebAssembly) renderer, Waveform, Filmstrip and NowPlayingBars, and the rrweb session recorder whose recordings docstream\'s replay player plays back. The recorder writes to Sync\'s append-only streams, so a recording can follow you to another device.',
    dependsOn: ['ui', 'sync'], external: ['rrweb'],
    modules: [
      'components/video-preview.tsx', 'components/video-timeline.tsx', 'components/waveform.tsx', 'components/filmstrip.tsx', 'components/now-playing-bars.tsx',
      'lib/playback.ts', 'lib/video-timeline-model.ts', 'lib/video-timeline-primitive.ts', 'lib/video-render.ts', 'lib/ffmpeg/', 'lib/session-recorder.ts',
    ],
    highlights: ['A timeline editor that renders with FFmpeg in a worker', 'Waveforms and filmstrips from any media file', 'Record sessions with rrweb, replay them in docstream'],
  },

  /* ── Content & AI ───────────────────────────────────────────────────────────────────────────── */
  {
    id: 'docstream', name: 'Docstream', npm: '@brett_lamy/ui/docstream', partOf: 'ui', category: 'content', status: 'live', icon: 'doc-text', docs: 'docstream',
    formerly: [{ npm: '@brett_lamy/docstream', last: '2.0.1' }],
    tagline: 'GitBook-flavored Markdown that renders while it streams.',
    description: 'A Markdown renderer for docs and AI answers: GitBook blocks (hints, tabs, steppers, cards), live React demos backed by real files, math, Mermaid, xstate machines and workerd configs drawn as diagrams, OpenAPI operations, citations, embeds, session replays and 3D models — and DocsSite, which turns a folder of Markdown into a site like this one. Part of @brett_lamy/ui since 6.0: import it from `@brett_lamy/ui/docstream` and its entries (`/site`, `/gitbook`, `/replay`…).',
    dependsOn: ['ui-sdk'], external: ['katex', 'yaml', 'rrweb', 'xstate', '@strudel/web', 'lucide-react', '@brett_lamy/viz-engine (optional peer)'],
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
    id: 'composer', name: 'Composer', npm: '@brett_lamy/composer', category: 'content', status: 'planned', icon: 'bubble',
    tagline: 'The chat surfaces: prompt box, transcript and the chat beside an artifact.',
    description: 'Composer, the prompt box as parts (card, editor, attachments, pills, compact and floating), with Conversation, MessageScroller and ArtifactChatContainer (docked, or floating on a FloatingSheet): everything a chat UI needs around a model, none of the model.',
    dependsOn: ['ui', 'canvas', 'docstream-editor'],
    modules: ['components/composer/', 'components/conversation.tsx', 'components/message-scroller.tsx', 'components/artifact-chat-container.tsx', 'lib/message-scroller-context.ts', 'lib/message-scroller-primitive.ts'],
    highlights: ['A prompt box you assemble from parts', 'Transcripts that stay at the bottom while streaming', 'Docked or floating chat beside any artifact'],
  },

  /* ── Data & state ───────────────────────────────────────────────────────────────────────────── */
  {
    id: 'sql', name: 'SQL', npm: '@brett_lamy/sql', category: 'data', status: 'planned', icon: 'table',
    tagline: 'A Postgres console for the browser.',
    description: 'SqlConsole — editor, results, schema tree, history, import and export — on PGlite. Its results and history are the core\'s DataTable and its schema is a Tree, so the package is the console itself.',
    dependsOn: ['ui', 'pglite'],
    modules: ['components/sql-console.tsx'],
    highlights: ['A full SQL console in one component', 'Typed result cells, CSV and JSON export', 'A schema browser on the database\'s own catalog'],
  },
  {
    id: 'pglite', name: 'PGlite', npm: '@brett_lamy/pglite', category: 'data', status: 'planned', icon: 'internaldrive',
    tagline: 'Postgres in the tab, as React hooks.',
    description: 'Headless hooks and helpers around PGlite (Postgres compiled to WebAssembly): open a persistent database, read its schema, import and export dumps and files, detect what storage the browser offers, split SQL into statements, and keep a database to one writing tab with a Web Lock. The schema reader names an icon per object kind, so it builds on Icons.',
    dependsOn: ['icons'], external: ['@electric-sql/pglite (optional peer)', '@electric-sql/pglite-tools (optional peer)'],
    modules: ['lib/pglite.tsx', 'lib/pglite-core.ts', 'lib/pglite-schema.ts', 'lib/pglite-files.ts', 'lib/pglite-transfer.ts', 'lib/pglite-storage.ts', 'lib/sql-lex.ts', 'lib/tab-lock.tsx'],
    highlights: ['`usePGlite` with IndexedDB or OPFS persistence', 'Dumps, archives and file import', 'No UI: bring your own, or use SQL'],
  },
  {
    id: 'filter', name: 'Filter', npm: '@brett_lamy/filter', category: 'data', status: 'planned', icon: 'filter-circle',
    tagline: 'Filter bars, and filters you can type in plain English.',
    description: 'Filter — chips for fields, operators, dates and options on the kit\'s Toolbar — and FilterInput, which turns "open bugs from last week" into those chips with a small WebGPU model (gpu-query). The model never sees your field names: it reads a schema built from their labels and options.',
    dependsOn: ['ui'],
    modules: ['components/filter.tsx', 'components/filter-input.tsx', 'lib/filter-model.ts', 'lib/filter-query.ts', 'lib/gpu-query/'],
    highlights: ['Linear-style filter chips', 'Natural-language filters on a WebGPU model', 'A typed filter model you can serialize'],
  },
  {
    id: 'sync', name: 'Sync', npm: '@brett_lamy/sync', category: 'data', status: 'planned', icon: 'cloud',
    tagline: 'Local-first state that survives reloads and follows you across devices.',
    description: 'usePersistentState for small settings, append-only local streams in the browser, and the Durable Streams client that mirrors them to a server and reads other devices\' streams back. Off until a server URL is set: nothing leaves the browser by default.',
    dependsOn: [],
    modules: ['lib/persistent-state.ts', 'lib/append-stream.ts', 'lib/durable-streams.ts'],
    highlights: ['`usePersistentState`, typed and versioned', 'Append-only local streams', 'Cloud sync on Durable Streams'],
  },

  /* ── Platform & tooling ─────────────────────────────────────────────────────────────────────── */
  {
    id: 'vault', name: 'Vault', npm: '@brett_lamy/vault', category: 'platform', status: 'planned', icon: 'passkey',
    tagline: 'Passkey-locked, end-to-end encrypted storage.',
    description: 'A vault whose key never leaves a passkey (WebAuthn PRF): encrypt and store secrets in the browser, unlock with Face ID or Touch ID, and gate any screen behind it with VaultGate, which carries its own enrollment flow.',
    dependsOn: ['ui'],
    modules: ['lib/vault.ts', 'lib/vault-storage.ts', 'lib/vault-react.tsx', 'lib/passkey.ts', 'components/vault-gate.tsx'],
    highlights: ['Keys derived from a passkey, never stored', 'VaultGate locks any subtree', 'Works offline'],
  },
  {
    id: 'tailscale', name: 'Tailscale', npm: '@brett_lamy/tailscale', category: 'platform', status: 'planned', icon: 'vpn',
    tagline: 'Reach your tailnet from a web page.',
    description: 'Join a tailnet from the browser (Tailscale compiled to WebAssembly), fetch from tailnet hosts, pick an exit node, and route a page\'s requests through a service worker — with the login and tailnet controls and an in-memory fake for tests.',
    dependsOn: ['ui'], external: ['@agent-wasm/tailscale-connect (optional peer)'],
    modules: ['lib/tailscale*', 'components/tailscale-controls.tsx'],
    highlights: ['`fetch` to tailnet hosts from a tab', 'A service-worker router for whole pages', 'A fake tailnet for tests'],
  },
  {
    id: 'opencode', name: 'OpenCode', npm: '@brett_lamy/opencode', category: 'platform', status: 'planned', icon: 'terminal',
    tagline: 'The OpenCode agent, running in the page.',
    description: 'OpenCode in a component: its runtime in the browser (almost-node or agent-wasm), a preview of what it builds, and provider keys kept in a passkey Vault. It is already an entry of its own (`@brett_lamy/ui/opencode`), because the runtime is large.',
    dependsOn: ['ui', 'vault'],
    modules: ['components/open-code.tsx', 'lib/open-code-*', 'opencode.ts'],
    highlights: ['A coding agent with no server of its own', 'Live preview of the app it writes', 'Keys locked behind a passkey'],
  },
  {
    id: 'registry', name: 'Registry', npm: '@brett_lamy/registry', category: 'platform', status: 'planned', icon: 'cube',
    tagline: 'Turn a component library into a shadcn registry.',
    description: 'The build behind blamy.github.io/ui/r: one registry item per module, dependencies computed from real imports, hand-written manifests checked against the code, and theme items generated from your tokens — as a CLI for any library that imports itself through aliases. The app blocks stay a private, registry-only package.',
    dependsOn: [], external: ['typescript'],
    highlights: ['One item per module, dependencies from imports', 'Manifests checked against the code', '`--check` for CI'],
  },
];

export const LIBRARY: Record<string, Library> = Object.fromEntries(LIBRARIES.map((l) => [l.id, l]));
export const byCategory = (c: Category) => LIBRARIES.filter((l) => l.category === c);
export const libraryRoute = (l: Library) => `libraries/${l.id}`;
const CATEGORY = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<Category, (typeof CATEGORIES)[number]>;
export const categoryOf = (l: Library) => CATEGORY[l.category];

/** The npm package a library ships in: its own, or its `partOf` library's. */
export const packageOf = (l: Library): Library => (l.partOf ? LIBRARY[l.partOf] : l);
/** Every npm package name the plan publishes (subpath entries aside). */
export const packageNames = (l: Library): string[] => (l.partOf ? [] : (l.packages ?? [l.npm]));

/** Does a module pattern (`lib/diagram-*`, `components/composer/`, `cloudflare.ts`) take this unit? */
export const takes = (pattern: string, unit: string) => (pattern.endsWith('*') ? unit.startsWith(pattern.slice(0, -1)) : unit === pattern);
/** The library a unit of packages/ui/src belongs to: the one that lists it, else the core. */
export const ownerOf = (unit: string): Library => LIBRARIES.find((l) => l.modules?.some((m) => takes(m, unit))) ?? LIBRARY.ui;

/** Every library a library builds on, directly or through others. */
export function reach(id: string, seen = new Set<string>()): Set<string> {
  for (const dep of LIBRARY[id]?.dependsOn ?? []) if (!seen.has(dep)) { seen.add(dep); reach(dep, seen); }
  return seen;
}

/** Code changes the split needs beyond moving files (each one an import the layering would otherwise forbid). */
export const SPLIT_CHANGES: Array<{ unit: string; imports: string; change: string }> = [
  {
    unit: 'docstream/', imports: '@brett_lamy/ui/cloudflare',
    change: 'Docstream\'s capnp fence draws a workerd config with CloudflareDiagram, which it loads lazily from `@brett_lamy/ui/cloudflare`. Docstream ships in @brett_lamy/ui and Diagram doesn\'t, so after the split the fence loads `@brett_lamy/diagram/cloudflare` as an optional peer, the way the viz fence loads `@brett_lamy/viz-engine`: without it the fence shows the config\'s source.',
  },
];
