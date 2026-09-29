# CommandMenu

A cmdk-style command palette: a search input over grouped, fuzzy-ranked results, with nested pages you drill into and back out of, a keyboard legend, and ⌘1–⌘9 quick picks. It renders inline or as a ⌘K dialog; react-aria supplies the modal (focus trap, focus return, portal) and the keycaps, and the input keeps focus the whole time — the active row is virtual (`aria-activedescendant`), so typing, arrows and Enter never fight over focus.

{% tabs title="Installation" sync="install" %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  CommandMenu, CommandInput, CommandList, CommandGroup,
  CommandItem,
} from '@brett_lamy/ui'
```
{% endtab %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/command-menu.json{% endcommand %}

Adds `@/components/ui/command-menu.tsx`, installs `@brett_lamy/ui`, and wires its stylesheet and tokens into your CSS. Import from your alias:

```tsx
import {
  CommandMenu, CommandInput, CommandList, CommandGroup,
  CommandItem,
} from '@/components/ui/command-menu'
```
{% endtab %}
{% endtabs %}

```tsx
import {
  CommandMenu, CommandInput, CommandList, CommandPage,
  CommandGroup, CommandItem, CommandEmpty, CommandFooter,
} from '@brett_lamy/ui'

<CommandMenu
  variant="dialog"
  isOpen={open}
  onOpenChange={setOpen}
  hotkey="mod+k"
  aria-label="Command menu"
>
  <CommandInput placeholder="Search commands..." />
  <CommandList>
    <CommandEmpty>No results</CommandEmpty>
    <CommandPage id="root">
      <CommandGroup heading="Actions">
        <CommandItem
          icon="square-pencil"
          title="New thread"
          shortcut="⇧⌘O"
          onSelect={newThread}
        />
        <CommandItem icon="square-pencil" title="New thread in..." page="projects" />
        <CommandItem icon="link" title="Copy thread ID" description={id} onSelect={copyId} />
      </CommandGroup>
    </CommandPage>
    <CommandPage id="projects" numbered>
      <CommandGroup heading="Projects">…</CommandGroup>
    </CommandPage>
  </CommandList>
  <CommandFooter />
