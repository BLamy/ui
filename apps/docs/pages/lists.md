# List · Section · Row

UITableView's vocabulary: plain or inset-grouped lists, sticky section headers, swipe actions, edit mode with multi-select.

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

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { List, ListSection, ListRow } from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

```jsx
<BLList inset>
  <BLSection title="A" sticky footer="42 contacts">
    <BLRow
      leading={<Avatar c={c}/>}
      title={c.name} subtitle={c.role}
      accessory="chevron"          // or "check", or a control: <Switch/>, <Slider/>, <Button/>
      onPress={open} onDelete={del}
      leadingActions={[{ label: 'Pin', icon: 'pin', onAction: pin }]}
      trailingActions={[{ label: 'Delete', icon: 'trash', destructive: true, onAction: del }]}
      edit={editing} checked={picked}
    />
  </BLSection>
</BLList>
```

## Headers: the list works out its own offset

A sticky section header has to stop below whatever chrome is above it. `BLList` figures that out instead of you passing pixels:

```jsx
// In a NavigationStack screen: sections stick below the nav bar — and follow
// it up when it hides
<BLList><BLSection title="A" sticky>…</BLSection></BLList>

// In a bare scroller: no chrome above, so sections stick at the very top
<BLList><BLSection title="A" sticky>…</BLSection></BLList>

// The list has its own header: sections stick below it, whatever its height
<BLList header={<SearchField/>}>
  <BLSection title="A" sticky>…</BLSection>
</BLList>

// Or state it yourself
// (also per section: <BLSection stickyTop={…}>)
<BLList stickyTop={72}>…</BLList>
```

A `header` passed to `BLList` sticks to the top of the list itself and is measured with a ResizeObserver, so a header that grows (a search field turning into a scope bar) keeps the section offsets honest. Nothing needs to know the value of `BARH`.

## Row behaviors

- **Swipe actions**: `leadingActions` are revealed by swiping right, `trailingActions` by swiping left. A release springs open or shut from the finger's velocity; only one row stays open at a time.
- **Full swipe**: past about half the row the outermost action (index 0) takes the whole strip. Turn it off with `fullSwipe={false}` (or limit it to `'leading'` / `'trailing'`).
- **Edit mode** slides in radio checks.
- **Pressable rows** (`onPress`) are real `<button>`s with arrow-key navigation and visible focus rings. The button sits beneath the row's content, so a control in the row is its sibling — never nested inside it.
- **Rows without `onPress`** are plain containers. A `Switch` or `Slider` in `accessory` (or `trailing`) is named by the row title, and pressing the row's label flips its switch (`labelToggles={false}` opts out).

## Swipe actions

```tsx
<ListRow
  title="Launch checklist"
  leadingActions={[{ label: 'Unread', icon: 'mail', onAction: markUnread }]}
  trailingActions={[
    { label: 'Trash', icon: 'trash', destructive: true, onAction: trash }, // outermost: a full swipe runs it
    { label: 'Flag', icon: 'starF', tint: '#FF9F0A', onAction: flag },
  ]}
/>
```

| Field | Type | Notes |
| --- | --- | --- |
| `label` | `string` | Button text and accessible name |
| `icon` | `string \| ReactNode` | A kit icon name, or any node; drawn above the label |
| `tint` | `string` | Background; defaults to red when `destructive`, else the tint |
| `destructive` | `boolean` | The row slides away and collapses before `onAction` runs |
| `onAction` | `() => void` | Called on tap or full swipe |

`onDelete` is still there: it adds a destructive **Delete** as the outermost trailing action.

**Keyboard and assistive tech.** Focus a row and press → to reveal the trailing actions (← for the leading ones); focus moves to the buttons, Tab walks them, Esc closes. Delete runs the destructive action. The row describes its actions to screen readers and lists the shortcuts in `aria-keyshortcuts`. With reduced motion, rows move without springing.

## Animated sections

`animate` on a section springs keyed rows in on insert, collapses them on remove and slides them when the order changes. `onReorder(from, to)` adds a grip to every row: drag it or focus it and press ↑ / ↓. It is called once per drop; reorder your array to match. Pass it only while reordering is allowed — the grips come and go with it.

```tsx
<ListSection animate onReorder={editing ? (from, to) => setSongs(move(songs, from, to)) : undefined}>
  {songs.map((s) => <ListRow key={s.id} title={s.title} />)}
</ListSection>
```

## Styles

