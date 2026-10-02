'use client';
import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ResultTable } from '@/components/ui/result-table';
import { SchemaTree } from '@/components/ui/schema-tree';
import { SqlEditor, useSqlHistory, type SqlEditorHandle } from '@/components/ui/sql-editor';
import { Spinner } from '@/components/ui/spinner';
import { Tab, TabList, TabPanel, Tabs } from '@/components/ui/tabs';
import { PGliteError, DataDirVersionError, identifier, runSql, type RunOutcome, type SqlError } from '@/lib/pglite-core';
import { useDatabaseStatus } from '@/lib/pglite';
import { useSchema } from '@/lib/pglite-schema';
import { downloadFile, pickFile } from '@/lib/pglite-files';
import { exportDatabase, importDatabase, type ExportFormat } from '@/lib/pglite-transfer';
import { formatBytes } from '@/lib/format-bytes';
import { formatDuration } from '@/lib/sql-format';
import { cn } from '@/lib/utils';

/* ══ SqlConsole — a database workbench in one component ══
   Put it under a PGliteProvider. Left: the schema tree (click a table to paste `select * from …`) and your history.
   Right: the editor (⌘/Ctrl + Enter runs the selection, or everything) and a result table per statement. A script
   with several statements runs through `exec`, so each gets its own result; one that fails shows the error with the
   line, a caret under the column, the SQLSTATE and Postgres's hint, and — because a script is one implicit
   transaction — says that none of it was applied. The header shows the Postgres and PGlite versions and exports /
   imports: a SQL dump (portable) or the data directory (same Postgres version only). */

export const sqlConsoleVariants = cva('flex min-h-0 min-w-0 flex-col gap-3 text-foreground', {
  variants: {
    layout: {
      /** Schema beside the editor from the `md` breakpoint up. */
      split: 'md:grid md:grid-cols-[minmax(11rem,16rem)_minmax(0,1fr)] md:items-start',
      /** Everything in one column. */
      stacked: '',
    },
  },
  defaultVariants: { layout: 'split' },
});

export interface SqlConsoleProps extends Omit<ComponentProps<'div'>, 'children' | 'onError'>, VariantProps<typeof sqlConsoleVariants> {
  /** The editor's initial text. */
  defaultValue?: string;
  /** Keep the history in localStorage under this key. */
  historyKey?: string;
  /** Show the schema / history column (default true). */
  sidebar?: boolean;
  /** Show export / import in the header (default true). */
  transfer?: boolean;
  /** Called after each run (also failed ones). */
  onRun?: (sql: string, outcome: RunOutcome) => void;
  /** Extra header content (a database picker, a delete button). */
  headerActions?: ReactNode;
  /** The result tables' height cap (CSS length, default `18rem`). */
  resultMaxHeight?: string;
  /** Run `defaultValue` once the database is ready (default false). */
  autoRun?: boolean;
  /** Show how long statements took (default true). Turn it off where the screen must be reproducible. */
  timing?: boolean;
}

const READS = /^(select|show|explain|values|table|with\b[\s\S]*?\bselect)/i;

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

function ErrorPanel({ title, error, sql, children }: { title: string; error: SqlError; sql?: string; children?: ReactNode }) {
  return (
    <div role="alert" data-slot="sql-console-error" className="rounded-panel bg-destructive/10 px-3 py-2.5 text-footnote">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-semibold text-destructive">{title}</span>
        {error.code ? <code className="font-mono text-caption text-foreground/65">SQLSTATE {error.code}</code> : null}
      </div>
      <p className="mt-0.5 break-words text-foreground">{error.message}</p>
      {sql ? <ErrorExcerpt sql={sql} error={error} /> : null}
      {error.detail ? <p className="mt-1.5 text-foreground/65">Detail: {error.detail}</p> : null}
      {error.hint ? <p className="mt-1.5 text-foreground/65">Hint: {error.hint}</p> : null}
      {children}
    </div>
  );
}

