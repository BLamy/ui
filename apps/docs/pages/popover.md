# Popover

A floating panel anchored to its trigger, on [UI SDK](https://ui-sdk.dev)'s Popover: it positions itself beside the button, flips when there is no room, closes on Esc or an outside press, and returns focus to where it came from. `PopoverContent` is the kit's floating surface — the same one [Select](https://blamy.github.io/ui/#/select), [ComboBox](https://blamy.github.io/ui/#/combobox) and [DropdownMenu](https://blamy.github.io/ui/#/dropdown-menu) draw their lists in — as a padded panel for arbitrary content (a small form, a color picker, a "what's this"), or bare with `variant="surface"`. Use a Popover for light, anchored, non-blocking content; use a [Dialog](https://blamy.github.io/ui/#/dialog) or [Sheet](https://blamy.github.io/ui/#/sheet) when the task should take over the screen, and a [Hover Card](https://blamy.github.io/ui/#/hover-card) for the same surface opened by resting the pointer on a reference.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/popover.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  Popover, PopoverTrigger, PopoverContent,
} from '@/components/ui/popover'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Popover, PopoverTrigger, PopoverContent } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

`Popover` is the root and holds the open state. `PopoverTrigger` is the button that opens it; it has no look of its own, so give it ours with `className={buttonVariants({ … })}`. `PopoverContent` is the surface; name it with a `PopoverTitle` (wired through `aria-labelledby`; add `className="sr-only"` to name it without showing a heading), and describe it with a `PopoverDescription`. A `PopoverClose` closes it — `render` it as a Button for a Done.

```tsx
<Popover>
  <PopoverTrigger className={buttonVariants({ variant: 'secondary' })}>Dimensions</PopoverTrigger>
  <PopoverContent align="start">
    <PopoverTitle>Dimensions</PopoverTitle>
    <PopoverDescription>Set the size of the layer.</PopoverDescription>
    …fields…
    <PopoverClose render={<Button size="sm" />}>Done</PopoverClose>
  </PopoverContent>
</Popover>
```

{% demo src="popover/dimensions" %}

## Placement

`PopoverContent` opens on the trigger's `side` (`bottom` by default; `top`, `left`, `right`, and the logical `start` and `end`), lined up by `align` (`center` by default; `start`, `end`), 8px away (`sideOffset`) and shifted along the trigger by `alignOffset`. It flips and shifts to stay in its host, and is never taller than the room beside the trigger (`--available-height`), so a long list inside it scrolls. The resolved side is `data-side`, the alignment `data-align`.

The default `variant="panel"` is 288px wide (`w-72`) with 16px padding; override with `className`. `variant="surface"` is the bare surface, at least as wide as its trigger (`min-w-(--anchor-width)`), for a list or a layout that pads itself. UI SDK writes `--anchor-width`, `--anchor-height`, `--available-width`, `--available-height` and `--transform-origin` on the content for your own sizing.

```tsx
<PopoverContent variant="surface" side="bottom" align="end" className="w-56">
  <PopoverTitle className="sr-only">Filters</PopoverTitle>
  …
</PopoverContent>
```

`PopoverArrow`, placed first inside the content, draws a pointer toward the trigger on whichever side the popover landed.

## Opening it

Uncontrolled by default (`defaultOpen`); pass `open` and `onOpenChange(open, details)` to control it. `details.reason` says why it is changing (`trigger-press`, `escape-key`, `outside-press`, `close-press`, `focus-out`, `imperative`…), and `details.cancel()` keeps it as it is. `openOnHover` also opens it when the pointer rests on the trigger (after `delay`, 300ms), while a press still opens it for keyboard and touch users.

A trigger elsewhere on the page — one per table row, say — connects through a controller. Each trigger passes a `payload`, and the content reads it from its state:

```tsx
const share = createPopoverController<{ file: string }>()

{files.map((file) => (
  <PopoverTrigger key={file} controller={share} payload={{ file }} className={buttonVariants({ size: 'sm' })}>Share</PopoverTrigger>
))}
<Popover controller={share}>
  <PopoverContent>{({ payload }) => <PopoverTitle>Share {payload?.file}</PopoverTitle>}</PopoverContent>
</Popover>
```

`share.open()`, `share.close()` and `share.toggle()` drive it from code.

## In a small container

`presentation="auto"` on the `Popover` turns it into a bottom sheet when it opens in a compact container (a phone-sized frame or column), and `presentation="sheet"` always does. As a sheet it is shaped like the kit's bottom [Sheet](https://blamy.github.io/ui/#/sheet): the full width of its host, square at the bottom, and a swipe down closes it. Unlike the Sheet it has no scrim inside BLProvider (or any layer host): its dim is the page's top-layer backdrop, which a contained popup doesn't get.

## Popups wear their ThemeScope

