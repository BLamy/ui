/* TouchKit documentation content — ported verbatim from project/docs-content.js.
   %%demo:<name>%% / %%live:<name>%% markers on their own line mount live components between markdown segments. */

export interface DocPage {
  id: string;
  section: string;
  title: string;
  markdown: string;
}

export interface DocSection {
  section: string;
  pages: string[];
}

export const NAV: DocSection[] = [
  {
    "section": "Getting started",
    "pages": [
      "introduction",
      "installation",
      "theming"
    ]
  },
  {
    "section": "Haptics",
    "pages": [
      "haptics"
    ]
  },
  {
    "section": "Containers",
    "pages": [
      "navigation-stack",
      "tab-view",
      "split-view",
      "artifact-chat-container",
      "workbench-shell",
      "chat-shell"
    ]
  },
  {
    "section": "Lists",
    "pages": [
      "lists",
      "index-bar"
    ]
  },
  {
    "section": "Presentation",
    "pages": [
      "credenza",
      "side-drawer"
    ]
  },
  {
    "section": "Drawing",
    "pages": [
      "pencilkit"
    ]
  },
  {
    "section": "Workbench",
    "pages": [
      "workbench",
      "message-scroller",
      "composer",
      "terminal-dock",
      "file-tree",
      "diff-view",
      "surface-panel",
      "docstream"
    ]
  },
  {
    "section": "Beautiful UI",
    "pages": [
      "bui-overview"
    ]
  },
  {
    "section": "BUI · Agent state",
    "pages": [
      "bui-loading",
      "bui-thinking",
      "bui-streaming",
      "bui-tool-chips",
      "bui-task-rows",
      "bui-agent-board",
      "bui-plan-review",
      "bui-memory",
      "bui-code-block"
    ]
  },
  {
    "section": "BUI · Input & nav",
    "pages": [
      "bui-search",
      "bui-command-menu",
      "bui-model-picker",
      "bui-combobox",
      "bui-datepicker",
      "bui-sidebar",
      "bui-selection"
    ]
  },
  {
    "section": "BUI · Decisions & data",
    "pages": [
      "bui-approval",
      "bui-recommendation",
      "bui-context",
      "bui-citation",
      "bui-insights",
      "bui-diff-table",
      "bui-records-table",
      "bui-filter-table",
      "bui-fine-tune"
    ]
  },
  {
    "section": "BUI · Primitives",
    "pages": [
      "bui-popover",
      "bui-toast",
      "bui-skeleton",
      "bui-kbd"
    ]
  }
];