export function SqlConsole({
  defaultValue = '', historyKey, sidebar = true, transfer = true, onRun, headerActions, resultMaxHeight = '18rem', autoRun = false, timing = true, layout, className, ...props
}: SqlConsoleProps) {
  const { status, db, info, error: openError, retry, invalidate } = useDatabaseStatus();
  const { schema, isLoading: schemaLoading } = useSchema();
  const history = useSqlHistory(historyKey);
  const [value, setValue] = useState(defaultValue);
  const [running, setRunning] = useState(false);
  const [last, setLast] = useState<{ sql: string; outcome: RunOutcome } | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone: 'ok' | 'error'; detail?: string } | null>(null);
  const editor = useRef<SqlEditorHandle>(null);

  const run = useCallback(async (sql: string) => {
    if (!db) return;
    setRunning(true);
    setNotice(null);
    history.push(sql);
    const outcome = await runSql(db, sql);
    setLast({ sql, outcome });
    // Anything that is not a plain read may have changed the schema or the row counts.
    if (!outcome.error && outcome.results.some((r) => !(r.statement && READS.test(r.statement)) && !(r.command && /^(SELECT|SHOW|EXPLAIN)$/.test(r.command)))) invalidate();
    setRunning(false);
    onRun?.(sql, outcome);
  }, [db, history, invalidate, onRun]);

  const doExport = async (format: ExportFormat) => {
    if (!db) return;
    setNotice(null);
    try {
      const out = await exportDatabase(db, format);
      downloadFile(out.file);
      setNotice({
        tone: 'ok',
        text: `Exported ${out.file.name} (${formatBytes(out.bytes)}) from Postgres ${out.postgresVersion}.`,
        detail: format === 'datadir' ? `This archive restores only into Postgres ${out.postgresMajor}. Keep a SQL export as the portable backup.` : undefined,
      });
    } catch (e) {
      setNotice({ tone: 'error', text: e instanceof Error ? e.message : String(e) });
    }
  };

  const doImport = async () => {
    if (!db) return;
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
  };

  const insertTable = (schemaName: string, table: string) => {
    const qualified = schemaName === 'public' ? identifier(table) : `${identifier(schemaName)}.${identifier(table)}`;
    const text = `select * from ${qualified} limit 100;`;
    if (editor.current && value.trim()) editor.current.insert(`${value.endsWith('\n') ? '' : '\n'}${text}`);
    else {
      setValue(text);
      editor.current?.focus();
    }
  };

  const ready = status === 'ready' && !!db;

  const ran = useRef(false);
  useEffect(() => {
    if (autoRun && ready && !ran.current && defaultValue.trim()) {
      ran.current = true;
      void run(defaultValue.trim());
    }
  }, [autoRun, ready, run, defaultValue]);

  return (
    <div data-slot="sql-console" data-status={status} className={cn(sqlConsoleVariants({ layout }), className)} {...props}>
      <header data-slot="sql-console-header" className="flex flex-wrap items-center gap-2 md:col-span-2">
        {ready && info ? (
          <>
            <Badge variant="secondary" title={`PGlite ${info.pgliteVersion ?? ''}`}>PostgreSQL {info.serverVersion}</Badge>
            <Badge variant="secondary" title={info.worker ? 'Running in a Web Worker' : 'Running on the main thread'}>{info.dataDir}{info.worker ? ' · worker' : ''}</Badge>
            {info.kind === 'memory' ? <span className="text-caption text-foreground/65">Gone when you reload</span> : null}
          </>
        ) : status === 'loading' ? (
          <span role="status" className="flex items-center gap-2 text-footnote text-foreground/65"><Spinner spin size={14} /> Starting PostgreSQL…</span>
        ) : null}
        <span className="flex-1" />
        {headerActions}
        {transfer && ready ? (
          <>
            <Button size="sm" variant="secondary" onPress={() => void doExport('sql')}>Export SQL</Button>
            <Button size="sm" variant="secondary" onPress={() => void doExport('datadir')}>Export data dir</Button>
            <Button size="sm" variant="secondary" onPress={() => void doImport()}>Import…</Button>
          </>
        ) : null}
      </header>

      {notice ? (
        notice.tone === 'error' ? (
          <div className="md:col-span-2">
            <ErrorPanel title="Could not finish" error={{ message: notice.text }} />
          </div>
        ) : (
          <p role="status" data-slot="sql-console-notice" className="text-footnote text-foreground/65 md:col-span-2">
            {notice.text}
            {notice.detail ? ` ${notice.detail}` : ''}
          </p>
        )
      ) : null}

      {status === 'error' && openError ? (
        <div className="md:col-span-2">
          <ErrorPanel title={openError instanceof DataDirVersionError ? 'This database was made by a different Postgres version' : 'Could not open the database'} error={{ message: openError.message, code: openError instanceof PGliteError ? openError.code : undefined }}>
            <div className="mt-2"><Button size="sm" variant="secondary" onPress={retry}>Try again</Button></div>
          </ErrorPanel>
        </div>
      ) : (
        <>
          {sidebar ? (
            <aside data-slot="sql-console-sidebar" className="flex min-h-0 min-w-0 flex-col gap-2">
              <Tabs variant="segmented" className="gap-2">
                <TabList aria-label="Sidebar">
                  <Tab id="schema">Schema</Tab>
                  <Tab id="history">History{history.entries.length ? ` (${history.entries.length})` : ''}</Tab>
                </TabList>
                <TabPanel id="schema" className="max-h-80 overflow-y-auto">
                  <SchemaTree
                    schema={schema}
                    isLoading={schemaLoading || !ready}
                    variant="card"
                    onSelectTable={(t) => insertTable(t.schema, t.name)}
                  />
                </TabPanel>
                <TabPanel id="history" className="max-h-80 overflow-y-auto">
                  {history.entries.length ? (
                    <ul className="flex flex-col gap-1">
                      {history.entries.map((h) => (
                        <li key={h}>
                          <Button variant="ghost" size="sm" className="h-auto w-full justify-start px-2 py-1.5 text-start font-mono text-caption font-normal whitespace-normal break-all" onPress={() => { setValue(h); editor.current?.focus(); }}>
                            <span className="line-clamp-3">{h}</span>
                          </Button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="px-2 py-4 text-center text-footnote text-foreground/65">Statements you run appear here.</p>
                  )}
                </TabPanel>
              </Tabs>
            </aside>
          ) : null}

          <section className="flex min-h-0 min-w-0 flex-col gap-3">
            <SqlEditor
              ref={editor}
              value={value}
              onChange={setValue}
              onRun={(sql) => void run(sql)}
              isRunning={running}
              isDisabled={!ready}
              history={history.entries}
              error={last?.outcome.error && last.sql === value.trim() ? last.outcome.error : null}
              placeholder="select now();"
              aria-label="SQL"
            />

            {last?.outcome.error ? (
              <ErrorPanel title="Query failed" error={last.outcome.error} sql={last.sql}>
                {last.outcome.statementCount > 1 && !/\b(begin|start\s+transaction)\b/i.test(last.sql) ? (
                  <p className="mt-1.5 text-foreground/65">The script ran as one transaction, so none of its {last.outcome.statementCount} statements were applied.</p>
                ) : null}
              </ErrorPanel>
            ) : null}

            {last && !last.outcome.error ? (
              <div data-slot="sql-console-results" className="flex flex-col gap-3">
                {last.outcome.results.length === 0 ? <p role="status" className="text-footnote text-foreground/65">Nothing to run.</p> : null}
                {last.outcome.results.map((r, i) => (
                  <figure key={i} className="m-0 flex min-w-0 flex-col gap-1">
                    {last.outcome.results.length > 1 || r.statement ? (
                      <figcaption className="truncate font-mono text-caption text-foreground/65" title={r.statement}>
                        {last.outcome.results.length > 1 ? `${i + 1}. ` : ''}{r.statement ?? r.command}
                      </figcaption>
                    ) : null}
                    <ResultTable
                      result={r}
                      durationMs={timing && last.outcome.results.length === 1 ? last.outcome.durationMs : undefined}
                      maxHeight={resultMaxHeight}
                      aria-label={`Result ${i + 1}`}
                      resizable
                    />
                  </figure>
                ))}
                {timing && last.outcome.results.length > 1 ? (
                  <p role="status" className="text-caption text-foreground/65">{last.outcome.results.length} statements in {formatDuration(last.outcome.durationMs)}</p>
                ) : null}
              </div>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
