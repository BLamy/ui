# Tooltip

A small inverted label that names or hints at a control. It opens when the pointer rests on the trigger (after a warm-up delay) or when the trigger receives keyboard focus, closes on Esc, blur or pointer leave, and never opens from touch — as on iOS. It is react-aria's `TooltipTrigger` and `Tooltip`, with an arrow that points back at the trigger. Use it for icon-only buttons and abbreviations; it carries no controls and disappears, so anything users need to read or act on belongs in the page, a [Popover](https://blamy.github.io/ui/#/popover) or a field's help text.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/tooltip.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Tooltip, TooltipTrigger } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

Wrap a focusable control and a `Tooltip` in `TooltipTrigger`. The first child is the trigger; the tooltip's content is its description.

```tsx
<TooltipTrigger>
  <Button variant="ghost" size="icon" aria-label="Copy link"><Icon name="link" /></Button>
  <Tooltip>Copy link</Tooltip>
</TooltipTrigger>
```

`TooltipTrigger` waits 500ms before opening on hover (`delay`) and keeps the tooltip 200ms after the pointer leaves (`closeDelay`); react-aria then opens the next tooltip in the group immediately while you sweep across a toolbar. Focus opens it at once. Pass `delay={0}` for an instant one. `placement` (`top` by default; also `bottom`, `start`, `end`, `left`, `right`) sits on the `Tooltip`; it flips when there is no room. `arrow={false}` drops the pointer and `offset` (8px) changes the gap.

{% demo src="tooltip/toolbar" %}

## What goes inside

Short text, one line when possible — the tooltip is at most 15rem wide and wraps beyond that. Inline content works too (a shortcut after the name), but no buttons or links: pointer users cannot move into the tooltip and keyboard users cannot reach it.

## Accessibility

react-aria links the tooltip to its trigger with `aria-describedby` and gives it `role="tooltip"`; Esc dismisses it without moving focus. That makes it a description, not a name: an icon-only button still needs an `aria-label` (or visible text), as in the demo. A disabled control is not focusable or hoverable, so its tooltip cannot open — explain why inline instead. Because touch never opens a tooltip, do not hide essential information in one.

## Props

### TooltipTrigger

| Prop | Default | Effect |
| --- | --- | --- |
| `delay` | `500` | ms of hovering before it opens. |
| `closeDelay` | `200` | ms before it closes after the pointer leaves. |
| `isOpen` / `defaultOpen` / `onOpenChange` | closed | Control visibility. |
| `isDisabled` | `false` | Never opens. |
| `trigger` | hover and focus | `'hover'` or `'focus'` restricts what opens it. |

### Tooltip

| Prop | Default | Effect |
| --- | --- | --- |
| `placement` | `top` | Side (and alignment) relative to the trigger. |
| `offset` | `8` | Gap in px. |
| `arrow` | `true` | Draw the pointer toward the trigger. |
| `className` / `style` | — | Merged onto the tooltip (`className` may be a function). |

## Styling

The tooltip is `data-slot="tooltip"` and the pointer `tooltip-arrow`; both are in the `foreground` color on text in `background`, so it inverts with the theme. It enters and exits with the shared popover motion (a short scale and drift from the trigger; a plain fade under reduced motion) and renders in BLProvider's portal root, or `<body>` without one. Inside a [ThemeScope](https://blamy.github.io/ui/#/theming) it takes the scope's appearance, tint and variables — [see the scoped demo on Popover](https://blamy.github.io/ui/#/popover).
