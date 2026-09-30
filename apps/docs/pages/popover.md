# Popover

A floating panel anchored to its trigger: it positions itself beside the button, flips when there is no room, closes on Esc or an outside press, and returns focus to where it came from. `Popover` is the styled surface — the same one [Select](https://blamy.github.io/ui/#/select), [ComboBox](https://blamy.github.io/ui/#/combobox) and [DropdownMenu](https://blamy.github.io/ui/#/dropdown-menu) draw their lists in. `PopoverContent` is that surface with a padded dialog inside it, for arbitrary content: a small form, a color picker, a "what's this". Use a Popover for light, anchored, non-blocking content; use a [Dialog](https://blamy.github.io/ui/#/dialog) or [Sheet](https://blamy.github.io/ui/#/sheet) when the task should take over the screen.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/popover.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { PopoverTrigger, PopoverContent } from '@/components/ui/popover'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { PopoverTrigger, PopoverContent } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

`PopoverTrigger` (react-aria's `DialogTrigger`) makes its first pressable child the trigger. Give the content an accessible name with a `Heading slot="title"` inside it or an `aria-label`. Children can be a function that receives `close`.

```tsx
<PopoverTrigger>
  <Button variant="secondary">Dimensions</Button>
  <PopoverContent placement="bottom start">
    {({ close }) => (
      <>
        <Heading slot="title">Dimensions</Heading>
        …fields…
        <Button size="sm" onPress={close}>Done</Button>
      </>
    )}
  </PopoverContent>
</PopoverTrigger>
```

{% demo src="popover/dimensions" %}

## Placement

`PopoverContent` is 288px wide (`w-72`) with 16px padding; override with `className`. The react-aria positioning props pass through: `placement` (`bottom` by default; `top`, `start`, `end`, with `start`/`end` alignment such as `bottom start`), `offset` (8px from the trigger), `crossOffset`, `shouldFlip`, `containerPadding`. Plain `Popover` is at least as wide as its trigger (`min-w-(--trigger-width)`) — the CSS variables `--trigger-width` and `--trigger-anchor-point` are available for your own sizing and transform origin.

For a bare surface — a menu you build yourself — use `Popover` directly and put your own element (a react-aria `Dialog`, `ListBox` or `Menu`) inside.

```tsx
<Popover placement="bottom end" className="w-56">
  <Dialog aria-label="Filters">…</Dialog>
</Popover>
```

## Controlled

`PopoverTrigger` accepts `isOpen`, `defaultOpen` and `onOpenChange`, so you can open a popover from elsewhere or close it after an action.

## Overlays wear their ThemeScope

Popovers render in a portal — BLProvider's root, or `<body>` — outside the DOM of whatever opened them, so inherited CSS variables do not reach them. `Popover`, `Tooltip`, `DropdownMenu`, `Select`, `ComboBox`, `Dialog` and `Sheet` therefore read the nearest [ThemeScope](https://blamy.github.io/ui/#/theming) (`useThemeScopeProps`) and apply its `data-theme-scope`, appearance class, tint and variables to their own root. Open each overlay in the dark, amber scope below: the popover surface, the menu, the tooltip and the primary button all belong to it, though the page around it is light or dark on its own. Nothing is applied outside a scope.

{% demo src="popover/scoped" %}

The popover surface keeps a fixed 14px corner radius; the `--radius` scale does not reach it.

## Accessibility

`PopoverContent` is a react-aria `Dialog` (`role="dialog"`): focus moves to it when it opens, Tab cycles inside it, Esc or a press outside closes it and focus returns to the trigger; the trigger carries `aria-expanded`. A dialog needs a name: `Heading slot="title"` (wired via `aria-labelledby`) or the `aria-label` prop. Content that is only a list of choices belongs in a `Menu` or `ListBox`, which have their own roles.

## Props

### PopoverTrigger

| Prop | Default | Effect |
| --- | --- | --- |
| `isOpen` / `defaultOpen` / `onOpenChange` | closed | Control visibility. |

### Popover and PopoverContent

| Prop | Default | Effect |
| --- | --- | --- |
| `placement` | react-aria's (`bottom`) | Side and alignment relative to the trigger. |
| `offset` | `8` | Gap to the trigger, px. |
| `className` / `style` | — | Merged onto the surface (`className` may be a function). |
| `aria-label` (`PopoverContent`) | — | Accessible name when there is no heading. |
| `children` (`PopoverContent`) | — | Content, or a function receiving `{ close }`. |

Other react-aria `Popover` props (`crossOffset`, `shouldFlip`, `isNonModal`, `triggerRef`, …) pass through.

## Styling

Slots: `popover` (the surface, `bg-popover` with the soft shadow and hairline) and `popover-content` (the dialog inside `PopoverContent`). `data-placement` tells you the resolved side, `data-entering` / `data-exiting` drive the grow-from-trigger animation (a fade under reduced motion). The surface stacks at `z-[500]` inside the portal root. Because Select, ComboBox and DropdownMenu reuse it, their `popoverClassName` props reach this surface too.
