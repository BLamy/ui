/* The detail column for files that aren't notes: an STL model in the 3D viewer, an image at its own size (scaled to
   fit), JSON or YAML in visual-json — a tree beside a form — or as code, CSV and TSV in the library's Spreadsheet, and
   source and text files in the code editor. JSON edits in visual-json save back to the file; YAML's visual view is
   read-only, since writing it back would drop its comments and formatting (its Code view edits the text as is).

   Text files save a moment after you stop typing (⌘S saves at once), and again when you leave the file. Each open
   text file is checked for changes on disk: one you haven't edited reloads, one you have asks which copy to keep. */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { JsonEditor } from '@visual-json/react';
import { parseYamlContent } from '@visual-json/yaml';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/segmented';
import { Spreadsheet } from '@/components/ui/spreadsheet';
import { StlViewer } from '@/components/ui/stl-viewer';
import { delimiterForPath, parseCsv, stringifyCsv } from '@/lib/csv';
import { languageFromPath } from '@/lib/syntax';
import { CodeEditor } from './code-editor';
import type { NotesState, OtherFile } from './use-notes';

type JsonValue = Parameters<typeof JsonEditor>[0]['value'];
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** A blob: URL of the file on disk, for the viewers that take a URL. */
function useFileUrl(notes: NotesState, file: OtherFile) {
  const [url, setUrl] = useState<{ path: string; url: string | null; error?: string } | null>(null);
  const { fileUrl } = notes.files;
  useEffect(() => {
    let live = true;
    fileUrl(file.path).then((next) => { if (live) setUrl({ path: file.path, url: next }); },
      (e: unknown) => { if (live) setUrl({ path: file.path, url: null, error: message(e) }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `fileUrl` is remade each render; the path decides.
  }, [file.path]);
  return url?.path === file.path ? url : null;
}

const where = (file: OtherFile) => file.path.split('/').slice(1).join('/');

/* Writes to one path run in order, and a read waits for them, so switching a JSON file from its tree to its code
   never reads the file before the last edit is on disk. */
const pending = new Map<string, Promise<unknown>>();
function writeText(notes: NotesState, path: string, text: string) {
  const run = (pending.get(path) ?? Promise.resolve()).catch(() => undefined).then(() => notes.files.replaceFile(path, text));
  pending.set(path, run);
  void run.finally(() => { if (pending.get(path) === run) pending.delete(path); }).catch(() => undefined);
  return run;
}
const settled = (path: string) => (pending.get(path) ?? Promise.resolve()).catch(() => undefined);

/** Past this, a text file is not opened for editing (it would be slow to show and to save). */
const TEXT_LIMIT = 20 * 1024 * 1024;
const SAVE_DELAY = 600;
const POLL = 1500;

type SaveState = 'saved' | 'edited' | 'saving' | 'error';

/** A text file's contents with autosave and outside-change detection. `edit` takes the new text, or a function that
    makes it (a spreadsheet serializes only when it saves). */
function useTextFile(notes: NotesState, file: OtherFile) {
  const [doc, setDoc] = useState<{ path: string; text?: string; error?: string } | null>(null);
  const [state, setState] = useState<SaveState>('saved');
  const [error, setError] = useState<string | null>(null);
  /** The file changed on disk while you had unsaved edits: its new text. */
  const [conflict, setConflict] = useState<string | null>(null);
  const draft = useRef<(() => string) | null>(null);
  const modified = useRef(0);
  /** A save is between writing and learning the file's new modified time: the poll must not take it for an outside edit. */
  const saving = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notesRef = useRef(notes); notesRef.current = notes;
  const path = file.path;

  const save = useCallback(async () => {
    clearTimeout(timer.current);
    const make = draft.current;
    if (!make) return;
    draft.current = null;
    saving.current = true;
    setState('saving');
    try {
      await writeText(notesRef.current, path, make());
      modified.current = (await notesRef.current.files.readFile(path)).lastModified;
      setError(null);
      setState(draft.current ? 'edited' : 'saved');
    } catch (e) {
      draft.current ??= make;
      setError(message(e));
      setState('error');
    } finally {
      saving.current = false;
    }
  }, [path]);

  const edit = useCallback((next: string | (() => string)) => {
    draft.current = typeof next === 'string' ? () => next : next;
    if (typeof next === 'string') setDoc((d) => (d && d.path === path ? { ...d, text: next } : d));
    setState('edited');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => { void save(); }, SAVE_DELAY);
  }, [path, save]);

  useEffect(() => {
    let live = true;
    draft.current = null;
    setState('saved'); setError(null); setConflict(null);
    void settled(path).then(() => notesRef.current.files.readFile(path)).then(async (f) => {
      if (f.size > TEXT_LIMIT) throw new Error(`It is ${(f.size / 1024 / 1024).toFixed(0)} MB; Notes edits text files up to 20 MB.`);
      const text = await f.text();
      if (!live) return;
      modified.current = f.lastModified;
      setDoc({ path, text });
    }).catch((e: unknown) => { if (live) setDoc({ path, error: message(e) }); });
    // Outside edits: reload a file you haven't touched; offer the choice for one you have.
    const poll = setInterval(() => {
      if (saving.current || pending.has(path)) return;
      void notesRef.current.files.readFile(path).then(async (f) => {
        if (!live || !modified.current || f.lastModified === modified.current) return;
        modified.current = f.lastModified;
        const text = await f.text();
        if (!live) return;
        if (draft.current) setConflict(text);
        else setDoc({ path, text });
      }).catch(() => undefined);
    }, POLL);
    return () => {
      live = false;
      clearInterval(poll);
      // Leaving the file saves what's left.
      if (draft.current) void save();
    };
  }, [path, save]);

  const current = doc?.path === path ? doc : null;
  return {
    text: current?.text, loadError: current?.error, state, error, conflict, edit, save,
    /** Take the copy on disk, dropping your edits. */
    reload() { clearTimeout(timer.current); draft.current = null; setState('saved'); if (conflict !== null) setDoc({ path, text: conflict }); setConflict(null); },
    /** Keep your edits and write them over the copy on disk. */
    keepMine() { setConflict(null); void save(); },
  };
}

type TextFile = ReturnType<typeof useTextFile>;

const SAVE_LABEL: Record<SaveState, string> = { saved: 'Saved', edited: 'Edited', saving: 'Saving…', error: 'Not saved' };

/** Under a text view: where the file is, what it is and whether it's saved, or the conflict to settle. */
function TextStatus({ file, doc, kind }: { file: OtherFile; doc: TextFile; kind: string }) {
  if (doc.conflict !== null) {
    return <div role="alert" className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-footnote">
      <span className="min-w-0 flex-1">{file.name} changed outside Notes while you were editing it.</span>
      <Button size="sm" variant="secondary" onPress={doc.reload}>Use the File</Button>
      <Button size="sm" variant="secondary" onPress={doc.keepMine}>Keep Mine</Button>
    </div>;
  }
  return <>
    {doc.error ? <p role="alert" className="mt-2 text-footnote text-destructive">Couldn’t save: {doc.error}</p> : null}
    <p className="mt-2 text-center text-footnote text-muted-foreground">
      {where(file)} · {kind} · <span aria-live="polite">{SAVE_LABEL[doc.state]}</span>
    </p>
  </>;
}

function CodeView({ notes, file }: { notes: NotesState; file: OtherFile }) {
  const doc = useTextFile(notes, file);
  const language = languageFromPath(file.path);
  return <div className="flex h-full min-h-[60vh] flex-col px-4 pt-3 pb-6">
    {doc.loadError ? <p role="alert" className="text-detail text-destructive">This file can’t be opened: {doc.loadError}</p>
      : doc.text !== undefined ? <CodeEditor aria-label={file.name} value={doc.text} onChange={doc.edit} onSave={() => { void doc.save(); }} language={language}
        className="min-h-0 flex-1" />
      : <div aria-busy="true" className="flex-1 rounded-xl bg-secondary" />}
    <TextStatus file={file} doc={doc} kind={language === 'text' ? 'Text' : language.toUpperCase()} />
  </div>;
}

function SheetView({ notes, file }: { notes: NotesState; file: OtherFile }) {
  const doc = useTextFile(notes, file);
  // The table is parsed from the file's text, and only turned back into text when it saves.
  const parsed = useMemo(() => (doc.text === undefined ? null : parseCsv(doc.text, { delimiter: delimiterForPath(file.path) })), [doc.text, file.path]);
  const [rows, setRows] = useState<{ from: unknown; rows: string[][] } | null>(null);
  const current = parsed && rows && rows.from === parsed ? rows.rows : parsed?.rows;
  const onChange = (next: string[][]) => {
    if (!parsed) return;
    setRows({ from: parsed, rows: next });
    doc.edit(() => stringifyCsv(next, parsed));
  };
  const kind = parsed?.delimiter === '\t' ? 'TSV' : 'CSV';
  return <div className="flex h-full min-h-[60vh] flex-col px-4 pt-3 pb-6">
    {doc.loadError ? <p role="alert" className="text-detail text-destructive">This file can’t be opened: {doc.loadError}</p>
      : current ? <Spreadsheet aria-label={file.name} value={current} onChange={onChange} className="min-h-0 flex-1" />
      : <div aria-busy="true" className="flex-1 rounded-xl bg-secondary" />}
    <TextStatus file={file} doc={doc} kind={kind} />
  </div>;
}

function ModelView({ notes, file }: { notes: NotesState; file: OtherFile }) {
  const current = useFileUrl(notes, file);
  return <div className="mx-auto w-full max-w-[900px] px-6 pt-4 pb-28">
    {current?.error ? <p role="alert" className="text-detail text-destructive">{current.error}</p>
      : current?.url ? <StlViewer key={current.url} src={current.url} title={file.name} />
      : <div aria-busy="true" className="aspect-video rounded-xl bg-secondary" />}
    <p className="mt-3 text-center text-footnote text-muted-foreground">{where(file)} · Drag it onto a note to embed it</p>
  </div>;
}

function ImageView({ notes, file }: { notes: NotesState; file: OtherFile }) {
  const current = useFileUrl(notes, file);
  const [size, setSize] = useState<string | null>(null);
  return <div className="mx-auto flex w-full max-w-[1100px] flex-col items-center px-6 pt-4 pb-28">
    {current?.error ? <p role="alert" className="text-detail text-destructive">{current.error}</p>
      : current?.url ? <img key={current.url} src={current.url} alt={file.name}
        onLoad={(e) => setSize(`${e.currentTarget.naturalWidth} × ${e.currentTarget.naturalHeight}`)}
        className="max-h-[70vh] max-w-full rounded-xl object-contain shadow-hairline [background:repeating-conic-gradient(var(--secondary)_0_25%,transparent_0_50%)_0_0/16px_16px]" />
      : <div aria-busy="true" className="aspect-video w-full rounded-xl bg-secondary" />}
    <p className="mt-3 text-center text-footnote text-muted-foreground">{where(file)}{size ? ` · ${size}` : ''} · Drag it onto a note to embed it</p>
  </div>;
}

/* visual-json in the theme. */
const VJ_THEME = {
  '--vj-bg': 'var(--background)',
  '--vj-bg-panel': 'var(--card)',
  '--vj-bg-hover': 'var(--secondary)',
  '--vj-bg-selected': 'color-mix(in oklab, var(--primary) 18%, transparent)',
  '--vj-bg-selected-muted': 'color-mix(in oklab, var(--primary) 10%, transparent)',
  '--vj-text-selected': 'var(--foreground)',
  '--vj-text': 'var(--foreground)',
  '--vj-text-muted': 'var(--muted-foreground)',
  '--vj-text-dim': 'var(--muted-foreground)',
  '--vj-text-dimmer': 'var(--muted-foreground)',
  '--vj-border': 'var(--border)',
  '--vj-border-subtle': 'var(--border)',
  '--vj-accent': 'var(--primary)',
  '--vj-accent-muted': 'color-mix(in oklab, var(--primary) 30%, transparent)',
  '--vj-input-bg': 'var(--secondary)',
  '--vj-input-border': 'var(--border)',
  '--vj-error': 'var(--destructive)',
  '--vj-font': 'var(--font-mono, ui-monospace, monospace)',
} as CSSProperties;

function DataView({ notes, file }: { notes: NotesState; file: OtherFile }) {
  const yaml = file.kind === 'yaml';
  const [doc, setDoc] = useState<{ path: string; value?: JsonValue; error?: string } | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { readFile } = notes.files;
  useEffect(() => {
    let live = true;
    settled(file.path).then(() => readFile(file.path)).then((f) => f.text()).then((text) => {
      if (!live) return;
      setDoc({ path: file.path, value: (yaml ? parseYamlContent(text) : JSON.parse(text)) as JsonValue });
    }).catch((e: unknown) => { if (live) setDoc({ path: file.path, error: message(e) }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `readFile` is remade each render; the path decides.
  }, [file.path]);
  // Leaving the file (or switching to its code) writes an edit that is still waiting.
  const flush = useRef<(() => void) | null>(null);
  useEffect(() => () => { clearTimeout(timer.current); flush.current?.(); }, []);
  const current = doc?.path === file.path ? doc : null;
  const save = (value: JsonValue) => {
    setDoc({ path: file.path, value });
    clearTimeout(timer.current);
    const write = () => {
      flush.current = null;
      writeText(notes, file.path, `${JSON.stringify(value, null, 2)}\n`).then(() => setSaveError(null), (e: unknown) => setSaveError(message(e)));
    };
    flush.current = write;
    timer.current = setTimeout(write, 500);
  };
  return <div className="flex h-full min-h-[60vh] flex-col px-4 pt-3 pb-6">
    {current?.error ? <p role="alert" className="text-detail text-destructive">This {yaml ? 'YAML' : 'JSON'} file can’t be read: {current.error}</p>
      : current && 'value' in current ? <JsonEditor value={current.value as JsonValue} onChange={yaml ? undefined : save} readOnly={yaml}
        treeShowValues treeShowCounts height="100%" className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border" style={VJ_THEME} />
      : <div aria-busy="true" className="flex-1 rounded-xl bg-secondary" />}
    {saveError ? <p role="alert" className="mt-2 text-footnote text-destructive">Couldn’t save: {saveError}</p> : null}
    <p className="mt-3 text-center text-footnote text-muted-foreground">{where(file)} · {yaml ? 'Read-only here, so its comments and formatting are kept · Switch to Code to edit it' : 'Edits save to the file'}</p>
  </div>;
}

/** JSON and YAML open as a tree and form, or as their text. */
export type DataMode = 'visual' | 'code';

/** The Visual / Code switch for a JSON or YAML file, in the detail column's toolbar. */
export function DataModeToggle({ mode, onChange }: { mode: DataMode; onChange: (mode: DataMode) => void }) {
  return <Segmented aria-label="Show as" value={mode} onChange={(id) => onChange(id as DataMode)} className="w-[128px]"
    options={[{ id: 'visual', label: 'Visual' }, { id: 'code', label: 'Code' }]} />;
}

/** The viewer for a model, image, data, spreadsheet or code file. */
export function FileView({ notes, file, mode = 'visual' }: { notes: NotesState; file: OtherFile; mode?: DataMode }) {
  if (file.kind === 'image') return <ImageView notes={notes} file={file} />;
  if (file.kind === 'json' || file.kind === 'yaml') return mode === 'code' ? <CodeView notes={notes} file={file} /> : <DataView notes={notes} file={file} />;
  if (file.kind === 'csv') return <SheetView notes={notes} file={file} />;
  if (file.kind === 'code') return <CodeView notes={notes} file={file} />;
  return <ModelView notes={notes} file={file} />;
}

/** The detail column's label for a file of this kind. */
export const viewerLabel = (file: OtherFile) =>
  file.kind === 'image' ? 'Image' : file.kind === 'json' ? 'JSON' : file.kind === 'yaml' ? 'YAML'
    : file.kind === 'csv' ? 'Spreadsheet' : file.kind === 'code' ? 'Code' : 'Model';
