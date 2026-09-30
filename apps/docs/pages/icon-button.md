# IconButton

A square button that holds one icon: transparent until hovered, filled while `active`. It is the control for toolbars, headers and row actions, where a text [Button](https://blamy.github.io/ui/#/button) would be too heavy. The `label` is required and is used twice, as the `aria-label` and as the native tooltip, so an icon-only control is never unnamed. It is built on [PlainButton](https://blamy.github.io/ui/#/plain-button) and draws its glyph with [Icon](https://blamy.github.io/ui/#/icons).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/icon-button.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { IconButton } from '@/components/ui/icon-button'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { IconButton } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Toolbar

`name` is any `Icon` name. `active` only changes the look (a filled square and full-strength glyph); you own the state, and can swap the icon with it, as the star does here.

{% demo src="icon-button/toolbar" %}

```tsx
<IconButton name="copy" label="Copy link" onPress={copy} />
<IconButton
  name={starred ? 'star-fill' : 'star'}
  label={starred ? 'Remove star' : 'Star'}
  active={starred}
  onPress={() => setStarred((v) => !v)}
/>
<IconButton name="trash" label="Delete" size={20} onPress={remove} />
```

## Accessibility

It renders a react-aria `Button`, so it is a real `<button>` with keyboard activation (`Enter`, `Space`), press handling and a focus-visible state. `label` becomes `aria-label` and `title`; the icon itself is hidden from assistive technology.

`active` is visual only: the button does not set `aria-pressed`. For a control that is genuinely on or off, name the state in the label (as "Star" / "Remove star" above) or build it from `PlainToggleButton`, which carries `aria-pressed`. `IconButton` also has no `isDisabled` prop; if you need a disabled icon button, use `Button size="icon"` or a `PlainButton`.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `name` | — | Icon name (required). |
| `label` | — | Accessible name and tooltip (required). |
| `onPress` | — | Press handler, typed `() => void`. |
| `size` | `18` | Glyph size in px (stroke width is fixed at 1.7); the button is the glyph plus 5px padding on each side. |
| `active` | `false` | Filled background and `text-foreground` instead of the muted transparent state. |
| `className` / `style` | — | Merged onto the button; `className` last. |

Only these props are forwarded; it does not accept the rest of react-aria's button props.

## Styling

The button has `data-slot="icon-button"`, a 7px radius and a hover fill (`hover:bg-secondary`, which also applies when `active`). Because it sits on [PlainButton](https://blamy.github.io/ui/#/plain-button), react-aria's `data-pressed`, `data-hovered` and `data-focus-visible` attributes are present for your own styling. Hover and press use the shared `pressable` helper, which dims slightly in light mode and brightens in dark.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `iconButtonVariants`

Defined in `@/components/ui/icon-button`. Base classes:

```text
cn(pressable, 'grid cursor-pointer place-items-center rounded-[7px] border-0 p-[5px] hover:bg-secondary!')
```

**`active`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `bg-secondary text-foreground` |
| `false` (default) | `bg-transparent text-muted-foreground` |
