# EmptyState

What a list, table, tree, pane or search shows when it has nothing to show: an optional glyph, a title, a line that says why and an optional action, centred, like iOS's "content unavailable" view. Every data component in the kit (List, Listbox, Tree, ObjectTree, CallStack, LogList, DataTable, RequestTable, Spreadsheet) takes an `emptyState` prop that defaults to a small `EmptyState`, the popup empties (`ComboboxEmpty`, `CommandMenuEmpty`) and `ConversationEmpty` take its props, and a SplitView column with nothing selected uses it too. Use [Skeleton](https://blamy.github.io/ui/#/skeleton) instead while the data is still loading, and a [Toast](https://blamy.github.io/ui/#/toast) or a `FieldError` for an error that the user has to act on.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/empty-state.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from), adds BL UI's tokens to your CSS and installs `@brett_lamy/ui` for UI SDK, which the copied files import by the package's name (`@brett_lamy/ui/sdk/…`). The copied source is yours to edit. Import from your alias:

```tsx
import { EmptyState } from '@/components/ui/empty-state'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import { EmptyState } from '@brett_lamy/ui/empty-state'
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

`sm` sits inside a list, table, tree or popup (24px of padding, a semibold footnote title, a 24px glyph); `default` fills a pane and centres itself in it (`h-full`, callout title, the 44px glyph of iOS's content-unavailable view); `lg` fills a page or a phone screen (title-sized heading, a 56px glyph). Give the parent a height for `default` and `lg` to centre in.

{% demo src="empty-state/sizes" %}

## In a collection

Render it in the collection's place when the collection is empty. The kit's data components do this for you: each reads its `emptyState` prop through one exported helper, `renderEmptyState(value, defaults)`, so the same value means the same thing in a List, a Tree or a DataTable:

| `emptyState` | What shows |
| --- | --- |
| left out | the component's default, a small `EmptyState` ("No items", "No rows", "No matches" while a Tree is filtered…) |
| a string | the title of a small `EmptyState`: `emptyState="No orders"` |
| `null` (or `false`, `''`) | nothing |
| any other node | that node, as it is: `emptyState={<EmptyState size="sm" title="No files" description="Drop files here to add them." />}` |

Whatever it is, it is a polite `status` region (an `EmptyState` gets `role="status"`, any other node is wrapped in one), so a filter that empties the list is announced. The region mounts empty and its words follow on the next render: a live region has to be in the page before its content for NVDA and JAWS to read it (VoiceOver also reads one inserted whole). An `EmptyState` you give `role="status"` (or `alert`, or `aria-live`) yourself does the same.

{% demo src="empty-state/in-a-list" %}

```tsx
<Tree items={items} emptyState={<EmptyState size="sm" title="No files" description="Drop files here to add them." />} />
```

A collection of your own reads its prop the same way:

```tsx
import { renderEmptyState } from '@/components/ui/empty-state'

function Gallery({ photos, emptyState }: { photos: Photo[]; emptyState?: ReactNode }) {
  return photos.length ? <Grid photos={photos} /> : renderEmptyState(emptyState, { icon: <Icon name="photo" />, title: 'No photos' })
}
```

In a popup, `ComboboxEmpty` and `CommandMenuEmpty` take the same `icon`, `title`, `description` and `action` (text children are the title), and announce themselves through UI SDK's empty slot.

## Accessibility

The glyph is `aria-hidden`; the title and description are plain text that screen readers read in order, and both clear WCAG AA on every surface (titles are `foreground`, descriptions `foreground` at 70%; only the decorative glyph uses the faint tertiary label). EmptyState is not a heading and not a live region by itself: inside a kit collection, `renderEmptyState` makes it a `status`; on its own, pass `role="status"` when it replaces content the user was reading. Use `render={<section aria-label="…" />}` to make it a landmark, or another element where the markup needs one (`render={<li />}` inside a `ul`).

## Props

Any `div` attribute (`id`, `role`, `aria-*`, `data-*`, event handlers) passes through to the root.

| Prop | Type | Default | Effect |
| --- | --- | --- | --- |
| `icon` | `ReactNode` | — | A glyph above the title, usually `<Icon>`. Sized by the `size` (24, 44 or 56px, whatever size the icon asks for) and tinted `text-tertiary-foreground`. |
| `title` | `ReactNode` | — | What is missing, in a few words. |
| `description` | `ReactNode` | — | Why it is empty, or what to do about it. |
| `action` | `ReactNode` | — | A button, or a few, under the text. |
| `size` | `'sm' \| 'default' \| 'lg'` | `default` | Inside a collection, filling a pane, or filling a page. |
| `render` | `ReactElement \| (props) => ReactElement` | — | Render another element, e.g. `render={<section />}`. |
| `className` | `string` | — | Merged after the recipe. |

`renderEmptyState(value: ReactNode, defaults?: EmptyStateProps): ReactNode` reads an `emptyState` prop as the table in [In a collection](#in-a-collection) says.

## Styling

`data-slot="empty-state"` with `data-size`, and `data-slot` on each slot: `empty-state-icon`, `empty-state-title`, `empty-state-description`, `empty-state-action`. Override the slots from the root, for example `className="[&_[data-slot=empty-state-title]]:text-foreground"`.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `emptyStateVariants`

Defined in `@/components/ui/empty-state`. Base classes:

```text
flex flex-col items-center justify-center text-center text-balance
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `sm` | `gap-0.5 px-3 py-6` |
| `default` (default) | `h-full gap-1 p-6` |
| `lg` | `h-full gap-1.5 p-8` |
