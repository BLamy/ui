/* Export and import a PGlite database. Pure functions over `Blob`/`File` — no DOM; the download / upload helpers that
   do touch the page are in `lib/pglite-files.ts`.

   Two formats, for two jobs:
   - `sql` — a plain-text dump made by pg_dump (WebAssembly build, `@electric-sql/pglite-tools`, ~0.7 MB, loaded on use).
     The portable backup: it restores into any PGlite version and into real Postgres. Use it for backups and upgrades.
   - `datadir` — a tarball of the live data directory (`db.dumpDataDir`). Fast and exact, but only valid for the SAME
     Postgres major version (and best with the same PGlite release). Use it for same-version restores and moving a
     database between browsers.

   Nothing here deletes data. Importing SQL into a database that already holds the dumped objects fails (and, being one
   implicit transaction, changes nothing); loading a data directory refuses a Postgres major-version mismatch before it
   starts, and refuses to overwrite an existing database. */
import {
  DataDirVersionError, PGliteError, openDatabase, peekDataDirVersion, readServerInfo, runtimePostgresMajor,
  type Database, type OpenDatabaseOptions, type OpenedDatabase,
} from '@/lib/pglite-core';

export type ExportFormat = 'sql' | 'datadir';

export interface ExportOptions {
  /** File name; default `database-pg<major>.sql` / `database-pg<major>-pglite<version>.tar.gz`. */
  fileName?: string;
  /** Extra pg_dump arguments for `sql` (`['--schema-only']`, `['--table=app.notes']`). `--inserts` is always on. */
  args?: string[];
}

export interface ExportResult {
  file: File;
  format: ExportFormat;
  /** The Postgres version that wrote it (`18.3`). A `datadir` archive restores only into the same major. */
  postgresVersion: string;
  postgresMajor: number;
  pgliteVersion?: string;
  bytes: number;
}

