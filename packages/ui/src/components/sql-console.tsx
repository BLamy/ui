'use client';
import {
  createContext, useCallback, useContext, useEffect, useId, useImperativeHandle, useMemo, useRef, useState,
  type ComponentProps, type CSSProperties, type KeyboardEvent, type ReactNode, type Ref, type RefObject,
} from 'react';
import { announce, createInputHistory, createLocalStorage } from '@ui-sdk/core';
import { formatFileSize } from '@/lib/file-size';
import { Textarea, createInputController, type TextareaOptions } from '@ui-sdk/react/textarea';
import { Badge } from '@/components/ui/badge';
import { Button, type ButtonProps } from '@/components/ui/button';
import { DataTable, DataTableCell, type DataTableColumn } from '@/components/ui/data-table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs';
import { Tree } from '@/components/ui/tree';
import { useControllableChange } from '@/lib/controllable-state';
import { SizeClassProvider, useSizeClass } from '@/lib/container';
import { fieldSortValue } from '@/lib/data-table-model';
import { Icon } from '@/lib/icon';
import { PGliteError, DataDirVersionError, identifier, runSql, type RunOutcome, type SqlError } from '@/lib/pglite-core';
import { useDatabaseStatus, type DatabaseState } from '@/lib/pglite';
import { downloadFile, pickFile } from '@/lib/pglite-files';
import { schemaTreeItems, useSchema, type SchemaTreeNode } from '@/lib/pglite-schema';
import { exportDatabase, importDatabase, type ExportFormat } from '@/lib/pglite-transfer';
import { calloutVariants, selectableText } from '@/lib/primitives';
import { formatCell, formatDuration, pgTypeName, pluralRows, toCsv, toJson, PG_TYPE, type FormattedCell } from '@/lib/sql-format';
import { sqlSpans, type SqlSpan } from '@/lib/sql-lex';
import { useCopy } from '@/lib/use-copy';
import { cn } from '@/lib/utils';

/* ══ SqlConsole — a database workbench for a PGlite database ══
   Put it under a PGliteProvider. With no children it is the whole workbench:

     <SqlConsole defaultValue="select now();" historyKey="my-app" />

   which is the same as writing its parts out, to leave one out, reorder them or add your own:

     <SqlConsole>
       <SqlConsoleHeader />    the Postgres and PGlite versions, what you put in it, and the Database menu (export / import)
       <SqlConsoleSidebar />   the schema (press a table to query it) and your history
       <SqlConsoleEditor />    the SQL editor: ⌘/Ctrl + Enter runs the selection, or everything
       <SqlConsoleResults />   a DataTable per statement, or the error with its line, caret, SQLSTATE and hint
     </SqlConsole>

   The editor's text is the console's `value` / `defaultValue` / `onValueChange`. `SqlConsoleEditor` also works on its
   own, outside a console, as a SQL box with Run, history and an error squiggle (see "The editor" below).

   A script with several statements runs through `exec`, so each gets its own result; one that fails says that, as a
   script is one implicit transaction, none of it was applied. The console follows its own width (its size class, on
   `data-size-class`), not the viewport's: with a sidebar, the schema sits beside the editor from `medium` up, and
   everything is one column when compact. Progress and outcomes are read out through UI SDK's `announce()`. */

const READS = /^(select|show|explain|values|table|with\b[\s\S]*?\bselect)/i;

type Notice = { text: string; tone: 'ok' | 'error'; detail?: string };

interface ConsoleContext {
  database: DatabaseState;
  ready: boolean;
  history: SqlHistory;
  value: string;
  setValue: (value: string, given?: { reason: InputValueChangeReason; event?: Event }) => void;
  run: (sql: string) => Promise<void>;
  pending: boolean;
  last: { sql: string; outcome: RunOutcome } | null;
  notice: Notice | null;
  timing: boolean;
  editor: RefObject<SqlConsoleEditorHandle | null>;
  /** The id of the error the editor's squiggle points at, while it is shown. */
  errorId: string;
  insertTable: (schema: string, table: string) => void;
  transfer: (action: ExportFormat | 'import') => Promise<void>;
}

const SqlConsoleContext = createContext<ConsoleContext | null>(null);

function useConsole(part: string): ConsoleContext {
  const context = useContext(SqlConsoleContext);
  if (!context) throw new Error(`${part} must be inside a SqlConsole`);
  return context;
}

/* ── Errors ── */

/** psql's `LINE 2: select …` with a caret under the column. */
function ErrorExcerpt({ sql, error }: { sql: string; error: SqlError }) {
  if (!error.line || !error.column) return null;
  const text = sql.split('\n')[error.line - 1] ?? '';
  const prefix = `LINE ${error.line}: `;
  return (
    <pre className="mt-2 overflow-x-auto rounded-ctl bg-card px-3 py-2 font-mono text-caption leading-snug text-foreground">
      {prefix}
      {text}
      {'\n'}
      {' '.repeat(prefix.length + error.column - 1)}
      <span className="text-destructive">^</span>
    </pre>
  );
}

function ErrorPanel({ id, title, error, sql, children, className }: { id?: string; title: string; error: SqlError; sql?: string; children?: ReactNode; className?: string }) {
  return (
    <div id={id} role="alert" data-slot="sql-console-error" className={cn(calloutVariants({ tone: 'destructive' }), className)}>
      <Icon name="exclamation-circle" size={16} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold text-destructive">{title}</span>
          {error.code ? <code className="font-mono text-caption text-foreground/65">SQLSTATE {error.code}</code> : null}
        </div>
        <p className="mt-0.5 break-words">{error.message}</p>
        {sql ? <ErrorExcerpt sql={sql} error={error} /> : null}
        {error.detail ? <p className="mt-1.5 text-foreground/65">Detail: {error.detail}</p> : null}
        {error.hint ? <p className="mt-1.5 text-foreground/65">Hint: {error.hint}</p> : null}
        {children}
      </div>
    </div>
  );
}

