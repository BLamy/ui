# FontPicker

Google Fonts families, picked the way a design tool picks them. The list is the most popular families on Google Fonts, searchable and filtered by category, with every family drawn in its own face: a row fetches only the glyphs of its name (a few hundred bytes from the Google Fonts CDN), and only while it is on screen. Hovering a family, or arrowing to it, **previews** it: `onPreview` hands you the family to show for now, so the text it is for wears each font as you move down the list, as Photoshop's font menu does, and gets its own font back when you leave. `FontPicker` holds one family; `FontStackPicker` holds a font stack (a family and its fallbacks) as chips you reorder; `FontList` is the list alone. Loading a family yourself, without a picker, is `useGoogleFont` and `fontStack` from `@/lib/google-fonts`.

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

`value` is a family name (`'Fraunces'`), or `null` for the system font, which the list offers first. `onChange` gets the family chosen. `onPreview` is called as the list is hovered or arrowed through: with the family to show for now (`null` again meaning the system font), and with `undefined` when the preview ends (the pointer left the list, or it closed). So what to draw is `preview === undefined ? value : preview`. The list fetches only the glyphs of each name, so load the family for the text that wears it: `useGoogleFont(family)`, then set `fontFamily: fontStack(family)`.

{% demo src="font-picker/live-preview" %}

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

The trigger is a button named by `aria-label` and the family it holds ("Headline font: Fraunces"); it opens a dialog holding a search field and a `listbox` of the families. Typing searches, the arrow keys move through the families (which previews them) while focus stays in the search field, Enter chooses, and Escape clears the search, then closes the list and returns focus to the trigger. The category filter is a group of toggle buttons. In a stack, each chip is a row of a grid with a drag handle and a remove button; reorder with the handle by pointer or keyboard.

| Part | Keys |
| --- | --- |
| Trigger | Enter, Space or a press opens the list. |
| Search | Type to filter; ArrowUp / ArrowDown move through the families (and preview them); Enter chooses; Escape clears, then closes. |
| Category filter | Arrow keys move between categories; Space or Enter selects. |
| Stack chips | Arrow keys move between chips and their buttons; on a handle, Enter starts a move, arrows choose the place, Enter drops. |

## Props

### FontPicker

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `onChange` | — | The family (a name), or `null` for the system font. |
| `onPreview` | — | The family being previewed (`null`: the system font); `undefined` when the preview ends. |
| `fonts` | `GOOGLE_FONTS` | The families offered. |
| `allowSystem` | `true` | Offer the system font first. |
| `systemLabel` | `System` | What the system font is called. |
| `defaultCategory` | `all` | The category the filter starts on. |
| `size` | `default` | `sm` 32px · `default` 44px trigger. |
| `placement` | `bottom start` | Where the list opens. |
| `aria-label` | `Font` | Names the trigger and the list. |
| `isDisabled`, `className`, `triggerProps` | — | The trigger button's. |

### FontStackPicker

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `onChange` | — | The families, the one to use first. |
| `onPreview` | — | The stack with the hovered family in front; `undefined` when the preview ends. |
| `maxCount` | `3` | At most this many families. |
| `fonts`, `defaultCategory`, `placement`, `size` | — | As FontPicker's. |
| `placeholder` | `Add a font` | What the field says while the stack is empty. |
| `aria-label` | `Font stack` | Names the field and the list. |

### FontList

`value`, `onChange`, `onPreview`, `fonts`, `allowSystem`, `systemLabel` and `defaultCategory` as FontPicker's, plus `autoFocus` (the search field) and `className`. The list is 288px tall (`h-72`).

## Styling

Slots: `font-picker` (the trigger), `font-stack-picker`, `font-list`, `font-list-items`. A row carries `data-hovered`, `data-focused` and `data-disabled` (an unlisted family Google Fonts doesn't have, or any family once a stack is full); a chip carries `data-dragging` and `data-focus-visible`. The variants are `fontPickerTriggerVariants`, `fontStackPickerVariants` and `fontListItemVariants`.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `fontListItemVariants`

Defined in `@/components/ui/font-picker`. Base classes:

```text
h-10 min-h-0 scroll-my-1.5 py-0 data-hovered:bg-accent
```

No variants.

### `fontPickerTriggerVariants`

Defined in `@/components/ui/font-picker`. Base classes:

```text
[ 'bl-btn box-border flex w-full cursor-pointer items-center justify-between gap-2 border-0 bg-input px-3 text-left text-foreground outline-none', 'transition-[background-color,box-shadow] duration-spring-snappy ease-spring-snappy data-pressed:bg-secondary-strong', 'data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45 aria-expanded:shadow-[inset_0_0_0_1.5px_var(--primary)]', 'data-disabled:cursor-default data-disabled:opacity-50', ]
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-8 rounded-lg text-subhead` |
| `default` (default) | `h-11 rounded-ctl text-body` |

### `fontStackPickerVariants`

Defined in `@/components/ui/font-picker`. Base classes:

```text
flex w-full flex-wrap items-center gap-1.5 rounded-ctl bg-input p-1.5 data-disabled:opacity-50
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `min-h-8 rounded-lg p-1 text-footnote` |
| `default` (default) | `min-h-11 text-subhead` |
