# Migrating to 6.0

BL UI 6.0 changes two things, and moves one. Every interactive part is now built on [UI SDK](https://ui-sdk.dev) instead of react-aria-components, and its API is UI SDK's: `onClick` instead of `onPress`, `disabled` instead of `isDisabled`, `value` and `onValueChange(value, details)` instead of keys and selections, and roots with named parts instead of wrappers that take "the first child". The library is smaller: components that did the same job as another one were merged into it (5.16's 118 component modules are 98, plus the four new diagram modules), and every concept has one prop name across the kit. And Docstream, the Markdown renderer and editor behind MarkdownView, MarkdownEditor and the Composer, is part of the package now: `@brett_lamy/docstream` and `@brett_lamy/docstream-editor` stop at 2.0.1. This page lists every change, with the before and after, so you can move a 5.x app to 6.0 from here.

Read it in this order:

1. [What changed and why](#what-changed-and-why): UI SDK, React 19, the `ui-sdk` cascade layer and the install lines.
2. [Docstream is part of the library](#docstream-is-part-of-the-library) and [the package surface](#the-package-surface): what you import from where.
3. [Changes that apply everywhere](#changes-that-apply-everywhere): the UI SDK vocabulary, which is most of a migration.
4. [One spelling per concept](#one-spelling-per-concept): the prop names every component now shares.
5. [Components that merged, moved or were renamed](#components-that-merged-moved-or-were-renamed): one table from every removed or renamed module, export and prop to what you write now.
6. The family sections, from [Buttons and toggles](#buttons-and-toggles) on: what changed inside each component that kept its name.
7. [New in 6.0](#new-in-6-0) and [What looks different](#what-looks-different).
8. Only if you built on the unpublished branch where the diagrams were developed: [Diagrams from the preview](#diagrams-from-the-preview).

Most tokens, radii, springs and sizes are the same as in 5.x. What you change is the props you pass, the parts you compose, the names you import, and any CSS of yours that selected react-aria's state attributes. The places where the look changed on purpose are listed at the end.

## What changed and why

**UI SDK owns behavior.** Keyboard, focus, selection, dismissal, popups and their placement, drag and drop, and ARIA all come from UI SDK (`@ui-sdk/core` for the framework-free behaviors, `@ui-sdk/react` for the React parts). BL UI owns the look, the tokens and the iOS-flavored containers. A component that UI SDK ships (Button, Dialog, Popover, Menu, Select, Combobox, Tabs, Tooltip, Toast, Tree…) is UI SDK's part with BL UI's classes, so its props, parts and data attributes are the ones in UI SDK's docs. A component UI SDK does not ship (NavigationStack, SplitView, AdaptivePane, Sidebar…) is a primitive built from UI SDK's behaviors, with the same conventions. Why UI SDK, and how the two fit, is on [Built on UI SDK](https://blamy.github.io/ui/#/ui-sdk).

**React 19 is required.** `react` and `react-dom` 19, and `@types/react` 19.2.10 or newer with TypeScript. `ref` is an ordinary prop on every part.

**react-aria is gone.** Neither the package nor a registry copy imports `react-aria`, `react-aria-components`, `@internationalized/date` or `react-resizable-panels` any more. Remove them from your app if nothing else of yours uses them. Dates are ISO strings (see [Dates](#dates)) and colors are CSS strings (see [Color](#color)).

### The `ui-sdk` cascade layer

UI SDK adds a little CSS to the page at runtime, in a cascade layer named `ui-sdk`: a rule that keeps closed parts hidden (`[data-slot][hidden]`, except `hidden="until-found"`), a reset for popup boxes (`[popover]` inset, size, margin, padding, border and background), the default backdrop of a modal sheet, the toast region's fixed position, and a few part defaults. Because it is in a layer, any style that is not in a layer, and any layer declared after it, wins over it.

Cascade layers rank in the order they are first declared, and a layer added at runtime without a declaration comes last, above every other layer. BL UI's own stylesheet (`@brett_lamy/ui/styles.css`) starts with `@layer ui-sdk, theme, base, components, docstream, utilities;`, so when it is the first stylesheet on the page there is nothing to do. When your app has its own Tailwind build (always, with a registry install), declare the layer at the very top of your global stylesheet, above `@import "tailwindcss"`, so your layers and utilities stay above UI SDK's rules:

```css
/* src/index.css */
@layer ui-sdk;
@import "tailwindcss";
```

A CSS Module loads too late to come first, so keep the line in the global stylesheet. With a Content Security Policy that has no `'unsafe-inline'` in `style-src`, give UI SDK your nonce with `<meta property="csp-nonce" nonce="…">` in the page's `<head>` (see "Content Security Policy" in UI SDK's [Styling and Animation](https://ui-sdk.dev) docs).

### Installing

BL UI uses its fork of UI SDK, published as `@brett_lamy/ui-sdk-core` and `@brett_lamy/ui-sdk-react` and installed under upstream's names through npm aliases. The fork is upstream plus layer hosts (popups contained in an element such as `BLProvider`'s root), a `when` option on `bindLayer`, and the kernel type `SlotProps` exported from `@ui-sdk/core/renderer`; the other behaviors the containers need (size classes, the navigation stack, edge swipes, the platform back, pull to refresh) are BL UI's own, in `@/lib` (see [Built on UI SDK](https://blamy.github.io/ui/#/ui-sdk)). Every import, in the kit and in your code, is `@ui-sdk/core/…` and `@ui-sdk/react/…`.

With the npm package, `@brett_lamy/ui` depends on the two aliases. List them in your app too, at the version it pins, so your own `@ui-sdk/react` imports share the kit's copy (and update `react` and `react-dom` to 19 first):

{% command %}npm install @brett_lamy/ui @ui-sdk/core@npm:@brett_lamy/ui-sdk-core@0.1.0-beta.2.bl.1 @ui-sdk/react@npm:@brett_lamy/ui-sdk-react@0.1.0-beta.2.bl.1{% endcommand %}

Then import `@brett_lamy/ui/styles.css` once, and `@brett_lamy/ui/docstream/styles.css` too if you render Markdown ([Installation](https://blamy.github.io/ui/#/installation) says which components need it); no JavaScript module of the package imports CSS.

With the registry, the copied source imports `@ui-sdk/core` and `@ui-sdk/react`, so your app needs the same two aliased dependencies. Add them before the first `shadcn add`:

{% command %}npm install @ui-sdk/core@npm:@brett_lamy/ui-sdk-core@0.1.0-beta.2.bl.1 @ui-sdk/react@npm:@brett_lamy/ui-sdk-react@0.1.0-beta.2.bl.1{% endcommand %}

which writes:

```json
{
  "dependencies": {
    "@ui-sdk/core": "npm:@brett_lamy/ui-sdk-core@0.1.0-beta.2.bl.1",
    "@ui-sdk/react": "npm:@brett_lamy/ui-sdk-react@0.1.0-beta.2.bl.1"
  }
}
```

Pin both to the same version: `@ui-sdk/react` depends on `@ui-sdk/core`, and the app, the kit and any UI SDK component of your own must share one copy of the core. A package that declares `@ui-sdk/core` as a peer dependency resolves it to your aliased copy. Docstream and its editor (behind `MarkdownView`, `MarkdownEditor`, `Composer` and the replay, STL and Strudel parts) are part of `@brett_lamy/ui` now, so they run on the kit's core with nothing to set up. Your own code imports UI SDK the usual way: `import { Menu } from '@ui-sdk/react/menu'`.

## Docstream is part of the library

Docstream (the GitBook-flavored Markdown and AI-stream renderer, with its docs sites, demos, replays, 3D models and Strudel player) and the Docstream editor (the Tiptap editor for the same Markdown) were two packages of their own, `@brett_lamy/docstream` and `@brett_lamy/docstream-editor`, which BL UI depended on. In 6.0 they are part of `@brett_lamy/ui`, built, tested and published with it: every entry they had is the same module under the library's name, their components and Markdown are 2.0.1's, and their props take the kit's spellings (the second table below). The two npm packages stop at 2.0.1, the version 6.0 was built with; nothing is published under those names again, and docstream's version is the library's from here on.

| 5.x (docstream 2.0.1) | 6.0 |
| --- | --- |
| `npm install @brett_lamy/docstream @brett_lamy/docstream-editor` | nothing: `npm install @brett_lamy/ui` brings both |
| `@brett_lamy/docstream` | `@brett_lamy/ui/docstream` |
| `@brett_lamy/docstream/<entry>`: `/gitbook`, `/streamdown`, `/reference`, `/properties`, `/tasks`, `/assets`, `/openapi`, `/replay`, `/replay/demo`, `/video`, `/stl`, `/strudel`, `/tui`, `/viz`, `/playground`, `/source`, `/demo`, `/vite`, `/site`, `/xstate`, `/tscircuit` | `@brett_lamy/ui/docstream/<entry>`, the same entries; new: `/xstate/machine` (`xstateToMermaid`; `parseXState` is the kit's, on `@brett_lamy/ui/lib/state-diagram-source`) and `/capnp` (the ` ```capnp ` fence, which draws a workerd config on a [CloudflareDiagram](https://blamy.github.io/ui/#/cloudflare-diagram)) |
| `@brett_lamy/docstream/styles.css`, `/site/styles.css`, `/properties/styles.css`, `/tasks/styles.css` | `@brett_lamy/ui/docstream/styles.css`, `/site/styles.css`, `/properties/styles.css`, `/tasks/styles.css` |
| `@brett_lamy/docstream-editor`, `/editor`, `/convert` | `@brett_lamy/ui/docstream-editor`, `/editor`, `/convert` |
| `@brett_lamy/docstream-editor/styles.css` | already inside `@brett_lamy/ui/styles.css` (in a layer): import `@brett_lamy/ui/docstream-editor/styles.css` only in an app that doesn't load BL UI's stylesheet, never both |
| `xstate`, a dependency of docstream | an optional peer: install `xstate` (^5.33.3) if your pages draw ` ```xstate ` fences; it loads when one is shown |
| `lucide-react`, a dependency of docstream (its icons) | gone: docstream and the editor draw with the kit's `Icon` (`@brett_lamy/ui/lib/icon`), so a document's glyphs match the kit's |
| `TASK_STATE_ICONS[state]`, a lucide component | an `IconName`: `<Icon name={TASK_STATE_ICONS[state]} />` |
| `SlashItem.icon`, `TriggerMenuEntry.icon`: a lucide component (`LucideIcon`) | an `IconName` of the kit's set (`icon: "warning"`) |
| `MarkdownView` imported docstream's stylesheet | it imports no CSS (so the package loads in plain Node): import `@brett_lamy/ui/docstream/styles.css` beside `@brett_lamy/ui/styles.css`; registry items add it to your CSS |
| docstream's hint and chip colors, `--gb-primary`, `--gb-border`, `--gb-radius`: fixed values | your theme's `--primary` (info), `--success`, `--warning`, `--destructive`, `--border` and `--radius`, with the old values as fallbacks; set `--gb-success` (and the rest) to keep a color of your own |

Docstream's props follow the kit's spellings now (the "One spelling per concept" table below), with no aliases: 2.0.1's names are gone.

| docstream 2.0.1 | 6.0 |
| --- | --- |
| `GitbookStreamdown`, `MarkdownContent`, `DocsRenderer`, `DocsSite` `isStreaming`; `GitbookStreamdown` `isAnimating` | `streaming`; `animating` |
| `TuiPreview` `isStreaming`, `onStatusChange`; `theme={{ mode }}`; `TuiEmbed` | `streaming`, `onStateChange`; `appearance` (`auto` by default: the terminal follows the page or its ThemeScope, so **on a light page it is light now**: pass `appearance="dark"` for the black terminal; `theme` is `{ background, foreground }` only); `TuiPreview`. The root also takes `ref` and the `<section>`'s props |
| `ReplayPreview` `playerRef`; `disableDevtools`; `active={false}`; `lazy`; `onMarkerPress(marker)`; `ReplayEmbed` | `ref` (the handle); `devtools={false}`; `mounted={false}`; `mounted` (`'visible'` by default, `true` at once); `onMarkerAction(marker, details)`; `ReplayPreview`. The root also takes its `<div>`'s props |
| `requestName` from `/replay` | `@brett_lamy/ui/lib/request-table-model`, the same function RequestTable uses |
| `ReplayPreview` and `ReplayStage` `autoplay` | `autoPlay`, React's spelling (as on `<video>`). The `{% embed … autoplay="true" %}` attribute in Markdown is unchanged |
| `StlViewer` `color` | `tint` |
| `DocsSite` `theme` / `defaultTheme` (`'system'`) / `onThemeChange` / `themeToggle` / `themeStorageKey` / `applyThemeTo`; `accentColor`; type `DocsSiteTheme` | `appearance` / `defaultAppearance` (`'auto'`) / `onAppearanceChange` / `appearanceToggle` / `appearanceStorageKey` / `applyAppearanceTo`; `tint`; `DocsSiteAppearance` |
| `StrudelPlayer` `showCode`, `showRack`; `onCodeChange(code, { reason, event?, rack? })` | `defaultCodeOpen` (or `codeOpen` / `onCodeOpenChange`), `defaultRackOpen` (or `rackOpen` / `onRackOpenChange`); `onCodeChange(code, details)` with UI SDK's `ChangeDetails` (`cancel()` keeps the code) and `details.rack` |
| `StrudelRack` `code`, `onChange`, `layout`; `Knob` / `Fader` `onChange`, `size="md"` | `value`, `onValueChange`, `defaultVariant`; `onValueChange`, `size="default"` |
| `StrudelRack`, `RackGrid`, `StepGrid`, `Knob`, `Fader`, `STRUDEL_PARAMS`, `trackName`, their types (`ControlValueChangeDetails`, `ControlValueChangeReason`, `Range`, …) and the syntax tree (`parseStrudel`, `parseMini`, …) from `/strudel` | from `/strudel/rack`, the entry that brings the parser (acorn); `/strudel` keeps the player and the runtime |
| `GitbookEditor` `onChange(markdown)`, `autofocus`; `ReactDemoEditor` `onChange(files)` | `onValueChange(markdown, details)`, `autoFocus`; `onValueChange(files, details)`: UI SDK's `ChangeDetails` (reason `input-change`, the DOM `event` behind the edit, `cancel()` puts it back), as MarkdownEditor's `onValueChange` |
| `TaskCheckbox` `onChange(state)`; `DocumentProperties` `onChange(properties)` | `onValueChange(state, details)` (reason `press` or `item-press`); `onValueChange(properties, details)` (reason `property-change`, `property-add`, `property-remove` or `yaml-change`) |
| `ReplayPreview` and `ReplayStage` `initialTime`; `ReplayStage` `showMouse`; `DocsSite` `initialPath` | `defaultTime`; `cursor`, as the player's; `defaultPath` |
| `TuiPreview`'s status line `data-tone="error"`; the editor's link button `data-active`, and its tabs' content `data-active` (the selected tab's index) | `data-tone="destructive"`; `data-pressed`, as the other format buttons; `data-selected` |

Remove the two packages from your `package.json` and rename the imports: a search and replace of `@brett_lamy/docstream` with `@brett_lamy/ui/docstream` does all of it (it turns `@brett_lamy/docstream-editor` into `@brett_lamy/ui/docstream-editor` too). Import `@brett_lamy/ui/docstream/styles.css` once at your app's entry, as you did with 2.0.1, whenever you render Markdown: `MarkdownView` (and Conversation, ReplayPreview, StlViewer, StrudelPlayer, TuiPreview) no longer import it, so that every JavaScript entry of the package loads in plain Node; the registry items add the `@import` to your CSS. Docstream's other optional peers are the library's optional peers now, each loaded only by its own entry: `@agent-wasm/core` (`/playground`), `@brett_lamy/viz-engine` (`/viz`) and `vite` (`/vite`). The ` ```xstate ` fence also keeps a machine's `invoke` now, drawn and never run.

**An app that used only docstream** (a docs site, an AI answer pane) installs `@brett_lamy/ui` and imports only `@brett_lamy/ui/docstream…` and `@brett_lamy/ui/docstream-editor…`. React 19 is the only peer it must provide: UI SDK comes with the library. Each entry keeps its own module graph (a test in the library holds every docstream entry to it), so the bundle carries no kit component it doesn't import, and it needs neither the kit's `styles.css` nor Tailwind: docstream styles itself with `@brett_lamy/ui/docstream/styles.css`, and the editor with `@brett_lamy/ui/docstream-editor/styles.css`. What it does gain is the library's dependencies in `node_modules` (Tiptap, framer-motion, the GPU parsers and the rest), whether or not it imports them.

With the registry, docstream isn't copied: an item built on it (`markdown-view`, `markdown-editor`, `composer`, `replay-preview`, `tui-preview`, `stl-viewer`, `strudel-player`, and the blocks Apple Music, Apple Notes, Apple Reminders, Loop QA, Replay Canvas, Strudel Studio and Time Machine) imports `@brett_lamy/ui/docstream…` and adds `@brett_lamy/ui` to your dependencies, where it used to add `@brett_lamy/docstream`.

## The package surface

Every module has its own entry, at the registry's path under the package name, so a name has one import path in both installs. `node tools/registry/build.mjs` writes the entries into the package's `exports` from the same import graph that builds the registry.

| Entry | What it holds | In a registry install |
| --- | --- | --- |
| `@brett_lamy/ui` | the components, their parts, cva recipes, controllers and the kit's own hooks | the same names, each from its module |
| `@brett_lamy/ui/<module>` | every component module: `@brett_lamy/ui/dialog`, `@brett_lamy/ui/data-table`; a folder is one module, by its `index.ts`: `@brett_lamy/ui/composer`, `@brett_lamy/ui/pencilkit` | `@/components/ui/<module>` |
| `@brett_lamy/ui/lib/<module>` | the library modules with an API of their own: the engines (`lib/vault`, `lib/pglite`, `lib/ffmpeg`, `lib/tailscale`, `lib/session-recorder`, `lib/cron`…), the models (`lib/diagram-model`, `lib/state-diagram-model`…), `lib/theme`, `lib/motion`, `lib/icon`, `lib/canvas-math`, `lib/diagram-layout`, `lib/change-details`, and the kit's behaviors (`lib/size-class`, `lib/container`, `lib/stack`, `lib/back`, `lib/edge-swipe`, `lib/pull-to-refresh`, `lib/scroll-edge`, `lib/presence`, `lib/controllable-state`, also on the root) | `@/lib/<module>` |
| `@brett_lamy/ui/opencode` | OpenCode's runtime loaders, hosts and vault stores | — |
| `@brett_lamy/ui/cloudflare` | CloudflareDiagram and its parts with the Cloudflare catalog, systems, `wrangler.jsonc` and workerd readers: their one import path, and the only entry that reaches the catalog | — |
| `@brett_lamy/ui/docstream/<entry>`, `@brett_lamy/ui/docstream-editor/<entry>` | Docstream and its editor ([above](#docstream-is-part-of-the-library)) | not copied: the item installs `@brett_lamy/ui` |
| `@brett_lamy/ui/styles.css`, `@brett_lamy/ui/theme.css` | the stylesheet, and the optional iOS palette | the `bl-ui` and `bl-theme` items |

A module that is the kit's wiring between its own modules (a context, a store, internal helpers) has no entry: a registry install copies it with the item that owns it, and none of its names is package API.

What left the root: the engine modules' functions and types (`createVault`, `PGliteProvider`, `useQuery`, `parseCsv`, `createFfmpeg`, `TailscaleProvider`…) are on their `@brett_lamy/ui/lib/<module>` entry only (a hook stays on the root too: `useSessionRecording`, `usePersistentState`, `useTimeParse`…); the canvas math is on `@brett_lamy/ui/lib/canvas-math`; OpenCode's runtime on `@brett_lamy/ui/opencode`; Docstream's parsers, helpers and demo data on `@brett_lamy/ui/docstream/<entry>`; and the kit's class fragments, contexts and plumbing (`FONT`, `BARH`, `pressable`, `IC`, `BLSafeCtx`, `chromeStore`…) are internal. [The table of renames](#components-that-merged-moved-or-were-renamed) gives every one of those names its new path, from the `@brett_lamy/ui/tui` row on. `@brett_lamy/ui/tui` itself is `@brett_lamy/ui/tui-preview`.

## Changes that apply everywhere

Every component follows the same rules, so most of a migration is the same handful of renames.

| 5.x (react-aria) | 6.0 (UI SDK) | Notes |
| --- | --- | --- |
| `onPress={fn}` | `onClick={fn}` | A native `MouseEvent`, not a `PressEvent` (`e.pointerType` is gone; read `e.nativeEvent`). `onPressStart`, `onPressEnd`, `onPressChange`, `onPressUp` are gone: use `onPointerDown` / `onPointerUp`. |
| `isDisabled` | `disabled` | |
| `isReadOnly`, `isRequired`, `isInvalid` | `readOnly`, `required`, `invalid` on a `Field` (or `aria-invalid`) | |
| `isOpen`, `defaultOpen`, `onOpenChange(isOpen)` | `open`, `defaultOpen`, `onOpenChange(open, details)` | On the **root** (`Dialog`, `Popover`, `DropdownMenu`, `Select`…), not on a trigger wrapper or the content. |
| `isSelected`, `defaultSelected`, `onChange(isSelected)` | `checked` / `defaultChecked` / `onCheckedChange(checked, details)` (Switch, Checkbox) or `pressed` / `defaultPressed` / `onPressedChange(pressed, details)` (Toggle) | |
| `selectedKey(s)`, `defaultSelectedKey(s)`, `onSelectionChange(keys)` | `value`, `defaultValue`, `onValueChange(value, details)` | A single value is `T \| null`; a multiple one is `T[]`. Never a `Set`. `multiple` replaces `selectionMode="multiple"`. |
| `onChange(value)` on a value control | `onValueChange(value, details)` | `onChange` on an input is the native event handler again. |
| `minValue`, `maxValue` | `min`, `max` | |
| item `id`, `textValue` | item `value`, `label` | |
| `XSection title="…"` | `XGroup` + `XGroupLabel` | |
| `placement="bottom start"`, `offset`, `crossOffset` | `side="bottom" align="start"`, `sideOffset`, `alignOffset` | `start`/`end` sides are `side="inline-start"` / `"inline-end"`. |
| `isDismissable={false}`, `isKeyboardDismissDisabled` | `dismissible={false}` on the root | |
| `as`, `asChild`, `elementType`, wrapper components | `render={<a href="…" />}` | See [the render prop](#the-render-prop). |
| `composeRenderProps(className, fn)` | `cx(ours, className)` from `@/lib/utils` | |
| render props `{ isSelected, isHovered, isPressed, isFocusVisible }` | state `{ checked, pressed, selected, disabled, open… }` | Hover, press and focus are not state: use `hover:`, `active:`, `focus-visible:`. |
| `ref` to an imperative handle | a controller (`createXController()`, passed as `controller`) | See [controllers](#controllers). |
| `data-slot` values of our own | UI SDK's (`dialog-content`, `menu-item`, `tabs-tab`…) | Selectors in your CSS and tests change; each family's table lists them. |

```tsx
// 5.x
<Switch checked={wifi} onChange={setWifi} />
<Button variant="secondary" isDisabled={!dirty} onPress={save}>Save</Button>
<ToggleGroup selectionMode="single" selectedKeys={[view]} onSelectionChange={(keys) => setView([...keys][0] as View)}>
  <ToggleGroupItem id="list">List</ToggleGroupItem>
</ToggleGroup>

// 6.0
<Switch checked={wifi} onCheckedChange={setWifi} aria-label="Wi-Fi" />
<Button variant="secondary" disabled={!dirty} onClick={save}>Save</Button>
<ToggleGroup<View> value={[view]} onValueChange={([next]) => next && setView(next)} aria-label="View">
  <ToggleGroupItem value="list">List</ToggleGroupItem>
</ToggleGroup>
```

Defaults that used to name a control for you (`aria-label="Toggle"` on a Switch, `"Segmented control"` on a Segmented) are gone: name every control with a label part, `aria-label`, or by placing it in a `ListRow`, which still names its control.

### State selectors

Hover, press and keyboard focus are the platform's pseudo-classes; component state is UI SDK's data attributes. Translate any class or CSS of yours that used react-aria's attributes:

| 5.x | 6.0 |
| --- | --- |
| `data-hovered:` | `hover:` |
| `data-focus-visible:` | `focus-visible:` (a slider thumb: `has-focus-visible:`) |
| `data-pressed:` (held down) | `active:` |
| `data-focused:` | `focus:` or `focus-within:` |
| `data-selected` on Switch, Checkbox, Radio, Segmented | `data-checked` (Checkbox also `data-indeterminate`) |
| `data-selected` on Toggle, ToggleGroupItem, PlainToggleButton (now UI SDK's `Toggle`) | `data-pressed` (a toggle that is on) |
| `data-focused` on a menu or list row | `data-highlighted` |
| `data-expanded` (disclosure) | `data-open` / `data-closed` |
| `data-entering` / `data-exiting` | `data-starting-style` / `data-ending-style` |
| `data-placement` | `data-side` (and `data-align`) |
| `--trigger-width`, `--trigger-anchor-point` | `--anchor-width`, `--transform-origin` |
| `data-current` | `aria-[current=page]:` on anything that writes `aria-current` (Sidebar, List and Tree rows); SplitViewItem, Breadcrumb and LogList write `data-current` as well |

`data-open`, `data-disabled`, `data-selected` (on options, tabs, rows), `data-invalid` and `data-dragging` remain; a part's own page lists its attributes. Enter and exit are transitions now: put the closed look on `data-starting-style` and `data-ending-style`, and the part stays mounted until its exit transition ends.

### Change details

Every change callback gets a second argument, `details`:

| Field | Meaning |
| --- | --- |
| `reason` | Why it changed: `"item-press"`, `"escape-key"`, `"outside-press"`, `"swipe"`, `"input-change"`, `"drag"`, `"imperative"` (a controller)… Each component lists its reasons. |
| `source` | How the user caused it: `"mouse"`, `"touch"`, `"pen"`, `"keyboard"`, `"virtual"`, `"agent"` or `"programmatic"`. For analytics and focus choices, not for behavior. |
| `event` | The DOM event behind it, when there is one. |
| `cancel()` | Stops the change (an uncontrolled component keeps its value; a dialog stays open). `details.canceled` says whether it was called. |

```tsx
<Dialog
  onOpenChange={(open, details) => {
    if (!open && details.reason === 'outside-press' && dirty) details.cancel()
  }}
>…</Dialog>
```

A `setState` still fits (`onOpenChange={setOpen}`), since it ignores the second argument. In tests, `toHaveBeenCalledWith(false)` becomes `toHaveBeenCalledWith(false, expect.anything())`.

### The render prop

A part renders one element. To make it another element, or one of your components, pass `render`: the part's props, ref and state attributes merge onto it, and the part's children become its children.

```tsx
// 5.x: the trigger was "the first pressable child"
<PopoverTrigger>
  <Button variant="secondary">Open</Button>
  <PopoverContent placement="bottom start">…</PopoverContent>
</PopoverTrigger>

// 6.0: a root, a trigger part rendered as the kit's Button, a content part
<Popover>
  <PopoverTrigger render={<Button variant="secondary" />}>Open</PopoverTrigger>
  <PopoverContent side="bottom" align="start">…</PopoverContent>
</Popover>
```

A popup trigger is already a button; `render={<Button … />}` gives it the kit's look, size and focus ring, and the two merge into one element (the trigger's ARIA and the Button's classes), so it is one control to a screen reader or an agent. Every docs page and story writes triggers this way. `render` also changes the element itself, as for links: `<Button render={<a href="/docs" />}>Docs</Button>`, `<DropdownMenuItem render={<a href="/docs" />}>`, `<TabsTab render={<a href="…" />}>`.

### `className` and `style` as functions of state

A UI SDK part's `className` and `style` may be a string or a function of the part's state, so `composeRenderProps` is gone. To add classes to a part in a component of your own, merge with `cx` from `@/lib/utils` (`cn` for plain elements); the caller's classes merge last and win a conflict:

```tsx
import { cx } from '@/lib/utils'

function QuietToggle({ className, ...props }: ToggleProps) {
  return <Toggle className={cx('rounded-ctl data-pressed:bg-secondary', className)} {...props} />
}

<Toggle className={(state) => (state.pressed ? 'text-primary' : 'text-muted-foreground')} />
```

### Controllers

To drive a component from outside (open a dialog after an async flow, move a command menu's highlight, scroll a log to a row), create its controller once and pass it as `controller`. Every write through a controller reports `reason: "imperative"`.

```tsx
const [dialog] = useState(() => createDialogController())
<Dialog controller={dialog}>…</Dialog>
dialog.close()   // onOpenChange(false, { reason: 'imperative' }); works even when dismissible={false}
```

Controllers replace the imperative `ref` handles of 5.x (`LogListHandle`, `RequestTableHandle`, `WorkspaceImperativeHandle`, `CommandMenu`'s `menuRef`). A controller works only while its component is mounted.

### Popups render in the layer host

Popups (dialogs, sheets, menus, popovers, tooltips, toasts) render into the nearest `BLProvider` root, which is marked as a layer host, instead of `document.body`. A dialog opened inside a framed app covers the frame, not the page; a modal one makes the rest of the frame inert and leaves page scroll alone. Pass `container` to a popup root to put it elsewhere. `useLayerHost()` returns the host. `<Sheet contained>` (a sheet that stays in its parent's box, `[data-slot=sheet-host]`) is a layer host too; `FloatingSheet` and AdaptivePane's drawer are contained Sheets.

### Size classes follow the container

`presentation="auto"` (the default of `Dialog`, and an option on `Popover`, `DropdownMenu`, `Select`, `Combobox`, `DatePicker`, `ColorPicker` and `FontPicker`) is a sheet when the nearest **size-class scope** is compact, and the popup's own presentation when it is medium or regular, whatever the screen. `AdaptivePane` and `Sidebar` default to `auto` too and pick their layout from the same scope (`Workspace`'s `auto` reads its own box). The scope is a React context: `BLProvider`'s root, `SplitView`, `NavigationStack`, `SidebarProvider`, `ArtifactChatContainer` and `SqlConsole` each measure their own box and provide it, so a popup written in a compact column is a sheet even though it renders into `BLProvider`'s root. With no scope around it, UI SDK's own rule decides (a small touch screen). For a frame of your own, measure it with `useSizeClass()` and wrap its children in `<SizeClassProvider value={sizeClass}>` (both from `@/lib/container`); a `data-size-class` attribute alone doesn't change how popups present. See [Layout hooks](https://blamy.github.io/ui/#/hooks-layout).

### Tests

UI SDK's text controls listen to the native `input` event: `fireEvent.change(input, { target: { value } })` no longer reaches `onValueChange`, so use `fireEvent.input`. Set `globalThis.__UI_SDK_STRICT__ = true` in a test file to turn UI SDK's development warnings (an unnamed control, a missing part) into failures.

## One spelling per concept

6.0 uses one prop name for one idea across the whole kit. When a 5.x prop of yours isn't in the tables below, look here first: most renames are one of these.

| Concept | The one spelling | What it replaces (examples) |
| --- | --- | --- |
| Size | `size: 'sm' \| 'default' \| 'lg'`. Extra steps only where a page documents them (Button `pill`, `icon-sm`, `icon`, `icon-lg`; ProgressRing `xl`); raw pixel numbers only on graphics with an intrinsic pixel size: Avatar, AvatarGroup, Spinner, ProgressRing, QRCode, NowPlayingBars and Icon. Buttons are 32 / 36 / 44px tall, fields 32 / 44 / 50px | `size="md"` (ProgressRing, CountdownRing, Terminal) → `default`; `size="compact"` (DebugToolbar) → `sm`; SqlEditor `size` → `rows`; `rowHeight` (ObjectTree, CallStack) → `density` |
| Look | `variant`. A boolean or a `tone` that picks a look is a variant, and an outline look exists wherever a filled one does | `List inset` → `variant="inset"`; `NavigationStackPage grouped` → `variant="grouped"`; Slider `tone="onDark"` → `variant="overlay" appearance="dark"`; FilterChip `tone="preview"` → `variant="preview"`; TailscaleStatusBadge `compact` → `variant="pill"`; FloatingSheet and ArtifactChatContainer `appearance="glass"` → `variant="glass"`; PencilCanvas `plain` → `variant="plain"`; CanvasFrame `dashed` → `variant="dashed"` |
| Semantic color | `tone: 'default' \| 'success' \| 'warning' \| 'destructive'` (plus `muted` where a quiet fill exists). Badge keeps shadcn's `variant` | ListRow `destructive` → `tone="destructive"`; Waveform `tone="primary"` → `className="text-primary"` |
| A caller's color | `tint` (any CSS color) | Avatar and SidebarItem `color` / `tone` → `tint`; Composer's boolean `tint` → `className="text-primary"` |
| Color scheme | `appearance: 'auto' \| 'light' \| 'dark'` | OpenCode `theme` → `appearance`; FloatingSheet and ArtifactChatContainer `tone` → `appearance` |
| Where | `side` and `align` (`'start' \| 'end'` on the inline axis). Never `position`, `placement`, `left` / `right` | IndexBar `side="left"` → `side="start"`; ArtifactChatContainer `chatSide="right"` → `"end"`; `fabPosition="bottom-right"` → `fabAlign="end"`; Composer `fabPosition` → `fabAlign`; CanvasMiniMap `position="top-right"` → `side="top"`; Workspace `tabPlacement="left"` → `tabSide="start"`; TabView `placement` → Tabs `side` |
| Density | `density: 'compact' \| 'default' \| 'comfortable'` | Tree `density="relaxed"` → `"comfortable"`; LogList, DataTable, Spreadsheet and List gain `default` |
| Busy | `pending` is an action in flight (and writes `data-pending`); `loading` is data that isn't here yet | SqlEditor `running` → `pending`; SchemaTree `isLoading` → Tree `loading` |
| Invalid | comes from `Field`. A control has an `invalid` of its own only when it can't be a Field control, and error text is a `FieldError`, never an `error` prop | NaturalTimeInput, FileUploadDropzone, MarkdownEditor `invalid` / `error` → `<Field invalid>` + `<FieldError>` |
| Presentation | `presentation`, with `'auto'` wherever a component can change presentation; `auto` reads the size-class scope | Sidebar `variant="overlay"` → `presentation="drawer"`; SideDrawer's `breakpoint` → AdaptivePane's `auto` |
| Inset-grouped card | `variant="inset"` (List, Listbox, DisclosureGroup); Separator's indent stays `inset` | `List inset` |
| An item was activated | `onAction(value, details)`; a single pressable keeps `onClick` | AvatarGroup `onSelect(index)` → `onAction(value, details)`; TailscaleExitNodes `onExitNode` → `onAction`; IndexBar `onLetter` → `onJump` |
| Current location | `current` (writes `aria-current`). A toggle is `pressed`, never `active` | Button `active` → `Toggle pressed`; ListRow `selected`, SidebarItem `active`, SplitViewItem's `selected` state, IndexBar `value` → `current`; Breadcrumb `selectedId` → `currentSibling` |
| Open state | `open` / `defaultOpen` / `onOpenChange(open, details)` | ArtifactChatContainer `chatOpen` / `onChatOpenChange` → `open` / `onOpenChange` |
| Empty collections | `emptyState?: ReactNode`, defaulting to the shared [`EmptyState`](https://blamy.github.io/ui/#/empty-state); never `emptyMessage` | Tree, ObjectTree, CallStack `emptyMessage` → `emptyState`; PencilCanvas `hint` → `emptyState`; `SplitViewEmpty` and `ConversationGreeting` → `EmptyState` |
| Row anatomy | `icon`, `title`, `description`, `trailing` | ListRow `leading` / `subtitle`; SplitViewItem `subtitle` / `badge`; SidebarItem `label` / `badge`; SidebarAccount (was Sidebar.Workspace) `name` / `detail` / `initial`; HoverCardHeader `media` / `subtitle` / `action`; ToolCall `detail` |
| Parts | flat `RootPart` exports with UI SDK's suffixes (`…Trigger`, `…Content`, `…Header`, `…Item`); no dotted statics | `List.Section`, `Sidebar.Item`, `FloatingSheet.Body`, `ArtifactChatContainer.Chat` → `ListSection`, `SidebarItem`, `FloatingSheetBody`, `ArtifactChatContainerChat` |
| Control names | `<Kind>Input`, never `<Kind>Field` (`Field` itself is the label, description and error wrapper) | `SearchField` → `SearchInput`; `DateField` / `TimeField` → `DateInput` / `TimeInput`; `ColorField` → `ColorInput` |

## Components that merged, moved or were renamed

Where two components did one job, 6.0 keeps one and folds the other into it as a variant, a part or a documented composition; where a name didn't follow UI SDK's, it takes UI SDK's. There are no aliases and no deprecated re-exports: every name in the left column is gone. The module is the file under `@/components/ui/` (a registry item of the same name; the npm package exports the same names from `@brett_lamy/ui`). A few left-hand names only existed in 6.0 previews; they are listed so that code written against those docs moves too. Rows marked **care** change shape, and have a before and after [below the table](#before-and-after-for-the-ones-that-need-care).

| Before | Now | Notes |
| --- | --- | --- |
| `plain-button`: `PlainButton`, `PlainButtonProps` | `import { Button as SdkButton } from '@ui-sdk/react/button'`; props are `ComponentProps<typeof SdkButton>` | UI SDK's unstyled Button, under the local name the kit's own modules use. Button's page has an "Unstyled" section |
| `plain-button`: `PlainToggleButton`, `PlainToggleButtonProps` | `import { Toggle as SdkToggle } from '@ui-sdk/react/toggle'` | `pressed` / `onPressedChange(pressed, details)`; in a ToggleGroup it takes `value` |
| `toggle-group`: `ToggleGroup`, `ToggleGroupItem`, `toggleGroupVariants`, `createToggleGroupController`, `ToggleGroupProps`, `ToggleGroupItemProps` | the same names from `@/components/ui/toggle` | one module and one page with Toggle, like Checkbox and CheckboxGroup |
| Button `active`, `variant="quiet" active` | `<Toggle variant="quiet" pressed={on} onPressedChange={setOn}>` | **care**. A tool that stays on is a toggle (`aria-pressed`); Button has no `active` |
| ToggleGroup `variant="filled"` (the segment tray) | `variant="segmented"`, as on Tabs | an item's own `variant` never makes a segment |
| Toggle / ToggleGroup `variant="filled"` (filled toggles), `toggleVariants({ variant: 'filled' })` | `variant="secondary"` | Button's name for the same grey resting fill; a group of them sits a little apart |
| Button `variant="link"` as a bar or box text button (`style={{ padding }}`, `px-2`) | `variant="plain"` (the size's height and padding, tint text) | **care**. `link` is now inline: the line's size and weight, no box; drop `h-auto p-0` / `size={null}` overrides |
| `tailscale-login-button`, `tailscale-menu` | `@/components/ui/tailscale-controls`: `TailscaleLoginButton`, `TailscaleStatusBadge`, `TailscaleMark`, `TailscaleSummary`, `TailscaleExitNodes`, `tailscaleStatusBadgeVariants` | one module, documented on [Sign in with Tailscale](https://blamy.github.io/ui/#/tailscale) |
| `TailscaleMenu` (`exitNodes`, `signOut`, `heading`, `detail`, `onExitNode`, `variant`), `TailscaleMenuProps`, `TailscaleMenuVariant`, `tailscaleMenuVariants` | compose `TailscaleSummary`, `TailscaleExitNodes` and `TailscaleLoginButton` | **care** |
| `TailscaleMenuSummary`, `TailscaleMenuSummaryProps` | `TailscaleSummary` (takes `description`), `TailscaleSummaryProps` | slot `tailscale-summary` |
| TailscaleMark `size` (px) | a size class (`className="size-5"`, default `size-4`) | it now takes the svg's props and `ref`; `aria-label` names it |
| `tailscaleLoginButtonVariants`, TailscaleLoginButton `tone` | removed: the button is the kit's `Button`, `variant` is any Button variant (default `contrast`) | default height 36px (was 40) |
| TailscaleStatusBadge `compact`, `layout: 'inline' \| 'stacked'` | `variant: 'inline' \| 'stacked' \| 'pill'` | `pill` is the old `compact` |
| TailscaleExitNodes `variant: 'radio' \| 'networks'`, `onExitNode(id)`, `tailscaleExitNodesVariants`; `TailscaleExitNodeState.active` | one listbox form; `value` / `onValueChange(value, details)`, `onAction(value, details)` for the switch; `.selected` | the radio form is gone |
| TailscaleExitNodes `glyph`, `labels.empty` | `trailing` (same signature); `emptyState` (a node, a string title or `null`; default an `EmptyState`) | with no exit node the root keeps its props and the "Exit node" heading |
| `tailscale-login` docs page | [Sign in with Tailscale](https://blamy.github.io/ui/#/tailscale), page `tailscale` | |
| `form`: `Form` | `<FieldGroup className="gap-5" render={<form onSubmit={save} />}>` | **care**. [Forms](https://blamy.github.io/ui/#/form) is a guide page now |
| `form`: `FormSection`, `FormSectionProps` | `FieldSet` + `FieldLegend` + `FieldDescription` from `@/components/ui/field` | see [Forms and text fields](#forms-and-text-fields) |
| `text-field`: `TextField`, `TextFieldProps` (and `FieldDescription`, `FieldError` from it) | `@/components/ui/field`: `Field` (its props are `ComponentProps<typeof Field>`), `FieldLabel`, `FieldDescription`, `FieldError` | **care**. `Field` owns only `name`, `disabled` and `invalid`; the value moves onto the control (see [Forms and text fields](#forms-and-text-fields)) |
| `search-field`: `SearchField`, `SearchFieldProps`, `SearchFieldSubmitDetails` | `@/components/ui/search-input`: `SearchInput`, `SearchInputProps`, `SearchInputSubmitDetails` | slot `search-field` → `search-input`; new `size`, `icon`, `clearable`, `searchInputVariants` |
| `lib/search-field-primitive`: `searchField`, `SearchFieldOptions`, `SearchFieldSubmitReason` | `lib/search-input-primitive`: `searchInput`, `SearchInputOptions`, `SearchInputSubmitReason` | |
| `time-input`: `TimeInput` (the natural-language date and recurrence box), `TimeInputProps`, `TimeInputChange` | `@/components/ui/natural-time-input`: `NaturalTimeInput`, `NaturalTimeInputProps`, `NaturalTimeInputChange` | slots `natural-time-input*`. **`TimeInput` is now the segmented time control** (the old `TimeField`) |
| `timeInputVariants` | removed | the preview's look is NaturalTimeInput's `variant` |
| NaturalTimeInput `label`, `description`, `invalid`, `error` | put it in a `Field`: `FieldLabel`, `FieldDescription`, `FieldError`, `<Field invalid>` | **care** |
| NaturalTimeInput `dateOrder`, `backend`, `weekStart`, `bareWeekday`, `bareWeekdays`, `nextWeekday`, `dayParts`, `until`, `debounceMs` | `parse={{ dateOrder, … }}` (`NaturalTimeInputParseOptions`) | `timeZone`, `locale`, `reference`, `maxOccurrences` stay top-level |
| CronEditor `from`, `debounceMs`; `cronEditorVariants` | `reference`, `parse={{ debounceMs }}`; removed | `variant` stays |
| FilterInput `query`; `useFilterQuery` `debounce`, `now` | `parse`; `debounceMs`, `reference` | |
| `filterInputVariants`, `filterBarVariants`, `filterToolbarVariants` | removed | they had no variants |
| FilterBar and FilterToolbar `hotkey`, `showMatch` | compose `<FilterToolbar><FilterMenu shortcut="f" /><FilterList /><FilterMatch /><FilterClear /></FilterToolbar>` | **care**. The default children are still Menu, List, Clear |
| FilterMenu `hotkey`, `popoverClassName` | `shortcut`, `contentProps={{ className }}` | |
| FilterChip `onChange(filter, options)`, `tone`; FilterValueEditor `onChange(value, options)` | `onValueChange(filter, details)`, `variant`; `onValueChange(value, details)` | in a bar the chip's handler runs first, and `details.cancel()` keeps the bar as it was |
| `filter-input` docs page | the "Describing filters in a sentence" section of [Filter](https://blamy.github.io/ui/#/filter) | the module and registry item `filter-input` stay |
| `FileDropZone`, `FileDropZoneProps`, `fileDropZoneVariants` | `FileUploadDropzone`, `FileUploadDropzoneProps`, `fileUploadDropzoneVariants` | |
| `FileUploadButton`, `FileUploadButtonProps` | `FileUploadTrigger`, `FileUploadTriggerProps` | `data-file-upload-button` → `data-file-upload-trigger` |
| `FileList`, `FileItem`, `FileThumbnail`, `fileItemVariants` (+ props types) | `FileUploadList`, `FileUploadItem`, `FileUploadThumbnail`, `fileUploadItemVariants` | slots `file-upload-list`, `file-upload-item`, `file-upload-thumbnail`… |
| `OnFiles`; FileUploadThumbnail `disabled` | `FileUploadFilesHandler`; `preview` (default true) | mechanical (`disabled` → `preview={!disabled}`) |
| FilterInput `onApply(filters)` | `onApply(filters, details)` (`reason: 'apply'`, `event`, `cancel()`) | |
| DebugToolbar `onAction(action)` | `onAction(action, details)` (`reason`, `event`); skipped when the control's `onClick` called `preventDefault()` | |
| FileUploadDropzone `size="compact"`, `invalid`, `error` | `orientation="horizontal"`; `<Field invalid>` + `<FieldError>` around it | **care** |
| `FieldLabel` default `variant="default"` | default `variant="field"` | drop `variant="field"`; write `variant="default"` where you relied on the old default |
| `credenza`: `Credenza`, `CredenzaProps` | `Dialog`, `DialogProps` from `@/components/ui/dialog`, with `view` on the root | **care**. The dialog page keeps a "Credenza: the responsive dialog" section |
| `CredenzaTrigger`, `createCredenzaController`, `CredenzaController` | `DialogTrigger`, `createDialogController`, `DialogController` | |
| `CredenzaBackdrop`, `CredenzaContent`, `CredenzaContentProps` | `DialogBackdrop`, `DialogContent variant="tray"`, `DialogContentProps` | `variant` only shapes the sheet presentation |
| `CredenzaHeader`, `CredenzaBack`, `CredenzaBackProps`, `CredenzaTitle`, `CredenzaClose` | `DialogHeader variant="bar"`, `DialogBack`, `DialogBackProps`, `DialogTitle`, `DialogClose` | the title travels with the view when the root has `view` |
| `CredenzaView`, `CredenzaViewProps` | `DialogView`, `DialogViewProps` | |
| `credenzaVariants` | `dialogVariants({ size, variant })` | |
| `Dialog` `presentation` default `"dialog"` | default `"auto"`: a sheet in a compact scope, a card otherwise | **care**. A dialog that must stay centered on a phone says `presentation="dialog"`; AlertDialog is always centered |
| `dialogVariants({ size: 'alert' })`, `dialogTitleClass`, `dialogDescriptionClass`, `dialogCloseClass` | `AlertDialog`; `surfaceTitleVariants`, `surfaceDescriptionVariants`, `closeButtonVariants({ layout: 'inline' \| 'pinned' })` | the surface recipes live in `@/lib/surface` and are re-exported by `dialog` |
| `passkey-enroll-dialog`: `PasskeyEnrollDialog`, `PasskeyEnrollDialogProps` | `VaultEnrollDialog`, `VaultEnrollDialogProps` from `@/components/ui/vault-gate` | `open` / `onOpenChange` are optional now; it also takes `defaultOpen`, `controller` and a `DialogTrigger` child |
| `RecoveryKey`, `RecoveryKeyProps`, `recoveryKeyVariants` from `passkey-enroll-dialog`; `vaultActionClass`, `vaultLinkClass`, `vaultErrorClass`, `vaultMutedClass` | `VaultRecoveryKey`, `VaultRecoveryKeyProps`, `vaultRecoveryKeyVariants` from `vault-gate`; private | one page, [Passkey vault](https://blamy.github.io/ui/#/passkey-vault). Slot `recovery-key` → `vault-recovery-key` |
| VaultGate `loading`, `unsupported`, `empty`, `locked` (6.0 previews) | `screens={{ loading, unsupported, empty, locked }}` (type `VaultGateScreens`) | the same nodes, grouped; `loading` is the kit's boolean everywhere else |
| `SurfaceFlow`, `SurfaceFlowTitle`, `SurfaceFlowProps` (from `dialog`, 6.0 previews) | internal (`lib/surface-flow`): `Dialog view` and `Sheet view` provide the flow | a flow of your own is a Dialog or a Sheet with a `view` |
| `PopoverContent variant="surface"` | `variant="plain"` | the kit's one spelling for "no chrome of its own" |
| `FloatingSheetFoot`, `FloatingSheetFootProps` (6.0 previews; slot `floating-sheet-foot`) | `FloatingSheetFooter`, `FloatingSheetFooterProps` (slot `floating-sheet-footer`) | like every other `…Footer` part |
| FloatingSheet `fabSide`, `fabAlign` (6.0 previews) | `<FloatingSheetFab side align>` | placement is on the FAB part; ArtifactChatContainer keeps `fabSide` / `fabAlign` |
| AdaptivePane `side="left"` / `"right"`; `AdaptivePaneSide` with `left` / `right` | `side="start"` / `"end"`; `AdaptivePaneSide = 'start' \| 'end'` | logical sides only |
| a hand-made AdaptivePane opener (`<Button aria-pressed={open} onClick={() => setOpen(!open)}>`) | `<AdaptivePaneTrigger controller={pane}>` with the pane's `controller` | writes `aria-expanded` / `aria-controls`; `onOpenChange` hears `trigger-press` |
| a Sheet flow stepping back with a "Back" button in the footer | `<SheetHeader variant="bar">` with `<SheetBack hidden={…} onClick={…} />`, `SheetTitle`, `SheetClose` | the same bar as a Dialog flow |
| `edge-drawer`: `EdgeDrawer`, `edgeDrawerVariants`, `EdgeDrawerProps` | `<Sheet contained>` + `<SheetBackdrop />` + `<SheetContent variant="panel">` | **care** |
| EdgeDrawer `zIndex`, `backdropClassName` / `scrim`, `width` / `maxWidth` / `shadow`, `swipe={false}` | `--sheet-z` on the parent; `SheetBackdrop className`; `SheetContent className`; `SheetContent swipe={false}` | host slot `edge-drawer-host` → `sheet-host` |
| `useKeptChildren` (in `edge-drawer`) | `@/lib/kept-children` (`useKeptChildren`, `KeptChildren`) | |
| `SheetContent animateHeight` | `<Sheet view={step}>` + `<SheetView>` | **care** |
| `sheetVariants({ side })` | `sheetVariants({ variant, side })`; new `sheetGrabberVariants` | the sheet card is `rounded-sheet` (18px) |
| `side-drawer`: `SideDrawer`, `SideDrawerProps` | `AdaptivePane side="end"`, `AdaptivePaneProps` | **care** |
| SideDrawer `presentation: 'fixed' \| 'overlay' \| 'push' \| 'auto'` | AdaptivePane `presentation: 'column' \| 'drawer' \| 'push' \| 'cover' \| 'hidden' \| 'auto'` | `fixed` → `column`, `overlay` → `drawer` |
| SideDrawer `title`, its built-in × and back button, `backLabel` | `<AdaptivePaneHeader><AdaptivePaneTitle>…</AdaptivePaneTitle><AdaptivePaneClose backLabel="…" /></AdaptivePaneHeader>` | the title names the pane |
| SideDrawer `width`, `breakpoint` | `columnWidth` / `drawerWidth` (number or CSS length); removed: `auto` reads the size-class scope | |
| `sideDrawerPageClass`, `--side-drawer-under`, `data-side-drawer-swiping` / `-settling` | `adaptivePanePageClass`, `--adaptive-pane-under`, `data-adaptive-pane-swiping` / `-settling` | |
| `createSideDrawerController`, `SideDrawerController`, `SideDrawerPresentation`, `SideDrawerOpenChangeDetails` / `Reason`; `sideDrawerVariants` | `createAdaptivePaneController`, `AdaptivePaneController`, `AdaptivePanePresentation`, `AdaptivePaneOpenChangeDetails` / `Reason`; removed | |
| AdaptivePane `presentation` required, `presentation="hidden"` to hide a column | optional (default `auto`); `open` means shown in every presentation, so pass `open={false}` | **care** |
| AdaptivePane `columnClassName`, `columnStyle`; `drawerMaxWidth`; `scrim`, `shadow`, `backdropClassName` | one `className` / `style` on the pane in every presentation (or a function of `{ presentation, open, side }`); a `max-w-*` class; removed | the drawer is capped at 85% and 20rem wide by default |
| `context-menu`: `ContextMenu`, `ContextMenuProps` | `DropdownMenu`, `DropdownMenuProps` | **care** |
| `ContextMenuTrigger`, `ContextMenuTriggerProps` | `DropdownMenuContextTrigger`, `DropdownMenuContextTriggerProps` | |
| `ContextMenuContent`, `ContextMenuItem`, `ContextMenuCheckboxItem`, `ContextMenuRadioGroup`, `ContextMenuRadioItem`, `ContextMenuGroup`, `ContextMenuGroupLabel`, `ContextMenuSeparator`, `ContextMenuShortcut`, `ContextMenuSub`, `ContextMenuSubTrigger`, `ContextMenuSubContent` (5.x: `ContextMenuSection`, `ContextMenuLabel`) | `DropdownMenu` + the same suffix | context menus are a section of the [DropdownMenu](https://blamy.github.io/ui/#/dropdown-menu) page |
| `createMenuController`, `MenuController`, `MenuData`, `MenuDataItem` | `createDropdownMenuController`, `DropdownMenuController`, `DropdownMenuData`, `DropdownMenuDataItem` | data items take `icon` and `description` |
| `HoverCardHeader` `media`, `subtitle`, `action` | `icon`, `description`, `trailing` | |
| `CommandMenuDialogTrigger` | `DialogTrigger` from `@/components/ui/dialog` (`shortcut="mod+k"`) | |
| `CommandMenuDialogContent overlayClassName` | `backdropClassName` | |
| `tab-view`, `tab-bar` | `@/components/ui/tabs` | **care** |
| `TabView` `placement`, `orientation` | `Tabs` `variant: 'segmented' \| 'underline' \| 'bar' \| 'rail' \| 'switcher' \| 'plain'`, `side: 'top' \| 'bottom' \| 'start' \| 'end'` | `side` sets the orientation; its default follows `variant` (`bar` bottom, `rail` and `switcher` start, others top) |
| `TabViewBar variant`, `hideOnScroll` | `Tabs variant` on the root + `TabsBar hideOnScroll` | the bar writes `data-hidden` while scrolled away |
| `TabViewList`, `TabViewIndicator`, `TabViewPill`, `TabViewSeparator`, `TabViewHeader`, `TabViewFooter`, `TabViewPanels`, `TabViewPanel` | `TabsList`, `TabsIndicator`, `TabsPill`, `TabsSeparator`, `TabsHeader`, `TabsFooter`, `TabsPanels`, `TabsPanel` | every part takes its element's props and `ref` |
| `TabViewTab` / `TabViewAction` `icon: string`, `title` | `TabsTab` / `TabsAction` `icon: IconName \| ReactNode`, the label as children | |
| `useTabView()`, `useTabViewTab()` | `useTabs()` (`null` outside a `Tabs`), `useTabsTab()` | |
| `tabViewVariants`, `tabViewBarVariants`, `tabViewListVariants`, `tabViewTabVariants`, `tabViewIndicatorVariants`, `tabViewPillVariants`, `tabViewActionVariants` | `tabsVariants`, `tabsBarVariants`, `tabsListVariants`, `tabsTabVariants`, `tabsIndicatorVariants`, `tabsPillVariants`, `tabsActionVariants` | one `variant` axis |
| `TabViewProps`, `TabViewBarProps`, `TabViewTabProps`, `TabViewIndicatorProps`, `TabViewActionProps`, `TabViewPlacement`, `TabViewOrientation`, `TabViewBarVariant` | `TabsProps`, `TabsBarProps`, `TabsTabProps`, `TabsIndicatorProps`, `TabsActionProps`, `TabsSide`, `TabsOrientation`, `TabsVariant` | |
| `TabBar`, `TabBarProps`, `TabBarItem` | `<Tabs variant="bar">` + `TabsBar` + `TabsList` + `TabsTab` | **care**. The "Bottom tab bar" section of [Tabs](https://blamy.github.io/ui/#/tabs) |
| TabView/TabViewBar `variant="workspace"` (the server rail) | `Tabs variant="switcher"` | "workspace" names only the Workspace component |
| A hand-rolled `useSizeClass` ternary between `variant="bar"` and `"rail"` | `Tabs presentation="auto"` (bar in a compact size-class scope, rail otherwise) | |
| a NavigationStack's `bottomInset` that repeats the tab bar's height (62, 66, `TAB_BAR + …`) | nothing: a Tabs `bar` publishes `--tabs-bar-h` (safe area included) and NavigationStackContent keeps that room; `bottomInset` is only extra room (a mini player) | **care**: a stack inside a Tabs root that still passes the bar's height gets it twice |
| slot `tab-view-bar`, `data-placement`, `data-bar-placement` | `tabs-bar`, `data-side` (and `data-variant`) on the root and the bar | |
| Workspace `tabPlacement: 'top' \| 'bottom' \| 'left' \| 'right'`, `WorkspaceTabPlacement`, `data-tab-placement` | `tabSide: 'top' \| 'bottom' \| 'start' \| 'end'`, `WorkspaceTabSide`, `data-tab-side` | rename the field in saved layouts |
| Workspace's own `rounded-xl border` frame | none: add `rounded-card border border-border` | new `presentation: 'auto' \| 'docked' \| 'tabs'` |
| `WorkspaceTabsetState.active`, `WorkspaceState.activeTabsetId`, `data-active` on a tabset | `current`, `currentTabsetId`, `data-current` | mechanical |
| `icon-swap`: `IconSwap id`, `IconSwapProps` | `<Swap effect="pop" value={id}>` from `@/components/ui/swap`, `SwapProps` | `pop` is inline by default |
| `ContentSwap id` (in `animated-height`), `ContentSwapProps` | `<Swap value={id}>` (`effect="slide"`, the default), `SwapProps`, `SwapEffect` | `animated-height` keeps only `AnimatedHeight`; slots `swap`, `swap-view` |
| `Chevron`, `ChevronProps`, `ChevronDirection` from `icon-swap`; `sw` | the same names from `@/lib/icon`; `strokeWidth` | |
| `spinner-shapes` | `lib/spinner-shapes` | no public exports |
| Spinner `spin` | removed: it animates unless `paused` | `spin={x}` → `paused={!x}` |
| Spinner `variant`, `SpinnerVariant`, `spinnerAnimations[].variants` | `pattern`, `SpinnerPattern` (`SpinnerPatternOf<A>`), `.patterns` | typed by `animation` |
| Spinner animations `beacon`, `cells`, `register`, `bands` | `bars`, `merge`, `encode`, `scan` | the ids match their labels |
| ProgressRing / CountdownRing `size="md"` | `size="default"` (`ProgressRingSize`) | `showValue` needs 40px (`lg`) or more |
| CountdownRing `warnAt`, `warnColor`, `data-warning`, `--ring-warn`; `labelSize`, `CountdownRingLabelSize` | `urgentAt`, `urgentTint`, `data-urgent`, `--ring-urgent`; removed (the value sizes with the ring) | |
| ProgressRing `color`, `trackColor`; CountdownRing `color`, `urgentColor`, `trackColor`, `showLabel`; `countdownRingLabelVariants` | `tint`, `trackTint`; `tint`, `urgentTint`, `trackTint`, `showValue`; `countdownRingValueVariants` | caller colors are `tint` kit-wide, as on Avatar |
| ProgressStepper data type `ProgressStep`; `ProgressStepState` `done`, `active`, `todo`; `--ck-stepper-accent`, `--ck-stepper-idle` | `ProgressStepperStep` (the part is `ProgressStepperItem`); `ProgressStepperItemState` `complete`, `current`, `upcoming`; `--stepper-accent`, `--stepper-track` | new parts `ProgressStepperItem`, `ProgressStepperItemIcon`, `ProgressStepperItemTrack`, `ProgressStepperItemLabel`, `ProgressStepperItemDescription` |
| NumberMorph `locales`; Morph `id` | `locale`; `layoutId` (`id` is the DOM id again) | |
| `qr-svg`: `QRSvg`, `QRSvgProps` | `@/components/ui/qr-code`: `QRCode`, `QRCodeProps` | **care**. `value` is required |
| QRSvg `title`, `color`; `lib/qr` type `QRCode` | `aria-label`, a `text-*` class (the modules are `currentColor`); `QRMatrix` (from `@brett_lamy/ui/lib/qr`) | encode errors go to `onError` |
| QRSvg / QRCode `rounded`, `rounded={false}` | `shape="rounded"` (the default), `shape="square"` | a boolean that picked a look is a variant |
| Avatar `c={{ f, l }}`, `color` | `name="F L"`, `tint` | |
| `AvatarGroup`, `avatarGroupVariants`, `AvatarGroupProps` from `avatar` | the same from `@/components/ui/avatar-group` | **care**. `menu` defaults to `false`; `onSelect(index)` → `onAction(value, details)`; `label` → `aria-label` |
| Skeleton `shape="rounded"`; SkeletonText `lineHeight`, `gap` | removed (it was `default`); `lineClassName="h-3"`, `className="gap-3"` | |
| Celebrate beside its subject in a `relative isolate` wrapper | `<Celebrate fire={n}>{subject}</Celebrate>` | **care** |
| NowPlayingBars `speed` (seconds per bounce) | `speed` (a multiplier, like Spinner's: bigger is faster) | |
| `schema-tree`: `SchemaTree`, `schemaTreeVariants`, `SchemaTreeProps`, `SchemaTreeActionDetails` | `<Tree items={schemaTreeItems(schema)} …>`; `schemaTreeItems`, `SchemaTreeNode` from `@/lib/pglite-schema` | **care** |
| Tree `density="relaxed"`, `emptyMessage` | `density="comfortable"` (`TreeDensity`), `emptyState` | |
| `TreeFileIcon`, `TreeFolderIcon` (in `tree`) | `FileBadgeIcon`, `FolderIcon` from `@/lib/file-icons` (with `FileTypeIcon`, `fileTypeOf`) | |
| `objectTreeRowVariants`, `callStackRowVariants` | removed: their rows are Tree's (`treeRowVariants`) | |
| ObjectTree and CallStack `rowHeight`, `emptyMessage` | `density` (default `compact`, 24px), `emptyState` | |
| ObjectValue `expandable` | `actions` | |
| `List.Section`, `List.Row`; List `inset` | `ListSection`, `ListRow`; `variant="inset"` | |
| ListRow `leading`, `subtitle`, `selected`, `destructive`, `center`, `edit` | `icon`, `description`, `current`, `tone="destructive"`, `justify="center"`, `editing` | |
| ListRow `onDelete` | `endActions={[{ label: 'Delete', destructive: true, onAction }]}` | **care** |
| ListRow `leadingActions`, `trailingActions`; `fullSwipe: 'leading' \| 'trailing'`; `createListRowController().show('leading' \| 'trailing')` | `startActions`, `endActions`; `fullSwipe: 'start' \| 'end'`; `show('start' \| 'end')` | Logical sides: in right-to-left text the start actions are on the right |
| TreeNode `detail`, `detailTitle` (Tree `items`, `schemaTreeItems`) | `trailing` (any node), `description` (its words: tooltip and `aria-description`; default `trailing` when it's a string) | Row anatomy |
| ObjectTree `ValueTint` (type) | `ValueTokenType` (from `@brett_lamy/ui/lib/object-tree-value`) | It names a syntax token class, not a color |
| `LogRowContent`, `LogRowContentProps` | `LogListRowContent`, `LogListRowContentProps` | Parts carry their root's prefix |
| LogList `onRowCopy(row, text)` | `onRowCopy(text, row)` | Text first, as ObjectTree's and ObjectValue's `onValueCopy` |
| TraceTimeline `label`; `top`, `bottom`, `railWidth`; `renderPreview`, `previewLines`, `previewWidth` | `aria-label`; classes on the rail (`className="inset-y-2 w-14"`); `<TraceTimelinePreview lines width>{(time) => …}</TraceTimelinePreview>` (a part that draws the card where it sits) | **care** |
| TraceTimeline `side: 'left' \| 'right'` (default `right`) | `side: 'start' \| 'end'` (default `end`), as IndexBar's | Follows the text direction |
| `TraceTone` `'info'`, `'error'`; TraceStop `dim`; `color` on TraceLane, TraceDiamonds, TraceDensity, TraceMarkSeries, TraceThread, TraceRequest | `TraceTone = 'default' \| 'muted' \| 'success' \| 'warning' \| 'destructive'` (`error` → `destructive`; `info` → `tint: 'var(--primary)'`); `disabled`; `tint` (and TraceStop gains `tint`) | One tone set; caller colors are `tint`. The current stop's dash has `data-current`, a disabled one `data-disabled` |
| TraceTimeline gutter labels `requests`, `stops` | `Requests`, `Stops` | Default `requestsLabel` / `stopsLabel` |
| Slider `tone: 'default' \| 'onDark' \| 'onLight'`, `SliderTone`, `data-tone` | `variant: 'default' \| 'overlay'` with `appearance: 'auto' \| 'light' \| 'dark'`: `tone="onDark"` → `variant="overlay" appearance="dark"`, `tone="onLight"` → `variant="overlay" appearance="light"`; `SliderVariant`, `data-variant`, `data-appearance` | `overlay` follows the scheme it sits in; `appearance` fixes it |
| Slider `trackColor`, `fillColor`, `thumbColor` | `className="[--bl-slider-fill:var(--success)]"` (`--bl-slider-track`, `--bl-slider-thumb`) | |
| `date-field`: `DateField`, `DateFieldProps`, `DateFieldSegment` | `@/components/ui/date-input`: `DateInput`, `DateInputProps`, `DateInputSegment` | 5.x's inner `DateInput` part is gone: the control is the root |
| `TimeField`, `TimeFieldProps`, `TimeFieldSegment` | `TimeInput`, `TimeInputProps`, `TimeInputSegment` | |
| `dateFieldVariants`, `createDateFieldController`, `createTimeFieldController`, `DateFieldController`, `TimeFieldController`, `DateFieldSegmentData`, `DateFieldState` | `dateInputVariants`, `createDateInputController`, `createTimeInputController`, `DateInputController`, `TimeInputController`, `DateInputSegmentData`, `DateInputState` | |
| `color-field`: `ColorField`, `ColorFieldProps` | `ColorInput`, `ColorInputProps` from `@/components/ui/color-picker` | **care** |
| `ColorFieldGroup`, `ColorFieldInput`, `ColorFieldChannelInput`, `ColorFieldSwatch` (+ props types) | `ColorPickerInputGroup`, `ColorPickerInput`, `ColorPickerChannelInput`, `ColorPickerSwatch` | UI SDK's part names |
| `colorFieldVariants`, `colorFieldGroupVariants` | `fieldSurfaceVariants` from `@/components/ui/input` | the one filled field box |
| `ColorSwatch` from `color-field` | the same from `color-picker` | |
| ColorPicker with a `<Popover>` around the trigger and content | the root takes `open`, `defaultOpen`, `onOpenChange`, `presentation`; trigger and content go straight in | **care**. A `<Popover>` still works, for several triggers under one root |
| `list-box` (module, page `list-box`) | `@/components/ui/listbox`, page [Listbox](https://blamy.github.io/ui/#/listbox) | |
| `ListboxRow`, `listboxGroupClass`, `listboxGroupLabelClass`, `listboxSeparatorClass`, `listboxSheetClass`; ListboxItem `variant` | private (`lib/option-row`); removed (it follows the list) | |
| `ComboboxInput chips clearable clearLabel triggerLabel groupClassName`, `ComboboxInputProps` | `ComboboxInputGroup` + a bare `ComboboxInput` + `ComboboxTrigger` + `ComboboxClear` + `ComboboxChips` | **care** |
| FontStackPicker `size`, `side`, `align`, `className`; `fontStackPickerVariants` | `<FontStackPickerInputGroup size className>` and `<FontStackPickerContent side align>` inside it; `fontStackPickerInputGroupVariants` | **care**; with no children it renders both |
| `ComboboxField`, `DatePickerField`, `ColorPickerField`, `datePickerFieldVariants` (6.0 previews; + props types) | `ComboboxInputGroup`, `DatePickerInputGroup`, `ColorPickerInputGroup`, `datePickerInputGroupVariants`; slots `*-input-group` | UI SDK's word for the box around an input; `Field` is the label wrapper |
| DatePicker root `size` | `size` on `DatePickerInputGroup` | the box part carries `size` on every compound picker |
| DateInput / TimeInput `variant="field"` / `"bare"` | `variant="default"` / `"plain"` | `plain` is the kit's one spelling of "no chrome" |
| FontPicker `size`, `side`, `align`, `className`, `triggerProps` | `FontPicker` + `FontPickerTrigger size className` + `FontPickerContent side align` | **care** |
| `fontPickerTriggerVariants`, `fontListItemVariants` | removed: the trigger is `selectTriggerVariants` | |
| `edit-bar`: `EditBar`, `EditBarProps` | `<Toolbar variant="bar">` from `@/components/ui/toolbar` | **care**. The "Edit mode: the bottom bar" section of [Toolbar](https://blamy.github.io/ui/#/toolbar) |
| DebugToolbar `size="compact"`; labels "Step in", "Reverse" | `size="sm"` (and `lg`); "Step into", "Reverse continue" | **care**. A preset of the kit `Toolbar`, with `DebugToolbarButton` for your own rows |
| IndexBar `avail`, `onLetter`, `AL` | `items={indexBarAlphabetItems(available)}` (required), `onJump` | **care** |
| IndexBar `onJump(key, point, index, details)` | `onJump(value, { index, item, reason, event })` (`IndexBarJumpDetails`) | |
| IndexBar item `key`, `IndexBarKey` | `value`, `IndexBarValue` | mechanical; `key` was React's reserved name |
| IndexBar `side: 'left' \| 'right'`, `label`, `top`, `bottom`, `width`, `value`; item `dim` | `side: 'start' \| 'end'`, `aria-label`, classes (`className="top-14 bottom-2"`), `current`; item `disabled` | |
| Breadcrumb item / entry `id` (and `BreadcrumbItem id`) | `value` | mechanical |
| Breadcrumb item `items`, `selectedId`; `BreadcrumbEllipsis label` | `siblings`, `siblingValue` (entries named by `value`); `aria-label` | `onClick` gets the event |
| `SplitViewStack`, `SplitViewStackProps`, `SplitViewStackApi`, a column's `stack` prop | a `NavigationStack` inside the column | **care** |
| `useSplitViewStack()` (`push(node, { key })`, `popToRoot`) | `useNavigationStack()` (`push(key)`, `pop`, `popTo`, `replace`) | pages are keys, drawn by children or `renderPage` |
| `createSplitViewStackController`, `SplitViewStackController`, `SplitViewStackPagesChangeDetails` / `Reason` | `createNavigationStackController`, `NavigationStackController`, `NavigationStackChangeDetails`, `NavigationStackReason` | |
| `SplitViewEmpty`, `SplitViewEmptyProps` | `EmptyState` from `@/components/ui/empty-state` | |
| `splitViewSectionLabelVariants` | removed (the shared section label) | |
| SplitViewItem `id`, `subtitle`, `badge`; state `selected`, `data-selected`; `useSplitView().isSelected` | `value`, `description`, `trailing`; `current`, `data-current`; `isCurrent(column, value)` | |
| SplitViewHeader `titleOnScroll`, `titleAlign="leading"` | `showOnScroll`, `titleAlign="start"` | |
| `SplitViewToggle`, `SplitViewToggleProps`, slot `split-view-toggle` | `SplitViewSidebarTrigger`, `SplitViewSidebarTriggerProps`, `split-view-sidebar-trigger` | mechanical; it now takes `children` (the glyph) and `shortcut` |
| SplitViewHeader's hairline at rest | shown once its pane's content scrolls (`scrollEdge`, default true) | `scrollEdge={false}` keeps it at rest |
| A phone layout swapped in beside the SplitView (`Tabs variant="bar"` + a stack per tab) | `SplitViewSidebar compactPresentation="tabs"` with `tab` items / sections | **care**: one tree; see SplitView "A sidebar that becomes a tab bar" |
| NavigationStackPage `grouped`; NavigationStack `safeTop: string`; `useNavigationStack()` returning `null` outside | `variant="grouped"`; `safeTop: number` (px); it throws outside a stack | |
| Sidebar `variant="overlay"` | `presentation="drawer"` (`'auto' \| 'column' \| 'drawer'`, default `auto`) | **care**. `variant` is only the look: `docked`, `rail`, `float` |
| SidebarItem `label`, `active`, `tone`, `badge`, `icon` (a `SIDEBAR_ICONS` key) | `title`, `current`, `tint`, `trailing`, `icon` (an `IconName` or a node) | **care** |
| Sidebar.Workspace `name`, `detail`, `initial` (now `SidebarAccount`); SidebarSearch's fixed `/` chip | `title`, `description`, `icon`; `SidebarSearch shortcut="/"` (binds the key) | |
| `Sidebar.Header`, `.Content`, `.Footer`, `.Workspace`, `.Search`, `.Section`, `.Item` | `SidebarHeader`, `SidebarContent`, `SidebarFooter`, `SidebarAccount`, `SidebarSearch`, `SidebarSection`, `SidebarItem` | |
| `SidebarWorkspace`, `SidebarWorkspaceProps`, slot `sidebar-workspace` | `SidebarAccount`, `SidebarAccountProps`, `sidebar-account` | mechanical |
| `SidebarNav`, `SidebarNavProps`, `SIDEBAR_ICONS` | removed (demo compositions in the `split-view-demos` block) | |
| `createRequestTableController`, `RequestTableController`, `RequestTableActionDetails`, `RequestTableValueChangeReason`, `RequestTableSortChangeReason`, `RequestTableColumnWidthsChangeReason`, `RequestTableBreakpoints` | `createDataTableController`, `DataTableController`, `DataTableActionDetails`, `DataTableValueChangeReason`, `DataTableSortChangeReason`, `DataTableColumnWidthsChangeReason`, `DataTableBreakpoints` from `@/components/ui/data-table` | RequestTable is a preset of [DataTable](https://blamy.github.io/ui/#/data-table) |
| `RequestColumn<T>`, `RequestSort`, `RequestSortDirection`, `RequestSortValue`, `RequestColumnSize`, `RequestTimeRange`; `requestTableVariants`; `sortRequests` | `DataTableColumn<T>`, `DataTableSort`, `DataTableSortDirection`, `DataTableSortValue`, `DataTableColumnSize`, `DataTableTimeRange`; `dataTableVariants`; `sortDataTableRows` | |
| RequestTable slots `request-table`, `request-table-grid`, `-row`, `-cell`…; `--request-*` | `data-table`, `data-table-grid`, `data-table-row`, `data-table-cell`…; `--data-table-*` | the request-specific slots (`request-table-name`, `-bar`…) stay |
| DataTable / RequestTable `selectionMode` | `mode` (`'single' \| 'none'`) | UI SDK's and Tree's word |
| DataTable / RequestTable `playhead`, controller `setPlayhead`; `data-playhead`, `--data-table-playhead`; slot `request-table-playhead` | `currentTime`, `setCurrentTime`; `data-current-time`, `--data-table-current-time`; `request-table-current-time` | LogList's words, so one clock drives both |
| DataTableColumn `title`, `render` | `header`, `cell` | TanStack's / shadcn's `ColumnDef` names; `render` is UI SDK's element-replacement prop |
| DataTable focus on whole rows (← → scrolled) | cell focus by default (APG grid: ← → between cells, ↑ ↓ in the column); `navigation="row"` for the old behavior | RequestTable keeps `navigation="row"` as its default. DataTable also gains `loading` |
| DataTable / RequestTable `focus="cell" \| "row"` (6.0 previews) | `navigation="cell" \| "row"` | a setting named for what it chooses; `focus()` stays the controller's method |
| `RequestLink`, `RequestLinkProps` | `RequestTableLink`, `RequestTableLinkProps` | Parts carry their root's prefix |
| `RequestTone` `'neutral' \| 'primary' \| 'danger' \| 'accent'` | `'muted' \| 'default' \| 'destructive'`; `accent` (a category color) → RequestRow `tint: 'var(--chart-5)'` | One tone set; `requestTone()` defaults to `default`, `destructive` when failed |
| `result-table`: `ResultTable`, `resultTableVariants`, `ResultTableProps`, `ResultSet`, `ResultField` | `DataTable`; the SQL console renders its own results | **care** |
| SqlConsole `sidebar`, `transfer`, `headerActions`, `layout`, `sqlConsoleVariants`, `resultMaxHeight` | compose `SqlConsoleHeader`, `SqlConsoleDatabaseMenu`, `SqlConsoleSidebar`, `SqlConsoleEditor`, `SqlConsoleResults`; the `--sql-console-result-height` variable | **care** |
| `sql-editor`: `SqlEditor`, `SqlEditorFooter`, `SqlEditorRun`, `SqlEditorProps`, `SqlEditorFooterProps`, `SqlEditorRunProps`, `SqlEditorHandle`; `useSqlHistory`, `SqlHistory` | `SqlConsoleEditor`, `SqlConsoleEditorFooter`, `SqlConsoleEditorRun` and their `…Props`, `SqlConsoleEditorHandle`; `useSqlHistory`, `SqlHistory` — all from `@/components/ui/sql-console` | **care**. One editor, a part of the console that also works on its own (outside a console it is the old SqlEditor). Slots `sql-editor`, `sql-editor-highlight`, `sql-editor-footer` → `sql-console-editor`, `sql-console-editor-highlight`, `sql-console-editor-footer`. `error={{ position }}` → `errorPosition={position}` |
| SqlEditor `running`, `size`, `footer`, `actions`, `runLabel`, `sqlEditorVariants` | `pending`, `rows` (default 8), `children` (`<SqlConsoleEditorFooter>`, `<SqlConsoleEditorRun>`; `{false}` for none), removed | |
| Spreadsheet `onSort`, `footer`, `columnName` | `onSorted` (and a controlled `sort` / `onSortChange`), `statusBar`, removed | |
| `workbench-theme`: `WorkbenchTheme`, `WorkbenchThemeProps` | `<ThemeScope scope="workbench">` from `@/lib/theme` | **care**. [Theming](https://blamy.github.io/ui/#/theming), "The workbench scope" |
| `useWorkbenchAppearance()`, `WorkbenchAppearanceProvider` | `useScopeAppearance('workbench')` or `useThemeScope()?.appearance`; a `ThemeScope` publishes its scope | |
| `code-editor-window` (component) | `lib/code-editor-window` | CodeEditor's private renderer |
| `syntax-highlighting`: `SyntaxHighlighting`, `SyntaxHighlightingHeader`, `SyntaxHighlightingTitle`, `SyntaxHighlightingCopyButton`, `SyntaxHighlightingContent`, `syntaxHighlightingVariants`, `useSyntaxHighlighting`, `SyntaxLineRange` | `<CodeEditor readOnly value={code}>` with `CodeEditorHeader`, `CodeEditorTitle`, `CodeEditorCopyButton`, `CodeEditorContent`; `codeEditorVariants`, `useCodeEditor()`, `CodeLineRange` | one code surface; see [Other components](#other-components) |
| `FbMd`, `HlPre`, `hlTokens`, `DocstreamRefContext`, `DocstreamRefContextValue` (in `markdown-view`) | removed | |
| `replay-preview`: `formatReplayTime`, `ReplayStage`, `preloadReplayStage`, `getReplayMarkers`, `getReplayMeta`, `getReplayPointerTrack`, `replayPointerAt`, `getReplayDevtools`, `replayDevtoolsAt`, `getReplayInspections`, `resolveReplayInspections`, `replayInspectionAt`, `replayDemoEvents` and their types | `@brett_lamy/ui/docstream/replay` (`replayDemoEvents` from `@brett_lamy/ui/docstream/replay/demo`) | the kit keeps `ReplayPreview` and the props, handle and data types |
| `tui-preview`: `TuiEmbed`, `DEFAULT_TUI_RUNTIME_URL`, `isTuiCodeBlock` | `TuiPreview`; `DEFAULT_TUI_RUNTIME_URL` and `isTuiCodeBlock` from `@brett_lamy/ui/docstream/tui` | the kit keeps `TuiPreview` |
| the props of `TuiPreview`, `ReplayPreview`, `ReplayStage`, `StlViewer`, `StrudelPlayer`, `StrudelRack`, `Knob` and `Fader` (`isStreaming`, `playerRef`, `color`, `showCode`…) | the [docstream table](#docstream-is-part-of-the-library) above: the kit's modules re-export those components, so their props changed there | **care** for TuiPreview: on a light page its terminal is light now |
| `strudel-rack`: `StrudelRack`, `RackGrid`, `StepGrid`, `Knob`, `Fader`, `STRUDEL_PARAMS`, `trackName` (+ types) | `@brett_lamy/ui/docstream/strudel/rack` | one page, [StrudelPlayer](https://blamy.github.io/ui/#/strudel-player) |
| `strudel-syntax`: `parseStrudel`, `parseMini`, `miniAtoms`, `miniLayers`, `chainCalls`, `findCall`, `applyEdits`, `formatNumber`, `setArg`, `setMethod`, `removeMethod`, `setTempo`, `setMiniAtom`, `setMiniSource`, `mixCode`, `isAudible`, `StrudelSyntaxError`, `MiniSyntaxError`, `CodeEdit`, the `Strudel*` and `Mini*` syntax types | `@brett_lamy/ui/docstream/strudel/rack` | `StrudelTrackKind` is docstream's `TrackKind` |
| `strudel-player`: `DEFAULT_SAMPLES`, `strudelNow`, `StrudelPattern`, `StrudelHap` | `@brett_lamy/ui/docstream/strudel` | the kit keeps `StrudelPlayer`, `playStrudel`, `stopStrudel`, `updateStrudel`, `subscribeStrudel`, `getStrudelSnapshot` |
| `stl-viewer`: `parseStl`, `isStlUrl`, `StlMesh` | `@brett_lamy/ui/docstream/stl` | the kit keeps `StlViewer` |
| Terminal `size="md"` | `size="default"` | |
| MarkdownEditor `invalid`; `onKeyDown`, `onPaste`; `contentClassName` | a `Field`; `handleKeyDown`, `handlePaste` (ProseMirror's); `classNames.content` | |
| MarkdownEditor `demoResolver`, `demoRuntime`, `demoVFS`, `demoDependencies`; MarkdownView `demoResolver` | `demo={{ resolver, runtime, vfs, dependencies }}` on both | |
| CodeEditor `contentClassName`; `onLineNumberClick`, `lineNumberClickable`, `lineNumberLabel`, `lineNumberTitle`; `scrollToLine` prop | `<CodeEditorContent className>`; `lineNumbers={{ onClick, clickable, label, title, side }}` (`CodeEditorLineNumbers`); `revealLine` | **care**. The handle keeps `scrollToLine()` |
| CodeEditorCopyButton `label`, `onCopy(value)` | `aria-label`, `onValueCopy(value)` | it is the kit's Button |
| CodeEditor and MarkdownEditor `variant="ghost"` | `variant="plain"` | the kit's one spelling for "no chrome" (Button's `ghost` is a different look and stays). CSS hooks `.bl-syntax-ghost` → `.bl-syntax-plain`, `.bl-mde[data-variant="ghost"]` → `[data-variant="plain"]` |
| CodeEditor marker `active` | `pressed` (`aria-pressed`, `data-pressed`) | a marker that toggles, like a set breakpoint |
| MarkdownEditor `onFocus()` / `onBlur()` (the editor's focus, no argument; TipTap's DOM event in 6.0 previews) | `onEditorFocus(event)` / `onEditorBlur(event)`; `onFocus` / `onBlur` are React's, on the root | |
| OpenCode `height`, `theme`, `rounded-none border-0` to strip the chrome | a class (`className="h-[620px]"`), `appearance`, `variant="plain"` (`openCodeVariants`) | **care** |
| `WbPopover`, `WbPopoverProps` (5.x); `WbPopoverContent`, `useSurfacePalette`, `wbPopoverSurface`, `isLightSurface` from `composer-popover` | `<PopoverContent variant="plain" palette="trigger">`; `useTriggerPalette` from `@/lib/trigger-palette` (`isLightSurface` is private) | `palette="trigger"` also on `DropdownMenuContent` and `SelectContent` |
| `ComposerMenuItem`, `composerMenuItemVariants` | `DropdownMenuRadioItem` in a `DropdownMenuContent size="sm"` | |
| `ComposerButton`, `ComposerButtonProps`, `composerButtonVariants`; `ComposerButton variant="pill"` + `ComposerPillLabel` | the kit's `Button` (`variant="quiet" size="icon-sm"` for an icon tool); `ComposerPill` (`icon`, the label as children) | **care** |
| `tint` on ComposerButton, ComposerSelect, ComposerAdd | `className="text-primary"` | |
| ComposerSelect `options` (with `id`), `ComposerSelectOption`, `menuClassName` | `items` (with `value`, `disabled`), `ComposerSelectItem`; compose `DropdownMenu` + `ComposerPill` yourself for more | |
| `ComposerAttach`, `ComposerAttachProps` | `<ComposerAdd icon="paperclip-diagonal" aria-label="Attach files" />` | |
| Composer `acceptedFileTypes`, `maxFileSize`, `onFilesRejected(rejections)`; ComposerAdd `acceptedFileTypes`; `ComposerFileRejection` (`reason: 'type' \| 'size' \| 'count'`) | `accept`, `maxSize`, `onReject(rejected)`; ComposerAdd `accept`; UI SDK's `FileRejection` (`reasons: ['file-type' \| 'file-too-large' \| 'too-many-files']`) | FileUpload's spelling; `accept` also takes a comma-separated string |
| ComposerAdd `label`; ComposerBumpHandle `label`; ComposerBumpContent `label` | `aria-label` | ComposerAdd still sets its tooltip from it |
| Composer `collapseTo` | `collapse` | the policy (FloatingSheet's word); `collapsed` stays the state |
| ComposerBump `variant="flush"` | `variant="plain"` | |
| ComposerBump `bounds`, `boundsInset`, `minimizable`, `minimized`, `onMinimizedChange`, `onProgressChange`; `ComposerBumpMinimizedChangeDetails`, `ComposerBumpMinimizedChangeReason` | removed | the fold-into-a-FAB engine of the old floating chat; a chat that floats, peeks and folds is ArtifactChatContainer on FloatingSheet. `maxReveal` is a number |
| ComposerAdd, ComposerSend, ComposerStop `size`, `variant` | removed (ComposerStop keeps `variant: 'ring' \| 'solid'`) | |
| `AnnotateLightbox`, `AnnotateLightboxProps` | `ImageAnnotator`, `ImageAnnotatorProps` (PencilKit) | its `annotator` prop is `engine` |
| `ComposerAnnotatorProvider` (`annotator`); `ComposerAnnotator`, `ComposerAnnotatorProps`, `ComposerAnnotatorSurface`; `useComposerAnnotator` | `ImageAnnotatorProvider` (`engine`); `ImageAnnotatorEngine`, `ImageAnnotatorEngineProps`, `ImageAnnotatorSurface` from `@/components/ui/pencilkit` (`@brett_lamy/ui/pencilkit`); the hook is internal | `Composer annotator` takes an `ImageAnnotatorEngine` or `null` |
| Composer `annotateCanvas`, `fabPosition`; ComposerBump `inset` | an engine (`annotator={MyEngine}`); `fabAlign`; `gutter` | `data-fab-position` → `data-fab-align` |
| `ComposerOutlet`, `ComposerFab`, `composerFabVariants`, `ComposerBumpProgress`; `useComposerBump()` `startDrag`, `toggle`, `windowRef`, `handleProps` | not public | style `ComposerBumpHandle` for a handle of your own |
| MessageScroller `items: { id, anchor, node }[]`, type `MessageScrollerItem` | `<MessageScrollerItem value anchor>` children (a component), `MessageScrollerItemProps` | **care** |
| `ConversationGreeting`, `ConversationGreetingProps` | `<ConversationEmpty title description icon action headingLevel>` (it renders `EmptyState`) | |
| UserMessage `images: string[]`; ToolCall `detail` | `attachments: ComposerAttachment[]`; `description` | |
| `Suggestion`, `UserMessage`, `AssistantMessage`, `MessageMarkdown`, `WorkLog`, `ToolCall`; `UserMessageProps`, `WorkLogProps`, `ToolCallProps` (and the others' `…Props`); `MessageProps` | `ConversationSuggestion`, `ConversationUserMessage`, `ConversationAssistantMessage`, `ConversationMarkdown`, `ConversationWorkLog`, `ConversationToolCall`; `ConversationUserMessageProps`, `ConversationWorkLogProps`, `ConversationToolCallProps` (`Conversation…Props`); `ConversationAssistantMessageProps` | every part carries its root's prefix, and so does its slot (next rows) |
| `SettledBanner`, `SettledBannerProps` | removed (it lives in the `t3-clone` block) | ConversationSuggestion is the kit's `Button variant="outline" size="sm"` (`ConversationSuggestionProps` are Button's) |
| `floating-chat`: `FloatingChat`, `useFloatingChat`, `FloatingChatProps`, `FloatingChatContextValue`, `FloatingChatFabPosition`, `floatingChatVariants`, `glassScopeProps` | `<ArtifactChatContainer presentation="floating">`, or a `FloatingSheet` | **care** |
| `chat-column`: `ChatColumn`, `ChatColumnTranscript`, `ChatColumnComposer`, `ChatColumnProps` | `ArtifactChatContainer`'s docked layout, or `Conversation` for a column of your own | |
| `ArtifactChatContainer.Content`, `.Chat`, `.Composer`; `.Context`, `.useContainer` | `ArtifactChatContainerContent`, `ArtifactChatContainerChat`, `ArtifactChatContainerComposer`; `useArtifactChatContainer()` | **care** |
| ArtifactChatContainer `chatOpen`, `defaultChatOpen`, `onChatOpenChange` | `open`, `defaultOpen`, `onOpenChange(open, details)` | |
| ArtifactChatContainer `chatSide: 'left' \| 'right'`, `fabPosition`, `appearance: 'glass' \| 'sheet'`, `tone`, `onAdd` | `chatSide: 'start' \| 'end'`, `fabSide` + `fabAlign`, `variant`, `appearance: 'auto' \| 'light' \| 'dark'`, `onComposingChange` | |
| `useArtifactChatContainer()` `.compact`, `.chatOpen`, `.setChatOpen`; root `data-layout="compact"`; the content's `<main>` | `.presentation === 'floating'`, `.open`, `.setOpen`; `data-presentation="floating"`; a `div` (pass `role="main"`) | |
| `ArtifactChatFabPosition`, `ArtifactChatContainerSlotChildren` | removed | `ArtifactChatContainerSide`, `ArtifactChatContainerOpenChangeDetails` are new |
| `FloatingSheet.Body`, `.Foot`, `.Fab`; `.Context`, `.useFloatingSheet`; `fabIcon` | `FloatingSheetBody`, `FloatingSheetFooter`, `FloatingSheetFab` (the button: children are its face); `useFloatingSheet()`; `<FloatingSheetFab>{icon}</FloatingSheetFab>` | write Body before Footer |
| FloatingSheet `radius={28}` / `gutter={20}` defaults | `var(--radius-sheet)` and 10px, the radius and inset of Dialog's tray (pass the old numbers to keep the old look) | |
| FloatingSheet `appearance: 'glass' \| 'sheet'`, `tone`, `dismissible` + `minimizable`, `detents`, `label`, `fabPosition` | `variant: 'glass' \| 'card'` (the old `'sheet'` look is `'card'`), `appearance: 'auto' \| 'light' \| 'dark'`, `collapse: 'fab' \| 'hide' \| 'none'`, `snapPoints`, `aria-label`, `<FloatingSheetFab side align>` | **care** |
| FloatingSheet and ArtifactChatContainer `variant="sheet"` (6.0 previews), `FloatingSheetVariant` `'sheet'` | `variant="card"` | the opaque card, named as on SheetContent |
| `FloatingSheetTone`, `FloatingSheetFabPosition`, `FloatingSheetAppearance` (`glass` / `sheet`); `sheetToneProps` | `FloatingSheetAppearance` (`auto` / `light` / `dark`), `FloatingSheetVariant`, `FloatingSheetFabSide`, `FloatingSheetFabAlign`, `FloatingSheetCollapse`; removed | |
| `floatingSheetSurfaceVariants({ appearance })`, `floatingSheetFabVariants({ appearance, position })`, `floatingSheetVariants({ tone })` | `({ variant, hidden })`, `({ variant, side, align })`, `floatingSheetVariants()` | |
| `useHideOnScroll` from `floating-sheet` | `@/lib/scroll-edge` | the barrel name is unchanged |
| `lib/persistent-host`: `createOutletStore`, `OutletStore`, `ChatHostContext`, `ComposerPortal`, `usePersistentHost`, `useAttachHost` | `useKeptChildren` (`@/lib/kept-children`, public) | one way to keep children mounted across homes: `const kept = useKeptChildren(children, { slot })`, render `kept.portal`, put `ref={kept.dock}` on the current home |
| ArtifactChatContainer `appearance` painted the whole container (the artifact too) | it paints the chat surfaces only | scope `ArtifactChatContainerContent` yourself to match the chat (map-chat does) |
| ArtifactChatContainer's working status named "…, Add something new" | named "Write a message", the status as its description | |
| `PK_TOOLS`, `PK_INKS`, `PK_W`, `PK_TOOL_ICONS`, `PencilToolDef` | `pencilTools` (`{ options, opacity }`), `pencilInks` (`{ value, label }[]`), `pencilWidths` (`{ scale, dot, label }[]`), `pencilToolIcons`, `pencilToolLabels` | module exports of `@/components/ui/pencilkit/constants`, not in the barrel |
| `PencilStroke { color, w, pen, done }`; `StrokePath({ st, pf })`; `MemoStroke`, `outlinePath` | `{ ink, widthScale, pressure, complete }`; `StrokePath({ stroke, variant })` (memoized); removed | one vocabulary with the canvas: `ink` is a CSS color, `widthScale` multiplies the nib (not px) |
| PencilCanvas `hint`, `status`, `plain`, `width` | `emptyState`, removed (render a label as a child), `variant="plain"`, `widthScale` | inside a `<Canvas>` it is the board's drawing layer |
| `PencilToolButton`, `pencilToolButtonVariants`, `PencilToolbarDivider` | the kit's `ToolbarButton` / `ToggleGroupItem`, `ToolbarSeparator` | |
| `ToolPicker`, `InkPicker value: number`, `WidthPicker value: number` (indexes) | `PencilToolPicker`, `PencilInkPicker value: string` (the ink), `PencilWidthPicker value: number` (the scale) | **care**. All three take `defaultValue` |
| `PencilToolbar` that placed itself at the bottom and found `PencilActions` by type | an in-flow kit `Toolbar` (`variant="floating"`); its `trailing` prop for the group that stays in view | position it yourself |
| CanvasMiniMap `position`; Canvas `cursor` | `side: 'top' \| 'bottom'` + `align: 'start' \| 'end'`; `className="cursor-crosshair"` or `style={{ cursor }}` | |
| `CanvasFrame dashed` | `CanvasFrame variant="dashed"` (`canvasFrameVariants({ variant: 'default' \| 'dashed' })`) | a boolean that picks a look is a variant |
| VideoPreview, VideoTimeline, PlaybackControls, PlaybackTimecode `clock` | `playback` | |
| `SheetContent variant="card"` | `SheetContent variant="default"` (the default); new `variant="tray"` | one name per look across Dialog and Sheet: `default` is attached to its edge, `tray` floats 10px in, `panel` is the edge panel |
| `AlertDialogClose variant="destructive"` | `AlertDialogClose tone="destructive"` (`alertDialogCloseVariants({ variant: 'default' \| 'cancel', tone: 'default' \| 'destructive' })`) | red text is a semantic colour: `tone`, as `ListRow tone="destructive"` |
| `ArtifactChatComposingChangeDetails`, `ArtifactChatComposingChangeReason`, `ArtifactChatPresentation`, `ArtifactChatSide`; `onMinimizedChange` typed with `FloatingSheetMinimizedChangeDetails` | `ArtifactChatContainerComposingChangeDetails`, `ArtifactChatContainerComposingChangeReason`, `ArtifactChatContainerPresentation`, `ArtifactChatContainerSide`; `ArtifactChatContainerMinimizedChangeDetails` | every type carries the root's prefix; `useArtifactChatContainer().setOpen / setComposing / setMinimized` return `false` when the change was canceled |
| Conversation slots `user-message`, `assistant-message`, `typing-indicator`, `work-log`, `tool-call` | `conversation-user-message`, `conversation-assistant-message`, `conversation-typing`, `conversation-work-log`, `conversation-tool-call` | a part's slot is its name; a work log's steps are a list (`ul` / `li`) |
| SidebarProvider `breakpoint={560}` (one number, default 560) | `breakpoints={{ medium: 560 }}` (default `{ medium: 640, regular: 1024 }`) | the same spelling and default as SplitView's `breakpoints`; a provider that relied on 560 passes it |
| ArtifactChatContainer `breakpoint={760}` (one number, default 760) | `breakpoints={{ medium: 760 }}` (`SizeClassBreakpoints`, default `{ medium: 760, regular: 1024 }`) | the same spelling as every size-class scope; the default keeps 760 (not 640) so the artifact beside the 400px docked chat is never narrower than a phone, and a container that relied on 760 needs no change |
| discord-clone `ChatShell breakpoint={880}` (one number, default 880) | `breakpoints={{ medium: 880 }}` (`SizeClassBreakpoints`, default `{ medium: 880, regular: 1024 }`) | the same spelling as every size-class scope; the shell keeps its wider default so the navigation docks only beside a usable conversation |
| VideoPreview's `PreviewMedia` (`{ url, kind }`), VideoTimeline's `TimelineMediaInfo` (`{ duration, kind, name? }`) | one `VideoTimelineMedia` (`{ kind, url?, duration?, name? }`), exported with VideoTimeline and `lib/video-timeline-model` | build one map for both |
| `PlaybackControls`, `PlaybackTimecode` (+ props), slot `playback-timecode` | `VideoPreviewControls`, `VideoPreviewTimecode`, slot `video-preview-timecode` | the controls are a kit `Toolbar` |
| `rulerSteps`; Waveform `tone="primary"` | private; `className="text-primary"` (tones `default`, `muted`, `success`, `warning`, `destructive`) | |
| `@brett_lamy/ui/tui` | `@brett_lamy/ui/tui-preview` | every component module is a package entry now, at its registry path (`@/components/ui/<x>` ↔ `@brett_lamy/ui/<x>`) |
| `FONT`, `BARH`, `pressable`, `brandTile` from `@brett_lamy/ui` | `pressable`, `brandTile`, `BARH`: `@/lib/primitives` (registry installs; not npm API). `FONT`: removed, use the `font-sans` utility | the kit's class fragments, not part of a component's API. `cn` stays on the root and `cx` joins it |
| `IC`, `ICON_WEIGHTS` from `@brett_lamy/ui` | `isIconName(name)` instead of `IC[name]` (the shapes map is private); `ICON_WEIGHTS` from `@brett_lamy/ui/lib/icon` | `Icon`, `ICON_NAMES` and the other lists stay on the root |
| `BLSafeCtx`, `BLStickyCtx`, `AppearanceContext`, `ThemeScopeContext`, `themeScopeClass`, `tintVars`, `themeVarStyle`, `chromeStore`, `chromeOffset` from `@brett_lamy/ui` | read them with `useAppearance()`, `useThemeScope()`, `useThemeScopeProps()` / `themeScopeProps()` and `useChromeHidden()`; drive hide-on-scroll with `setChromeHidden(hidden)`. `themeScopeClass`, `tintVars`, `themeVarStyle` from `@brett_lamy/ui/lib/theme` | the contexts, `chromeStore` and `chromeOffset` are internal (`@/lib/theme-context`, no npm entry) |
| `SyntaxToken`, `SyntaxTokenType` | `CodeToken`, `CodeTokenType` | the same types, under one name |
| `defineSlot`, `collectSlots`, `SlotComponent`, `SlotProps` (`lib/container`) | removed | nothing used marker slots once the dotted statics became flat parts |
| `useMountPresentationKey`, `isLightSurface`, `flipSnapshot`, `flipPlay`, `FlipSnapshot` from `@brett_lamy/ui` | internal: `@/lib/container`; `isLightSurface` is private to `@/lib/trigger-palette`; `flipSnapshot`, `flipPlay`, `FlipSnapshot` from `@brett_lamy/ui/lib/motion` | plumbing of the popups and the motion helpers |
| from `@brett_lamy/ui`: `rotatePt`, `centerOf`, `HANDLE_DIR`, `ALL_HANDLES`, `EDGE_HANDLES`; `StreamFullError`, `pack`, `unpack`; `FONT_CATEGORIES`, `googleFontsUrl`; `sqlSpans`, `splitStatements`, `positionToLineColumn`, `SqlSpan`, `SqlSpanType`, `SqlStatement`; `formatCell`, `toCsv`, `toJson`, `pgTypeName`, `formatDuration`, `pluralRows`, `PG_TYPE`, `FormattedCell`, `CellKind`, `TabularResult` | `@brett_lamy/ui/lib/canvas-math` (the canvas helpers), `@brett_lamy/ui/lib/append-stream`, `@brett_lamy/ui/lib/google-fonts`; registry only: `@/lib/sql-lex`, `@/lib/sql-format` | the session recorder's store, FontPicker's catalog, the SQL console's internals |
| from `@brett_lamy/ui`: `treeFromPaths`, `visibleTreeRows`; `useFileUploadContext`; `workspaceTabsets`; `timelineZoomRange` | `@brett_lamy/ui/tree`, `/file-upload`, `/workspace`; `videoTimelineZoomRange` from `/video-timeline` | the module's own entry |
| from `@brett_lamy/ui`: the engine helpers no page documents: `parseDataDir`, `readServerInfo`, `runtimePostgresMajor`, `identifier`, `quoteIdent`, `quoteLiteral` (pglite-core), `detectImportFormat`, `readArchiveVersion`, `dumpVersion` (pglite-transfer), `detectPersistenceSupport` (pglite-storage), `inferColumnType`, `sortTextPermutation`, `histogramCpu`, `binScale`, `GPU_MIN_ROWS`, `MAX_BINS` (spreadsheet-model), `csvField`, `detectDelimiter` (csv), `DATE_PRESETS`, `FILTER_OPERATORS`, `RELATIVE_UNITS`, `createFilterId`, `emptyValue`, `isDateValue`, `isFilterComplete` (filter-model), `createTailscaleFetch`, `toTailscaleRequest`, `toResponse`, `isSafeLoginUrl` (tailscale), `encodeTailscalePolicy`, `decodeTailscalePolicy`, `describeTailscalePolicy`, `isTailnetHost`, `isTailnetAddress` (tailscale-policy), `tailscaleServiceWorkerUrl`, `tailscaleRouterUnsupportedReason` (tailscale-router/bridge), `parseRate` (ffmpeg), `wavPeaks` (ffmpeg/media), `probeMedia`, `mediaFrames`, `mediaPeaks` (ffmpeg/react), `trackDuration`, `findClip`, `timelineId`, `magneticIndex`, `timelineLooks`, `lookCss`, `lookFfmpeg` (video-timeline-model), `renderMime` (video-render), `createLineState`, `eraseLine`, `wordAtCursor`, `formatColumns`, `cellWidth`, `textWidth`, `stripAnsi`, `advance`, `toTerminalNewlines`, `trimTranscript`, `MAX_HISTORY`, `LineState`, `LineEvent`, `LineStep`, `RenderedLine`, `CellPosition`, `CompletionStep` (terminal-line), `fileBaseName`, `fullLocation`, `shortLocation` (call-stack-model), `requestDisplayName`, `requestTone` (request-table-model), `TRACE_SCRUB_SPEEDS` (trace-timeline-model), `childrenOfValue` (object-tree-model) | `@brett_lamy/ui/lib/<module>` (the registry's `@/lib/<module>`) | the root keeps the components, their parts, cvas, controllers and the kit's own hooks; every engine module is on its own entry (next rows) |
| `DEFAULT_OPENCODE_PREVIEW_URL`, `DEFAULT_OPENCODE_RUNTIME_URL`, `loadOpenCodeRuntime`, `createVaultOpenCodeCredentialStore`, `createVaultOpenCodeConnectionStore`, `OPENCODE_CREDENTIAL_SLOT`, `OPENCODE_CONNECTION_SLOT` from `@brett_lamy/ui` | `@brett_lamy/ui/opencode` | the OpenCode entry |
| `BLProvider dark` (`dark`, `dark={false}`) | `appearance: 'auto' \| 'light' \| 'dark'` (`appearance="dark"`, `appearance="light"`); `'auto'`, the default, follows the ambient appearance | mechanical. `ThemeScope` and `OpenCode` take `'auto'` too; the type is `AppearancePreference` (`Appearance` is the resolved `'light' \| 'dark'`) |
| ArtifactChatContainer `layout`, `ArtifactChatLayout`, `useArtifactChatContainer().layout`, `data-layout`, `artifactChatContainerVariants({ layout })` | `presentation` (`'auto' \| 'split' \| 'floating'`), `ArtifactChatContainerPresentation`, `.presentation`, `data-presentation`, `({ presentation })` | mechanical; `auto` reads the container's own size class |
| DataTable / RequestTable `layout`, `data-layout` | `presentation` (`'auto' \| 'table' \| 'stacked'`), `data-presentation` | mechanical |
| CodeEditor `lineDecoration` `{ tint }` (`'current' \| 'info' \| 'success' \| 'warning' \| 'danger' \| 'muted'`), the band's `data-tint` | `{ tone }` with `destructive` for `danger`; `data-tone` | mechanical |
| Workspace `TabDropRegion` `left` / `right`; `controller.getActiveTabsetId()`; a tabset's `data-active` | `WorkspaceDropRegion` `start` / `end` (the inline edges); `getCurrentTabsetId()`; `data-current` | the drop indicator's `data-region` is logical too |
| Workspace types `TabNode`, `TabsetNode`, `SplitNode`, `TabNodeInput`, `TabsetNodeInput`, `SplitNodeInput`, `TabDropTarget`, `TabDropRegion` | `WorkspaceTabNode`, `WorkspaceTabsetNode`, `WorkspaceSplitNode`; the three inputs are one type, `WorkspaceNodeInput` (a tabset or a split); `WorkspaceDropTarget`, `WorkspaceDropRegion` | mechanical |
| FileUploadDropzone `hint` | `description` | mechanical |
| TailscaleSummary `detail` | `description` | mechanical |
| `useQuery`, `useLiveQuery`, `useSchema` result `isLoading` | `loading` | mechanical |
| `ValueToken.tint` (`previewTokens`) | `ValueToken.type`, as `CodeToken.type` | mechanical |
| ProgressStepper parts `ProgressStep`, `ProgressStepIcon`, `ProgressStepTrack`, `ProgressStepLabel`, `ProgressStepDescription`, `ProgressStepProps`, and `ProgressStepState` as their state; data type `ProgressStepItem`; slots `progress-step*` (6.0 previews, but `ProgressStepState`: see the row above) | `ProgressStepperItem`, `ProgressStepperItemIcon`, `ProgressStepperItemTrack`, `ProgressStepperItemLabel`, `ProgressStepperItemDescription`, `ProgressStepperItemProps`, `ProgressStepperItemState`; `ProgressStepperStep`; `progress-stepper-item*` | mechanical |
| `unsupportedMessage` (vault-gate) | `vaultUnsupportedMessage` | mechanical |
| `direction`, `fades` (`lib/motion`) | `motionDirection`, `motionFades` | mechanical |
| `deviceId` (`lib/durable-streams`) | `cloudDeviceId`, on `@brett_lamy/ui/lib/durable-streams` | mechanical |
| `createStack`, `Stack`, `StackExit`, `StackOptions`, `StackReason`, `StackChangeOptions` (`lib/stack`, 6.0 previews) | `createPageStack`, `PageStack`, `PageStackExit`, `PageStackOptions`, `PageStackReason`, `PageStackChangeOptions` | mechanical: a root name says what it is without its module |
| `PageStackOptions.active` (`createPageStack`, 6.0 previews) | `when` | mechanical: the fork's name for the same idea on `bindLayer` |
| `TimelineDrop`, `timelineMediaType`, `fitTimelineZoom`, `timelineZoomRange` (video-timeline); `TimelineMedia`, `TimelineDropDetails` (6.0 previews); `TrackKind` (`lib/video-timeline-model`) | `VideoTimelineMedia`, `VideoTimelineDrop`, `VideoTimelineDropDetails`, `videoTimelineMediaType`, `fitVideoTimelineZoom`, `videoTimelineZoomRange` (on `@brett_lamy/ui/video-timeline`); `TimelineTrackKind` (on `@brett_lamy/ui/lib/video-timeline-model`) | mechanical: the kit has two timelines (TraceTimeline's names are `Trace…`) |
| FileUpload / `useFileUpload` / `useFileUploadContext()` `busy`; the root's `data-busy` (6.0 previews) | `pending`; `data-pending` | mechanical: an action in flight is `pending` |
| `SizeClass`, `SizeClassBreakpoints` from `@/lib/container` | from `@/lib/size-class` (`@brett_lamy/ui/lib/size-class`), or the root | one import path per name |
| `@brett_lamy/ui/lib/icon-shapes/chat`, `/docs`, `/pencilkit`, `/workbench` (`CHAT_SHAPES`…); `@brett_lamy/ui/lib/spreadsheet-gpu`; `@brett_lamy/ui/lib/trace-timeline-draw` (6.0 previews) | no entry: draw the shapes with `<Icon name>`; Spreadsheet and TraceTimeline use the other two themselves | implementation files, now `@internal` |
| loop-qa block: `Pill tone` `critical`, `info`, `primary`, `neutral`, `outline`; `SEVERITY_TONE`, `STATUS_TONE` hold a tone | the kit's tones plus a look: `tone="destructive" variant="solid"`, `tint="var(--lq-info)"`, `tone="default"`, `tone="muted"`, `tone="muted" variant="outline"`; the tables hold a `PillLook` (`{ tone, variant, tint }`) to spread on a `Pill` | |
| map-chat block: `MapPin.color`, `MapRoute.color`; `MapPin.badge` | `tint`; `icon`, which takes a map icon's name or your own content (a stop's number) | |
| replay-debugger block: `DebuggerToolbar` / `DevToolsControl` `compact` | `sizeClass`; left out, the nearest size-class scope (ReplayDebugger is one) | |
| macos block: `Tile tone` (a name or two gradient stops), `dark`; `DesktopApp.tile`, `darkGlyph` | `variant` (a named tile) or `tint` (your two stops); `foreground="dark"`; `DesktopApp.tint`, `foreground` | |
| The blocks' starting-value props `initial…`: apple-settings `initialPath`; github-clone `initialTab`, `initialPullRequest`, `initialPullRequestTab`, `initialPath`; loop-qa `initialProject`, `initialTab`, `initialPage`; apple-mail `initialMailbox`, `initialMessage`, `initialDraft`; apple-music `initialSection`, `initialAlbum`; apple-notes `initialFolder`, `initialNote`, `initialView`; apple-passwords `initialCategory`, `initialItem`, `initialSignIn`; apple-reminders `initialList`; codex-clone `initialChat`; freeform `initialBoard`; interface-builder `initialSelection`, `initialRunning`; macos `initialApps`, `initialPages`, `initialQuery`, `initialMenu`, `initialDock`; saas-checkout `initialStep`; safari `initialUrls`; strudel-studio `initialSong`; vscode `initialFile`, `initialView`; worktree-atlas `initialWorktree`, `initialView`; split-view-demos `SplitViewLibraryDemo initialAlbum` | `default…` with the same suffix (`defaultPath`, `defaultTab`, `defaultPullRequest`, `defaultPullRequestTab`, …) | an uncontrolled starting value is `default…` everywhere, as `defaultOpen` and `defaultValue`. map-chat's `initialPrompt` stays: it sends a message on mount, it is not a starting value |
| discord-clone `useChatShell().compact`; t3-clone `useWorkbenchShell().compact` | `.sizeClass === 'compact'` | the shells' context carries the size class only |
| `alphabetItems` (index-bar, 6.0 previews); `LogRowState` (log-list); `REQUEST_COLUMNS`, `RequestColumnId` (request-table) | `indexBarAlphabetItems`; `LogListRowState`; `REQUEST_TABLE_COLUMNS`, `RequestTableColumnId` | mechanical: the component's prefix |
| `Countdown` (what `useCountdown` returns) | `UseCountdown` | mechanical |
| `Hud` (the toast HUD type) | `ToastHud` | mechanical |
| Sheet side `left` / `right` in the docs, examples and stories | `start` / `end` (Sheet follows the writing direction; `left` / `right` still pin a physical edge) | the stories are `Start` / `End` |
| from `@brett_lamy/ui`: the engine modules (passkey, vault, vault-storage, vault-react, pglite, pglite-core, pglite-transfer, pglite-files, pglite-schema, pglite-storage, tab-lock, spreadsheet-model, csv, filter-model, filter-query, file-upload-model, file-upload-primitive, use-file-upload, tailscale, tailscale-policy, tailscale-exit, tailscale-react, tailscale-connect, tailscale-fake, tailscale-router/bridge, tailscale-router/react, ffmpeg, ffmpeg/media, ffmpeg/react, video-timeline-model, video-render, playback, trace-timeline-model, code-editor-model, code-document, code-editor-gpu, object-tree-model, call-stack-model, log-list-model, data-table-model, request-table-model, terminal-line): `createVault`, `VaultProvider`, `useEncryptedState`, `PGliteProvider`, `useQuery`, `openDatabase`, `parseCsv`, `createFfmpeg`, `useFfmpeg`, `TailscaleProvider`, `createFakeTailscaleClient`, `xhrUpload`, `useFileUpload`, `Timeline`, `LogRow`, `RequestRow`, `CallStackFrame`, … | `@brett_lamy/ui/lib/<module>` (`@/lib/<module>` in a registry install), e.g. `import { createVault } from '@brett_lamy/ui/lib/vault'` | **care**: one import path per name. The components stay on the root and on their module entry |
| from `@brett_lamy/ui`: the canvas math (`toBoard`, `toScreen`, `MIN_SIZE`, `dist`, `cornersOf`, `rectOf`, `unionRect`, `intersects`, `inFrame`, `distToSegment`, `distToPolyline`, `frameHandles`, `handleCursor`, `resizeFrame`, `rotateFrame`, `snapMove`, `Viewport`, `Frame`, `Guide`, `Handle`, `HandleId`, `Pt`, `Rect`) | `@brett_lamy/ui/lib/canvas-math` | its own manifest and entry |
| from `@brett_lamy/ui`: the storage engines: `LocalStreams` (append-stream); `DurableStreamsClient`, `CloudSync`, `useCloud`, `cloudDeviceId`, `DurableStreamsConfig`, `CloudSettings`, `CloudStatus` (durable-streams); `startSessionRecording`, `sessionCloud`, `readSession`, `deleteSession`, `clearSessions`, `currentSessionId`, `storageUsage`, `RecordedEvent`, `IndexRecord` (session-recorder); `loadJSON`, `saveJSON` (persistent-state) | `@brett_lamy/ui/lib/append-stream`, `@brett_lamy/ui/lib/durable-streams`, `@brett_lamy/ui/lib/session-recorder`, `@brett_lamy/ui/lib/persistent-state` (`@/lib/<module>` in a registry install) | the hooks stay on the root (`useSessionRecording`, `useSessions`, `useSessionCloud`, `usePersistentState`); `useCloud` goes with the `CloudSync` it takes |
| from `@brett_lamy/ui`: `encodeQR`, `QRMatrix`, `QRLevel`, `QROptions` (qr); `GOOGLE_FONTS`, `findGoogleFont`, `fontStack`, `loadGoogleFont`, `GoogleFont`, `FontCategory` (google-fonts); `parseTime`, `loadGpuTime`, `formatOccurrence`, `timeTextSegments`, `describeRecurrence`, `rruleLine`, `TimeParseOptions`, `TimeParseResult`, `TimeOccurrence`, `TimeDiagnostic`, `TimeSpan`, `FormatOccurrenceOptions`, `TimeTextSegment` (gpu-time); `parseCronText`, `gpuCronAvailable`, `describeCronError`, `GpuCronMatch` (gpu-cron); `validateCron`, `cronProblems`, `nextCronRuns`, `describeCron`, `splitCron`, `CRON_FIELDS`, `CronValidation`, `CronFieldName`, `CronFieldInfo`, `NextCronRunsOptions`, `DescribeCronOptions` (cron); `previewFromValue`, `previewText`, `previewTokens`, `copyTextOf`, `ValuePreview`, `ValuePreviewOptions`, `ValueProperty`, `ValueMapEntry`, `ValueType`, `ValueToken`, `ValueTokenType` (object-tree-value); `formatFileSize` (file-size) | `@brett_lamy/ui/lib/qr`, `lib/google-fonts`, `lib/gpu-time`, `lib/gpu-cron`, `lib/cron`, `lib/object-tree-value`, `lib/file-size` (`@/lib/<module>` in a registry install) | each engine module on its own entry; the hooks stay on the root (`useGoogleFont`, `useGoogleFontStatus`, `useTimeParse`, `useCronParse` and their option and state types) |
| from `@brett_lamy/ui`: `lexSyntax`, `tokenizeLines`, `languageFromPath`, `webgpuSupported`, `probeWebGPU`, `SyntaxHighlighter`, `SyntaxResult`, `SyntaxEngine`, `WebGPUProbe` (syntax); `SyntaxSpan` | `@brett_lamy/ui/lib/syntax` (`@/lib/syntax`); `SyntaxSpan` from `@brett_lamy/ui/lib/syntax-lexer`, the lexer CodeEditor's fallback and docstream's fences share | `CodeToken` and `CodeTokenType`, which CodeEditor's props use, stay on the root |
| `@brett_lamy/ui/composer/composer`, `@brett_lamy/ui/composer/composer-cards` | `@brett_lamy/ui/composer` (`@/components/ui/composer`) | a folder is one module: its `index.ts` is the entry, its files are the implementation |
| `@brett_lamy/ui/pencilkit/pencil-canvas`, `/pencil-toolbar`, `/stroke-path`, `/use-pencil-history`, `/pencilkit-annotator`, `/image-annotator`, `/constants` | `@brett_lamy/ui/pencilkit` (`@/components/ui/pencilkit`) | the same; `pencilTools`, `pencilToolLabels`, `pencilToolIcons`, `pencilInks`, `pencilWidths` and `PencilToolDef` (the tool palette's tables) are internal now |
| from `@brett_lamy/ui`: `createAlmostNodeOpenCodeHost`, `createAgentWasmOpenCodeHost`, the `OpenCode…` host and store types | `@brett_lamy/ui/opencode` | the OpenCode entry |
| `chromeStore.set(hidden)` | `setChromeHidden(hidden)` | on the root, beside `useChromeHidden` |
| `@brett_lamy/ui/composer/composer-files`; `useComposerInternals`, `ComposerOutlet` from `@brett_lamy/ui/composer/composer`; `CalendarMonthsContext` (calendar), `useInMessageScroller` (message-scroller), `useImageAnnotatorEngine` (pencilkit/image-annotator) | internal: no npm entry (`@/components/ui/composer/composer-files`, `composer/composer-context`, `@/lib/calendar-months`, `@/lib/message-scroller-context`, `@/components/ui/pencilkit/annotator-engine` in a registry install) | the kit's wiring between its own modules |

A component's props and data types follow it: `ComboBoxProps`, `ComboBoxInputProps` and `ComboBoxContentProps` are `ComboboxProps`, `ComboboxInputGroupProps` and `ComboboxContentProps`; `ListBoxSectionProps` and `DropdownMenuSectionProps` have no counterpart (a group takes UI SDK's props); `DateRangePickerProps` and `DateRangePickerContentProps` are `DatePickerProps` and `DatePickerContentProps`; `CalendarCellProps`, `ColorAreaProps`, `ColorSliderProps`, `ColorThumbProps`, `ColorSwatchPickerProps` and `ColorSwatchPickerItemProps` are the props of the parts that replace them (`ComponentProps<typeof CalendarDay>` and so on); `ColorFieldGroupProps` is `ColorPickerInputGroupProps`; `CommandInputProps`, `CommandListProps`, `CommandGroupProps`, `CommandItemProps`, `CommandPageProps` and `CommandFooterProps` are the `CommandMenu…Props` of the same part; `FileItemProps` and `FileListProps` are `FileUploadItemProps` and `FileUploadListProps`; `ToolPickerProps`, `InkPickerProps` and `WidthPickerProps` are `PencilToolPickerProps`, `PencilInkPickerProps` and `PencilWidthPickerProps`; `PencilToolButtonProps` is `ToolbarButtonProps`; `PlaybackControlsProps` and `PlaybackTimecodeProps` are `VideoPreviewControlsProps` and `VideoPreviewTimecodeProps`; `ComposerFabProps` and `ComposerOutletProps` are not public; `SyntaxHighlightingProps`, `SyntaxHighlightingTitle`, `SyntaxHighlightingContent`, `SyntaxHighlightingContentProps`, `SyntaxHighlightingCopyButton` and `SyntaxHighlightingCopyButtonProps` are CodeEditor's (see [Other components](#other-components)). The Docstream types the kit no longer re-exports come from `@brett_lamy/ui/docstream`: `ReplayMeta`, `ReplayPointerTrack`, `ReplayConsoleEntry`, `ReplayConsoleLevel`, `ReplayDevtoolsState`, `ReplayRequest`, `ReplayStageHandle`, `ReplayStageLayout`, `ReplayStageProps` from `/replay`; `StrudelRackProps`, `RackGridProps`, `StepGridProps`, `ControlProps`, `GridItem`, `GridLayout`, `StrudelArg`, `StrudelCall`, `StrudelChain`, `StrudelMix`, `StrudelSong`, `StrudelTempo`, `StrudelTrack`, `MiniNode`, `MiniAtom`, `MiniGroup`, `MiniLayers`, `MiniAlternation`, `MiniPolymeter`, `MiniSequence`, `MiniSlice`, `MiniStep`, `MiniSubcycle`, `MiniOp` from `/strudel/rack`.

### Before and after for the ones that need care

**A tool that stays on** (Button `active`):

```tsx
// before
<Button variant="quiet" size="icon-sm" active={starred} onClick={toggle} aria-label="Star"><Icon name="star" /></Button>
// now
<Toggle variant="quiet" size="icon-sm" pressed={starred} onPressedChange={setStarred} aria-label="Star"><Icon name="star" /></Toggle>
```

**The Tailscale panel** (`TailscaleMenu`):

```tsx
// before
<TailscaleMenu variant="radio" onExitNode={choose} detail="4 pages…" />
<TailscaleStatusBadge compact />
// now
<PopoverTitle className="sr-only">Tailscale connection</PopoverTitle>
<div className="flex flex-col gap-3">
  <TailscaleSummary description="4 pages…" />
  <TailscaleExitNodes onAction={choose} />
  <TailscaleLoginButton size="sm" variant="outline" />
</div>
<TailscaleStatusBadge variant="pill" />
```

**Forms and model-driven fields** (`Form`, NaturalTimeInput, FileUploadDropzone, FilterBar):

```tsx
// before
<Form onSubmit={save} className="gap-6">…</Form>
<TimeInput label="When" description="…" invalid error="…" dateOrder="DMY" debounceMs={50} />
<FileDropZone size="compact" invalid error="Add a file" onFiles={add} />
<FilterBar fields={fields} value={filters} onValueChange={setFilters} hotkey="f" showMatch />
// now
<FieldGroup className="gap-6" render={<form onSubmit={save} />}>…</FieldGroup>
<Field invalid>
  <FieldLabel>When</FieldLabel>
  <NaturalTimeInput parse={{ dateOrder: 'DMY', debounceMs: 50 }} />
  <FieldDescription>…</FieldDescription>
  <FieldError>…</FieldError>
</Field>
<Field invalid>
  <FileUploadDropzone orientation="horizontal" onFiles={add} />
  <FieldError>Add a file</FieldError>
</Field>
<FilterBar fields={fields} value={filters} onValueChange={setFilters}>
  <FilterToolbar><FilterMenu shortcut="f" /><FilterList /><FilterMatch /><FilterClear /></FilterToolbar>
</FilterBar>
```

**Credenza → the Dialog flow.** Every Credenza part is a Dialog part, and `Dialog` is responsive by default:

```tsx
// before
<Credenza open={open} onOpenChange={setOpen} view={view}>
  <CredenzaBackdrop />
  <CredenzaContent>
    <CredenzaHeader><CredenzaBack hidden={view === 'menu'} onClick={back} /><CredenzaTitle>{title}</CredenzaTitle><CredenzaClose /></CredenzaHeader>
    <CredenzaView>…</CredenzaView>
  </CredenzaContent>
</Credenza>
// now
<Dialog open={open} onOpenChange={setOpen} view={view}>
  <DialogBackdrop />
  <DialogContent variant="tray">
    <DialogHeader variant="bar"><DialogBack hidden={view === 'menu'} onClick={back} /><DialogTitle>{title}</DialogTitle><DialogClose /></DialogHeader>
    <DialogView>…</DialogView>
  </DialogContent>
</Dialog>

// A Dialog that must stay a centered card on a phone now says so:
<Dialog presentation="dialog">…</Dialog>

// before
<PasskeyEnrollDialog open={open} onOpenChange={setOpen} appName="Notes" />
// now (from vault-gate)
<VaultEnrollDialog open={open} onOpenChange={setOpen} appName="Notes" />
<VaultEnrollDialog appName="Notes"><DialogTrigger render={<Button />}>Protect…</DialogTrigger></VaultEnrollDialog>
```

**A sheet that steps between views** (`SheetContent animateHeight`). Keep the header outside the view, so the sheet stays named while the title changes:

```tsx
// before
<Sheet><SheetContent animateHeight>{step === 'pick' ? <Pick /> : <Confirm />}</SheetContent></Sheet>
// now
<Sheet view={step}>
  <SheetBackdrop />
  <SheetContent>
    <SheetClose />
    <SheetHeader><SheetTitle>{TITLES[step]}</SheetTitle></SheetHeader>
    <SheetView>{step === 'pick' ? <Pick /> : <Confirm />}</SheetView>
  </SheetContent>
</Sheet>
```

**EdgeDrawer and SideDrawer** become a contained Sheet and an AdaptivePane:

```tsx
// before
<EdgeDrawer side="start" open={open} onOpenChange={setOpen} aria-label="Menu" width={280} zIndex={20} className="bg-sidebar">…</EdgeDrawer>
// now
<Sheet contained side="start" open={open} onOpenChange={setOpen}>
  <SheetBackdrop />
  <SheetContent variant="panel" keepMounted initialFocus="content" aria-label="Menu" className="w-70 bg-sidebar">…</SheetContent>
</Sheet>

// before
<SideDrawer presentation={wide ? 'fixed' : 'auto'} open={open} onOpenChange={setOpen} title="Thread" width={360}>{children}</SideDrawer>
// now
<AdaptivePane side="end" presentation={wide ? 'column' : 'auto'} open={open} onOpenChange={setOpen} columnWidth={360} drawerWidth="min(360px, 88%)">
  <AdaptivePaneHeader><AdaptivePaneTitle>Thread</AdaptivePaneTitle><AdaptivePaneClose /></AdaptivePaneHeader>
  <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
</AdaptivePane>

// before: a column hidden by presentation, a separate drawer state, two class props
<AdaptivePane presentation={narrow ? 'drawer' : navOpen ? 'column' : 'hidden'} open={narrow && navOpen} drawerMaxWidth="84%"
  columnClassName="flex flex-col border-r bg-card" className="flex flex-col border-r bg-card">…</AdaptivePane>
// now: `open` is "shown" in every presentation
<AdaptivePane presentation={narrow ? 'drawer' : 'column'} open={navOpen} onOpenChange={setNavOpen} className="border-r border-border bg-card">…</AdaptivePane>
```

**Context menus** are a trigger part of DropdownMenu:

```tsx
// before
<ContextMenu onAction={run}>
  <ContextMenuTrigger className="rounded-xl">…</ContextMenuTrigger>
  <ContextMenuContent aria-label="Photo actions"><ContextMenuItem value="copy">Copy</ContextMenuItem></ContextMenuContent>
</ContextMenu>
// now
<DropdownMenu onAction={run}>
  <DropdownMenuContextTrigger className="rounded-xl">…</DropdownMenuContextTrigger>
  <DropdownMenuContent aria-label="Photo actions"><DropdownMenuItem value="copy">Copy</DropdownMenuItem></DropdownMenuContent>
</DropdownMenu>
```

**TabView and TabBar** are looks of `Tabs`. The look moves from the bar to the root, and a tab's label is its children:

```tsx
// before
<TabView orientation="vertical" defaultValue="blui">
  <TabViewBar variant="workspace">
    <TabViewList aria-label="Workspaces">
      <TabViewTab value="blui" aria-label="BL UI HQ"><TabViewPill /></TabViewTab>
    </TabViewList>
  </TabViewBar>
</TabView>
<TabBar items={items} value={tab} onValueChange={setTab} />
// now
<Tabs variant="switcher" defaultValue="blui">
  <TabsBar>
    <TabsList aria-label="Workspaces">
      <TabsTab value="blui" aria-label="BL UI HQ"><TabsPill /></TabsTab>
    </TabsList>
  </TabsBar>
</Tabs>
<Tabs variant="bar" value={tab} onValueChange={(next) => next && setTab(next)} className="contents">
  <TabsBar>
    <TabsList aria-label="Tabs">
      {items.map((it) => <TabsTab key={it.value} value={it.value} icon={it.icon}>{it.title}</TabsTab>)}
    </TabsList>
  </TabsBar>
</Tabs>
```

**Display components** (QR codes, avatar groups, Celebrate):

```tsx
// before
<QRSvg value={url} title="Join" color="black" />
<AvatarGroup onSelect={(i) => open(people[i])}>{people.map((p) => <Avatar key={p.id} c={{ f: p.first, l: p.last }} />)}</AvatarGroup>
<span className="relative isolate inline-grid"><Celebrate fire={n} /><Badge>Done</Badge></span>
// now
<QRCode value={url} aria-label="Join" className="text-black" />
<AvatarGroup menu onAction={(id) => open(id)}>{people.map((p) => <Avatar key={p.id} name={p.name} />)}</AvatarGroup>
<Celebrate fire={n}><Badge>Done</Badge></Celebrate>
```

**SchemaTree** is a `Tree` drawn from `schemaTreeItems`:

```tsx
// before
<SchemaTree schema={schema} loading={loading} variant="card" onAction={(_id, { table, column }) => { if (!column) insert(table) }} />
// now
<Tree aria-label="Database schema" items={schemaTreeItems(schema)} icons={false} density="compact" loading={loading}
  emptyState="No tables yet" className="rounded-panel bg-card p-1 shadow-hairline"
  onAction={(_value, { node }) => { const n = node as SchemaTreeNode | undefined; if (n?.kind === 'table') insert(n.table) }} />
```

**List rows and the trace timeline:**

```tsx
// before
<ListRow title="Draft" onDelete={remove} edit={editing} leading={<Avatar name="Me" />} subtitle="Me" selected destructive center />
<TraceTimeline label="Session" orientation="vertical" top={8} bottom={8} railWidth={56} renderPreview={(t) => <Thumb t={t} />} previewLines={3} />
// now
<ListRow title="Draft" endActions={[{ label: 'Delete', destructive: true, onAction: remove }]} editing={editing}
  icon={<Avatar name="Me" />} description="Me" current tone="destructive" justify="center" />
<TraceTimeline aria-label="Session" orientation="vertical" className="inset-y-2 w-14">
  <TraceTimelinePreview lines={3}>{(t) => <Thumb t={t} />}</TraceTimelinePreview>
</TraceTimeline>
```

**Pickers** (ColorField, a ColorPicker's popover, Combobox's field, FontPicker):

```tsx
// before
<ColorField defaultValue="#7f5af0" />
<ColorPicker defaultValue="#7f5af0"><Popover><ColorPickerTrigger /><ColorPickerContent /></Popover></ColorPicker>
<ComboboxInput chips clearable clearLabel="Clear cities" placeholder="Add a city" />
<FontPicker aria-label="Font" value={font} onValueChange={setFont} size="sm" side="left" />
// now
<ColorInput defaultValue="#7f5af0" />
<ColorPicker defaultValue="#7f5af0"><ColorPickerTrigger /><ColorPickerContent /></ColorPicker>
<ComboboxInputGroup>
  <ComboboxChips><ComboboxInput placeholder="Add a city" /></ComboboxChips>
  <ComboboxClear aria-label="Clear cities" />
  <ComboboxTrigger />
</ComboboxInputGroup>
<FontPicker aria-label="Font" value={font} onValueChange={setFont}>
  <FontPickerTrigger size="sm" />
  <FontPickerContent side="start" />
</FontPicker>
<FontStackPicker aria-label="Fonts" value={stack} onValueChange={setStack}>
  <FontStackPickerInputGroup size="sm" />
  <FontStackPickerContent side="start" />
</FontStackPicker>
```

A plain combobox field is `<ComboboxInputGroup><ComboboxInput placeholder="Search" /><ComboboxTrigger /></ComboboxInputGroup>`, or `<ComboboxInputGroup />` alone.

**Bars** (EditBar, DebugToolbar, IndexBar):

```tsx
// before
<EditBar count={n} allFav={allFav} onFav={toggleFav} onDelete={remove} />
<DebugToolbar size="compact" onAction={run} />
<IndexBar avail={new Set(letters)} onLetter={jump} top={56} bottom={10} />
// now
<Toolbar variant="bar" aria-label="Edit" className="absolute inset-x-0 bottom-0">
  <ToolbarButton disabled={!n} onClick={toggleFav}>{allFav ? 'Unfavorite' : 'Favorite'}</ToolbarButton>
  <ToolbarText aria-live="polite">{n ? `${n} selected` : 'Select items'}</ToolbarText>
  <ToolbarButton tone="destructive" disabled={!n} onClick={remove}>Delete</ToolbarButton>
</Toolbar>
<DebugToolbar variant="plain" size="sm" onAction={run} />
<IndexBar items={indexBarAlphabetItems(letters)} onJump={jump} className="top-14 bottom-2.5" />
```

**SplitViewStack** is a NavigationStack in the column:

```tsx
// before
<SplitViewDetail>
  <SplitViewStack resetKey={value.sidebar}>
    <Albums />   {/* rows call useSplitViewStack().push(<AlbumPage a={a} />, { key: a.id }) */}
  </SplitViewStack>
</SplitViewDetail>
// now
<SplitViewDetail>
  <NavigationStack resetKey={value.sidebar} renderPage={(key) => <AlbumPage value={key} />}>
    <NavigationStackPage value="albums">
      <NavigationStackBar>
        <NavigationStackLeading><SplitViewSidebarTrigger /></NavigationStackLeading>
        <NavigationStackTitle>Recently Added</NavigationStackTitle>
      </NavigationStackBar>
      <NavigationStackContent>
        <NavigationStackLargeTitle />
        <AlbumGrid />   {/* a tile calls useNavigationStack().push(`album:${id}`) */}
      </NavigationStackContent>
    </NavigationStackPage>
  </NavigationStack>
</SplitViewDetail>
```

**Sidebar:**

```tsx
// before
<Sidebar variant="overlay">
  <Sidebar.Header><Sidebar.Workspace name="Northwind" detail="Sales" initial="N" /></Sidebar.Header>
  <Sidebar.Content>
    <Sidebar.Search />
    <Sidebar.Section title="Pipeline">
      <Sidebar.Item icon="inbox" label="Inbox" badge={6} active tone="var(--primary)" onClick={go} />
    </Sidebar.Section>
  </Sidebar.Content>
</Sidebar>
// now
<Sidebar presentation="drawer">
  <SidebarHeader><SidebarAccount title="Northwind" description="Sales" /></SidebarHeader>
  <SidebarContent aria-label="Northwind">
    <SidebarSearch shortcut="/" onClick={openSearch} />
    <SidebarSection title="Pipeline">
      <SidebarItem icon="tray" title="Inbox" trailing={6} current tint="var(--primary)" onClick={go} />
    </SidebarSection>
  </SidebarContent>
</Sidebar>
```

The old icon keys map to icon names: `home` → `house`, `inbox` → `tray`, `box` → `cube`, `cal` → `calendar`, `user` → `person-bust`, `code` → `branch` or `terminal`, `search` → `magnifyingglass`. In a drawer, pressing an item now closes the drawer after its `onClick` (call `event.preventDefault()` to keep it open).

**Tables** (ResultTable, RequestTable's controller, the SQL console):

```tsx
// before
<ResultTable result={result} durationMs={ms} maxHeight="20rem" resizable />
<RequestTable controller={createRequestTableController()} columns={[{ id: 'from', title: 'From' } as RequestColumn<Row>, 'status']} rows={rows} />
<SqlConsole sidebar={false} transfer={false} headerActions={<Picker />} layout="stacked" />
// now: the console renders its results; a host with rows of its own uses DataTable
<DataTable aria-label="Result 1" rows={rows} columns={columns} mode="none" toolbar={<Summary />} />
<RequestTable controller={createDataTableController()} columns={[{ id: 'from', header: 'From' } as DataTableColumn<Row>, 'status']} rows={rows} />
<SqlConsole>
  <SqlConsoleHeader><Picker /></SqlConsoleHeader>
  <SqlConsoleEditor />
  <SqlConsoleResults />
</SqlConsole>
```

**SqlEditor** is the console's editor part, also on its own:

```tsx
// before
import { SqlEditor, SqlEditorFooter } from '@/components/ui/sql-editor'
<SqlEditor value={sql} onValueChange={setSql} onRun={run} error={failure}><SqlEditorFooter>{format}</SqlEditorFooter></SqlEditor>
// now
import { SqlConsoleEditor, SqlConsoleEditorFooter } from '@/components/ui/sql-console'
<SqlConsoleEditor value={sql} onValueChange={setSql} onRun={run} errorPosition={failure?.position}><SqlConsoleEditorFooter>{format}</SqlConsoleEditorFooter></SqlConsoleEditor>
```

**WorkbenchTheme** is a theme scope:

```tsx
// before
<WorkbenchTheme appearance={appearance} tint={tint} className="p-4">…</WorkbenchTheme>
const scheme = useWorkbenchAppearance()
// now
<ThemeScope scope="workbench" appearance={appearance} tint={tint} className="p-4">…</ThemeScope>
const scheme = useScopeAppearance('workbench')
```

**Editors** (CodeEditor's line numbers, OpenCode's size and chrome):

```tsx
// before
<CodeEditor onLineNumberClick={jump} lineNumberClickable={ran} lineNumberLabel={label} scrollToLine={line} />
<OpenCode theme={appearance ?? 'dark'} className="rounded-none border-0" height={620} />
// now
<CodeEditor lineNumbers={{ onClick: jump, clickable: ran, label }} revealLine={line} />
<OpenCode appearance={appearance} variant="plain" className="h-[620px]" />
```

**The composer's buttons, pills and messages:**

```tsx
// before
<ComposerButton aria-label="Context"><Icon name="doc" /></ComposerButton>
<PopoverTrigger render={<ComposerButton variant="pill" tint aria-label="Model: Opus" />}><ComposerPillLabel icon={glyph}>Opus</ComposerPillLabel></PopoverTrigger>
<WbPopoverContent side="top">…</WbPopoverContent>
<ComposerSelect aria-label="Effort" options={[{ id: 'low', label: 'Low' }]} tint menuClassName="min-w-60" />
<MessageScroller items={messages.map((m) => ({ id: m.id, anchor: m.user, node: <Message m={m} /> }))} />
<UserMessage images={[url]}>…</UserMessage>
// now
<Button variant="quiet" size="icon-sm" aria-label="Context"><Icon name="doc" /></Button>
<PopoverTrigger render={<ComposerPill icon={glyph} aria-label="Model: Opus" className="text-primary" />}>Opus</PopoverTrigger>
<PopoverContent variant="plain" palette="trigger" side="top">…</PopoverContent>
<ComposerSelect aria-label="Effort" items={[{ value: 'low', label: 'Low' }]} className="text-primary" />
<MessageScroller>
  {messages.map((m) => <MessageScrollerItem key={m.id} value={m.id} anchor={m.user}><Message m={m} /></MessageScrollerItem>)}
</MessageScroller>
<ConversationUserMessage attachments={[{ id: 'a', name: 'shot.png', src: url, kind: 'image' }]}>…</ConversationUserMessage>
```

**FloatingChat and the chat container:**

```tsx
// before
<ArtifactChatContainer chatSide="right" chatOpen={open} onChatOpenChange={setOpen} fabPosition="bottom-right"
  tone="dark" appearance="glass" working={busy} onAdd={() => setBusy(false)}>
  <ArtifactChatContainer.Content>…</ArtifactChatContainer.Content>
  <ArtifactChatContainer.Chat>…</ArtifactChatContainer.Chat>
  <ArtifactChatContainer.Composer><div style={{ padding: 8 }}><Composer /></div></ArtifactChatContainer.Composer>
</ArtifactChatContainer>
<FloatingSheet dismissible minimizable={false} detents={[0.5]} label="Chat" tone="dark" appearance="glass" fabPosition="bottom-left" />
// now (the docks pad the composer: drop your own padding)
<ArtifactChatContainer chatSide="end" open={open} onOpenChange={setOpen} fabAlign="end"
  appearance="dark" variant="glass" working={busy} onComposingChange={(composing) => { if (composing) setBusy(false) }}>
  <ArtifactChatContainerContent>…</ArtifactChatContainerContent>
  <ArtifactChatContainerChat>…</ArtifactChatContainerChat>
  <ArtifactChatContainerComposer><Composer /></ArtifactChatContainerComposer>
</ArtifactChatContainer>
<FloatingSheet collapse="hide" snapPoints={[0.5]} aria-label="Chat" appearance="dark" variant="glass" />
```

FloatingChat on its own is `<ArtifactChatContainer presentation="floating">` over the page, or a sheet: `<FloatingSheet bodyAlign="end" aria-label="Chat"><FloatingSheetBody>{transcript}</FloatingSheetBody><FloatingSheetFooter>{composer}</FloatingSheetFooter></FloatingSheet>`. `minimizable={false}` is `collapse="none"`, `dismissible` is `collapse="hide"`; a `fabPosition` maps to `<FloatingSheetFab side align>` (`bottom-right` → `align="end"`, `center-left` → `side="start"`, `top-left` → `side="top" align="start"`; ArtifactChatContainer keeps `fabSide` / `fabAlign` for its own FAB).

**PencilKit:**

```tsx
// before
<PencilCanvas ink={PK_INKS[ink]} width={PK_W[width].m} hint="Draw">
  <PencilToolbar><ToolPicker value={tool} /><PencilToolbarDivider /><InkPicker value={ink} /><PencilActions /></PencilToolbar>
</PencilCanvas>
// now
<PencilCanvas ink={ink} widthScale={scale} emptyState="Draw">
  <PencilToolbar className="absolute inset-x-2.5 bottom-3.5 mx-auto" trailing={<><ToolbarSeparator /><PencilActions canClear={history.canClear} /></>}>
    <PencilToolPicker value={tool} /><ToolbarSeparator /><PencilInkPicker value={ink} />
  </PencilToolbar>
</PencilCanvas>
```

## Buttons and toggles

[Button](https://blamy.github.io/ui/#/button) (and its "Unstyled" section, for PlainButton), [Toggle and ToggleGroup](https://blamy.github.io/ui/#/toggle), [Segmented](https://blamy.github.io/ui/#/segmented), [Switch](https://blamy.github.io/ui/#/switch), [Checkbox](https://blamy.github.io/ui/#/checkbox), [RadioGroup](https://blamy.github.io/ui/#/radio-group), [Slider](https://blamy.github.io/ui/#/slider), [Progress](https://blamy.github.io/ui/#/progress), [ProgressRing](https://blamy.github.io/ui/#/progress-ring), [Separator](https://blamy.github.io/ui/#/separator), [Label](https://blamy.github.io/ui/#/label), [Kbd](https://blamy.github.io/ui/#/kbd), [Avatar](https://blamy.github.io/ui/#/avatar), [PencilKit](https://blamy.github.io/ui/#/pencilkit).

| Module | 5.x | 6.0 |
| --- | --- | --- |
| `button` | `isPending` | Return a Promise from `onClick`: the button is pending (`data-pending`, `aria-busy`) until it settles. There is no `pending` prop. |
| `button` | `ButtonProps` (react-aria props + `title`) | UI SDK `Button` props + `variant` (`default`, `secondary`, `outline`, `ghost`, `quiet`, `contrast`, `destructive`, `plain`, `link`), `size`. **care**: `link` is now a link in running text (the line's size and weight, no height or padding, `size` ignored); a bar text button ("Cancel", "Edit") is `variant="plain"`. New: `focusableWhenDisabled`, `pendingAnnouncement`, `render`, `ButtonVariant`, `ButtonSize`. `type` still defaults to `"button"`. |
| `button` | `active` (a quiet tool that stays on) | `Toggle variant="quiet" pressed` (see [the table above](#components-that-merged-moved-or-were-renamed)) |
| `plain-button` | `PlainButton onPress` | UI SDK's `Button`, unstyled: `import { Button as SdkButton } from '@ui-sdk/react/button'`, `onClick` |
| `plain-button` | `PlainToggleButton isSelected / defaultSelected / onChange` | UI SDK's `Toggle` (`import { Toggle as SdkToggle } from '@ui-sdk/react/toggle'`): `pressed` / `defaultPressed` / `onPressedChange(pressed, details)`; in a ToggleGroup it takes `value` (was `id`) |
| `toggle` | `Toggle isSelected / defaultSelected / onChange` | `pressed` / `defaultPressed` / `onPressedChange(pressed, details)`. New: `variant="quiet"`, sizes `icon-sm` / `icon` / `icon-lg`, `ToggleIcon`, `createToggleController`. |
| `toggle-group` → `toggle` | `ToggleGroup` from `@/components/ui/toggle-group` | the same names from `@/components/ui/toggle` |
| `toggle` (ToggleGroup) | `selectionMode="single" \| "multiple"` | `multiple` (single by default) |
| `toggle` (ToggleGroup) | `selectedKeys` / `defaultSelectedKeys` (`Set`) | `value` / `defaultValue` (`string[]`) |
| `toggle` (ToggleGroup) | `onSelectionChange(keys)` | `onValueChange(value: string[], details)` |
| `toggle` (ToggleGroup) | `disallowEmptySelection` | `deselectable={false}` |
| `toggle` (ToggleGroup) | `ToggleGroupItem id` | `ToggleGroupItem value` |
| `toggle` (ToggleGroup) | sliding card `data-slot="toggle-group-indicator"` in each item | one `data-slot="selection-indicator"` in the group (single `variant="segmented"` groups), drawn with Segmented's track. Item slot is `toggle`. New: `createToggleGroupController`. |
| `segmented` | `options={[{ id, label }]} value onChange(id)` | `SegmentedItem value` children, `value` / `defaultValue` / `onValueChange(value \| null, details)`. `SegmentedOption` removed. |
| `segmented` | `aria-label` defaulted to `"Segmented control"` | No default: pass `aria-label` |
| `segmented` | slots `segmented`, `segmented-indicator` | `segmented-control`, `segmented-control-item`, `segmented-control-indicator`. New: `createSegmentedControlController`. |
| `switch` | `checked` (required) / `onChange(v)` | `checked` / `defaultChecked` / `onCheckedChange(checked, details)`; also `disabled`, `readOnly`, `required`, `name`, `value`, `controller` |
| `switch` | `aria-label` defaulted to `"Toggle"` | No default (a `ListRow` still names it) |
| `switch` | `label > input + span[switch-track] + span[switch-thumb]` | `button[role=switch]` (the root is the track) `> span[data-slot=switch-thumb]`. New: `SwitchThumb`, `createSwitchController`. |
| `checkbox` | `<Checkbox>Label</Checkbox>` (the root was the row) | `<Label variant="control"><Checkbox />Label</Label>` (the root is the box) |
| `checkbox` | `isSelected` / `defaultSelected` / `onChange` | `checked` / `defaultChecked` / `onCheckedChange(checked, details)` |
| `checkbox` | `isIndeterminate` | `checked="indeterminate"` |
| `checkbox` | `checkboxVariants` on the inner indicator (`group-data-selected:`) | on the root `button[role=checkbox]` (`data-checked:`, `data-indeterminate:`). New: `CheckboxIndicator`, `createCheckboxController`. |
| `checkbox` | `CheckboxGroup value / onChange(values)` | `value` / `defaultValue` / `onValueChange(values, details)`; `allValues` + a `Checkbox parent` is select-all. Name the group with `aria-label`. New: `createCheckboxGroupController`. |
| `radio-group` | `RadioGroup onChange(value)` | `onValueChange(value, details)` |
| `radio-group` | `<Radio value="a">Label</Radio>` | `<Label variant="control"><Radio value="a" />Label</Label>`; the dot is `RadioIndicator`. New: `createRadioGroupController`. |
| `radio-group` | `isInvalid`, `validate`, child `Label` / `FieldError` | Put the group in a `Field` (see [Forms](#forms-and-text-fields)) |
| `slider` | `minValue` / `maxValue`, `formatOptions` | `min` / `max`, `format` (Intl options or a function) |
| `slider` | `onChange` / `onChangeEnd` | `onValueChange(value, details)` / `onValueCommit(value, details)` |
| `slider` | `SliderTrack` (hit area, rail and fill) `> SliderThumb` | `SliderControl > SliderTrack > SliderIndicator + SliderThumb`. `SliderOutput` is `SliderValue`. New: `thumbLabels`, `createSliderController`. |
| `slider` | `tone="onDark" \| "onLight"`, `SliderTone`; `trackColor` / `fillColor` / `thumbColor` | `variant="overlay"` with `appearance="dark" \| "light"`, `SliderVariant`; the `--bl-slider-track` / `--bl-slider-fill` / `--bl-slider-thumb` variables in a class |
| `segmented`, `switch` | one size | `size: 'sm' \| 'default' \| 'lg'` on Segmented (36px by default; the 5.x size is `sm`), `size: 'default' \| 'sm'` on Switch; replace `scale-*` hacks with `size="sm"` |
| `progress`, `progress-ring` | `minValue` / `maxValue`, `formatOptions`, `valueLabel`, `isIndeterminate` | `min` / `max`, `format`, `getValueLabel`, leave `value` out. New parts: `ProgressLabel`, `ProgressValue`, `ProgressTrack`, `ProgressIndicator`. ProgressRing's slot is `progress`. |
| `separator` | `elementType="div"` | `render={<div />}`; new `decorative` |
| `label` | auto-wired by its field's context | a native `<label>`: `htmlFor`, or wrap the control; inside a `Field`, use `FieldLabel`. New variant `control`. |
| `kbd` | react-aria `Keyboard` (a shortcut slot inside a menu item) | a plain `<kbd>`; new `keys="mod+k"` prop. In a menu, use the item's `shortcut`. |
| `avatar` | `src` drew an `<img>` over the initials, removed on error | `AvatarImage` shows once loaded; initials show while loading and on failure. New: `AvatarImage`, `AvatarFallback`, `onLoadingStatusChange`. |
| `avatar` | `c={{ f: 'Ada', l: 'Lovelace' }}`, `color` | `name="Ada Lovelace"` (the hue hashes the same letters), `tint` |
| `avatar` → `avatar-group` | `AvatarGroup` from `@/components/ui/avatar`, a menu by default, `onSelect(index)` | `@/components/ui/avatar-group`; `menu` is opt-in, `onAction(value, details)` with the avatar's `key` as `value` |
| `avatar-group` | `AvatarGroup` overflow `data-slot="avatar-overflow"` | `data-overflow` attribute; with `menu`, its trigger slot is `dropdown-menu-trigger` |
| `avatar` | with `card`: a `<span role="img">` that only a pointer could open | the root is a `<button type="button">` named after the person, in the Tab order; focus opens the card after the delay, Escape closes it. Tests: `getByRole('img', { name })` → `getByRole('button', { name })` |
| `avatar` | status dot named `online` / `idle` / `dnd` / `offline` | `Online` / `Idle` / `Do not disturb` / `Offline` |
| `avatar` | `AvatarGroup menu={false}` with no `label`: a group with no name | named "N people" unless `aria-label`, like the menu variant |
| `pencilkit` | `ToolPicker` / `InkPicker` / `WidthPicker` `value` (an index), `onChange` | `PencilToolPicker` / `PencilInkPicker` / `PencilWidthPicker`: `value` is the tool, the ink color or the width's scale; `defaultValue`, `onValueChange(value, details)`. The pickers are the kit's `ToggleGroup`. |
| `pencilkit` | `PencilToolButton`, `PencilToolbarDivider` | the kit's `ToolbarButton` / `ToggleGroupItem` and `ToolbarSeparator` |
| `pencilkit` | `PencilCanvas onStrokesChange(strokes, source: 'draw' \| 'erase')`, `PencilStrokesChangeSource` | `onStrokesChange(strokes, details)` with `details.reason`; types `PencilStrokesChangeDetails`, `PencilStrokesChangeReason`. A `PencilCanvas` inside a `Canvas` is the board's drawing layer. |
| `pencilkit` | `PencilToolbar` a plain `<div>` pinned to the canvas's bottom, `PencilActions` a `role="group"` usable anywhere | `PencilToolbar` is the kit's `Toolbar` (`variant="floating"`, "Drawing tools", one tab stop) in the flow: position it with classes; `PencilActions` is a `ToolbarGroup` and must sit inside a `PencilToolbar`, usually in its `trailing`; disabled actions use `aria-disabled` |
| `pencilkit` | `usePencilHistory` kept a redo stack of strokes; Clear lost them | snapshot history: an erase or a clear is one undoable step; it also returns `canClear` |

```tsx
// 5.x
<Segmented aria-label="View" options={[{ id: 'list', label: 'List' }, { id: 'grid', label: <Icon name="grid" /> }]} value={view} onChange={setView} />
<Checkbox defaultSelected onChange={setOn}>Remember me</Checkbox>
<RadioGroup value={plan} onChange={setPlan}>
  <Label>Plan</Label>
  <Radio value="monthly">Monthly</Radio>
</RadioGroup>
<Slider defaultValue={[20, 80]} minValue={0} maxValue={200} onChangeEnd={save}>
  <SliderTrack><SliderThumb index={0} /><SliderThumb index={1} /></SliderTrack>
</Slider>

// 6.0
<Segmented aria-label="View" value={view} onValueChange={(v) => v && setView(v)}>
  <SegmentedItem value="list">List</SegmentedItem>
  <SegmentedItem value="grid" aria-label="Grid"><Icon name="grid" /></SegmentedItem>
</Segmented>
<Label variant="control"><Checkbox defaultChecked onCheckedChange={setOn} />Remember me</Label>
<Label id="plan-label">Plan</Label>
<RadioGroup aria-labelledby="plan-label" value={plan} onValueChange={setPlan}>
  <Label variant="control"><Radio value="monthly" />Monthly</Label>
</RadioGroup>
<Slider defaultValue={[20, 80]} min={0} max={200} onValueCommit={save} aria-label="Price">
  <SliderControl>
    <SliderTrack>
      <SliderIndicator />
      <SliderThumb index={0} aria-label="Lowest price" />
      <SliderThumb index={1} aria-label="Highest price" />
    </SliderTrack>
  </SliderControl>
</Slider>
```

For Checkbox and Radio, a `className` that styled the old row (gap, text size, opacity) moves to the wrapping `Label`; one that styled the box stays and uses `data-checked:`. Children of a `Checkbox` are now a custom indicator, not its label. A Slider without children (`<Slider label="Volume" showValue />`) only changes prop names.

## Forms and text fields

[Field](https://blamy.github.io/ui/#/field), [Input](https://blamy.github.io/ui/#/input), [Textarea](https://blamy.github.io/ui/#/textarea), [SearchInput](https://blamy.github.io/ui/#/search-input) (was SearchField), [Forms](https://blamy.github.io/ui/#/form), FilterInput (on [Filter](https://blamy.github.io/ui/#/filter)), SqlEditor (now `SqlConsoleEditor`, on [SqlConsole](https://blamy.github.io/ui/#/sql-console)), [Spreadsheet](https://blamy.github.io/ui/#/spreadsheet).

`TextField` is gone. Its module is now `@/components/ui/field` (registry item `field`; the old item and file are deleted, with no alias), and `Field` owns only `name`, `disabled` and `invalid`: everything about the value moves onto the control.

| Module | 5.x | 6.0 |
| --- | --- | --- |
| `text-field` → `field` | `import … from '@/components/ui/text-field'` | `import … from '@/components/ui/field'` |
| `field` | `TextField`, `TextFieldProps` | `Field` (see the table below) |
| `field` | `Label` inside a field | `FieldLabel` (same `variant`s; `field` is now the default, so `variant="field"` can go) |
| `field` | `FieldDescription` (a `<span>`) | `FieldDescription` (a `<p>`, `m-0`); right inside a `FieldSet` it describes the set |
| `field` | `FieldError` children `(validation) => validation.validationErrors…` | `FieldError` children `(state) => state.message`; `match?: boolean \| ValidityKey`. A static message needs `invalid` on the Field. |
| `field` | — | New: `FieldSet`, `FieldLegend`, `FieldGroup`, `FieldControl` (`render={<select />}` for a native control), `useFieldControl` |
| `input` | react-aria `Input` | UI SDK `Input`: native `onChange` still works; new `onValueChange(value, details)`, `onValueCommit(value, details)` (Enter or blur commits, Escape reverts), `controller`, `render`, `createInputController` |
| `input` | `data-focused`, `data-focus-visible`, `data-hovered`, `data-invalid` on a bare input | `focus:`, `focus-visible:`, `hover:`, `aria-invalid:`; `data-filled`, `data-disabled`, `data-readonly`, `data-required` (and `data-invalid` / `data-valid` / `data-focused` inside a `Field`) |
| `textarea` | react-aria `TextArea` | UI SDK `Textarea`; new `autoResize`, `submitShortcut` (`"enter"` \| `"mod+enter"`), `onSubmit(value, details)` |
| `search-field` → `search-input` | `SearchField`, `SearchFieldProps` | `SearchInput`, `SearchInputProps` (slot `search-input`); new `size` (`sm` 32px, `default` 36px), `icon`, `clearable` |
| `search-input` | `onChange(value)` | `onValueChange(value, details)`; `reason` is `input-change`, `clear-press` (the button and Escape) or `imperative`. `onChange` is now the input's native handler. |
| `search-input` | `onSubmit(value)` | `onSubmit(value, details)`: `details` is UI SDK's change details (`reason` `enter-key` or `imperative`, `event`, `source`, `cancel()`; type `SearchInputSubmitDetails`); with `onSubmit`, Enter no longer submits a surrounding form, unless `details.cancel()` leaves the key to it. Agents can `submit` the field. |
| `search-input` | a fixed prop list | every `Input` prop goes to the input (`disabled`, `name`, `controller`, `id`, `ref`…); `className` / `style` still style the pill |
| `form` | react-aria `Form` (`validationErrors`, `validationBehavior`) | removed: `<FieldGroup className="gap-5" render={<form onSubmit={save} />}>`, a native `<form>`; those two props are gone |
| `form` | `FormSection title description` | `FieldSet` + `FieldLegend` + `FieldDescription` from `field`; slot `form-section` → `field-set` |
| `filter-input` | `onValueChange(text)` | `onValueChange(text, details)` |
| `filter-input` | the result read out by a `role="status"` region inside it | UI SDK's `announce()` (`[data-ui-sdk-announcer]`); the input's `aria-describedby` is the hint only. The box is a `SearchInput` (`role="searchbox"`) |
| `filter-input` | `query` (the parser options), `useFilterQuery({ debounce, now })` | `parse`; `debounceMs`, `reference` |
| `sql-editor` | `onChange`, `isDisabled`, `isReadOnly`, `isRunning` | `onValueChange(value, details)`, `disabled`, `readOnly`, `pending` (`data-pending`) |
| `sql-editor` | `size`, `footer`, `actions`, `runLabel` | `rows` (default 8); the footer is the children: `<SqlConsoleEditorFooter>{actions}</SqlConsoleEditorFooter>`, `<SqlConsoleEditorRun>Label</SqlConsoleEditorRun>`, `{false}` for none |
| `sql-editor` | Run on Ctrl+Enter or ⌘+Enter everywhere | ⌘+Enter on Apple platforms, Ctrl+Enter elsewhere (`submitShortcut="mod+enter"`) |
| `sql-editor` | textarea slot `sql-editor-input` | `textarea` (select `[data-slot=sql-console-editor] textarea`) |
| `sql-editor` | ⌥↑ / ⌥↓ step through `history`; Escape brings the draft back | ↑ with the caret on the first line and ↓ on the last (no modifier), UI SDK's `createInputHistory`; ↓ past the newest brings the draft back, and Escape is no longer claimed. A step reports `reason: 'imperative'` (Textarea has no `history-key` reason yet); cancel it in `onValueChange` and the key goes to the browser. |
| `sql-editor` | footer hint "⌘↵" and "⌥↑ history" on every platform | `Kbd keys="mod+enter"` and `keys="arrowup"`: ⌘↩ / ↑ on Apple platforms, Ctrl+Enter / Up elsewhere |
| `sql-editor` | `useSqlHistory(key?, max?)` on raw `localStorage`, this tab only | the same signature on UI SDK's `createLocalStorage`: the same JSON array under the same key, and it follows other tabs' writes; `clear()` removes the key |
| `spreadsheet` | `onChange(rows)`, `isReadOnly` | `onValueChange(rows, details)` (`reason` `cell-edit`, `paste`, `cut`, `clear`, `add-row`, `undo`, `redo`, `imperative`; `details.cancel()` refuses an uncontrolled change), `readOnly`; the cell editor slot is `spreadsheet-editor` |
| `spreadsheet` | `ref` to a `SpreadsheetHandle` (`focus`, `select(anchor, focus?)`, `undo`, `redo`) | `controller` from `createSpreadsheetController()`: `focus`, `select(anchor, end?)`, `edit(cell, text)`, `paste(text)`, `clear()`, `copy()`, `sort(col, dir?)`, `undo`, `redo`, `addRow`, `setColumnWidths`; each returns whether it did anything |
| `spreadsheet` | types `SpreadsheetCell { row, column }`, `SpreadsheetSelection { anchor, focus }` | UI SDK's `GridCell { row, col }` and `CellRange { anchor, end }` from `@ui-sdk/core` |
| `spreadsheet` | — | New: `columnWidths` / `defaultColumnWidths` / `onColumnWidthsChange(widths, details)`, types `SpreadsheetValueChangeReason`, `SpreadsheetColumnWidthsChangeReason` |
| `spreadsheet` | the grid focused with `aria-activedescendant`; a `[data-slot=spreadsheet-selection]` overlay; A1 selected before focus | roving focus on the `gridcell`s (read `document.activeElement`); cells carry `aria-selected`, `data-selected`, `data-active` and `data-range-edge` (`top right bottom left`) to style the outline from; nothing is active until focus enters. The sort result is announced with `announce()`. |
| `spreadsheet` | a paste without tabs guessed a CSV delimiter | a paste is tab-separated, as spreadsheets copy |
| `spreadsheet` | `onSort(info)`, `footer`, `columnName` | `onSorted(info)` (after a sort ran), or a controlled `sort` / `defaultSort` / `onSortChange(sort, details)`; `statusBar`; removed. New: `emptyState`, `density="default"` |

| On `<TextField>` in 5.x | In 6.0 |
| --- | --- |
| `name`, `isDisabled` | `name`, `disabled` on `<Field>` (or on the control) |
| `isInvalid` | `invalid` on `<Field>`: pass `true` or `undefined`, not `false` (`false` hides the browser's validation too) |
| `value`, `defaultValue`, `onChange(v)` | `value`, `defaultValue`, `onValueChange(v, details)` on the control |
| `isRequired`, `isReadOnly`, `type`, `autoComplete`, `autoFocus`, `inputMode`, `minLength`, `maxLength`, `pattern`, `aria-label` | `required`, `readOnly` and the rest on the control |
| `validate={(v) => message}` | No equivalent: compute the message, pass `invalid`, render it in `FieldError` |
| `validationBehavior="aria"` | No equivalent: native constraints show after a submit attempt, then live; for earlier errors compute `invalid` yourself |

```tsx
// 5.x
<TextField name="email" type="email" isRequired value={email} onChange={setEmail} isInvalid={taken} isDisabled={busy}>
  <Label variant="field">Email</Label>
  <Input placeholder="you@example.com" />
  <FieldDescription>We never share it.</FieldDescription>
  <FieldError />
</TextField>

// 6.0
<Field name="email" invalid={taken ? true : undefined} disabled={busy}>
  <FieldLabel>Email</FieldLabel>
  <Input type="email" required value={email} onValueChange={setEmail} placeholder="you@example.com" />
  <FieldDescription>We never share it.</FieldDescription>
  <FieldError />
</Field>
```

A custom rule and a server error:

```tsx
const problem = username.length < 3 ? 'Too short.' : ''

<FieldGroup className="gap-5" render={<form onSubmit={save} />}>
  <Field name="username" invalid={problem ? true : undefined}>
    <FieldLabel>Username</FieldLabel>
    <Input value={username} onValueChange={setUsername} />
    <FieldError>{problem}</FieldError>
  </Field>
  <Field name="email" invalid={errors.email ? true : undefined}>
    <FieldLabel>Email</FieldLabel>
    <Input type="email" required onValueChange={() => setErrors({})} />
    <FieldError>{(state) => errors.email || state.message}</FieldError>
  </Field>
</FieldGroup>
```

```tsx
// 5.x
<FormSection title="Preferences" description="You can change these later in Settings.">{fields}</FormSection>
// 6.0
<FieldSet>
  <FieldLegend>Preferences</FieldLegend>
  {fields}
  <FieldDescription>You can change these later in Settings.</FieldDescription>
</FieldSet>
```

Other fields that borrowed `FieldDescription` and `FieldError` from `text-field` (DateInput, DatePicker, Select, Combobox, RadioGroup, ColorInput, NaturalTimeInput, FileUpload, MarkdownEditor) import them from `@/components/ui/field` and sit inside a `<Field>`; none of them takes a `label`, `error` or `invalid` of its own any more. CronEditor has two text boxes and a toggle group, so it keeps its own labels: group it in a `FieldSet` with a `FieldLegend`.

`Form` is gone: a form is a `FieldGroup` rendered as a `<form>`. `FieldGroup` has a `gap-3`, so add the 5.x form's `gap-5` with a class, and put the form's own props (`onSubmit`, `action`, `noValidate`) on the `<form>` in `render`.

## Menus, selects and lists

[DropdownMenu](https://blamy.github.io/ui/#/dropdown-menu) (with its "Context menus" section, for ContextMenu), [Select](https://blamy.github.io/ui/#/select), [Combobox](https://blamy.github.io/ui/#/combobox), [Listbox](https://blamy.github.io/ui/#/listbox), [Breadcrumb](https://blamy.github.io/ui/#/breadcrumb), the Tailscale panel (on [Sign in with Tailscale](https://blamy.github.io/ui/#/tailscale)).

Rules for the whole family: items take `value` (was `id`) and `label` (was `textValue`); open state is on the root; sections are `…Group` + `…GroupLabel`; render-function collection children are gone (map children, or pass `items` to the root with an **empty** content part); `popoverClassName` and `className` merge into the content part's `className` (it is the popup and the list in one element); the open, active row is `data-highlighted`.

| Module | 5.x | 6.0 |
| --- | --- | --- |
| `dropdown-menu` | `DropdownMenu` = `MenuTrigger`, first pressable child is the trigger | `DropdownMenu` root (`open`, `onOpenChange`, `onAction(value, details)`, `items`, `presentation`, `modal`, `loop`, `controller`…) + `DropdownMenuTrigger` (`render={<Button … />}`) |
| `dropdown-menu` | `DropdownMenuContent aria-label onAction selectionMode selectedKeys disabledKeys items placement popoverClassName` | `DropdownMenuContent side align sideOffset alignOffset finalFocus keepMounted className`, and new `size` (`sm` for a dense desktop menu) and `palette` (`trigger` paints it from the trigger's theme scope); `onAction` moves to the root (and sees submenu rows); no `aria-label` needed; `disabled` on each item |
| `dropdown-menu` | `DropdownMenuItem id variant="destructive" shortcut={<DropdownMenuShortcut>⌘R</…>} onAction href isDisabled` | `value`, `destructive`, `shortcut="mod+r"` (drawn per platform, sets `aria-keyshortcuts`), `onSelect(event)`, `render={<a href />}`, `disabled`, `closeOnSelect` |
| `dropdown-menu` | selectable items via `selectionMode` | `DropdownMenuCheckboxItem` (`checked`, `onCheckedChange`) and `DropdownMenuRadioGroup` (`value`, `onValueChange`) + `DropdownMenuRadioItem` |
| `dropdown-menu` | `DropdownMenuSection title`, `DropdownMenuLabel` | `DropdownMenuGroup` + `DropdownMenuGroupLabel` |
| `dropdown-menu` | `DropdownMenuSub` wrapping an item and a content | `DropdownMenuSub` wrapping `DropdownMenuSubTrigger` + `DropdownMenuSubContent` |
| `dropdown-menu` | `dropdownMenuItemVariants({ variant })`, generic `…Props<T>` | `dropdownMenuItemVariants()` (destructive is `data-destructive:`), non-generic props. New: `DropdownMenuItems`, `createDropdownMenuController`, `DropdownMenuData` (items take `icon` and `description`). |
| `context-menu` → `dropdown-menu` | `ContextMenu` was the area `div` (`className`, `isDisabled`, `longPressDelay`, `anchor`) | a `DropdownMenu` root (no element) + `DropdownMenuContextTrigger` (the area: `className`, `disabled`) + `DropdownMenuContent`; `longPressDelay` and `anchor` removed. The area is no longer `relative`. |
| `context-menu` → `dropdown-menu` | `ContextMenuItem`, `ContextMenuSection`, `ContextMenuLabel`, `ContextMenuSeparator`, `ContextMenuShortcut`, `ContextMenuSub` | `DropdownMenuItem`, `DropdownMenuGroup`, `DropdownMenuGroupLabel`, `DropdownMenuSeparator`, `DropdownMenuShortcut`, `DropdownMenuSub`; one set of parts for both menus |
| `select` | `Select` rendered a label/trigger/error column; `onChange(key)`, `selectionMode`, `isInvalid`, `className` | `Select` renders no element: wrap it in a `Field`. `onValueChange(value \| null, details)`, `multiple`, `items`, `disabled`, `required`, `readOnly`, `name`… |
| `select` | `Label` child | `FieldLabel` in the `Field`, `SelectLabel`, or `aria-label` on `SelectTrigger` |
| `select` | `SelectTrigger` role `button` | role `combobox` |
| `select` | `SelectContent items placement popoverClassName renderEmptyState` | `SelectContent side align sideOffset keepMounted className` (+ `size`, `palette`); `items` on the root. `SelectTrigger size` gains `lg` |
| `select` | `SelectItem id textValue isDisabled`, `SelectSection title` | `SelectItem value label disabled`, `SelectGroup` + `SelectGroupLabel`. New: `SelectSeparator`, `createSelectController`. |
| `combobox` | `ComboBox`, `ComboBoxInput`, `ComboBoxContent`, `ComboBoxItem`, `ComboBoxSection` | `Combobox`, `ComboboxInput`, `ComboboxContent`, `ComboboxItem`, `ComboboxGroup` + `ComboboxGroupLabel` (lower-case **b**, no alias) |
| `combobox` | `ComboBoxInput` drew the filled field, the chevron, chips and the clear button | `ComboboxInputGroup` (the box, `size`) holds a bare `ComboboxInput`, `ComboboxTrigger` (the chevron), `ComboboxClear` and `ComboboxChips`; `<ComboboxInputGroup />` alone is the input and the chevron |
| `combobox` | the root rendered a label column | no element: wrap it in a `Field` |
| `combobox` | `defaultItems` / `items` + render function, `defaultFilter` | `items` (filtered by `filter`, default `'contains'` on `label` + `keywords`; `filter={false}` shows them as given) |
| `combobox` | `inputValue` / `onInputChange` | `query` / `defaultQuery` / `onQueryChange(query, details)` |
| `combobox` | `allowsCustomValue` | `allowCustomValue` (Enter makes the typed text the value) |
| `combobox` | `allowsEmptyCollection` + `renderEmptyState` | `<ComboboxEmpty>` beside `<ComboboxList>` in the content |
| `combobox` | `menuTrigger` | removed; open on focus with a controller's `open()` |
| `combobox` | chevron slot `combobox-button` | `combobox-trigger`. New: `ComboboxLabel`, `ComboboxSeparator`, `createComboboxController`. |
| `list-box` → `listbox` | `selectionMode` (default `none`), `selectedKeys`, `onSelectionChange`, `disallowEmptySelection`, `onAction`, `items` + render function | always selects (single by default): `value` / `onValueChange`, `multiple`, `activation`, `deselectable`, `items`. In a single list the arrow keys select; pass `activation="manual"` if moving must not change the value. |
| `list-box` → `listbox` | `ListBox`, `ListBoxItem`, `ListBoxProps`, `ListBoxItemProps`, `listBoxVariants`, `listBoxItemVariants` from `@/components/ui/list-box` | `Listbox`, `ListboxItem`, `ListboxProps`, `ListboxItemProps`, `listboxVariants`, `listboxItemVariants` from `@/components/ui/listbox` (UI SDK's spelling, lower-case **b**) |
| `listbox` | `ListBoxItem id textValue isDisabled onAction href variant` | `value`, `label`, `disabled` (the item follows the list's `variant`); a per-item action is an `onClick` on the item, or a menu |
| `listbox` | `ListBoxSection`, `ListBoxHeader` | `ListboxGroup`, `ListboxGroupLabel`. New: `ListboxSeparator`, `createListboxController`. |
| `breadcrumb` | `onPress` on entries, `id: Key` | `onClick(event)` (`preventDefault()` routes an `href` yourself), `id: string \| number` |
| `breadcrumb` | an entry's sibling picker `items`, `selectedId`; `BreadcrumbEllipsis label` | `siblings`, `siblingValue` (entries named by `value`); `aria-label` |
| `breadcrumb` | react-aria `Link`s through a `RouterProvider` | native `<a href>` links (full navigation unless something above intercepts them); for client routing give the entry `onClick={() => navigate(path)}` and no `href` |
| `breadcrumb` | `BreadcrumbEntry.label: ReactNode` + `textValue` for a rich label | `label: string`, the plain-text name (menus type-select by it); rich content goes in the new `children`. `{ label: <b>ui</b>, textValue: 'ui' }` becomes `{ label: 'ui', children: <b>ui</b> }`. `BreadcrumbItem label` is a string too. |
| `breadcrumb` | collapsing measured in React effects | the `breadcrumb` primitive (`lib/breadcrumb-primitive.ts`): root `data-collapsed` while items are hidden, `data-current` on the last shown item, and an agent entry named by `aria-label` with `activate(value)` |

```tsx
// 5.x
<DropdownMenu>
  <Button variant="secondary" size="icon" aria-label="More"><Icon name="ellipsis" /></Button>
  <DropdownMenuContent aria-label="Photo actions" onAction={(key) => run(String(key))}>
    <DropdownMenuSection title="Sort by" selectionMode="single" selectedKeys={new Set([sort])}
      onSelectionChange={(keys) => keys !== 'all' && setSort([...keys][0] as string)}>
      <DropdownMenuItem id="name">Name</DropdownMenuItem>
    </DropdownMenuSection>
    <DropdownMenuItem id="rename" shortcut={<DropdownMenuShortcut>⌘R</DropdownMenuShortcut>}>Rename</DropdownMenuItem>
    <DropdownMenuItem id="delete" variant="destructive" onAction={remove}>Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>

// 6.0
<DropdownMenu onAction={(value) => run(value)}>
  <DropdownMenuTrigger render={<Button variant="secondary" size="icon" />} aria-label="More">
    <Icon name="ellipsis" />
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
      <DropdownMenuGroupLabel>Sort by</DropdownMenuGroupLabel>
      <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
    </DropdownMenuRadioGroup>
    <DropdownMenuItem value="rename" shortcut="mod+r">Rename</DropdownMenuItem>
    <DropdownMenuItem value="delete" destructive onSelect={remove}>Delete</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

A menu from data: `<DropdownMenu items={branches.map((b) => ({ value: b.name, label: b.name }))} onAction={checkout}>` with a trigger and an empty `<DropdownMenuContent />` (the content part must be placed, even empty). Data entries are strings or `{ value, label, disabled? }`, `{ type: 'group', label, items }` and `{ type: 'separator' }`.

```tsx
// 5.x
<ContextMenu className="rounded-xl" isDisabled={locked}>
  <Tile />
  <ContextMenuContent aria-label="Tile actions" onAction={run}>
    <ContextMenuItem id="copy">Copy</ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>

// 6.0: a context menu is a DropdownMenu opened by its context trigger
<DropdownMenu onAction={run}>
  <DropdownMenuContextTrigger className="rounded-xl" disabled={locked}><Tile /></DropdownMenuContextTrigger>
  <DropdownMenuContent aria-label="Tile actions">
    <DropdownMenuItem value="copy">Copy</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

Give `DropdownMenuContextTrigger` `tabIndex={0}` if nothing inside it is focusable, so the menu key and Shift+F10 reach it. When the context trigger's own gesture opened the menu, focus goes back to the element that was pressed.

```tsx
// 5.x
<Select value={repeat} onChange={(key) => setRepeat(key as string)} isInvalid={bad} className="w-60">
  <Label variant="field">Repeat</Label>
  <SelectTrigger />
  <SelectContent items={repeats} placement="bottom end">{(r) => <SelectItem id={r.id}>{r.name}</SelectItem>}</SelectContent>
  <FieldError>Pick one.</FieldError>
</Select>

// 6.0
<Field invalid={bad ? true : undefined} className="w-60">
  <FieldLabel>Repeat</FieldLabel>
  <Select items={repeats.map((r) => ({ value: r.id, label: r.name }))} value={repeat} onValueChange={setRepeat}>
    <SelectTrigger />
    <SelectContent align="end" />
  </Select>
  <FieldError>Pick one.</FieldError>
</Field>
```

```tsx
// 5.x
<ComboBox defaultItems={people} value={id} onChange={setId} allowsEmptyCollection>
  <Label variant="field">Assignee</Label>
  <ComboBoxInput placeholder="Search the team" />
  <ComboBoxContent renderEmptyState={() => <p>No one matches.</p>}>
    {(p) => <ComboBoxItem id={p.id} textValue={p.name}>{p.name}</ComboBoxItem>}
  </ComboBoxContent>
</ComboBox>

// 6.0
<Field>
  <FieldLabel>Assignee</FieldLabel>
  <Combobox items={people.map((p) => ({ value: p.id, label: p.name, keywords: [p.email] }))} value={id} onValueChange={setId}>
    <ComboboxInputGroup>
      <ComboboxInput placeholder="Search the team" />
      <ComboboxTrigger />
    </ComboboxInputGroup>
    <ComboboxContent>
      <ComboboxEmpty>No one matches.</ComboboxEmpty>
      <ComboboxList />
    </ComboboxContent>
  </Combobox>
</Field>
```

```tsx
// 5.x
<ListBox aria-label="Share with" selectionMode="multiple" selectedKeys={set} onSelectionChange={setSet}>
  {people.map((p) => <ListBoxItem key={p.id} id={p.id} textValue={p.name}>{p.name}</ListBoxItem>)}
</ListBox>

// 6.0
<Listbox aria-label="Share with" multiple value={ids} onValueChange={setIds}>
  {people.map((p) => <ListboxItem key={p.id} value={p.id} label={p.name}>{p.name}</ListboxItem>)}
</Listbox>
```

A `Selection` becomes a `string[]` (`'all'` has no equivalent: pass every value). An action list with nothing selected: `<Listbox value={null} activation="manual" onValueChange={(v) => v && run(v)}>`, or a DropdownMenu or CommandMenu.

| 5.x slot | 6.0 slot |
| --- | --- |
| `dropdown-menu`, `dropdown-menu-content` | `menu-content` |
| `dropdown-menu-item` | `menu-item`, `menu-checkbox-item`, `menu-radio-item`; a submenu row `menu-trigger` |
| `dropdown-menu-section`, `dropdown-menu-label`, `dropdown-menu-separator`, `dropdown-menu-shortcut` | `menu-group` (`menu-radio-group`), `menu-group-label`, `menu-separator`, `menu-shortcut` |
| `context-menu` | `menu-context-trigger` (on `DropdownMenuContextTrigger`) |
| `select` (root) | none; `select-trigger`, `select-value`, `select-content`, `select-item`, `select-group`, `select-group-label`, `select-separator` |
| `combobox` (root), `combobox-button` | none, `combobox-trigger`; `combobox-input` is the `<input>`; new `combobox-input-group`, `combobox-list`, `combobox-empty`, `combobox-group` |
| `list-box`, `list-box-item`, `list-box-section`, `list-box-header` | `listbox`, `listbox-item`, `listbox-group`, `listbox-group-label`, `listbox-separator` |

## Overlays

[Popover](https://blamy.github.io/ui/#/popover), [Tooltip](https://blamy.github.io/ui/#/tooltip), [HoverCard](https://blamy.github.io/ui/#/hover-card), [Dialog](https://blamy.github.io/ui/#/dialog), [Sheet](https://blamy.github.io/ui/#/sheet), [Passkey vault](https://blamy.github.io/ui/#/passkey-vault).

Every overlay is a root + a trigger part + a content part. The trigger has no look of its own: move the old child Button into `render={<Button variant="…" size="…" />}` on the trigger and its children into the trigger. Modal overlays need an explicit **backdrop** part for the scrim (`DialogBackdrop`, `AlertDialogBackdrop`, `SheetBackdrop`); without one there is no dim. Render-function children `{({ close }) => …}` are gone: close with a Close part (`DialogClose`, `AlertDialogClose`, `PopoverClose`, `SheetClose`), which takes `action` (runs first; a returned Promise keeps the overlay open and the part pending) and `value` (comes back as `details.returnValue`), or with a controller.

| Module | 5.x | 6.0 |
| --- | --- | --- |
| `popover` | `PopoverTrigger` wrapper with `isOpen` / `onOpenChange` | `Popover` root (`open`, `onOpenChange`, `modal`, `openOnHover`, `delay`, `closeDelay`, `presentation`, `controller`, `container`) + `PopoverTrigger` part |
| `popover` | `Popover` = a bare styled surface (used with a `Dialog` or `ListBox` inside) | removed as a surface: `<PopoverContent variant="plain">` inside a `<Popover>`. Selects, comboboxes and menus own their own content parts. |
| `popover` | `PopoverContent` (`placement`, `offset`, `{close}` children) | `PopoverContent` (`variant: 'panel' \| 'plain'`, `side`, `align`, `sideOffset` 8, `alignOffset`, `initialFocus`, `finalFocus`, `keepMounted`, `arrow`, `palette`). Name it with `PopoverTitle` (`className="sr-only"` to hide it): an `aria-label` on the content loses to the trigger's name. |
| `popover` | `<Heading slot="title">`, `close()` | `PopoverTitle`, `<PopoverClose render={<Button size="sm" />}>Done</PopoverClose>`. New: `PopoverArrow`, `PopoverDescription`, `createPopoverController`. |
| `tooltip` | `TooltipTrigger` wrapper (`delay` 500, `closeDelay` 200, `isOpen`, `isDisabled`, `trigger`) + `Tooltip` content | `Tooltip` root (`delay`, `closeDelay`, `open`, `disabled`, `type`, `toggleable`, `closeOnPress`, `shortcut`, `controller`) + `TooltipTrigger` part + `TooltipContent` (`side` top, `arrow`). `trigger="focus"` has no equivalent. |
| `tooltip` | `TooltipProps` = content props | `TooltipProps` = root props; `TooltipContentProps` = content props. New: `TooltipArrow`, `TooltipShortcut`, `createTooltipController`. |
| `tooltip` | always `aria-describedby` | names a trigger that has no name (`aria-labelledby`) and describes the others; `type` overrides |
| `hover-card` | `HoverCardTrigger` = a wrapper `<span>` around its first child | `HoverCard` root (`delay` 600, `closeDelay` 300, `open`, `disabled`, `controller`) + `HoverCardTrigger`, which **is** the element (an `<a>` by default: `href`, or `render={<button aria-label="…" />}`) |
| `hover-card` | `HoverCard` = the card (`placement`, `contentClassName`, `triggerRef`) | `HoverCardContent` (`side` bottom, `align`, `sideOffset`, `arrow` default false); merge `contentClassName` into `className` |
| `hover-card` | `useHoverCard()`, `UseHoverCardOptions`, `HoverCardState`, `HoverCardTriggerComponentProps` | removed: `createHoverCardController<Payload>()` with `HoverCardTrigger controller payload`, or `controller.open({ anchor, payload })` for targets you hit-test yourself |
| `hover-card` | one card open at a time across independent cards, the next opening instantly | only within one shared controller; independent cards each wait their `delay`. Keyboard focus opens after the same delay. |
| `hover-card` | `HoverCardHeader media subtitle action` | `icon`, `description`, `trailing` (the kit's row anatomy); the title is an `h3` |
| `dialog` | `DialogTrigger` wrapper | `Dialog` root (`open`, `onOpenChange`, `dismissible`, `modal`, `presentation`, `view`, `controller`, `container`) + `DialogTrigger` part |
| `dialog` | a centered card everywhere | `presentation="auto"` by default: a sheet when the nearest size-class scope is compact, the card otherwise. Pass `presentation="dialog"` to keep the card on a phone; `AlertDialog` is always centered |
| `dialog` | `DialogContent` = overlay + modal + dialog (`size`, `isDismissable`, `role`, `overlayClassName`, `{close}`) | `DialogContent` (`size: 'default' \| 'lg'`, `variant: 'default' \| 'tray'`, `initialFocus`, `finalFocus`) + a separate `DialogBackdrop` (`overlayClassName` → its `className`) |
| `dialog` | `DialogHeader`, `DialogFooter orientation` | the same, plus `DialogHeader variant="bar"` (back, title, × in one row), `DialogBack`, `DialogView`: the [Dialog flow](#components-that-merged-moved-or-were-renamed) that replaces Credenza |
| `dialog` | `size="alert"`, `DialogAction` | `AlertDialog`, `AlertDialogTrigger`, `AlertDialogBackdrop`, `AlertDialogContent`, `AlertDialogHeader`, `AlertDialogTitle`, `AlertDialogDescription`, `AlertDialogFooter` (`orientation`), `AlertDialogClose` (`variant: default \| cancel \| destructive`, `value`, `action`) |
| `dialog` | `DialogClose` = always the round × | alone, the round ×; with children or `render`, any element that closes (`value`, `action`, `disabled`) |
| `dialog` | `dialogOverlayClass`, `DialogActionProps`, `dialogActionVariants` | removed. New: `createDialogController`, `createAlertDialogController`, `createConfirm`. |
| `sheet` | `Sheet` wrapper + `SheetContent side` | `Sheet` root (UI SDK's Drawer: `side`, `open`, `onOpenChange`, `dismissible`, `modal`, `snapPoints`, `snapPoint`, `onSnapPointChange`, `physics`, `view`, `contained`, `controller`) + `SheetTrigger` + `SheetBackdrop` + `SheetContent` (`grabber`, `variant: 'card' \| 'panel'`, `swipe`) |
| `sheet` | sheets only animated in and out | every side follows a drag and springs back or away (reason `swipe`); `dismissible={false}` stops the swipe. New: `SheetHandle`, `SheetView`, `createSheetController`. |
| `sheet` | `SheetHeader` / `SheetBody` were Dialog's (slots `dialog-header`, `dialog-body`) | their own parts, slots `sheet-header`, `sheet-body` |
| `passkey-enroll-dialog` → `vault-gate` | `PasskeyEnrollDialog isOpen onOpenChange(open)` | `VaultEnrollDialog`: `open` / `defaultOpen` / `onOpenChange(open, details)`, all optional, or a `DialogTrigger` child |
| `lib/primitives` | `focusRing` on `data-focus-visible:`; `popoverMotion` on `data-entering` / `data-exiting` | `focus-visible:`; transitions on `data-starting-style` / `data-ending-style`, `origin-(--transform-origin)`, `data-[side=…]`. |

```tsx
// 5.x
<DialogTrigger onOpenChange={(open) => open && reset()}>
  <Button variant="secondary">Rename…</Button>
  <DialogContent overlayClassName="backdrop-blur-sm">
    {({ close }) => (<>
      <DialogHeader><DialogTitle>Rename</DialogTitle></DialogHeader>
      <DialogFooter>
        <Button variant="ghost" onPress={close}>Cancel</Button>
        <Button isDisabled={empty} onPress={() => { save(); close() }}>Save</Button>
      </DialogFooter>
    </>)}
  </DialogContent>
</DialogTrigger>

// 6.0
<Dialog onOpenChange={(open) => open && reset()}>
  <DialogTrigger render={<Button variant="secondary" />}>Rename…</DialogTrigger>
  <DialogBackdrop className="backdrop-blur-sm" />
  <DialogContent>
    <DialogHeader><DialogTitle>Rename</DialogTitle></DialogHeader>
    <DialogFooter>
      <DialogClose render={<Button variant="ghost" />}>Cancel</DialogClose>
      <DialogClose render={<Button />} disabled={empty} value="save" action={save}>Save</DialogClose>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

```tsx
// 5.x
<DialogTrigger>
  <Button variant="destructive">Delete…</Button>
  <DialogContent size="alert">
    <DialogHeader><DialogTitle>Delete photo?</DialogTitle></DialogHeader>
    <DialogFooter orientation="vertical">
      <DialogAction variant="cancel">Cancel</DialogAction>
      <DialogAction variant="destructive" onPress={del}>Delete</DialogAction>
    </DialogFooter>
  </DialogContent>
</DialogTrigger>

// 6.0
<AlertDialog>
  <AlertDialogTrigger render={<Button variant="destructive" />}>Delete…</AlertDialogTrigger>
  <AlertDialogBackdrop />
  <AlertDialogContent>
    <AlertDialogHeader><AlertDialogTitle>Delete photo?</AlertDialogTitle></AlertDialogHeader>
    <AlertDialogFooter orientation="vertical">
      <AlertDialogClose variant="cancel">Cancel</AlertDialogClose>
      <AlertDialogClose tone="destructive" value="confirm" action={del}>Delete</AlertDialogClose>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

Focus starts on the first `AlertDialogClose`, so put the safe answer first. An outside press never closes an alert; Escape does unless `dismissible={false}`. To ask from code: `const confirm = createConfirm()`, `<AlertDialog controller={confirm.controller}>…`, then `if (await confirm()) …` (it resolves `true` for `value="confirm"`).

```tsx
// 5.x
<Sheet>
  <Button variant="secondary">Filters</Button>
  <SheetContent side="right" aria-label="Filters" isDismissable={false}>
    {({ close }) => <SheetFooter><Button size="pill" onPress={() => { apply(); close() }}>Apply</Button></SheetFooter>}
  </SheetContent>
</Sheet>

// 6.0
<Sheet side="right" dismissible={false}>
  <SheetTrigger render={<Button variant="secondary" />}>Filters</SheetTrigger>
  <SheetBackdrop />
  <SheetContent aria-label="Filters">
    <SheetFooter><SheetClose render={<Button size="pill" />} action={apply}>Apply</SheetClose></SheetFooter>
  </SheetContent>
</Sheet>
```

```tsx
// 5.x: useHoverCard on an element you render
const card = useHoverCard<HTMLDivElement>()
<div {...card.triggerProps} tabIndex={0}>…</div>
<HoverCard {...card.cardProps} placement="right top">…</HoverCard>

// 6.0: make the element the trigger
<HoverCard>
  <HoverCardTrigger render={<div tabIndex={0} aria-label="Q3 revenue" />}>…</HoverCardTrigger>
  <HoverCardContent side="right" align="start">…</HoverCardContent>
</HoverCard>

// 6.0: many triggers, one card (lists, avatar groups, feeds)
const [previews] = useState(() => createHoverCardController<Row>())
{rows.map((r) => (
  <HoverCardTrigger key={r.id} controller={previews} payload={r} render={<div className="flex w-full" />}><RowView r={r} /></HoverCardTrigger>
))}
<HoverCard controller={previews}>
  <HoverCardContent side="right" align="start">{({ payload }) => payload && <Preview row={payload} />}</HoverCardContent>
</HoverCard>
```

For a target you hit-test yourself (a canvas item, a map pin), call `controller.open({ anchor: element or { x, y }, payload })` and `controller.close()`; they are immediate (there is no `openSoon`).

| 5.x slot | 6.0 slot |
| --- | --- |
| `popover`, `popover-content` | `popover-content` (the surface); `popover-trigger`, `popover-title`, `popover-description`, `popover-close`, `popover-arrow` |
| `tooltip` | `tooltip-content`; `tooltip-trigger`, `tooltip-arrow`, `tooltip-shortcut` |
| `hover-card-trigger` (a span), `hover-card` | `hover-card-trigger` (the element itself), `hover-card-content` |
| `dialog-overlay`, `dialog-content` (modal), `dialog`, `dialog-action` | `dialog-backdrop`, `dialog-content` (the card, `role=dialog`), `dialog-trigger`, `dialog-title`, `dialog-description`, `dialog-close`; `alert-dialog-*` for alerts |
| `sheet-overlay`, `sheet`, `sheet-content` | `drawer-backdrop`, `drawer-viewport`, `drawer-content` (`data-side`, `data-dragging`), `drawer-trigger`, `drawer-title`, `drawer-close`, `drawer-handle` |

## Tabs, disclosure and scroll areas

[Tabs](https://blamy.github.io/ui/#/tabs) (with TabView's looks and the bottom tab bar), [Disclosure and DisclosureGroup](https://blamy.github.io/ui/#/disclosure), [ScrollArea](https://blamy.github.io/ui/#/scroll-area).

| Module | 5.x | 6.0 |
| --- | --- | --- |
| `tabs` | `TabList`, `Tab`, `TabPanel`, `tabVariants` | `TabsList` (draws the sliding indicator), `TabsTab`, `TabsPanel`, `tabsTabVariants`. New: `TabsTabIcon`, `tabsIndicatorVariants`, `createTabsController`. |
| `tabs` | `selectedKey` / `defaultSelectedKey` / `onSelectionChange` | `value` / `defaultValue` / `onValueChange(value \| null, details)`; reasons `item-press`, `list-navigation`, `find-in-page`, `item-removed`, `imperative` |
| `tabs` | `Tab id`, `TabPanel id shouldForceMount` | `TabsTab value`, `TabsPanel value keepMounted` (unselected panels unmount) |
| `tabs` | `keyboardActivation="manual"`, `isDisabled` / `disabledKeys` | `activation="manual"`, `disabled` on each `TabsTab` |
| `tabs` | `TabDirection`, `useTabPanelDirection()` | removed: panels read `data-activation-direction` and `data-starting-style` |
| `tabs` | slots `tab-list`, `tab`, `tab-indicator`, `tab-panel` | `tabs-list`, `tabs-tab`, `tabs-indicator`, `tabs-panel` |
| `tab-view`, `tab-bar` → `tabs` | `TabView`, `TabViewBar`, `TabViewList`, `TabViewTab`, `TabViewPanels`, `TabViewPanel`… from their own modules | `Tabs` with `variant` (`segmented`, `underline`, `bar`, `rail`, `switcher`, `plain`) and `side`, and the parts `TabsBar`, `TabsList`, `TabsTab`, `TabsIndicator`, `TabsPill`, `TabsSeparator`, `TabsAction`, `TabsHeader`, `TabsFooter`, `TabsPanels`, `TabsPanel`, all from `@/components/ui/tabs` (see [the table above](#components-that-merged-moved-or-were-renamed)) |
| `tabs` (TabView) | `selectedKey` / `onSelectionChange`, `TabViewTab id textValue`, `TabViewPanel id shouldForceMount` | `value` / `onValueChange`, `TabsTab value`, `TabsPanel value keepMounted` |
| `tabs` (TabView) | `TabViewIndicator` inside each tab; `variant="pill" attention` | one `TabsIndicator` inside `TabsList` (the list draws one unless you place your own); `TabsPill attention` inside each tab |
| `tabs` (TabView) | tab render state `{ isSelected, isHovered, … }` (`TabRenderProps`) | `{ selected, disabled }`; hover with `group-hover/tab:` |
| `tabs` (TabView) | `TabViewAction onPress isDisabled title`, `TabViewPanels items` | `TabsAction onClick disabled` with the label as children; `TabsPanels` is a plain `div`, and a `TabsPanel` inside it stacks with its own scroll |
| `tabs` | a tab was a `div` | UI SDK's tab, a `<button type="button">` (the kit resets its border, background and font); a tab that holds controls of its own takes `render={<div />}` |
| `tabs` (TabView) | `data-placement` on `TabView` and `TabViewBar` | `data-side` (`top`, `bottom`, `start`, `end`) and `data-variant` on the root and the bar |
| `tabs` (TabBar) | `TabBar items[].id`, `selected`, `onSelect(id)` | a composition: `<Tabs variant="bar">` + `TabsBar` + `TabsList aria-label` + one `TabsTab value icon` per item |
| `disclosure` | `DisclosureGroup` of `Disclosure`s, `expandedKeys` / `onExpandedChange` (`Set`), `allowsMultipleExpanded` | `DisclosureGroup` (UI SDK Accordion) of `DisclosureGroupItem`s, `value` / `onValueChange(string[], details)`, `multiple`; new `collapsible`, `keepMounted`, `hiddenUntilFound` |
| `disclosure` | standalone `Disclosure isExpanded / onExpandedChange` | `Disclosure open / onOpenChange(open, details)` (UI SDK Collapsible) |
| `disclosure` | `DisclosureTrigger level={3}` | standalone: no heading built in; in a group: `DisclosureGroupHeader` (h3, `render={<h4 />}`) wraps `DisclosureGroupTrigger` |
| `disclosure` | `Accordion`, `AccordionItem id`, `AccordionTrigger`, `AccordionContent` | `DisclosureGroup`, `DisclosureGroupItem value`, `DisclosureGroupHeader` + `DisclosureGroupTrigger`, `DisclosureGroupPanel` (the `Accordion*` names are gone: one name per part) |
| `disclosure` | `data-expanded`, `--disclosure-panel-height` | `data-open` / `data-closed`, `--collapsible-panel-height` / `--accordion-panel-height` |
| `scroll-area` | `<ScrollArea>` = one scrolling div | `ScrollArea > ScrollAreaViewport > ScrollAreaContent`; `aria-label`, `onScroll` and a scroll `ref` go on the viewport. `tabIndex` is automatic. |
| `scroll-area` | `scrollAreaVariants` | `scrollAreaViewportVariants`. New: `ScrollAreaScrollbar`, `ScrollAreaThumb`, `ScrollAreaCorner`, `ScrollAreaScrollToEnd`, `stickToEnd`, `createScrollAreaController`. |

```tsx
// 5.x
<Tabs selectedKey={k} onSelectionChange={setK} keyboardActivation="manual">
  <TabList aria-label="Settings"><Tab id="a">A</Tab><Tab id="b" isDisabled>B</Tab></TabList>
  <TabPanel id="a">…</TabPanel>
</Tabs>
<TabBar items={[{ id: 'a', title: 'A', icon: 'star' }]} selected={t} onSelect={setT} />

// 6.0
<Tabs value={k} onValueChange={setK} activation="manual">
  <TabsList aria-label="Settings"><TabsTab value="a">A</TabsTab><TabsTab value="b" disabled>B</TabsTab></TabsList>
  <TabsPanel value="a">…</TabsPanel>
</Tabs>
<Tabs variant="bar" value={t} onValueChange={(next) => next && setT(next)}>
  <TabsBar>
    <TabsList aria-label="Tabs"><TabsTab value="a" icon="star">A</TabsTab></TabsList>
  </TabsBar>
</Tabs>
```

```tsx
// 5.x
<Accordion allowsMultipleExpanded defaultExpandedKeys={['a']}>
  <AccordionItem id="a"><AccordionTrigger>Title</AccordionTrigger><AccordionContent>…</AccordionContent></AccordionItem>
</Accordion>
<ScrollArea aria-label="Notes" className="h-44">{rows}</ScrollArea>

// 6.0
<DisclosureGroup multiple defaultValue={['a']}>
  <DisclosureGroupItem value="a">
    <DisclosureGroupHeader><DisclosureGroupTrigger>Title</DisclosureGroupTrigger></DisclosureGroupHeader>
    <DisclosureGroupPanel>…</DisclosureGroupPanel>
  </DisclosureGroupItem>
</DisclosureGroup>
<ScrollArea className="h-44">
  <ScrollAreaViewport aria-label="Notes"><ScrollAreaContent>{rows}</ScrollAreaContent></ScrollAreaViewport>
</ScrollArea>
```

## Dates

[Calendar](https://blamy.github.io/ui/#/calendar), [DateInput](https://blamy.github.io/ui/#/date-input) (was DateField and TimeField), [DatePicker](https://blamy.github.io/ui/#/date-picker), [NaturalTimeInput](https://blamy.github.io/ui/#/natural-time-input) (was TimeInput).

Values are ISO strings, not `@internationalized/date` objects; `null` means empty. Helpers come from `@ui-sdk/core/date` (`todayDate`, `addDays`, `addMonths`, `toISODate`, `formatDate`…). Dates are Gregorian only, and there is no time-zone segment.

| 5.x | 6.0 |
| --- | --- |
| `parseDate('2026-09-09')` | `'2026-09-09'` |
| `today(getLocalTimeZone())` | `todayDate()` (or `todayDate(timeZone)`) |
| `new CalendarDate(y, m, d)` | `toISODate({ year: y, month: m, day: d })` |
| `date.add({ days: n })`, `date.compare(other)` | `addDays(date, n)`, `a < b` (ISO dates sort as strings) |
| `parseDateTime('2026-09-09T09:30')`, `new Time(9, 30)` | `'2026-09-09T09:30'`, `'09:30'` (always 24-hour) |
| `ZonedDateTime` | not supported: keep a local date-time and the zone separately |
| `{ start, end }` | `[start, end]`, or `null` until both ends exist |

| Module | 5.x | 6.0 |
| --- | --- | --- |
| `calendar` | `RangeCalendar`, `RangeCalendarProps` | `Calendar mode="range"`, `CalendarProps<'range'>`; also `mode="multiple"` |
| `calendar` | `onChange`, `minValue` / `maxValue`, `isDateUnavailable` | `onValueChange(value, details)`, `min` / `max`, `unavailable` (an ISO date, `{ from, to }`, `{ weekday: [0, 6] }`, `{ before }`, `{ after }`, a function, or an array) |
| `calendar` | `visibleMonths`, paging by all visible months | `months` (any number), paging one month at a time unless `pageBy="page"` |
| `calendar` | `focusedValue` / `onFocusChange`, `firstDayOfWeek="mon"` | `month` / `defaultMonth` / `onMonthChange` (`'2026-09'`), `onFocusedChange`, `weekStartsOn={1}` |
| `calendar` | `CalendarCell date`, `CalendarGrid offset={{ months: 1 }}` | `CalendarDay value`, `CalendarGrid offset={1}`. New parts: `CalendarHeading`, `CalendarPrevious`, `CalendarNext`, `CalendarMonthSelect`, `CalendarYearSelect`, `CalendarWeekdays`, `CalendarWeeks`; `createCalendarController`. |
| `calendar` | `isDisabled`, `isReadOnly`, `allowsNonContiguousRanges`; `isInvalid`, `errorMessage`, `createCalendar`, `pageBehavior` | `disabled`, `readOnly`, `allowUnavailable` (and `minDays` / `maxDays`); the others are removed |
| `date-field` → `date-input` | `DateField` / `TimeField` = a wrapper with `Label`, an inner `DateInput`, `FieldError` | `DateInput` / `TimeInput` from `@/components/ui/date-input` = the segmented input itself, inside a `Field`. 5.x's inner `DateInput` part and its `dateInputVariants` are now the control's root and recipe (the recipe draws the shared field surface, with `size`). |
| `date-input` | `DateSegment` | `DateInputSegment` / `TimeInputSegment` |
| `date-input` | `onChange`, `isRequired`, `isInvalid`, `placeholderValue`, `validate` | `onValueChange`, `required`, `invalid` on the `Field`; the others are removed. `granularity` and `hourCycle` stay. New: `createDateInputController`, `createTimeInputController`. |
| `date-picker` | `DateRangePicker`, `DateRangePickerField`, `DateRangePickerContent` | `DatePicker mode="range"`, `DatePickerInputGroup`, `DatePickerContent` |
| `date-picker` | `Label` / `FieldError` children | wrap the `DatePicker` in a `Field` |
| `date-picker` | a segmented input; `granularity="minute"` | a text input (`DatePickerInput`) that parses on Enter or blur; date only (compose a `TimeInput`, or use `DateInput granularity="minute"`) |
| `date-picker` | `DatePickerContent calendarProps={{ visibleMonths: 2 }} placement` | calendar props on the root (`months`, `pageBy`, `min`, `max`, `unavailable`…); `side` / `align` on the content; content children are calendar parts and `DatePickerPreset`s, not a `<Calendar>` |
| `date-picker` | `isOpen`, `shouldCloseOnSelect`, `onChange` | `open`, `closeOnSelect`, `onValueChange`. New: `DatePickerTrigger` (named "Choose date, …"), `DatePickerClear`, `DatePickerHint`, `presentation`, `size` (on the root), `createDatePickerController`. The calendar inside is `CalendarMonths`, which wraps its months on a narrow box. |
| `time-input` → `natural-time-input` | `TimeInput onValueChange({ text, result, … })`, `onChange(text)`, `isInvalid`, `label`, `description`, `error` | `NaturalTimeInput onParseChange({ text, result, … })`, `onValueChange(text, details)`; put it in a `Field` (`invalid`, `FieldLabel`, `FieldDescription`, `FieldError`) |
| `natural-time-input` | `dateOrder`, `backend`, `weekStart`, `bareWeekday(s)`, `nextWeekday`, `dayParts`, `until`, `debounceMs` | `parse={{ … }}` (`NaturalTimeInputParseOptions`); `timeZone`, `locale`, `reference`, `maxOccurrences` stay top-level. A parse failure sets `aria-invalid` on the input |

```tsx
// 5.x
<RangeCalendar aria-label="Stay" visibleMonths={2} minValue={today(getLocalTimeZone())}
  defaultValue={{ start: parseDate('2026-09-08'), end: parseDate('2026-09-13') }}
  isDateUnavailable={(d) => isWeekend(d, 'en-US')} onChange={(r) => save(r.start.toString(), r.end.toString())} />
<DateRangePicker defaultValue={{ start: parseDate('2026-09-08'), end: parseDate('2026-09-13') }} onChange={setRange}>
  <Label variant="field">Stay</Label>
  <DateRangePickerField />
  <DateRangePickerContent calendarProps={{ visibleMonths: 2 }} />
</DateRangePicker>

// 6.0
<Calendar mode="range" months={2} pageBy="page" min={todayDate()}
  defaultValue={['2026-09-08', '2026-09-13']}
  unavailable={{ weekday: [0, 6] }} onValueChange={(r) => r && save(r[0], r[1])} />
<Field>
  <FieldLabel>Stay</FieldLabel>
  <DatePicker mode="range" months={2} defaultValue={['2026-09-08', '2026-09-13']} onValueChange={setRange}>
    <DatePickerInputGroup />
    <DatePickerContent />
  </DatePicker>
</Field>
```

## Color

[ColorPicker](https://blamy.github.io/ui/#/color-picker), with its "ColorInput" section (was ColorField).

Colors are CSS strings, not `Color` objects. Color math comes from `@ui-sdk/core/color` (`parseColor`, which returns `null` on bad input, `formatColor`, `convertColor`, `contrastRatio`, `mixColor`, `isInGamut`, `toGamut`). The `color-field` module is gone: its parts are parts of `color-picker`, under UI SDK's names.

| 5.x | 6.0 |
| --- | --- |
| `value: string \| Color`, `onChange(color: Color)` | `value: string`, `onValueChange(value: string, details)` on every step, `onValueCommit(value, details)` when an interaction ends; never `null` |
| `color.toString('hex')` | the value itself (hex by default), or `formatColor(parseColor(value)!, 'hsl')`; in a callback, `formatColor(details.color, …)` |
| `color.getChannelValue('alpha')` | `parseColor(value)?.alpha` (`{ space, coords, alpha }` is plain data) |
| `colorSpace="hsb"` on each part | `space="hsv"` on the root (`hsv`, `hsl`, `srgb`, `oklch`); the picker writes back in `format` |

| Module | 5.x | 6.0 |
| --- | --- | --- |
| `color-field` → `color-picker` | `ColorField` = a wrapper holding `Label`, `ColorFieldGroup`, `FieldError` | `ColorInput` = the filled field itself (a UI SDK `ColorPicker` root drawn with `fieldSurfaceVariants`), inside a `Field`; `size` is on `ColorInput`; children default to `<ColorPickerSwatch /><ColorPickerInput />` |
| `color-picker` | `ColorField isInvalid`, `validate`, `errorMessage` | `invalid` on the `Field` |
| `color-picker` | `channel` + `colorSpace` | `<ColorInput space="hsl"><ColorPickerChannelInput channel="hue" /></ColorInput>`; a unit (° or %) follows the number |
| `color-picker` | `ColorFieldGroup`, `colorFieldGroupVariants`; `ColorFieldInput`, `ColorFieldChannelInput`, `ColorFieldSwatch` | `ColorPickerInputGroup` (the box inside a `ColorPicker`, `size`), `fieldSurfaceVariants` from `input`; `ColorPickerInput`, `ColorPickerChannelInput`, `ColorPickerSwatch` |
| `color-picker` | `ColorSwatch color?: string \| Color` (fell back to the picker in context) | `ColorSwatch color: string` (required, no context); inside a picker use `ColorPickerSwatch` |
| `color-picker` | `ColorPicker` rendered no element | renders a `div role="group"`: name it, and give it layout classes or none |
| `color-picker` | `ColorPicker` around a `PopoverTrigger` with the trigger and content | the root holds the popover state (`open`, `defaultOpen`, `onOpenChange`, `presentation`, a sheet in a compact scope): put `ColorPickerTrigger` and `ColorPickerContent` straight in. A `<Popover>` inside still works when several triggers share one picker |
| `color-picker` | `ColorArea colorSpace xChannel yChannel` | `ColorPickerArea x y` (space from the root); `ColorPickerAreaCanvas` for OKLCH |
| `color-picker` | `ColorThumb` | `ColorPickerAreaThumb` / `ColorPickerSliderThumb` |
| `color-picker` | `ColorSlider colorSpace channel` | `ColorPickerSlider channel`; `className` styles the track |
| `color-picker` | `ColorSwatchPicker` (own value), `ColorSwatchPickerItem color` | `ColorPickerSwatches` (follows the picker's color), `ColorPickerSwatchItem value` |
| `color-picker` | `ColorPickerTrigger` (a Button in a `DialogTrigger`, always hex), `ColorPickerContent placement` | `ColorPickerTrigger` (the picker's popover trigger; shows the value in the picker's `format`, `colorPickerTriggerVariants`), `ColorPickerContent side align`. New: `ColorPickerEyeDropper`, `createColorPickerController`. |

```tsx
// 5.x
<ColorField defaultValue="#7f5af0" onChange={(c) => c && setAccent(c.toString('hex'))} isInvalid={bad}>
  <Label variant="field">Accent</Label>
  <ColorFieldGroup size="sm"><ColorFieldSwatch /><ColorFieldInput /></ColorFieldGroup>
  <FieldError>Pick a darker color.</FieldError>
</ColorField>
<ColorPicker value={accent} onChange={(c) => setAccent(c.toString('hex'))}>
  <PopoverTrigger>
    <ColorPickerTrigger />
    <ColorPickerContent placement="bottom end" swatches={presets} alpha />
  </PopoverTrigger>
</ColorPicker>

// 6.0
<Field invalid={bad ? true : undefined}>
  <FieldLabel>Accent</FieldLabel>
  <ColorInput size="sm" defaultValue="#7f5af0" onValueChange={setAccent} />
  <FieldError>Pick a darker color.</FieldError>
</Field>
<ColorPicker aria-label="Accent" value={accent} onValueChange={setAccent}>
  <ColorPickerTrigger />
  <ColorPickerContent align="end" swatches={presets} alpha />
</ColorPicker>
```

In a composed panel the picker is the panel: `<ColorPicker aria-label="Accent" className="grid gap-4"><ColorPickerArea /><ColorPickerSlider channel="hue" label="Hue" /><ColorPickerSwatches aria-label="Presets">…</ColorPickerSwatches></ColorPicker>`. A picker with a field inside: `<ColorPicker …><ColorPickerInputGroup size="sm"><ColorPickerSwatch /><ColorPickerInput /></ColorPickerInputGroup></ColorPicker>`.

## Trees

[Tree](https://blamy.github.io/ui/#/tree) (with its "Database schema" section, for SchemaTree), [CallStack](https://blamy.github.io/ui/#/call-stack), [ObjectTree](https://blamy.github.io/ui/#/object-tree), [ObjectValue](https://blamy.github.io/ui/#/object-value).

`Tree` is UI SDK's Tree. The data form (`items`) keeps sort, search, flatten, icons, git status, context menus, previews, rename and drag and drop; without `items` or `paths`, `Tree` is UI SDK's composition (`TreeItem`, `TreeItemLabel`, `TreeItemIndicator`, `TreeItemCheckbox`, `TreeGroup`).

| Module | 5.x | 6.0 |
| --- | --- | --- |
| `tree` | `TreeNode { id, name }` | `TreeNode { value, label }` (+ `disabled`, `href`); `contextMenu`, `preview`, `onMove`… read `node.value` / `node.label` |
| `tree` | `selectedIds`, `defaultSelectedIds`, `onSelectionChange(ids)` (multi-select by default) | `value` / `defaultValue` / `onValueChange(value, details)`, single by default (`mode="multiple"` for an array, `"none"` to act only) |
| `tree` | `onAction(node)` on double-click or Return | `onAction(value, details)` on a press or Return; may return a Promise |
| `tree` | `activationMode: 'doubleClick' \| 'singleClick'` (5.17; default double) | `actionOn: 'double-press' \| 'press'` (default `press`). UI SDK's own `activation` is a different thing: whether the arrow keys select. |
| `tree` | `defaultExpanded: 'all' \| 'none' \| ids`, `expandedIds` | `defaultExpanded: 'all' \| ids` (leave out for none), `autoExpand`; new controlled `expanded` / `onExpandedChange` |
| `tree` | `icons: 'minimal' \| 'standard' \| 'complete' \| 'none'`, `density` (or a number) | `icons: boolean`, `density: 'compact' \| 'default' \| 'comfortable'` (`TreeDensity`, 24 / 30 / 36px rows) |
| `tree` | `renamingId`, `onRename(node, name)`, `onRenameEnd()` | `editing`, `onRename(node, label, details)` (return `false` to keep the field open), `onEditingChange(editing \| null, details: TreeEditingChangeDetails)` (UI SDK change details: a cancel is `reason === 'escape-key'`, and `details.cancel()` refuses the change). F2 starts a rename when `onRename` is set. A controlled `editing` is truly controlled: F2 only asks through `onEditingChange`, and the field opens when you pass the id back. |
| `tree` | `TreeFileIcon`, `TreeFolderIcon` | `FileBadgeIcon`, `FolderIcon` from `@/lib/file-icons`, with `FileTypeIcon` (what the rows draw) and `fileTypeOf(name)` |
| `tree` | — | New: `checkable`, `checked`, `onCheckedChange`, `loadChildren`, `current`, `loading` (placeholder rows), `emptyState` (the kit's `EmptyState`; a string is its title), `renderRow(node, state)` for a row of your own, `controller`, `createTreeController`, `treeFromPaths`, `treeVariants`, `treeRowVariants`. `onAction`'s details carry the `node`. Slot `tree-view` wraps UI SDK's `tree`, `tree-item`, `tree-label`. |
| `schema-tree` → `tree` | `SchemaTree schema isLoading`; `onSelectTable(table)` / `onSelectColumn(table, column)` on selection | `<Tree items={schemaTreeItems(schema)} loading …>` (`schemaTreeItems`, `SchemaTreeNode` from `@/lib/pglite-schema`); `onAction(value, { node })` on a press or Return, where `node` is a `SchemaTreeNode` (`kind`, `table`, `column`) |
| `call-stack` | `selectedId`, `defaultSelectedId`, `onSelect(frame, index)` | `value`, `defaultValue`, `onValueChange(value, { frame, index, reason, cancel })` |
| `call-stack`, `object-tree` | `rowHeight` (px), `emptyMessage`; their own row recipes | `density` (Tree's scale, default `compact`), `emptyState`; the rows are Tree's (`treeRowVariants`), and `data-kind` / `data-row` sit on the `tree-label` |
| `object-tree` | `onSelect(node \| null)` | `value` / `defaultValue` (a row key, `objectTreeKey(ids)`) / `onValueChange(key, { node, reason, cancel })`, `mode`; Return on a row acts like a double press; indent reads `--tree-level`. `aria-label` defaults to "Values"; new `onValueCopy(text, node)` |
| `object-value` | `expandable` | `actions`; new `onValueCopy(text)` |

```tsx
// 5.x
<Tree aria-label="Files" items={nodes} expandedIds={open} selectedIds={sel ? [sel] : []}
  onSelectionChange={([id]) => setSel(id ?? null)} onAction={(node) => openFile(node.id)}
  renamingId={renaming} onRename={(node, name) => rename(node.id, name)} onRenameEnd={() => setRenaming(null)} />
<CallStack frames={frames} selectedId={id} onSelect={(frame, i) => select(frame.id, i)} />

// 6.0
<Tree aria-label="Files" items={nodes} autoExpand={open} value={sel}
  onValueChange={setSel} onAction={(value) => openFile(value)}
  editing={renaming} onEditingChange={(editing) => editing === null && setRenaming(null)}
  onRename={(node, label) => (isValidName(label) ? rename(node.value, label) : false)} />
<CallStack frames={frames} value={id} onValueChange={(value, { index }) => select(value, index)} />
```

## Tables and logs

[LogList](https://blamy.github.io/ui/#/log-list), [DataTable](https://blamy.github.io/ui/#/data-table) (with its "Query results" section, for ResultTable), [RequestTable](https://blamy.github.io/ui/#/request-table), [SQL console](https://blamy.github.io/ui/#/sql-console).

Rows take real roving focus (no `aria-activedescendant`): style them with `focus-visible:` on the row, not `group-data-focus-visible/grid:`.

| Module | 5.x | 6.0 |
| --- | --- | --- |
| `log-list`, `request-table` | `selectedId`, `defaultSelectedId`, `onSelectionChange(id)` | `value`, `defaultValue`, `onValueChange(value, details)` |
| `log-list`, `request-table` | `onRowPress(row, index)` | `onAction(id, { row, index, reason, event })` |
| `log-list`, `request-table` | `ref` to `LogListHandle` / `RequestTableHandle` | `controller` from `createLogListController()` / `createDataTableController()` (RequestTable is a preset of DataTable); `ref` reaches the root `<div>` |
| `log-list`, `request-table` | `scrollToId(id, 'nearest')` | `controller.scrollToId(id, { align: 'auto' })`; also `focus()`, `setValue()`, and `setExpanded()` / `setCurrentTime()` / `setSort()` / `setColumnWidths()` |
| `log-list` | `expandedIds: Set`, `onExpandedChange(Set)` | `expanded: RowId[]`, `onExpandedChange(RowId[], details)` |
| `log-list` | `onFollowChange(following)` | `onFollowingChange(following, details)` |
| `request-table` | `onSortChange(sort)`, `onColumnWidthsChange(widths)` (every move) | `(sort, details)`, `(widths, details)` (once, on release) |
| `request-table` | `RequestLink onPress isDisabled` | `onClick`, `disabled` |
| `request-table` | a sort button inside each column header | the column header itself is pressed (click, Enter, Space) |
| `request-table` | `stackBelow={480}` | `breakpoints={{ medium: 480 }}` (`DataTableBreakpoints`, defaults `medium` 480 and `regular` 760): two-line rows below `medium`; the root writes `data-size-class` |
| `request-table` | column `hideBelow: number` (px; `type` 760, `size` 640) | `hideBelow: 'medium' \| 'regular'`, a size class; `type` and `size` both hide below `regular` (760px), so `size` now hides from 760px rather than 640px |
| `request-table` | `data-playhead`, `--request-*` on the root | `--data-table-*` on `[data-slot=data-table-grid]`; the engine's slots are `data-table`, `data-table-row`, `data-table-cell`…, and the request parts keep `request-table-name`, `-bar`, `-link` (the playhead is `request-table-current-time`) |
| `request-table` | `RequestColumn`, `RequestSort`, `requestTableVariants`, `sortRequests` | `DataTableColumn`, `DataTableSort`, `dataTableVariants`, `sortDataTableRows`; sizes under 1 kB read "280 B" |
| `log-list`, `request-table` | `density: 'compact' \| 'comfortable'`; an empty list's text | adds `default`; `emptyState` (the kit's `EmptyState`) |
| `result-table` → `data-table` | `ResultTable result durationMs maxRows maxHeight onCopy toolbar emptyMessage resizable` (react-aria Table) | removed: the SQL console renders each result with `DataTable` (virtualized, every column resizes, a value too long for its cell opens in a popover). A host with rows of its own writes `<DataTable rows columns mode="none" toolbar>`; the console's height is `--sql-console-result-height` |
| `sql-console` | `sidebar`, `transfer`, `headerActions`, `layout`, `resultMaxHeight` | compose `SqlConsoleHeader` (with `SqlConsoleDatabaseMenu`), `SqlConsoleSidebar`, `SqlConsoleEditor`, `SqlConsoleResults`; two columns only with a sidebar in a medium box |

```tsx
// 5.x
const list = useRef<LogListHandle>(null)
<LogList ref={list} rows={rows} selectedId={id} onSelectionChange={setId}
  expandedIds={open} onExpandedChange={setOpen} onRowPress={(row) => seek(row.time)} onFollowChange={setFollowing} />
list.current?.scrollToId(id, 'nearest')

// 6.0
const [list] = useState(createLogListController)
<LogList controller={list} rows={rows} value={id} onValueChange={setId}
  expanded={open} onExpandedChange={setOpen} onAction={(id, { row }) => seek(row.time)} onFollowingChange={setFollowing} />
list.scrollToId(id, { align: 'auto' })
```

## Toast

[Toast](https://blamy.github.io/ui/#/toast).

The queue is UI SDK's toaster; `toast` and `createToaster` are UI SDK's. A region shows one queue, so banners and the HUD pill each get their own region.

| 5.x | 6.0 |
| --- | --- |
| `<Toaster />` | `<ToastRegion />` (banners) and `<ToastRegion variant="hud" />` (the HUD) |
| `<Toaster queue={q}>{children}</Toaster>` | `<ToastProvider toaster={q}>{children}</ToastProvider>` + `<ToastRegion toaster={q} />` (a banner region with no `toaster` shows the nearest provider's queue) |
| `placement="top" \| "bottom" \| "top-end" \| "bottom-end"` | `side="top" \| "bottom"`, `align="start" \| "center" \| "end"`; `placement="center"` is gone |
| `inline` | removed: a region renders into the nearest `BLProvider` root; `container` overrides |
| `expand` | `expanded` |
| `toast.hud('Copied')` | `hud('Copied')`; a HUD of your own is `createHud()` with `<ToastRegion variant="hud" toaster={myHud.toaster} />` |
| `createToastQueue({ maxVisibleToasts })`, `ToastQueue`, `defaultToastQueue`, `toastApi`, `toast.queue` | `createToaster({ duration })`, `<ToastRegion maxVisible>`; the rest removed |
| `useToast()` → `ToastApi` | `useToast()` → the nearest queue (same call shape as `toast`) |
| `timeout` (`0` = sticky) | `duration` (`Infinity` = sticky) |
| `onClose()` | `onDismiss(details)` |
| `tone: 'destructive' \| …` | `type: 'error' \| 'success' \| 'warning' \| 'info' \| 'loading' \| 'default'`; `toastIconVariants({ type })` |
| `loading: true` | `type: 'loading'`, `toast.loading()`, or `toast.promise(p, { loading, success, error })` |
| `icon` | `data: { icon }` |
| `variant: 'hud' \| 'banner'` | removed: the region decides the look |
| `action.onAction` returning `false` to stay open | `action: { label, onAction, dismiss: false }` |
| `toast.update(id, patch, { timeout })` | `toast.update(id, options)` (the patch carries `duration`) |
| types `ToastApi`, `ToastTone`, `ToasterProps`, `ToasterPlacement` | `Toaster`, `ToastType`, `ToastRegionProps`; new parts `Toast`, `ToastIcon`, `ToastTitle`, `ToastDescription`, `ToastAction`, `ToastClose` for a region's children function |

```tsx
// 5.x
<Toaster placement="top-end" />
toast('Saved', { description: 'Live.', icon: 'check', tone: 'success', timeout: 0 })
toast.hud('Copied')
const q = createToastQueue(); <Toaster queue={q} inline>{children}</Toaster>

// 6.0
<ToastRegion side="top" align="end" />
<ToastRegion variant="hud" />
toast.success('Saved', { description: 'Live.', data: { icon: 'check' }, duration: Infinity })
hud('Copied')
const [q] = useState(() => createToaster())
<BLProvider><ToastProvider toaster={q}>{children}</ToastProvider><ToastRegion toaster={q} /></BLProvider>
```

## File upload

[FileUpload](https://blamy.github.io/ui/#/file-upload), [useFileUpload](https://blamy.github.io/ui/#/use-file-upload).

Built on UI SDK's FileInput. Every part handles plain `File`s: `FileEntry` is gone, and a file's folder path is `relativePath(file)` from `@ui-sdk/react/file-input`.

| Module | 5.x | 6.0 |
| --- | --- | --- |
| `file-upload` | `onFiles(entries: FileEntry[], info)` | `onFiles(files: File[], details)`; `info.source` (`drop` / `browse` / `paste`) is `details.reason` (`drop` / `picker` / `paste`). Only accepted files arrive; `onReject(rejected)` gets the rest. |
| `file-upload` | `acceptDirectory`, `defaultCamera` | `directory`, `capture="user" \| "environment" \| true` |
| `file-upload` | `pasteable` | removed: a drop zone takes pastes while focus is inside it; `pasteTarget="document"` for the page |
| `file-upload` | `FileDropZone`, `FileUploadButton`, `FileList`, `FileItem`, `FileThumbnail` (+ their props and `fileDropZoneVariants`, `fileItemVariants`) | `FileUploadDropzone`, `FileUploadTrigger`, `FileUploadList`, `FileUploadItem`, `FileUploadThumbnail` (+ `fileUploadDropzoneVariants`, `fileUploadItemVariants`): every part carries the root's name |
| `file-upload` | `FileDropZone isInvalid isDisabled size="compact"`, react-aria DropZone props | `FileUploadDropzone disabled orientation="horizontal" target pasteTarget render`; invalid comes from a `Field` around it (`<Field invalid>` + `<FieldError>`); children state `{ dragging, dragAccept, dragReject, disabled }` |
| `file-upload` | `FileUploadButton isDisabled onPress` | `FileUploadTrigger disabled`; it is a UI SDK trigger with the kit's button look (`data-file-upload-trigger`) |
| `file-upload` | slots `file-drop-zone`, `file-upload`, `data-drop-target`, `file-thumbnail`, `file-item`, `file-list` | `file-input-dropzone`, `file-upload` (the root, with `data-pending`), `data-dragging` / `data-drag-accept` / `data-drag-reject`; listed rows `file-input-item` (`[data-file-id]` selects any row); the kit's parts `file-upload-thumbnail`, `file-upload-item`, `file-upload-item-status`, `file-upload-list`, `file-upload-list-rejected` |
| `file-upload` | `FileList children(item)` returns anything | `FileUploadList` children must return a `<FileUploadItem item={item} />`; rejected rows are listed after the accepted ones |
| `file-upload-model` | `add(entries)`, `FileRules`, `validate(file, { path, files })` returning `false` | `add(files)` (while a `FileUpload` using the state is mounted), `FileUploadRules`, `validate(file)` returning a reason string |
| `file-upload-model` | `RejectionCode` `type`, `too-large`, `too-small`, `too-many`, `invalid` | `RejectionReason` `file-type`, `file-too-large`, `file-too-small`, `too-many-files`, `duplicate` or your own string; `messages` keys renamed to match |
| `file-upload-model` | `matchesAccept`, `parseAccept`, `validateFiles`, `readDropItems`, `ReadDropOptions`, `entriesFromFileList`, `FileEntry`, `FilesInfo` | removed (FileInput does this). New: `inputProps`, `inputController`, `FileUploadFilesHandler`, `FileUploadInputProps`. |
| `file-upload-model` | `useFileUpload`, `useFilePreview`, `UseFileUploadOptions`, `isBusy` | `useFileUpload`, `useFilePreview` from `lib/use-file-upload`; options `FileUploadOptions` (from `lib/file-upload-primitive`, with `controller`); `pending`. The list is the `fileUpload` primitive: `createFileUploadController()` drives it, agents can `remove`, `retry`, `clear`, `uploadAll` |
| `file-upload-model`, `file-upload` | `files`, `defaultFiles`, `onFilesChange(files)` | `value`, `defaultValue`, `onValueChange(files, details)`: `details.reason` (`picker` / `drop` / `paste` / `remove-press` / `reset` / `imperative` / `reject` / `retry` / `clear` / `upload-start` / `progress` / `settle`), `source`, `id`, `added`, `removed`, `cancel()`. The hook still returns `files`; `remove`, `retry`, `clear` take `{ reason, event }`. |
| `format-bytes`, `file-upload`, `file-upload-model`, `request-table`, `sql-console` | `formatBytes(n)`: binary units, "1.5 KB" for 1536 bytes, "5 MB" for 5 × 1024² | removed: every size reads through the kit's `formatFileSize(bytes, locale?)` (`@/lib/file-size`, `@brett_lamy/ui` on npm), UI SDK's locale-aware units with "B" under a kilobyte: "280 B", "1.5 kB" for 1500 bytes, "5 MB" for 5,000,000. Write limits in decimal (`maxSize={5_000_000}`) so hints read round |

```tsx
// 5.x
<FileDropZone isInvalid={!!error} acceptDirectory onFiles={(entries) => load(entries.map((e) => e.file))} />
<FileUploadButton isDisabled={busy} defaultCamera="environment" onFiles={([entry]) => setPhoto(entry.file)}>Photo</FileUploadButton>
<FileUpload pasteable accept={['image/*']} messages={{ type: 'Images only' }} />

// 6.0
<Field invalid={error ? true : undefined}>
  <FileUploadDropzone directory onFiles={(files) => load(files)} />
  <FieldError>{error}</FieldError>
</Field>
<FileUploadTrigger disabled={busy} capture="environment" onFiles={([file]) => setPhoto(file)}>Photo</FileUploadTrigger>
<FileUpload accept={['image/*']} messages={{ 'file-type': 'Images only' }} />
```

## Command menu

[CommandMenu](https://blamy.github.io/ui/#/command-menu).

Every part takes UI SDK's Command part names with the `CommandMenu` prefix, and the dialog is a separate root.

| 5.x | 6.0 |
| --- | --- |
| `CommandInput`, `CommandList`, `CommandPage`, `CommandGroup`, `CommandItem`, `CommandEmpty`, `CommandSeparator`, `CommandFooter`, `CommandLegendItem` | `CommandMenuInput`, `CommandMenuList`, `CommandMenuPage`, `CommandMenuGroup` + `CommandMenuGroupLabel`, `CommandMenuItem`, `CommandMenuEmpty` (beside the list, not in it), `CommandMenuSeparator`, `CommandMenuFooter`, `CommandMenuLegendItem` |
| `<CommandMenu variant="dialog" isOpen onOpenChange hotkey container overlayClassName aria-label>` | `CommandMenuDialog` (`open`, `onOpenChange`, `controller`, `container`) + the Dialog's `DialogTrigger shortcut="mod+k"` + `CommandMenuDialogContent aria-label backdropClassName` around a `CommandMenu` |
| `CommandList maxHeight` | `className="max-h-…"` (default `max-h-90`) |
| `CommandPage id="root"`, `onKeyDown(e, menu)` | the first page has no `value`; others `value="…"`; `onKeyDown(event, controller)` |
| `CommandGroup heading forceMount` | a `CommandMenuGroupLabel` as the first child; `forceMount` removed |
| `CommandItem title`, `shortcut="⇧⌘O"` (display only), `badge`, `onSelect(value)` | `trailing={<CommandMenuShortcut shortcut="mod+shift+o" />}` to display, or `shortcut="mod+shift+o"` to register it; `trailing` for a badge; `onSelect(event)` (or the menu's `onAction(value, details)`). `title` stays, and text children are the title too: `<CommandMenuItem>New thread</CommandMenuItem>` |
| `boost`, `keywordWeight`, `searchDescription`, `ranking`, `escapeBehavior` | removed; pass commands as `items` to rank them. Escape always clears the search, then goes back a page, then closes. |
| `onPageChange(page, pages)` | `onPagesChange(pages, details)` (`[]` on the first page) |
| `menuRef`, `CommandMenuApi` | `controller={createCommandMenuController()}`; `useCommandMenu()` returns `{ query, pages, page, controller }` |
| `useCommandActive()` | `useCommandMenuValue()` |
| `CommandEmpty` text, `CommandHighlight`, `commandMatch`, `CommandMatch` | `CommandMenuEmpty` draws the kit's `EmptyState` (`icon`, `title` or text children, `description`, `action`); string titles bold their matches; `matchRanges` / `fuzzyScore(text, query)` from `@ui-sdk/core/text-match` |
| `useHotkey(hotkey, handler, enabled)`, `matchesHotkey` | `useShortcut(enabled ? 'mod+k' : null, handler)` from `@ui-sdk/react/shortcuts` |
| row `data-active` | `data-highlighted`; the root has `data-depth` and `data-direction` |

```tsx
// 5.x
<CommandMenu variant="dialog" isOpen={open} onOpenChange={setOpen} hotkey="mod+k" aria-label="Search docs">
  <CommandInput placeholder="Search…" />
  <CommandList maxHeight={260}>
    <CommandEmpty />
    <CommandGroup heading="Pages">
      <CommandItem icon="doc-text" title="Intro" shortcut="⇧⌘I" onSelect={() => go('intro')} />
    </CommandGroup>
  </CommandList>
</CommandMenu>

// 6.0
<CommandMenuDialog open={open} onOpenChange={setOpen}>
  <DialogTrigger shortcut="mod+k" render={<Button variant="secondary" />}>Search…</DialogTrigger>
  <CommandMenuDialogContent aria-label="Search docs">
    <CommandMenu>
      <CommandMenuInput placeholder="Search…" />
      <CommandMenuEmpty />
      <CommandMenuList className="max-h-65">
        <CommandMenuGroup>
          <CommandMenuGroupLabel>Pages</CommandMenuGroupLabel>
          <CommandMenuItem icon="doc-text" title="Intro" trailing={<CommandMenuShortcut shortcut="mod+shift+i" />} onSelect={() => go('intro')} />
        </CommandMenuGroup>
      </CommandMenuList>
    </CommandMenu>
  </CommandMenuDialogContent>
</CommandMenuDialog>
```

| `CommandMenuApi` (5.x) | 6.0 |
| --- | --- |
| `menu.setQuery(q)`, `menu.push(p)`, `menu.pop()` | `controller.setQuery(q)`, `controller.push(p)`, `controller.pop()` |
| `menu.page` (`'root'` at the bottom), `menu.depth` | `useCommandMenu().page` (`null` on the first page), `pages.length` |
| `menu.popTo(p)`, `menu.reset()` | `controller.setPages(pages.slice(0, pages.indexOf(p) + 1))`; `controller.setPages([])` + `controller.setQuery('')` |
| `menu.setActive(v)`, `menu.select(v?)`, `menu.move(delta)` | `controller.setValue(v)`, `controller.run(v?)`; no `move` |
| `menu.close()` | the dialog's controller (`createDialogController()` on `CommandMenuDialog controller`), or set `open` |

## Workspace

[Workspace](https://blamy.github.io/ui/#/workspace).

`Workspace` is a BL UI primitive now (splits are UI SDK's Resizable, tabsets UI SDK's Tabs), not a wrapper over react-resizable-panels, and it can be controlled.

| 5.x | 6.0 |
| --- | --- |
| `WorkspaceModel`, `WorkspaceModelInput` | `WorkspaceLayout`, `WorkspaceLayoutInput` (same shapes) |
| `defaultModel` (required), `onModelChanged(model, meta)` | `defaultLayout` (optional), `onLayoutCommit(layout, details)`; new controlled `layout` + `onLayoutChange(layout, details)` (every change; `details.cancel()` refuses it) |
| `meta.reason` (`set-model`…), `meta.isUserInteraction` (`WorkspaceChangedMeta`, `WorkspaceChangeReason`) | `details.action` (`set`…), `details.reason !== 'imperative'` |
| `workspaceRef`, `WorkspaceImperativeHandle`, `useWorkspaceRef()`, `useWorkspaceCallbackRef()` | `controller={createWorkspaceController()}`, `WorkspaceController`; `getModel` / `setModel` are `getLayout` / `setLayout`, and every write returns `boolean` |
| `useParentWorkspace`, `useParentTabset`, `useParentTabsetState`, `useParentTab`, `useParentTabState` | removed: `renderTabsetToolbar(tabset, state)` and `renderTabContent(tab, { selected, visible, tabsetId })` receive the state; act through your controller with `tabset.id` |
| `renderTab(tab, props)` spreading `props` | `renderTab(tab)` returning `WorkspaceTab` > `WorkspaceTabTrigger` + `WorkspaceTabClose` |
| `WorkspaceTabCloseButton` | `WorkspaceTabClose` |
| `disableDrop` (true rejects) | `accepts(tab, target)` (true allows) |
| `hiddenTabBehavior` | `keepMounted: boolean \| (tab) => boolean` (`'activity'` is not offered) |
| `renderSeparator`, `renderDragPreview`, `resizePreviewMode`, `serverRenderTabContent`, `styles` (`WorkspaceStyles`) | removed: style `classNames.handle`, and the drag copy with `data-drag-preview:` in `classNames.tab` |
| `elementRef`; `classNames.tab` with `data-[tab-selected]:` | `ref`; `data-selected:`. Name the root with `aria-label`. |
| `tabPlacement: 'top' \| 'bottom' \| 'left' \| 'right'` (prop, tabset field, toolbar state), `WorkspaceTabPlacement`, `data-tab-placement` | `tabSide: 'top' \| 'bottom' \| 'start' \| 'end'`, `WorkspaceTabSide`, `data-tab-side`; rename the field in layouts you saved |
| the root drew a `rounded-xl border` card | no frame: add `rounded-card border border-border` where you want one |
| — | New: `presentation: 'auto' \| 'docked' \| 'tabs'` (`auto` shows every tab in one bottom strip while the workspace's own box is compact), `WorkspacePresentation`, root `data-presentation` |

```tsx
// 5.x
<Workspace defaultModel={model} workspaceRef={attach} onModelChanged={onChanged} disableDrop={narrow}
  renderTab={(tab, props) => <div {...props}><span>{tab.title}</span><WorkspaceTabCloseButton /></div>} />

// 6.0
const [ws] = useState(() => createWorkspaceController<TabData>())
<Workspace aria-label="Editor" controller={ws} defaultLayout={model} onLayoutCommit={onCommit}
  accepts={narrow ? () => false : undefined}
  renderTab={(tab) => (
    <WorkspaceTab value={tab.id}>
      <WorkspaceTabTrigger><span className="truncate">{tab.title}</span></WorkspaceTabTrigger>
      <WorkspaceTabClose />
    </WorkspaceTab>
  )} />
```

A controller works only while its Workspace is mounted, and there is no attach callback: run what used to run on attach from a mount effect.

## Containers

The containers UI SDK does not ship (NavigationStack, SplitView, AdaptivePane, Sidebar, List rows) are BL UI primitives now, built from UI SDK's behaviors: every state follows the `x` / `defaultX` / `onXChange(value, details)` shape, each one can be driven from outside with a controller (`createNavigationStackController()`, `createSplitViewController()`…), and each reads its size class from its own box with the kit's `bindSizeClass` instead of measuring pixels, and provides it to what it renders as a size-class scope (see [Size classes follow the container](#size-classes-follow-the-container)). For a shell of your own that only branches on compact, medium or regular, use `useSizeClass()` from `@/lib/container`: it returns `[ref, sizeClass]` and writes `data-size-class` on the element for CSS; wrap its children in `<SizeClassProvider value={sizeClass}>` so `presentation="auto"` popups inside follow it too. Keep `useContainerWidth` / `useContainerSize` for real pixels.

The hooks the 5.x containers were built from are gone, with UI SDK's behaviors, or the kit's own framework-free behaviors built on them, in their place (see [The kit's behaviors](https://blamy.github.io/ui/#/behaviors-kit)):

| 5.x | 6.0 |
| --- | --- |
| `useEdgeSwipe`, `EdgeSwipeConfig` | `bindEdgeSwipe(el, options)` from `@/lib/edge-swipe` (`BindEdgeSwipeOptions`) |
| `usePullToRefresh` | `bindPullToRefresh(scroller, options)` from `@/lib/pull-to-refresh`, or `NavigationStackContent onRefresh` |
| `useBackHistory`, `armBackHistory` | `bindBack(el, { onBack })` from `@/lib/back` |
| `useScrollHidden` | `useChromeHidden()` from `@/lib/theme`; for floating chrome, `useHideOnScroll(hideOnScroll, scrollRef)` from `@/lib/scroll-edge` |
| `useSheetDrag`, `SHEET_TAP_SLOP`, `SHEET_MINIMIZE_TRAVEL`, `SheetDragOptions`, `SheetDragState` | a `Drawer` with `snapPoints`, `modalAbove`, `DrawerHandle` and `--drawer-progress` (see `floating-sheet.tsx`); any other vertical drag is `bindDrag` from `@ui-sdk/core` |
| `useDrawerSwipe` | UI SDK's Drawer swipes shut on its own; AdaptivePane's `swipeToOpen` opens it |
| `navigationPush` | removed |
| `useControllableState(value, defaultValue, onChange)` → `onChange(next)` | `useControllableChange<T, Reason>(value, defaultValue, onChange)` → `onChange(next, details)`; the setter takes `(next, { reason, event })` and returns whether it happened (`false` for the same value or a cancel) |
| `useTitleFlight(ref)` (registry) | `createTitleFlight(container, { parts, committed })` → `{ fly, end, destroy }`; it follows a swipe by itself |

## NavigationStack

[NavigationStack](https://blamy.github.io/ui/#/navigation-stack).

The `screens` array of descriptors is gone. A stack is a list of page keys (`pages` / `defaultPages` / `onPagesChange(pages, details)`), and each page is a `NavigationStackPage` child built from parts. `onPagesChange` replaces `onPop`: it gets the shorter list when a page pops (`details.reason` is `trigger-press` for the back button, `escape-key`, `back` for the platform back, `swipe` or `imperative`), and `details.cancel()` keeps the page.

| 5.x | 6.0 |
| --- | --- |
| `screens={Screen[]}` | `pages={keys}` (bottom to top) + one `<NavigationStackPage value={key}>` child per page; or `defaultPages` + `controller` |
| `onPop()` | `onPagesChange(pages, details)`: `(p) => setPath(p.slice(1))`, or `(p) => { if (p.length === 1) setSel(null) }` |
| `Screen.key` | `NavigationStackPage value` |
| `Screen.title` | `<NavigationStackBar><NavigationStackTitle>…</NavigationStackTitle></NavigationStackBar>`; the title also names the next page's back button |
| `Screen.largeTitle: true` | `<NavigationStackLargeTitle />` first inside `NavigationStackContent` (its text defaults to the Title) |
| `Screen.titleOnScroll: true` | `<NavigationStackTitle showOnScroll>` |
| `Screen.subheader` | `<NavigationStackSubheader>` after the large title |
| `Screen.content` | children of `<NavigationStackContent>` (the page's scroller) |
| `Screen.leading`, `Screen.trailing` | `<NavigationStackLeading>`, `<NavigationStackTrailing>` inside the Bar (leading still hides while there is a back button) |
| `Screen.overlay` | any other child of the page, after the Bar and Content |
| `Screen.grouped` | `NavigationStackPage variant="grouped"` (`'plain' \| 'grouped'`) |
| `Screen.hideChromeOnScroll: false` | `<NavigationStackBar hideOnScroll={false}>` |
| `Screen.onRefresh` | `<NavigationStackContent onRefresh>` (touch only now; `controller.refresh()` runs it from a button or key) |
| `Screen.maxW`, `Screen.bottomInset` | `<NavigationStackContent maxWidth bottomInset>` |
| `NavigationStack defIns` | `bottomInset` (the default for every page) |
| `rootBack={{ title, onPress }}` | `rootBack={{ title, onClick }}` |
| `Screen`, `ScreenWrap`, `ScreenWrapProps` | removed: return `<NavigationStackPage>` elements from your own components |
| — | New: `createNavigationStackController()` (`push`, `pop`, `popTo`, `replace`, `refresh`, `getPages`), `useNavigationStack()` (the same methods inside a page; it throws outside a stack), `NavigationStackBack`, `onBarHiddenChange`, `renderPage(key)` (draws a page that has no child of its own), `resetKey` (back to the first page when it changes) |
| `safeTop` (a number or a CSS length) | `safeTop` in px (a number) |
| `[data-slot=screen]`, `data-screen-key`, `data-screen-label` | `[data-slot=navigation-stack-page]`, `data-value`; the label is the text of `[data-slot=navigation-stack-title]` |
| back button `button.bl-btn` | `[data-slot=navigation-stack-back]`. Pages carry `data-covered` (and `inert`) under the top, `data-starting-style` / `data-ending-style` as they push and pop, `data-swiping` and `--stack-progress` during an edge swipe, and `data-scrolled`; the bar `data-hidden` |

```tsx
// 5.x
const screens: Screen[] = [
  { key: 'list', title: 'Contacts', largeTitle: true, subheader: <SearchInput />, content: <Rows onPress={setSel} /> },
]
if (sel) screens.push({ key: 'detail', title: sel.name, titleOnScroll: true, grouped: true,
  trailing: <Button>Edit</Button>, content: <Detail c={sel} /> })
<NavigationStack screens={screens} onPop={() => setSel(null)} />

// 6.0
<NavigationStack pages={sel ? ['list', 'detail'] : ['list']}
  onPagesChange={(pages) => { if (pages.length === 1) setSel(null) }}>
  <NavigationStackPage value="list">
    <NavigationStackBar><NavigationStackTitle>Contacts</NavigationStackTitle></NavigationStackBar>
    <NavigationStackContent>
      <NavigationStackLargeTitle />
      <NavigationStackSubheader><SearchInput /></NavigationStackSubheader>
      <Rows onClick={setSel} />
    </NavigationStackContent>
  </NavigationStackPage>
  {sel ? (
    <NavigationStackPage value="detail" variant="grouped">
      <NavigationStackBar>
        <NavigationStackTitle showOnScroll>{sel.name}</NavigationStackTitle>
        <NavigationStackTrailing><Button>Edit</Button></NavigationStackTrailing>
      </NavigationStackBar>
      <NavigationStackContent><Detail c={sel} /></NavigationStackContent>
    </NavigationStackPage>
  ) : null}
</NavigationStack>
```

Rendering a page only while it is in `pages` is fine: a page you stop rendering as it pops stays on screen until it has slid out. Pages must be direct children of the stack (fragments and arrays are fine); a component of your own works as a page if it is the direct child, takes `value` and renders a `NavigationStackPage`. For a drill-down, keep the path and map it: `<NavigationStack pages={['root', ...path]} onPagesChange={(p) => setPath(p.slice(1))}>`.

To push from inside a page, `useNavigationStack().push('detail', { reason: 'trigger-press', event })`. With neither `pages` nor `defaultPages`, a stack starts on its first page child. In a collapsed SplitView column the first page gets a back button to the previous column by itself, so a hand-made `leading` back button there can go (`rootBack={false}` turns it off).

Escape now goes through UI SDK's layers: popups inside a page close first, the innermost stack pops next, and the first page leaves Escape alone. A push focuses the new page; a pop returns focus to what pushed it.

## SplitView

[SplitView](https://blamy.github.io/ui/#/split-view).

Every state on the root is a UI SDK value now, and the split view no longer measures pixels (the layout is CSS). `onSizeClassChange` is not called on mount: start from your own default, or read `useSplitView()` inside.

| 5.x | 6.0 |
| --- | --- |
| `widthClass`, `onWidthClassChange`, `SplitViewWidthClass` | `sizeClass`, `onSizeClassChange` (not on mount), `SplitViewSizeClass` |
| `breakpoints: { medium, regular }` | the same, each optional |
| `selection` / `defaultSelection` / `onSelectionChange(selection)`, `SplitViewSelection` | `value` / `defaultValue` / `onValueChange(value, details)` (`details.column` says which column), `SplitViewValue` |
| `sidebarVisible` / `onSidebarVisibleChange(visible)` | `sidebarOpen` / `onSidebarOpenChange(open, details)` |
| `defaultSidebarVisible={x}` and `sidebarVisibility={{ medium }}` | `defaultSidebarOpen={x}` or `defaultSidebarOpen={{ regular: x, medium }}` |
| `defaultCompactColumn`, `onCompactColumnChange(column)` | also controlled `compactColumn`; `onCompactColumnChange(column, details)` |
| `supplementaryVisible` / `defaultSupplementaryVisible` / `onSupplementaryVisibleChange` | `supplementaryOpen` / `defaultSupplementaryOpen` / `onSupplementaryOpenChange(open, details)` |
| — | New: `columnWidths` / `defaultColumnWidths` / `onColumnWidthsChange(widths, details)` (once a divider is let go), `controller={createSplitViewController()}`; `className` and `style` may be functions of state |
| `useSplitView()` `.widthClass`, `.selection`, `.sidebarVisible`, `.setSidebarVisible`, `.supplementaryVisible`, `.setSupplementaryVisible`, `.topColumn`, `.widths` | `.sizeClass`, `.value`, `.sidebarOpen`, `.setSidebarOpen`, `.supplementaryOpen`, `.setSupplementaryOpen`, `.compactColumn`, `.columnWidths` |
| `useSplitView().width` | removed: measure your own element with `useContainerWidth` |
| `select`, `show`, `back`, `toggleSidebar`, `setColumnWidth` | the same; each takes `{ reason, event }` last and returns whether it happened |
| `SplitViewItem id`, `subtitle`, `badge` | `value`, `description`, `trailing` (the row anatomy); new `disabled` (arrows skip it) and `render` |
| `SplitViewItem onPress` (after the select) | `onClick(event)`, before the select; `event.preventDefault()` stops it |
| `SplitViewItem` wrapped in `HoverCardTrigger` + `HoverCard` | `SplitViewItem preview={…}` |
| `SplitViewSection expanded` / `defaultExpanded` / `onExpandedChange` | `open` / `defaultOpen` / `onOpenChange(open, details)` (UI SDK Collapsible) |
| `SplitViewStack` in a column, `onDepthChange(depth)`, `useSplitViewStack().push(node)` | a `NavigationStack` in the column (`onPagesChange(pages, details)`, `useNavigationStack().push(key)`, `renderPage`, `resetKey`); its first page gets the back button to the previous column when collapsed (see [the table above](#components-that-merged-moved-or-were-renamed)) |
| `SplitViewHeader`/`SplitViewContent` on a pushed stack page | `NavigationStackBar` (+ `Leading`, `Title`, `Trailing`) and `NavigationStackContent` (+ `LargeTitle`) |
| `SplitViewHeader titleOnScroll`, `titleAlign="leading"` | `showOnScroll`, `titleAlign="start"`; the back button is always named "Back to <title>" |
| `SplitViewEmpty` | `EmptyState` from `@/components/ui/empty-state` (its title is now semibold foreground) |
| `useSplitView().isSelected(column, id)` | `isCurrent(column, value)` |
| root `data-width-class`, `data-sidebar-visible`; item `data-split-item` and its `selected` state; stack `data-split-stack-can-pop`, page `data-top` | root `data-size-class`, `data-sidebar-open`; item `data-slot="split-view-item"` with `data-current` (`group-data-current/item:`) and `aria-current`; a column's `className` and `style` land on the column's `<section>`; the stack is a NavigationStack (`data-can-pop`, pages `data-covered`) |

```tsx
// 5.x
<SplitView aria-label="Reminders" selection={selection} onSelectionChange={setSelection}
  sidebarVisibility={{ medium: true }} sidebarVisible={sidebar} onSidebarVisibleChange={setSidebar}
  onWidthClassChange={(wc) => setCompact(wc === 'compact')}>
  <HoverCardTrigger className="flex w-full">
    <SplitViewItem id={id} title={l.title} onPress={pick(l)} />
    <HoverCard placement="end top"><ListCard l={l} /></HoverCard>
  </HoverCardTrigger>
  <SplitViewSection title="Chats" collapsible defaultExpanded onExpandedChange={setOpen}>…</SplitViewSection>
</SplitView>

// 6.0
<SplitView aria-label="Reminders" value={selection} onValueChange={setSelection}
  defaultSidebarOpen={{ medium: true }} sidebarOpen={sidebar} onSidebarOpenChange={setSidebar}
  onSizeClassChange={(sc) => setCompact(sc === 'compact')}>
  <SplitViewItem value={id} title={l.title} onClick={pick(l)} preview={<ListCard l={l} />} />
  <SplitViewSection title="Chats" collapsible defaultOpen onOpenChange={(open) => setOpen(open)}>…</SplitViewSection>
</SplitView>
```

## Credenza: now the Dialog flow

[Dialog](https://blamy.github.io/ui/#/dialog), section "Credenza: the responsive dialog".

`Credenza` is gone. What it did is what `Dialog` does now: `presentation="auto"` by default (a centered card when the nearest size-class scope is medium or regular, a sheet you drag down to dismiss when it is compact), and a `view` on the root, with `DialogView`, `DialogBack` and a travelling `DialogTitle`, for a flow that steps between screens. `DialogContent variant="tray"` is Credenza's floating tray in the sheet presentation, and `DialogHeader variant="bar"` its back / title / × row. `BLProvider` is a scope, and so are the containers inside it (a SplitView column, a NavigationStack, a SidebarProvider), so a Credenza that used to get `compact={…}` from one of them can leave `presentation` out, with or without a trigger; outside every scope "auto" falls back to a phone media query. Pass `presentation` when `compact` came from something else.

| 5.x | 6.0 |
| --- | --- |
| `<Credenza>` | `<Dialog>` (`view`, `presentation`, `dismissible`, `open`, `onOpenChange`, `controller`) |
| `onClose()` | `onOpenChange(open, details)`; reasons `escape-key`, `outside-press`, `close-press`, `swipe`, `imperative` |
| `compact={bool}` | `presentation={bool ? 'sheet' : 'dialog'}`, or leave it out to follow the size class |
| `isDismissable={false}` | `dismissible={false}`: Escape, the backdrop and the swipe are refused (`onDismissAttempt` runs) and the × is left out |
| `title` | `<DialogTitle>` in a `<DialogHeader variant="bar">`; with no title, name `DialogContent` with `aria-label` |
| `canBack` + `onBack` | `<DialogBack hidden={!canBack} onClick={onBack} />`, first in the header |
| the built-in × | `<DialogClose />`, last in the header; with children or `render` it is any closing element |
| the built-in scrim | `<DialogBackdrop />`, the root's first child |
| children | children of `<DialogView>`, which springs the height and slides between `view`s (the leaving step is `inert`) |
| `className`, `style` on the card (`[data-slot=credenza]`) | on `DialogContent variant="tray"` (`[data-slot=dialog-content]`, `data-presentation="dialog" \| "sheet"`); style the tray with `data-[presentation=sheet]:` |
| `data-autofocus` | `autoFocus` on the control, or `initialFocus` on `DialogContent` |
| `credenzaVariants({ compact })` | `dialogVariants({ size, variant })` |
| — | New: `DialogTrigger`, `createDialogController`; Sheet takes the same `view` flow (`SheetHeader variant="bar"`, `SheetBack`, `SheetView`) |

```tsx
// 5.x
<Credenza open={!!dialog} onClose={() => setDialog(null)} compact={compact}
  isDismissable={view !== 'deleting'} view={view} title={TITLES[view]}
  canBack={view === 'tracker'} onBack={() => setDialog('settings')} className="bg-muted">
  <div className="px-4 pt-1 pb-4">…</div>
  <Button variant="secondary" onPress={() => setDialog(null)}>Cancel</Button>
</Credenza>

// 6.0
<Dialog open={!!dialog} onOpenChange={(open) => { if (!open) setDialog(null) }}
  presentation={compact ? 'sheet' : 'dialog'} dismissible={view !== 'deleting'} view={view}>
  <DialogBackdrop />
  <DialogContent variant="tray" className="bg-muted">
    <DialogHeader variant="bar">
      <DialogBack hidden={view !== 'tracker'} onClick={() => setDialog('settings')} />
      <DialogTitle>{TITLES[view]}</DialogTitle>
      <DialogClose />
    </DialogHeader>
    <DialogView>
      <div className="px-4 pt-1 pb-4">…</div>
      <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
    </DialogView>
  </DialogContent>
</Dialog>
```

It is a real modal now: focus moves in whenever it opens (also when it mounts open), Tab stays inside, the rest of the layer host is inert, and focus goes back to the trigger. Pass `initialFocus="none"` on `DialogContent` to leave focus where it is. Escape is `preventDefault()`ed rather than stopped, so a window key listener behind it should skip `event.defaultPrevented` keys. Every `Dialog` now follows the size class: a plain dialog of yours that must stay a centered card on a phone takes `presentation="dialog"`.

## FloatingSheet, FloatingChat and ArtifactChatContainer

[FloatingSheet](https://blamy.github.io/ui/#/floating-sheet), [ArtifactChatContainer](https://blamy.github.io/ui/#/artifact-chat-container) (FloatingChat and ChatColumn are its floating and docked layouts now).

The sheet is a bottom UI SDK Drawer in its own layer host, with snap points at the peek, each stop and full height. At the peek the page stays usable; above it the sheet is modal to its own box (Tab stays in the sheet, and the scrim dims and catches presses). Its contents never remount between stops. `FloatingChat` is gone: the floating chat is `ArtifactChatContainer presentation="floating"`, whose floating layer is a `FloatingSheet` (the kit has one engine for "peek, grow, fold into a button"), and `ChatColumn` is the container's docked column.

| 5.x | 6.0 |
| --- | --- |
| `onOpenChange(open)` | `onOpenChange(open, details)`; reasons `swipe`, `handle-press`, `handle-key`, `escape-key`, `outside-press`, `imperative` (Escape and a scrim press can be canceled) |
| `onDismiss()` | `onVisibleChange(visible, details)` (and `defaultVisible`); `onVisibleChange={(v) => { if (!v) close() }}` |
| `dismissible`, `minimizable` | `collapse: 'fab' \| 'hide' \| 'none'` (default `fab`): `dismissible` is `collapse="hide"`, `minimizable={false}` is `collapse="none"`; new controlled `minimized` / `defaultMinimized` / `onMinimizedChange(minimized, details)` |
| `detents`, `label` | `snapPoints` (the same values), `aria-label` (it names the sheet, `role="dialog"`) |
| `appearance: 'glass' \| 'sheet'`, `tone: 'auto' \| 'dark' \| 'light'` | `variant: 'glass' \| 'card'` (the old `'sheet'` look is `'card'`), `appearance: 'auto' \| 'light' \| 'dark'` (`auto` mixes the material from the page's own tokens) |
| `fabPosition` (eight corners and edges), `fabIcon` | `<FloatingSheetFab side align>{icon}</FloatingSheetFab>`: `side: 'top' \| 'bottom' \| 'start' \| 'end'`, `align: 'start' \| 'center' \| 'end'` (the FAB button itself; `aria-label` names it) |
| `FloatingSheet.Body`, `.Foot`, `.Fab`, `.Context`, `.useFloatingSheet` | `FloatingSheetBody`, `FloatingSheetFooter`, `FloatingSheetFab`, `useFloatingSheet()`; Body and Footer render where they are written (Body first) |
| `useFloatingSheet().progress` live on every drag frame | the resting stop (0 at the peek, 1 full); style live effects off the `--fs-grown` variable on `[data-slot=floating-sheet-surface]`. `setOpen(open, given?)` and `setMinimized(m, given?)` go through the change callbacks |
| cap `[data-slot=floating-sheet-cap]` | UI SDK's `DrawerHandle` (`[data-slot=drawer-handle]`, "Expand" / "Collapse"): a press steps to the next stop, arrow keys, Home and End move between stops |
| scrim `[data-slot=floating-sheet-scrim]` | `[data-slot=drawer-backdrop]` |
| FAB `[data-slot=floating-sheet-fab]`, morphed from the surface | a separate button named "Open " + the sheet's name, hooked by `[data-floating-sheet-fab]`, `inert` until the sheet folds |
| `floatingSheetSurfaceVariants({ placement })` | `floatingSheetSurfaceVariants({ variant, hidden })`, `floatingSheetFabVariants({ variant, side, align })`, `floatingSheetVariants()` |
| root variables `--ck-sheet-height`, `-width`, `-reveal`, `-radius`, `-grown`, `-minimize`, `-gutter`, `-dock-height`, `-scrim-opacity`… | removed; the surface reads UI SDK's `--drawer-progress` (`--fs-grown`, `--fs-extent`, `--fs-gutter`, `--fs-radius`). The body height, alpha, shadow and divider variables stay, on the surface. |
| root `data-dragging`, `data-appearance="glass"`, `data-tone` | `data-dragging` on the surface; `data-variant`, and `data-appearance` only for an explicit appearance |
| Escape on `document` | UI SDK's Escape, with focus in the sheet; it collapses to the peek |
| `useHideOnScroll` from `@/components/ui/floating-sheet` | from `@/lib/scroll-edge` (the barrel name is unchanged) |

```tsx
// 5.x
<FloatingSheet dismissible visible={dockOpen} onDismiss={() => setDockOpen(false)} onOpenChange={setOpen} label="Dock" />

// 6.0
<FloatingSheet collapse="hide" visible={dockOpen} onVisibleChange={(v) => { if (!v) setDockOpen(false) }} onOpenChange={setOpen} aria-label="Dock" />
```

| 5.x | 6.0 |
| --- | --- |
| `<FloatingChat>` over a page | `<ArtifactChatContainer presentation="floating">` (or `presentation="auto"`, which floats below `breakpoints.medium` and docks above it) |
| `<ChatColumn>`, `ChatColumnTranscript`, `ChatColumnComposer` | the container's docked layout: an `aside` named by `chatLabel` (default "Chat"); for a column of your own, `Conversation` |
| `ArtifactChatContainer.Content`, `.Chat`, `.Composer` | `ArtifactChatContainerContent`, `ArtifactChatContainerChat`, `ArtifactChatContainerComposer` (real parts: Chat and Composer render into the docks). The docks pad the composer: drop your own padding |
| `chatOpen` / `defaultChatOpen` / `onChatOpenChange` | `open` / `defaultOpen` / `onOpenChange(open, details)` (FloatingSheet's reasons) |
| `onMinimizedChange(minimized)` | `onMinimizedChange(minimized, details)` (`swipe`, `trigger-press`, `imperative`); new controlled `minimized` / `defaultMinimized` |
| `onComposingChange(composing)`, `onAdd` | `composing` / `onComposingChange(composing, details)` (`trigger-press` for the working status, `handle-press` or `swipe` when opening the chat brings the composer back, `imperative`); `onAdd` is `onComposingChange(true, { reason: 'trigger-press' })` |
| `chatSide: 'left' \| 'right'`, `fabPosition`, `appearance: 'glass' \| 'sheet'`, `tone` | `chatSide: 'start' \| 'end'`, `fabSide` + `fabAlign`, `variant`, `appearance: 'auto' \| 'light' \| 'dark'` (`auto` really follows the page; it was dark glass) |
| `ArtifactChatContainer.Context`, `.useContainer`, `useArtifactChatContainer().width`, `.compact`, `.chatOpen`, `.setChatOpen` | `useArtifactChatContainer()`: `.sizeClass`, `.presentation === 'floating'`, `.open`, `.setOpen(open, given?)`, `.composing`, `.minimized` |
| root `data-layout="compact"`; the content was a `<main>` | `data-presentation="floating" \| "split"`; a `div` (pass `role="main"` when it is the page's main) |
| an open chat as a separate layer with a focusable "Close" scrim | the FloatingSheet's layer: Escape and a press outside bring it to rest, and the scrim is decorative |
| — | New: `chatLabel`, `gutter` (12), `fabIcon`, `artifactChatContainerVariants` in the barrel; the root takes every `div` prop and `ref` |

## SideDrawer, EdgeDrawer and AdaptivePane

[AdaptivePane](https://blamy.github.io/ui/#/adaptive-pane) (SideDrawer is its `push` and `drawer` presentations), [Sheet](https://blamy.github.io/ui/#/sheet), section "Contained, and the panel look" (for EdgeDrawer).

`SideDrawer` is gone: it is an `AdaptivePane` on the `end` side. `EdgeDrawer` is gone too: it is a `<Sheet contained>` (the layer host of Sheet, which keeps the sheet inside its parent's box) with `SheetContent variant="panel"`. AdaptivePane's overlay presentations are UI SDK's Drawer, contained in their host: focus moves in and is trapped, Escape and a press on the scrim close, a swipe toward the edge closes, and focus goes back. Its children render once and move between presentations without remounting. While a page is pushed, the host's other children are `inert`.

| Module | 5.x | 6.0 |
| --- | --- | --- |
| `side-drawer` → `adaptive-pane` | `<SideDrawer>` | `<AdaptivePane side="end">` |
| `adaptive-pane` | SideDrawer `mode: 'fixed' \| 'overlay'` + `compact`; AdaptivePane `mode`, `AdaptivePaneMode` | `presentation: 'column' \| 'drawer' \| 'push' \| 'cover' \| 'hidden' \| 'auto'` (default `auto`), `AdaptivePanePresentation`; root `data-presentation` |
| `adaptive-pane` | SideDrawer `mode="fixed"`; `mode="overlay"` (pushed on a compact host); `mode="overlay" compact={false}`; `compact` | `presentation="column"`; leave it out (`auto`: a column in a regular scope, a drawer in a medium one, a pushed page in a compact one); `presentation="drawer"`; `presentation="push"` |
| `adaptive-pane` | SideDrawer `compactBreakpoint` | removed: `auto` reads the size-class scope |
| `adaptive-pane` | SideDrawer `title`, its × and the push back button, `backLabel` | `<AdaptivePaneHeader><AdaptivePaneTitle>…</AdaptivePaneTitle><AdaptivePaneClose backLabel="…" /></AdaptivePaneHeader>`: × in a column, drawer or cover, "‹ backLabel" while pushed; the title names the pane unless you pass `aria-label` |
| `adaptive-pane` | `open` (required), `onClose()`; `open` read only by the drawer | `open` / `defaultOpen` / `onOpenChange(open, details)` / `controller`; `open` means shown in every presentation (a closed column leaves the layout), so a column hidden with `presentation="hidden"` now passes `open={false}`. Reasons `close-press`, `escape-key`, `outside-press`, `swipe`, `back`, `imperative` |
| `adaptive-pane` | SideDrawer `width`; AdaptivePane `onResize(width, mode)` on every move | `columnWidth` / `drawerWidth` (a number or a CSS length; the drawer defaults to `20rem`); `widths` / `defaultWidths` / `onWidthsChange({ column, drawer }, details)` once a resize settles |
| `adaptive-pane` | `maxWidth: number \| string` | `maxWidth: number` (caps resizes); the drawer is capped at 85% (a `max-w-*` class changes it) |
| `adaptive-pane` | `onOpen` (turned on the edge strip) | `swipeToOpen`; the open arrives as `onOpenChange(true, { reason: 'swipe' })`. It opens past a third of the host's width, or sooner with a flick |
| `adaptive-pane` | `swipe` | unchanged: `swipe={false}` keeps the drawer from following a drag shut; `dismissible={false}` turns off every dismissal |
| `adaptive-pane` | `scrimClassName`, `scrim`, `shadow`; `columnClassName` / `columnStyle` beside `className` / `style` | removed (the scrim is `bg-overlay`, one panel shadow); one `className` / `style` on the pane in every presentation, or a function of `{ presentation, open, side }` |
| `adaptive-pane` | `side: 'left' \| 'right'` (default `left`) | `side: 'start' \| 'end'` only (UI SDK's logical sides, which follow the reading direction); the default is `start` |
| `adaptive-pane` | `hidden` unmounted the children | children stay mounted, off the page |
| `adaptive-pane` | `sideDrawerVariants`, `sideDrawerPageClass`, `--side-drawer-under`, slots `side-drawer-panel`, `-bar`, `-back`, `-close` | removed; `adaptivePanePageClass`, `--adaptive-pane-under`, `data-adaptive-pane-swiping` / `-settling`; slots `adaptive-pane-page`, `adaptive-pane-header`, `adaptive-pane-close` |
| `adaptive-pane` | — | New: `createAdaptivePaneController()`, `aria-label`, `dismissible`, `modal` |
| `edge-drawer` → `sheet` | `<EdgeDrawer side open onOpenChange aria-label>` (host `[data-slot=edge-drawer-host]`) | `<Sheet contained side open onOpenChange>` + `<SheetBackdrop />` + `<SheetContent variant="panel" aria-label>` (host `[data-slot=sheet-host]`, `data-variant="panel"` on the content) |
| `sheet` | EdgeDrawer `width`, `maxWidth`, `shadow`, `className`, `style`; `zIndex`; `scrimClassName` | `SheetContent className` / `style` (the panel defaults to `w-80 max-w-[85%]`); the `--sheet-z` variable on the parent (default 30); `SheetBackdrop className` (default `bg-overlay`) |
| `sheet` | EdgeDrawer `swipe={false}` | `SheetContent swipe={false}` (any variant) |

```tsx
// 5.x
<SideDrawer mode={wide ? 'fixed' : 'overlay'} open={open} onClose={() => setOpen(false)} title="Info">…</SideDrawer>
<AdaptivePane mode={mode} open={open} onClose={() => setOpen(false)} onOpen={() => setOpen(true)}
  resizable onResize={(w, m) => save(m, w)} maxWidth="84%">…</AdaptivePane>
<EdgeDrawer side="left" open={open} onOpenChange={setOpen} aria-label="Menu" zIndex={20}>…</EdgeDrawer>

// 6.0
<AdaptivePane side="end" presentation={wide ? 'column' : 'auto'} open={open} onOpenChange={setOpen}>
  <AdaptivePaneHeader><AdaptivePaneTitle>Info</AdaptivePaneTitle><AdaptivePaneClose /></AdaptivePaneHeader>
  …
</AdaptivePane>
<AdaptivePane presentation={mode} open={open} onOpenChange={setOpen} swipeToOpen
  resizable onWidthsChange={(widths) => save(widths)} className="max-w-[84%]">…</AdaptivePane>
<Sheet contained side="start" open={open} onOpenChange={setOpen}>
  <SheetBackdrop />
  <SheetContent variant="panel" aria-label="Menu">…</SheetContent>
</Sheet>
```

## Sidebar

[Sidebar](https://blamy.github.io/ui/#/sidebar).

`SidebarProvider` can be controlled now (`open`, `onOpenChange(open, details)`, `controller`), and `breakpoints` (`{ medium, regular }`, default 640 / 1024, as SplitView's) are its size class's breakpoints. Crossing it resets `open` through `onOpenChange` with reason `content-resize`, which you can cancel. The provider is a size-class scope, and `Sidebar presentation="auto"` (the default) is a drawer while it is compact: the drawer is AdaptivePane's, contained in the provider. The parts are flat exports now, every part takes its element's props (`className`, `style`, `ref`, `aria-*`), and the row props follow the kit's row anatomy.

| 5.x | 6.0 |
| --- | --- |
| `useSidebar().narrow` | `.sizeClass === 'compact'` (the context carries the size class only, as the shells' do) |
| `setOpen((o) => !o)` | `toggle()`, or `setOpen(!open)`: `setOpen` takes a boolean and returns whether it happened |
| `onClick={toggle}` | `onClick={() => toggle()}` (`toggle` takes options, not an event) |
| `SBCtx`, `SBCollapsedCtx` | removed; `useSidebarCollapsed()` |
| `Sidebar.Header`, `.Content`, `.Footer`, `.Workspace`, `.Search`, `.Section`, `.Item` | `SidebarHeader`, `SidebarContent` (a `nav` landmark, `aria-label` default "Sidebar"), `SidebarFooter`, `SidebarAccount`, `SidebarSearch`, `SidebarSection` (a `group` named by its title), `SidebarItem` |
| `Sidebar variant="overlay"` | `presentation="drawer"`; `variant` is only the look (`docked`, `rail`, `float`), and `presentation="column"` keeps a column at every width |
| `SidebarItem onPress`, `SidebarSearch onPress` | `onClick`. In a drawer, pressing an item closes the drawer after `onClick` (reason `action`) unless it calls `event.preventDefault()` |
| `SidebarItem label`, `active`, `tone`, `badge` | `title`, `current` (writes `aria-current="page"`), `tint` (a CSS color), `trailing` (a number or string is drawn as a small tinted `Badge`); new `description`, `disabled`, `render={<a href />}` |
| `SidebarItem icon="inbox"` (a `SIDEBAR_ICONS` key) | `icon="tray"`: an `IconName` or any node. `home` → `house`, `inbox` → `tray`, `box` → `cube`, `cal` → `calendar`, `user` → `person-bust`, `code` → `branch` or `terminal`, `search` → `magnifyingglass` |
| `Sidebar.Workspace name detail initial` | `SidebarAccount` `title`, `description`, `icon` (any node; the default tile is the title's first letter) |
| `SidebarSearch` with a fixed `/` chip and no key, placeholder "Quick search" | `shortcut="/"` binds the key and draws the keycap; placeholder "Search" |
| `SidebarTrigger` (react-aria Button) | the primitive's trigger part: any button props, `render`, `aria-label` (default "Toggle sidebar"), `aria-expanded`, `shortcut` |
| `SidebarNav`, `SidebarNavProps`, `SIDEBAR_ICONS` | removed: they were demo compositions (now in the `split-view-demos` block) |
| `Sidebar` | also takes `aria-label` (the drawer's name, default "Sidebar"); children no longer remount when the variant or size class changes |
| — | New: `createSidebarController()` (`isOpen`, `setOpen`, `toggle`), `sidebarItemVariants`, `SidebarPresentation`, `SidebarState` |

```tsx
// 5.x
const { narrow, setOpen, toggle } = useSidebar()
<button onClick={toggle}>…</button>
<Sidebar variant="overlay">
  <Sidebar.Content>
    <Sidebar.Item icon="home" label="Home" badge={3} active onPress={() => { go('home'); if (narrow) setOpen(false) }} />
  </Sidebar.Content>
</Sidebar>

// 6.0
const { toggle } = useSidebar()
<button onClick={() => toggle()}>…</button>
<Sidebar presentation="drawer">
  <SidebarContent>
    <SidebarItem icon="house" title="Home" trailing={3} current onClick={() => go('home')} />
  </SidebarContent>
</Sidebar>
```

## Lists

[Lists](https://blamy.github.io/ui/#/lists), [IndexBar](https://blamy.github.io/ui/#/index-bar), [TraceTimeline](https://blamy.github.io/ui/#/trace-timeline), [MessageScroller](https://blamy.github.io/ui/#/message-scroller), [Conversation](https://blamy.github.io/ui/#/conversation). ArtifactChatContainer is in [its own section](#floatingsheet-floatingchat-and-artifactchatcontainer).

Swipe actions are UI SDK's `createSwipeActions` and reordering is `createReorder`, so both move the way UI SDK's do from the keyboard.

| Module | 5.x | 6.0 |
| --- | --- | --- |
| `list` | `List.Section`, `List.Row` | `ListSection`, `ListRow` (flat exports); all three parts take `ref` and their element's props |
| `list` | `List inset` | `List variant="inset"` (`'plain' \| 'inset'`, `listVariants`); new `density` (`compact` / `default` / `comfortable`: 36 / 46 / 56px rows) and `emptyState` |
| `list` | `ListRow leading`, `subtitle`, `selected`, `destructive`, `center`, `edit` | `icon`, `description`, `current`, `tone="destructive"`, `justify="center"`, `editing` (a boolean); new `disabled` |
| `list` | `ListRow onDelete` | `endActions={[{ label: 'Delete', destructive: true, onAction }]}` |
| `list` | `ListRow onPress` | `onClick(event, details)` |
| `list` | `ListRow rowRole="option"` | removed: a list whose rows are chosen is a `Listbox`; a row that only shows the chosen value is `current`, or `accessory="check" checked` (both set `aria-current`) |
| `list` | `ListSection innerRef` | `ref` |
| `list` | `ListSection onReorder(from, to)` | `onOrderChange(order, details)`: `order` is the rows' keys in their new order; `details.from` and `details.to` are the indexes |
| `list` | a grip moved its row on ↑ / ↓ | Space or Enter picks the row up, ↑ ↓ Home End move it, Space or Enter drops it, Esc puts it back; each move is announced |
| `list` | → showed the trailing actions, ← the leading ones | ← shows the trailing actions and → the leading ones (the way a swipe moves the row) |
| `list` | `ListRowAction.onAction()` | `onAction(details)` with `reason` `action-press`, `full-swipe` or `delete-key` |
| `list` | one open row at a time across every list | an open row closes on any press outside it |
| `list` | — | New: `ListRow controller={createListRowController()}` (`show('start' \| 'end')`, `close()`) |
| `list` | rows directly in the section; buttons `[data-row-action]`, grip `[data-row-grip]` | each row wrapped in `[data-slot=list-section-item]` inside `[data-slot=list-section-rows]` (a `list`); buttons `[data-slot=list-row-action]`, grip `[data-slot=list-section-handle]`; actions `[data-slot=list-row-actions][data-side=start \| end]` |
| `index-bar` | `avail`, `onLetter(key)`, the exported `AL` | `items={indexBarAlphabetItems(available)}` (`items` is required) and `onJump` |
| `index-bar` | `onJump(key, point, index)` | `onJump(value, details)` (items take `value`, not `key`): `details` has `index`, `item`, `reason` (`drag`, `list-navigation`, `item-press`, `imperative`) and `event`; keys stop at either end, PageUp and PageDown work; options are `[data-slot=index-bar-option]` with `data-highlighted` |
| `index-bar` | `side: 'left' \| 'right'`, `label`, `top` / `bottom` / `width`, `value`, item `dim` | `side: 'start' \| 'end'` (default `end`), `aria-label`, classes on the rail (`className="top-14 bottom-2"`), `current` (`aria-current`), item `disabled` (`aria-disabled`, still reachable) |
| `trace-timeline` | `label`, `top`, `bottom`, `railWidth`, `renderPreview`, `previewLines`, `previewWidth` | `aria-label` (default "Timeline"), classes on the rail, a `<TraceTimelinePreview lines width>{(time, stop) => …}</TraceTimelinePreview>` child; Alt+↑ / ↓ move between lanes, `[` / `]` between requests |
| `message-scroller` | `items={[{ id, anchor, node }]}`, type `MessageScrollerItem` | `MessageScrollerItem value anchor` children (a component; items may be nested), `MessageScrollerItemProps`; new `aria-label`, `ref`, `--message-column-width` / `--message-gutter` |
| `message-scroller` | `data-anchor="1"`; jump button `[data-slot=message-scroller-jump]` | `data-anchor=""`; `[data-slot=message-scroller-jump]` is the wrapper (`data-open` / `data-closed`), the button `[data-slot=message-scroller-jump-button]` |
| `conversation` | `Suggestion onPress` | `ConversationSuggestion onClick`; it is the kit's `Button variant="outline" size="sm"` (`ConversationSuggestionProps` are Button's), so `[data-slot=suggestion]` is `[data-slot=button]` |
| `conversation` | `WorkLog defaultOpen` | `ConversationWorkLog`: also `open` / `onOpenChange(open, details)` |
| `conversation` | `ConversationGreeting` | `ConversationEmpty title description icon action headingLevel` (it draws the kit's `EmptyState`; the title is an `h2`) |
| `conversation` | `UserMessage images: string[]`; `ToolCall detail` | `ConversationUserMessage attachments: ComposerAttachment[]` (what `Composer onSubmit` hands you); `ConversationToolCall description` |
| `conversation` | `ConversationMessages` sniffed its children's types | `ConversationUserMessage` and `ConversationAssistantMessage` are scroller items (`value`, `anchor`), so a wrapped one still anchors |
| `conversation` | `SettledBanner` | removed (it was a block's; it lives in `t3-clone`) |

```tsx
// 5.x
<ListSection animate onReorder={editing ? (from, to) => setSongs(move(songs, from, to)) : undefined}>
  {songs.map((s) => <ListRow key={s.id} title={s.title} onPress={() => play(s)} />)}
</ListSection>
{tones.map((t) => <ListRow key={t} title={t} accessory="check" checked={tone === t} rowRole="option" onPress={() => setTone(t)} />)}

// 6.0
<ListSection animate onOrderChange={editing ? (_, { from, to }) => setSongs(move(songs, from, to)) : undefined}>
  {songs.map((s) => <ListRow key={s.id} title={s.title} onClick={() => play(s)} />)}
</ListSection>
<Listbox aria-label="Ringtone" value={tone} onValueChange={setTone}>
  {tones.map((t) => <ListboxItem key={t} value={t}>{t}</ListboxItem>)}
</Listbox>
```

Ordering by key reads better when your rows have ids: `onOrderChange={(order) => setSongs(order.map((id) => byId[id]))}`. A test that pressed ArrowDown on a grip now presses Space, ArrowDown, Space; one that pressed ArrowRight to open trailing actions presses ArrowLeft.

## Composer

[Composer](https://blamy.github.io/ui/#/composer), [PencilKit](https://blamy.github.io/ui/#/pencilkit) (for the image annotator).

The Composer's parts are the kit's own now: its buttons are the kit's `Button`, its option pills `ComposerPill`, its select a `DropdownMenu` with the kit's small radio rows, its popovers `PopoverContent palette="trigger"`, and the add button and the drop zone are UI SDK's FileInput. The barrel lists what a caller needs (64 names, from 92), and the image annotator moved to PencilKit.

| 5.x | 6.0 |
| --- | --- |
| `ComposerButton` (`variant="ghost"`, `primary`, `destructive`), `composerButtonVariants` | the kit's `Button`: an icon tool is `variant="quiet" size="icon-sm"`; send and stop are their own parts |
| `ComposerButton variant="pill"` + `ComposerPillLabel icon` | for a picker: `ComposerPill icon` with the label as children (the chevron and the label morph are built in), the trigger of `ComposerSelect` and of pickers of your own; for a plain action: `Button variant="quiet" size="sm"` |
| `tint` on ComposerButton, ComposerSelect, ComposerAdd | `className="text-primary"` (`tint` is a CSS color everywhere else) |
| `ComposerStop`, `ComposerFab` `onPress`, `isDisabled` | `onClick`, `disabled`, `render`; ComposerAdd, ComposerSend and ComposerStop take no `size` or `variant` (ComposerStop keeps `variant: 'ring' \| 'solid'`) |
| `ComposerSelect options={[{ id, label }]} onChange(id)` | `items={[{ value, label, disabled? }]}`, `onValueChange(value, details)` (first; `details.cancel()` keeps the pill's value); new `disabled`, `open` / `defaultOpen` / `onOpenChange`, `side` / `align`, `ref`. `ComposerSelectOption` is `ComposerSelectItem`; `menuClassName` is gone (compose a `DropdownMenu` and a `ComposerPill` for more) |
| `<ComposerMenuItem id="x" textValue="X">X</ComposerMenuItem>`, `composerMenuItemVariants` | `<DropdownMenuRadioItem value="x">X</DropdownMenuRadioItem>` inside a `DropdownMenuRadioGroup` in a `DropdownMenuContent size="sm"` |
| `WbPopover` (a styled surface) | `<PopoverContent variant="plain" palette="trigger">` inside a `Popover`: `palette="trigger"` paints it from the trigger's theme scope |
| `Composer onValueChange(markdown)`, `onAttachmentsChange(attachments)`, `onExpandedChange(expanded)`, `onCollapsedChange(collapsed)` | the same with `details` second (`reason`, `event`, `source`, `cancel()`); they run before the state moves, so `details.cancel()` keeps an uncontrolled value |
| `Composer fabPosition` | `fabAlign` (`start` / `center` / `end`; `data-fab-align`) |
| `Composer annotator`, `annotateCanvas`, `ComposerAnnotatorProvider annotator` | `annotator` takes an `ImageAnnotatorEngine` (or `null`); pass an engine instead of `annotateCanvas`; `ImageAnnotatorProvider engine` |
| — | New: `Composer disabled` (also `useComposer().disabled`, `data-disabled`) |
| `ComposerBump onOpenChange(open)`, `onMinimizedChange(minimized)`, `inset` | `onOpenChange(open, details)` (`press`, `drag`, `escape-key`, `imperative`), `gutter`; `minimizable` / `minimized` / `onMinimizedChange`, `bounds`, `onProgressChange` are gone (ArtifactChatContainer on FloatingSheet folds a chat into a FAB) |
| `ComposerQueue onItemsChange(items)`, `actions.edit()` / `sendNow()` / `remove()` | `onItemsChange(items, details)` (`queue`, `send`, `edit`, `remove`); the actions take the triggering event: `actions.remove(event.nativeEvent)` |
| `useComposer().setValue(md)`, `addAttachment(a)`, `removeAttachment(id)`, `setExpanded(x)`, `setCollapsed(x)` | the same, with an optional `{ reason, event }` second (third for `updateAttachment`); each returns `false` when the change was canceled |
| file sizes "84 KB" (1024-based), `formatFileSize` from `@/components/ui/composer/composer-files` | the kit's `formatFileSize` from `@/lib/file-size`: decimal units in the reader's locale, "86 kB", "1.3 MB" (FileUpload, RequestTable and the SQL console write sizes the same way) |
| `ComposerAdd allowsMultiple`, `acceptDirectory`, `defaultCamera`, `onPress` | `multiple`, `directory`, `capture="user" \| "environment" \| true`, `onClick` (runs before the picker opens) |
| `ComposerAttach accept="image/*,.pdf"`, `ComposerAttachProps` | `<ComposerAdd icon="paperclip-diagonal" aria-label="Attach files" accept={['image/*', '.pdf']} />` |
| the hidden "Attach files: drop or paste here" button | removed: drop on the card, use the + button, or paste with focus anywhere in the card |
| drop overlay mounted only while hovered, `data-state` | always mounted and hidden; `data-dragging` while files hover |
| `ComposerBumpProgress.settling` while a spring wrote `progress` every frame | `progress` and `reveal` jump to the rest value on release; `settling` is true while the bump's CSS transition runs. Drive your own transitions off `dragging` alone. |
| `useComposerBump().handleProps` | not public: `ComposerBumpHandle` is the handle, style it with classes |
| `[data-slot=composer-send]`, `-stop`, `-attachment-open`, `-menu-item`, `-bump-grip` | `[data-state=send]` (or the button's name), the button named "Stop", `[data-attachment-open]`, `[data-slot=menu-radio-item]`, `[data-bump-grip]` |
| `AnnotateLightbox src onClose onSave(dataUrl)`, open while mounted, `[data-slot=annotate-lightbox]` | `ImageAnnotator` (PencilKit), with UI SDK's open API: `open` / `defaultOpen` / `onOpenChange(open, details)`, `onOpenChangeComplete(open)`, `onSave(dataUrl, details)`, `engine`. Cancel closes with `close-press`, Save with `action` after `onSave`, plus `escape-key` and `outside-press`; `details.cancel()` keeps it open. Unmount it from `onOpenChangeComplete(false)` so the exit plays. It is the dialog named "Annotate image", or "Annotate: {alt}" with an `alt` (the Composer passes the file name) |
| `ComposerAnnotator`, `ComposerAnnotatorProps`, `ComposerAnnotatorSurface`, `useComposerAnnotator` | `ImageAnnotatorEngine`, `ImageAnnotatorEngineProps`, `ImageAnnotatorSurface`, `useImageAnnotatorEngine` (from `@/components/ui/pencilkit/image-annotator`) |
| `ComposerSeparator` a `<span role="separator" data-slot="composer-separator">` | the kit's `Separator orientation="vertical"` (`data-slot="separator"`) |
| an open bump's Escape on `document` | the bump is a UI SDK layer, so a menu opened from it closes first |

```tsx
// 5.x
<ComposerSelect aria-label="Effort" options={efforts} value={effort} onChange={setEffort} tint />
<ComposerAdd allowsMultiple={false} acceptDirectory defaultCamera="environment" onPress={track} />
<ComposerAttach accept="image/*,.pdf" />
<ComposerButton variant="pill" onPress={stopServer} isDisabled={!running}>Stop</ComposerButton>
<ComposerButton aria-label="Context" onPress={openContext}><Icon name="doc" /></ComposerButton>

// 6.0
<ComposerSelect aria-label="Effort" items={efforts.map((e) => ({ value: e.id, label: e.label }))} value={effort} onValueChange={(value) => setEffort(value)} className="text-primary" />
<ComposerAdd multiple={false} directory capture="environment" onClick={track} />
<ComposerAdd icon="paperclip-diagonal" aria-label="Attach files" accept={['image/*', '.pdf']} />
<Button variant="quiet" size="sm" onClick={stopServer} disabled={!running}>Stop</Button>
<Button variant="quiet" size="icon-sm" aria-label="Context" onClick={openContext}><Icon name="doc" /></Button>
```

```tsx
// 5.x
{shot ? <AnnotateLightbox src={shot} onClose={() => setShot(null)} onSave={(png) => { save(png); setShot(null) }} /> : null}

// 6.0
<ImageAnnotator src={shot} open={open} onOpenChange={setOpen} onSave={(png) => save(png)}
  onOpenChangeComplete={(o) => { if (!o) setShot(null) }} />
```

## Filter and font picker

[Filter](https://blamy.github.io/ui/#/filter) (with FilterInput), [FontPicker](https://blamy.github.io/ui/#/font-picker).

| Module | 5.x | 6.0 |
| --- | --- | --- |
| `filter` | `onValueChange(filters)`, `onMatchChange(match)` | the same with `details` (`reason` `add`, `update`, `remove`, `clear`, `apply`, `imperative`; `item-press` for the match) |
| `filter` | an uncontrolled bar moved, then told you; nothing could refuse | `onValueChange` / `onMatchChange` run first with UI SDK's change details (`reason`, `event`, `source`, `cancel()`); `details.cancel()` keeps an uncontrolled bar as it was. `useFilters()`'s `setFilters`, `add`, `update`, `remove`, `clear` return whether the change went through. |
| `filter` | `[data-slot=filter-announcer]` live region | UI SDK's `announce()` (one page region, `[data-ui-sdk-announcer]`; announcements are deferred, so tests `waitFor` them) |
| `filter` | `FilterMenu children` = your trigger element | `render={<Button … />}` is the trigger, `children` its content |
| `filter` | `FilterMenu label="Add"` | `children` (they replace the icon and "Filter") |
| `filter` | `FilterMenu isOpen`, `placement="bottom end"`, `hotkey`, `popoverClassName` | `open`, `onOpenChange(open, details)`, `side` / `align`, `shortcut`, `contentProps={{ className }}` |
| `filter` | `FilterBar` / `FilterToolbar` `hotkey`, `showMatch` | removed: compose the toolbar's children, `<FilterToolbar><FilterMenu shortcut="f" /><FilterList /><FilterMatch /><FilterClear /></FilterToolbar>` (the default children are still Menu, List, Clear) |
| `filter` | `FilterChip onChange(filter, options?)`, `tone="preview"`; `FilterValueEditor onChange(value, options?)` | `onValueChange(filter, details)` (in a bar it runs first, and `details.cancel()` keeps the bar), `variant="preview"`; `onValueChange(value, details)` |
| `filter` | `filterBarVariants`, `filterToolbarVariants`, `filterInputVariants` | removed (they had no variants) |
| `filter` | `FilterToolbar` = react-aria Toolbar; `FilterClear isDisabled` | the kit's `Toolbar` (UI SDK's: `orientation`, `loop`, `controller`); `disabled`. `FilterMatch` takes button props (`FilterMatchProps`) |
| `filter` | `[data-slot=filter-menu-trigger]`, `filter-menu`, `filter-toolbar` | `[data-filter-trigger]`, `popover-content`, `toolbar` |
| `filter` | search fields `role="searchbox"`; the field list named "Fields" | `role="combobox"`; the list is named by its search ("Filter by"). Tests type with `fireEvent.input`. |
| `font-picker` | `value` (required) + `onChange` on `FontPicker`, `FontList`, `FontStackPicker` | `value` / `defaultValue` / `onValueChange(value, details)` |
| `font-picker` | one `FontPicker` with `size`, `placement`, `className`, `triggerProps` | parts: `FontPicker` (the value, `preview`, `open` / `defaultOpen` / `onOpenChange`, `presentation`, `disabled`, `aria-label`) + `FontPickerTrigger` (`size` `sm` / `default` / `lg`, `className`, the trigger's props) + `FontPickerContent` (`side`, `align`); with no children it renders both |
| `font-picker` | `isDisabled`, `placement="bottom start"` | `disabled` on the root, `side="bottom" align="start"` on `FontPickerContent` (and on `FontStackPickerContent`; the stack's `size` is on `FontStackPickerInputGroup`) |
| `font-picker` | `fontPickerTriggerVariants`, `fontListItemVariants` | removed: the trigger is `selectTriggerVariants`, and the list rows are CommandMenu items |
| `font-picker` | category filter `role="radio"`, `data-selected` | `ToggleGroup` buttons (`aria-pressed`, `data-pressed`) |
| `font-picker` | the stack's chips are grid rows | a `list` of `listitem` chips, each with a sortable handle: drag it, or Space, arrows, Space; Delete or Backspace on a handle removes the font |
| `font-picker` | rows `data-hovered`, `data-focused` | `data-highlighted` |
| `font-picker` | `onValueChange` after the value moved | `onValueChange(value, details)` first, with UI SDK's change details; `details.cancel()` keeps the value (and keeps the picker open) |

```tsx
// 5.x
<FilterMenu fields={fields} state={state} hotkey="g">
  <Button variant="secondary" size="sm" aria-keyshortcuts="G"><Icon name="plus" />Add filter</Button>
</FilterMenu>
<FontPicker aria-label="Font" value={font} onChange={setFont} placement="left top" />

// 6.0
<FilterMenu fields={fields} state={state} shortcut="g" render={<Button variant="secondary" size="sm" />}>
  <Icon name="plus" />Add filter
</FilterMenu>
<FontPicker aria-label="Font" value={font} onValueChange={setFont}>
  <FontPickerTrigger />
  <FontPickerContent side="start" align="start" />
</FontPicker>
```

## Other components

[CodeEditor](https://blamy.github.io/ui/#/code-editor), [CronEditor](https://blamy.github.io/ui/#/cron-editor), [DebugToolbar](https://blamy.github.io/ui/#/debug-toolbar), [Toolbar](https://blamy.github.io/ui/#/toolbar) (was EditBar), [Sign in with Tailscale](https://blamy.github.io/ui/#/tailscale), [Spinner](https://blamy.github.io/ui/#/spinner), [ProgressRing](https://blamy.github.io/ui/#/progress-ring), [ProgressStepper](https://blamy.github.io/ui/#/progress-stepper), [Morph](https://blamy.github.io/ui/#/morph), [Swap](https://blamy.github.io/ui/#/swap), [Canvas](https://blamy.github.io/ui/#/canvas), [VideoPreview](https://blamy.github.io/ui/#/video-preview), [VideoTimeline](https://blamy.github.io/ui/#/video-timeline), [Waveform](https://blamy.github.io/ui/#/waveform), [Terminal](https://blamy.github.io/ui/#/terminal), [MarkdownEditor](https://blamy.github.io/ui/#/markdown-editor), [OpenCode](https://blamy.github.io/ui/#/open-code), and the Docstream parts ([ReplayPreview](https://blamy.github.io/ui/#/replay-preview), [TuiPreview](https://blamy.github.io/ui/#/tui-preview), [StlViewer](https://blamy.github.io/ui/#/stl-viewer), [StrudelPlayer](https://blamy.github.io/ui/#/strudel-player)).

| Module | 5.x | 6.0 |
| --- | --- | --- |
| `code-editor` | `onLineNumberPress`, `isLineNumberPressable`, `lineNumberLabel`, `lineNumberTitle` (also on `CodeEditorWindow`) | one object: `lineNumbers={{ onClick, clickable, label, title, side }}` (`CodeEditorLineNumbers`). `CodeEditorWindow` is CodeEditor's private renderer now (`lib/code-editor-window`) |
| `code-editor` | `scrollToLine` prop, `contentClassName` | `revealLine` (the handle keeps `scrollToLine()`); a class on `<CodeEditorContent>` |
| `code-editor` | gutter `onPress`, `isPressable`; marker `onPress`, `isActive` | gutter `onClick`, `clickable`; marker `onClick`, `pressed` (`aria-pressed`, `data-pressed`) |
| `code-editor` | `[data-slot=code-editor-marker]`, `code-editor-gutter-cell`, `code-editor-copy` on pressable cells and the copy button | UI SDK's `[data-slot=button]`; select cells with `[data-code-editor-cell="marker"]` (or the gutter id) |
| `code-editor` | `CodeEditorCopyButton` react-aria Button props, `label`, `onCopy(value)` | the kit's `Button` (`variant="quiet" size="icon-sm"` unless you pass others): `onClick`, `disabled`, `aria-label` (default "Copy code"), `onValueCopy(value)` |
| `code-editor` | `onChange(value, change)`, `onEdit(change)`, `CodeEditorChange` with `origin` (`input`, …) | `onValueChange(value, details)`, `onEdit(details)`: `CodeEditorValueChangeDetails`, UI SDK's change details (`reason`, `event`, `source`, `cancel()`) plus `from` / `to` / `newTo` / `text` / `removed`. `origin` is `reason`, and `input` is `input-change`. `cancel()` takes an edit back in an editor without `value` |
| `code-editor` | `onSelectionChange(selection)` | `onSelectionChange(selection, details)`, `details.reason` `press` / `drag` / `caret-move` / `select-all` / `escape-key` / an edit's / `imperative` |
| `code-editor` | gutter `onClick(lineNumber)`, `onLineNumberClick(lineNumber)`, marker `onClick(marker)` | `onClick(event, details)` (gutters, and `lineNumbers.onClick`) with UI SDK's button details plus `details.line`; a marker's adds `details.marker`. A gutter whose cells hold controls of their own takes `focusable(lineNumber)` |
| `syntax-highlighting` | `SyntaxHighlighting`, `SyntaxHighlightingHeader` / `Title` / `CopyButton` / `Content`, `syntaxHighlightingVariants`, `useSyntaxHighlighting`, `SyntaxLineRange` (and the `syntax-highlighting` registry item) | removed: `<CodeEditor readOnly value={code} …>` with `CodeEditorHeader` / `Title` / `CopyButton` / `Content` (`CodeEditorContent value`, not `code`), `codeEditorVariants`, `useCodeEditor()` (`getValue()` for the text), `CodeLineRange`. Slots are `code-editor*`. |
| `qr-svg` → `qr-code` | `QRSvg seed`, `title`, `color`, an optional `value` | `QRCode value` (required), `aria-label`, a `text-*` class (the modules are `currentColor`), `onError` for text too long to encode; the matrix type is `QRMatrix` |
| `utils` | `EASE` | removed: the `ease-ios` utility (`cubic-bezier(.32,.72,0,1)`) in CSS, or the spring tokens in `lib/motion.ts` |
| `cron-editor` | `isDisabled`; preset chips `data-selected` | `disabled`; chips are Toggles (`data-pressed`) in a UI SDK `ToggleGroup` named "Presets" (one Tab stop, ← →; disabled chips have `aria-disabled`) |
| `cron-editor` | `onValueChange(expression)` | `onValueChange(expression, details)`: `reason` `input-change` / `item-press` / `clear-press` / `reset` / `imperative`; `details.cancel()` refuses an uncontrolled change |
| `cron-editor` | `from`, `debounceMs` | `reference`, `parse={{ debounceMs }}`; in plain-language mode the expression shows below with an "Edit expression" disclosure, and a hidden input always submits it |
| `video-preview` | `PlaybackControls`, `PlaybackTimecode` (`[data-slot=playback-controls]`, a row of Buttons) | `VideoPreviewControls` (the kit's `Toolbar` named "Playback", `size` default `sm`: one Tab stop, ← → between the buttons), `VideoPreviewTimecode` (`[data-slot=video-preview-timecode]`) |
| `video-preview`, `video-timeline` | `clock` | `playback` (one clock shared by several components) |
| `debug-toolbar` | a group of Buttons (`[data-slot=debug-toolbar]`), its own dark slab and gripper; `size="compact"` | a preset of the kit's `Toolbar` (`variant` default `floating`, `size` `sm` / `default` / `lg`, one Tab stop, ← → between actions; a disabled action stays focusable with `aria-disabled`); `DebugToolbarButton` and `debugToolbarActions` for a row of your own. The labels are VS Code's ("Step into", "Reverse continue") |
| `edit-bar` → `toolbar` | `EditBar count allFav onFav onDelete` | a composition on `<Toolbar variant="bar">` (`ToolbarButton`, `ToolbarText aria-live="polite"`); see [the table above](#components-that-merged-moved-or-were-renamed) |
| `tailscale-login-button` → `tailscale-controls` | react-aria Button props (`isDisabled`), its own recipe; `[data-slot=tailscale-login-button]` | the kit's `Button` (`variant` default `contrast`, 36px; `disabled`, `render`); select it by `[data-status]` or its name |
| `morph` | `dragToDismiss` moved the element with a transform | it uses the CSS `translate` property (`--morph-drag-y`), so a `translate-*` class of yours conflicts with the drag; `data-dragging` while held |
| `morph` | `<Morph as="button" type="button">`, `id` (the shared-layout key) | `<Morph render={<button type="button" />}>`, as on UI SDK parts (the element's props go under Morph's and the class names merge); `layoutId` (`id` is the DOM id again) |
| `number-morph`, `text-morph` | NumberMorph `locales`, `role="img"`; TextMorph `display: contents` at rest | `locale` and screen-reader text; TextMorph is `inline-block` (so `truncate` applies) |
| `motion` | `useMotion()` (the framer-motion module), `loadMotion()` | removed: `import { motion, AnimatePresence } from 'framer-motion'`; delete `loadMotion()` calls (it did nothing) |
| `motion` | — | New: `usePresence(present)`, `usePresenceList(items, keyOf)`, `useEnterExit(ref, present)` from `@/lib/presence`, which keep an element mounted through its exit on UI SDK's `animateIn` / `animateOut` (see [The kit's behaviors](https://blamy.github.io/ui/#/behaviors-kit)) |
| `icon-swap`, `animated-height` → `swap` | `IconSwap id` and `ContentSwap id` on framer's `AnimatePresence` | `<Swap effect="pop" value>` and `<Swap value>` (`effect="slide"`) from `@/components/ui/swap`, on the kit's presence with CSS on `data-starting-style` / `data-ending-style`; slots `swap` and `swap-view` (the leaving view is `aria-hidden` and `inert`). `Chevron` is in `@/lib/icon` (`sw` → `strokeWidth`) |
| `spinner` | `spin`, `variant`, `SpinnerVariant`, animations `beacon`, `cells`, `register`, `bands` | it animates unless `paused`; `pattern` (typed by `animation`), `SpinnerPattern`; `bars`, `merge`, `encode`, `scan`. A Spinner takes `label` or `aria-label` |
| `progress-ring` | `size="md"`; CountdownRing `warnAt`, `warnColor`, `labelSize` | `size="default"`; `urgentAt`, `urgentTint` (`data-urgent`), removed. `showValue` needs 40px or more. Progress gains a `warning` tone |
| `progress-stepper` | `steps` of type `ProgressStep`; states `done`, `active`, `todo` | `steps` of `ProgressStepperStep` (or `ProgressStepperItem` part children: `ProgressStepperItemIcon`, `ProgressStepperItemTrack`, `ProgressStepperItemLabel`, `ProgressStepperItemDescription`); `complete`, `current`, `upcoming` |
| `canvas` | `camera` / `defaultCamera` / `onCameraChange(camera)`, `Camera { x, y, z }` | `viewport` / `defaultViewport` / `onViewportChange(viewport, details)`, UI SDK's `Viewport { x, y, zoom }` (every `.z` becomes `.zoom`); reasons `wheel`, `drag`, `pinch`, `zoom-key`, `move-key`, `focus-in`, `find-in-page`, `track-press`, `imperative` |
| `canvas` | `zoomAt`, `fitCamera`, `clampZoom`, `MIN_ZOOM`, `MAX_ZOOM` from `canvas-math`; `useCanvas().camera` / `update(fn)` | `controller` from `createCanvasController()` (`zoomBy(k, at?)`, `zoomTo`, `fit(rect?, { padding })`, `reveal`, `panBy`, `setViewport`, `toCanvas`, `visible`), the same on `useCanvas()`; `minZoom` / `maxZoom` props (0.02 / 4); `toBoard` and `toScreen` take a `Viewport` |
| `canvas` | `onCanvasPointerDown/Move/Up(e: React.PointerEvent, info)`, `onCanvasDoubleClick(e: React.MouseEvent, info)`, `info.camera` | DOM events (`PointerEvent`, `MouseEvent`; `e.currentTarget` isn't the canvas: use `info.screen`), `info.viewport` |
| `canvas` | ⌘ + − 0 1 zoom | also plain + − 0, arrow keys you don't `preventDefault()` pan (Shift ×4), focusing a board item reveals it, find in page pans; zoom keys announce. The board is inside a `[data-slot=canvas-pane]`: read the viewport, not the board's `transform`. |
| `canvas` | `cursor`; `CanvasMiniMap position="bottom-right"` | a class or `style={{ cursor }}` (grabbing wins while the view drags); `side` + `align` (`side="top" align="start"`). New: `useCanvas().addPointerLayer(layer)`, `ref`; `useCanvas().toLocal(p)` puts a board point in the canvas's own px (`useCanvas().toScreen(p)` is the controller's: client px) |
| `trace-timeline` | `onValueChange(time, { phase, stop })` | `onValueChange(time, details)` with UI SDK's change details plus `stop`: `phase: 'start'` is `reason: 'track-press'`, `'move'` is `'drag'`, a key is `'step-key'`, Escape during a scrub is `'escape-key'` (back to where it began) |
| `trace-timeline` | `phase: 'end'` | `onValueCommit(time, details)`, once per release, key, Escape or pinch take-back. `TraceValueInfo` is `TraceValueChangeDetails`, `TraceValueCommitDetails`, `TraceValueChangeReason`. |
| `trace-timeline` | `onViewChange(view)` | `onViewChange(view, details)`, `details.reason` `wheel` / `pinch` / `zoom-key` / `double-press` / `drag` / `playhead` / `range-change` / `imperative`; `cancel()` keeps the view |
| `trace-timeline` | `onFocusLane(laneKey)`, `onSelectThread(threadId, laneKey)`, `onSelectRequest(id)` | `focusedLane` / `defaultFocusedLane` / `onFocusedLaneChange(lane, details)`, `selectedThread` / `defaultSelectedThread` / `onSelectedThreadChange(thread, details)` (the lane is `details.lane`), `selectedRequest` / `defaultSelectedRequest` / `onSelectedRequestChange(request, details)` |
| `video-timeline` | track toggles `data-selected` | `data-pressed`; Escape during a clip drag cancels it. New: `headerWidth` (56 in a compact container, with a per-track menu), and the playhead is the `--color-playhead` token |
| `video-timeline` | `timeline`, `onChange(timeline)` (no `onChange`: read-only) | `value` / `defaultValue`, `onValueChange(value, details)` with `details.id` and `details.action` (`move` / `resize` / `delete` / `track`); `readOnly` |
| `video-timeline` | `selection` / `defaultSelection` / `onSelectionChange(ids)`; `onZoomChange(zoom)` | `selectedClips` / `defaultSelectedClips` / `onSelectedClipsChange(ids, details)`; `onZoomChange(zoom, details)` |
| `video-timeline` | `onDropMedia(mediaId, drop)` | `onDropMedia(mediaId, details)`: `TimelineDropDetails`, UI SDK's change details (`reason: 'drop'`) with `trackId`, `time` and `index`; `cancel()` refuses the drop |
| `video-timeline` | every clip a Tab stop; ⇧←/→ nudged a clip a second; the ruler's Page Up/Down moved ten seconds | the clips are one Tab stop (⌥ + arrows move between them, Home/End along a track); ⇧←/→ trims the end, ⌥⇧←/→ the start, ↑/↓ change track; the ruler (UI SDK `Slider`) moves a second with ⇧ or Page Up/Down |
| `waveform` | `tone="primary"` | `className="text-primary"`; tones `default`, `muted`, `success`, `warning`, `destructive`; `ref` |
| `terminal` | `size: 'sm' \| 'md'` (default `md`) | `size: 'sm' \| 'default'` (default `default`) |
| `markdown-editor` | `invalid`, `onKeyDown` / `onPaste` returning a boolean, `onFocus()` / `onBlur()`, `contentClassName`, `forwardRef` | a `Field` around it; `handleKeyDown` / `handlePaste` (ProseMirror's names); `onEditorFocus(event)` / `onEditorBlur(event)` (`onFocus` / `onBlur` are React's, on the root); `classNames.content`; `ref` as a prop. The default look is the shared field surface |
| `open-code` | `height` (a number), `theme: 'light' \| 'dark'`, `rounded-none border-0` to drop the card | size it with a class (`className="h-[620px]"`), `appearance` (default: the nearest ThemeScope's), `variant="plain"` (`openCodeVariants`) |
| `workbench-theme` | `<WorkbenchTheme appearance tint>`, `useWorkbenchAppearance()`, `WorkbenchAppearanceProvider` | `<ThemeScope scope="workbench" appearance tint>` (its popups wear the scope too), `useScopeAppearance('workbench')` or `useThemeScope()?.appearance` |
| `markdown-view` | `FbMd`, `HlPre`, `hlTokens`, `DocstreamRefContext` | removed. `MarkdownView` takes its root's `div` props and `ref`, and writes `data-streaming` |
| `replay-preview`, `tui-preview`, `stl-viewer`, `strudel-player` | the parsers, helpers and demo data of each Docstream widget, re-exported by the kit (`parseStl`, `isTuiCodeBlock`, `getReplayMarkers`, `parseStrudel`…), and the `strudel-rack` and `strudel-syntax` modules | one thin module per widget that re-exports the component, its props and handle types and the functions that drive it; import the rest from `@brett_lamy/ui/docstream/replay`, `/tui`, `/stl` and `/strudel` (see [the table above](#components-that-merged-moved-or-were-renamed)) |

```tsx
// 5.x
const gutters = [{ id: 'bp', width: 16, onPress: toggle, isPressable: canBreak, render: dot }]
const markers = (line) => sites(line).map((column) => ({ column, label: `Break at ${column}`, isActive: on(line, column), onPress: () => flip(line, column) }))
<CodeEditor readOnly lines={lines} gutters={gutters} markers={markers} onLineNumberPress={jump} isLineNumberPressable={ran} />

// 6.0
const gutters = [{ id: 'bp', width: 16, onClick: toggle, clickable: canBreak, render: dot }]
const markers = (line) => sites(line).map((column) => ({ column, label: `Break at ${column}`, pressed: on(line, column), onClick: () => flip(line, column) }))
<CodeEditor readOnly lines={lines} gutters={gutters} markers={markers} lineNumbers={{ onClick: jump, clickable: ran }} />
```

```tsx
// 5.x
const [camera, setCamera] = useState<Camera>({ x: 0, y: 0, z: 1 })
<Canvas camera={camera} onCameraChange={setCamera} />
<Button onClick={() => setCamera(fitCamera(unionRect(rects), size))}>Fit</Button>
<TraceTimeline value={t} onValueChange={(t, { phase }) => { setT(t); if (phase === 'end') video.seek(t) }} />

// 6.0
const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 })
const [canvas] = useState(() => createCanvasController())
<Canvas controller={canvas} viewport={viewport} onViewportChange={setViewport} />
<Button onClick={() => canvas.fit(unionRect(rects))}>Fit</Button>
<TraceTimeline value={t} onValueChange={(t) => setT(t)} onValueCommit={(t) => video.seek(t)} />
```

## New in 6.0

Nothing here replaces something you have; each page says what it is for and when to use a sibling instead.

| What | Where |
| --- | --- |
| [Diagram](https://blamy.github.io/ui/#/diagram): nodes, edges and regions on a Canvas, from plain data; read-only, or an editor with selection, connecting, undo, a controller and agent actions. ELK lays it out when asked (an optional peer) | `@brett_lamy/ui/diagram`, root |
| [DiagramFrame](https://blamy.github.io/ui/#/diagram-frame): a board with a panel beside it, a drawer, or a page pushed over it, from the frame's own size class | `@brett_lamy/ui/diagram-frame`, root |
| [StateDiagram](https://blamy.github.io/ui/#/state-diagram): an XState machine drawn, simulated and edited (`xstate`, an optional peer) | `@brett_lamy/ui/state-diagram`, root |
| [CloudflareDiagram](https://blamy.github.io/ui/#/cloudflare-diagram): a system of Cloudflare's services, from a catalog, `wrangler.jsonc` or a workerd config; and the [Cloudflare Studio](https://blamy.github.io/ui/#/blocks) block | `@brett_lamy/ui/cloudflare` only (not the root, so no other import reaches the catalog) |
| [DataTable](https://blamy.github.io/ui/#/data-table): the virtualized table under RequestTable and the SQL console's results | `@brett_lamy/ui/data-table`, root |
| [Toolbar](https://blamy.github.io/ui/#/toolbar): one tab stop for a row of controls, floating or as the iOS bottom bar; `ToolbarToggle` for a tool that stays on (MarkdownEditor's format buttons) | `@brett_lamy/ui/toolbar`, root |
| [EmptyState](https://blamy.github.io/ui/#/empty-state): what every `emptyState` shows by default | `@brett_lamy/ui/empty-state`, root |
| [Swap](https://blamy.github.io/ui/#/swap): content that changes in place, by sliding or popping | `@brett_lamy/ui/swap`, root |
| [Field](https://blamy.github.io/ui/#/field), [Listbox](https://blamy.github.io/ui/#/listbox), [SearchInput](https://blamy.github.io/ui/#/search-input), [DateInput](https://blamy.github.io/ui/#/date-input), [NaturalTimeInput](https://blamy.github.io/ui/#/natural-time-input), [QRCode](https://blamy.github.io/ui/#/qr-code): the modules that replace TextField, ListBox, SearchField, DateField, TimeInput and QRSvg, with new APIs | their own entries, root |
| `AlertDialog` and `createConfirm()`, on the [Dialog](https://blamy.github.io/ui/#/dialog) page; `AvatarGroup` in a module of its own | `@brett_lamy/ui/dialog`, `@brett_lamy/ui/avatar-group`, root |
| Controllers for every stateful component (`createDialogController()`, `createTreeController()`…), and agent actions on every primitive ([Agent-ready components](https://blamy.github.io/ui/#/agent-ready)) | with each component |
| The behaviors the containers are built from, documented for parts of your own: [Behaviors](https://blamy.github.io/ui/#/behaviors) and [The kit's behaviors](https://blamy.github.io/ui/#/behaviors-kit) | `@ui-sdk/core`, `@/lib/<behavior>` |

The 5.x docs pages on react-aria's hooks (`aria-hooks`, `aria-press`, `aria-focus`…) are gone with react-aria; the Behaviors pages cover what UI SDK offers in their place. The old `docstream` page is [MarkdownView](https://blamy.github.io/ui/#/markdown-view)'s, and `#/docstream` is now docstream's own documentation.

## What looks different

6.0 was checked story by story against 5.16 screenshots. The first table is what changed because UI SDK does something differently on purpose, or because a behavior fix changed what is drawn. The second is the look the 6.0 design pass changed on purpose, so that the merged components share one surface, one radius, one focus ring and one set of heights; if a screenshot test of yours moves there, re-baseline it.

| Where | 5.16 | 6.0 |
| --- | --- | --- |
| Date and time fields | `9/9/2026` | Zero-padded segments: `09/09/2026` |
| Color fields and pickers | Uppercase hex | Lowercase hex; the hue track and thumb are painted for the current color |
| Slider range value | `20–80` | `20 – 80` (UI SDK's format) |
| File sizes (FileUpload, Composer, RequestTable, SQL console) | Binary units: `612 KB`, `84 KB` | One formatter, `formatFileSize`: decimal units in the reader's locale, `280 B`, `627 kB`, `86 kB` |
| A dialog, alert or sheet rendered open | No focus ring until a key is pressed | Focus lands on its first control, with a ring |
| Combobox | Matches from the start of an option | Matches anywhere in it |
| Command menu | Ranked results | Results keep their written order; the inline Esc hint says "Clear" |
| Command palette in a framed app | Offset from the page | Offset from the frame it is in |
| Shortcut keycaps (menus, tooltips, the command menu) | `⌘⇧O` | Apple's order: `⇧⌘O` |
| Segmented control and toggle group, dark | Indicator hidden behind the panel | Indicator visible, in its token color |
| Form radio rows | 12px label gap | The Field's 6px label gap |
| Rejected files in FileUpload | In drop order | Listed after the accepted ones |
| Disabled Calendar | Value hidden | Value shown, dimmed |
| Markdown editor task checkboxes | Square | Round (docstream-editor 2.0) |
| Chat transcripts and LogList markers | Up to 2px (transcripts) or about 40px (markers) off | Exactly at the bottom, exactly centered |
| SQL editor footer hint | `⌘ ↵` and `⌥↑ history` | `⌘↵` and `↑ history` (history is the arrow keys now) |
| Tooltips and popups | Whole pixels | Can land on half pixels, so text anti-aliases slightly differently |
| A `Spinner` with `animation="ios"` | Frozen unless `spin` | Turns unless `paused` (and under Reduce Motion, as iOS's does) |

| Where | 5.16 | 6.0 |
| --- | --- | --- |
| Every `Dialog` in a compact container | A centered card | A sheet from the bottom (`presentation="auto"`); `presentation="dialog"` keeps the card |
| Modal cards (Dialog, its tray, Sheet, AlertDialog) | Radii of 20, 24, 28 or 14px | One radius, `rounded-sheet` (18px); a flow's title is `text-title` semibold (was 18px bold); a Dialog shown as a sheet has Sheet's grabber, and its footer buttons share the width |
| Card, List section, DisclosureGroup inset | `rounded-card`; Card `elevated` had its own shadow | One `rounded-panel` surface; `elevated` is the `shadow-raised` token (a little stronger); CardTitle loses its −0.2px tracking |
| Focus rings on Button, Toggle, ToggleGroup items, Checkbox, Radio, Switch, the Slider thumb | Soft halos of different sizes | One solid `ring-2` with an offset; tree, list and table rows get one 2px inset ring and one `primary/16` selection wash |
| Field captions, descriptions, legends; List and form group headers | `muted-foreground` (under AA on the grouped grey) | `foreground/70`; a `FieldError` has a red exclamation icon and foreground text |
| Text fields and pickers (Input, SearchInput, Select, Combobox, DateInput, DatePicker, ColorPicker, FontPicker, MarkdownEditor) | Each drew its own box; Select and FontPicker had a 3px halo | One filled field surface (`fieldSurfaceVariants`) with Input's inset primary edge on focus (and while a popup is open); 32 / 44 / 50px tall |
| Segmented, Tabs `segmented`, ToggleGroup `segmented` (5.x `filled`) | 32px segmented track; a 40px filled ToggleGroup with its own card | One track: 36px by default with 15px labels (`size="sm"` is the 5.x 32px look); segments are medium, semibold when selected, dimmed while pressed; segmented ToggleGroup items share the width |
| Button `icon-sm`, `pill` | Hugged the glyph (about 22–26px); `pill` padded | `icon-sm` is a fixed 28px square, `pill` is 44px tall, new `icon-lg` 44px circle |
| Checkbox and Radio, unchecked | A light edge | The `--control-border` token (about 3.4:1 on white) |
| Tab bar (`Tabs variant="bar"`), rail, workspace tabs | 10px labels; unselected tabs `tertiary-foreground` | 11px labels (`text-caption2`); unselected tabs `muted-foreground`; the bar is the shared iOS bar surface (`h-bar`, its hairline drawn as an inset shadow) |
| Workspace | A `rounded-xl border` card | No frame (add `rounded-card border border-border`) |
| SplitView and NavigationStack | Bar blur 18px; −28% parallax, 12% shade; edge shadows as gradient strips; 15.5px rows | Bar blur 20px on the shared bar surface; −30% parallax, 10% shade; edge shadows are tokens; the divider's hairline runs over the bar; 15px rows; back labels follow UIKit (title, then "Back", then the chevron) |
| Empty columns, lists and trees (SplitViewEmpty, List, Tree, LogList, tables) | Each its own grey text | The shared `EmptyState`; in a pane its title is semibold foreground |
| Sidebar | 10px section labels in `tertiary-foreground`; hand-drawn counts | 11px labels in `muted-foreground`; counts are small tinted Badges; 44px rows in a compact provider |
| Popups | Popover, tooltip and toast radii and shadows of their own | `rounded-card` and the `shadow-popover` / `shadow-tooltip` / `shadow-hud` tokens: tooltip radius 9 → 10px, toast banner 16 → 14px, the toast's × a filled 30px circle; menu group labels are semibold; a popup shown as a sheet gains a grabber and 16px of top padding |
| Avatar, Badge | A lighter gradient (some hues under 3:1, with a muddy olive band) | A darker OKLCH gradient that skips the olive band (every hue at least 3.5:1); single-digit Badges are circles, with tabular numbers |
| Celebrate | Hex colors | The theme's tones |
| ProgressStepper | 5px bars, a 3px line | 4px segments (Progress `sm`); complete steps get a check badge |
| Toolbars: DebugToolbar, the edit bar, message actions | A dark hex slab with a gripper; hand-rolled bars | The kit's `Toolbar`: a floating popover card with tone colors and no gripper, or the iOS bar |
| IndexBar and TraceTimeline cards | Their own shadows; 10.5px letters | `shadow-popover`; 11px letters |
| ScrollArea "Jump to latest" | Translucent `bg-secondary` | The popover surface, with a fade-and-rise |
| SQL console, Spreadsheet | Three header buttons; results in their own table | One "Database" menu; results in a DataTable with typed, end-aligned numeric headers and a value popover. Spreadsheet: the sort glyph always shows, numeric headers end-aligned, the kit's button for Add Row, a 1px resize rule |
| Terminal, MarkdownEditor, CodeEditor, OpenCode | Their own insets, shadows and copy button | Terminal `px-3 py-2.5`; MarkdownEditor on the field surface (a hairline card in `variant="card"`); CodeEditor's copy button is the kit's Button; OpenCode is `rounded-card` and shows errors as an alert |
| Composer | Card radius 15 / 22px; 12.5px pills; 9.5px tile badges; hand-styled suggestions | 14 / 18px on `shadow-raised`; 12px pills; 11px badges; a ConversationSuggestion is the 32px outline Button |
| The floating chat | A bare composer with a bump | A FloatingSheet glass card with a cap around the composer; light glass in a light app; the FAB sits at least 16px from the edges |
| Video timeline, Waveform, PencilKit | Red playhead (`destructive`); `muted` waveform barely lighter; black and white inks fixed | The `--color-playhead` token (still red by default); a compact 56px track header in a narrow container; `muted` is visibly lighter; Black and White inks follow the theme |

Popups opened inside a `BLProvider` (or any layer host) stay inside it, as before, and a popup presented as a sheet now dims only that host.

## Diagrams from the preview

Diagram, DiagramFrame, StateDiagram, CloudflareDiagram and docstream's capnp fence were never in a 5.x release or in docstream 2.0.1: a 5.x app starts from their pages. They were developed on an unpublished branch (its package said 5.17.0, but the 5.17.0 on npm doesn't have them). This section is for an app built on that branch: first what a diagram is in 6.0, then every name the branch had and what you write now.

### What a diagram is in 6.0

A diagram is plain data drawn on a Canvas: nodes and edges, with nothing in them that knows statecharts or Cloudflare. It draws the way XState's visualizer does.

- **A node is a card.** A header strip (`title`, an `icon`, a quiet `trailing` badge), a `description` under it, then `sections`: each a quiet caption (`title`) over its items (`{ title, description?, icon?, tone?, port? }`), drawn as chips (`variant: 'default'`), a row of chips that wraps (`'inline'`), plain rows (`'list'`) or rows in the mono face (`'code'`). `kind` says what it holds (`node`, `group`, `region`, `root`, `marker`), `variant` draws its border (`default`, `dashed`, `double`), `tone` an accent, and `entry: true` the marker of where things start.
- **An edge's label is a card too.** A `title` alone is a pill on the route; with `sections` it is a small card of chips; an `icon` goes before the title. The edges past the first target of one transition share its label: `forkOf: '<first edge id>'`. `variant` (`default`, `dashed`, `dotted`, `strong`) and `tone` (`default`, `destructive`) draw the line.
- **Ports are only for connecting.** A node's `ports` are dots to drag a new edge from; a read-only drawing needs none (CloudflareDiagram adds them only when `editable`), and its edges meet the cards.
- **Pressing.** `onAction(item, details)` hears Enter, a double-click, and a press on what `pressable` names: `true` for every chip and label, or `{ nodes, edges }` for some, read-only too. `item.section` and `item.item` address a chip; `details.part` says whether a `label` or an `item` was pressed.
- **Selection and history.** `selection` / `defaultSelection` / `onSelectionChange(selection, details)` work read-only too (`selectable={false}` makes a picture with no selection), and `current` marks where something is. An `editable` diagram keeps its own undo history, or drives yours, passed as `history` (`useDiagramHistory(value, onChange)`): ⌘Z, ⇧⌘Z, the `DiagramToolbar`, the controller and agents all go through it.
- **Layout.** `useDiagramLayout` lays a draft out with ELK in a worker, top to bottom by default, at a `density` (`compact`, `default`, `comfortable`), and wraps a long run into columns to fill its `host`. The first view fits everything when that can be read (87.5% or more), else opens readable from the top-start corner, clear of the toolbar, the minimap and a frame's bar and drawer; after that, what has the eye (the selection, else `current`) is kept in view by the least pan.
- **The compositions.** StateDiagram draws an XState machine that way (a state's actions, invokes and tags as sections, a transition's guard and actions as chips on its label, the machine's context on its own card), simulates it (the transitions it can take are pressable labels) and edits it. CloudflareDiagram draws a system (a service's Handlers, Bindings, Triggers, Settings and Machine as sections, a binding as a label card), and `cloudflareBoardProps(system)` gives a plain Diagram the same board. Both take `density`, and open with `minimap="auto"`.

```tsx
import { useRef } from 'react'
import { Diagram, DiagramToolbar } from '@brett_lamy/ui/diagram'
import type { DiagramDraft } from '@brett_lamy/ui/lib/diagram-layout'
import { useDiagramLayout } from '@brett_lamy/ui/lib/diagram-layout/react'

const draft: DiagramDraft = {
  nodes: [
    { id: 'idle', title: 'Idle', entry: true },
    { id: 'loading', title: 'Loading', sections: [{ title: 'Invoke', items: [{ title: 'fetchUser', icon: 'play-circle' }] }] },
    { id: 'done', title: 'Done', icon: 'stop', variant: 'double' },
  ],
  edges: [
    { id: 'fetch', from: 'idle', to: 'loading', title: 'FETCH', sections: [{ items: [{ title: 'if online', icon: 'question-circle' }] }] },
    { id: 'loaded', from: 'loading', to: 'done', title: 'loaded' },
  ],
}

export function Fetching() {
  const host = useRef<HTMLDivElement>(null)
  const laid = useDiagramLayout(draft, { host, density: 'comfortable' })
  return (
    <div ref={host} className="h-[480px]">
      <Diagram aria-label="Fetching" nodes={laid.nodes} edges={laid.edges} overlay={<DiagramToolbar />} pressable onAction={(item) => console.log(item)} />
    </div>
  )
}
```

### Diagram and DiagramFrame

| On the branch | 6.0 |
| --- | --- |
| `onChange({ nodes, edges, reason })`, type `DiagramChange` | `onDataChange(data, details)`: `data` is `{ nodes, edges }` (`DiagramData`), `details.reason` the same reasons, and `details.cancel()` refuses a change (not passing it back still works when controlled); types `DiagramDataChangeDetails`, `DiagramDataChangeReason` |
| `onSelectionChange(selection)`; `selectable` defaulting to `editable` | `onSelectionChange(selection, details)`; `selectable` defaults to `true`: a read-only diagram selects and reads |
| `lit` | `current` (writes `aria-current` and `data-current`; the ring is `diagram-current`, was `diagram-lit`) |
| `onActivate(item)`; types `DiagramFocus`, `DiagramFocusContext`, `DiagramFocusStep` | `onAction(item, details)` (`DiagramActionDetails`: `reason` `enter-key`, `double-click` or `press`, and `part`); `DiagramItem`, with `section` and `item` for a chip; the stepping types are internal |
| `camera` / `defaultCamera` / `onCameraChange`, `{ x, y, z }`; `cameraToShow` | `viewport` / `defaultViewport` / `onViewportChange(viewport, details)`, `{ x, y, zoom }`; to show something, `useDiagram().canvas` (`fit`, `reveal`) |
| `cursor` | `className="cursor-…"` |
| `minimap={{ position }}` | `minimap={{ side, align }}`, or `'auto'`: only while much of the diagram is out of view, on a board of 720 × 600 px or more |
| `fitPadding: number` | `number \| { top, right, bottom, left }`; the toolbar, the minimap and a frame's bar and drawer are kept clear on top of it |
| The canvas named by `aria-label` | The diagram is a `group` named by `aria-label`; its board is "<name> board" |
| — | `controller` (`createDiagramController`), `useDiagram()` (`{ diagram, canvas, history, zoom }`), `DiagramToolbar` (zoom, fit, undo and redo; at the top in a DiagramFrame), `history` with `useDiagramHistory`, `pressable`, `emptyState`, `loading`, `error`, `overlay` |
| `DiagramNodeKind` `compound`, `parallel`, `final`, `initial` | `kind` `node`, `group`, `region`, `root` or `marker`, and `variant` `default`, `dashed` or `double` for the border: a compound is a `group`, a parallel one also `dashed`, a final node `double` (a hairline inside its border), and an initial marker is `entry: true` on the node it pointed at |
| Edge `kind` (`event`, `done`, `invoke`, `always`, `after`, `initial`, `problem`) | `variant` (`default`, `dashed`, `dotted`, `strong`) and `tone` (`default`, `destructive`), written as `data-variant` and `data-tone` |
| `diagramNodeVariants({ kind })`, `diagramEdgeVariants({ kind })` | `diagramNodeVariants({ kind, variant })`, `diagramEdgeVariants({ variant, tone })`; new `diagramItemVariants` (a chip) and `diagramEdgeLabelVariants({ variant: 'pill' \| 'card' })` |
| `DiagramNode.label`, `.detail` | `title`, `description`; and `icon`, `trailing`, `sections`, `entry`, `tone` |
| `DiagramEdge.label`, drawn beside the line | `title`, a pill on the route; `sections` make it a card; `icon`; `forkOf` |
| `DiagramPort.side` `'t' \| 'r' \| 'b' \| 'l'` (`DiagramSide`) | `'top' \| 'right' \| 'bottom' \| 'left'` (physical: a board doesn't mirror); a port also takes `offset`, in board units along its side; a drop on a card connects through the first of its ports the rule allows |
| `DiagramModel` | `DiagramData` (the same `{ nodes, edges }`) |
| `DiagramNodeBody` drew a label and a detail | It draws the whole card; `DiagramNodeHeader`, `DiagramSections` and `DiagramEntryMarker` are its pieces, for a `renderNode` of your own |
| `nodeTextSize`, `NODE_PADDING`, `NODE_MIN_SIZE`, `INITIAL_SIZE` | `nodeSize` and `edgeLabelSize` (the whole card, measured), `nodeAnatomy`, `DIAGRAM_CARD`, `MARKER_SIZE`; a hand-placed card too small for its words is grown (`growNodesToText`) |
| `noun: string` | `noun: DiagramNoun` (`string` or `(node) => string`): a box counts what it holds by kind, "holding 2 environments and 1 service (12 services in all)" |
| A box's own edge to a child (no sections) from its nearest wall; one each way on one line | from the line under its header, with an origin dot, straight to the child's top; one each way in two lanes, each with its label |
| On a board under 420 px, the first view centered the first entry marker | every board opens on its top-start corner; what's selected or current is brought in by `keepInView` (`lib/diagram-drawing`, with `firstView` and `drawDiagram`) |
| What has the eye: the current state and the edge just taken | also the labels `pressable` names (a simulation's sendable events) when they fit, and the top-start corner when it's in view and both can be read |
| A port no edge claims was given to ELK | it isn't: a dot to connect by changes nothing in the layout |
| The model's functions and types from `@brett_lamy/ui` (`addConnection`, `deleteItems`, `edgeGeometries`, `indexDiagram`, `rerouteOrthogonal`, `NOTHING_SELECTED`, `ConnectorRoute`, `DiagramIndex`…) | `@brett_lamy/ui/lib/diagram-model` (`@/lib/diagram-model`), the same names; the types Diagram's props take (`DiagramNode`, `DiagramEdge`, `DiagramPort`, `DiagramSelection`, `DiagramConnection`…) are on the root too |
| `layoutDiagram`, `useDiagramLayout`, `createDiagramLayoutEngine`, `DIAGRAM_ELK_OPTIONS`… and their types from `@brett_lamy/ui` | `@brett_lamy/ui/lib/diagram-layout` (`@/lib/diagram-layout`), and `@brett_lamy/ui/lib/diagram-layout/react` for `useDiagramLayout` |
| Layout `direction: 'RIGHT' \| 'DOWN' \| 'LEFT' \| 'UP'`, default `RIGHT` | `'down' \| 'right' \| 'up' \| 'left'`, default `down` (pass `'right'` for the old run); `density` (`diagramElkOptions(density)`); `board` and `wrapDiagram` to wrap a long run into columns |
| From `@brett_lamy/ui`: the text measuring (`measureText`, `estimateText`, `DIAGRAM_TEXT_CLASS`, `DiagramTextKind`…), the gestures (`hitTestDiagram`, `stepDiagramGesture`, `DRAG_THRESHOLD`…) and the keyboard's helpers (`describeNode`, `focusOrder`, `stepFocus`…) | internal (`@/lib/diagram-text`, `@/lib/diagram-gesture`, `@/lib/diagram-keyboard` in a registry install); pass `describeNode` / `describeEdge` to change what a screen reader hears |
| Labels beside their line; a self-loop over the node; edges between the same ports on one line | Labels on their route, the route running into and out of them; a self-loop beside the card with its label on it; each edge between ports, and each hand-placed one that would run along another, in a lane of its own |
| `<DiagramFrame host size title panel status cover onBoardKeyDown>{(bar) => …}</DiagramFrame>` | Flat parts: `DiagramFrame` (`open` / `defaultOpen` / `onOpenChange`, `presentation`, `side`, `breakpoints`), `DiagramFrameBoard` (takes `onKeyDown`; its `ref` is a layout's `host`), `DiagramFrameBar` (the status), `DiagramFramePanel` (`title`, `aria-label`, its element's props), `DiagramFrameCover`, `DiagramFrameCoverHeader` (`title`, `backLabel`, `onBack`), `DiagramFrameTrigger`, `useDiagramFrame()` (`open`, `setOpen(open, { focus })`, `presentation`, `sizeClass`, `covered`) |
| `DiagramPanelSection`, `DiagramPanelField({ slot, onCommit })` | `DiagramFrameSection`; a field is the kit's `<Field><FieldLabel/><Input onValueCommit/><FieldError/></Field>` (Input's `onValueCommit(value, details)`: Enter or blur commits, Escape reverts) |
| `PANEL_BESIDE_FROM` (560) | `breakpoints` (`{ medium: 440, regular: 720 }`) |
| A Credenza tray under the board at a phone's size | AdaptivePane: a column, a drawer that doesn't dim the board, or a page pushed over it; `defaultOpen` applies again when the frame changes size class |

### StateDiagram

| On the branch | 6.0 |
| --- | --- |
| `machine: MachineLike`; types `MachineConfig`, `MachineImplementations`, `MachineStateNode`, `MachineTransition` | `StateMachineLike`, `StateMachineConfig`, `StateMachineImplementations` (the root and `@brett_lamy/ui/state-diagram`); `StateMachineNode`, `StateMachineTransition` (`@brett_lamy/ui/lib/state-diagram-model`) |
| `config` without `onConfigChange` (edits held until `config` changed) | `config` is always controlled; `defaultConfig` for one the diagram keeps; `source` for a machine's source text, read without running it |
| `onConfigChange(config)` | `onConfigChange(config, details)`: `details.reason` `edit`, `undo` or `redo`, and `details.cancel()` when uncontrolled |
| `direction: 'RIGHT' \| …`, default `RIGHT` | `'down' \| 'right' \| 'up' \| 'left'`, default `down`; `density`; `background` defaults to `grid` and `minimap` to `'auto'` |
| `initial` (a layout to start from) | `layout` |
| `camera` / `defaultCamera` / `onCameraChange` | `viewport` / `defaultViewport` / `onViewportChange`, as on Diagram |
| `defaultSelection`, while editing only | `selection` / `defaultSelection` / `onSelectionChange(selection, details)`, read-only too; and `onAction` |
| `defaultPanelOpen` | `panelOpen` / `defaultPanelOpen` / `onPanelOpenChange`, and `panelPresentation` |
| The panel's Segmented between Edit and Run | Tabs (`TabsList`, `TabsTab`, `TabsPanel keepMounted`) |
| The panel's send buttons, `data-slot="simulation-event"`… | `data-action="send"`…; and on the board, the transitions it can take are pressable labels (`diagram-edge-label[data-pressable]`): a press, or Enter on the edge, sends |
| Undo and Redo in the panel (`edit-undo`, `edit-redo`), ⌘Z on the board | The `DiagramToolbar`'s and the Diagram's ⌘Z, driving the config's history through `<Diagram history>` |
| `data-slot="state-diagram-error"` | The Diagram's `error`, `data-slot="diagram-error"` |
| The panel's fields with their own error text | Each a `Field` (`data-field="name"`, `event`, `guard`…) with its refusal as a `FieldError` |
| From `@brett_lamy/ui`: `machineToDraft`, `describeEvent`, the edits (`addState`, `tryEdit`…), the simulation (`createSimulation`…), types `StateNodeData`, `StateEdgeData` | `@brett_lamy/ui/lib/state-diagram-model`, `-edit` and `-simulation`; the root keeps StateDiagram, its props' types and `SimulationStandIns` |
| What `machineToDraft` drew: `label` / `detail`; node kinds `compound`, `parallel`, `final`, and `initial` (a marker node and its edge); edge kinds; `EVENT [guard]` labels | Diagram's anatomy, through the `STATE_NODE_LOOK` / `STATE_EDGE_LOOK` preset: a state's card has Entry actions, Exit actions, Invoke, Tags and Meta sections, and the machine's card its Context; parallel is `trailing`, history an `H` / `H*` glyph, final a `stop` glyph; the initial state has `entry: true` (its parent's `data.initial` names it); a transition's label is its event, with its guard and actions as chips and a quiet line for `reenters` or `2 targets`; the targets past the first fork from that label (`forkOf`). What a state or a transition is in XState's terms is `data.type` / `data.transition`; `transitionNotation(edge.data)` writes `EVENT [guard] / action` |
| `StateNodeData.invokes: string[]`; `StateEdgeData.guard: string` | `invoke: StateInvoke[]` (`src`, `id`, `input`), and `entry`, `exit`, `tags`, `description`, `meta`, `history`, `initial`, `context`; `guard: StateGuard` (`name`, `text`, `params`, `composed`), and `name`, `actions`, `delay`, `actor`, `reenter`, `targets` |
| Edge names `after 5000`, `done` / `error` for an actor | `after 5,000 ms`; `verifyToken: done` / `verifyToken: error` |
| `parseXState` from `@brett_lamy/ui/docstream/xstate/machine`, leaving out actions, `context`, `tags`, `meta`, `description` and `input` | `@brett_lamy/ui/lib/state-diagram-source`, keeping them as data: inline code is `{ type: 'xstate.inline' }`, built-ins `{ type: 'xstate.assign' \| …, params }`, composed guards `{ type: 'xstate.and' \| 'xstate.or' \| 'xstate.not' \| 'xstate.stateIn', params }`, and `types.context` as `types: { context: { key: 'type' } }` |
| The xstate fence drawn by Pele from `xstateToMermaid` | A read-only StateDiagram (`@brett_lamy/ui/state-diagram`, loaded when shown); `xstateToMermaid`, still on `/xstate/machine`, is its text form and fallback, in UML notation |

### CloudflareDiagram and Cloudflare Studio

| On the branch | 6.0 |
| --- | --- |
| `onChange({ services, edges, reason })`, type `CloudflareDiagramChange` | `onDataChange(system, details)` (`CloudflareSystem`, `CloudflareDiagramChangeDetails`): `details.reason` adds `add` (the search) beside `edit`, `undo` and `redo`, and `details.cancel()` refuses a change |
| `services` required, controlled only | `services` / `edges` (controlled) or `defaultServices` / `defaultEdges`; and `title`, `accountId` (the system's name and account, in its card; `onDataChange` gives them back as `name`, `accountId`) |
| `defaultSelection` only | `selection` / `defaultSelection` / `onSelectionChange(selection, details)`, and `onAction` |
| `defaultPanelOpen`; the panel open from the start as a column titled "Services" | `panelOpen` / `defaultPanelOpen` / `onPanelOpenChange`, and `panelPresentation` (`column`, `drawer`, `push`, from the frame's own size class). The panel stays closed until something's selected (open from the start only when editable and empty); it is titled and named by the selection ("Room · Durable Objects", "FILES · API → Files"), and the bar's button says "Services", "Add a service" or "Details" |
| `defaultMachine` | `openMachine` / `defaultOpenMachine` / `onOpenMachineChange(id, details)` |
| `panelExtra` | `panelHeader`: what's at the top of the panel |
| `direction: 'RIGHT' \| …`, default `RIGHT` | `'down' \| 'right' \| 'up' \| 'left'`, default `down`: a system runs top to bottom, and wraps for its frame; `density`; `minimap` defaults to `'auto'` |
| `camera` / `defaultCamera` / `onCameraChange` | `viewport` / `defaultViewport` / `onViewportChange`, as on Diagram |
| — | `emptyState` (an `EmptyState` by default) |
| The panel's Undo and Redo buttons (`cloudflare-undo`) | The `DiagramToolbar`'s undo and redo, beside zoom and fit, and the Diagram's ⌘Z, driving the system's history through `<Diagram history>` |
| A service card that listed every port by name, always; `SERVICE_NODE`, `serviceNodeHeight`, a port's `at` from `servicePorts` | A card as big as what it says (Diagram's `nodeSize`): the product as `trailing`, the resource as `description`, then Handlers, Bindings, Triggers, Settings and Machine sections, and an entry marker where requests, schedules or messages come in. Ports only with `editable`, as dots on the card itself: a handler's on its Handlers row, the rest at either end of the header (`offset`); read-only, there are none |
| Edge labels as text, `FILES: put, get +1` | A label card: `FILES`, then a chip per operation; a pill with none. Consumers, producers, dead-letter queues, event notifications, entrypoints and machine events say what they are |
| `placeInLayers(system)`, left to right, from `lib/cloudflare-system` | `placeInLayers(system, { editable? })`, top to bottom, inside what holds what, on `@brett_lamy/ui/cloudflare` |
| — | `cloudflareBoardProps(system, { icon, issues, editable, title })`: the board as a Diagram preset, `<Diagram {...cloudflareBoardProps(system)} />`; `cloudflareBoardData(system, options)` for the nodes and edges alone |
| A service: `id`, `kind`, `label`, `at`, `binding`, `resource`, `machine` | Also `handlers`, `triggers`, `settings`, `vars`, `migrations`, `host` (the Worker a class is drawn in) and `environment`; an edge also `entrypoint`, `deliveryDelay`, `consumer`; a system `name`, `accountId`. All read from and written to `wrangler.jsonc` |
| `readWrangler` read the bindings only | It reads the Worker's settings, triggers, vars, migrations, consumer and binding settings and the account too, and writes them back; `readWranglerEnvironments(text)` reads every env section into one system; a difference can be `kind: 'setting'` |
| Edge `kind: 'problem'` on what's wrong | `tone: 'destructive'` |
| `data-slot="cloudflare-refusal"` under a binding name | The field's `FieldError` (`data-part="refusal"`), and the field is invalid |
| `data-slot="cloudflare-diagram-error"` | The Diagram's `error`, `data-slot="diagram-error"` |
| The machine's bar, `data-slot="cloudflare-machine-bar"`, `data-action="machine-back"` | `DiagramFrameCoverHeader` (`data-part="machine-bar"`): the bar's back button, "Services", and a centred title |
| A tray under the board at a phone's size | A page pushed over the board, with a back button (DiagramFrame on AdaptivePane) |
| The catalog search, a SearchField and a ListBox | A Combobox; also exported as `CloudflareServiceSearch` (`onAction(product, details)`, `details.reason` `item-press` or `enter-key`) |
| `data-slot="cloudflare-delete"`, `cloudflare-undo`, `cloudflare-machine-open`… on buttons | `data-action="delete"`, `undo`, `open-machine`…: kit parts keep their own `data-slot` |
| `[data-slot=cloudflare-label] input` and the other panel fields | `[data-field=label]`, `binding-name`, `events` |
| `data-slot="cloudflare-service-machine"` | The card's Machine section, `[data-slot=diagram-section][data-section=machine]` |
| `data-slot="cloudflare-service"` (`data-kind`, `data-problem`), `cloudflare-service-name`, `cloudflare-port-label` | Diagram's node, `[data-slot=diagram-node][data-node=<id>]`; `diagram-node-title`; a problem is `[data-slot=diagram-node-header][data-tone=destructive]`; ports are `diagram-port`, editable only |
| Editable: a connection was drawn from its ports (`fromPort` / `toPort` on its edge) | a connection claims no dots: it's the read-only edge, so an editable board is laid out, wrapped and routed exactly as the read-only one, with dots to connect by |
| `cloudflareBoardProps(...).noun: 'service'` | `noun: cloudflareNoun` (services, environments and the system each by their name), exported from `@brett_lamy/ui/cloudflare` |
| Editable: every add, connect or delete laid the system out again (and an add could unwrap the board) | an edit never moves a service you didn't move: the first edit writes every service's `at` into the system `onDataChange` hands back; a new service goes in free room, a connection is routed between its cards where they are; Tidy up (toolbar, ⌃⌥T) lays it out again as one undoable step, `details.reason: 'tidy'` |
| `CloudflareDiagramChangeReason`: `… \| 'edit' \| 'add' \| 'undo' \| 'redo'` | adds `'tidy'` |
| A connection's panel title by `via` ("events · Files → Jobs") | the label's own title everywhere: "event notification · Files → Jobs" (`cloudflareEdgeTitle`, exported from `@brett_lamy/ui/cloudflare`) |
| `xstate` and `capnp` fences: fixed 520 px / 420 px boards, the bar over the drawing | as tall as the drawing needs (`height="content"` on StateDiagram, CloudflareDiagram and DiagramFrame), up to `min(70vh, 640px)`; the bar is docked under the board |
| — | `Diagram` `animate`; `DiagramToolbarButton`; `DiagramFrame` `height`; `DiagramFramePanel` `initialFocus`; `StateDiagram` and `CloudflareDiagram` `height` |
| A refused connection's reason only in the live region | also shown beside the target (`diagram-refusal`), and for a moment after release |
| Ports at one place: the one under the pointer, if the rule took it | the first pair the rule takes, in each card's own order |
| Editable: a card or label that grew was crushed into its gap or moved itself (and its line) across the board; a board placed by hand was routed again on every change | an edit never rearranges the board, and makes room: the cards past what grew (or what a new connection needs) are pushed apart by exactly what it needs, rows and columns kept, as part of the same step; lines the push bends are routed again, the rest keep their lanes; a placed board's lines are kept from its first drawing on; where no room can be made, a quiet "No room to make here" offers Tidy up |
| Editable: Tidy up laid out for the frame and left the view where it was; undo, redo and Tidy up said nothing | Tidy up lays out for the board in view (the one a column panel leaves) and opens on the result; Tidy up, undo, redo and room made are said through the diagram's live region ("Undid: added KV.", "Tidied up: 6 services laid out again, 4 moved.") |
| `useDiagram()`: `{ diagram, canvas, history, zoom }` | adds `announce(message)` (the diagram's live region) and `reframe()` (open again on what's drawn after the next change) |

The block's export is a Dialog (a sheet at a phone's size), and its buttons are `data-action="new"`, `open`, `export`, `download`, `download-all`.

### The capnp fence (`@brett_lamy/ui/docstream/capnp`)

| On the branch | 6.0 |
| --- | --- |
| `section.docs-capnp`, with a Source / Diagram button (`.docs-capnp-toggle`, `aria-pressed`) that swapped the board for the source | A split card like the other diagram fences (`.docs-split-card.docs-capnp-preview`, still `[data-docstream-capnp]`): the board and its notes stay, the header has a copy button, and the source is a disclosure under them (`.docs-capnp-source`: a `<details>` before hydration, UI SDK's Collapsible after) |
| `pre.docs-capnp-source` | `.docs-capnp-source-body > pre.docs-split-source` |
| A workerd config fence never reached `renderCode` | `renderCode` is asked first, as for any code fence; return `null` and the config is drawn |
| `CapnpPreview` returned the board and its notes | A result pane, `.docs-split-render-pane.docs-capnp-result`, with `label` (default "Cloudflare services") and `action` |
| — | `appearance` (`auto`, `light`, `dark`) on `CapnpDiagram`, `CapnpPreview` and `CapnpEmbed`; types `CapnpAppearance`, `CapnpPreviewProps`, `CapnpEmbedProps` |
| An embed that couldn't be read: a bare `[role=alert]` | The same alert, inside the card |