/* ── The root ── */

type InputValueChangeReason = Parameters<NonNullable<TextareaOptions['onValueChange']>>[1]['reason'];

export interface SqlConsoleProps extends Omit<ComponentProps<'div'>, 'onError' | 'defaultValue'> {
  /** The editor's text, controlled: open a saved query, or put one in from a button outside the console. */
  value?: string;
  /** The editor's initial text. */
  defaultValue?: string;
  /** Every change to the editor's text: typing (`input-change`), a history step, a table pressed in the schema or a
      history entry put back (`imperative`). Cancel it to keep the text. */
  onValueChange?: TextareaOptions['onValueChange'];
  /** Keep the history in localStorage under this key. */
  historyKey?: string;
  /** Called after each run (also failed ones). */
  onRun?: (sql: string, outcome: RunOutcome) => void;
  /** Run `defaultValue` once the database is ready (default false). */
  autoRun?: boolean;
  /** Show how long statements took (default true). Turn it off where the screen must be reproducible. */
  timing?: boolean;
  /** The parts, in order. Default: header, sidebar, editor and results. */
  children?: ReactNode;
  ref?: Ref<HTMLDivElement>;
}

/** The summary of one result: "4 rows", "INSERT · 2 rows affected". */
function summaryOf(result: RunOutcome['results'][number]): string {
  if (result.fields.length) return pluralRows(result.rows.length);
  return `${result.command ?? 'OK'}${result.rowCount !== undefined ? ` · ${pluralRows(result.rowCount)} affected` : ''}`;
}

