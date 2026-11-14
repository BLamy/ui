# FontPicker

Google Fonts families, picked the way a design tool picks them. The list is the most popular families on Google Fonts, searchable and filtered by category, with every family drawn in its own face: a row fetches only the glyphs of its name (a few hundred bytes from the Google Fonts CDN), and only while it is on screen. Hovering a family, or arrowing to it, **previews** it: `onPreview` hands you the family to show for now, so the text it is for wears each font as you move down the list, as Photoshop's font menu does, and gets its own font back when you leave. `FontPicker` holds one family; `FontStackPicker` holds a font stack (a family and its fallbacks) as chips you reorder; `FontList` is the list alone. Loading a family yourself, without a picker, is `useGoogleFont` and `fontStack` from `@/lib/google-fonts`. For a short list of named fonts (three brand faces) a [Select](https://blamy.github.io/ui/#/select) is enough; for a list of commands, a [CommandMenu](https://blamy.github.io/ui/#/command-menu), which this list is built on.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/font-picker.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  FontPicker, FontStackPicker, FontList,
} from '@/components/ui/font-picker'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { FontPicker, FontStackPicker, FontList } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Live preview

`value` is a family name (`'Fraunces'`), or `null` for the system font, which the list offers first. `onValueChange(family, details)` gets the family chosen, with UI SDK's change details: `reason` (`item-press` or `enter-key`), the `event`, `source` and `cancel()` (an uncontrolled picker then keeps its family and stays open); `defaultValue` leaves it to the picker. `onPreview` is called as the list is hovered or arrowed through: with the family to show for now (`null` again meaning the system font), and with `undefined` when the preview ends (the pointer left the list, or it closed). So what to draw is `preview === undefined ? value : preview`. The list fetches only the glyphs of each name, so load the family for the text that wears it: `useGoogleFont(family)`, then set `fontFamily: fontStack(family)`.

{% demo src="font-picker/live-preview" %}

## Anatomy

`FontPicker` is compound, like [Select](https://blamy.github.io/ui/#/select): the root holds the family, the preview and the popup's open state, `FontPickerTrigger` is the pop-up button (Select's trigger, showing the family in its own face) and `FontPickerContent` is the popup with the `FontList`. With no children it renders both, so the one-liner above is the whole control. Write the parts out to size the trigger, place the popup, or open it from your code:

```tsx
<FontPicker aria-label="Body font" value={font} onValueChange={setFont} open={open} onOpenChange={setOpen}>
  <FontPickerTrigger size="sm" />
  <FontPickerContent side="left" align="start" />
</FontPicker>
```

`presentation="auto"` on the root makes the popup a bottom sheet in a compact (phone) container.

## A font stack

`FontStackPicker` holds several families, the one to use first: `fontStack(value)` is a CSS `font-family` that falls back from one to the next. The families are chips: drag one by its handle (or focus the handle, press Enter and use the arrow keys) to reorder, and × removes it. A family added from the list goes in front, since it is the one you are choosing; the list marks each family in the stack with its place. `maxCount` (3) caps the stack, and `onPreview` gives the stack with the hovered family in front, which is what adding it would look like. Give a stack for code `defaultCategory="monospace"` so the list opens on monospaced families.

{% demo src="font-picker/theme-stacks" %}

## The list in a panel

`FontList` is the picker's list without the trigger: put it in an inspector, a sheet or a sidebar. The search and the category filter stay put while the families scroll; the list is virtualized, so only the rows on screen exist (and fetch their names' glyphs).

{% demo src="font-picker/panel" %}

## Loading a family yourself