`plain` keeps edge-to-edge rows and sticky letter headers; `grouped` floats each section as an inset card. The Contacts demo toggles the two live in **Settings → Contacts table view**.

## Live example

{% demo src="lists/team-list" %}

## Examples

### Settings

Inset-grouped sections with coloured icon tiles in `leading`, a `Switch` or a value in `trailing`, and `accessory="chevron"` for rows that drill in. A section `footer` explains the group.

{% demo src="lists/settings" %}

### Contacts with an index

A plain list with `sticky` letter headers in a bare scroller, so they stick at the very top. The A–Z `IndexBar` jumps to each section's `innerRef`.

{% demo src="lists/contacts" %}

### Leading and trailing swipe actions

Swipe right to mark read, left for Trash, Flag and More. A long swipe runs the outermost action; Trash collapses the row and the section closes the gap on a spring. Focus a row and press → or ← to do it from the keyboard.

{% demo src="lists/swipe-actions" %}

### Rows with controls

A `Switch`, `Slider` or `Button` as the `accessory`. Rows without `onPress` are containers, so tapping a label flips its switch; the Field Guide row is pressable *and* holds a button, as siblings.

{% demo src="lists/control-rows" %}

### Row layouts

`align="top"` pins the leading slot to the first line of a multi-line row and `contentClassName` styles the row surface. Pass `children` for a control that spans the whole row; a `Switch` or `Slider` anywhere in a titled row is labelled by the title; `selected` marks the current row with `aria-current`.

{% demo src="lists/row-layouts" %}

### Insert, remove and reorder

`ListSection animate` with `onReorder` while editing. Add springs a song in at the top, swiping one away collapses it, and the grips drag (or move with ↑ / ↓).

{% demo src="lists/reorder" %}

### Swipe to delete and edit mode

Give rows `onDelete` and they swipe left to reveal Delete. Pass `edit` to every row to slide in the selection checks, and pair it with `EditBar` for bulk actions.

{% demo src="lists/mailbox-edit" %}

### Single choice and a destructive row

`accessory="check"` with `checked` makes a picker. A lone `center` row with `destructive` is the iOS Sign Out button.

{% demo src="lists/ringtone-picker" %}

### Search header and empty state

`header` pins a search field to the top of the list and keeps section offsets below it. When nothing matches, render an empty state in place of the section.

{% demo src="lists/city-search" %}

## SearchField

The iOS search field: a magnifier, a clear button once there is a query, and Esc to clear. Control it with `value` + `onChange`, or leave it uncontrolled with `defaultValue`.

```tsx
const [query, setQuery] = useState('')

<SearchField value={query} onChange={setQuery} placeholder="Search cities" />
<SearchField defaultValue="Lisbon" onSubmit={(q) => search(q)} aria-label="Search cities" />
```

| Prop | Type | Notes |
| --- | --- | --- |
| `value` / `defaultValue` | `string` | Controlled / initial query |
| `onChange` | `(value: string) => void` | Every keystroke; `''` when cleared |
| `onSubmit` | `(value: string) => void` | Enter |
| `placeholder` | `string` | Defaults to "Search" |
| `aria-label` | `string` | Defaults to "Search" |

Migrating: the old `q` / `setQ` props are now `value` / `onChange`.

## IndexBar