</CommandMenu>
```

## Keyboard

With the input focused (it always is):

| Keys | Effect |
| --- | --- |
| `↑` `↓` · `Ctrl` `P` / `N` · `Ctrl` `K` / `J` | Move the active row, wrapping at the ends (`loop`). Disabled rows are skipped. |
| `Alt` `↑` `↓` | Start of the previous / next group. |
| `Home` `End` · `PageUp` `PageDown` | First / last row, or five rows at a time. |
| `←` `→` | Inside a `columns` group: move within the grid (`↑` `↓` move a row and leave it at its edges). |
| `Enter` | Select the active row. A row with `page` pushes that page. |
| `⌘1`–`⌘9` (`Ctrl` elsewhere) | Select the Nth visible row. `numbered` pages show the keycaps. |
| `Backspace` on an empty input | Back one page. Only a fresh press: holding Backspace to clear a query stops at empty instead of popping pages. |
| `Esc` | Clears a typed query first; with an empty query it closes the whole menu from any depth — the footer's "Esc Close". `escapeBehavior="pop"` steps back a page before closing instead. |

The mouse makes a row active only when it moves — a list scrolling under a resting cursor never steals the keyboard's row — and clicking selects without taking focus from the input. Keyboard moves scroll the active row into view (the first row of a group brings its heading along); hovering does not scroll.

## Pages

`CommandPage` elements are direct children of `CommandList`; only the current one renders. Selecting a row with `page="…"` pushes it: the query clears, the input's icon becomes a back arrow, and the footer adds Backspace Back. Popping restores the parent page's query, scroll position and active row, so you land exactly where you left.

Page changes move in the direction of travel — a push slides the new page in from the right and the old one out to the left, a pop reverses it — on the smooth spring, blurred through the middle, while the list's height springs to the new page (the tray spring). With reduced motion the pages cross-fade and the height changes at once.

| Prop | Effect |
| --- | --- |
| `id` | `root` for the first page. |
| `placeholder` / `title` | The input's placeholder on this page, and a chip before the input. |
| `filter` | `false` for rows computed from the query (a calculator, a URL) instead of filtered by it. |
| `numbered` | Show `⌘1`–`⌘9` on the first nine visible rows. |
| `onKeyDown(e, menu)` | Runs before the menu's keys; `preventDefault()` to take a key over. `menu` has `select`, `move`, `push`, `pop`, `close`, `query`, `setQuery`. |

`useCommandMenu()` returns the same API from inside the menu — plus `popTo(id)`, `reset()` (back to a fresh root without remounting) and `setActive(value)` (move the highlight without selecting). Every step sees the one before it, so a handler can pop twice or push then pop. `menuRef` hands the API to code outside the menu, and `defaultPages` opens on a page (`['projects']`, with Back to the root).

When the active row goes away — deleted, disabled — its neighbour takes its place rather than the top row.

## Filtering

Every whitespace-separated word of the query must match a row's `value` (default: its `title`), one of its `keywords`, or its `description` — as a substring, else as a fuzzy subsequence. Rows rank within their group by how well they match (a prefix beats a word start beats anywhere; runs beat scattered letters) — or, with `ranking="global"`, groups also reorder by their best match so the strongest result always leads. `boost` scales a row's score (a favourite, or a fallback like "Search the web" at `0.4`), `keywordWeight` sets how much keyword matches count, and `searchDescription={false}` keeps ids and URLs out of the search. Groups with no matches hide, and string titles highlight the matched letters. `commandMatch(query, text)` is the scorer, and `CommandHighlight` the highlighter, for custom rows.

## Parts

| Part | Props |
| --- | --- |
| `CommandMenu` | `variant` (`inline` · `dialog`), `isOpen` / `defaultOpen` / `onOpenChange`, `hotkey` (`'mod+k'`), `query` / `onQueryChange`, `defaultPages`, `onPageChange`, `loop`, `closeOnSelect` (dialogs default true), `escapeBehavior`, `filter`, `ranking`, `menuRef`, `container` (where the dialog portals). |
| `CommandInput` | `placeholder`, `backButton`, `pageTitle`, `trailing`. |
| `CommandList` | `maxHeight` (360), `stickyHeadings`, or a function child `(page) => …`. |
| `CommandGroup` | `heading`, `columns` (a grid), `forceMount`. |
| `CommandItem` | `icon` (an Icon name or a node), `title`, `description`, `shortcut` (`'⇧⌘O'` or an array of caps), `badge`, `page`, `chevron`, `disabled` (skipped, unselectable), `dimmed` (grey but selectable), `onSelect`, `closeOnSelect`, `keywords`, `value`, `boost`, `keywordWeight`, `searchDescription`; or custom `children`. |
| `CommandEmpty` | Shown when a query matches nothing on the page. |
| `CommandFooter` | `legend` (`true`, `false` or your own `{ keys, label }[]`), children on the right. |

`useCommandActive()` returns the active row's `value`, for preview panes. `useHotkey(hotkey, handler)` and `matchesHotkey(event, hotkey)` handle `mod+k`-style shortcuts (`mod` is ⌘ on Apple platforms, Ctrl elsewhere). Letters, digits and named keys (`space`, `enter`, `escape`, arrows…) match by physical key, so `alt+space` works on a Mac, where ⌥Space types a non-breaking space.

The card's fill is the `--command-surface` variable (default `--popover`); sticky group headings share it, so recolour the menu by setting the variable rather than a background class. A translucent card would tint twice under a sticky heading: give headings an opaque `--command-heading-surface`, or pass `stickyHeadings={false}` so they scroll with their rows.

## Examples

### Nested pages

"New thread in…" drills into a numbered project list; "Add project" into sources where one is dimmed behind a Setup Required badge. Backspace or the back arrow returns with the row you came from still active.

{% demo src="command-menu/nested-pages" %}

### ⌘K dialog

`variant="dialog"` with `hotkey="mod+k"`. `container` portals it into a layer inside the host, so the scrim covers just this frame and the palette keeps the host's theme.

{% demo src="command-menu/dialog" %}

### Emoji grid

`columns` turns a group into a grid with two-dimensional arrows; the footer reads the active cell with `useCommandActive()`.

{% demo src="command-menu/emoji-grid" %}

### Computed results

A calculator page: `filter={false}` because its rows are computed from the query, and its `onKeyDown` makes `=` commit like Enter. Backspace on the empty input goes back to the apps.

{% demo src="command-menu/computed-results" %}