export const PAGES: Record<string, DocPage> = {
  "introduction": {
    id: "introduction",
    section: "Getting started",
    title: "Introduction",
    markdown:
      "# TouchKit\n\nTouchKit brings Cocoa Touch-style composition to typed React packages. Containers own adaptive behavior; applications own state and data. The same component trees work in full pages, resizable panes, and compact device layouts.\n\n## Packages and demos\n\n| Package | Runnable demo |\n| --- | --- |\n| `@touchkit/ui` | Contacts: NavigationStack, SplitView, lists, A-Z/custom IndexBar, tabs, Credenza, SideDrawer |\n| `@touchkit/chatkit` | Team chat: workspace rail, channel navigation, messages, composer, thread views |\n| `@touchkit/workbench` | IDE scaffold: threads, MessageScroller, terminal dock/sheet, surface panel, MarkdownView |\n| `@touchkit/pencilkit` | Pressure-aware drawing and annotation |\n| `@touchkit/beautiful` | AI-native status, review, command, and data-display catalog |\n\nThe full Contacts composition is interactive here:\n\n%%demo:app%%\n\n## Core vocabulary\n\n| UIKit idea | TouchKit component |\n| --- | --- |\n| Navigation controller | `NavigationStack` — controlled push/pop and edge-swipe back |\n| Split view controller | `SplitView` — adaptive sidebar, master, and detail |\n| Tab bar controller | `TabBar` — composable tab navigation |\n| Table view | `List`, `List.Section`, `List.Row` |\n| Section index titles | `IndexBar` — A-Z fallback or application-defined keyed stops |\n| Sheets and trays | `Credenza` |\n| Inspector column | `SideDrawer` |\n| Feedback generator | `Haptics` |\n| Canvas view | `PencilCanvas` |\n\n## Principles\n\n1. **Composition over configuration** — placement determines container behavior.\n2. **Controlled components** — state in, events out.\n3. **Container-aware adaptation** — shells measure themselves, not the viewport.\n4. **Interaction quality** — gestures, keyboard access, haptics, and responsive transitions are part of the component API.",
  },
  "installation": {
    id: "installation",
    section: "Getting started",
    title: "Installation",
    markdown:
      "# Installation\n\nTouchKit ships as five typed ESM packages. Install only the layers your application uses:\n\n```sh\npnpm add @touchkit/ui @touchkit/chatkit @touchkit/workbench react react-dom\n```\n\nImport package styles once near your application entry, then use named imports from the package root:\n\n```tsx\nimport '@touchkit/ui/styles.css'\nimport '@touchkit/chatkit/styles.css'\nimport '@touchkit/workbench/styles.css'\n\nimport { TouchKitProvider, NavigationStack, IndexBar } from '@touchkit/ui'\nimport { ChatShell, useChatShell } from '@touchkit/chatkit'\nimport { WorkbenchShell, useWorkbenchShell } from '@touchkit/workbench'\n```\n\n| Package | Contents |\n| --- | --- |\n| `@touchkit/ui` | Theme, haptics, lists, navigation, IndexBar, Credenza, SideDrawer |\n| `@touchkit/chatkit` | ChatShell, channel navigation, messages, composer, thread previews |\n| `@touchkit/workbench` | IDE shell, MessageScroller, terminal, surfaces, MarkdownView |\n| `@touchkit/pencilkit` | PencilKit-style drawing canvas |\n| `@touchkit/beautiful` | AI-native status, review, command, and data-display components |\n\n## Provider\n\nWrap UI surfaces that use the core `--tk-*` theme tokens. Workbench supplies its dark `--wb-*` tokens from `WorkbenchShell`.\n\n```tsx\n<TouchKitProvider tint=\"#0A84FF\">\n  <NavigationStack screens={screens} onPop={handlePop} />\n</TouchKitProvider>\n```\n\n## Peer expectations\n\n- React and React DOM 18 or 19\n- A bundler that resolves ESM package exports and CSS imports\n- Browser APIs such as ResizeObserver for container-aware shells\n\nAll public components and their props types are exported from package roots. The package READMEs contain copy-ready examples, and every major interaction has a runnable Storybook story below.\n\n## Live check\n\n%%live:controls%%",
  },
  "theming": {
    id: "theming",
    section: "Getting started",
    title: "Theming",
    markdown:
      "# Theming\n\nEvery component reads CSS custom properties from its nearest themed ancestor, so theming is one style object on the root.\n\n## Phone components — `--tk-*`\n\n```jsx\n<App dark tint=\"#FF375F\"/>   // the demo app sets these for you\n```\n\n| Token | Light | Dark |\n| --- | --- | --- |\n| `--tk-bg` / `--tk-bg2` | #fff / #F2F2F7 | #000 / #0A0A0C |\n| `--tk-card` | #fff | #1C1C1E |\n| `--tk-label` / `--tk-label2` | #0B0B0F / 60% | #F5F5F7 / 62% |\n| `--tk-sep` | rgba(60,60,67,.22) | rgba(84,84,88,.48) |\n| `--tk-fill` / `--tk-fill2` | 13% / 24% gray | 22% / 34% gray |\n| `--tk-tint` | your accent | your accent |\n\n## Workbench components — `--wb-*`\n\nThe Workbench ships dark-first: `--wb-bg`, `--wb-side`, `--wb-card`, `--wb-fill`, `--wb-sep`, `--wb-label`, `--wb-label2`, `--wb-tint`. Pass `tint` to `<Workbench>` to re-accent the whole shell.\n\n> Tints are picked from the iOS system palette: #0A84FF, #5E5CE6, #30B0C7, #34C759, #FF9F0A, #FF375F. Anything else works — pick a color with contrast against both card colors.\n\n## Live example\n\nSwap tokens and tint on the fly — the components just re-read their nearest `--tk-*` values:\n\n%%live:theming%%",
  },
  "haptics": {
    id: "haptics",
    section: "Haptics",
    title: "Haptics",
    markdown:
      "# Haptics\n\nOne engine, three calls — the same API surface as `UIFeedbackGenerator`:\n\n```js\nHaptics.impact('light' | 'medium' | 'heavy')\nHaptics.selection()                       // A–Z scrub · pickers · tabs\nHaptics.notification('success' | 'warning' | 'error')\nHaptics.on(meta => ...)                   // observe events (drives the pulse indicator)\n```\n\n## Engines, by platform\n\n| Platform | Path |\n| --- | --- |\n| Android / Chrome | native `navigator.vibrate()` |\n| iOS Safari 18+ | `ios-vibrator-pro-max@3.0.3` — hidden switch toggles |\n| macOS Safari | same polyfill — the trackpad's Taptic Engine clicks |\n| Everything else | no vibration API |\n\nThe polyfill is a package dependency and boots **at import time**, matching its recommended setup, so it can wrap the DOM before the first tap. `Haptics.engine` reports the live path; it's printed below and in the demo's Settings screen.\n\n## iOS 18.4+ rules\n\n- Only a real **click** grants vibration, and the grant lasts about a second.\n- For movable controls, the polyfill layers a native switch over the interaction surface, listens to pointer events in capture, disables pointer capture, and flips the switch direction or position under the finger while dragging.\n- Patterns longer than 1s would need main-thread blocking; TouchKit's longest pattern is ~150ms.\n\n## Playground\n\nThe set below recreates the **vibrator.dev** homepage. In Safari on an iPhone or MacBook you'll feel each detent; drag slower if you feel nothing.\n\n%%demo:haptics%%",
  },
  "navigation-stack": {
    id: "navigation-stack",
    section: "Containers",
    title: "NavigationStack",
    markdown:
      "# NavigationStack\n\nA controlled stack of screens: push by adding to the array, pop by removing. Edge-swipe back, large titles, sticky subheaders, and the pop is reported — never performed — by the component.\n\n```jsx\n<NavigationStack\n  onPop={() => setSel(null)}\n  screens={[\n    { key: 'list',   title: 'Contacts', largeTitle: true,\n      subheader: <SearchField/>, content: <ContactList/> },\n    sel && { key: 'detail', title: sel.name, content: <Detail c={sel}/> }\n  ].filter(Boolean)}\n/>\n```\n\n## Screen options\n\n| Option | Effect |\n| --- | --- |\n| `largeTitle` | iOS large title that collapses on scroll |\n| `titleOnScroll` | bar title fades in only after scrolling |\n| `grouped` | inset-grouped background (#F2F2F7 wash) |\n| `subheader` | pinned element under the bar (search fields) |\n| `overlay` | floats above content (index bars, tab bars) |\n| `bottomInset` | reserves room for bars riding the screen |\n| `onRefresh` | pull-to-refresh with spinner + success haptic |\n\n## Back gestures\n\nDragging from the left edge pops interactively — the outgoing screen tracks your finger while the one below parallaxes in. On touch devices the stack also arms a **history sentinel** so the system back-swipe lands as a `popstate` and pops the stack instead of leaving the page.\n\n## Chrome that gets out of the way\n\nScrolling down slides the nav bar (and any `<TabBar>` in the tree) away; scrolling up — or reaching the top — brings both back. Sticky section headers ride along, because they read their offset from the same source.\n\n```jsx\n<NavigationStack screens={[{ key:'list', title:'Contacts', content:<List/>,\n  hideChromeOnScroll: false        // opt out per screen; default is true\n}]}/>\n\n<TabBar items={tabs} hideOnScroll={false}/>   // or keep the tab bar pinned\n```\n\nThe two are coordinated through the kit's chrome state, so a tab bar mounted three containers away still follows the screen the user is actually scrolling. Read it yourself with `useChromeHidden()`.\n\n## Dynamic Island\n\nThe bar collapses **to a floor, never to nothing**: set `--tk-safe-top` (or pass `safeTop` to `<App>`) and that many pixels of opaque bar stay behind, so content never scrolls under the camera island.\n\n```jsx\n// device frame\n<div style={{'--tk-safe-top': '59px'}}>     // env(safe-area-inset-top) on real hardware\n  <App safeTop={59}/>\n</div>\n```\n\nBar height becomes `safeTop + 52`; on hide it translates up by exactly 52, leaving the island strip in place. Large titles, the pull-to-refresh spinner, sticky headers, and the IndexBar rail all offset from the same number. In the [Contacts demo](TouchKit%20Demo.dc.html), switch the frame to **Phone 390** to see it — the island is drawn, and the bar stops under it.\n\n## Live example\n%%live:nav%%",
  },
  "tab-view": {
    id: "tab-view",
    section: "Containers",
    title: "TabView",
    markdown:
      "# TabView\n\nTabs are just containers — where you nest them decides how pushes interact with the bar. There is no mode flag.\n\n## Composition A — bar persists\n\n```jsx\n<TabView>\n  <Tab id=\"contacts\" icon=\"person\">\n    <NavigationStack>   // pushes slide under the bar\n      <ContactList/>\n    </NavigationStack>\n  </Tab>\n  <Tab id=\"settings\">…</Tab>\n</TabView>\n```\n\nEach tab owns a stack, so the bar stays put across pushes — UIKit's `tabBarController(navController)` shape. Tab state survives switching away and back.\n\n## Composition B — bar rides the root\n\n```jsx\n<NavigationStack>\n  <TabView>            // the root screen\n    <Tab id=\"contacts\"><ContactList/></Tab>\n    <Tab id=\"settings\">…</Tab>\n  </TabView>\n</NavigationStack>\n```\n\nNow a push covers bar and root together — `navController(tabBarController)`. The Contacts demo can swap between both trees live in **Settings → Composition**; app state survives the remount because the demo owns it.\n\nSelecting a tab fires `Haptics.selection()`.\n\n## Hiding with the scroll\n\nThe tab bar follows the scrolling screen: down hides it, up brings it back, in step with the nav bar above. It needs no wiring — the bar subscribes to the kit's chrome state wherever it is mounted:\n\n```jsx\n<TabBar items={tabs} selected={tab} onSelect={setTab}/>                 // follows the scroll\n<TabBar items={tabs} selected={tab} onSelect={setTab} hideOnScroll={false}/>  // pinned\n```\n\nAnything else that should duck out of the way can read the same flag with `useChromeHidden()`.\n\n## Live example\n\n%%live:tabs%%",
  },
  "split-view": {
    id: "split-view",
    section: "Containers",
    title: "SplitView",
    markdown:
      "# SplitView\n\nThree columns that collapse into the stack as width shrinks — sidebar, master, detail.\n\n| Width class | Layout |\n| --- | --- |\n| `regular` ≥1024px | sidebar · master · detail side by side |\n| `medium` 640–1023px | master full-width; sidebar becomes an overlay drawer |\n| `compact` <640px | everything collapses into one NavigationStack |\n\n```jsx\n<SplitView wc={wc}\n  sidebar={<Sidebar/>}\n  master={<NavigationStack screens={[list]}/>}\n  detail={<NavigationStack screens={[detail, ring]}/>}\n  drawerOpen={drawer} onCloseDrawer={close}\n/>\n```\n\nThe demo measures its own container with a ResizeObserver and passes `wc` down, so the same tree is testable at any frame size. At **1280px+** there's room for a fourth column: the Activity SideDrawer docks as a fixed panel beside the detail view.\n\nCollapsing is state-preserving — the detail screen that was showing in the column becomes the pushed screen in the stack.\n\n## Live example\n\nThe real component, driven by a width-class switch instead of a ResizeObserver:\n\n%%live:split%%",
  },
  "lists": {
    id: "lists",
    section: "Lists",
    title: "Lists",
    markdown:
      "# List · Section · Row\n\nUITableView's vocabulary: plain or inset-grouped lists, sticky section headers, swipe actions, edit mode with multi-select.\n\n```jsx\n<TKList inset>\n  <TKSection title=\"A\" sticky footer=\"42 contacts\">\n    <TKRow\n      leading={<Avatar c={c}/>}\n      title={c.name} subtitle={c.role}\n      accessory=\"chevron\"          // or \"check\"\n      onPress={open} onDelete={del}\n      edit={editing} checked={picked}\n    />\n  </TKSection>\n</TKList>\n```\n\n## Headers: the list works out its own offset\n\nA sticky section header has to stop below whatever chrome is above it. `TKList` figures that out instead of you passing pixels:\n\n```jsx\n// In a NavigationStack screen: sections stick below the nav bar — and follow it up when it hides\n<TKList><TKSection title=\"A\" sticky>…</TKSection></TKList>\n\n// In a bare scroller: no chrome above, so sections stick at the very top\n<TKList><TKSection title=\"A\" sticky>…</TKSection></TKList>\n\n// The list has its own header: sections stick below it, whatever height it measures\n<TKList header={<SearchField/>}>\n  <TKSection title=\"A\" sticky>…</TKSection>\n</TKList>\n\n// Or state it yourself\n<TKList stickyTop={72}>…</TKList>   // also available per-section: <TKSection stickyTop={…}>\n```\n\nA `header` passed to `TKList` sticks to the top of the list itself and is measured with a ResizeObserver, so a header that grows (a search field turning into a scope bar) keeps the section offsets honest. Nothing needs to know the value of `BARH`.\n\n## Row behaviors\n\n- **Swipe left** reveals destructive actions; past the commit point the row springs open with `Haptics.impact('medium')`. Only one row stays open at a time.\n- **Edit mode** slides in radio checks; every toggle ticks with `Haptics.selection()`.\n- Rows are real `<button>`s with listbox roles, arrow-key navigation, and visible focus rings — the react-aria interaction model.\n\n## Styles\n\n`plain` keeps edge-to-edge rows and sticky letter headers; `grouped` floats each section as an inset card. The Contacts demo toggles the two live in **Settings → Contacts table view**.\n\n## Live example\n\n%%live:row%%",
  },
  "index-bar": {
    id: "index-bar",
    section: "Lists",
    title: "IndexBar",
    markdown:
      "# IndexBar\n\nA reusable jump rail with a **selection tick per stop**. Give it application-defined string or numeric keys and optional React previews; omit `items` to keep the familiar A-Z fallback.\n\n```tsx\nimport { IndexBar, type IndexBarItem } from '@touchkit/ui'\n\nconst stops: IndexBarItem<number>[] = turns.map((turn, index) => ({\n  key: turn.sequence,       // retained as a number in onJump\n  label: index % 5 === 0 ? String(index + 1) : undefined,\n  preview: <strong>{turn.text}</strong>,\n  caption: turn.author,\n}))\n\n<IndexBar\n  items={stops}\n  label=\"Jump to conversation turn\"\n  onJump={(sequence, stop, index) => scrollTo(sequence)}\n  top={10}\n  bottom={10}\n/>\n```\n\n## Alphabet fallback\n\nPass no `items` (or an empty array) and the same component renders A-Z:\n\n```tsx\n<IndexBar\n  avail={new Set(['A', 'B', 'C', 'K', 'M'])}\n  onLetter={(letter) => scrollToSection(letter)}\n/>\n```\n\n## Props\n\n| Prop | Type | Notes |\n| --- | --- | --- |\n| `items` | `(K \\| {key?: K, label?, preview?, caption?, dim?})[]` | `K` is `string \\| number`; primitive items are shorthand stops |\n| `onJump` | `(key: K, item, index) => void` | Fired on pointer or keyboard commit without coercing the key |\n| `avail` / `onLetter` | `Set<string>` / `(letter) => void` | Used only by the alphabet fallback |\n| `top` / `bottom` / `width` | `number \\| string` / `number` | Rail sizing inside its positioned parent |\n| `label` | `string` | Accessible name for the listbox |\n\n## Interaction and accessibility\n\n- Hover previews without navigating; pressing and dragging commits each crossed stop.\n- Arrow Up/Down moves through stops; Home/End commits the first or last stop.\n- The rail exposes a vertical listbox with an active option and visible focus styling from the shared stylesheet.\n- Labelless stops render as dots. `preview` accepts any React node; `caption` is its short accessible label.\n- `dim` changes presentation only; dim stops remain reachable so data and UI indices never diverge.\n\n## Live example\n\nScrub the rail or focus it and use the arrow keys. Switch modes to see the alphabet fallback:\n\n%%live:indexbar%%",
  },
  "credenza": {
    id: "credenza",
    section: "Presentation",
    title: "Credenza",
    markdown:
      "# Credenza\n\nA responsive dialog that renders as a **centered dialog** on desktop and a **floating bottom tray** on phones — with Family-style morphing between stacked states.\n\n```jsx\n<Credenza\n  open={!!share} compact={wc === 'compact'}\n  view={share} title={TITLES[share]}\n  canBack={share !== 'menu'} onBack={() => go('menu')}\n  onClose={() => setShare(null)}\n>\n  <ShareViews view={share} go={go}/>\n</Credenza>\n```\n\n## The morph\n\nEach state (`menu → qr → vcard → done`) is measured, and the card **spring-animates its height** to fit; views cross-fade through scale + blur while the title and back chevron morph in place. framer-motion powers the springs and lazy-loads from a CDN — until it arrives, states switch instantly.\n\n## Tray behavior (compact)\n\n- Drag down to dismiss, with velocity-aware release\n- The card floats inset from the edges — a tray, not an edge-to-edge sheet\n- Success states fire `Haptics.notification('success')`\n\nTry it in the Contacts demo: open any contact → **Share Contact**.\n\n## Live example\n\n%%live:credenza%%",
  },
  "side-drawer": {
    id: "side-drawer",
    section: "Presentation",
    title: "SideDrawer",
    markdown:
      "# SideDrawer\n\nOne inspector, three presentations — chosen by composition, not configuration.\n\n| Mode | Presentation | Used when |\n| --- | --- | --- |\n| `fixed` | docked column beside the detail view | ≥1280px, room to spare |\n| `overlay` | sheet from the right edge + scrim | desktop / tablet |\n| pushed page | compose the same content as a screen | phones |\n\n```jsx\n// extra-wide: docked\n<SideDrawer mode=\"fixed\" open={act} title=\"Activity\" width={318}>\n  <ActivityView c={contact}/>\n</SideDrawer>\n\n// desktop/tablet: overlay sheet\n<SideDrawer mode=\"overlay\" open={act} onClose={close} title=\"Activity\" width={340}>\n  <ActivityView c={contact}/>\n</SideDrawer>\n\n// phone: the same content, pushed\nscreens.push({ key: 'activity', title: 'Activity', content: <ActivityView/> })\n```\n\nThe content component doesn't know which presentation it's in — the Contacts demo picks per width class. The Workbench's [SurfacePanel](#) follows the same philosophy on desktop scales.\n\n## Live example\n\n%%live:sidedrawer%%",
  },
  "workbench": {
    id: "workbench",
    section: "Workbench",
    title: "Workbench shell",
    markdown:
      "# Workbench shell\n\nAn IDE-style scaffold in TouchKit's language: **thread sidebar · chat · terminal · surface panel**, adapting per width class.\n\n%%demo:workbench%%\n\n## Regions\n\n| Region | Desktop ≥1120px | Tablet 760–1119px | Phone <760px |\n| --- | --- | --- | --- |\n| Thread sidebar | fixed 242px column, collapsible | fixed column | hamburger → overlay drawer |\n| Chat | center column | center column | full width |\n| Terminal | resizable bottom dock | resizable dock | **vaul-style snap drawer** (52% / 93% snaps) |\n| Surface panel | right column + full-screen mode | **right-edge drawer** + scrim | **bottom tab bar** — tap a surface to focus it |\n\n```jsx\n<Workbench tint=\"#0A84FF\" terminal surface=\"none\"/>\n```\n\n## The header row\n\nBreadcrumb (`project / thread`) plus toggles: **new thread**, **terminal dock**, **right panel**. On mobile the sidebar toggle becomes a hamburger. Every toggle ticks.\n\n## Full-screen surfaces\n\nThe surface panel's expand button promotes it to cover the whole shell — the same panel component, re-parented. On tablet the panel arrives as a right-edge drawer over the chat; on phones the surfaces move into a **bottom tab bar** — Chat plus the five surfaces — and tapping one focuses that view full-screen above the bar. See [SurfacePanel](#).",
  },
  "message-scroller": {
    id: "message-scroller",
    section: "Workbench",
    title: "MessageScroller",
    markdown:
      "# MessageScroller\n\nA chat transcript scroller that ports the shadcn `message-scroller` behaviors: it anchors turns, follows streams, and never moves the reader against their intent.\n\n```jsx\n<MessageScroller\n  threadKey={thread.id}\n  streaming={isStreaming}\n  items={msgs.map(m => ({\n    id: m.id,\n    anchor: m.role === 'user',     // rows that start a turn\n    node: <Message m={m}/>\n  }))}\n/>\n```\n\n## Behaviors\n\n1. **Anchoring turns** — a newly appended anchor row scrolls near the top with a ~52px peek of the previous turn, so the reply has room to stream in below.\n2. **Follow the live edge** — auto-scroll runs only while you're at the bottom. The reply grows into the reserved room without moving the view.\n3. **Release on intent** — wheel up, touch drag, or PageUp/Home instantly stop following; new chunks land offscreen.\n4. **Jump to latest** — the floating pill returns to the live edge and re-engages following; while streaming it pulses.\n5. **Open at last anchor** — switching threads opens at the last user message, not the absolute bottom, falling back to the end.\n\n## Accessibility\n\nThe viewport is a labelled, focusable scroll region (`role=\"region\"`, `tabIndex=0`); the transcript is `role=\"log\"` with `aria-relevant=\"additions\"` and `aria-busy` while streaming. Rows use `content-visibility: auto` so long threads stay responsive.\n\n## Live example\n\nSend a few turns, then scroll up and send another — anchoring, release, and the jump pill:\n\n%%live:scroller%%",
  },
  "composer": {
    id: "composer",
    section: "Workbench",
    title: "Composer",
    markdown:
      "# Composer\n\nThe Workbench prompt box is backed by `@brett_lamy/docstream-editor`, so authored messages use the same GitBook-flavored Markdown model as rendered replies. It combines a compact WYSIWYG editor with setting pills, attachments, and a send/stop control.\n\n```tsx\nimport { Composer } from '@touchkit/workbench'\n\n<Composer\n  onSend={(markdown, images) => send(markdown, images)}\n  streaming={isStreaming}\n  onStop={stop}\n  onChange={setDraft}\n  wide\n/>\n```\n\n## Rich editing\n\n- Type `/` to insert headings, code blocks, hints, tables, lists, and other Docstream blocks.\n- Pasted Markdown is parsed into structured editor nodes; pasted images remain annotatable attachments.\n- Enter sends from a plain top-level paragraph. Inside lists, quotes, tables, hints, or code blocks it keeps the editor's native behavior. ⌘/Ctrl+Enter always sends and Shift+Enter inserts a hard break.\n- `onSend` receives serialized GitBook Markdown. The editor itself is WYSIWYG, so a second rendered preview is unnecessary while composing.\n\n## Controls\n\n- **Expand** — the top-right control switches from the compact default to a tall drafting surface, then restores the compact composer. Use `expanded`, `defaultExpanded`, and `onExpandedChange` when the host needs to own that state.\n- **Pills** — model (`Claude Opus 4.7`), effort (`Extra High`), access (`Full access`). In the demo a click cycles the options with a selection tick; in a product they'd open menus.\n- **Send** is a filled tint circle, disabled while the document is empty; while streaming it becomes a progress ring with a stop square.\n- **Checkout bar** — the attached strip below shows the working tree (`Local checkout · main`).\n\n## Empty state\n\nA thread with no messages renders the **centered composer**: glyph, \"What are we building?\", the wide composer, and three suggestion chips that send on tap. Press the `+` in any header to get there.\n\n## Live example\n\nThe example starts with rich Markdown already parsed. Try the expand control, `/`, paste a fenced code block, or edit the list before sending.\n\n%%live:composer%%",
  },
  "terminal-dock": {
    id: "terminal-dock",
    section: "Workbench",
    title: "TerminalDock",
    markdown:
      "# TerminalDock\n\nA shell strip for the bottom of the chat column — and a **vaul drawer** on phones.\n\n```jsx\n// desktop: resizable dock\n<TerminalDock h={h} setH={setH} seed={lines} onClose={close}/>\n\n// mobile: the same body inside a snap sheet\n<SnapSheet open={open} onClose={close} snaps={[0.52, 0.93]} bg=\"#0C0C10\">\n  <TermHeader onClose={close}/>\n  <TermBody seed={lines}/>\n</SnapSheet>\n```\n\n## Desktop dock\n\nDrag the top edge to resize (110–520px). The header carries the session title and split / new / close controls.\n\n## SnapSheet (the vaul part)\n\n- Drag handle pill; the sheet tracks your finger with rubber-banding past the top\n- **Velocity-aware release** picks the nearest snap point — 52%, 93%, or dismiss\n- Scrim fades with sheet travel; tapping it closes\n- Settling on a snap ticks; dismissal thumps\n\n## The shell\n\n`TermBody` is a tiny echo shell for demos: `ls`, `pwd`, `echo`, `whoami`, `npm run dev`, `clear`, `help`. Enter runs with a tick; unknown commands get the zsh error you deserve.\n\n## Live example\n\nClick into it and type:\n\n%%live:terminal%%",
  },
  "surface-panel": {
    id: "surface-panel",
    section: "Workbench",
    title: "SurfacePanel",
    markdown:
      "# SurfacePanel\n\nThe right-hand panel from the Workbench: pick a **surface** to fill it, expand it to full screen, or close it.\n\n## Surfaces\n\n| Surface | Contents |\n| --- | --- |\n| Browser | URL bar + a mock of the app served on :3000 |\n| Terminal | a second shell session |\n| Files | workspace tree with selection |\n| Diff | unified diff with +/− line tinting |\n| Agents | subagent runs with live status dots |\n\nThe empty state is a card grid — \"Open a surface / Choose what to show in the right panel.\"\n\n```jsx\n<SurfacePanel\n  kind={kind} onOpen={setKind}\n  full={full} onFull={setFull}     // desktop full-screen mode\n  compact={isMobile} onClose={close}\n/>\n```\n\n## Full-screen mode\n\nThe expand button re-parents the panel over the entire shell — sidebar, chat, and terminal included — and turns into a restore button. State (the open surface, terminal scrollback) survives because the panel is the same component either way.\n\n## On mobile\n\nThere is no right column on small screens. On **tablet** widths the panel toggle opens it as a right-edge drawer with a scrim — same panel, slid over the chat. On **phones** the surfaces become a bottom tab bar (Chat · Browser · Terminal · Files · Diff · Agents); tapping a surface focuses it full-screen above the bar, and Chat brings the transcript back. `compact` hides the expand control since there's nothing bigger to expand to.\n\n## Live example\n\nThe picker, then any surface — the close button returns to the picker:\n\n%%live:surfaces%%",
  },
  "file-tree": {
    id: "file-tree",
    section: "Workbench",
    title: "File tree",
    markdown:
      "# File tree\n\nEvery workspace file tree in TouchKit is rendered by **[@pierre/trees](https://trees.software/)**. The Workbench adapter supplies TouchKit tokens and haptics while Pierre owns path-first selection, expansion, search, keyboard navigation, and virtualization.\n\n```sh\npnpm add @pierre/trees\n```\n\n```tsx\nimport { FileTree, useFileTree } from '@pierre/trees/react'\n\nconst { model } = useFileTree({ paths, search: true, initialExpansion: 'open' })\nreturn <FileTree model={model} style={{ height: 320 }} />\n```\n\n## Live example\n\nSearch, collapse folders, and select files in the real Pierre tree:\n\n%%live:filetree%%\n\nSee the full [Trees documentation](https://trees.software/docs).",
  },
  "diff-view": {
    id: "diff-view",
    section: "Workbench",
    title: "Code diff",
    markdown:
      "# Code diff\n\nEvery source diff in TouchKit is rendered by **[@pierre/diffs](https://diffs.com/)**, including the Workbench review surface and Beautiful UI's compatibility `DiffTable`. Pierre supplies Shiki syntax highlighting, unified and split layouts, selection, and scalable rendering.\n\n```sh\npnpm add @pierre/diffs\n```\n\n```tsx\nimport { MultiFileDiff } from '@pierre/diffs/react'\n\n<MultiFileDiff\n  oldFile={{ name: 'src/haptics.ts', contents: before }}\n  newFile={{ name: 'src/haptics.ts', contents: after }}\n  options={{ diffStyle: 'unified', themeType: 'dark' }}\n/>\n```\n\n## Live example\n\nThis is the same Pierre-backed renderer used by the Workbench Diff surface:\n\n%%live:diff%%\n\nSee the full [Diffs documentation](https://diffs.com/docs).",
  },
  "docstream": {
    id: "docstream",
    section: "Workbench",
    title: "Markdown",
    markdown:
      "# MarkdownView\n\nWorkbench chat replies and these docs use `@brett_lamy/docstream` through the package's `MarkdownView` adapter. Docstream provides GitBook-aware parsing, code highlighting, tables, hints, and streaming-aware markup.\n\n```tsx\nimport { MarkdownView } from '@touchkit/workbench'\n\n<MarkdownView markdown={answer} />\n```\n\n## Supported syntax\n\n- Headings, paragraphs, emphasis, strong text, strike-through, links, and inline code\n- Ordered and unordered lists\n- Block quotes and horizontal rules\n- Tables and fenced code blocks with syntax highlighting\n- GitBook blocks supported by Docstream, including hints, tabs, expandables, and embeds\n\nThe `MarkdownView` wrapper keeps TouchKit's `wb-md` styling and sets `data-renderer=\"docstream\"`. Docstream renders structured React elements rather than injecting raw HTML.\n\n## Streaming updates\n\nPass the latest accumulated markdown as chunks arrive. `streaming` is forwarded to Docstream as `isStreaming`, which exposes accessible busy state and a streaming data attribute while content is arriving.\n\n```tsx\n<MarkdownView markdown={partialAnswer} streaming={isStreaming} />\n```\n\n## Styling\n\nImport `@touchkit/workbench/styles.css`. Docstream's styles are included by the Workbench adapter. The rendered wrapper uses `data-slot=\"markdown-view\"` and class `wb-md`; pass `className` or `style` for layout-specific adjustments.\n\n## Live example\n\nThe demo feeds an answer in chunks so you can inspect partial and completed rendering:\n\n%%live:stream%%",
  },
  "pencilkit": {
    id: "pencilkit",
    section: "Drawing",
    title: "PencilKit",
    markdown:
      "# PencilKit\n\nPencilKit's drawing surface in TouchKit's language, built on **[perfect-freehand](https://github.com/steveruizok/perfect-freehand)** by Steve Ruiz — the pressure-to-outline ink engine behind tldraw.\n\n%%demo:pencil%%\n\n## The pipeline\n\n1. Pointer events collect `[x, y, pressure]` — real pressure from Apple Pencil, simulated from velocity for mouse and touch. Coalesced events keep fast strokes dense.\n2. `getStroke(points, options)` returns an outline polygon for the whole mark.\n3. The outline renders as **one filled SVG path** using midpoint quadratic curves — no per-segment strokes, so joins and tapers are geometrically exact.\n\n```js\nimport { getStroke } from \"perfect-freehand\"\n\nconst outline = getStroke(points, {\n  size: 7, thinning: 0.62, smoothing: 0.5, streamline: 0.42,\n  simulatePressure: pointerType !== \"pen\",\n})\n```\n\n## Tools\n\n| Tool | size | thinning | smoothing | streamline | extras |\n| --- | --- | --- | --- | --- | --- |\n| Pen | 7 | 0.62 | 0.50 | 0.42 | — |\n| Marker | 20 | 0.06 | 0.55 | 0.50 | 50% opacity |\n| Pencil | 4.5 | 0.72 | 0.42 | 0.34 | 22px taper, both ends |\n| Eraser | — | — | — | — | removes whole strokes it touches |\n\nEvery palette pick ticks with `Haptics.selection()`; undo and redo thump lightly; clear lands a medium impact.\n\n## Usage\n\n```html\n<x-import component=\"PencilKitDemo\" from=\"./pencilkit.jsx\"\n  dark=\"false\" hint-size=\"100%,540px\"></x-import>\n```\n\n`PencilCanvas` is the raw surface — mount it inside any `--tk-*` themed container. `PencilKitDemo` wraps it with tokens and the dotted paper. Full page: [PencilKit demo](PencilKit%20Demo.dc.html).",
  },
  "bui-overview": {
    id: "bui-overview",
    section: "Beautiful UI",
    title: "Beautiful UI",
    markdown:
      "# Beautiful UI\n\nThe **Beautiful UI** layer (`beautiful.jsx` → `window.BUI`) ports the beautifului.dev catalog of AI-native primitives into TouchKit Workbench's dark language — reimplemented from scratch on `--wb-*` tokens, all controlled components, no build step.\n\n| Component | What it does |\n| --- | --- |\n| [LoadingState](#) | Pixel-grid loader, shimmer label, elapsed time |\n| [Thinking](#) | Compositional expandable reasoning trace |\n| [StreamingText](#) | Streamed answer with sources + follow-ups |\n| [ToolChips](#) | Tool calls as expandable chips |\n| [TaskRows](#) | Live agent task status |\n| [CodeBlockStream](#) | Agent-written code streaming in |\n| [SearchPalette](#) | Command search with live filtering |\n| [Sidebar system](#) | One compositional API over every sidebar variant |\n| [SelectionActions](#) | Highlight-to-agent action bar |\n| [ApprovalCard](#) | Human-in-the-loop question |\n| [RecommendationCard](#) | Suggestion + confidence + accept |\n| [ContextCards](#) | Retrieved knowledge chunks |\n| [InsightCards](#) | Paged insights with sparklines |\n| [DiffTable](#) | AI edits sweeping through rows |\n| [RecordsTable](#) | CRM grid with tags + strength |\n| [FilterTable](#) | Status chips reorganizing data |\n| [FineTuneCard](#) | Design-property inspector |\n\nEvery page in this section documents one component: a live demo, the usage source under its **Code** tab, and the API below it. Pick a page from the sidebar.",
  },
  "bui-loading": {
    id: "bui-loading",
    section: "BUI · Agent state",
    title: "LoadingState",
    markdown:
      "# LoadingState\n\nA compact \"the agent is working\" pill — a pixel-grid loader, a shimmering label, and an elapsed-time counter so waits never feel dead.\n\n%%live:buiLoading%%\n\n## API\n\n| Prop | Type | Default | Notes |\n| --- | --- | --- | --- |\n| `variant` | `\"grid\" \\| \"dots\" \\| \"orbit\"` | `\"grid\"` | Loader graphic |\n| `label` | string | `\"Churning\"` | Shimmer text |\n\nThe elapsed timer starts on mount — remount to reset it.",
  },
  "bui-thinking": {
    id: "bui-thinking",
    section: "BUI · Agent state",
    title: "Thinking",
    markdown:
      "# Thinking\n\nAn expandable reasoning trace with a fully compositional API in the shadcn / react-aria style: you assemble the trigger, tabs, and panels from parts, so any combination of steps, prose, search hits, and code is expressible.\n\n%%live:buiThinking%%\n\n## Parts\n\n| Part | Role |\n| --- | --- |\n| `<Thinking defaultOpen defaultTab>` | Root — owns open + active-tab state |\n| `<Thinking.Trigger icon>` | Header row; toggles open |\n| `<Thinking.Content>` | Collapsible region |\n| `<Thinking.Tabs>` / `<Thinking.Tab id>` | Tab strip; first mounted tab auto-activates |\n| `<Thinking.Panel id>` | Shown when its `id` is active |\n| `<Thinking.Step done>` | Step row — spinner until `done` |\n| `<Thinking.Search site>` | Search-hit row |\n| `<Thinking.Code>` | Mono code panel |\n\nTabs and panels pair by `id` — omit any you don't need.",
  },
  "bui-streaming": {
    id: "bui-streaming",
    section: "BUI · Agent state",
    title: "StreamingText",
    markdown:
      "# StreamingText\n\nA streamed answer: a source-avatar stack up top, a word-by-word body with a blinking caret, then source chips and follow-up prompts once the stream settles.\n\n%%live:buiStreaming%%\n\n## Behavior\n\n- Streams ~14 words/second with slight jitter, like a real token stream.\n- Sources and follow-ups animate in only after completion, so nothing shifts mid-read.\n- **Replay stream** restarts from zero.",
  },
  "bui-tool-chips": {
    id: "bui-tool-chips",
    section: "BUI · Agent state",
    title: "ToolChips",
    markdown:
      "# ToolChips\n\nCode edits and tool calls compressed into a row of chips — name in mono, result meta muted. Press a chip to expand its output line.\n\n%%live:buiChips%%\n\n## Behavior\n\n- One chip open at a time; pressing the open chip closes it.\n- Chip anatomy: icon · `tool_name` · meta (duration, diff stat, status code).",
  },
  "bui-task-rows": {
    id: "bui-task-rows",
    section: "BUI · Agent state",
    title: "TaskRows",
    markdown:
      "# TaskRows\n\nLive agent task status — completed, running with progress, waiting — with subtasks nested under each task. Two layouts from the same data: **Capsules** (cards with subtasks) and **List** (dense rows).\n\n%%live:buiTasks%%\n\n## States\n\n| State | Rendering |\n| --- | --- |\n| `done` | Green check + \"Completed\" badge |\n| `run` | Spinner + live progress meta |\n| `wait` | Hollow dot, muted |",
  },
  "bui-code-block": {
    id: "bui-code-block",
    section: "BUI · Agent state",
    title: "CodeBlockStream",
    markdown:
      "# CodeBlockStream\n\nAgent-written code streaming in line by line, with a filename header, language badge, streaming indicator, and copy action. Syntax highlighting uses the same local fence highlighter as `MarkdownView`.\n\n%%live:buiCode%%\n\n## Behavior\n\n- Lines land every ~260ms; the header shows `streaming…` until the last one.\n- **Copy** writes the full source to the clipboard (not just the streamed prefix).",
  },
  "bui-search": {
    id: "bui-search",
    section: "BUI · Input & nav",
    title: "SearchPalette",
    markdown:
      "# SearchPalette\n\nCommand search with live filtering and an empty state that hands off to the agent instead of dead-ending.\n\n%%live:buiSearch%%\n\n## Behavior\n\n- Case-insensitive substring filter, results animate in per keystroke.\n- Empty state offers \"Ask the agent instead →\" with the unmatched query.",
  },
  "bui-sidebar": {
    id: "bui-sidebar",
    section: "BUI · Input & nav",
    title: "Sidebar system",
    markdown:
      "# Sidebar system\n\nOne compositional API over every sidebar behavior — a **higher-level primitive than shadcn's sidebar**: the same children render as any variant, and every variant knows how to become a hamburger overlay on its own.\n\n%%live:buiSidebar%%\n\n## The three layers\n\n1. `<SidebarProvider defaultOpen breakpoint>` — owns open state and watches **container** width (not the viewport), so it works inside any panel.\n2. `<Sidebar variant width railWidth>` — renders its children in the chosen behavior.\n3. `<SidebarTrigger>` + `<SidebarInset>` — the hamburger (toggles whatever is mounted) and the main column.\n\n## Variants\n\n| Variant | Open | Closed | Below breakpoint |\n| --- | --- | --- | --- |\n| `docked` | Fixed column | Slides away | Overlay drawer |\n| `rail` | Fixed column | Icon rail (labels hide) | Overlay drawer |\n| `float` | Inset floating card | Slides away | Overlay drawer |\n| `overlay` | Drawer + scrim | Hidden | Overlay drawer |\n\n## Slots & parts\n\n| Part | Role |\n| --- | --- |\n| `Sidebar.Header / .Content / .Footer` | Layout slots — Content scrolls |\n| `Sidebar.Workspace name detail` | Identity block; avatar-only when collapsed |\n| `Sidebar.Search` | Quick-search field; icon-only when collapsed |\n| `Sidebar.Section title` | Group label; divider when collapsed |\n| `Sidebar.Item icon label badge active onPress` | Nav row; icon-only + tooltip when collapsed |\n\nEvery part reads collapsed state from context — compose any content and the rail variant still works. `SidebarNav` in `window.BUI` is a pre-composed example built from these parts.",
  },
  "bui-selection": {
    id: "bui-selection",
    section: "BUI · Input & nav",
    title: "SelectionActions",
    markdown:
      "# SelectionActions\n\nHighlight a passage and hand it to the agent — a floating action bar appears over the selection with rewrite verbs.\n\n%%live:buiSelection%%\n\n## Behavior\n\n- The bar positions over the selection rect, clamped to the card's bounds.\n- Actions receive the selected text; the demo echoes it below.\n- Works with mouse and touch selection.",
  },
  "bui-approval": {
    id: "bui-approval",
    section: "BUI · Decisions & data",
    title: "ApprovalCard",
    markdown:
      "# ApprovalCard\n\nA human-in-the-loop question the agent asks before acting. Options render as radio-style rows; the pick collapses into a confirmation with an undo.\n\n%%live:buiApproval%%\n\n## API\n\n| Prop | Type | Notes |\n| --- | --- | --- |\n| `question` | string | The ask |\n| `options` | string[] | Choice rows |\n| `onPick` | (option) => void | Fires on selection |\n\n**Change** reopens the options — approvals should never be one-way doors.",
  },
  "bui-recommendation": {
    id: "bui-recommendation",
    section: "BUI · Decisions & data",
    title: "RecommendationCard",
    markdown:
      "# RecommendationCard\n\nAn agent suggestion with a confidence meter, collapsible alternatives (each tagged with why it wasn't chosen), and an accept action that flips to a confirmed state.\n\n%%live:buiRecommend%%\n\n## Anatomy\n\n- Question headline · detail line with mono parameters · \"Other options\" disclosure · confidence meter + **Accept**.\n- Alternative tags: `Needs review` (orange), `No signal` (muted).",
  },
  "bui-context": {
    id: "bui-context",
    section: "BUI · Decisions & data",
    title: "ContextCards",
    markdown:
      "# ContextCards\n\nRetrieved knowledge chunks with their provenance — the RAG receipt. Each card shows the chunk title, character count, body, and a file-type source badge.\n\n%%live:buiContext%%\n\n## Anatomy\n\n- Header count (\"All chunks · 32\") over the visible cards.\n- Source badge: file-type tag (PDF red, CSV green) + filename.",
  },
  "bui-insights": {
    id: "bui-insights",
    section: "BUI · Decisions & data",
    title: "InsightCards",
    markdown:
      "# InsightCards\n\nPaged agent insights with sparkline charts — one finding per page, dots to flip, and a suggested next question at the bottom.\n\n%%live:buiInsights%%\n\n## Anatomy\n\n- Insight sentence with inline mono deltas, tinted by direction.\n- SVG sparkline with an area fill in the insight's tone.",
  },
  "bui-diff-table": {
    id: "bui-diff-table",
    section: "BUI · Decisions & data",
    title: "DiffTable",
    markdown:
      "# DiffTable\n\nA compatibility adapter that converts proposed tabular edits to CSV versions and renders the result with **[@pierre/diffs](https://diffs.com/)**. Syntax highlighting, line selection, and diff layout all come from Pierre.\n\n```sh\npnpm add @pierre/diffs\n```\n\n%%live:buiDiff%%\n\n## Row kinds\n\n| Kind | Pierre input |\n| --- | --- |\n| `remove` | Present only in `oldFile` |\n| `add` | Present only in `newFile` |\n| `keep` | Present in both versions |",
  },
  "bui-records-table": {
    id: "bui-records-table",
    section: "BUI · Decisions & data",
    title: "RecordsTable",
    markdown:
      "# RecordsTable\n\nA CRM-style grid — avatar + name, category tags, last interaction, and a connection-strength meter — with a mono summary footer.\n\n%%live:buiRecords%%\n\n## Anatomy\n\n- Strength meter: five bars, colored by level (green ≥ 4, orange ≥ 2, red below).\n- Footer aggregates: record count · average strength · link count.",
  },
  "bui-filter-table": {
    id: "bui-filter-table",
    section: "BUI · Decisions & data",
    title: "FilterTable",
    markdown:
      "# FilterTable\n\nStatus chips that reorganize live data — each chip carries its count, and rows animate in as the filter changes.\n\n%%live:buiFilter%%\n\n## Behavior\n\n- Chips: All · To do · In Progress · Completed, counts computed from the data.\n- Status colors: To do muted, In Progress orange, Completed green.",
  },
  "bui-fine-tune": {
    id: "bui-fine-tune",
    section: "BUI · Decisions & data",
    title: "FineTuneCard",
    markdown:
      "# FineTuneCard\n\nThe agent adjusts design properties in an inspector — width, height, radius, opacity — and the preview card follows live.\n\n%%live:buiFinetune%%\n\n## Anatomy\n\n- Inspector: labeled sliders with mono value readouts, grouped under \"Layout\".\n- Preview: gradient card re-rendering per input; radius eases so scrubbing feels physical.",
  },
  "bui-agent-board": {
    id: "bui-agent-board",
    section: "BUI · Agent state",
    title: "AgentBoard",
    markdown:
      "# AgentBoard\n\nParallel agents with live state — one row per agent, each showing its current task and where it stands.\n\n%%live:buiAgents%%\n\n## Parts\n\n| Part | Role |\n| --- | --- |\n| `<AgentBoard>` | Card container |\n| `<AgentBoard.Agent name task state progress tone>` | One agent row |\n\n## States\n\n| `state` | Rendering |\n| --- | --- |\n| `running` | Spinner, or a progress meter + % when `progress` (0–1) is given |\n| `done` | Green badge |\n| `failed` | Red badge |\n| `idle` | Muted badge |",
  },
  "bui-plan-review": {
    id: "bui-plan-review",
    section: "BUI · Agent state",
    title: "PlanReview",
    markdown:
      "# PlanReview\n\nAn editable step list the user approves before the agent runs — reorder, remove, then **Approve & run**. The safest human-in-the-loop pattern for multi-step work.\n\n%%live:buiPlan%%\n\n## Parts\n\n| Part | Role |\n| --- | --- |\n| `<PlanReview title approved onApprove onReject>` | Card — header status flips APPROVED when `approved` |\n| `<PlanReview.Step n detail onUp onDown onRemove>` | One step; handlers you omit hide their buttons |\n\nThe step list is yours — the parent owns the array, so reorder/remove is ordinary state.",
  },
  "bui-memory": {
    id: "bui-memory",
    section: "BUI · Agent state",
    title: "MemoryPills",
    markdown:
      "# MemoryPills\n\nWhat the agent currently knows, as dismissible pills — context should be visible and revocable, not a black box.\n\n%%live:buiMemory%%\n\n## Parts\n\n| Part | Role |\n| --- | --- |\n| `<MemoryPills label>` | Labeled wrap row |\n| `<MemoryPills.Pill icon onDismiss>` | One fact; the ✕ appears when `onDismiss` is given |\n\n`icon` takes a built-in icon name (`user`, `cal`, `box`, `bolt`…) or any node.",
  },
  "bui-command-menu": {
    id: "bui-command-menu",
    section: "BUI · Input & nav",
    title: "CommandMenu",
    markdown:
      "# CommandMenu\n\nA ⌘K palette — modal input, grouped commands, live filtering, keyboard hints. Items self-filter against the shared query; empty groups disappear.\n\n%%live:buiCommand%%\n\n## Parts\n\n| Part | Role |\n| --- | --- |\n| `<CommandMenu open onClose>` | Overlay + panel (absolute — mount in a `position:relative` frame) |\n| `<CommandMenu.Input placeholder>` | Query field, bound to the shared context |\n| `<CommandMenu.List>` | Scrollable results region |\n| `<CommandMenu.Group title>` | Section; hides itself when no child matches |\n| `<CommandMenu.Item icon kbd keywords onSelect>` | Command row; matches on its text + `keywords` |\n\nSelecting an item closes the menu and fires `onSelect`.",
  },
  "bui-combobox": {
    id: "bui-combobox",
    section: "BUI · Input & nav",
    title: "Combobox",
    markdown:
      "# Combobox\n\nA filtering input + listbox: type to narrow, arrow keys to move, Enter to commit, outside-click to dismiss.\n\n%%live:buiCombobox%%\n\n## API\n\n| Prop | Type | Notes |\n| --- | --- | --- |\n| `options` | string[] | Full option list |\n| `value` / `onChange` | string | Controlled selection |\n| `placeholder` | string | Shown until a value exists |\n\nThe selected value becomes the placeholder with a ✓, so the field stays a search box.",
  },
  "bui-datepicker": {
    id: "bui-datepicker",
    section: "BUI · Input & nav",
    title: "DatePicker",
    markdown:
      "# DatePicker\n\nA month-grid calendar — prev/next month, today tinted, selection filled.\n\n%%live:buiDate%%\n\n## API\n\n| Prop | Type | Notes |\n| --- | --- | --- |\n| `value` | Date \\| null | Selected day |\n| `onChange` | (Date) => void | Fires on day press |\n\nWeeks start Monday; the view month follows `value` on mount and the arrows after that.",
  },
  "bui-citation": {
    id: "bui-citation",
    section: "BUI · Decisions & data",
    title: "Cite",
    markdown:
      "# Cite\n\nInline citation popovers — a superscript number in running text that opens the retrieved chunk and its source. Built on the `Popover` primitive.\n\n%%live:buiCitation%%\n\n## Parts\n\n| Part | Role |\n| --- | --- |\n| `<Cite n>` | The superscript trigger + popover shell |\n| `<Cite.Quote>` | The retrieved passage, rule-marked |\n| `<Cite.Source kind>` | File badge — `PDF` red, `CSV` green, `WEB` teal |\n\nPairs with [ContextCards](#) — same source-badge vocabulary, different zoom level.",
  },
  "bui-popover": {
    id: "bui-popover",
    section: "BUI · Primitives",
    title: "Popover · Dropdown",
    markdown:
      "# Popover · Dropdown\n\nThe floating primitives the rest of the kit builds on. `Popover.Trigger` clones its child and attaches the toggle (react-aria's `asChild` pattern) — any element can be a trigger. Outside-click dismisses.\n\n%%live:buiPopover%%\n\n## Parts\n\n| Part | Role |\n| --- | --- |\n| `<Popover>` / `<Dropdown>` | Root — owns open state, anchors positioning |\n| `<Popover.Trigger>` | Clones its single child, adds onClick |\n| `<Popover.Content align width>` | Free-form floating panel |\n| `<Dropdown.Menu align width>` | Menu-shaped panel |\n| `<Dropdown.Item icon kbd danger onSelect>` | Row; closes the menu on select |\n| `<Dropdown.Separator>` | Divider |\n\n`Cite` and the docs' own model picker are just compositions of these.",
  },
  "bui-toast": {
    id: "bui-toast",
    section: "BUI · Primitives",
    title: "Toast",
    markdown:
      "# Toast\n\nSonner-style toasts — background work lands bottom-right as a **stack**: the newest toast sits in front, older ones peek out behind it, and hovering the stack fans it out. Auto-dismiss timers pause while you hover.\n\n%%live:buiToast%%\n\n## API\n\n| Part | Role |\n| --- | --- |\n| `<ToastProvider max>` | Owns the stack; renders it bottom-right of itself |\n| `useToast().push({tone, title, detail, duration})` | Enqueue from any descendant |\n| `useToast().dismiss(id)` | Programmatic dismiss (`push` returns the id) |\n\nTones: `info` blue, `success` green, `error` red. Default duration 4.2s, stack caps at 4, each toast carries its own ✕.",
  },
  "bui-skeleton": {
    id: "bui-skeleton",
    section: "BUI · Primitives",
    title: "Skeleton",
    markdown:
      "# Skeleton\n\nAn **automatic** skeleton — wrap any rendered subtree in `<Skeleton loading>` and it measures the real layout (text lines, avatars, chips, images, buttons) and generates matching shimmer blocks. No hand-built placeholder to maintain, and nothing jumps on resolve because the skeleton *is* the layout.\n\n%%live:buiSkeleton%%\n\n## API\n\n| Prop | Type | Notes |\n| --- | --- | --- |\n| `loading` | boolean | `true` shows the generated skeleton; `false` fades the content in |\n| `children` | node | The real content — rendered invisibly while loading so it can be measured |\n\nText nodes become per-line bars; elements with a background (chips, avatars, images) become blocks with their real border-radius. Manual primitives remain for edge cases: `<Skeleton w h r>`, `Skeleton.Text lines`, `Skeleton.Avatar size`.",
  },
  "bui-model-picker": {
    id: "bui-model-picker",
    section: "BUI · Input & nav",
    title: "ModelPicker",
    markdown:
      "# ModelPicker\n\nA model switcher for composer bars — a compact trigger chip that opens a panel with a provider rail (star = favorites, one glyph per provider), live search, and a keyboard-shortcut column.\n\n%%live:buiModelPicker%%\n\n## API\n\n| Prop | Type | Notes |\n| --- | --- | --- |\n| `models` | `{id, name, provider, source}[]` | The full catalog |\n| `value` / `onChange` | string | Controlled selection |\n| `favorites` | string[] | Initial starred ids |\n\n## Behavior\n\n- Rail filters by provider; press the active glyph again to clear. ★ shows favorites only.\n- ⌘1–⌘9 select the first nine visible rows; `esc` closes; outside-click dismisses.\n- Stars toggle in place and feed the ★ rail view.\n\nComposes with [PromptBar](#) — mount the trigger in its control row.",
  },
  "bui-kbd": {
    id: "bui-kbd",
    section: "BUI · Primitives",
    title: "Kbd",
    markdown:
      "# Kbd\n\nKeyboard hints — a tiny primitive the palette, menus, and shortcut lists all share.\n\n%%live:buiKbd%%\n\n## API\n\n`<Kbd>⌘K</Kbd>` — mono, bordered, bottom-weighted like a real keycap. Used by `CommandMenu.Item` and `Dropdown.Item` via their `kbd` prop.",
  },
  "workbench-shell": {
    id: "workbench-shell",
    section: "Containers",
    title: "WorkbenchShell",
    markdown:
      "# WorkbenchShell\n\nA compositional IDE scaffold that owns responsive width class and region visibility. Compose ordinary elements into slots, then read shell state from focused child components with `useWorkbenchShell()`.\n\n```tsx\nimport { WorkbenchShell, useWorkbenchShell } from '@touchkit/workbench'\n\nfunction Header() {\n  const { compact, setSideSheet, panel, setPanel } = useWorkbenchShell()\n  return <WorkbenchHeader\n    onOpenNavigation={compact ? () => setSideSheet(true) : undefined}\n    panelOpen={panel}\n    onTogglePanel={() => setPanel(open => !open)}\n  />\n}\n\nexport function Workbench() {\n  return (\n    <WorkbenchShell tint=\"#0A84FF\">\n      <WorkbenchShell.Sidebar><ThreadList /></WorkbenchShell.Sidebar>\n      <WorkbenchShell.Main><><Header /><Chat /></></WorkbenchShell.Main>\n      <WorkbenchShell.Dock><TerminalDock /></WorkbenchShell.Dock>\n      <WorkbenchShell.DockSheet><TermBody /></WorkbenchShell.DockSheet>\n      <WorkbenchShell.Panel><SurfacePanel /></WorkbenchShell.Panel>\n      <WorkbenchShell.TabBar><SurfaceTabBar /></WorkbenchShell.TabBar>\n    </WorkbenchShell>\n  )\n}\n```\n\nSlots do not receive context arguments, and no global namespace is needed. `useWorkbenchShell()` throws a clear error outside the provider.\n\n## Responsive slots\n\n| Slot | Regular / medium | Compact |\n| --- | --- | --- |\n| `Sidebar` | 242px column | Left overlay controlled by `sideSheet` |\n| `Main` | Center column | Center column |\n| `Dock` | Resizable dock below Main | Not rendered |\n| `DockSheet` | Not rendered | Terminal content inside `SnapSheet` |\n| `Panel` | Right column, overlay drawer, or explicit fullscreen | Full-screen surface tab |\n| `TabBar` | Not rendered | Bottom surface tabs |\n\nRegular starts at 1120px, medium at 760px, and compact below 760px. These thresholds use container width, so nested and resizable workbenches behave predictably.\n\n## Context\n\n`wc` and `compact` describe layout. `side` / `sideSheet`, `term` / `termH`, `panel`, `tab`, and `full` expose region state alongside their setters. Keep reads in small slot children so region behavior stays reusable.\n\n## Live example\n\nSwitch widths to see the real shell move its docked regions into compact sheets and tabs:\n\n%%live:workbenchshell%%\n\nThe [Workbench demo](Workbench.dc.html) exercises every width class, the centered empty-thread composer, desktop fullscreen panel, medium panel drawer, compact terminal sheet, and compact surface page.",
  },
  "artifact-chat-container": {
    id: "artifact-chat-container",
    section: "Containers",
    title: "ArtifactChatContainer",
    markdown:
      "# ArtifactChatContainer\n\nA container-aware chat and artifact composition. At larger widths the full chat docks on the left and the artifact fills the right. Below the breakpoint, the artifact keeps the whole canvas and the full Docstream-backed Workbench `Composer` becomes a dense frosted-glass overlay floating above it. A small grabber cap is the top edge of that overlay. Pulling it upward continuously grows the conversation under your finger until the same glass surface fills the page; the transcript fills the available space and the Composer remains pinned at the bottom.\n\n```tsx\nimport { ArtifactChatContainer } from '@touchkit/chatkit'\nimport { Composer } from '@touchkit/workbench'\n\n<ArtifactChatContainer\n  breakpoint={760}\n  chatWidth={400}\n  working={isWorking}\n  workingLabel=\"Working on the artifact…\"\n  onAdd={() => setIsWorking(false)}\n>\n  <ArtifactChatContainer.Chat><Conversation /></ArtifactChatContainer.Chat>\n  <ArtifactChatContainer.Composer>\n    <Composer wide placeholder=\"Do anything\" onSend={send} />\n  </ArtifactChatContainer.Composer>\n  <ArtifactChatContainer.Content><Artifact /></ArtifactChatContainer.Content>\n</ArtifactChatContainer>\n```\n\n## Responsive slots\n\n| Slot | Split layout | Compact layout |\n| --- | --- | --- |\n| `Chat` | Full left column | Grows upward into the full-page chat |\n| `Composer` | Bottom of the chat column | Floating when collapsed; pinned to the bottom when open |\n| `Content` | Right column | Full canvas behind the glass overlay |\n\nThe breakpoint measures the container, not the viewport. The cap is a real drag target: its position tracks the pointer one-to-one in either direction. As it moves, the surface height, width, bottom inset, corner radius, blur, and scrim all interpolate together. Releasing past roughly a third of the travel settles it fully open; dragging its cap down continuously returns it to the floating state. A plain tap toggles. The scrim and `Escape` both collapse it. `chatOpen` / `onChatOpenChange` provide controlled state; `useArtifactChatContainer()` exposes the measured width and presentation state to descendants.\n\n## Working and scroll behavior\n\nWhen `working` is true, the composer row becomes a translucent, tappable **Working…** bar inside the same overlay. Tapping it reveals the real Composer so the user can add another request without leaving the artifact. Use `onAdd` to clear the working state, then set `working` again when the new request begins.\n\n`hideOnScroll` defaults to true. The collapsed overlay subscribes to the same TouchKit chrome state as `TabBar`, so a `List` scrolling down moves the header, tab bar, and artifact chat together; scrolling up returns all three. Once the chat is expanded it stops following scroll chrome.\n\n## Live example\n\nSwitch between split and floating layouts, then drag the cap all the way up and back down. The example uses the full Docstream-backed Workbench Composer rather than the compact ChatKit input.\n\n%%live:artifactchat%%",
  },
  "chat-shell": {
    id: "chat-shell",
    section: "Containers",
    title: "ChatShell",
    markdown:
      "# ChatShell\n\nA compositional chat scaffold. The workspace rail and channel column render beside the conversation when wide, then move into one hamburger drawer below the breakpoint. The breakpoint is based on the shell's own measured width.\n\n```tsx\nimport { ChatShell, useChatShell } from '@touchkit/chatkit'\n\nfunction ChannelNav() {\n  const { compact, setNavOpen } = useChatShell()\n  return <ChannelList\n    onClose={compact ? () => setNavOpen(false) : undefined}\n    onPick={() => setNavOpen(false)}\n  />\n}\n\nexport function Chat() {\n  return (\n    <ChatShell breakpoint={880}>\n      <ChatShell.Rail><WorkspaceRail /></ChatShell.Rail>\n      <ChatShell.Nav><ChannelNav /></ChatShell.Nav>\n      <ChatShell.Main><ChannelMain /></ChatShell.Main>\n    </ChatShell>\n  )\n}\n```\n\nSlots accept ordinary React elements. Descendants read shell state with `useChatShell()`; slot functions and global namespaces are not part of the API. The hook throws a clear error when used outside `ChatShell`.\n\n## Slots\n\n| Slot | Wide | Compact |\n| --- | --- | --- |\n| `Rail` | Left workspace rail | Inside the navigation drawer |\n| `Nav` | Channel column | Inside the navigation drawer |\n| `Main` | Header, messages, composer, and optional thread drawer | Unchanged |\n\n## Context\n\n| Field | Meaning |\n| --- | --- |\n| `w` | Measured shell width |\n| `compact` | `w < breakpoint` |\n| `navOpen` | Compact drawer visibility |\n| `setNavOpen` | Opens or closes the drawer |\n\n## Live example\n\nSwitch widths to watch the same shell dock or collapse its navigation, then try the channels and composer:\n\n%%live:chatshell%%\n\nThe [Chat demo](Chat Demo.dc.html) shows full-view thread navigation and the optional TouchKit SideDrawer treatment for message thread previews.",
  },
};

export const PAGE_ORDER: string[] = NAV.flatMap((s) => s.pages);
