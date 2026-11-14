# Tooltip

A small inverted label that names or hints at a control. It opens when the pointer rests on the trigger (after a warm-up delay) or when the trigger receives keyboard focus, closes on Esc, blur or pointer leave, and never opens from touch — as on iOS. It is [UI SDK](https://ui-sdk.dev)'s Tooltip, with an arrow that points back at the trigger. Use it for icon-only buttons and abbreviations; it carries no controls and disappears, so anything users need to read or act on belongs in the page, a [Popover](https://blamy.github.io/ui/#/popover) or a field's help text. To preview what a link, name or row points at — a card with an avatar, detail and actions the pointer can move into — use a [Hover Card](https://blamy.github.io/ui/#/hover-card).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/tooltip.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  Tooltip, TooltipTrigger, TooltipContent,
} from '@/components/ui/tooltip'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Tooltip, TooltipTrigger, TooltipContent } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

`Tooltip` is the root, `TooltipTrigger` the control it belongs to (`render` one of ours, a focusable one) and `TooltipContent` the label.

```tsx
<Tooltip>
  <TooltipTrigger className={buttonVariants({ variant: 'ghost', size: 'icon' })}><Icon name="link" /></TooltipTrigger>
  <TooltipContent>Copy link</TooltipContent>
</Tooltip>
```

`Tooltip` waits 500ms before opening on hover (`delay`) and keeps the tooltip 200ms after the pointer leaves (`closeDelay`), so the pointer can cross the gap between two triggers; while one is warm the next opens at once as you sweep across a toolbar, and only one is open at a time. Keyboard focus opens it at once. Pass `delay={0}` for an instant one. `side` (`top` by default; also `bottom`, `left`, `right`, `start`, `end`) and `align` sit on the `TooltipContent`; it flips when there is no room. `arrow={false}` drops the pointer and `sideOffset` (8px) changes the gap.

{% demo src="tooltip/toolbar" %}

## Shortcuts

`shortcut="mod+s"` on the `Tooltip` is the keyboard shortcut of what the trigger does; a `TooltipShortcut` inside the content shows it (`⌘S`, or `Ctrl+S` off Apple platforms) and the trigger gets `aria-keyshortcuts`. It is a hint: the trigger's own `shortcut` binds the keys.

```tsx
<Tooltip shortcut="mod+shift+s">
  <TooltipTrigger className={buttonVariants({ variant: 'ghost', size: 'icon' })}><Icon name="share" /></TooltipTrigger>
  <TooltipContent>Share<TooltipShortcut /></TooltipContent>
</Tooltip>
```

## One tooltip for many triggers

A toolbar can share one tooltip through `createTooltipController<Payload>()`: each `<TooltipTrigger controller={tips} payload={…}>` hands the content its payload, and the content renders `({ payload }) => …`.

## What goes inside

Short text, one line when possible — the tooltip is at most 15rem wide and wraps beyond that. Inline content works too (a shortcut after the name), but no buttons or links: pointer users cannot move into the tooltip and keyboard users cannot reach it.

## Accessibility

The tooltip has `role="tooltip"`. On a trigger with no name of its own — an icon button — it is the trigger's name (`aria-labelledby`); on any other it is a description (`aria-describedby`). `type="label"` or `type="description"` on the `Tooltip` decides it yourself. Esc dismisses it without moving focus. A disabled control can still host a tooltip that says why if it stays focusable (`focusableWhenDisabled` on our Button); otherwise explain inline. Because touch never opens a tooltip, do not hide essential information in one — or make it `toggleable`, so a press opens and closes it, for an info button whose only job is the tip.

## Props

### Tooltip

| Prop | Default | Effect |
| --- | --- | --- |
| `delay` | `500` | ms of hovering before it opens. |
| `closeDelay` | `200` | ms before it closes after the pointer leaves. |
| `open` / `defaultOpen` / `onOpenChange(open, details)` | closed | Control visibility; `details.reason`, `details.cancel()`. |
| `disabled` | `false` | Never opens. |
| `type` | by the trigger's name | `"label"` names the trigger, `"description"` describes it. |
| `toggleable` | `false` | A press opens and closes it, so touch can show it too. |
| `closeOnPress` | `true` | Whether pressing the trigger closes it. |
| `shortcut` | — | The shortcut hint `TooltipShortcut` shows. |
| `controller` | — | From `createTooltipController()`: share it between triggers, open it from code. |
| `container` | BLProvider's root | Where it renders. |

### TooltipContent

| Prop | Default | Effect |
| --- | --- | --- |
| `side` / `align` | `top` / `center` | Where it opens relative to the trigger. |
| `sideOffset` / `alignOffset` | `8` / `0` | Gap in px, and shift along the trigger. |
| `arrow` | `true` | Draw the pointer toward the trigger (`TooltipArrow`). |
| `className` / `style` | — | Merged onto the tooltip; either may be a function of its state. |

## Styling

Slots (from UI SDK): `tooltip-trigger`, `tooltip-content`, `tooltip-arrow`, `tooltip-shortcut`. The tooltip is in the `foreground` color on text in `background`, so it inverts with the theme. It enters and exits with the shared popover motion (`popoverMotion`: a short scale and drift out of the trigger from `data-starting-style`, a quicker exit on `data-ending-style`, a plain fade under reduced motion), and the next tooltip opened while one is warm (`data-instant`) skips it. It renders into BLProvider's root, or the browser's top layer without one. Inside a [ThemeScope](https://blamy.github.io/ui/#/theming) it takes the scope's appearance, tint and variables — [see the scoped demo on Popover](https://blamy.github.io/ui/#/popover).
