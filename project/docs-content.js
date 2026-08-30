/* TouchKit documentation content — markdown per page, rendered by @brett_lamy/docstream.
   %%demo:<name>%% on its own line mounts a live demo between markdown segments. */
window.TKDocs = {
  nav: [
    {section: 'Getting started', pages: ['introduction', 'installation', 'theming']},
    {section: 'Haptics', pages: ['haptics']},
    {section: 'Containers', pages: ['navigation-stack', 'tab-view', 'split-view', 'workbench-shell', 'chat-shell']},
    {section: 'Lists', pages: ['lists', 'index-bar']},
    {section: 'Presentation', pages: ['credenza', 'side-drawer']},
    {section: 'Drawing', pages: ['pencilkit']},
    {section: 'Workbench', pages: ['workbench', 'message-scroller', 'composer', 'terminal-dock', 'surface-panel', 'docstream']},
    {section: 'Beautiful UI', pages: ['bui-overview']},
    {section: 'BUI · Agent state', pages: ['bui-loading', 'bui-thinking', 'bui-streaming', 'bui-tool-chips', 'bui-task-rows', 'bui-agent-board', 'bui-plan-review', 'bui-memory', 'bui-code-block']},
    {section: 'BUI · Input & nav', pages: ['bui-search', 'bui-command-menu', 'bui-model-picker', 'bui-combobox', 'bui-datepicker', 'bui-sidebar', 'bui-selection']},
    {section: 'BUI · Decisions & data', pages: ['bui-approval', 'bui-recommendation', 'bui-context', 'bui-citation', 'bui-insights', 'bui-diff-table', 'bui-records-table', 'bui-filter-table', 'bui-fine-tune']},
    {section: 'BUI · Primitives', pages: ['bui-popover', 'bui-toast', 'bui-skeleton', 'bui-kbd']}
  ],
  pages: {
    'introduction': {title: 'Introduction', md: `# TouchKit

TouchKit ports Cocoa Touch's **container controllers** to JSX. The tree is the behavior — nest containers differently and navigation changes, with no mode flags. One haptics engine drives every interaction, on iPhone, Android, and macOS trackpads.

Two composed demos ship with the kit, plus a drawing surface:

| Demo | What it shows |
| --- | --- |
| [Contacts demo](TouchKit%20Demo.dc.html) | Phone/tablet app — NavigationStack, TabView, SplitView, swipe rows, A–Z index, Credenza, SideDrawer |
| [Workbench demo](Workbench.dc.html) | IDE scaffold — thread sidebar, chat with MessageScroller, terminal dock, right-side surface panel |
| [PencilKit demo](PencilKit%20Demo.dc.html) | Drawing canvas — perfect-freehand ink, PencilKit-style tool palette |

Here is the Contacts demo, live — resize classes, swipe rows, the A–Z index, tabs, search, everything:

%%demo:app%%

## The dictionary

| UIKit | TouchKit |
| --- | --- |
| UINavigationController | \`<NavigationStack>\` — push, pop, edge-swipe back |
| UISplitViewController | \`<SplitView>\` — collapses columns into the stack |
| UITabBarController | \`<TabBar>\` — nest it anywhere in the tree |
| UITableView | \`<List>\` · \`<Section sticky>\` · \`<Row swipeable>\` |
| Section index titles | \`<IndexBar>\` — haptic tick per letter |
| Sheets / trays | \`<Credenza>\` — dialog ⇄ tray, morphing states |
| Inspector column | \`<SideDrawer>\` — fixed · overlay · pushed page |
| UIFeedbackGenerator | \`Haptics.impact / .selection / .notification\` |
| PKCanvasView | \`<PencilCanvas>\` — perfect-freehand ink strokes |

The Workbench layer adds desktop scaffold parts: \`WorkbenchShell\`, \`WBSidebar\`, \`MessageScroller\`, \`Composer\`, \`TerminalDock\`, \`SurfacePanel\`, and the \`MdView\` markdown renderer.

## Principles

1. **Composition over configuration** — where a container sits decides how it behaves.
2. **Controlled components** — state in, events out; the demos own all state.
3. **Real interaction physics** — springs, momentum, rubber-banding, and haptics on the gestures that deserve them.`},

    'installation': {title: 'Installation', md: "# Installation\n\nTouchKit is a handful of plain JSX modules with no build step. Each one ships a `.tsx` facade next to it, so in an app you import components by name:\n\n```tsx\nimport { NavigationStack, TKList, IndexBar } from \"./touchkit.tsx\"\nimport { Workbench, WorkbenchShell } from \"./workbench.tsx\"\nimport { ChatShell, useChatShell } from \"./chatkit.tsx\"\n```\n\n| Module | Import from | Contents |\n| --- | --- | --- |\n| `touchkit.jsx` | `./touchkit.tsx` | Phone containers, lists, haptics, IndexBar, Credenza, SideDrawer |\n| `workbench.jsx` | `./workbench.tsx` | IDE scaffold, MessageScroller, terminal, surfaces, docstream bridge |\n| `chatkit.jsx` | `./chatkit.tsx` | ChatShell + the chat demo |\n| `pencilkit.jsx` | `./pencilkit.tsx` | PencilKit-style drawing canvas on perfect-freehand |\n\nThe facade is three lines — it imports the runtime module (which registers its global for the no-build demos) and re-exports the names:\n\n```tsx\nimport \"./chatkit.jsx\"\nconst NS = (window as any).TouchKitChat\nexport const ChatShell = NS.ChatShell, useChatShell = NS.useChatShell\nexport default NS\n```\n\n## Mounting without a bundler\n\nScript-tag / `<x-import>` setups read the globals directly — `window.TouchKit`, `window.TouchKitWB`, `window.TouchKitChat`, `window.TouchKitPencil`:\n\n```html\n<x-import component=\"App\" from=\"./touchkit.jsx\"\n  tint=\"#0A84FF\" hint-size=\"100%,700px\"></x-import>\n\n<x-import component=\"Workbench\" from=\"./workbench.jsx\"\n  terminal=\"true\" hint-size=\"100%,640px\"></x-import>\n```\n\nEvery module also exports via `module.exports` for CommonJS bundles:\n\n```js\nconst { App, Segmented, TouchKit } = require('./touchkit.jsx');\nconst { Workbench, MessageScroller, MdView } = require('./workbench.jsx');\n```\n\n## Peer expectations\n\n- React 18 or 19 on `window.React` (the demos load it for you). The kit exports `use` — React 19's `use()` when present, `useContext` on 18 — so shell context reads are identical on both.\n- No CSS files — every component is inline-styled; each module injects one small style tag for keyframes and scrollbars\n- Haptics need no setup: the engine boots itself on import (see [Haptics](#))\n\n## Live check\n\nIf the import worked, these are interactive:\n\n%%live:controls%%"},

    'theming': {title: 'Theming', md: `# Theming

Every component reads CSS custom properties from its nearest themed ancestor, so theming is one style object on the root.

## Phone components — \`--tk-*\`

\`\`\`jsx
<App dark tint="#FF375F"/>   // the demo app sets these for you
\`\`\`

| Token | Light | Dark |
| --- | --- | --- |
| \`--tk-bg\` / \`--tk-bg2\` | #fff / #F2F2F7 | #000 / #0A0A0C |
| \`--tk-card\` | #fff | #1C1C1E |
| \`--tk-label\` / \`--tk-label2\` | #0B0B0F / 60% | #F5F5F7 / 62% |
| \`--tk-sep\` | rgba(60,60,67,.22) | rgba(84,84,88,.48) |
| \`--tk-fill\` / \`--tk-fill2\` | 13% / 24% gray | 22% / 34% gray |
| \`--tk-tint\` | your accent | your accent |

## Workbench components — \`--wb-*\`

The Workbench ships dark-first: \`--wb-bg\`, \`--wb-side\`, \`--wb-card\`, \`--wb-fill\`, \`--wb-sep\`, \`--wb-label\`, \`--wb-label2\`, \`--wb-tint\`. Pass \`tint\` to \`<Workbench>\` to re-accent the whole shell.

> Tints are picked from the iOS system palette: #0A84FF, #5E5CE6, #30B0C7, #34C759, #FF9F0A, #FF375F. Anything else works — pick a color with contrast against both card colors.

## Live example

Swap tokens and tint on the fly — the components just re-read their nearest \`--tk-*\` values:

%%live:theming%%`},

    'haptics': {title: 'Haptics', md: `# Haptics

One engine, three calls — the same API surface as \`UIFeedbackGenerator\`:

\`\`\`js
Haptics.impact('light' | 'medium' | 'heavy')
Haptics.selection()                       // A–Z scrub · pickers · tabs
Haptics.notification('success' | 'warning' | 'error')
Haptics.on(meta => ...)                   // observe events (drives the pulse indicator)
\`\`\`

## Engines, by platform

| Platform | Path |
| --- | --- |
| Android / Chrome | native \`navigator.vibrate()\` |
| iOS Safari 18+ | \`ios-vibrator-pro-max@3.0.3\` — hidden switch toggles |
| macOS Safari | same polyfill — the trackpad's Taptic Engine clicks |
| Everything else | on-screen \`<input switch>\` fallback (visual only) |

The polyfill boots **at import time** so it can wrap the DOM before your first tap. If a stub \`navigator.vibrate\` exists on Safari (where no native one is possible), the engine deletes it — a stub would silently block the polyfill's install gate. \`Haptics.engine\` always reports the live path; it's printed below and in the demo's Settings screen.

## iOS 18.4+ rules

- Only a real **click** grants vibration, and the grant lasts about a second.
- Drags don't grant — so mid-gesture ticks ride an overlay switch that flips under your finger.
- Patterns longer than 1s would need main-thread blocking; TouchKit's longest pattern is ~150ms.

## Playground

The set below recreates the **vibrator.dev** homepage. In Safari on an iPhone or MacBook you'll feel each detent; drag slower if you feel nothing.

%%demo:haptics%%`},

    'navigation-stack': {title: 'NavigationStack', md: `# NavigationStack

A controlled stack of screens: push by adding to the array, pop by removing. Edge-swipe back, large titles, sticky subheaders, and the pop is reported — never performed — by the component.

\`\`\`jsx
<NavigationStack
  onPop={() => setSel(null)}
  screens={[
    { key: 'list',   title: 'Contacts', largeTitle: true,
      subheader: <SearchField/>, content: <ContactList/> },
    sel && { key: 'detail', title: sel.name, content: <Detail c={sel}/> }
  ].filter(Boolean)}
/>
\`\`\`

## Screen options

| Option | Effect |
| --- | --- |
| \`largeTitle\` | iOS large title that collapses on scroll |
| \`titleOnScroll\` | bar title fades in only after scrolling |
| \`grouped\` | inset-grouped background (#F2F2F7 wash) |
| \`subheader\` | pinned element under the bar (search fields) |
| \`overlay\` | floats above content (index bars, tab bars) |
| \`bottomInset\` | reserves room for bars riding the screen |
| \`onRefresh\` | pull-to-refresh with spinner + success haptic |

## Back gestures

Dragging from the left edge pops interactively — the outgoing screen tracks your finger while the one below parallaxes in. On touch devices the stack also arms a **history sentinel** so the system back-swipe lands as a \`popstate\` and pops the stack instead of leaving the page.

## Chrome that gets out of the way

Scrolling down slides the nav bar (and any \`<TabBar>\` in the tree) away; scrolling up — or reaching the top — brings both back. Sticky section headers ride along, because they read their offset from the same source.

\`\`\`jsx
<NavigationStack screens={[{ key:'list', title:'Contacts', content:<List/>,
  hideChromeOnScroll: false        // opt out per screen; default is true
}]}/>

<TabBar items={tabs} hideOnScroll={false}/>   // or keep the tab bar pinned
\`\`\`

The two are coordinated through the kit's chrome state, so a tab bar mounted three containers away still follows the screen the user is actually scrolling. Read it yourself with \`useChromeHidden()\`.

## Dynamic Island

The bar collapses **to a floor, never to nothing**: set \`--tk-safe-top\` (or pass \`safeTop\` to \`<App>\`) and that many pixels of opaque bar stay behind, so content never scrolls under the camera island.

\`\`\`jsx
// device frame
<div style={{'--tk-safe-top': '59px'}}>     // env(safe-area-inset-top) on real hardware
  <App safeTop={59}/>
</div>
\`\`\`

Bar height becomes \`safeTop + 52\`; on hide it translates up by exactly 52, leaving the island strip in place. Large titles, the pull-to-refresh spinner, sticky headers, and the IndexBar rail all offset from the same number. In the [Contacts demo](TouchKit%20Demo.dc.html), switch the frame to **Phone 390** to see it — the island is drawn, and the bar stops under it.

## Live example
%%live:nav%%`},

    'tab-view': {title: 'TabView', md: `# TabView

Tabs are just containers — where you nest them decides how pushes interact with the bar. There is no mode flag.

## Composition A — bar persists

\`\`\`jsx
<TabView>
  <Tab id="contacts" icon="person">
    <NavigationStack>   // pushes slide under the bar
      <ContactList/>
    </NavigationStack>
  </Tab>
  <Tab id="settings">…</Tab>
</TabView>
\`\`\`

Each tab owns a stack, so the bar stays put across pushes — UIKit's \`tabBarController(navController)\` shape. Tab state survives switching away and back.

## Composition B — bar rides the root

\`\`\`jsx
<NavigationStack>
  <TabView>            // the root screen
    <Tab id="contacts"><ContactList/></Tab>
    <Tab id="settings">…</Tab>
  </TabView>
</NavigationStack>
\`\`\`

Now a push covers bar and root together — \`navController(tabBarController)\`. The Contacts demo can swap between both trees live in **Settings → Composition**; app state survives the remount because the demo owns it.

Selecting a tab fires \`Haptics.selection()\`.

## Hiding with the scroll

The tab bar follows the scrolling screen: down hides it, up brings it back, in step with the nav bar above. It needs no wiring — the bar subscribes to the kit's chrome state wherever it is mounted:

\`\`\`jsx
<TabBar items={tabs} selected={tab} onSelect={setTab}/>                 // follows the scroll
<TabBar items={tabs} selected={tab} onSelect={setTab} hideOnScroll={false}/>  // pinned
\`\`\`

Anything else that should duck out of the way can read the same flag with \`useChromeHidden()\`.

## Live example

%%live:tabs%%`},

    'split-view': {title: 'SplitView', md: `# SplitView

Three columns that collapse into the stack as width shrinks — sidebar, master, detail.

| Width class | Layout |
| --- | --- |
| \`regular\` ≥1024px | sidebar · master · detail side by side |
| \`medium\` 640–1023px | master full-width; sidebar becomes an overlay drawer |
| \`compact\` <640px | everything collapses into one NavigationStack |

\`\`\`jsx
<SplitView wc={wc}
  sidebar={<Sidebar/>}
  master={<NavigationStack screens={[list]}/>}
  detail={<NavigationStack screens={[detail, ring]}/>}
  drawerOpen={drawer} onCloseDrawer={close}
/>
\`\`\`

The demo measures its own container with a ResizeObserver and passes \`wc\` down, so the same tree is testable at any frame size. At **1280px+** there's room for a fourth column: the Activity SideDrawer docks as a fixed panel beside the detail view.

Collapsing is state-preserving — the detail screen that was showing in the column becomes the pushed screen in the stack.

## Live example

The real component, driven by a width-class switch instead of a ResizeObserver:

%%live:split%%`},

    'lists': {title: 'Lists', md: `# List · Section · Row

UITableView's vocabulary: plain or inset-grouped lists, sticky section headers, swipe actions, edit mode with multi-select.

\`\`\`jsx
<TKList inset>
  <TKSection title="A" sticky footer="42 contacts">
    <TKRow
      leading={<Avatar c={c}/>}
      title={c.name} subtitle={c.role}
      accessory="chevron"          // or "check"
      onPress={open} onDelete={del}
      edit={editing} checked={picked}
    />
  </TKSection>
</TKList>
\`\`\`

## Headers: the list works out its own offset

A sticky section header has to stop below whatever chrome is above it. \`TKList\` figures that out instead of you passing pixels:

\`\`\`jsx
// In a NavigationStack screen: sections stick below the nav bar — and follow it up when it hides
<TKList><TKSection title="A" sticky>…</TKSection></TKList>

// In a bare scroller: no chrome above, so sections stick at the very top
<TKList><TKSection title="A" sticky>…</TKSection></TKList>

// The list has its own header: sections stick below it, whatever height it measures
<TKList header={<SearchField/>}>
  <TKSection title="A" sticky>…</TKSection>
</TKList>

// Or state it yourself
<TKList stickyTop={72}>…</TKList>   // also available per-section: <TKSection stickyTop={…}>
\`\`\`

A \`header\` passed to \`TKList\` sticks to the top of the list itself and is measured with a ResizeObserver, so a header that grows (a search field turning into a scope bar) keeps the section offsets honest. Nothing needs to know the value of \`BARH\`.

## Row behaviors

- **Swipe left** reveals destructive actions; past the commit point the row springs open with \`Haptics.impact('medium')\`. Only one row stays open at a time.
- **Edit mode** slides in radio checks; every toggle ticks with \`Haptics.selection()\`.
- Rows are real \`<button>\`s with listbox roles, arrow-key navigation, and visible focus rings — the react-aria interaction model.

## Styles

\`plain\` keeps edge-to-edge rows and sticky letter headers; \`grouped\` floats each section as an inset card. The Contacts demo toggles the two live in **Settings → Contacts table view**.

## Live example

%%live:row%%`},

    'index-bar': {title: 'IndexBar', md: `# IndexBar

A jump rail with a **selection tick per stop** — the canonical TouchKit haptic. It started as the A–Z scrubber from Contacts, but the stops are yours: give it any jump points and each one can carry the text you want to see while hovering or dragging.

\`\`\`jsx
import { IndexBar } from "./touchkit.tsx"

// Custom jump points — one dot per user turn, its message as the preview
const stops = turns.filter(t => t.role === 'user').map(t => ({
  key: t.id,               // whatever you scroll by
  preview: t.text,         // shown in the bubble on hover + drag
  caption: 'You',          // small tinted line above the preview
  // label: 'Q3'           // 1–2 chars on the rail; omit for a dot
}))

<IndexBar items={stops} onJump={(key, stop, i) => scrollTo(key)} top={10} bottom={10}/>
\`\`\`

## No keys? You get the alphabet

Pass no \`items\` and the rail is exactly the old A–Z form — same props, same behavior, so existing call sites keep working:

\`\`\`jsx
<IndexBar avail={new Set(['A','B','C','K','M'])} onLetter={L => scrollToSection(L)} top={BARH + 4} bottom={10}/>
\`\`\`

## Props

| Prop | Type | Notes |
| --- | --- | --- |
| \`items\` | \`(string \\| {key, label?, preview?, caption?, dim?})[]\` | Jump points. Strings are shorthand for \`{key, label}\` |
| \`onJump\` | \`(key, item, index) => void\` | Fired on each committed stop |
| \`avail\` / \`onLetter\` | \`Set<string>\` / \`(L) => void\` | Alphabet fallback when \`items\` is empty |
| \`top\` / \`bottom\` / \`width\` | number | Rail inset inside its positioned parent |
| \`label\` | string | \`aria-label\` for the rail |

## Details that matter

- **Hover peeks, drag commits.** Moving the cursor over the rail shows the stop's bubble without jumping or ticking; pressing scrubs, ticks, and calls \`onJump\`.
- The rail is one pointer target — the stop is computed from the pointer's Y against the track, so fast swipes never drop a stop.
- Stops with \`preview\` render a text bubble (3-line clamp, \`caption\` above); stops without one render the UIKit-style round letter HUD.
- \`dim: true\` greys a stop — how the alphabet marks letters with no section. Dim stops still scrub, they just don't tick.
- Ticks call \`Haptics.selection()\` synchronously inside \`pointermove\` — that's what lets the iOS polyfill vibrate mid-drag through its overlay switch.

## Live example

Scrub the rail — each stop lands a tick. Switch modes to see the alphabet fallback:

%%live:indexbar%%`},

    'credenza': {title: 'Credenza', md: `# Credenza

A responsive dialog that renders as a **centered dialog** on desktop and a **floating bottom tray** on phones — with Family-style morphing between stacked states.

\`\`\`jsx
<Credenza
  open={!!share} compact={wc === 'compact'}
  view={share} title={TITLES[share]}
  canBack={share !== 'menu'} onBack={() => go('menu')}
  onClose={() => setShare(null)}
>
  <ShareViews view={share} go={go}/>
</Credenza>
\`\`\`

## The morph

Each state (\`menu → qr → vcard → done\`) is measured, and the card **spring-animates its height** to fit; views cross-fade through scale + blur while the title and back chevron morph in place. framer-motion powers the springs and lazy-loads from a CDN — until it arrives, states switch instantly.

## Tray behavior (compact)

- Drag down to dismiss, with velocity-aware release
- The card floats inset from the edges — a tray, not an edge-to-edge sheet
- Success states fire \`Haptics.notification('success')\`

Try it in the Contacts demo: open any contact → **Share Contact**.

## Live example

%%live:credenza%%`},

    'side-drawer': {title: 'SideDrawer', md: `# SideDrawer

One inspector, three presentations — chosen by composition, not configuration.

| Mode | Presentation | Used when |
| --- | --- | --- |
| \`fixed\` | docked column beside the detail view | ≥1280px, room to spare |
| \`overlay\` | sheet from the right edge + scrim | desktop / tablet |
| pushed page | compose the same content as a screen | phones |

\`\`\`jsx
// extra-wide: docked
<SideDrawer mode="fixed" open={act} title="Activity" width={318}>
  <ActivityView c={contact}/>
</SideDrawer>

// desktop/tablet: overlay sheet
<SideDrawer mode="overlay" open={act} onClose={close} title="Activity" width={340}>
  <ActivityView c={contact}/>
</SideDrawer>

// phone: the same content, pushed
screens.push({ key: 'activity', title: 'Activity', content: <ActivityView/> })
\`\`\`

The content component doesn't know which presentation it's in — the Contacts demo picks per width class. The Workbench's [SurfacePanel](#) follows the same philosophy on desktop scales.

## Live example

%%live:sidedrawer%%`},

    'workbench': {title: 'Workbench shell', md: `# Workbench shell

An IDE-style scaffold in TouchKit's language: **thread sidebar · chat · terminal · surface panel**, adapting per width class.

%%demo:workbench%%

## Regions

| Region | Desktop ≥1120px | Tablet 760–1119px | Phone <760px |
| --- | --- | --- | --- |
| Thread sidebar | fixed 242px column, collapsible | fixed column | hamburger → overlay drawer |
| Chat | center column | center column | full width |
| Terminal | resizable bottom dock | resizable dock | **vaul-style snap drawer** (52% / 93% snaps) |
| Surface panel | right column + full-screen mode | **right-edge drawer** + scrim | **bottom tab bar** — tap a surface to focus it |

\`\`\`jsx
<Workbench tint="#0A84FF" terminal surface="none"/>
\`\`\`

## The header row

Breadcrumb (\`project / thread\`) plus toggles: **new thread**, **terminal dock**, **right panel**. On mobile the sidebar toggle becomes a hamburger. Every toggle ticks.

## Full-screen surfaces

The surface panel's expand button promotes it to cover the whole shell — the same panel component, re-parented. On tablet the panel arrives as a right-edge drawer over the chat; on phones the surfaces move into a **bottom tab bar** — Chat plus the five surfaces — and tapping one focuses that view full-screen above the bar. See [SurfacePanel](#).`},

    'message-scroller': {title: 'MessageScroller', md: `# MessageScroller

A chat transcript scroller that ports the shadcn \`message-scroller\` behaviors: it anchors turns, follows streams, and never moves the reader against their intent.

\`\`\`jsx
<MessageScroller
  threadKey={thread.id}
  streaming={isStreaming}
  items={msgs.map(m => ({
    id: m.id,
    anchor: m.role === 'user',     // rows that start a turn
    node: <Message m={m}/>
  }))}
/>
\`\`\`

## Behaviors

1. **Anchoring turns** — a newly appended anchor row scrolls near the top with a ~52px peek of the previous turn, so the reply has room to stream in below.
2. **Follow the live edge** — auto-scroll runs only while you're at the bottom. The reply grows into the reserved room without moving the view.
3. **Release on intent** — wheel up, touch drag, or PageUp/Home instantly stop following; new chunks land offscreen.
4. **Jump to latest** — the floating pill returns to the live edge and re-engages following; while streaming it pulses.
5. **Open at last anchor** — switching threads opens at the last user message, not the absolute bottom, falling back to the end.

## Accessibility

The viewport is a labelled, focusable scroll region (\`role="region"\`, \`tabIndex=0\`); the transcript is \`role="log"\` with \`aria-relevant="additions"\` and \`aria-busy\` while streaming. Rows use \`content-visibility: auto\` so long threads stay responsive.

## Live example

Send a few turns, then scroll up and send another — anchoring, release, and the jump pill:

%%live:scroller%%`},

    'composer': {title: 'Composer', md: `# Composer

The prompt box from the Workbench chat — auto-growing textarea, setting pills, a send/stop control, and the checkout bar.

\`\`\`jsx
<Composer
  onSend={text => send(text)}
  streaming={isStreaming} onStop={stop}
  wide          // taller variant for the empty state
/>
\`\`\`

## Anatomy

- **Textarea** grows to 190px then scrolls; Enter sends, Shift+Enter breaks the line.
- **Pills** — model (\`Claude Opus 4.7\`), effort (\`Extra High\`), access (\`Full access\`). In the demo a click cycles the options with a selection tick; in a product they'd open menus.
- **Send** is a filled tint circle, disabled until there's text; while streaming it becomes a progress ring with a stop square.
- **Checkout bar** — the attached strip below shows the working tree (\`Local checkout · main\`).

## Empty state

A thread with no messages renders the **centered composer**: glyph, "What are we building?", the wide composer, and three suggestion chips that send on tap. Press the \`+\` in any header to get there.

## Live example

%%live:composer%%`},

    'terminal-dock': {title: 'TerminalDock', md: `# TerminalDock

A shell strip for the bottom of the chat column — and a **vaul drawer** on phones.

\`\`\`jsx
// desktop: resizable dock
<TerminalDock h={h} setH={setH} seed={lines} onClose={close}/>

// mobile: the same body inside a snap sheet
<SnapSheet open={open} onClose={close} snaps={[0.52, 0.93]} bg="#0C0C10">
  <TermHeader onClose={close}/>
  <TermBody seed={lines}/>
</SnapSheet>
\`\`\`

## Desktop dock

Drag the top edge to resize (110–520px). The header carries the session title and split / new / close controls.

## SnapSheet (the vaul part)

- Drag handle pill; the sheet tracks your finger with rubber-banding past the top
- **Velocity-aware release** picks the nearest snap point — 52%, 93%, or dismiss
- Scrim fades with sheet travel; tapping it closes
- Settling on a snap ticks; dismissal thumps

## The shell

\`TermBody\` is a tiny echo shell for demos: \`ls\`, \`pwd\`, \`echo\`, \`whoami\`, \`npm run dev\`, \`clear\`, \`help\`. Enter runs with a tick; unknown commands get the zsh error you deserve.

## Live example

Click into it and type:

%%live:terminal%%`},

    'surface-panel': {title: 'SurfacePanel', md: `# SurfacePanel

The right-hand panel from the Workbench: pick a **surface** to fill it, expand it to full screen, or close it.

## Surfaces

| Surface | Contents |
| --- | --- |
| Browser | URL bar + a mock of the app served on :3000 |
| Terminal | a second shell session |
| Files | workspace tree with selection |
| Diff | unified diff with +/− line tinting |
| Agents | subagent runs with live status dots |

The empty state is a card grid — "Open a surface / Choose what to show in the right panel."

\`\`\`jsx
<SurfacePanel
  kind={kind} onOpen={setKind}
  full={full} onFull={setFull}     // desktop full-screen mode
  compact={isMobile} onClose={close}
/>
\`\`\`

## Full-screen mode

The expand button re-parents the panel over the entire shell — sidebar, chat, and terminal included — and turns into a restore button. State (the open surface, terminal scrollback) survives because the panel is the same component either way.

## On mobile

There is no right column on small screens. On **tablet** widths the panel toggle opens it as a right-edge drawer with a scrim — same panel, slid over the chat. On **phones** the surfaces become a bottom tab bar (Chat · Browser · Terminal · Files · Diff · Agents); tapping a surface focuses it full-screen above the bar, and Chat brings the transcript back. \`compact\` hides the expand control since there's nothing bigger to expand to.

## Live example

The picker, then any surface — the close button returns to the picker:

%%live:surfaces%%`},

    'docstream': {title: 'Markdown · docstream', md: `# Markdown rendering

Chat replies and these docs render through [@brett_lamy/docstream](https://www.npmjs.com/package/@brett_lamy/docstream) — a GitBook-aware, read-only markdown and AI-stream renderer.

\`\`\`jsx
<MdView markdown={md}/>                  // static: docstream MarkdownContent
<MdView markdown={partial} streaming/>   // streaming: GitbookStreamdown
\`\`\`

## How the bridge works

- The package ships TypeScript source; it's imported at runtime from esm.sh with \`?external=react,react-dom\`.
- An **import map** aliases \`react\`, \`react/jsx-runtime\`, and \`react-dom\` to shims that re-export the page's React — one React instance, no invalid-hook crashes.
- While the module loads (or if the CDN is unreachable) a built-in fallback renderer covers headings, lists, tables, fences, quotes, and inline marks — so first paint never waits on the network.
- \`data-renderer="docstream" | "fallback"\` on the wrapper tells you which path rendered.

## Streaming

\`GitbookStreamdown\` receives \`isStreaming\` while chunks arrive — it parses incrementally and tolerates unterminated blocks (half-open fences, mid-row tables). The Workbench feeds it 3–8 words per tick from the demo streams; watch a code fence assemble itself mid-reply.

## Live component previews

v0.3.0 adds a playground entry: **ReactDemo** / **ReactCodePreview** write a file map into *almost-node* — a WASM Node runtime from \`@agent-wasm/core\` — start a real Vite dev server inside it, and show the app in a sandboxed iframe.

\`\`\`jsx
import { ReactDemo } from "@brett_lamy/docstream"

<ReactDemo entry="/src/main.jsx" files={{
  "/src/main.jsx": '…createRoot(…).render(<App/>)',
  "/src/App.jsx":  'import { IndexBar } from "./touchkit.tsx" …',
  "/src/touchkit.tsx": facadeSource,
  "/src/touchkit.jsx": touchkitSource,
}}/>
\`\`\`

The live blocks on the [Lists](#), [Credenza](#), and [Composer](#) pages use it for their **almost-node** tab — the same source shown in the Code tab, plus the real module file, written into the virtual filesystem. The **Preview** tab mounts the component in-page instead, so it's instant and works even where the WASM runtime can't boot (it needs its service worker served by the host app via \`almostnodePlugin()\`).

## Why not innerHTML

Docstream parses to blocks and renders real elements — no \`dangerouslySetInnerHTML\`, safe against injected markup in model output, and the block AST (\`parseMarkdown\`) is reusable for outlines and search.

## Live example

Replay a captured stream through \`GitbookStreamdown\` — watch the table and code fence assemble mid-stream:

%%live:stream%%`},

    'pencilkit': {title: 'PencilKit', md: `# PencilKit

PencilKit's drawing surface in TouchKit's language, built on **[perfect-freehand](https://github.com/steveruizok/perfect-freehand)** by Steve Ruiz — the pressure-to-outline ink engine behind tldraw.

%%demo:pencil%%

## The pipeline

1. Pointer events collect \`[x, y, pressure]\` — real pressure from Apple Pencil, simulated from velocity for mouse and touch. Coalesced events keep fast strokes dense.
2. \`getStroke(points, options)\` returns an outline polygon for the whole mark.
3. The outline renders as **one filled SVG path** using midpoint quadratic curves — no per-segment strokes, so joins and tapers are geometrically exact.

\`\`\`js
import { getStroke } from "perfect-freehand"

const outline = getStroke(points, {
  size: 7, thinning: 0.62, smoothing: 0.5, streamline: 0.42,
  simulatePressure: pointerType !== "pen",
})
\`\`\`

## Tools

| Tool | size | thinning | smoothing | streamline | extras |
| --- | --- | --- | --- | --- | --- |
| Pen | 7 | 0.62 | 0.50 | 0.42 | — |
| Marker | 20 | 0.06 | 0.55 | 0.50 | 50% opacity |
| Pencil | 4.5 | 0.72 | 0.42 | 0.34 | 22px taper, both ends |
| Eraser | — | — | — | — | removes whole strokes it touches |

Every palette pick ticks with \`Haptics.selection()\`; undo and redo thump lightly; clear lands a medium impact.

## Usage

\`\`\`html
<x-import component="PencilKitDemo" from="./pencilkit.jsx"
  dark="false" hint-size="100%,540px"></x-import>
\`\`\`

\`PencilCanvas\` is the raw surface — mount it inside any \`--tk-*\` themed container. \`PencilKitDemo\` wraps it with tokens and the dotted paper. Full page: [PencilKit demo](PencilKit%20Demo.dc.html).`},

    'bui-overview': {title: 'Beautiful UI', md: "# Beautiful UI\n\nThe **Beautiful UI** layer (`beautiful.jsx` → `window.BUI`) ports the beautifului.dev catalog of AI-native primitives into TouchKit Workbench's dark language — reimplemented from scratch on `--wb-*` tokens, all controlled components, no build step.\n\n| Component | What it does |\n| --- | --- |\n| [LoadingState](#) | Pixel-grid loader, shimmer label, elapsed time |\n| [Thinking](#) | Compositional expandable reasoning trace |\n| [StreamingText](#) | Streamed answer with sources + follow-ups |\n| [ToolChips](#) | Tool calls as expandable chips |\n| [TaskRows](#) | Live agent task status |\n| [CodeBlockStream](#) | Agent-written code streaming in |\n| [SearchPalette](#) | Command search with live filtering |\n| [Sidebar system](#) | One compositional API over every sidebar variant |\n| [SelectionActions](#) | Highlight-to-agent action bar |\n| [ApprovalCard](#) | Human-in-the-loop question |\n| [RecommendationCard](#) | Suggestion + confidence + accept |\n| [ContextCards](#) | Retrieved knowledge chunks |\n| [InsightCards](#) | Paged insights with sparklines |\n| [DiffTable](#) | AI edits sweeping through rows |\n| [RecordsTable](#) | CRM grid with tags + strength |\n| [FilterTable](#) | Status chips reorganizing data |\n| [FineTuneCard](#) | Design-property inspector |\n\nEvery page in this section documents one component: a live demo, the usage source under its **Code** tab, and the API below it. Pick a page from the sidebar."},

    'bui-loading': {title: 'LoadingState', md: "# LoadingState\n\nA compact \"the agent is working\" pill — a pixel-grid loader, a shimmering label, and an elapsed-time counter so waits never feel dead.\n\n%%live:buiLoading%%\n\n## API\n\n| Prop | Type | Default | Notes |\n| --- | --- | --- | --- |\n| `variant` | `\"grid\" \\| \"dots\" \\| \"orbit\"` | `\"grid\"` | Loader graphic |\n| `label` | string | `\"Churning\"` | Shimmer text |\n\nThe elapsed timer starts on mount — remount to reset it."},

    'bui-thinking': {title: 'Thinking', md: "# Thinking\n\nAn expandable reasoning trace with a fully compositional API in the shadcn / react-aria style: you assemble the trigger, tabs, and panels from parts, so any combination of steps, prose, search hits, and code is expressible.\n\n%%live:buiThinking%%\n\n## Parts\n\n| Part | Role |\n| --- | --- |\n| `<Thinking defaultOpen defaultTab>` | Root — owns open + active-tab state |\n| `<Thinking.Trigger icon>` | Header row; toggles open |\n| `<Thinking.Content>` | Collapsible region |\n| `<Thinking.Tabs>` / `<Thinking.Tab id>` | Tab strip; first mounted tab auto-activates |\n| `<Thinking.Panel id>` | Shown when its `id` is active |\n| `<Thinking.Step done>` | Step row — spinner until `done` |\n| `<Thinking.Search site>` | Search-hit row |\n| `<Thinking.Code>` | Mono code panel |\n\nTabs and panels pair by `id` — omit any you don't need."},

    'bui-streaming': {title: 'StreamingText', md: "# StreamingText\n\nA streamed answer: a source-avatar stack up top, a word-by-word body with a blinking caret, then source chips and follow-up prompts once the stream settles.\n\n%%live:buiStreaming%%\n\n## Behavior\n\n- Streams ~14 words/second with slight jitter, like a real token stream.\n- Sources and follow-ups animate in only after completion, so nothing shifts mid-read.\n- **Replay stream** restarts from zero."},

    'bui-tool-chips': {title: 'ToolChips', md: "# ToolChips\n\nCode edits and tool calls compressed into a row of chips — name in mono, result meta muted. Press a chip to expand its output line.\n\n%%live:buiChips%%\n\n## Behavior\n\n- One chip open at a time; pressing the open chip closes it.\n- Chip anatomy: icon · `tool_name` · meta (duration, diff stat, status code)."},

    'bui-task-rows': {title: 'TaskRows', md: "# TaskRows\n\nLive agent task status — completed, running with progress, waiting — with subtasks nested under each task. Two layouts from the same data: **Capsules** (cards with subtasks) and **List** (dense rows).\n\n%%live:buiTasks%%\n\n## States\n\n| State | Rendering |\n| --- | --- |\n| `done` | Green check + \"Completed\" badge |\n| `run` | Spinner + live progress meta |\n| `wait` | Hollow dot, muted |"},

    'bui-code-block': {title: 'CodeBlockStream', md: "# CodeBlockStream\n\nAgent-written code streaming in line by line, with a filename header, language badge, streaming indicator, and copy action. Syntax highlighting comes from the docs' own `MdView` fence renderer.\n\n%%live:buiCode%%\n\n## Behavior\n\n- Lines land every ~260ms; the header shows `streaming…` until the last one.\n- **Copy** writes the full source to the clipboard (not just the streamed prefix)."},

    'bui-search': {title: 'SearchPalette', md: "# SearchPalette\n\nCommand search with live filtering and an empty state that hands off to the agent instead of dead-ending.\n\n%%live:buiSearch%%\n\n## Behavior\n\n- Case-insensitive substring filter, results animate in per keystroke.\n- Empty state offers \"Ask the agent instead →\" with the unmatched query."},

    'bui-sidebar': {title: 'Sidebar system', md: "# Sidebar system\n\nOne compositional API over every sidebar behavior — a **higher-level primitive than shadcn's sidebar**: the same children render as any variant, and every variant knows how to become a hamburger overlay on its own.\n\n%%live:buiSidebar%%\n\n## The three layers\n\n1. `<SidebarProvider defaultOpen breakpoint>` — owns open state and watches **container** width (not the viewport), so it works inside any panel.\n2. `<Sidebar variant width railWidth>` — renders its children in the chosen behavior.\n3. `<SidebarTrigger>` + `<SidebarInset>` — the hamburger (toggles whatever is mounted) and the main column.\n\n## Variants\n\n| Variant | Open | Closed | Below breakpoint |\n| --- | --- | --- | --- |\n| `docked` | Fixed column | Slides away | Overlay drawer |\n| `rail` | Fixed column | Icon rail (labels hide) | Overlay drawer |\n| `float` | Inset floating card | Slides away | Overlay drawer |\n| `overlay` | Drawer + scrim | Hidden | Overlay drawer |\n\n## Slots & parts\n\n| Part | Role |\n| --- | --- |\n| `Sidebar.Header / .Content / .Footer` | Layout slots — Content scrolls |\n| `Sidebar.Workspace name detail` | Identity block; avatar-only when collapsed |\n| `Sidebar.Search` | Quick-search field; icon-only when collapsed |\n| `Sidebar.Section title` | Group label; divider when collapsed |\n| `Sidebar.Item icon label badge active onPress` | Nav row; icon-only + tooltip when collapsed |\n\nEvery part reads collapsed state from context — compose any content and the rail variant still works. `SidebarNav` in `window.BUI` is a pre-composed example built from these parts."},

    'bui-selection': {title: 'SelectionActions', md: "# SelectionActions\n\nHighlight a passage and hand it to the agent — a floating action bar appears over the selection with rewrite verbs.\n\n%%live:buiSelection%%\n\n## Behavior\n\n- The bar positions over the selection rect, clamped to the card's bounds.\n- Actions receive the selected text; the demo echoes it below.\n- Works with mouse and touch selection."},

    'bui-approval': {title: 'ApprovalCard', md: "# ApprovalCard\n\nA human-in-the-loop question the agent asks before acting. Options render as radio-style rows; the pick collapses into a confirmation with an undo.\n\n%%live:buiApproval%%\n\n## API\n\n| Prop | Type | Notes |\n| --- | --- | --- |\n| `question` | string | The ask |\n| `options` | string[] | Choice rows |\n| `onPick` | (option) => void | Fires on selection |\n\n**Change** reopens the options — approvals should never be one-way doors."},

    'bui-recommendation': {title: 'RecommendationCard', md: "# RecommendationCard\n\nAn agent suggestion with a confidence meter, collapsible alternatives (each tagged with why it wasn't chosen), and an accept action that flips to a confirmed state.\n\n%%live:buiRecommend%%\n\n## Anatomy\n\n- Question headline · detail line with mono parameters · \"Other options\" disclosure · confidence meter + **Accept**.\n- Alternative tags: `Needs review` (orange), `No signal` (muted)."},

    'bui-context': {title: 'ContextCards', md: "# ContextCards\n\nRetrieved knowledge chunks with their provenance — the RAG receipt. Each card shows the chunk title, character count, body, and a file-type source badge.\n\n%%live:buiContext%%\n\n## Anatomy\n\n- Header count (\"All chunks · 32\") over the visible cards.\n- Source badge: file-type tag (PDF red, CSV green) + filename."},

    'bui-insights': {title: 'InsightCards', md: "# InsightCards\n\nPaged agent insights with sparkline charts — one finding per page, dots to flip, and a suggested next question at the bottom.\n\n%%live:buiInsights%%\n\n## Anatomy\n\n- Insight sentence with inline mono deltas, tinted by direction.\n- SVG sparkline with an area fill in the insight's tone."},

    'bui-diff-table': {title: 'DiffTable', md: "# DiffTable\n\nAI-proposed edits sweeping through tabular data. Press **Apply sweep** and the proposal lands row by row — drops strike through in red, adds glow green.\n\n%%live:buiDiff%%\n\n## Row kinds\n\n| Kind | Effect |\n| --- | --- |\n| `remove` | Red wash, strikethrough, `− drop` tag |\n| `add` | Green wash, `+ add` tag |\n| `keep` | Untouched |"},

    'bui-records-table': {title: 'RecordsTable', md: "# RecordsTable\n\nA CRM-style grid — avatar + name, category tags, last interaction, and a connection-strength meter — with a mono summary footer.\n\n%%live:buiRecords%%\n\n## Anatomy\n\n- Strength meter: five bars, colored by level (green ≥ 4, orange ≥ 2, red below).\n- Footer aggregates: record count · average strength · link count."},

    'bui-filter-table': {title: 'FilterTable', md: "# FilterTable\n\nStatus chips that reorganize live data — each chip carries its count, and rows animate in as the filter changes.\n\n%%live:buiFilter%%\n\n## Behavior\n\n- Chips: All · To do · In Progress · Completed, counts computed from the data.\n- Status colors: To do muted, In Progress orange, Completed green."},

    'bui-fine-tune': {title: 'FineTuneCard', md: "# FineTuneCard\n\nThe agent adjusts design properties in an inspector — width, height, radius, opacity — and the preview card follows live.\n\n%%live:buiFinetune%%\n\n## Anatomy\n\n- Inspector: labeled sliders with mono value readouts, grouped under \"Layout\".\n- Preview: gradient card re-rendering per input; radius eases so scrubbing feels physical."},

    'bui-agent-board': {title: 'AgentBoard', md: "# AgentBoard\n\nParallel agents with live state — one row per agent, each showing its current task and where it stands.\n\n%%live:buiAgents%%\n\n## Parts\n\n| Part | Role |\n| --- | --- |\n| `<AgentBoard>` | Card container |\n| `<AgentBoard.Agent name task state progress tone>` | One agent row |\n\n## States\n\n| `state` | Rendering |\n| --- | --- |\n| `running` | Spinner, or a progress meter + % when `progress` (0–1) is given |\n| `done` | Green badge |\n| `failed` | Red badge |\n| `idle` | Muted badge |"},

    'bui-plan-review': {title: 'PlanReview', md: "# PlanReview\n\nAn editable step list the user approves before the agent runs — reorder, remove, then **Approve & run**. The safest human-in-the-loop pattern for multi-step work.\n\n%%live:buiPlan%%\n\n## Parts\n\n| Part | Role |\n| --- | --- |\n| `<PlanReview title approved onApprove onReject>` | Card — header status flips APPROVED when `approved` |\n| `<PlanReview.Step n detail onUp onDown onRemove>` | One step; handlers you omit hide their buttons |\n\nThe step list is yours — the parent owns the array, so reorder/remove is ordinary state."},

    'bui-memory': {title: 'MemoryPills', md: "# MemoryPills\n\nWhat the agent currently knows, as dismissible pills — context should be visible and revocable, not a black box.\n\n%%live:buiMemory%%\n\n## Parts\n\n| Part | Role |\n| --- | --- |\n| `<MemoryPills label>` | Labeled wrap row |\n| `<MemoryPills.Pill icon onDismiss>` | One fact; the ✕ appears when `onDismiss` is given |\n\n`icon` takes a built-in icon name (`user`, `cal`, `box`, `bolt`…) or any node."},

    'bui-command-menu': {title: 'CommandMenu', md: "# CommandMenu\n\nA ⌘K palette — modal input, grouped commands, live filtering, keyboard hints. Items self-filter against the shared query; empty groups disappear.\n\n%%live:buiCommand%%\n\n## Parts\n\n| Part | Role |\n| --- | --- |\n| `<CommandMenu open onClose>` | Overlay + panel (absolute — mount in a `position:relative` frame) |\n| `<CommandMenu.Input placeholder>` | Query field, bound to the shared context |\n| `<CommandMenu.List>` | Scrollable results region |\n| `<CommandMenu.Group title>` | Section; hides itself when no child matches |\n| `<CommandMenu.Item icon kbd keywords onSelect>` | Command row; matches on its text + `keywords` |\n\nSelecting an item closes the menu and fires `onSelect`."},

    'bui-combobox': {title: 'Combobox', md: "# Combobox\n\nA filtering input + listbox: type to narrow, arrow keys to move, Enter to commit, outside-click to dismiss.\n\n%%live:buiCombobox%%\n\n## API\n\n| Prop | Type | Notes |\n| --- | --- | --- |\n| `options` | string[] | Full option list |\n| `value` / `onChange` | string | Controlled selection |\n| `placeholder` | string | Shown until a value exists |\n\nThe selected value becomes the placeholder with a ✓, so the field stays a search box."},

    'bui-datepicker': {title: 'DatePicker', md: "# DatePicker\n\nA month-grid calendar — prev/next month, today tinted, selection filled.\n\n%%live:buiDate%%\n\n## API\n\n| Prop | Type | Notes |\n| --- | --- | --- |\n| `value` | Date \\| null | Selected day |\n| `onChange` | (Date) => void | Fires on day press |\n\nWeeks start Monday; the view month follows `value` on mount and the arrows after that."},

    'bui-citation': {title: 'Cite', md: "# Cite\n\nInline citation popovers — a superscript number in running text that opens the retrieved chunk and its source. Built on the `Popover` primitive.\n\n%%live:buiCitation%%\n\n## Parts\n\n| Part | Role |\n| --- | --- |\n| `<Cite n>` | The superscript trigger + popover shell |\n| `<Cite.Quote>` | The retrieved passage, rule-marked |\n| `<Cite.Source kind>` | File badge — `PDF` red, `CSV` green, `WEB` teal |\n\nPairs with [ContextCards](#) — same source-badge vocabulary, different zoom level."},

    'bui-popover': {title: 'Popover · Dropdown', md: "# Popover · Dropdown\n\nThe floating primitives the rest of the kit builds on. `Popover.Trigger` clones its child and attaches the toggle (react-aria's `asChild` pattern) — any element can be a trigger. Outside-click dismisses.\n\n%%live:buiPopover%%\n\n## Parts\n\n| Part | Role |\n| --- | --- |\n| `<Popover>` / `<Dropdown>` | Root — owns open state, anchors positioning |\n| `<Popover.Trigger>` | Clones its single child, adds onClick |\n| `<Popover.Content align width>` | Free-form floating panel |\n| `<Dropdown.Menu align width>` | Menu-shaped panel |\n| `<Dropdown.Item icon kbd danger onSelect>` | Row; closes the menu on select |\n| `<Dropdown.Separator>` | Divider |\n\n`Cite` and the docs' own model picker are just compositions of these."},

    'bui-toast': {title: 'Toast', md: "# Toast\n\nSonner-style toasts — background work lands bottom-right as a **stack**: the newest toast sits in front, older ones peek out behind it, and hovering the stack fans it out. Auto-dismiss timers pause while you hover.\n\n%%live:buiToast%%\n\n## API\n\n| Part | Role |\n| --- | --- |\n| `<ToastProvider max>` | Owns the stack; renders it bottom-right of itself |\n| `useToast().push({tone, title, detail, duration})` | Enqueue from any descendant |\n| `useToast().dismiss(id)` | Programmatic dismiss (`push` returns the id) |\n\nTones: `info` blue, `success` green, `error` red. Default duration 4.2s, stack caps at 4, each toast carries its own ✕."},

    'bui-skeleton': {title: 'Skeleton', md: "# Skeleton\n\nAn **automatic** skeleton — wrap any rendered subtree in `<Skeleton loading>` and it measures the real layout (text lines, avatars, chips, images, buttons) and generates matching shimmer blocks. No hand-built placeholder to maintain, and nothing jumps on resolve because the skeleton *is* the layout.\n\n%%live:buiSkeleton%%\n\n## API\n\n| Prop | Type | Notes |\n| --- | --- | --- |\n| `loading` | boolean | `true` shows the generated skeleton; `false` fades the content in |\n| `children` | node | The real content — rendered invisibly while loading so it can be measured |\n\nText nodes become per-line bars; elements with a background (chips, avatars, images) become blocks with their real border-radius. Manual primitives remain for edge cases: `<Skeleton w h r>`, `Skeleton.Text lines`, `Skeleton.Avatar size`."},

    'bui-model-picker': {title: 'ModelPicker', md: "# ModelPicker\n\nA model switcher for composer bars — a compact trigger chip that opens a panel with a provider rail (star = favorites, one glyph per provider), live search, and a keyboard-shortcut column.\n\n%%live:buiModelPicker%%\n\n## API\n\n| Prop | Type | Notes |\n| --- | --- | --- |\n| `models` | `{id, name, provider, source}[]` | The full catalog |\n| `value` / `onChange` | string | Controlled selection |\n| `favorites` | string[] | Initial starred ids |\n\n## Behavior\n\n- Rail filters by provider; press the active glyph again to clear. ★ shows favorites only.\n- ⌘1–⌘9 select the first nine visible rows; `esc` closes; outside-click dismisses.\n- Stars toggle in place and feed the ★ rail view.\n\nComposes with [PromptBar](#) — mount the trigger in its control row."},

    'bui-kbd': {title: 'Kbd', md: "# Kbd\n\nKeyboard hints — a tiny primitive the palette, menus, and shortcut lists all share.\n\n%%live:buiKbd%%\n\n## API\n\n`<Kbd>⌘K</Kbd>` — mono, bordered, bottom-weighted like a real keycap. Used by `CommandMenu.Item` and `Dropdown.Item` via their `kbd` prop."},

    'workbench-shell': {title: 'WorkbenchShell', md: "# WorkbenchShell\n\nThe Workbench scaffold as a **compositional container**. The shell owns the width class and every region's open state; you compose the regions as slots, and each slot child reads that state through context — no render props, no prop drilling.\n\n```tsx\nimport { WorkbenchShell, useWorkbenchShell } from \"./workbench.tsx\"\n\nfunction App() {\n  return (\n    <WorkbenchShell tint=\"#0A84FF\">\n      <WorkbenchShell.Sidebar><ThreadList/></WorkbenchShell.Sidebar>\n      <WorkbenchShell.Main><Chat/></WorkbenchShell.Main>\n      <WorkbenchShell.Dock><TerminalDock/></WorkbenchShell.Dock>\n      <WorkbenchShell.DockSheet><TermBody/></WorkbenchShell.DockSheet>\n      <WorkbenchShell.Panel><SurfacePanel/></WorkbenchShell.Panel>\n      <WorkbenchShell.TabBar><SurfaceTabBar/></WorkbenchShell.TabBar>\n    </WorkbenchShell>\n  )\n}\n\n// Any child, at any depth, asks the shell what it needs:\nfunction TerminalDock() {\n  const { termH, setTermH, setTerm } = useWorkbenchShell()\n  return <Dock h={termH} onResize={setTermH} onClose={() => setTerm(false)}/>\n}\n```\n\n## Reading the shell\n\n`useWorkbenchShell()` is one line over the context — `use(WorkbenchShell.Context)`. React 19's `use()` reads context in a component body, and on React 18 `useContext` has the identical call shape, so the kit exports `use` and both work:\n\n```tsx\nimport { use } from \"./touchkit.tsx\"     // React.use ?? React.useContext\nconst { compact, panel, setPanel } = use(WorkbenchShell.Context)\n```\n\nWhy this and not `{ctx => …}`: slot children stay ordinary components — they can be moved, memoized, or reused outside the shell — and only the components that actually read a region re-render when it changes.\n\n## Slots\n\n| Slot | Regular / medium | Compact |\n| --- | --- | --- |\n| `Sidebar` | 242px column, toggleable | Overlay sheet (`sideSheet`) |\n| `Main` | Center column | Center column |\n| `Dock` | Inline resizable dock under Main | — |\n| `DockSheet` | — | Content inside a SnapSheet |\n| `Panel` | Right column (regular) / right drawer (medium) / fullscreen (`full`) | Full-screen tab |\n| `TabBar` | — | Bottom tab bar |\n\n## ctx\n\n`{wc, compact, side, setSide, sideSheet, setSideSheet, term, setTerm, termH, setTermH, panel, setPanel, tab, setTab, full, setFull}`\n\nThe [Workbench demo](Workbench.dc.html) root is literally this composition — its header, sidebar, terminal, and surface panel are ordinary slot children that each call `useWorkbenchShell()`.\n\n## Composer attachments\n\nThe Workbench Composer takes pasted images: thumbnails appear above the input; click one to open a lightbox with a **PencilKit** canvas over the image; **Save annotation** flattens the markup into the PNG that gets sent."},

    'chat-shell': {title: 'ChatShell', md: "# ChatShell\n\nThe chat demo's scaffold as a compositional container. Rail and channel column render as columns when wide and collapse into a single hamburger drawer below the breakpoint.\n\n```tsx\nimport { ChatShell, useChatShell } from \"./chatkit.tsx\"\n\nfunction App() {\n  return (\n    <ChatShell breakpoint={880}>\n      <ChatShell.Rail><WorkspaceRail/></ChatShell.Rail>\n      <ChatShell.Nav><ChannelNav/></ChatShell.Nav>\n      <ChatShell.Main><ChannelMain/></ChatShell.Main>\n    </ChatShell>\n  )\n}\n\nfunction ChannelNav() {\n  const { compact, setNavOpen } = useChatShell()   // = use(ChatShell.Context)\n  return <ChannelCol onClose={compact ? () => setNavOpen(false) : null}\n    onPick={() => setNavOpen(false)}/>\n}\n```\n\nSlot children are plain elements. Anything that needs the shell calls `useChatShell()` — a one-liner over `use(ChatShell.Context)` (React 19 `use()`, `useContext` on 18). The old `{ctx => …}` render-prop form still renders, but nothing in the kit uses it anymore.\n\n## Slots & ctx\n\n| Slot | Wide | Compact |\n| --- | --- | --- |\n| `Rail` | Left workspace rail | Inside the hamburger drawer |\n| `Nav` | Channel column | Inside the hamburger drawer |\n| `Main` | Everything else — header, messages, thread SideDrawer | Same, with a hamburger button |\n\nctx: `{w, compact, navOpen, setNavOpen}` — `w` is the **container** width, so the shell works inside any frame.\n\n## Thread behavior\n\nIn the [Chat demo](Chat Demo.dc.html): picking a thread in the **channel column** opens it **full-view** in the main column (with an \"Open as drawer\" action); clicking a **thread preview card** under a message opens it in a TouchKit **SideDrawer** (docked ≥1180px, overlay below)."}
  }
};
