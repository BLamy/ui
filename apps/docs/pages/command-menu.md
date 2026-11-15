# CommandMenu

A command palette: a search field over grouped, fuzzy-matched commands, with nested pages you open and go back from, shortcuts, a keyboard legend and ⌘1–⌘9 quick picks. It renders inline, or in a ⌘K dialog. It is UI SDK's [Command](https://ui-sdk.dev/docs/react/components/command) with the kit's look: the field keeps focus the whole time and the highlighted command follows with `aria-activedescendant`, so typing, arrows and Enter never fight over focus.

Use it for a launcher over many commands, places or records that people search by name. For a short list of actions on a button or an item, use a [DropdownMenu](https://blamy.github.io/ui/#/dropdown-menu); to pick a value for a form field by typing, use a [Combobox](https://blamy.github.io/ui/#/combobox).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/command-menu.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import {
  CommandMenu, CommandMenuInput, CommandMenuList,
  CommandMenuGroup, CommandMenuGroupLabel, CommandMenuItem,
} from '@/components/ui/command-menu'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  CommandMenu, CommandMenuInput, CommandMenuList,
  CommandMenuGroup, CommandMenuGroupLabel, CommandMenuItem,
} from '@brett_lamy/ui/command-menu'
```
{% endtab %}
{% endtabs %}

```tsx
import {
  CommandMenu, CommandMenuInput, CommandMenuEmpty, CommandMenuList, CommandMenuPage,
  CommandMenuGroup, CommandMenuGroupLabel, CommandMenuItem, CommandMenuFooter,
  CommandMenuDialog, CommandMenuDialogContent,
} from '@brett_lamy/ui/command-menu'
import { DialogTrigger } from '@brett_lamy/ui/dialog'
import { Button } from '@brett_lamy/ui/button'

<CommandMenuDialog>
  <DialogTrigger shortcut="mod+k" render={<Button variant="secondary" />}>
    Search…
  </DialogTrigger>
  <CommandMenuDialogContent aria-label="Command menu">
    <CommandMenu onAction={run}>
      <CommandMenuInput placeholder="Search commands..." />
      <CommandMenuEmpty>No results</CommandMenuEmpty>
      <CommandMenuList>
        <CommandMenuPage>
          <CommandMenuGroup>
            <CommandMenuGroupLabel>Actions</CommandMenuGroupLabel>
            <CommandMenuItem value="new-thread" icon="square-pencil" shortcut="mod+shift+o">New thread</CommandMenuItem>
            <CommandMenuItem icon="square-pencil" page="projects">New thread in…</CommandMenuItem>
            <CommandMenuItem icon="link" description={id} onSelect={copyId}>Copy thread ID</CommandMenuItem>
          </CommandMenuGroup>
        </CommandMenuPage>
        <CommandMenuPage value="projects" title="Projects" numbered>
          <CommandMenuGroup>…</CommandMenuGroup>
        </CommandMenuPage>
      </CommandMenuList>
      <CommandMenuFooter />
    </CommandMenu>
  </CommandMenuDialogContent>