The full reference, with more examples, is on the [IndexBar](https://blamy.github.io/ui/#/index-bar) page.

A reusable jump rail. Give it application-defined string or numeric keys and optional React previews; omit `items` to keep the familiar A-Z fallback.

```tsx
import { IndexBar, type IndexBarItem } from '@brett_lamy/ui'

const stops: IndexBarItem<number>[] = turns.map((turn, index) => ({
  key: turn.sequence,       // retained as a number in onJump
  label: index % 5 === 0 ? String(index + 1) : undefined,
  preview: <strong>{turn.text}</strong>,
  caption: turn.author,
}))

<IndexBar
  items={stops}
  label="Jump to conversation turn"
  onJump={(sequence, stop, index) => scrollTo(sequence)}
  top={10}
  bottom={10}
/>
```

### Alphabet fallback

Pass no `items` (or an empty array) and the same component renders A-Z. Place it beside the scroller, inside the same positioned parent — rows under that parent keep their chevrons clear of the rail without any extra padding:

```tsx
<IndexBar
  avail={new Set(['A', 'B', 'C', 'K', 'M'])}
  onLetter={(letter) => scrollToSection(letter)}
/>
```

### Wave variant

`variant="wave"` draws one short dash per stop. Dashes near the pointer swell like the macOS Dock and a card beside the rail shows the stop's `caption` as a title with its `preview` underneath. `value` marks the current stop (say, the turn in view) at full length in the tint.

```tsx
<IndexBar
  variant="wave"
  side="left"
  items={turns.map((t) => ({ key: t.id, caption: t.title, preview: t.text }))}
  value={turnInView}
  onJump={(id) => scrollTo(id)}
/>
```

Two ways to read a wave rail. With `preview`s, hovering a dash opens a card for that stop — a turn's title, its `preview` (`previewLines`, `previewWidth`) and a `trailing` glyph at the end of the title line. With `panel`, hovering the rail opens one card listing every stop as an outline (`panelTitle` on top, `level` nesting the stops, `value` marked); picking a row jumps like a dash does.

```tsx
<IndexBar
  variant="wave"
  side="left"
  panel
  panelTitle="Your Personal Scratchpad"
  items={headings.map((h) => ({ key: h.id, caption: h.text, level: h.depth }))}
  value={sectionInView}
  onJump={(id) => scrollTo(id)}
/>
```

### Props

| Prop | Type | Notes |
| --- | --- | --- |
| `items` | `(K \| {key?: K, label?, preview?, caption?, dim?, level?, trailing?})[]` | `K` is `string \| number`; primitive items are shorthand stops |
| `onJump` | `(key: K, item, index) => void` | Fired on pointer or keyboard commit without coercing the key |
| `avail` / `onLetter` | `Set<string>` / `(letter) => void` | Used only by the alphabet fallback |
| `top` / `bottom` / `width` | `number \| string` / `number` | Rail sizing inside its positioned parent |
| `label` | `string` | Accessible name for the listbox |
| `variant` | `'default' \| 'wave'` | `wave` renders dashes that swell around the pointer, with a title + preview card |
| `side` | `'left' \| 'right'` | Edge the rail sits on (default `right`); previews open on the inner side |
| `value` | `K` | Current stop; the wave draws it full length in the tint |
| `panel` / `panelTitle` | `boolean` / `ReactNode` | `wave` only: hover opens a card listing every stop (an outline) instead of one stop's preview; the rail's listbox stays the accessible path |
| `previewLines` / `previewWidth` | `number` / `number` | `wave` preview card: lines of `preview` (default 2) and its maximum width in px (default 260) |
| `insetContent` | `boolean` | Default `true`: a right-side rail publishes how far list rows run under it as `--bl-index-bar-inset` on its parent (its width for an edge-to-edge list, little or nothing for inset-grouped cards), and `ListRow`s under that parent widen their trailing inset by it so chevrons and accessories stay clear of the rail |

### Interaction and accessibility

- Hover previews without navigating; pressing and dragging commits each crossed stop.
- Arrow Up/Down moves through stops; Home/End commits the first or last stop.
- The rail exposes a vertical listbox with an active option and visible focus styling from the shared stylesheet.
- Labelless stops render as dots. `preview` accepts any React node; `caption` is its short accessible label.
- `dim` changes presentation only; dim stops remain reachable so data and UI indices never diverge.

#### Live example

Scrub the rail or focus it and use the arrow keys. Switch modes to see the alphabet fallback and the wave variant:

{% demo src="lists/index-bar" %}

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `listRowVariants`

Defined in `@/components/ui/list`. Base classes:

```text
[ // Type metrics a <button> would reset, so a host's body line-height or tracking doesn't reach the row. 'relative box-border flex min-h-row w-full touch-pan-y items-center gap-3 py-0 pl-4 text-left text-body leading-[normal] tracking-[normal] outline-none', 'focus-visible:[box-shadow:inset_0_0_0_2px_var(--primary)]', // Trailing inset clears an IndexBar overlaying the list (it publishes --bl-index-bar-inset on its parent). 'pr-[max(16px,calc(var(--bl-index-bar-inset,0px)+6px))]', ]
```

**`align`** — default `center`

| Value | Adds |
| --- | --- |
| `center` (default) | — |
| `top` | `[&>[data-slot=list-row-leading]]:self-start [&>[data-slot=list-row-leading]]:pt-[7px]` |

**`selected`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `bg-accent` |
| `false` (default) | `bg-card` |

**`destructive`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `text-destructive` |
| `false` (default) | `text-foreground` |

**`interactive`** — default `false`

| Value | Adds |
| --- | --- |
| `true` | `cursor-pointer` |
| `false` (default) | `cursor-default` |
