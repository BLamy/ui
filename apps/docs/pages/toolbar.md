# Toolbar

A row of controls with one tab stop, on [UI SDK](https://ui-sdk.dev)'s Toolbar: an editor's formatting row, a canvas's tool palette, a player's transport, a message's hover actions, or the iOS bottom bar of a list in edit mode. Tab enters it once and the arrow keys (Home, End) move between its buttons, toggles, menu triggers and fields; a disabled item stays reachable with `aria-disabled`. The kit adds three looks and a size: `plain` (no surface), `floating` (a raised card over content) and `bar` (the iOS bottom bar, shared with the [Tabs](https://blamy.github.io/ui/#/tabs) bottom tab bar).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/toolbar.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from), adds BL UI's tokens to your CSS and installs `@brett_lamy/ui` for UI SDK, which the copied files import by the package's name (`@brett_lamy/ui/sdk/…`). The copied source is yours to edit. Import from your alias:

```tsx
import {
  Toolbar, ToolbarButton, ToolbarSeparator, ToolbarText,
} from '@/components/ui/toolbar'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  Toolbar, ToolbarButton, ToolbarSeparator, ToolbarText,
} from '@brett_lamy/ui/toolbar'
```
{% endtab %}
{% endtabs %}

```tsx
<Toolbar aria-label="Formatting">
  <ToolbarButton>Undo</ToolbarButton>
  <ToolbarButton disabled>Redo</ToolbarButton>
  <ToolbarSeparator />
  <ToolbarButton size="icon" aria-label="Insert link"><Icon name="link" size={16} /></ToolbarButton>
  <ToolbarText>100%</ToolbarText>
</Toolbar>
```

## Toolbar or something else?

- **Toolbar**: actions that act on something on screen (the selection, the document, the canvas, the playback). One tab stop for the whole row.
- **[Tabs](https://blamy.github.io/ui/#/tabs)**: switching between views. A bottom tab bar is `Tabs variant="bar"`, not a Toolbar, even though they share the bar surface.
- **[ToggleGroup](https://blamy.github.io/ui/#/toggle)**: one or several pressed states (alignment, bold/italic). Put it inside a Toolbar and it joins the toolbar's arrow-key order.
- **[Segmented](https://blamy.github.io/ui/#/segmented)**: picking one value among a few, shown as a track.
- **[DropdownMenu](https://blamy.github.io/ui/#/dropdown-menu)**: more actions than fit. Render its trigger through a ToolbarButton (below).
- Presets built on it: [DebugToolbar](https://blamy.github.io/ui/#/debug-toolbar) (a debugger's stepping controls), [Filter](https://blamy.github.io/ui/#/filter)'s `FilterToolbar`, PencilKit's `PencilToolbar`.

## Looks and sizes

`variant="plain"` (the default) draws no surface, for a row inside a header or a pane. `variant="floating"` is a raised card (`bg-popover`, `shadow-popover`) that sits over a canvas or a row; its corner follows its buttons' corner plus its 4px padding. `size` (`sm`, `default`, `lg`) sets the size of every ToolbarButton inside: 32, 36 or 44px tall, with the gap between items growing with it. A button can still take its own `size`: icon-only tools take `icon-sm` (28px), `icon` (36px) or `icon-lg` (44px), drawn as rounded squares in a toolbar.

{% demo src="toolbar/looks" %}

```tsx
<Toolbar variant="floating" size="sm" aria-label="Formatting">
  <ToolbarGroup aria-label="Zoom">
    <ToolbarButton size="icon-sm" aria-label="Zoom out" onClick={zoomOut}><Icon name="minus" size={16} /></ToolbarButton>
    <ToolbarText aria-live="polite">{zoom}%</ToolbarText>
    <ToolbarButton size="icon-sm" aria-label="Zoom in" onClick={zoomIn}><Icon name="plus" size={16} /></ToolbarButton>
  </ToolbarGroup>
  <ToolbarSeparator />
  <Toggle variant="quiet" size="icon-sm" aria-label="Favorite"><Icon name="star" size={16} /></Toggle>
  <ToolbarButton size="icon-sm" tone="destructive" aria-label="Delete"><Icon name="trash" size={16} /></ToolbarButton>
</Toolbar>
```

## Edit mode: the bottom bar

`variant="bar"` is the iOS bottom bar (`barSurface` from `@/lib/primitives`: 62px, the translucent `bg-bar` with the system blur, a hairline on the edge that faces the content). Its buttons are text actions in the tint, 44px tall, and grey (not faded) while unavailable; `tone="destructive"` makes one red. A `ToolbarText` takes the room between the actions, centered. This is the edit-mode bar of a list: Favorite and Delete around the selection count. Give the count `aria-live="polite"` so a screen reader hears "2 selected" as it changes.

The bar sits in the flow. To float it over a scrolling list, as iOS does, position it (`className="absolute inset-x-0 bottom-0"`) in a `relative` frame and leave 62px or more of bottom padding under the list. `side="top"` puts the hairline under the bar for a bar along the top edge.

{% demo src="toolbar/edit-mode" %}

```tsx
<Toolbar variant="bar" aria-label="Edit" className="absolute inset-x-0 bottom-0">
  <ToolbarButton disabled={!count} onClick={toggleFavorites}>{allFavorite ? 'Unfavorite' : 'Favorite'}</ToolbarButton>
  <ToolbarText aria-live="polite">{count ? `${count} selected` : 'Select items'}</ToolbarText>
  <ToolbarButton tone="destructive" disabled={!count} onClick={deleteSelected}>Delete</ToolbarButton>
</Toolbar>
```

## Menus, toggles and fields

A tool that stays on (Bold, a pane, a mode) is a `ToolbarToggle`: UI SDK's Toggle (`pressed`, `defaultPressed`, `onPressedChange`, `aria-pressed`) drawn like a ToolbarButton at the toolbar's size, and filled while pressed. Never put `aria-pressed` on a ToolbarButton: it would be pressed to a screen reader and drawn like the others.

```tsx
<Toolbar aria-label="Formatting" size="sm">
  <ToolbarToggle size="icon-sm" aria-label="Bold" pressed={bold} onPressedChange={setBold}><b>B</b></ToolbarToggle>
  <ToolbarToggle size="icon-sm" aria-label="Italic" pressed={italic} onPressedChange={setItalic}><i>I</i></ToolbarToggle>
</Toolbar>
```

A [Toggle](https://blamy.github.io/ui/#/toggle) or a `ToggleGroup` inside a Toolbar joins its arrow-key order by itself. A menu or popover trigger joins through `ToolbarButton`'s `render`, and keeps the toolbar button's look:

```tsx
<DropdownMenu>
  <ToolbarButton render={<DropdownMenuTrigger />}>Share</ToolbarButton>
  <DropdownMenuContent>…</DropdownMenuContent>
</DropdownMenu>
```

A text field joins through UI SDK's `ToolbarInput` (`@brett_lamy/ui/sdk/react/toolbar`), styled with `inputVariants({ size: 'sm' })`.

## Vertical

`orientation="vertical"` makes a column, like a canvas's tool palette: Up and Down move, and separators run across it.

```tsx
<Toolbar variant="floating" orientation="vertical" aria-label="Tools">
  <ToolbarButton size="icon" aria-label="Pencil"><Icon name="pencil" size={16} /></ToolbarButton>
  <ToolbarSeparator />
  <ToolbarButton size="icon" tone="destructive" aria-label="Delete"><Icon name="trash" size={16} /></ToolbarButton>
</Toolbar>
```

## Accessibility

The root is `role="toolbar"`: name it with `aria-label`, and give every icon-only button its own `aria-label`. One tab stop; ←/→ (↑/↓ when vertical), Home and End move, wrapping at the ends unless `loop={false}`. A disabled button (or every item, with `disabled` on the root or a `ToolbarGroup`) stays focusable with `aria-disabled` and ignores presses; `focusableWhenDisabled={false}` on a button skips it instead. `ToolbarText` is not focusable. A `ToolbarToggle` is a `button` with `aria-pressed` and `data-pressed`; moving focus onto it never presses it. `createToolbarController()` gives the toolbar a `focus()` for an Alt+F10-style shortcut.

## Props

### Toolbar

UI SDK's Toolbar props (`orientation`, `loop`, `disabled`, `controller`, `aria-label`, `className` as a string or a function of the state, `render`, `ref`), plus:

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `plain` | `plain` (no surface), `floating` (a raised card), `bar` (the iOS bottom bar). |
| `size` | `default` | `sm`, `default`, `lg`: the default size of the buttons inside, and the gap. |
| `side` | `bottom` | `bar` only: `top` or `bottom`, the edge the bar sits on (the hairline faces the content). |

### ToolbarButton

UI SDK's ToolbarButton props (`onClick`, `disabled`, `focusableWhenDisabled`, `render`), plus:

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `quiet` | Any [Button](https://blamy.github.io/ui/#/button) variant. In a `bar` toolbar, leaving it out gives the bar's tinted text action. |
| `size` | the Toolbar's | Any Button size; icon-only tools take `icon-sm`, `icon` or `icon-lg`. |
| `tone` | `default` | `success`, `warning` or `destructive` colors the label or glyph while the tool is available. Unavailable, an unfilled tool (`quiet`, `ghost`, `plain`, `outline`, the bar's actions) goes grey at full opacity in every look, never a faded tint; filled looks keep Button's dimmed fill. |

### ToolbarToggle

UI SDK's Toggle props (`pressed`, `defaultPressed`, `onPressedChange(pressed, details)`, `disabled`, `controller`), plus:

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `quiet` | Any [Toggle](https://blamy.github.io/ui/#/toggle) variant. `quiet` is a ToolbarButton's look with a grey fill while pressed. |
| `size` | the Toolbar's | Any Toggle size; icon-only tools take `icon-sm`, `icon` or `icon-lg`, drawn as rounded squares. |

### ToolbarGroup, ToolbarSeparator, ToolbarText

`ToolbarGroup` (`aria-label`, `disabled`) lays its items out with the toolbar's gap. `ToolbarSeparator` is a 1px line in `border`. `ToolbarText` is a `span` (footnote, muted, tabular numbers) for a count or a readout; in a `bar` it fills the middle.

`useToolbar()` returns the surrounding toolbar's `{ variant, size }`, for a part of your own that should match it. `toolbarButtonVariants({ toolbar, variant, size, tone })` returns a button's classes for an element that can't be a ToolbarButton.

## Styling

UI SDK writes `data-slot="toolbar"`, `toolbar-button`, `toolbar-group` and `toolbar-separator`, `data-orientation` on the root and on separators, and `data-disabled` on unavailable items. The kit adds `data-variant` and `data-size` on the root, `data-side` on a `bar`, and `data-slot="toolbar-text"`.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `toolbarVariants`

Defined in `@/components/ui/toolbar`. Base classes:

```text
box-border flex min-w-0 items-center data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch
```

**`variant`** — default `plain`

| Value | Adds |
| --- | --- |
| `plain` (default) | — |
| `floating` | `w-fit bg-popover p-1 text-popover-foreground shadow-popover` |
| `bar` | `cn(barSurface, 'w-full shrink-0 justify-between px-2')` |

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `gap-0.5` |
| `default` (default) | `gap-1` |
| `lg` | `gap-2` |

3 compound variants — see the source.
