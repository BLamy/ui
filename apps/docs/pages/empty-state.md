# EmptyState

What a list, table, tree, pane or search shows when it has nothing to show: an optional glyph, a title, a line that says why and an optional action, centred, like iOS's "content unavailable" view. Every data component in the kit (Tree, ObjectTree, CallStack, LogList, RequestTable, DataTable) takes an `emptyState` prop that defaults to a small `EmptyState`, and a SplitView column with nothing selected uses it too. Use [Skeleton](https://blamy.github.io/ui/#/skeleton) instead while the data is still loading, and a [Toast](https://blamy.github.io/ui/#/toast) or a `FieldError` for an error that the user has to act on.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/empty-state.json{% endcommand %}

Copies the source into your project's `components/ui/` and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { EmptyState } from '@/components/ui/empty-state'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { EmptyState } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

```tsx
<EmptyState
  icon={<Icon name="tray" />}
  title="No messages"
  description="Messages you receive will appear here."
  action={<Button size="sm">Compose</Button>}
/>
```

Each slot is optional and left out when it is not given, so `<EmptyState size="sm" title="No rows" />` is a one-line placeholder. The four slots use the kit's row vocabulary (`icon`, `title`, `description`) plus `action`, so there are no parts to assemble: the layout is the component.

## Sizes

`sm` sits inside a list, table, tree or popup (24px of padding, footnote title); `default` fills a pane and centres itself in it (`h-full`, callout title); `lg` fills a page or a phone screen (title-sized heading, larger glyph). Give the parent a height for `default` and `lg` to centre in.

{% demo src="empty-state/sizes" %}

## In a collection

Render it in the collection's place when the collection is empty. When the list can empty out while the user is looking at it, add `role="status"` so the change is announced. The kit's data components already do this for their own `emptyState`.

{% demo src="empty-state/in-a-list" %}

```tsx
<Tree items={items} emptyState={<EmptyState size="sm" title="No files" description="Drop files here to add them." />} />
```

## Accessibility

The glyph is `aria-hidden`; the title and description are plain text that screen readers read in order. EmptyState is not a heading and not a live region by itself: pass `role="status"` (or render it inside the collection's own empty part, which already announces) when it replaces content the user was reading. Use `render={<section aria-label="…" />}` to make it a landmark, or another element where the markup needs one.

## Props

Any `div` attribute (`id`, `role`, `aria-*`, `data-*`, event handlers) passes through to the root.

| Prop | Type | Default | Effect |
| --- | --- | --- | --- |
| `icon` | `ReactNode` | — | A glyph above the title, usually `<Icon>`. Sized by the `size` (20, 28 or 44px) and tinted `text-tertiary-foreground`. |
| `title` | `ReactNode` | — | What is missing, in a few words. |
| `description` | `ReactNode` | — | Why it is empty, or what to do about it. |
| `action` | `ReactNode` | — | A button, or a few, under the text. |
| `size` | `'sm' \| 'default' \| 'lg'` | `default` | Inside a collection, filling a pane, or filling a page. |
| `render` | `ReactElement \| (props) => ReactElement` | — | Render another element, e.g. `render={<section />}`. |
| `className` | `string` | — | Merged after the recipe. |

## Styling

`data-slot="empty-state"` with `data-size`, and `data-slot` on each slot: `empty-state-icon`, `empty-state-title`, `empty-state-description`, `empty-state-action`. Override the slots from the root, for example `className="[&_[data-slot=empty-state-title]]:text-foreground"`.
