# List

iOS's table view: rows grouped into sections, plain (edge to edge, with sticky letter headers) or inset-grouped (each section a rounded card, as in Settings). A row is a press target, a holder for a control, or both, and can carry swipe actions, an edit-mode check, a reorder grip and a hover preview. Use it for navigation and settings screens: rows you *press* or *toggle*.

Reach for a sibling instead when:

- the rows are **chosen** (a picker, a multi-select, an option list): [Listbox](https://blamy.github.io/ui/#/listbox) (`listbox` / `option`, selection state, typeahead);
- the data is a **hierarchy**: [Tree](https://blamy.github.io/ui/#/tree);
- it is a **log or a grid of data** with columns, virtualized rows and a moving marker: [LogList](https://blamy.github.io/ui/#/log-list);
- it is an app's **sidebar** navigation: [Sidebar](https://blamy.github.io/ui/#/sidebar) or a SplitView column.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/list.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { List, ListSection, ListRow } from '@/components/ui/list'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import { List, ListSection, ListRow } from '@brett_lamy/ui/list'
```
{% endtab %}
{% endtabs %}

{% demo src="lists/team-list" %}

```tsx
<List variant="inset">
  <ListSection title="Team" footer="Rows are real buttons.">
    <ListRow
      key="maya"
      icon={<Avatar name="Maya Lindqvist" />}
      title="Maya Lindqvist"
      description="Industrial design"
      accessory="chevron"
      onClick={openMaya}
    />
    <ListRow key="dnd" title="Do Not Disturb" accessory={<Switch />} divider={false} />
  </ListSection>
</List>
```

## Anatomy

- **`List`**: the scroller's content. It picks the style (`variant`), the row height (`density`), an optional sticky `header`, and what to show when there are no rows (`emptyState`).
- **`ListSection`**: a `list` of rows with an optional `title` above (it names the list for screen readers) and a `footer` below. `sticky` makes the title a letter header that sticks under the chrome; `animate` and `onOrderChange` animate and reorder its rows.
- **`ListRow`**: one row, read left to right: `icon`, `title` over `description`, `trailing`, then the `accessory` (`"chevron"`, `"check"`, or a control). The same four names (`icon`, `title`, `description`, `trailing`) are used by every row in the kit.

## Styles

`variant="plain"` (the default) runs rows edge to edge, for Contacts- and Mail-like screens; pair it with `sticky` section titles. `variant="inset"` floats each section as a rounded card with a margin, for Settings-like screens; its section titles are the small uppercase grouped label.

{% demo src="lists/settings" %}

`density` sets the row height for the whole list: `compact` 36px, `default` 46px (iOS's 44pt plus the hairline's room), `comfortable` 56px.

## Empty state

When no section has a row (no children, or only `ListSection`s without rows), the list shows `emptyState` instead. It defaults to a small [EmptyState](https://blamy.github.io/ui/#/empty-state) titled "No items". A string becomes that EmptyState's title (`emptyState="No contacts"`); pass your own node for more (a search's "No Results" with a Clear button), or `null` to show nothing.

```tsx
<List
  header={<SearchInput value={q} onValueChange={setQ} />}
  emptyState={<EmptyState size="sm" icon={<Icon name="magnifyingglass" />} title="No Results" description={`Nothing matches “${q}”.`} />}
>
  <ListSection title="Cities">{hits.map((c) => <ListRow key={c} title={c} />)}</ListSection>
</List>
```

{% demo src="lists/city-search" %}

## Sticky headers: the list works out its own offset

A sticky section title has to stop below whatever chrome is above it. `List` works that out instead of you passing pixels:

```tsx
// In a NavigationStack screen: sections stick below the nav bar, and follow it up when it hides
<List><ListSection title="A" sticky>…</ListSection></List>

// The list has its own header: sections stick below it, whatever its height
<List header={<SearchInput />}>
  <ListSection title="A" sticky>…</ListSection>
</List>

// Or state it yourself (also per section: <ListSection stickyTop={…}>)
<List stickyTop={72}>…</List>
```

A `header` sticks to the top of the list and is measured with a ResizeObserver, so a header that grows (a search field turning into a scope bar) keeps the section offsets right.

{% demo src="lists/contacts" %}

## Rows

- **Pressable rows** (`onClick`) are real `<button>`s (UI SDK's Button) with visible focus rings, named by the title and description. The button sits beneath the row's content, so a control in the row is its sibling, never nested inside it.
- **Rows without `onClick`** are plain containers. A `Switch` or `Slider` in `accessory` (or `trailing`, or anywhere in the row) is named by the row's title, and pressing the row flips its switch (`labelToggles={false}` opts out).
- **`children`** replace the title with a control that spans the row (a brightness slider between two suns).
- **`current`** marks the row that stands for what is open now (the message in the reading pane): a grey wash and `aria-current`.
- **`disabled`** dims the row's content and makes its button disabled; swipes, actions and label toggles stop. Disable the controls inside it yourself.
- **`tone`** colors the text: `destructive` for "Delete Account", `success` / `warning` for status rows. With `justify="center"` and no icon, a row is iOS's button row ("Sign Out").
- **`align="top"`** pins the icon to the first line of a multi-line row (a checkbox beside a wrapping title).
- **`preview`** is a [HoverCard](https://blamy.github.io/ui/#/hover-card)'s content about what the row stands for, opened beside the row while the pointer rests on it or keyboard focus is in it (never by touch).
- **Roles**: a section is a `list` of `listitem`s. A list whose rows are *chosen* is a Listbox, not rows with checks.

{% demo src="lists/control-rows" %}

{% demo src="lists/row-layouts" %}

### Single choice and a button row

`accessory="check"` with `checked` makes a short picker inside a settings screen (for a real choice list, use Listbox). A lone `justify="center"` row with `tone="destructive"` is the iOS Sign Out button.

{% demo src="lists/ringtone-picker" %}

## Swipe actions

`startActions` sit at the row's start and are revealed by swiping toward its end (right, in left-to-right text), `endActions` at its end by swiping toward the start (UI SDK's `createSwipeActions`, which flips both in right-to-left text). A release past half the actions keeps them open and a flick decides sooner; a press anywhere else closes the row. Only one row on the page is open at a time: opening another (by swipe, key or controller) closes it. Past about half the row, the outermost action (index 0) takes the whole strip and runs: turn that off with `fullSwipe={false}` (or limit it to `'start'` / `'end'`).

```tsx
<ListRow
  title="Launch checklist"
  startActions={[{ label: 'Unread', icon: 'mail', onAction: markUnread }]}
  endActions={[
    { label: 'Trash', icon: 'trash', destructive: true, onAction: trash }, // outermost: a full swipe runs it
    { label: 'Flag', icon: 'starF', tint: 'var(--warning)', onAction: flag },
  ]}
/>
```

| Field | Type | Notes |
| --- | --- | --- |
| `label` | `string` | Button text and accessible name |
| `icon` | `string \| ReactNode` | A kit icon name, or any node; drawn above the label |
| `tint` | `string` | Background; defaults to `--destructive` when `destructive`, else `--primary` |
| `destructive` | `boolean` | The row slides away and collapses (its exit: `data-removing` with `data-ending-style`) before `onAction` runs; Delete runs it from the keyboard |
| `onAction` | `(details) => void` | Called on tap, full swipe or Delete; `details.reason` is `action-press`, `full-swipe` or `delete-key` |

**Keyboard and assistive tech.** Focus a row and press ← to reveal the end actions (→ for the start ones), the way a swipe would move the row; focus moves to the first button, the arrows walk them, and heading back toward the row or Esc closes them. Delete runs the destructive end action. Drive a row from outside with `controller={createListRowController()}` (`show('end')`, `close()`). The row describes its actions to screen readers and lists its shortcuts in `aria-keyshortcuts`. With reduced motion, rows move without springing.

{% demo src="lists/swipe-actions" %}

## Edit mode

`editing` slides in the selection check (filled by `checked`) and turns swipes off; the row's button reports the check as `aria-pressed`. Toggle it on every row together, and pair it with a bottom bar for the bulk actions.

{% demo src="lists/mailbox-edit" %}

## Insert, remove and reorder

`animate` on a section grows keyed rows in on insert and collapses them on remove (UI SDK's `data-starting-style` / `data-ending-style`), and slides them when the order changes. `onOrderChange(order, details)` adds a grip to every row, on UI SDK's `createReorder`: drag it, or focus it, press Space, move it with ↑ / ↓ (Home / End) and press Space to drop (Esc puts it back); screen readers hear each step. It is called once per drop with the rows' keys in their new order, and `details.from` / `details.to`; reorder your array to match. Pass it only while reordering is allowed: the grips come and go with it.

```tsx
<ListSection animate onOrderChange={editing ? (_, { from, to }) => setSongs(move(songs, from, to)) : undefined}>
  {songs.map((s) => <ListRow key={s.id} title={s.title} />)}
</ListSection>
```

{% demo src="lists/reorder" %}

## Props

All three take `className`, `style`, `ref` and any DOM attribute (`id`, `aria-*`, `data-*`), passed to their root.

### List

| Prop | Default | Effect |
| --- | --- | --- |
| `variant` | `"plain"` | `"plain"`: rows edge to edge. `"inset"`: each section a rounded card with a 16px margin. |
| `density` | `"default"` | Row height: `"compact"` 36px · `"default"` 46px · `"comfortable"` 56px. |
| `header` | — | Sticks to the top of the list; sticky section titles stop below it. |
| `stickyTop` | the chrome above + `header` | Where sticky section titles stop, in px. |
| `emptyState` | `<EmptyState size="sm" title="No items" />` | Shown instead of the children when no section has a row. A string is the EmptyState's title; `null` shows nothing. |

### ListSection

| Prop | Default | Effect |
| --- | --- | --- |
| `title` | — | The label above the rows (the grouped uppercase label, or with `sticky` a bold letter header); names the section's list. |
| `footer` | — | Explanatory text under the rows. |
| `sticky` | `false` | The title sticks below the chrome while the section scrolls; the rows lose their rounded corners. |
| `stickyTop` | the list's | Where this section's sticky title stops, in px. |
| `animate` | `false` | Keyed rows grow in, collapse out and slide on reorder. Implied by `onOrderChange`. |
| `onOrderChange(order, details)` | — | Adds a grip to every row; called once per drop with the new key order and `details.from` / `details.to` / `details.reason`. |

### ListRow

| Prop | Default | Effect |
| --- | --- | --- |
| `title` | — | The row's label, and the name of its button and of a control in it. |
| `description` | — | A second line under the title. |
| `icon` | — | Before the title: an icon tile, an avatar, a status glyph. |
| `trailing` | — | After the title: a value, a badge, or a control. |
| `accessory` | — | `"chevron"`, `"check"` (shown when `checked`), or a control (Switch, Slider, Button). |
| `checked` | `false` | The checkmark with `accessory="check"`; the filled check while `editing`. |
| `onClick` | — | Makes the row a button. |
| `current` | `false` | A wash and `aria-current`: the row for what is open now. |
| `disabled` | `false` | Dims the content; the button is disabled and the row doesn't swipe, run actions or flip its switch. |
| `editing` | `false` | Slides in the edit-mode check and turns swipes off. |
| `startActions` / `endActions` | — | Swipe actions (see above). |
| `fullSwipe` | `true` | A long swipe runs the outermost action: `true`, `false`, `"start"` or `"end"`. |
| `controller` | — | `createListRowController()`: `show('start' \| 'end')` / `close()` from outside. |
| `tone` | `"default"` | Text color: `"default"` · `"success"` · `"warning"` · `"destructive"`. |
| `justify` | `"start"` | `"center"` centers the title (a button row). |
| `align` | `"center"` | `"top"` pins the icon to the first line of a multi-line row. |
| `divider` | `true` | The hairline under the row; turn it off on a section's last row. |
| `labelToggles` | `true` | Without `onClick`, pressing the row flips the switch in it. |
| `children` | — | A control that spans the row instead of the title. |
| `preview` | — | HoverCard content shown beside the row on hover or focus. |
| `isEdge(clientX)` | — | Return `true` to ignore a swipe that starts there (under a back-gesture zone). |
| `contentClassName` | — | Classes for the row surface (`data-slot="list-row-content"`); `className` goes on the outer row, which also holds the actions. |

### Data attributes

| Element | Attributes |
| --- | --- |
| `list` | `data-variant`, `data-density`, `data-empty` |
| `list-row` | `data-swipe` (`start` / `end`), `data-swiping`, `data-full`, `data-removing`, `data-disabled`, `data-ending-style` |
| `list-section-item` | `data-grabbed`, `data-dragging`, `data-starting-style`, `data-ending-style` |

## Related

- [SearchInput](https://blamy.github.io/ui/#/search-input): the field for a list's `header`.
- [IndexBar](https://blamy.github.io/ui/#/index-bar): the A–Z jump rail beside a plain list (its rows widen their trailing inset to clear it).

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `listVariants`

Defined in `@/components/ui/list`. Base classes:

```text
[--avatar-ring:var(--card)]
```

**`variant`** — default `plain`

| Value | Adds |
| --- | --- |
| `plain` (default) | `p-0` |
| `inset` | `px-4 py-0` |

### `listRowVariants`

Defined in `@/components/ui/list`. Base classes:

```text
[ // Type metrics a <button> would reset, so a host's body line-height or tracking doesn't reach the row. 'relative z-1 box-border flex w-full touch-pan-y items-center gap-3 py-0 ps-4 text-start text-body leading-[normal] tracking-[normal] outline-none', 'focus-visible:[box-shadow:inset_0_0_0_2px_var(--primary)]', // Trailing inset clears an IndexBar overlaying the list (it publishes --bl-index-bar-inset on its parent). 'pe-[max(16px,calc(var(--bl-index-bar-inset,0px)+6px))]', // The swipe offset (`--swipe-x`, from UI SDK) moves the surface; it springs back unless a finger holds it. 'translate-x-(--swipe-x) transition-[translate] duration-spring-snappy ease-spring-snappy group-data-swiping/row:transition-none motion-reduce:transition-none', ]
```

**`align`** — default `center`

| Value | Adds |
| --- | --- |
| `center` (default) | — |
| `top` | `[&>[data-slot=list-row-leading]]:self-start [&>[data-slot=list-row-leading]]:pt-[7px]` |

**`justify`** — default `start`

| Value | Adds |
| --- | --- |
| `start` (default) | — |
| `center` | `[&_[data-slot=list-row-body]]:justify-center [&_[data-slot=list-row-title]]:flex-none` |

**`density`** — default `default`

| Value | Adds |
| --- | --- |
| `compact` | `min-h-9` |
| `default` (default) | `min-h-row` |
| `comfortable` | `min-h-14` |

**`current`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `bg-card bg-linear-to-r from-secondary-strong to-secondary-strong` |
| `false` (default) | `bg-card` |

**`tone`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `text-foreground` |
| `success` | `text-success` |
| `warning` | `text-warning` |
| `destructive` | `text-destructive` |

**`interactive`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `cursor-pointer` |
| `false` (default) | `cursor-default` |

**`disabled`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `cursor-default *:opacity-45` |
| `false` (default) | — |