/** Exports the database. `sql` is the portable backup; `datadir` the same-version archive. */
export async function exportDatabase(db: Database, format: ExportFormat = 'sql', options: ExportOptions = {}): Promise<ExportResult> {
  const server = await readServerInfo(db);
  const stamp = `pg${server.serverMajor}`;
  try {
    if (format === 'sql') {
      const { pgDump } = await import('@electric-sql/pglite-tools/pg_dump');
      const dump = await pgDump({ pg: db as never, args: options.args, fileName: options.fileName ?? `database-${stamp}.sql` });
      return { file: dump, format, postgresVersion: server.serverVersion, postgresMajor: server.serverMajor, pgliteVersion: server.pgliteVersion, bytes: dump.size };
    }
    const archive = await db.dumpDataDir('gzip');
    const name = options.fileName ?? `database-${stamp}${server.pgliteVersion ? `-pglite${server.pgliteVersion}` : ''}.tar.gz`;
    const file = new File([archive], name, { type: 'application/gzip' });
    return { file, format, postgresVersion: server.serverVersion, postgresMajor: server.serverMajor, pgliteVersion: server.pgliteVersion, bytes: file.size };
  } catch (cause) {
    if (cause instanceof PGliteError) throw cause;
    throw new PGliteError('EXPORT_FAILED', `Could not export the database as ${format}: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
  }
}

/** `sql` for text dumps, `datadir` for gzip / tar archives — by magic bytes, then by file name. */
export async function detectImportFormat(file: Blob & { name?: string }): Promise<ExportFormat> {
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer());
  if (head[0] === 0x1f && head[1] === 0x8b) return 'datadir';
  const name = (file.name ?? '').toLowerCase();
  if (/\.(tar|tgz|tar\.gz)$/.test(name)) return 'datadir';
  return 'sql';
}

/** Reads one file out of a (gzipped) tar stream, stopping as soon as it is found. */
async function readTarEntry(blob: Blob, match: (path: string) => boolean): Promise<string | null> {
  const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
  const gzip = head[0] === 0x1f && head[1] === 0x8b;
  let stream: ReadableStream<Uint8Array> = blob.stream() as ReadableStream<Uint8Array>;
  if (gzip) stream = stream.pipeThrough(new DecompressionStream('gzip') as unknown as TransformStream<Uint8Array, Uint8Array>);
  const reader = stream.getReader();
  let buf = new Uint8Array(0);
  const need = async (n: number): Promise<boolean> => {
    while (buf.length < n) {
      const { done, value } = await reader.read();
      if (done) return false;
      const next = new Uint8Array(buf.length + value.length);
      next.set(buf);
      next.set(value, buf.length);
      buf = next;
    }
    return true;
  };
  const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes).replace(/\0.*$/s, '');
  try {
    for (;;) {
      if (!(await need(512))) return null;
      const header = buf.subarray(0, 512);
      if (header.every((b) => b === 0)) return null;
      const name = text(header.subarray(0, 100));
      const prefix = text(header.subarray(345, 500));
      const size = parseInt(text(header.subarray(124, 136)).trim() || '0', 8) || 0;
      const padded = Math.ceil(size / 512) * 512;
      if (!(await need(512 + padded))) return null;
      if (match(prefix ? `${prefix}/${name}` : name)) return text(buf.subarray(512, 512 + size)).trim();
      buf = buf.slice(512 + padded);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
}

/** The Postgres major version recorded in a data-directory archive (its `PG_VERSION` file), or `null` if there is none. */
export async function readArchiveVersion(file: Blob): Promise<string | null> {
  return readTarEntry(file, (p) => /(^|\/)PG_VERSION$/.test(p.replace(/^\.\//, '')) && !/(^|\/)(base|global|pg_[a-z_]+)\//.test(p));
}

/** The Postgres version a SQL dump says it came from (`-- Dumped from database version 18.3`), if it says. */
export function dumpVersion(sql: string): string | null {
  return /^-- Dumped from database version ([\d.]+)/m.exec(sql.slice(0, 4000))?.[1] ?? null;
}

export interface ImportResult {
  format: ExportFormat;
  /** Version the file says it came from, when it says. */
  sourceVersion: string | null;
  /** Things worth telling the user (a dump from a newer Postgres, …). */
  warnings: string[];
  /** The statements of a SQL import ran in one transaction: true when they all applied. */
  applied: boolean;
}

async function importSql(db: Database, text: string): Promise<ImportResult> {
  const sourceVersion = dumpVersion(text);
  const warnings: string[] = [];
  const server = await readServerInfo(db);
  if (sourceVersion && parseInt(sourceVersion, 10) > server.serverMajor) {
    warnings.push(`The dump was written by Postgres ${sourceVersion}, newer than this database (${server.serverVersion}); statements it uses may not exist here.`);
  }
  try {
    await db.exec(text);
  } catch (cause) {
    await db.exec('rollback').catch(() => undefined);
    throw new PGliteError('IMPORT_FAILED', `The SQL dump could not be applied (nothing was changed): ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
  } finally {
    // pg_dump sets an empty search_path and a few session options; restore the session's defaults.
    await db.exec('reset all').catch(() => undefined);
  }
  return { format: 'sql', sourceVersion, warnings, applied: true };
}

/** Imports a file.
 *
 *  - Into an open `Database`: applies a SQL dump (a data-directory archive cannot be loaded into a running database —
 *    that throws `UNSUPPORTED`; restore it by opening a new database with it).
 *  - Into a config (`{ dataDir, … }`): opens a NEW database from the file — a SQL dump into an empty database, a data
 *    directory archive via PGlite's `loadDataDir` — and returns it open; the caller owns it. A name that already holds a database
 *    is refused (`DATABASE_EXISTS`), and an archive from another Postgres major is refused before anything starts
 *    ({@link DataDirVersionError}). */
export async function importDatabase(target: Database, file: Blob & { name?: string }): Promise<ImportResult>;
export async function importDatabase(target: OpenDatabaseOptions, file: Blob & { name?: string }): Promise<ImportResult & OpenedDatabase & { close(): Promise<void> }>;
export async function importDatabase(target: Database | OpenDatabaseOptions, file: Blob & { name?: string }): Promise<ImportResult | (ImportResult & OpenedDatabase & { close(): Promise<void> })> {
  const format = await detectImportFormat(file);
  const isDb = typeof (target as Database).exec === 'function' && typeof (target as Database).query === 'function';

  if (isDb) {
    if (format === 'datadir') {
      throw new PGliteError(
        'UNSUPPORTED',
        'A data-directory archive can only be loaded into a new database, not into one that is already open. Pass a config ({ dataDir: "idb://new-name" }) to importDatabase, or open a provider with loadDataDir.',
      );
    }
    return importSql(target as Database, await file.text());
  }

  const config = target as OpenDatabaseOptions;
  if (format === 'datadir') {
    const sourceMajor = await readArchiveVersion(file);
    const runtime = await runtimePostgresMajor();
    if (sourceMajor && sourceMajor !== runtime) throw new DataDirVersionError(config.dataDir ?? 'the archive', sourceMajor, runtime);
    const opened = await openDatabase({ ...config, loadDataDir: file });
    return { ...opened, format, sourceVersion: sourceMajor, warnings: sourceMajor ? [] : ['The archive has no PG_VERSION file; it was loaded without a version check.'], applied: true };
  }

  if (await peekDataDirVersion(config.dataDir ?? 'memory://')) {
    throw new PGliteError('DATABASE_EXISTS', `"${config.dataDir}" already holds a database. Import into a new name, or open it and import into the open database (which refuses to overwrite objects that exist).`);
  }
  const opened = await openDatabase({ ...config, loadDataDir: undefined });
  try {
    const result = await importSql(opened.db, await file.text());
    return { ...opened, ...result };
  } catch (error) {
    await opened.close();
    throw error;
  }
}