A popover renders into its layer host — BLProvider's root, or the browser's top layer without one — outside the DOM of whatever opened it, so inherited CSS variables do not reach it. `Popover`, `Tooltip`, `HoverCard`, `DropdownMenu`, `Select`, `ComboBox`, `Dialog` and `Sheet` therefore read the nearest [ThemeScope](https://blamy.github.io/ui/#/theming) (`useThemeScopeProps`) and apply its `data-theme-scope`, appearance class, tint and variables to their own popup. Open each one in the dark, amber scope below: the popover surface, the menu, the tooltip and the primary button all belong to it, though the page around it is light or dark on its own. Nothing is applied outside a scope.

{% demo src="popover/scoped" %}

The popover surface keeps a fixed 14px corner radius; the `--radius` scale does not reach it.

## Accessibility

`PopoverContent` has the `dialog` role: focus moves into it when it opens (the first focusable element, or the content itself), Esc or a press outside closes it and focus returns to the trigger, which carries `aria-expanded` and `aria-controls`. By default it is not modal: the page stays usable and focus leaving the popover closes it; `modal` traps focus and makes the rest of the host inert, `modal="trap-focus"` only traps focus. Name it with a `PopoverTitle` (visually hidden if need be); without one it takes its trigger's name, and an `aria-label` on the content doesn't change that. Content that is only a list of choices belongs in a [DropdownMenu](https://blamy.github.io/ui/#/dropdown-menu) or [Listbox](https://blamy.github.io/ui/#/list-box), which have their own roles.

## Props

### Popover

| Prop | Default | Effect |
| --- | --- | --- |
| `open` / `defaultOpen` / `onOpenChange(open, details)` | closed | Control visibility; `details.reason`, `details.cancel()`. |
| `modal` | `false` (`true` as a sheet) | `true` traps focus and makes the rest of the host inert; `"trap-focus"` only traps focus. |
| `openOnHover` / `delay` / `closeDelay` | `false` / `300` / `0` | Open when the pointer rests on the trigger. |
| `presentation` | `"popover"` | `"sheet"`, or `"auto"` for a sheet in a compact container. |
| `controller` | — | From `createPopoverController()`: open it from code and connect triggers outside it. |
| `container` | BLProvider's root | Where it renders. |

### PopoverTrigger

| Prop | Default | Effect |
| --- | --- | --- |
| `render` | a `<button>` | Another element to render as. For the kit's button look, style it instead: `className={buttonVariants({ variant: 'secondary' })}`. |
| `disabled` / `focusableWhenDisabled` | `false` | Stop it opening the popover. |
| `controller` / `payload` | — | Connect a trigger outside the root, with data for the content. |
| `shortcut` | — | A key that presses it, like `"mod+i"`. |

### PopoverContent

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `panel` | `panel` (padded, 288px) or `surface` (bare, as wide as the trigger). |
| `side` / `align` | `bottom` / `center` | Where it opens relative to the trigger. |
| `sideOffset` / `alignOffset` | `8` / `0` | Gap to the trigger and shift along it, px. |
| `initialFocus` / `finalFocus` | `auto` / `trigger` | Where focus goes as it opens and closes. |
| `className` / `style` | — | Merged onto the surface; either may be a function of its state. |
| `children` | — | Content, or a function of its state (`open`, `presentation`, `payload`). |

`PopoverTitle`, `PopoverDescription`, `PopoverClose` (`render` it as a Button) and `PopoverArrow` take their element's props.

## Styling

Slots (from UI SDK): `popover-trigger`, `popover-content`, `popover-title`, `popover-description`, `popover-close`, `popover-arrow`. The content carries `data-open` / `data-closed`, `data-side`, `data-align`, `data-presentation` (`popover` or `sheet`), and `data-starting-style` / `data-ending-style` while it enters and leaves: it grows out of its trigger from `--transform-origin` on the snappy spring and leaves quicker (`popoverMotion`), and only fades under reduced motion. `popoverContentVariants({ variant })` returns the surface classes. Select, ComboBox and DropdownMenu draw the same surface, so their content parts take the same overrides.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `popoverContentVariants`

Defined in `@/components/ui/popover`. Base classes:

```text
[ popoverSurface, popoverMotion, 'box-border data-[presentation=sheet]:max-h-[calc(100%-48px)] data-[presentation=sheet]:w-full data-[presentation=sheet]:min-w-0 data-[presentation=sheet]:rounded-t-card data-[presentation=sheet]:rounded-b-none data-[presentation=sheet]:pb-[max(16px,env(safe-area-inset-bottom))] data-[presentation=sheet]:[--sheet-backdrop:var(--overlay,color-mix(in_oklab,black_40%,transparent))]', ]
```

**`variant`** — default `panel`

| Value | Adds |
| --- | --- |
| `panel` (default) | `w-72 p-4` |
| `surface` | `min-w-(--anchor-width)` |
