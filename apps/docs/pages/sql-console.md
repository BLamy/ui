# SqlConsole

A SQL workbench for a PGlite database: a highlighted editor, a schema tree, a result table per statement, errors that point at the offending token, history, and SQL / data-directory export and import. It composes four parts you can also use alone — `SqlEditor`, `ResultTable` (react-aria's Table), `SchemaTree` (react-aria's Tree) and the `useSchema` hook. It reads its database from a [PGliteProvider](https://blamy.github.io/ui/#/pglite), so read that page first for installing the engine, the WebAssembly download and where data is stored.

{% tabs title="Installation" sync="install" %}
{% tab title="shadcn CLI" %}
{% command %}npx shadcn@latest add https://blamy.github.io/ui/r/sql-console.json{% endcommand %}

Copies the source into your project's `components/ui/` (with the parts it is built from) and adds BL UI's tokens to your CSS — no runtime package. It is yours to edit. Import from your alias:

```tsx
import { SqlConsole } from '@/components/ui/sql-console'
import { SqlEditor } from '@/components/ui/sql-editor'
import { ResultTable } from '@/components/ui/result-table'
import { SchemaTree } from '@/components/ui/schema-tree'
```
{% endtab %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/ui{% endcommand %}

Import the stylesheet once at your app's entry, then the parts from the package root:

```tsx
import '@brett_lamy/ui/styles.css'

import {
  SqlConsole, SqlEditor, ResultTable, SchemaTree,
} from '@brett_lamy/ui'
```
{% endtab %}
{% endtabs %}

## Usage

Put the console under a provider. Clicking a table in the Schema tab (or pressing Enter on it) pastes `select * from … limit 100;` at the cursor. ⌘/Ctrl + Enter runs the selection, or everything when nothing is selected; ⌥↑ / ⌥↓ step through history and Escape brings your draft back.

{% demo src="sql-console/console" %}

```tsx
<PGliteProvider migrations={seed}>
  <SqlConsole defaultValue="select * from books;" historyKey="my-app-sql-history" />
</PGliteProvider>
```

A script of several statements runs through `exec`, so each statement gets its own result (a table for a `select`, `INSERT · 2 rows affected` for a write). A script without its own `BEGIN` / `COMMIT` is **one implicit transaction**: if a statement fails, none of the script was applied, and the console says so. If you did write a `BEGIN`, the console ends the aborted transaction for you so the next run works.

The header shows the Postgres and PGlite versions and the data directory, and the export / import buttons: **Export SQL** (the portable backup), **Export data dir** (same Postgres major only — the notice says so) and **Import…**, which applies a SQL dump to the open database. Importing a dump into a database that already has those objects fails with `nothing was changed`. A data-directory archive cannot be loaded into a running database; see `importDatabase` on the PGlite page.

{% demo src="sql-console/persistent" %}

## Errors

An error shows the message, the SQLSTATE, the line with a caret under the column (like psql's `LINE 2:`), Postgres's detail and hint, and — when the text that ran is still what is in the editor — a wavy underline under the token. A database that cannot be opened because it was written by another Postgres major shows both versions and that the data was left untouched, with a retry button.

## ResultTable

A grid with a sticky header and one column per field, each labelled with its type. Cells are type-aware: `NULL` in italics, numbers right-aligned in tabular figures, `numeric` kept as exact text, dates as ISO (`date` as `YYYY-MM-DD`, `timestamp` as local time, `timestamptz` as UTC), bytea as hex, arrays and JSON compact in the cell. A value that is long, multi-line or structured has an **Expand** button that shows it whole (JSON pretty-printed). The toolbar says how many rows came back and how long it took, and copies the rows as CSV (RFC 4180) or JSON.

Rows render in pages (`maxRows`, then "Show more"): there is no virtualization, and a result of a hundred thousand rows belongs in a `limit`. Two columns with the same name collapse into one, because PGlite returns rows as objects; alias them. Arrow keys move between cells; the first column is the row header.

{% demo src="sql-console/result-table" %}

```tsx
<ResultTable result={{ fields, rows, command: 'SELECT' }} durationMs={3.2} resizable />
```

## SchemaTree

Schemas → tables and views → columns, on react-aria's Tree: arrow keys move, → expands and ← collapses, Enter or a click on a table calls `onSelectTable`. A column shows its type, a key for the primary key, `→ table.column` for a foreign key, and a heavier name when it is `NOT NULL`. Tables show their row count (`rowCounts: 'exact'` by default; use `'estimate'` or `'none'` for large databases). A schema that appears later (`create schema`) opens by itself.

{% demo src="sql-console/schema-tree" %}

```tsx
const { schema, isLoading } = useSchema()
<SchemaTree schema={schema} isLoading={isLoading} onSelectTable={(t) => editor.current?.insert(`select * from ${t.name};`)} />
```

## SqlEditor

A `<textarea>` (react-aria's `TextArea`) over a highlighted copy of its own text, so selection, IME, undo and mobile keyboards are the browser's and no editor library ships. Highlighting is `lib/sql-lex`, a small PostgreSQL lexer: keywords, types, functions, `'strings'`, `$$ bodies $$`, numbers and nested comments, computed synchronously. The page's shared highlighter (`SyntaxHighlighting`, gpu-lexer) was tried first: its no-WebGPU fallback is C-family shaped, so `--` comments and `select` / `where` are not recognised — and headless browsers have no hardware GPU — hence the dedicated lexer, which feeds the same `bl-tok-*` colors.

Tab keeps its job of moving focus, so there is no indenting; that is deliberate (a keyboard trap fails accessibility). `ref` exposes `focus()` and `insert(text)`. `useSqlHistory(key?)` keeps the statements you ran, in localStorage when you pass a key (read after mount, so it is SSR-safe).

## Accessibility

The result table is a grid (`role="grid"`, one tab stop, arrow keys inside); the schema tree is a tree with the same keyboard model; the editor is a labelled textarea whose highlighted copy is `aria-hidden`. Errors use `role="alert"`, status lines `role="status"`. The tests run axe on the loaded console in light and dark. Small secondary text uses `text-foreground/65` rather than `text-muted-foreground`, and the Run button is ink on paper, because the iOS palette's muted gray and white-on-blue are below WCAG AA contrast at these sizes.

## Props

### SqlConsole

| Prop | Default | Effect |
| --- | --- | --- |
| `defaultValue` | `''` | The editor's initial text. |
| `historyKey` | — | Keep history in localStorage under this key. |
| `layout` | `split` | `split` puts the schema beside the editor from `md` up; `stacked` is one column. |
| `sidebar` | `true` | Show the Schema / History column. |
| `transfer` | `true` | Show Export SQL, Export data dir and Import…. |
| `autoRun` | `false` | Run `defaultValue` once the database is ready. |
| `timing` | `true` | Show durations (turn off where the screen must be reproducible). |
| `resultMaxHeight` | `18rem` | Height cap of each result table. |
| `headerActions` | — | Extra header content. |
| `onRun` | — | Called with the SQL and its outcome after each run. |
| `className` / `style` | — | Merged onto the root (`data-slot="sql-console"`). |

### SqlEditor

| Prop | Default | Effect |
| --- | --- | --- |
| `value` / `defaultValue` / `onChange` | — | Controlled or uncontrolled text. |
| `onRun` | — | ⌘/Ctrl + Enter or the Run button; receives the selection or the whole text. |
| `isRunning` | `false` | Disables Run and shows "Running…". |
| `history` | — | Earlier statements, newest first (⌥↑ / ⌥↓). |
| `error` | — | `{ position }` — underlines that character position. |
| `highlight` | `true` | SQL highlighting (skipped past 200,000 characters). |
| `size` | `default` | `sm` 4 rows, `default` 8, `lg` 14. |
| `actions` / `footer` / `runLabel` | — | Footer content, `false` to hide it, the button label. |

### ResultTable

| Prop | Default | Effect |
| --- | --- | --- |
| `result` | — | `{ fields: { name, dataTypeID }[], rows, command?, rowCount? }`. |
| `durationMs` | — | Shown in the summary. |
| `maxRows` | `200` | Rows before "Show more". |
| `resizable` | `false` | Drag column edges. |
| `toolbar` | `true` | Summary and Copy CSV / Copy JSON. |
| `maxHeight` | `24rem` | Height cap of the scrolling grid. |
| `density` | `compact` | `comfortable` for touch. |
| `emptyMessage` / `onCopy` | — | Text for no rows; callback after a copy. |

### SchemaTree

| Prop | Default | Effect |
| --- | --- | --- |
| `schema` | — | From `useSchema()` / `loadSchema()`; `null` while loading. |
| `isLoading` | — | Skeleton rows until the first schema arrives. |
| `onSelectTable` / `onSelectColumn` | — | Enter or click on a table or column. |
| `defaultExpandAll` | `false` | Open tables as well as schemas at first. |
| `variant` | `default` | `card` puts it on its own card. |

## Styling

Slots: `sql-console`, `sql-console-header`, `sql-console-sidebar`, `sql-console-results`, `sql-console-error`, `sql-console-notice`, `sql-editor`, `sql-editor-input`, `sql-editor-highlight`, `sql-editor-footer`, `result-table`, `result-table-toolbar`, `result-table-summary` and `schema-tree`. Variants are `sqlConsoleVariants`, `sqlEditorVariants`, `resultTableVariants` and `schemaTreeVariants`.

## cva recipes

Generated from the source. Call a recipe on any element to borrow a component's look; in a registry-installed copy, change `defaultVariants` to change the default. All recipes are listed in the [Variants reference](https://blamy.github.io/ui/#/variants).

### `resultTableVariants`

Defined in `@/components/ui/result-table`. Base classes:

```text
flex min-h-0 min-w-0 flex-col overflow-hidden rounded-panel bg-card text-card-foreground shadow-hairline
```

**`density`** — default `compact`

| Value | Adds |
| --- | --- |
| `compact` (default) | `[--result-pad:calc(var(--spacing)*1.5)]` |
| `comfortable` | `[--result-pad:calc(var(--spacing)*2.5)]` |

### `schemaTreeVariants`

Defined in `@/components/ui/schema-tree`. Base classes:

```text
flex min-h-0 min-w-0 flex-col text-footnote text-foreground outline-none
```

**`variant`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | — |
| `card` | `rounded-panel bg-card p-1 shadow-hairline` |

### `sqlConsoleVariants`

Defined in `@/components/ui/sql-console`. Base classes:

```text
flex min-h-0 min-w-0 flex-col gap-3 text-foreground
```

**`layout`** — default `split`

| Value | Adds |
| --- | --- |
| `split` (default) | `md:grid md:grid-cols-[minmax(11rem,16rem)_minmax(0,1fr)] md:items-start` |
| `stacked` | — |

### `sqlEditorVariants`

Defined in `@/components/ui/sql-editor`. Base classes:

```text
flex min-w-0 flex-col overflow-hidden rounded-panel bg-card text-card-foreground shadow-hairline transition-shadow duration-spring-snappy ease-spring-snappy focus-within:ring-2 focus-within:ring-primary focus-within:ring-inset
```

**`size`** — default `default`

| Value | Adds |
| --- | --- |
| `default` (default) | `[--editor-rows:8]` |
| `sm` | `[--editor-rows:4]` |
| `lg` | `[--editor-rows:14]` |