</CommandMenuDialog>
```

Leave out the dialog parts and the same `CommandMenu` renders in place. The button that opens the dialog is the kit's `DialogTrigger` (from the Dialog module), styled with `render={<Button … />}` like every popup trigger.

A command's text is its children, as in every menu row: `<CommandMenuItem>New thread</CommandMenuItem>` (or the `title` prop, which takes any node). It sits beside the `icon`, over the `description`, and shows what the search matched in bold. A row of your own is a function child (`{(state) => …}`) or any non-text node, which replaces icon, title, description and trailing.

## Running commands

Enter, a click or a command's `shortcut` runs it: its `onSelect(event)` first, then the menu's `onAction(value, details)`, or, when it has a `page`, that page opens. `event.preventDefault()` in `onSelect` skips the rest. Return a Promise from either and the command is pending until it settles (`data-pending`, `aria-busy`); a rejection lands in its `error` state.

A command's `value` identifies it (default: its text, when that is a string). `shortcut` (`"mod+shift+o"`, `mod` being ⌘ on Apple platforms and Ctrl elsewhere) runs the command while the list is mounted, even when the search or the current page hides it, sets `aria-keyshortcuts`, and shows the keys for the platform (⇧⌘O, or Ctrl+Shift+O). To show keys the app handles itself, without registering them, pass `trailing={<CommandMenuShortcut shortcut="mod+p" />}`.

Inside a CommandMenuDialog, a command that runs closes the dialog (`closeOnSelect`, default true; a command's own `closeOnSelect` overrides it). A command that opens a page never closes it, and one whose action returns a Promise closes it once that settles.

## Keyboard

With the field focused (it always is):

| Keys | Effect |
| --- | --- |
| Typing | Filters the commands and highlights the best match. |
| `↑` `↓` · `Ctrl` `P` / `N` on Apple platforms | Move the highlight, wrapping at the ends unless `loop={false}`. Disabled commands are skipped. |
| `⌘` `↑` / `↓` · `PageUp` `PageDown` | The first / last command, or ten at a time. |
| `←` `→` | Inside a `columns` group: move within the grid (`↑` `↓` move a row and leave the grid at its edges). |
| `Enter` | Run the highlighted command, or open its `page`. |
| `⌘1`–`⌘9` (`Ctrl` elsewhere) | Run the Nth visible command. `numbered` pages show the keys. |
| `Backspace` in the empty field | Back one page, with that page's search text put back. Only a fresh press: holding Backspace to clear the search stops at empty. |
| `Esc` | Clears the search, then goes back a page, then closes the dialog. |

## Pages

`CommandMenuPage` elements go inside `CommandMenuList`; the one without a `value` is the first page, and only the current page's commands are mounted. Choosing a command with `page="…"` opens that page: the search clears, the search icon becomes a back button, the page's `title` shows as a chip before the field, and the footer adds Backspace Back. Going back puts back the search text you had typed and highlights the command you came from.

A page change moves in the direction of travel — the new page slides in from the right going forward and from the left going back — on the smooth spring, blurred at first, while the list's height springs to the new page (the tray spring). With reduced motion the page only fades.

| Prop | Effect |
| --- | --- |
| `value` | The page's name, which a command's `page` opens. Leave it out for the first page. |
| `placeholder` / `title` | The field's placeholder on this page, and a chip before the field. |
| `filter` | How typing narrows this page (see Filtering). `false` for rows computed from the search text (a calculator, a URL). |
| `numbered` | Show `⌘1`–`⌘9` on the first nine visible commands (the keys run them on every page). |
| `onKeyDown(event, controller)` | Runs before the menu's own keys; `event.preventDefault()` takes a key over. |

The pages are a stack: `pages` / `defaultPages` / `onPagesChange(pages, details)` on `CommandMenu` (`defaultPages={['projects']}` opens on a page, with Back to the first). `useCommandMenu()` returns `{ query, pages, page, controller }` from inside the menu, and `createCommandMenuController()` makes a controller to pass as `controller` and drive the menu from outside: `push(page)`, `pop()`, `setPages`, `setQuery`, `setValue` (move the highlight), `run(value?)`, `focus()`, and their getters. Every change callback gets `details.reason` (`'back'`, `'escape'`, `'list-navigation'`, …).

## Filtering

Typing narrows the commands with UI SDK's fuzzy matcher (the letters of the search, in order, in a command's text or its `keywords`), and string titles show what matched in bold. `filter` on `CommandMenu` or a page picks another rule: `'contains'`, `'startsWith'`, a function returning a score (0 hides) or a boolean, or `false` to keep every command (results a server already filtered). A command searches its title and description; when its content isn't plain text, `label` says what to search. Groups with no match hide, and separators hide while the list is filtered.

Commands written as children keep their order while filtering, with the best match highlighted. Pass them as data instead — `items` on `CommandMenu` (commands, plain strings, `{ type: 'group', label, items }` and `{ type: 'separator' }`; a command with its own `items` opens a page of them) and an empty `CommandMenuList` — and they are ranked as you type, best match first. `emptyItems` shows other commands (recent, suggested) while the search is empty.

For async results, pass `status` (`'loading'`, `'error'`, `'idle'`) and `filter={false}`, and render a `CommandMenuStatus` for the announcement: `{(state) => (state.loading ? 'Searching…' : null)}`. `onLoadMore` asks for more as the highlight or scrolling reaches the end.

## Parts

| Part | Props |
| --- | --- |
| `CommandMenu` | `query` / `defaultQuery` / `onQueryChange`, `pages` / `defaultPages` / `onPagesChange`, `value` / `defaultValue` / `onValueChange` (the highlight), `onAction`, `items`, `emptyItems`, `filter`, `autoHighlight`, `loop`, `status`, `onLoadMore`, `closeOnSelect`, `controller`. |
| `CommandMenuInput` | `placeholder` (first page), `backButton`, `pageTitle`, `trailing`, `autoFocus` (inline; in a dialog the dialog focuses it). |
| `CommandMenuList` | `stickyHeadings`; at most 360px tall (`className="max-h-…"` to change it). Without children it renders the menu's `items`. |
| `CommandMenuPage` | `value`, `placeholder`, `title`, `filter`, `numbered`, `onKeyDown`. |
| `CommandMenuGroup` · `CommandMenuGroupLabel` | `columns` (a grid) on the group; the label names it and sticks over its rows. |
| `CommandMenuItem` | `value`, `icon` (an Icon name or a node), text children or `title`, `description` (the option's accessible description, not part of its name), `trailing` (a Badge, keys), `shortcut`, `page`, `chevron`, `disabled` (skipped, can't run), `dimmed` (grey but runnable), `onSelect`, `closeOnSelect`, `label`, `keywords`; or a custom row (a non-text node, or a function of the command's state). |
| `CommandMenuItemIcon` · `CommandMenuItemText` · `CommandMenuItemDescription` · `CommandMenuShortcut` | The row's pieces, for custom rows. `CommandMenuItemText` bolds what matched; `CommandMenuShortcut` shows its command's `shortcut`, or its own. |
| `CommandMenuItems` | Renders data (`CommandMenuData`) as the kit's rows. |
| `CommandMenuEmpty` | Shown, and announced, while nothing matches: the kit's [EmptyState](https://blamy.github.io/ui/#/empty-state) (`icon`, `title` or text children, default "No results", `description`, `action`). Goes beside the list. |
| `CommandMenuStatus` | A polite live region for loading and result counts. |
| `CommandMenuSeparator` | A line between groups. |
| `CommandMenuFooter` | `legend` (`true`, `false` or your own `{ keys, label }[]`), children on the right. The default legend says Esc closes in a dialog, and Esc clears inline (only while there is a search). |
| `CommandMenuDialog` | The dialog's `open` / `defaultOpen` / `onOpenChange(open, details)`, `controller`, `container`. |
| `DialogTrigger` (Dialog's) | `shortcut` (`"mod+k"`) opens it from anywhere; `render={<Button … />}` for the kit's look. |
| `CommandMenuDialogContent` | The card hanging from the top of its host, and its scrim (`backdropClassName`). It is at most 640px tall and leaves 160px of its host free, so in a framed app it fits the frame. Name it with `aria-label` (default "Command menu"). |

`useCommandMenuValue()` returns the highlighted command's `value`, for preview panes and footers that follow the highlight.

The dialog renders into BLProvider's root, so its scrim covers the app it opened in; pass `container` to render it somewhere else. The card's fill is the `--command-surface` variable (default `--popover`); sticky group labels share it, so recolour the menu by setting the variable rather than a background class. A translucent card would tint twice under a sticky label: give labels an opaque `--command-heading-surface`, or pass `stickyHeadings={false}` so they scroll with their rows.

## Examples

### Nested pages

"New thread in…" opens a numbered project list; "Add project" opens sources where one is dimmed behind a Setup Required badge. Backspace or the back button returns with the command you came from highlighted.

{% demo src="command-menu/nested-pages" %}

### ⌘K dialog

`<DialogTrigger shortcut="mod+k">` opens it from anywhere on the page. `container` renders it into a layer inside the host, so the scrim covers just this frame and the palette keeps the host's theme.

{% demo src="command-menu/dialog" %}

### Emoji grid

`columns` turns a group into a grid with two-dimensional arrows; the footer reads the highlighted cell with `useCommandMenuValue()`.

{% demo src="command-menu/emoji-grid" %}

### Computed results

A calculator page: `filter={false}` because its rows are computed from the search text, and its `onKeyDown` makes `=` run the result like Enter. Backspace in the empty field goes back to the apps.

{% demo src="command-menu/computed-results" %}

## In the blocks

Two blocks are built around CommandMenu end to end. Open the file list in either preview to read how the pages, shortcuts and actions are wired.

### Alfred on a macOS desktop

Alfred as the launcher of a macOS desktop: type an app's name — Reminders, Mail, Notes, Music, GitHub and the rest of the examples — and press Enter, and it opens in a window you can drag, resize, zoom and minimize (the Dock does the same on a click). Beyond apps it is eight pages you open with Enter, a click or ⌘1–⌘9 — Calculator, Clipboard, Emoji, Snippets, Files, System, Web search and Workflows — each with its own keys, a preview pane beside the list, and a footer legend that follows the page. Backspace in the empty field goes back; ⌥Space hides and shows the bar.

{% demo src="blocks/macos" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/macos.json{% endcommand %}

### T3 Code palette

The ⌘K dialog after T3 Code's: Actions on the first page, "New thread in…" opening projects with ⌘1–⌘6, and "Add project" with sources dimmed behind a Setup Required badge. Click into the preview and press ⌘K, or use the search button in its header.

{% demo src="blocks/t3-clone" layout="multi" %}

{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/t3-clone.json{% endcommand %}
