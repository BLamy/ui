# Button

The action button: UI SDK's `Button` dressed in BL UI's look, with eight variants, seven sizes, a pending state while its action runs, a press that sinks a little on a spring, and a text label that morphs into the next one instead of swapping. Use it for anything the reader presses to *do* something. A control that stays on or off when pressed (bold, star, show the sidebar) is a [Toggle](https://blamy.github.io/ui/#/toggle), not a Button; one choice from a few is a [Segmented](https://blamy.github.io/ui/#/segmented) control; a pressable whose look is all your own is UI SDK's unstyled Button ([below](#unstyled)).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/button.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { Button, buttonVariants } from '@/components/ui/button'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { Button, buttonVariants } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

```tsx
<Button onClick={save}>Save changes</Button>
```

## Variants and sizes

`variant` sets the colour and `size` the height and radius. They combine freely; both are props of a [cva recipe](https://blamy.github.io/ui/#/variants) (`buttonVariants`), so you can put the look on another element too, such as a popup trigger: `<PopoverTrigger className={buttonVariants({ variant: 'secondary' })}>`.

{% demo src="button/variants" %}

| `variant` | Look | Use it for |
| --- | --- | --- |
| `default` | primary fill | the one main action of a view |
| `secondary` | soft grey fill | the other actions, Cancel |
| `outline` | a hairline frame | a quieter partner of the filled ones |
| `contrast` | dark on light, light on dark | "Sign in with …" and other brand-neutral calls to action |
| `ghost` | text only, a fill on hover | low-emphasis actions in content |
| `quiet` | muted text, a fill on hover | toolbar tools and row actions |
| `destructive` | red fill | an action that deletes or cannot be undone |
| `link` | primary text, no padding | an action that reads as a link |

| `size` | Height | Shape |
| --- | --- | --- |
| `sm` · `default` · `lg` | 32 · 36 · 44px | rounded, a text label (13 · 15 · 16px) |
| `pill` | 44px, full width | the card radius: the iOS action row |
| `icon-sm` | 28px | a rounded square: the toolbar tool |
| `icon` · `icon-lg` | 36 · 44px | a circle for a lone glyph; `icon-lg` is a full touch target |

```tsx
<Button>Save changes</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="destructive" size="lg">Delete</Button>
<Button size="pill">Export Wei.vcf</Button>
<Button size="icon" aria-label="Add contact"><Icon name="plus" /></Button>
```

An icon size has no label of its own, so pass `aria-label` (and `title` for a tooltip). For a round `icon-sm` or a square `icon`, add `className="rounded-full"` or `"rounded-lg"`.

## Icon buttons and toolbars

A toolbar has two kinds of tool, and they share one look. An action (Edit, Copy) is a `quiet` Button with `size="icon-sm"`: muted until hovered. A tool that stays on (Star, Bookmark) is a [Toggle](https://blamy.github.io/ui/#/toggle) with the same `variant="quiet"` and `size="icon-sm"`: filled while pressed, and `aria-pressed` tells a screen reader whether it is on.

```tsx
<Button variant="quiet" size="icon-sm" aria-label="Search" title="Search">
  <Icon name="magnifyingglass" size={17} sw={1.7} />
</Button>

<Toggle variant="quiet" size="icon-sm" aria-label="Star" pressed={starred} onPressedChange={setStarred}>
  <Icon name="star" size={18} sw={1.7} />
</Toggle>
```

Keep a toggle's label the same in both states ("Star", not "Star" / "Remove star"): the pressed state is what changes. If you press the same shape often, wrap it once in your own component, as the demo does.

{% demo src="button/icon-toolbar" %}

## Unstyled

For a chip, a row, a tile or anything else whose look is all your own, use UI SDK's `Button` and `Toggle` themselves. They bring the behavior (press, focus, keyboard, `disabled`, the pending state, `pressed` on the toggle) and no classes at all, so your `className` is the only styling. The kit's own modules import them under these names:

```tsx
import { Button as SdkButton } from '@ui-sdk/react/button'
import { Toggle as SdkToggle } from '@ui-sdk/react/toggle'

<SdkToggle
  pressed={on}
  onPressedChange={setOn}
  className="rounded-full bg-secondary px-3.5 focus-visible:ring-2 focus-visible:ring-ring data-pressed:bg-primary data-pressed:text-primary-foreground"
>
  Unread
</SdkToggle>
```

{% demo src="button/unstyled" %}

Style hover, a held press and keyboard focus with the native `hover:`, `active:` and `focus-visible:`, and state with UI SDK's attributes: `data-disabled`, `data-pending` on the button, `data-pressed` on the toggle while it is on. There is no default focus ring, hover or disabled style: add them, or keyboard users will see no focus indicator. In a registry block, list `@ui-sdk/react` in `meta.json`'s `dependencies`.

| | Looks | Use it for |
| --- | --- | --- |
| `Button` | cva variants and sizes | labelled actions, icon buttons and toolbar actions |
| `Toggle` | the same family, with a pressed look | toolbar tools and settings that stay on |
| `SdkButton`, `SdkToggle` | none | pressables you style yourself |

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

It renders a real `<button>` (or, with `render={<a href="…" />}`, a link that behaves the same). `Enter` and `Space` activate it, `onClick` receives the event and `{ source }` (how it was pressed), and the focus ring (a solid 2px ring in `--ring`, set off by a 2px gap) shows only for keyboard focus. `disabled` takes it out of the tab order and dims it to 40%; add `focusableWhenDisabled` to keep it focusable (`aria-disabled`). A button with text is named by the text; an icon-only one needs `aria-label`. When a button is the trigger of an open menu or popover it carries `aria-expanded`, and the press "sink" is suppressed for it. On a touch layout, prefer `lg` or `icon-lg` (44px).

## Props

All of UI SDK's `Button` props are accepted (`onClick`, `disabled`, `focusableWhenDisabled`, `pendingAnnouncement`, `render`, `type`, `form`, `autoFocus`, `aria-label`, …), plus:

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `default` | `default` · `secondary` · `outline` · `contrast` · `ghost` · `quiet` · `destructive` · `link` (table above). |
| `size` | `default` | `sm` 32px · `default` 36px · `lg` 44px · `pill` (44px, full width) · `icon-sm` (28px square) · `icon` (36px circle) · `icon-lg` (44px circle). |
| `title` | — | Native tooltip. |
| `className` | — | String or a function of the state (`disabled`, `pending`); merged after the variant classes, so yours win. |
| `children` | — | A string morphs between values; other nodes render as given. |

The `link` variant keeps its size's height and radius; it only drops the padding and fill. `ButtonVariant` and `ButtonSize` are the value types.

## Styling

The element carries `data-slot="button"` and the `bl-btn` class. State comes from UI SDK's `data-disabled` and `data-pending`; hover, a held press and keyboard focus are the native `hover:`, `active:` and `focus-visible:`. The press scale, the focus ring and the 40% disabled opacity are in the base classes; `ghost`, `outline` and `quiet` add a hover fill.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `buttonVariants`

Defined in `@/components/ui/button`. Base classes:

```text
bl-btn box-border inline-flex cursor-pointer items-center justify-center gap-2 border-0 [font-family:inherit] whitespace-nowrap [&_svg]:shrink-0 transition-[scale,background-color,opacity] duration-spring-snappy ease-spring-snappy active:not-aria-expanded:not-data-disabled:scale-[.97] motion-reduce:transition-none outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background data-disabled:cursor-default data-disabled:opacity-40 data-pending:cursor-progress
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `bg-primary text-primary-foreground` |
| `secondary` | `bg-secondary text-secondary-foreground` |
| `outline` | `bg-transparent text-foreground shadow-hairline hover:not-data-disabled:bg-accent` |
| `contrast` | `bg-foreground text-background` |
| `ghost` | `bg-transparent text-foreground hover:not-data-disabled:bg-accent` |
| `quiet` | `bg-transparent text-muted-foreground hover:not-data-disabled:bg-secondary hover:not-data-disabled:text-foreground` |
| `destructive` | `bg-destructive text-destructive-foreground` |
| `link` | `bg-transparent p-0 text-primary` |

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `h-8 rounded-lg px-3 text-footnote font-semibold` |
| `default` (default) | `h-9 rounded-ctl px-4 text-subhead font-semibold` |
| `lg` | `h-11 rounded-xl px-5 text-callout font-semibold` |
| `pill` | `h-11 w-full rounded-card px-4 text-callout font-semibold` |
| `icon-sm` | `size-7 rounded-lg p-0` |
| `icon` | `size-9 rounded-full p-0` |
| `icon-lg` | `size-11 rounded-full p-0` |
