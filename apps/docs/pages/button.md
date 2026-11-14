# Button

The labelled action button, UI SDK's `Button` dressed in BL UI's look: six variants, six sizes, a pending state while its action runs, a press that sinks a little on a spring, and a text label that morphs into the next one instead of swapping. Use it for anything the reader presses to do something. Icon-only controls are Buttons too (`size="icon"`, or the quiet toolbar look below); to draw your own pressable from scratch, use [PlainButton](https://blamy.github.io/ui/#/plain-button).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/button.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Button } from '@/components/ui/button'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Button } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Variants and sizes

`variant` sets the colour and `size` the height and radius. Variants and sizes combine freely; both are plain props on a [cva recipe](https://blamy.github.io/ui/#/variants) (`buttonVariants`), so you can also put the look on another element.

{% demo src="button/variants" %}

```tsx
<Button>Save changes</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="destructive" size="lg">Delete</Button>
<Button size="pill">Export Wei.vcf</Button>
<Button size="icon" aria-label="Add contact"><Icon name="plus" /></Button>
```

`size="pill"` is the full-width iOS action row. `size="icon"` is a 36px circle for a single glyph: it has no label of its own, so pass `aria-label`.

## Icon buttons and toolbars

For the borderless tool you see in toolbars and row actions, use `variant="quiet"` with `size="icon-sm"`: muted until hovered, a small rounded square that hugs its glyph (so the glyph's size sets the button's), and filled while `active`. It has no label of its own, so pass `aria-label`, and `title` for the tooltip.

```tsx
<Button variant="quiet" size="icon-sm" aria-label="Search" title="Search">
  <Icon name="magnifyingglass" size={17} sw={1.7} />
</Button>

<Button variant="quiet" size="icon-sm" active={starred} aria-label="Star" onClick={toggleStar}>
  <Icon name="star" size={18} sw={1.7} />
</Button>
```

`active` only draws the filled state; the state itself is yours to own. If you press the same shape often, wrap it once in your own component, as the demo does.

{% demo src="button/icon-toolbar" %}

## How Button and PlainButton relate

| | Looks | Content | Use it for |
| --- | --- | --- | --- |
| `Button` | cva variants and sizes | text, an icon, or both | labelled actions, icon buttons and toolbar tools |
| [PlainButton](https://blamy.github.io/ui/#/plain-button) | none | anything | pressables you style yourself |

`Button` and `PlainButton` both wrap UI SDK's `Button`, so they share its behavior: `onClick`, the pending state, `disabled` / `focusableWhenDisabled` and `render`.

## Label morph and pending

A plain-text child is wrapped in `TextMorph`: the letters two labels share slide into place, the rest fade, and the button springs to the new width. Any other child (an icon and a string, say) is rendered as is, with no morph. The real text stays in the DOM, so the accessible name is always the current label.

{% demo src="button/label-morph" %}

Return a Promise from `onClick` and the button is pending until it settles: it keeps focus and its look, ignores further presses and gets `data-pending`; after a second it announces `pendingAnnouncement` ("Loading" by default) to screen readers. Button draws no spinner for it, so change the label (as above) or show your own with Tailwind's `in-data-pending:` variant.

```tsx
<Button onClick={() => save()} pendingAnnouncement="Saving">
  <Icon name="arrow-down" className="in-data-pending:hidden" />
  <Spinner className="not-in-data-pending:hidden" />
  Save
</Button>
```

A form's async submit handler isn't tracked: keep your own flag and set `disabled` with `focusableWhenDisabled` while it runs.

## Accessibility

It renders a real `<button>` (or, with `render={<a href="…" />}`, a link that behaves the same). `Enter` and `Space` activate it, `onClick` receives the event and `{ source }` (how it was pressed), and the focus ring shows only for keyboard focus. `disabled` takes it out of the tab order and dims it to 40%; add `focusableWhenDisabled` to keep it focusable (`aria-disabled`). A button with text is named by the text. Icon-only buttons need an `aria-label`. When a button is the trigger of an open menu or popover it carries `aria-expanded`, and the press "sink" is suppressed for it.

## Props

All of UI SDK's `Button` props are accepted (`onClick`, `disabled`, `focusableWhenDisabled`, `pendingAnnouncement`, `render`, `type`, `form`, `autoFocus`, `aria-label`, …), plus:

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `default` | `default` (primary fill) · `secondary` · `ghost` (transparent, accent fill on hover) · `destructive` · `link` (text only, no padding) · `quiet` (muted, secondary fill on hover). |
| `size` | `default` | `default` 36px · `sm` 32px · `lg` 44px · `pill` (full width, 16px text) · `icon` (36px circle, no padding) · `icon-sm` (hugs its glyph). |
| `active` | `false` | The filled "on" look of a `quiet` button. |
| `title` | — | Native tooltip. |
| `className` | — | String or a function of the state (`disabled`, `pending`); merged after the variant classes, so yours win. |
| `children` | — | A string morphs between values; other nodes render as given. |

The `link` variant keeps the `default` size's height and radius; it only drops the padding and fill.

## Styling

The element carries `data-slot="button"` and the `bl-btn` class. State comes from UI SDK's `data-disabled` and `data-pending`; hover, a held press and keyboard focus are the native `hover:`, `active:` and `focus-visible:`. The press scale (`active:`), the focus ring (`ring-ring`, offset 2) and the 40% disabled opacity are in the base classes; the `ghost` variant's hover fill is `hover:not-data-disabled:bg-accent`.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `buttonVariants`

Defined in `@/components/ui/button`. Base classes:

```text
bl-btn box-border inline-flex cursor-pointer items-center justify-center gap-2 border-0 [font-family:inherit] whitespace-nowrap outline-none transition-[scale,background-color,opacity] duration-spring-snappy ease-spring-snappy active:not-aria-expanded:not-data-disabled:scale-[.97] motion-reduce:transition-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-disabled:cursor-default data-disabled:opacity-40 data-pending:cursor-progress
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bg-primary text-primary-foreground` |
| `secondary` | `bg-secondary text-secondary-foreground` |
| `ghost` | `bg-transparent text-foreground hover:not-data-disabled:bg-accent` |
| `destructive` | `bg-destructive text-white` |
| `link` | `bg-transparent p-0 text-primary` |
| `quiet` | `bg-transparent text-muted-foreground hover:not-data-disabled:bg-secondary data-pressed:bg-secondary data-pressed:text-foreground` |

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `h-9 rounded-ctl px-4 text-subhead font-semibold` |
| `sm` | `h-8 rounded-lg px-3 text-footnote font-semibold` |
| `lg` | `h-11 rounded-xl px-5 text-callout font-semibold` |
| `pill` | `w-full rounded-card px-3 py-[13px] text-callout font-semibold` |
| `icon` | `size-9 rounded-full p-0` |
| `icon-sm` | `grid place-items-center rounded-[7px] p-[5px]` |

**`active`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | — |
| `false` (default) | — |

1 compound variant — see the source.