export function SqlConsole({
  value: valueProp, defaultValue = '', onValueChange, historyKey, onRun, autoRun = false, timing = true, className, ref, children, ...props
}: SqlConsoleProps) {
  const [sizeRef, sizeClass] = useSizeClass();
  const root = useRef<HTMLDivElement | null>(null);
  const setRoot = useCallback((el: HTMLDivElement | null) => {
    root.current = el;
    sizeRef(el);
    assignRef(ref, el);
  }, [sizeRef, ref]);
  const say = useCallback((text: string) => announce(text, { doc: root.current?.ownerDocument }), []);
  const database = useDatabaseStatus();
  const { status, db, invalidate } = database;
  const history = useSqlHistory(historyKey);
  const [value, setText] = useControllableChange<string, InputValueChangeReason>(valueProp, defaultValue, onValueChange);
  const setValue = useCallback((next: string, given?: { reason: InputValueChangeReason; event?: Event }) => {
    setText(next, given);
  }, [setText]);
  const errorId = useId();
  const [pending, setPending] = useState(false);
  const [last, setLast] = useState<{ sql: string; outcome: RunOutcome } | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const editor = useRef<SqlConsoleEditorHandle>(null);

  const run = useCallback(async (sql: string) => {
    if (!db) return;
    setPending(true);
    setNotice(null);
    history.push(sql);
    const outcome = await runSql(db, sql);
    setLast({ sql, outcome });
    // Anything that is not a plain read may have changed the schema or the row counts.
    if (!outcome.error && outcome.results.some((r) => !(r.statement && READS.test(r.statement)) && !(r.command && /^(SELECT|SHOW|EXPLAIN)$/.test(r.command)))) invalidate();
    setPending(false);
    onRun?.(sql, outcome);
  }, [db, history, invalidate, onRun]);

  const transfer = useCallback(async (action: ExportFormat | 'import') => {
    if (!db) return;
    if (action === 'import') {
      const file = await pickFile('.sql,.tar,.gz,.tgz,application/sql,application/gzip');
      if (!file) return;
      setNotice(null);
      try {
        const result = await importDatabase(db, file);
        invalidate();
        setNotice({
          tone: 'ok',
          text: `Imported ${file.name}${result.sourceVersion ? ` (dumped from Postgres ${result.sourceVersion})` : ''}.`,
          detail: result.warnings.join(' ') || undefined,
        });
      } catch (e) {
        setNotice({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
      }
      return;
    }
    setNotice(null);
    try {
      const out = await exportDatabase(db, action);
      downloadFile(out.file);
      setNotice({
        tone: 'ok',
        text: `Exported ${out.file.name} (${formatFileSize(out.bytes)}) from Postgres ${out.postgresVersion}.`,
        detail: action === 'datadir' ? `This archive restores only into Postgres ${out.postgresMajor}. Keep a SQL export as the portable backup.` : undefined,
      });
    } catch (e) {
      setNotice({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
    }
  }, [db, invalidate]);

  const insertTable = useCallback((schemaName: string, table: string) => {
    const qualified = schemaName === 'public' ? identifier(table) : `${identifier(schemaName)}.${identifier(table)}`;
    const text = `select * from ${qualified} limit 100;`;
    if (editor.current && value.trim()) editor.current.insert(`${value.endsWith('\n') ? '' : '\n'}${text}`);
    else {
      setValue(text);
      editor.current?.focus();
    }
  }, [value, setValue]);

  const ready = status === 'ready' && !!db;

  // Status lines stay visible; screen readers hear them once, when they change.
  useEffect(() => {
    if (status === 'loading') say('Starting PostgreSQL…');
  }, [status, say]);
  useEffect(() => {
    if (notice?.tone === 'ok') say(notice.detail ? `${notice.text} ${notice.detail}` : notice.text);
  }, [notice, say]);
  useEffect(() => {
    if (!last || last.outcome.error) return;
    const { results, durationMs } = last.outcome;
    if (results.length === 0) say('Nothing to run.');
    else if (results.length === 1) say(`${summaryOf(results[0])}${timing ? ` · ${formatDuration(durationMs)}` : ''}`);
    else say(timing ? `${results.length} statements in ${formatDuration(durationMs)}` : `${results.length} results`);
  }, [last, timing, say]);

  const ran = useRef(false);
  useEffect(() => {
    if (autoRun && ready && !ran.current && defaultValue.trim()) {
      ran.current = true;
      void run(defaultValue.trim());
    }
  }, [autoRun, ready, run, defaultValue]);

  const context: ConsoleContext = { database, ready, history, value, setValue, run, pending, last, notice, timing, editor, errorId, insertTable, transfer };
  const openError = status === 'error' ? database.error : null;
  return (
    <SizeClassProvider value={sizeClass}>
      <SqlConsoleContext.Provider value={context}>
        <div
          ref={setRoot}
          data-slot="sql-console"
          data-status={status}
          className={cn(
            'flex min-h-0 min-w-0 flex-col gap-3 text-foreground',
            // With a sidebar, it sits beside the editor and the results from `medium` up.
            'data-[size-class=medium]:has-[>[data-slot=sql-console-sidebar]]:grid data-[size-class=regular]:has-[>[data-slot=sql-console-sidebar]]:grid',
            'grid-cols-[minmax(11rem,16rem)_minmax(0,1fr)] grid-rows-[auto_auto_auto] [grid-template-areas:"header_header"_"side_editor"_"side_results"]',
            className,
          )}
          {...props}
        >
          {children ?? (
            <>
              <SqlConsoleHeader />
              <SqlConsoleSidebar />
              <SqlConsoleEditor />
              <SqlConsoleResults />
            </>
          )}
          {openError ? (
            <ErrorPanel
              className="[grid-area:results]"
              title={openError instanceof DataDirVersionError ? 'This database was made by a different Postgres version' : 'Could not open the database'}
              error={{ message: openError.message, code: openError instanceof PGliteError ? openError.code : undefined }}
            >
              <div className="mt-2"><Button size="sm" variant="secondary" onClick={database.retry}>Try again</Button></div>
            </ErrorPanel>
          ) : null}
        </div>
      </SqlConsoleContext.Provider>
    </SizeClassProvider>
  );
}

/* ── The header ── */

/** Export and import, in one menu: a SQL dump (portable) or the data directory (same Postgres version only). */
export function SqlConsoleDatabaseMenu({ className }: { className?: string }) {
  const { ready, transfer } = useConsole('SqlConsoleDatabaseMenu');
  if (!ready) return null;
  return (
    <DropdownMenu onAction={(action) => { void transfer(action as ExportFormat | 'import'); }}>
      <DropdownMenuTrigger render={<Button size="sm" variant="secondary" className={cn('gap-1', className)} />}>
        Database
        <Icon name="chevron-down" size={12} sw={2.2} />
      </DropdownMenuTrigger>
      <DropdownMenuContent aria-label="Database" side="bottom" align="end">
        <DropdownMenuItem value="sql">Export SQL</DropdownMenuItem>
        <DropdownMenuItem value="datadir">Export data directory</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem value="import">Import…</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface SqlConsoleHeaderProps extends Omit<ComponentProps<'header'>, 'children'> {
  /** After the versions, at the end: a database picker, a delete button. Default `<SqlConsoleDatabaseMenu />`;
   *  `false` for nothing. */
  children?: ReactNode;
}

/** The versions of Postgres and PGlite and where the data lives, your controls, and the notices of an export or import. */
export function SqlConsoleHeader({ children, className, ...props }: SqlConsoleHeaderProps) {
  const { database, ready, notice } = useConsole('SqlConsoleHeader');
  const { info, status } = database;
  return (
    <div className="flex min-w-0 flex-col gap-2 [grid-area:header]">
      <header data-slot="sql-console-header" className={cn('flex flex-wrap items-center gap-2', className)} {...props}>
        {ready && info ? (
          <>
            <Badge variant="secondary" title={`PGlite ${info.pgliteVersion ?? ''}`}>PostgreSQL {info.serverVersion}</Badge>
            <Badge variant="secondary" title={info.worker ? 'Running in a Web Worker' : 'Running on the main thread'}>{info.dataDir}{info.worker ? ' · worker' : ''}</Badge>
            {info.kind === 'memory' ? <span className="text-caption text-foreground/65">Gone when you reload</span> : null}
          </>
        ) : status === 'loading' ? (
          <span className="flex items-center gap-2 text-footnote text-foreground/65"><Spinner size={14} /> Starting PostgreSQL…</span>
        ) : null}
        <span className="flex-1" />
        {children === undefined ? <SqlConsoleDatabaseMenu /> : children}
      </header>
      {notice ? (
        notice.tone === 'error' ? (
          <ErrorPanel title="Could not finish" error={{ message: notice.text }} />
        ) : (
          <p data-slot="sql-console-notice" className="m-0 text-footnote text-foreground/65">
            {notice.text}
            {notice.detail ? ` ${notice.detail}` : ''}
          </p>
        )
      ) : null}
    </div>
  );
}

/* ── The sidebar ── */

type HistoryRow = { id: string; sql: string };
const HISTORY_COLUMNS: DataTableColumn<HistoryRow>[] = [
  { id: 'sql', header: 'Statement', flex: 1, sortable: false, className: 'font-mono', cell: (row) => <span title={row.sql}>{row.sql.replace(/\s+/g, ' ')}</span> },
];

/** The schema of the open database (press a table to put a query for it in the editor) and the statements you ran,
 *  in two tabs. It fills the height beside the editor and the results. */
export function SqlConsoleSidebar({ className, ...props }: ComponentProps<'aside'>) {
  const { database, ready, history, setValue, editor, insertTable } = useConsole('SqlConsoleSidebar');
  const { schema, loading } = useSchema();
  const items = useMemo(() => schemaTreeItems(schema), [schema]);
  const rows = useMemo(() => history.entries.map((sql): HistoryRow => ({ id: sql, sql })), [history.entries]);
  if (database.status === 'error') return null;
  return (
    <aside data-slot="sql-console-sidebar" className={cn('relative min-h-80 min-w-0 [grid-area:side]', className)} {...props}>
      {/* Out of the flow, so a long schema scrolls in the room the editor and results make rather than growing the row. */}
      <Tabs variant="segmented" defaultValue="schema" className="absolute inset-0 flex flex-col gap-2">
        <TabsList aria-label="Sidebar">
          <TabsTab value="schema">Schema</TabsTab>
          <TabsTab value="history">History{history.entries.length ? ` (${history.entries.length})` : ''}</TabsTab>
        </TabsList>
        <TabsPanel value="schema" className="flex min-h-0 flex-1 flex-col">
          <Tree
            aria-label="Database schema"
            items={items}
            icons={false}
            density="compact"
            loading={loading || !ready}
            emptyState={<EmptyState size="sm" title="No tables yet" />}
            // Schemas open as they appear; tables stay closed until opened.
            autoExpand={items.map((n) => n.value)}
            onAction={(_id, { node }) => {
              const n = node as SchemaTreeNode | undefined;
              if (n?.kind === 'table') insertTable(n.table.schema, n.table.name);
            }}
            className="min-h-0 flex-1 rounded-panel bg-card p-1 shadow-hairline"
          />
        </TabsPanel>
        <TabsPanel value="history" className="flex min-h-0 flex-1 flex-col">
          <DataTable<HistoryRow>
            aria-label="History"
            rows={rows}
            columns={HISTORY_COLUMNS}
            density="compact"
            presentation="table"
            mode="none"
            onAction={(_id, { row }) => { setValue(row.sql); editor.current?.focus(); }}
            emptyState={<EmptyState size="sm" title="No history yet" description="Statements you run appear here." />}
          />
        </TabsPanel>
      </Tabs>
    </aside>
  );
}

/* ── The editor ──
   A SQL box on UI SDK's Textarea: a native <textarea> sits over a highlighted copy of its own text, so selection, IME,
   undo, accessibility and mobile keyboards are the browser's and nothing heavy (no CodeMirror / Monaco) ships. That
   editing model is why it is not a CodeEditor, which draws its own selection. Highlighting is lib/sql-lex (keywords,
   types, functions, strings incl. $$ bodies, numbers, comments), computed synchronously; `errorPosition` underlines
   the offending token and marks the box invalid.

   ⌘ + Enter (Ctrl + Enter off Apple platforms: the Textarea's `mod+enter` submit shortcut) runs the selection, or
   everything when nothing is selected. ↑ on the first line and ↓ on the last step through `history` with UI SDK's
   `createInputHistory`, like a terminal: ↓ past the newest brings your draft back. Tab keeps its job of moving focus
   (indenting would trap keyboard users). `ref` exposes `focus()` and `insert(text)`.

   Inside a SqlConsole its text, Run, pending, history and the last error come from the console; outside one it is a
   controlled or uncontrolled editor of its own. The footer is a part: with no children the editor shows
   `<SqlConsoleEditorFooter />` (the shortcut hint and Run); give it children to put your own controls there, or
   `{false}` for none. `SqlConsoleEditorRun` is the Run button on its own. */

const editorClass = cn(
  'flex min-w-0 flex-col overflow-hidden rounded-panel bg-card text-card-foreground shadow-hairline transition-shadow duration-spring-snappy ease-spring-snappy',
  'focus-within:ring-2 focus-within:ring-primary focus-within:ring-inset',
  // Invalid (an error position, or a Field's invalid on the textarea): the field's destructive ring.
  'data-invalid:shadow-[inset_0_0_0_1.5px_var(--destructive)] has-[textarea[aria-invalid=true]]:shadow-[inset_0_0_0_1.5px_var(--destructive)]',
);

/** Same metrics on the textarea and its highlighted copy, or the two drift apart. */
const metrics = 'box-border m-0 border-0 px-3 py-2.5 font-mono text-footnote leading-5 [tab-size:2] whitespace-pre';

export interface SqlConsoleEditorHandle {
  focus: () => void;
  /** Inserts text at the cursor (replacing the selection) and focuses the editor. */
  insert: (text: string) => void;
}

export interface SqlConsoleEditorProps extends Omit<ComponentProps<'div'>, 'children' | 'defaultValue' | 'ref'> {
  /** The text. In a SqlConsole, the console's (set `value` / `defaultValue` there). */
  value?: string;
  defaultValue?: string;
  /** Every change to the text, with the Textarea's `details`: typing is `input-change`; a history step and `insert()`
      are `imperative`. Canceling a history step leaves the text and the arrow key to the browser. In a SqlConsole it is
      called as well as the console's. */
  onValueChange?: TextareaOptions['onValueChange'];
  /** ⌘/Ctrl + Enter, or the Run button. Receives the selection, or the whole text. In a SqlConsole: the console runs it. */
  onRun?: (sql: string) => void;
  /** A statement is running: Run is disabled and reads "Running…" (`data-pending` on the root). */
  pending?: boolean;
  /** How many lines show before the text scrolls (default 8). */
  rows?: number;
  /** Earlier statements, newest first (see `useSqlHistory`); ↑ on the first line and ↓ on the last step through them. */
  history?: readonly string[];
  /** Where the error is, 1-based in characters, as Postgres reports it (`SqlError.position`): the token there is
      underlined and the editor is invalid (`aria-invalid`, `data-invalid`). In a SqlConsole: the last failed run's. */
  errorPosition?: number | null;
  /** Highlight SQL (default true; skipped past 200k characters). */
  highlight?: boolean;
  placeholder?: string;
  disabled?: boolean;
  readOnly?: boolean;
  autoFocus?: boolean;
  /** The footer. Default `<SqlConsoleEditorFooter />`; `false` or `null` for none. */
  children?: ReactNode;
  /** The textarea's name (default "SQL"). */
  'aria-label'?: string;
  /** Elements that describe the textarea: the error message it points at. In a SqlConsole, its error panel is added. */
  'aria-describedby'?: string;
  ref?: Ref<SqlConsoleEditorHandle>;
}

const HIGHLIGHT_LIMIT = 200_000;

const SQUIGGLE = 'underline decoration-destructive decoration-wavy decoration-from-font underline-offset-2';

type Segment = { text: string; className?: string };

/** The source cut at every span and error boundary, each piece with its token class (and the squiggle on the error). */
function segmentsOf(code: string, spans: readonly SqlSpan[], errorAt: number | null): Segment[] {
  let errStart = -1;
  let errEnd = -1;
  if (errorAt !== null && errorAt >= 0 && errorAt < code.length) {
    const word = /^[\w$\u0080-￿]+/.exec(code.slice(errorAt));
    errStart = errorAt;
    errEnd = errorAt + (word ? word[0].length : 1);
  }
  const cuts = new Set<number>([0, code.length]);
  for (const s of spans) {
    cuts.add(s.start);
    cuts.add(s.end);
  }
  if (errStart >= 0) {
    cuts.add(errStart);
    cuts.add(Math.min(errEnd, code.length));
  }
  const bounds = [...cuts].filter((n) => n >= 0 && n <= code.length).sort((a, b) => a - b);
  const out: Segment[] = [];
  let k = 0; // index of the first span that may still cover the current piece
  for (let i = 0; i + 1 < bounds.length; i++) {
    const a = bounds[i];
    const b = bounds[i + 1];
    while (k < spans.length && spans[k].end <= a) k++;
    const span = k < spans.length && spans[k].start <= a ? spans[k] : undefined;
    const bad = a >= errStart && b <= errEnd && errStart >= 0;
    out.push({ text: code.slice(a, b), className: cn(span && `bl-tok bl-tok-${span.type}`, bad && SQUIGGLE) || undefined });
  }
  return out;
}

interface EditorState {
  run: () => void;
  pending: boolean;
  disabled: boolean;
  empty: boolean;
  hasHistory: boolean;
}

const EditorContext = createContext<EditorState | null>(null);

function useEditor(part: string): EditorState {
  const context = useContext(EditorContext);
  if (!context) throw new Error(`${part} must be inside a SqlConsoleEditor`);
  return context;
}

export type SqlConsoleEditorRunProps = Omit<ButtonProps, 'onClick' | 'disabled'>;

/** The Run button: runs the selection, or everything. Disabled with nothing to run, while a run is pending, and when
 *  the editor is disabled. Ink on paper (`contrast`) rather than white on the accent blue, which is 3.7:1 at this size. */
export function SqlConsoleEditorRun({ children, variant = 'contrast', size = 'sm', ...props }: SqlConsoleEditorRunProps) {
  const { run, pending, disabled, empty } = useEditor('SqlConsoleEditorRun');
  return (
    <Button variant={variant} size={size} disabled={disabled || pending || empty} onClick={run} {...props}>
      {pending ? 'Running…' : (children ?? 'Run')}
    </Button>
  );
}

export interface SqlConsoleEditorFooterProps extends ComponentProps<'div'> {
  /** Controls before Run. */
  children?: ReactNode;
}

/** The footer: the shortcut hint (shown once the editor, not the window, has room for it), your controls, and Run. */
export function SqlConsoleEditorFooter({ children, className, ...props }: SqlConsoleEditorFooterProps) {
  const { hasHistory } = useEditor('SqlConsoleEditorFooter');
  return (
    <div data-slot="sql-console-editor-footer" className={cn('@container/sql-footer flex shrink-0 items-center gap-2 px-2 py-1.5 shadow-hairline-t', className)} {...props}>
      <KbdGroup className="hidden min-w-0 flex-1 text-caption text-foreground/65 @md/sql-footer:inline-flex">
        <Kbd keys="mod+enter" />
        <span className="truncate">runs the selection, or everything</span>
        {hasHistory ? (
          <>
            <Kbd keys="arrowup" />
            <span className="truncate">history</span>
          </>
        ) : null}
      </KbdGroup>
      <span className="flex-1 @md/sql-footer:hidden" />
      {children}
      <SqlConsoleEditorRun />
    </div>
  );
}

/** The SQL editor. In a SqlConsole it is the console's (its text, Run, history and the last error come from there);
    on its own it is a SQL box with Run, history and an error squiggle. */
export function SqlConsoleEditor(props: SqlConsoleEditorProps) {
  const host = useContext(SqlConsoleContext);
  if (!host) return <Editor {...props} />;
  return <ConsoleEditor host={host} {...props} />;
}

function ConsoleEditor({ host, className, onValueChange, disabled, ref, 'aria-describedby': describedBy, ...props }: SqlConsoleEditorProps & { host: ConsoleContext }) {
  const { database, ready, value, setValue, run, pending, history, last, editor, errorId } = host;
  const setRef = useCallback((handle: SqlConsoleEditorHandle | null) => {
    editor.current = handle;
    if (typeof ref === 'function') ref(handle);
    else if (ref) ref.current = handle;
  }, [editor, ref]);
  if (database.status === 'error') return null;
  // The squiggle (and the alert it points at) only while the text is still what failed.
  const failed = last?.outcome.error && last.sql === value.trim() ? last.outcome.error : null;
  return (
    <Editor
      placeholder="select now();"
      {...props}
      ref={setRef}
      value={value}
      onValueChange={(next, details) => {
        onValueChange?.(next, details);
        if (!details.canceled) setValue(next, { reason: details.reason, event: details.event });
      }}
      onRun={(sql) => void run(sql)}
      pending={pending}
      disabled={!ready || disabled}
      history={history.entries}
      errorPosition={failed?.position ?? null}
      aria-describedby={cn(describedBy, failed && errorId) || undefined}
      className={cn('h-fit [grid-area:editor]', className)}
    />
  );
}

function Editor({
  value: valueProp, defaultValue = '', onValueChange, onRun, pending = false, history, errorPosition, highlight = true, placeholder,
  disabled, readOnly, autoFocus, rows = 8, children, className, style, ref, 'aria-label': ariaLabel = 'SQL',
  'aria-describedby': describedBy, ...props
}: SqlConsoleEditorProps) {
  const [inner, setInner] = useState(defaultValue);
  const controlled = valueProp !== undefined;
  const value = controlled ? valueProp : inner;
  // Writes from here (a history step, `insert`) go through the Textarea's controller, so they reach
  // `onValueChange` like typing does.
  const [input] = useState(createInputController);
  const setValue = useCallback((v: string) => { input.setValue(v); }, [input]);

  const areaRef = useRef<HTMLTextAreaElement>(null);
  const layerRef = useRef<HTMLPreElement>(null);
  const syncScroll = useCallback(() => {
    const a = areaRef.current;
    if (a && layerRef.current) layerRef.current.style.translate = `${-a.scrollLeft}px ${-a.scrollTop}px`;
  }, []);

  useImperativeHandle(ref, () => ({
    focus: () => areaRef.current?.focus(),
    insert: (text: string) => {
      const a = areaRef.current;
      if (!a) return;
      const from = a.selectionStart ?? a.value.length;
      const to = a.selectionEnd ?? from;
      const next = a.value.slice(0, from) + text + a.value.slice(to);
      setValue(next);
      requestAnimationFrame(() => {
        a.focus();
        a.setSelectionRange(from + text.length, from + text.length);
      });
    },
  }), [setValue]);

  // History: ArrowUp on the first line goes back, ArrowDown on the last goes forward and past the newest returns
  // the draft. `createInputHistory` takes the entries oldest first and leaves modified, composing, selecting,
  // read-only and expanded-popup key presses alone.
  const historyRef = useRef(history);
  useEffect(() => { historyRef.current = history; }, [history]);
  const [recall] = useState(() => createInputHistory<string>({
    entries: () => (historyRef.current ? [...historyRef.current].reverse() : undefined),
    read: () => areaRef.current?.value ?? '',
    // Textarea's reasons have no `history-key` yet (gaps/r2-leaf.md), so a step is the controller's `imperative`,
    // which takes no event. `setValue` reports false for an unchanged value too, which is still a step.
    write: (v) => input.setValue(v) || areaRef.current?.value === v,
  }));

  const run = () => {
    const a = areaRef.current;
    if (!a || pending || !onRun) return;
    const selected = a.selectionStart !== a.selectionEnd ? a.value.slice(a.selectionStart, a.selectionEnd) : '';
    const sql = (selected || a.value).trim();
    if (sql) onRun(sql);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    recall.keydown(e.nativeEvent);
  };

  const spans = useMemo(() => (highlight && value.length <= HIGHLIGHT_LIMIT ? sqlSpans(value) : []), [highlight, value]);
  const errorAt = errorPosition ? errorPosition - 1 : null;
  const invalid = errorAt !== null && errorAt >= 0;
  const segments = useMemo(() => segmentsOf(value, spans, errorAt), [value, spans, errorAt]);

  const context: EditorState = {
    run, pending, disabled: !!disabled || !onRun, empty: !value.trim(), hasHistory: !!history?.length,
  };
  return (
    <EditorContext.Provider value={context}>
      <div
        data-slot="sql-console-editor"
        data-disabled={disabled || undefined}
        data-pending={pending || undefined}
        data-invalid={invalid || undefined}
        className={cn(editorClass, className)}
        style={{ '--editor-rows': rows, ...style } as CSSProperties}
        {...props}
      >
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {/* The highlighted copy: decoration, not content (the textarea is what assistive tech reads). */}
          <pre
            ref={layerRef}
            aria-hidden="true"
            data-slot="sql-console-editor-highlight"
            className={cn(metrics, 'pointer-events-none absolute top-0 left-0 min-w-full text-card-foreground')}
          >
            {segments.map((s, i) => (s.className ? <span key={i} className={s.className}>{s.text}</span> : s.text))}
            {'\n'}
          </pre>
          <Textarea
            ref={areaRef}
            controller={input}
            aria-label={ariaLabel}
            aria-invalid={invalid || undefined}
            aria-describedby={describedBy}
            value={value}
            onValueChange={(next, details) => {
              onValueChange?.(next, details);
              if (details.canceled) return;
              if (!controlled) setInner(next);
            }}
            submitShortcut="mod+enter"
            onSubmit={run}
            onKeyDown={onKeyDown}
            onScroll={syncScroll}
            placeholder={placeholder}
            disabled={disabled}
            readOnly={readOnly}
            autoFocus={autoFocus}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            wrap="off"
            className={cn(
              metrics,
              'bl-scroll relative block h-[calc(var(--editor-rows)*1.25rem+1.25rem)] w-full resize-none overflow-auto bg-transparent text-transparent caret-foreground outline-none selection:bg-primary/25 placeholder:text-foreground/65',
              selectableText,
            )}
          />
        </div>

        {children === undefined ? <SqlConsoleEditorFooter /> : children}
      </div>
    </EditorContext.Provider>
  );
}

/* ── History ── */

export interface SqlHistory {
  /** Newest first. */
  entries: string[];
  /** Records a statement run (blank ones and a repeat of the newest are skipped). */
  push: (sql: string) => void;
  clear: () => void;
}

const parseEntries = (raw: string | null, max: number): string[] => {
  if (!raw) return [];
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string').slice(0, max) : [];
  } catch {
    return []; // a corrupt value: start empty
  }
};

/** Statements you ran, newest first. Pass a `key` to keep them in localStorage (UI SDK's `createLocalStorage`): they
    last across reloads and follow other tabs' runs. Read after mount, so it is SSR safe. SqlConsole keeps one (its
    `historyKey`); give one to a SqlConsoleEditor of your own as `history={entries}`. */
export function useSqlHistory(key?: string, max = 50): SqlHistory {
  const storage = useMemo(() => (key ? createLocalStorage(key) : undefined), [key]);
  const [entries, setEntries] = useState<string[]>([]);
  // The newest list, for writes that land before React re-renders (two runs in one tick).
  const latest = useRef<string[]>([]);
  useEffect(() => {
    if (!storage) return;
    const load = (raw: string | null) => {
      const next = parseEntries(raw, max);
      if (JSON.stringify(next) === JSON.stringify(latest.current)) return;
      latest.current = next;
      setEntries(next);
    };
    load(storage.get());
    return storage.subscribe(load);
  }, [storage, max]);
  const commit = useCallback((next: string[]) => {
    latest.current = next;
    setEntries(next);
    if (!storage) return;
    if (next.length) storage.set(JSON.stringify(next));
    else storage.remove();
  }, [storage]);
  const push = useCallback((sql: string) => {
    const s = sql.trim();
    const prev = latest.current;
    if (!s || prev[0] === s) return;
    commit([s, ...prev.filter((p) => p !== s)].slice(0, max));
  }, [max, commit]);
  const clear = useCallback(() => commit([]), [commit]);
  return { entries, push, clear };
}

/* ── The results ── */

/** The type OIDs whose values line up at the end, in tabular figures. */
const NUMERIC = new Set<number>([PG_TYPE.int2, PG_TYPE.int4, PG_TYPE.int8, PG_TYPE.float4, PG_TYPE.float8, PG_TYPE.numeric, PG_TYPE.money, PG_TYPE.oid]);
const EXPAND_AT = 60;

type ResultRow = { id: number; values: Record<string, unknown> };
type Result = RunOutcome['results'][number];

/** One cell: the formatted value, and for a long, multi-line or structured one, a button that shows all of it. */
function ResultCell({ value, oid, name }: { value: unknown; oid?: number; name: string }) {
  const cell = formatCell(value, oid);
  const { copy, copied } = useCopy();
  const expandable = isExpandable(cell);
  return (
    <span data-kind={cell.kind} className={cn('flex min-w-0 items-center gap-1', cell.align === 'end' && 'justify-end')}>
      <span
        className={cn(
          'min-w-0 truncate',
          cell.kind === 'null' && 'text-foreground/65 italic',
          (cell.kind === 'json' || cell.kind === 'bytea') && 'font-mono text-caption',
          cell.kind === 'boolean' && 'font-medium',
          selectableText,
        )}
      >
        {cell.text}
      </span>
      {expandable ? (
        <Popover>
          <PopoverTrigger render={<Button variant="ghost" size="icon-sm" aria-label={`Show all of ${name}`} className="size-5 shrink-0 text-foreground/65" />}>
            <Icon name="chevron-down" size={12} sw={2.2} />
          </PopoverTrigger>
          <PopoverContent className="flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <PopoverTitle className="truncate font-mono">{name}</PopoverTitle>
              <Button variant="ghost" size="sm" onClick={() => void copy(cell.full)}>{copied ? 'Copied' : 'Copy'}</Button>
            </div>
            <pre className={cn('m-0 max-h-72 overflow-auto rounded-ctl bg-secondary p-2 font-mono text-caption leading-snug break-all whitespace-pre-wrap', selectableText)}>{cell.full}</pre>
          </PopoverContent>
        </Popover>
      ) : null}
    </span>
  );
}

/** Whether a cell gets the button that shows all of its value. */
function isExpandable(cell: FormattedCell): boolean {
  return cell.kind !== 'null' && (cell.full.length > EXPAND_AT || cell.full.includes('\n') || (cell.kind === 'json' && cell.full !== cell.text));
}

/** A column a field's values fit: about the width of its longest value in the first rows (and its button), between 72
 *  and 320 px. */
function widthOf(name: string, oid: number | undefined, rows: readonly Record<string, unknown>[]): number {
  let chars = name.length + pgTypeName(oid).length * 0.8 + 1;
  let button = 0;
  for (let i = 0; i < Math.min(rows.length, 200); i++) {
    const cell = formatCell(rows[i][name], oid);
    chars = Math.max(chars, cell.text.length);
    if (isExpandable(cell)) button = 24;
  }
  return Math.round(Math.min(320, Math.max(72, chars * 7.4 + 24 + button)));
}

/** The result's fields as DataTable columns: typed headers, type-aware cells, numbers at the end, sized to their values. */
function resultColumns(result: Result): DataTableColumn<ResultRow>[] {
  const seen = new Map<string, number>();
  return result.fields.map(({ name, dataTypeID: oid }) => {
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    const end = oid !== undefined && NUMERIC.has(oid);
    const type = <span className="text-caption2 font-normal text-foreground/65">{pgTypeName(oid)}</span>;
    return {
      id: n > 1 ? `${name}~${n}` : name,
      label: name,
      header: end ? <>{type} {name}</> : <>{name} {type}</>,
      align: end ? 'end' : 'start',
      width: widthOf(name, oid, result.rows),
      minWidth: 48,
      cell: (row) => <ResultCell value={row.values[name]} oid={oid} name={name} />,
      sortValue: (row) => {
        const v = row.values[name];
        return end && typeof v === 'string' ? Number(v) : fieldSortValue(row.values, name);
      },
    };
  });
}

const noCount = () => null;

function QueryResult({ result, durationMs, label }: { result: Result; durationMs: number | undefined; label: string }) {
  const rows = useMemo(() => result.rows.map((values, id): ResultRow => ({ id, values })), [result.rows]);
  const columns = useMemo(() => resultColumns(result), [result]);
  const { copy, copied } = useCopy<'csv' | 'json'>();
  // Stacked (a compact console), a value means little without its column: the first field is the row's title, and the
  // others follow as `name value` pairs.
  const renderStackedRow = useCallback((row: ResultRow) => {
    const [first, ...rest] = result.fields;
    return (
      <DataTableCell col={0} className="flex min-w-0 flex-1 flex-col gap-1">
        {first ? (
          <span className="min-w-0 leading-[18px] font-medium">
            <ResultCell value={row.values[first.name]} oid={first.dataTypeID} name={first.name} />
          </span>
        ) : null}
        {rest.length ? (
          <span data-slot="sql-console-stacked-fields" className="flex h-[18px] min-w-0 items-baseline gap-x-3 overflow-hidden text-caption whitespace-nowrap">
            {rest.map(({ name, dataTypeID: oid }, i) => (
              <span key={i} className="flex min-w-0 shrink-0 items-baseline gap-1">
                <span className="text-foreground/65">{name}</span>
                <span className={cn('max-w-48 truncate', oid !== undefined && NUMERIC.has(oid) && 'tabular-nums')}>{formatCell(row.values[name], oid).text}</span>
              </span>
            ))}
          </span>
        ) : null}
      </DataTableCell>
    );
  }, [result.fields]);
  const summary = `${summaryOf(result)}${durationMs !== undefined ? ` · ${formatDuration(durationMs)}` : ''}`;
  const said = <span data-slot="sql-console-summary" className="min-w-0 flex-1 truncate text-footnote text-foreground/65 tabular-nums">{summary}</span>;
  if (!result.fields.length) {
    return <div role="group" aria-label={label} className="flex min-h-9 items-center rounded-panel bg-card px-3 py-1 shadow-hairline">{said}</div>;
  }
  return (
    <DataTable<ResultRow>
      aria-label={label}
      rows={rows}
      columns={columns}
      mode="none"
      // The toolbar already counts the rows; stacked, the header keeps only the sort menu.
      countLabel={noCount}
      renderStackedRow={renderStackedRow}
      className="max-h-(--sql-console-result-height,18rem)"
      emptyState={<EmptyState size="sm" title="No rows" />}
      toolbar={(
        <>
          {said}
          {rows.length ? (
            <>
              <Button variant="ghost" size="sm" onClick={() => void copy(toCsv(result), 'csv')}>{copied === 'csv' ? 'Copied' : 'Copy CSV'}</Button>
              <Button variant="ghost" size="sm" onClick={() => void copy(toJson(result), 'json')}>{copied === 'json' ? 'Copied' : 'Copy JSON'}</Button>
            </>
          ) : null}
        </>
      )}
    />
  );
}

/** The last run: a DataTable per statement (each named "Result 1", "Result 2"…, with its summary and Copy CSV / JSON),
 *  or the error. Each table is at most 18rem tall: set `--sql-console-result-height` to change it. */
export function SqlConsoleResults({ className, ...props }: ComponentProps<'div'>) {
  const { database, last, timing, errorId } = useConsole('SqlConsoleResults');
  if (database.status === 'error' || !last) return null;
  const { outcome, sql } = last;
  if (outcome.error) {
    return (
      <ErrorPanel id={errorId} className={cn('h-fit [grid-area:results]', className)} title="Query failed" error={outcome.error} sql={sql}>
        {outcome.statementCount > 1 && !/\b(begin|start\s+transaction)\b/i.test(sql) ? (
          <p className="mt-1.5 text-foreground/65">The script ran as one transaction, so none of its {outcome.statementCount} statements were applied.</p>
        ) : null}
      </ErrorPanel>
    );
  }
  const many = outcome.results.length > 1;
  return (
    <div data-slot="sql-console-results" className={cn('flex h-fit min-w-0 flex-col gap-3 [grid-area:results]', className)} {...props}>
      {outcome.results.length === 0 ? <p className="m-0 text-footnote text-foreground/65">Nothing to run.</p> : null}
      {outcome.results.map((result, i) => (
        <figure key={i} className="m-0 flex min-w-0 flex-col gap-1">
          {/* Only a script needs to say which statement a table answers: one statement is the editor's. */}
          {many ? (
            <figcaption className="truncate font-mono text-caption text-foreground/65" title={result.statement}>
              {i + 1}. {result.statement ?? result.command}
            </figcaption>
          ) : null}
          <QueryResult result={result} durationMs={timing && !many ? outcome.durationMs : undefined} label={`Result ${i + 1}`} />
        </figure>
      ))}
      {timing && many ? <p className="m-0 text-caption text-foreground/65">{outcome.results.length} statements in {formatDuration(outcome.durationMs)}</p> : null}
    </div>
  );
}

function assignRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}