`useGoogleFont(family)` loads a family, or a stack of them, from the Google Fonts CDN once (every weight it has: the browser downloads a face only when text uses it) and re-renders when it is ready; `useGoogleFontStatus` says `loading`, `ready` or `missing` instead. `fontStack(family)` is the `font-family` to set, with a fallback of the same kind behind it (a serif behind a serif, a monospace behind a monospace). Outside React, `loadGoogleFont(family, { weights, italic, text })` resolves `true` once the faces can be used; a style the family lacks (italics it doesn't have) falls back to the plain one rather than failing.

{% demo src="font-picker/load-yourself" %}

The catalog is `GOOGLE_FONTS`: the most popular families that cover Latin, each with its `category`, `weights` (every hundred in its range for a variable font) and whether it has `italic`s; `findGoogleFont(name)` looks one up. It is generated from the metadata fonts.google.com reads (`node tools/google-fonts/catalog.mjs`). Pass `fonts` to offer your own list: your brand's families, or `GOOGLE_FONTS.filter(…)`.

## Fonts come from Google

Each family is fetched from `fonts.googleapis.com` (the stylesheet) and `fonts.gstatic.com` (the font files) when it is first shown, so the visitor's browser talks to Google. A content security policy has to allow `connect-src https://fonts.googleapis.com` and `font-src https://fonts.gstatic.com`. Offline, or when Google Fonts doesn't have a family, the text keeps its fallback and `useGoogleFontStatus` reports `missing`. To self-host a family you settle on, download it and set `fontFamily` the usual way; the picker is for choosing.

## Accessibility

Built on UI SDK. The trigger is a button named by `aria-label` and the family it holds ("Headline font: Fraunces"); it opens a popover (a dialog) holding a UI SDK Command: a search field (`combobox`) over a `listbox` of the families. Typing searches, the arrow keys move the highlight through the families (which previews them) while focus stays in the search field (`aria-activedescendant`), Enter chooses, and Escape clears the search, then closes the list and returns focus to the trigger. Only the rows on screen are rendered (`createVirtualizer`), but the arrows and Enter reach every family. Each family is named by itself ("Inter", with "(in use)" on the chosen one) and described by its category. The category filter is the kit's ToggleGroup of toggle buttons (`aria-pressed`), wrapping onto a second row in a narrow popover. When nothing matches, the list shows the kit's empty state ("No fonts"). In a stack, the chips are a `list`; each has a drag handle (a button, one tab stop for all of them) and a remove button, both at least 24px (and 44px in a compact container). Reordering is UI SDK's `createReorder`: drag a handle, or focus it, press Space or Enter, move with the arrows, and press Space or Enter again to drop (Escape cancels); every step is announced.

| Part | Keys |
| --- | --- |
| Trigger | Enter, Space or a press opens the list. |
| Search | Type to filter; ArrowUp / ArrowDown move through the families (and preview them); Enter chooses; Escape clears, then closes. |
| Category filter | Arrow keys move between categories; Space or Enter selects. |
| Stack chips | Tab reaches the handles once; arrow keys move between them. On a handle, Space or Enter picks the chip up, arrows (Home, End) choose the place, Space or Enter drops it, Escape cancels; Delete or Backspace removes the chip and focus moves to the next handle (else the one before; with no chip left, to the Add button). |

## Props

### FontPicker

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `defaultValue` / `onValueChange(family, details)` | `null` | The family (a name), or `null` for the system font. |
| `onPreview` | — | The family being previewed (`null`: the system font); `undefined` when the preview ends. |
| `fonts` | `GOOGLE_FONTS` | The families offered. |
| `allowSystem` | `true` | Offer the system font first. |
| `systemLabel` | `System` | What the system font is called. |
| `defaultCategory` | `all` | The category the filter starts on. |
| `open` / `defaultOpen` / `onOpenChange` | closed | The popup's open state. |
| `presentation` | `popover` | `sheet`, or `auto`: a bottom sheet in a compact container. |
| `aria-label` | `Font` | What the font is for: names the trigger (with the family) and the popup. |
| `disabled` | `false` | Disables the trigger. |
| `children` | trigger and content | `FontPickerTrigger` and `FontPickerContent`. |

### FontPickerTrigger

The [Popover](https://blamy.github.io/ui/#/popover)'s trigger in Select's trigger look (`selectTriggerVariants`: the kit's filled field box); its props pass through.

| Prop | Default | Effect |
| --- | --- | --- |
| `size` | `default` | `sm` 32px · `default` 44px · `lg` 50px. |

### FontPickerContent

The popover's content, 320px wide; `PopoverContent`'s props pass through.

| Prop | Default | Effect |
| --- | --- | --- |
| `side` / `align` | `bottom` / `start` | Where the list opens. |
| `children` | a `FontList` of the root's family | Replace the list. |

### FontStackPicker

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `defaultValue` / `onValueChange(families, details)` | `[]` | The families, the one to use first. `details.reason`: `item-press` / `enter-key` (from the list), `drag` / `move-key` (a reorder), `remove-press` / `delete-key`; `source`, `event` and `cancel()` as on FontPicker (the chips' details are UI SDK's own). |
| `onPreview` | — | The stack with the hovered family in front; `undefined` when the preview ends. |
| `maxCount` | `3` | At most this many families. |
| `fonts`, `defaultCategory`, `disabled` | — | As FontPicker's. |
| `size` | `default` | The field: `sm` 32px · `default` 44px · `lg` 50px at the least, growing as the chips wrap. |
| `side` / `align` | `bottom` / `start` | Where the list opens (it is one piece: no content part to put them on). |
| `open` / `defaultOpen` / `onOpenChange`, `presentation` | — | As FontPicker's. |
| `placeholder` | `Add a font` | What the field says while the stack is empty. |
| `aria-label` | `Font stack` | Names the field and the list. |

### FontList

`value`, `defaultValue`, `onValueChange`, `onPreview`, `fonts`, `allowSystem`, `systemLabel` and `defaultCategory` as FontPicker's, plus `autoFocus` (the search field) and `className`. The list is 288px tall (`h-72`).

## Styling

Slots: the trigger is UI SDK's `popover-trigger` (marked `data-font-picker`), the list the kit's [CommandMenu](https://blamy.github.io/ui/#/command-menu) (`command` > `command-input` / `command-list` > `command-item`, and `empty-state`), the stack `font-stack-picker`, the kit's filled field box (`fieldSurfaceVariants`), with its chips in the same pill as a Combobox's. A row carries `data-highlighted` (the pointer or the arrow keys are on it) and `data-disabled` (an unlisted family Google Fonts doesn't have, or any family once a stack is full); a chip carries `data-dragging` (while a pointer drags it, translated by `--drag-x` / `--drag-y`) and `data-grabbed` (picked up). The trigger's recipe is `selectTriggerVariants` (from Select), the stack's `fontStackPickerVariants`.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `fontStackPickerVariants`

Defined in `@/components/ui/font-picker`. Base classes:

```text
h-auto w-full flex-wrap gap-1.5
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `[fieldSurfaceVariants({ size: 'sm' }), 'min-h-8 p-1 text-footnote']` |
| `default` (default) | `[fieldSurfaceVariants({ size: 'default' }), 'min-h-11 p-1.5 text-subhead']` |
| `lg` | `[fieldSurfaceVariants({ size: 'lg' }), 'min-h-[50px] p-2 text-subhead']` |
