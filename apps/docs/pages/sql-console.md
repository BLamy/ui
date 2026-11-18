# SqlConsole

A SQL workbench for a PGlite database: a highlighted editor, the schema, a result table per statement, errors that point at the offending token, history, and SQL / data-directory export and import. It is made of parts you can leave out, reorder or add to: `SqlConsoleHeader`, `SqlConsoleSidebar` (the schema, a [Tree](https://blamy.github.io/ui/#/tree) over `schemaTreeItems(schema)`, and the history), `SqlConsoleEditor` (the SQL editor) and `SqlConsoleResults` (a [DataTable](https://blamy.github.io/ui/#/data-table) per statement). It reads its database from a [PGliteProvider](https://blamy.github.io/ui/#/pglite), so read that page first for installing the engine, the WebAssembly download and where data is stored.

Use a sibling instead for a code box that isn't SQL ([CodeEditor](https://blamy.github.io/ui/#/code-editor)), for a table of rows you already have ([DataTable](https://blamy.github.io/ui/#/data-table)) or cells people edit ([Spreadsheet](https://blamy.github.io/ui/#/spreadsheet)), or for a shell ([Terminal](https://blamy.github.io/ui/#/terminal)).

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/sql-console.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from), adds BL UI's tokens to your CSS and installs `@brett_lamy/ui` for UI SDK, which the copied files import by the package's name (`@brett_lamy/ui/sdk/…`). The copied source is yours to edit. Import from your alias:

```tsx
import { SqlConsole } from '@/components/ui/sql-console'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from their module (the SQL library's entry, `@brett_lamy/ui/sql`, has them too):

```tsx
import '@brett_lamy/ui/styles.css'

import { SqlConsole } from '@brett_lamy/ui/sql-console'
```
{% endtab %}
{% endtabs %}

## Usage

Put the console under a provider. Clicking a table in the Schema tab (or pressing Enter on it) pastes `select * from … limit 100;` at the cursor. ⌘ + Enter (Ctrl + Enter off Apple platforms) runs the selection, or everything when nothing is selected; ↑ on the editor's first line and ↓ on its last step through history, like a terminal, and ↓ past the newest brings your draft back (UI SDK's `createInputHistory`).

{% demo src="sql-console/console" %}

```tsx
<PGliteProvider migrations={seed}>
  <SqlConsole defaultValue="select * from books;" historyKey="my-app-sql-history" />
</PGliteProvider>
```

A script of several statements runs through `exec`, so each statement gets its own result (a table for a `select`, `INSERT · 2 rows affected` for a write). A script without its own `BEGIN` / `COMMIT` is **one implicit transaction**: if a statement fails, none of the script was applied, and the console says so. If you did write a `BEGIN`, the console ends the aborted transaction for you so the next run works.

The header shows the Postgres and PGlite versions and the data directory, and the **Database** menu: **Export SQL** (the portable backup), **Export data directory** (same Postgres major only — the notice says so) and **Import…**, which applies a SQL dump to the open database. Importing a dump into a database that already has those objects fails with `nothing was changed`. A data-directory archive cannot be loaded into a running database; see `importDatabase` on the PGlite page.

{% demo src="sql-console/persistent" %}

## Parts

With no children the console is the whole workbench. Write its parts out to leave one out, reorder them or add your own:

```tsx
<SqlConsole defaultValue="select now();">
  <SqlConsoleHeader>
    <DatabasePicker />
    <SqlConsoleDatabaseMenu />
  </SqlConsoleHeader>
  <SqlConsoleEditor rows={4} />
  <SqlConsoleResults />
</SqlConsole>
```

- `SqlConsoleHeader`: the versions and where the data lives, then its children at the end (default `<SqlConsoleDatabaseMenu />`; `{false}` for nothing), and the notices of an export or import under it.
- `SqlConsoleDatabaseMenu`: Export SQL, Export data directory and Import…, in one menu.
- `SqlConsoleSidebar`: the Schema and History tabs. It fills the height the editor and the results make, and the schema scrolls inside it. With a sidebar, the console puts it beside the editor from its `medium` size class up; without one, the console is one column at any width.
- `SqlConsoleEditor`: the SQL editor (below), with its text, Run, history and error squiggle wired to the console. It takes the editor's own props (`rows`, `highlight`, `placeholder`, `children` for the footer…).
- `SqlConsoleResults`: the last run, a table per statement or the error.

The layout follows the console's own width (its size class, written as `data-size-class`), not the viewport's, so a narrow column on a wide screen is one column.

The text in the editor is the console's: `defaultValue` to start with, or `value` with `onValueChange(value, details)` to own it, to open a saved query or put one in from a button outside the console. Pressing a table in the schema or an entry in the history writes the text too, as an `imperative` change.

```tsx
const [sql, setSql] = useState(saved.sql)

<SqlConsole value={sql} onValueChange={setSql} historyKey="my-app" />
```

## Errors

An error shows the message, the SQLSTATE, the line with a caret under the column (like psql's `LINE 2:`), Postgres's detail and hint, and — when the text that ran is still what is in the editor — a wavy underline under the token, with the editor in its invalid state: a destructive ring, `aria-invalid`, and `aria-describedby` pointing at the error, so a screen reader hears it again when focus returns to the editor. A database that cannot be opened because it was written by another Postgres major shows both versions and that the data was left untouched, with a retry button.

## Results

Each statement's result is a [DataTable](https://blamy.github.io/ui/#/data-table) named "Result 1", "Result 2"…: one column per field, its header labelled with the type (`int4 books`), numbers lined up at the end in tabular figures (with the header). In a compact console the rows stack: the first field is the row's title and the others follow as `name value` pairs, so a value never loses its column. Cells are type-aware: `NULL` in italics, `numeric` kept as exact text, dates as ISO (`date` as `YYYY-MM-DD`, `timestamp` as local time, `timestamptz` as UTC), bytea as hex, arrays and JSON compact in the cell. A value that is long, multi-line or structured has a button that shows all of it in a popover (JSON pretty-printed), with Copy. Columns start at the width of their values, and sort, resize and scroll like any DataTable's: a hundred thousand rows only render the ones in view. The toolbar says how many rows came back and how long it took, and copies the rows as CSV (RFC 4180) or JSON. A write shows its summary (`INSERT · 2 rows affected`) instead of a table, and a script captions each table with its statement.

Each table is at most 18rem tall; set `--sql-console-result-height` on the console (or the results) to change it. Two columns with the same name collapse into one, because PGlite returns rows as objects; alias them.

## Schema tree

Schemas → tables and views → columns is a [Tree](https://blamy.github.io/ui/#/tree) over `schemaTreeItems(schema)`: arrow keys move, → expands and ← collapses, and Enter or a click on a row calls `onAction(value, details)`, where `details.node` is a `SchemaTreeNode` with its `kind` (`schema`, `table` or `column`), the `table` and, for a column, the `column`. A column's detail is its type, `→ table.column` for a foreign key and `not null`; a primary key wears a key. A table's detail is its kind (when it isn't a plain table) and row count (`rowCounts: 'exact'` by default; use `'estimate'` or `'none'` for large databases). `autoExpand` with the schemas' values opens a schema that appears later (`create schema`), and one you closed stays closed. While `loading` with no rows yet, the tree is `aria-busy` and shows placeholder rows; `emptyState` says what an empty database shows. The same `schema` always gives the same items, so the call can sit in render.

{% demo src="sql-console/schema-tree" %}

```tsx
const { schema, loading } = useSchema()
const items = schemaTreeItems(schema)

<Tree aria-label="Database schema" items={items} icons={false} density="compact"
  loading={loading} emptyState={<EmptyState size="sm" title="No tables yet" />} autoExpand={items.map((n) => n.value)}
  onAction={(_value, { node }) => {
    const n = node as SchemaTreeNode
    if (n.kind === 'table') editor.current?.insert(`select * from ${n.table.name};`)
  }} />
```

## The editor

`SqlConsoleEditor` is a `<textarea>` (UI SDK's `Textarea`) over a highlighted copy of its own text, so selection, IME, undo, spell-check, mobile keyboards and accessibility are the browser's, and no editor library ships. That editing model is why it is not a [CodeEditor](https://blamy.github.io/ui/#/code-editor), which draws its own selection to stay smooth on huge files; both paint with the same `bl-tok-*` colors. Highlighting is `lib/sql-lex`, a small PostgreSQL lexer: keywords, types, functions, `'strings'`, `$$ bodies $$`, numbers and nested comments, computed synchronously.

Inside a `SqlConsole` it takes its text, Run, pending state, history and the last error from the console. Outside one it is a SQL box of its own, controlled or uncontrolled, for a query field in a form or a saved-report editor:

```tsx
const history = useSqlHistory('reports')

<SqlConsoleEditor value={sql} onValueChange={setSql} onRun={run} pending={running} history={history.entries} rows={6}
  errorPosition={error?.position} aria-describedby={error ? 'report-error' : undefined}>
  <SqlConsoleEditorFooter>
    <Button variant="ghost" size="sm" onClick={format}>Format</Button>
  </SqlConsoleEditorFooter>
</SqlConsoleEditor>
```

Tab keeps its job of moving focus, so there is no indenting; that is deliberate (a keyboard trap fails accessibility). `ref` exposes `focus()` and `insert(text)`. `useSqlHistory(key?)` keeps the statements you ran, in localStorage when you pass a key (read after mount, so it is SSR-safe). `errorPosition` is Postgres's 1-based character `position`: it underlines the token there and makes the editor invalid; an invalid `Field` around it does the same.

Its footer is a part: with no children the editor shows `<SqlConsoleEditorFooter />` (the shortcut hint, shown once the editor has room for it, and Run). Put your controls before Run with `<SqlConsoleEditorFooter>…</SqlConsoleEditorFooter>`, build a footer of your own around `<SqlConsoleEditorRun />`, or pass `{false}` for none.

## Accessibility

Each result table is a DataTable grid (`role="grid"`, one tab stop, ↑ ↓ between rows, ↑ from the first row to the headers, Tab through a row's buttons); the schema tree is a tree with the same keyboard model; the editor is a labelled textarea whose highlighted copy is `aria-hidden`. Errors use `role="alert"`; status lines (starting, export/import notices, result counts) stay visible and are read out once through UI SDK's `announce()`. The tests run axe on the loaded console in light and dark. Small secondary text uses `text-foreground/65` rather than `text-muted-foreground`, and the Run button is ink on paper (Button's `contrast` variant), because the iOS palette's muted gray (about 3.5:1 on white) and white-on-blue are below WCAG AA contrast at these sizes.

## Props

### SqlConsole

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `defaultValue` / `onValueChange` | — / `''` | The editor's text, controlled or uncontrolled; `onValueChange(value, details)`. |
| `historyKey` | — | Keep history in localStorage under this key (it follows runs in other tabs too). |
| `autoRun` | `false` | Run `defaultValue` once the database is ready. |
| `timing` | `true` | Show durations (turn off where the screen must be reproducible). |
| `onRun` | — | Called with the SQL and its outcome after each run. |
| `children` | header, sidebar, editor, results | The parts, in order. |
| `className` / `style` / `ref` | — | On the root (`data-slot="sql-console"`, with `data-status` and `data-size-class`). |

`SqlConsoleHeader` takes `children` (default `<SqlConsoleDatabaseMenu />`) and the `<header>`'s props; `SqlConsoleSidebar` and `SqlConsoleResults` take their element's props; All of them but `SqlConsoleEditor` must be inside a `SqlConsole`.

### SqlConsoleEditor

Inside a console, `value`, `defaultValue`, `onRun`, `pending`, `history` and `errorPosition` are the console's (set the text on `SqlConsole`); `onValueChange` is called as well as the console's.

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `defaultValue` / `onValueChange` | — | Controlled or uncontrolled text; `onValueChange(value, details)`. |
| `onRun` | — | ⌘ + Enter (Ctrl + Enter off Apple platforms) or the Run button; receives the selection or the whole text. |
| `pending` | `false` | A run is in flight: Run is disabled and reads "Running…" (`data-pending` on the root). |
| `disabled` / `readOnly` | `false` | The textarea's own states (`data-disabled` on the editor root). |
| `history` | — | Earlier statements, newest first (↑ on the first line, ↓ on the last). |
| `errorPosition` | — | Postgres's 1-based `position`: underlines the token there; the editor is invalid (`aria-invalid`, `data-invalid`, a destructive ring). |
| `aria-label` / `aria-describedby` | `"SQL"` / — | The textarea's name and description (in a console, its error is added). |
| `highlight` | `true` | SQL highlighting (skipped past 200,000 characters). |
| `rows` | `8` | Lines shown before the text scrolls. |
| `children` | `<SqlConsoleEditorFooter />` | The footer; `{false}` for none. |

`SqlConsoleEditorFooter` takes `children` (before Run) and a div's props; `SqlConsoleEditorRun` takes Button's props (default `variant="contrast"`, `size="sm"`, children "Run").

### `schemaTreeItems(schema)`

Takes a `SchemaInfo` from `useSchema()` / `loadSchema()` (or `null` while loading, which gives no rows) and returns `SchemaTreeNode[]` for `Tree`'s `items`. Values are `schema:<name>`, `table:<schema>.<name>` and `column:<schema>.<table>.<name>`. The tree's own props are on the [Tree page](https://blamy.github.io/ui/#/tree).

## Styling

Slots: `sql-console`, `sql-console-header`, `sql-console-notice`, `sql-console-sidebar`, `sql-console-results`, `sql-console-summary` (a result's summary line), `sql-console-error`, `sql-console-stacked-fields` (a stacked row's `name value` line), `sql-console-editor` (with `data-pending`, `data-disabled` and `data-invalid`), `textarea` (the editor's input), `sql-console-editor-highlight` and `sql-console-editor-footer`. A result table is a DataTable (`data-table` and its parts), whose cells carry `data-kind` (`null`, `number`, `text`, `date`, `json`, `bytea`, `boolean`); the schema tree is a Tree's `tree-view`.
