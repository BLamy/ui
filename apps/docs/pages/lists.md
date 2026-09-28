# List · Section · Row

UITableView's vocabulary: plain or inset-grouped lists, sticky section headers, swipe actions, edit mode with multi-select.

{% tabs title="Installation" sync="install" %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import { List, ListSection, ListRow, IndexBar } from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/list.json{% endcommand %}

Adds `@/components/ui/list.tsx`, installs `@brett_lamy/ui`, and wires its stylesheet and tokens into your CSS. Import from your alias:

```tsx
import {
  List, ListSection, ListRow, IndexBar,
} from '@/components/ui/list'
```
{% endtab %}
{% endtabs %}

```jsx
<BLList inset>
  <BLSection title="A" sticky footer="42 contacts">
    <BLRow
      leading={<Avatar c={c}/>}
      title={c.name} subtitle={c.role}
      accessory="chevron"          // or "check"
      onPress={open} onDelete={del}
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

- **Swipe left** reveals destructive actions; past the commit point the row springs open with `Haptics.impact('medium')`. Only one row stays open at a time.
- **Edit mode** slides in radio checks; every toggle ticks with `Haptics.selection()`.
- Rows are real `<button>`s with listbox roles, arrow-key navigation, and visible focus rings — the react-aria interaction model.

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

### Swipe to delete and edit mode

Give rows `onDelete` and they swipe left to reveal Delete. Pass `edit` to every row to slide in the selection checks, and pair it with `EditBar` for bulk actions.

{% demo src="lists/mailbox-edit" %}

### Single choice and a destructive row

`accessory="check"` with `checked` makes a picker. A lone `center` row with `destructive` is the iOS Sign Out button.

{% demo src="lists/ringtone-picker" %}

### Search header and empty state

`header` pins a search field to the top of the list and keeps section offsets below it. When nothing matches, render an empty state in place of the section.

{% demo src="lists/city-search" %}

## IndexBar

A reusable jump rail with a **selection tick per stop**. Give it application-defined string or numeric keys and optional React previews; omit `items` to keep the familiar A-Z fallback.

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

Pass no `items` (or an empty array) and the same component renders A-Z:

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

### Props

| Prop | Type | Notes |
| --- | --- | --- |
| `items` | `(K \| {key?: K, label?, preview?, caption?, dim?})[]` | `K` is `string \| number`; primitive items are shorthand stops |
| `onJump` | `(key: K, item, index) => void` | Fired on pointer or keyboard commit without coercing the key |
| `avail` / `onLetter` | `Set<string>` / `(letter) => void` | Used only by the alphabet fallback |
| `top` / `bottom` / `width` | `number \| string` / `number` | Rail sizing inside its positioned parent |
| `label` | `string` | Accessible name for the listbox |
| `variant` | `'default' \| 'wave'` | `wave` renders dashes that swell around the pointer, with a title + preview card |
| `side` | `'left' \| 'right'` | Edge the rail sits on (default `right`); previews open on the inner side |
| `value` | `K` | Current stop; the wave draws it full length in the tint |

### Interaction and accessibility

- Hover previews without navigating; pressing and dragging commits each crossed stop.
- Arrow Up/Down moves through stops; Home/End commits the first or last stop.
- The rail exposes a vertical listbox with an active option and visible focus styling from the shared stylesheet.
- Labelless stops render as dots. `preview` accepts any React node; `caption` is its short accessible label.
- `dim` changes presentation only; dim stops remain reachable so data and UI indices never diverge.

#### Live example

Scrub the rail or focus it and use the arrow keys. Switch modes to see the alphabet fallback and the wave variant:

{% demo src="lists/index-bar" %}
