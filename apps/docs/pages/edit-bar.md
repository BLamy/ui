# EditBar

The action bar an iOS list shows in edit mode: Favorite (or Unfavorite) on the left, how many rows are selected in the middle, Delete in red on the right, on a blurred bar pinned to the bottom. It holds no state — you own the selection and decide what the actions do — and its three labels are fixed. Use it for multi-select on a list; for a general bottom navigation bar use [TabBar](https://blamy.github.io/ui/#/tab-bar), and for a toolbar with other actions build your own row on the `bg-bar` surface.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/edit-bar.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { EditBar } from '@/components/ui/edit-bar'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { EditBar } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

The bar is absolutely positioned on the bottom edge of the nearest positioned ancestor and floats over the content, so give that ancestor `relative` and leave 62px or more of bottom padding for the list. Render it only while edit mode is on.

{% demo src="edit-bar/select-mode" %}

```tsx
<EditBar
  count={selected.size}
  allFav={chosen.every((p) => p.fav)}
  onFav={toggleFavorites}
  onDelete={deleteSelected}
/>
```

`count` drives the middle text ("2 selected", or "Select items" at zero) and enables the actions — at zero both are disabled and dimmed. `allFav` flips the left action's label between Favorite and Unfavorite; the bar does not compute it, so derive it from your selection as the demo does.

## Accessibility

The actions are react-aria buttons, reached by Tab in order and pressed with Enter or Space; disabled ones are skipped. They are named by their text. The count is plain text and is not a live region, so announce a change yourself if it matters (for example, through an `aria-live` status element elsewhere on the screen). The labels are hard-coded English; to localize them or add actions, build the row yourself from `Button` and the `bg-bar` surface.

## Props

| Prop | Default | Effect |
| --- | --- | --- |
| `count` | — | Number selected; `0` disables Favorite and Delete. |
| `allFav` | `false` | Show "Unfavorite" instead of "Favorite". |
| `onFav` | — | `onPress` of the left action. |
| `onDelete` | — | `onPress` of the right action. |
| `className` / `style` | — | Merged onto the bar. |

## Styling

`data-slot="edit-bar"`: `absolute inset-x-0 bottom-0 z-130`, 62px tall, a hairline on top, `bg-bar` with a 20px backdrop blur and saturation boost. Favorite uses `text-primary` and Delete `text-destructive`; the buttons are react-aria buttons, so `data-disabled` is set when `count` is 0.
