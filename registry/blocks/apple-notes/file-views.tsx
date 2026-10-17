/* The detail column for files that aren't notes: an STL model in the 3D viewer, an image at its own size (scaled to
   fit), and JSON or YAML in visual-json — a tree beside a form. JSON edits save back to the file; YAML opens
   read-only, since writing it back would drop its comments and formatting. */
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { JsonEditor } from '@visual-json/react';
import { parseYamlContent } from '@visual-json/yaml';
import { StlViewer } from '@/components/ui/stl-viewer';
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
  const { readFile, replaceFile } = notes.files;
  useEffect(() => {
    let live = true;
    readFile(file.path).then((f) => f.text()).then((text) => {
      if (!live) return;
      setDoc({ path: file.path, value: (yaml ? parseYamlContent(text) : JSON.parse(text)) as JsonValue });
    }).catch((e: unknown) => { if (live) setDoc({ path: file.path, error: message(e) }); });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `readFile` is remade each render; the path decides.
  }, [file.path]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const current = doc?.path === file.path ? doc : null;
  const save = (value: JsonValue) => {
    setDoc({ path: file.path, value });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      replaceFile(file.path, `${JSON.stringify(value, null, 2)}\n`).then(() => setSaveError(null), (e: unknown) => setSaveError(message(e)));
    }, 500);
  };
  return <div className="flex h-full min-h-[60vh] flex-col px-4 pt-3 pb-6">
    {current?.error ? <p role="alert" className="text-detail text-destructive">This {yaml ? 'YAML' : 'JSON'} file can’t be read: {current.error}</p>
      : current && 'value' in current ? <JsonEditor value={current.value as JsonValue} onChange={yaml ? undefined : save} readOnly={yaml}
        treeShowValues treeShowCounts height="100%" className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border" style={VJ_THEME} />
      : <div aria-busy="true" className="flex-1 rounded-xl bg-secondary" />}
    {saveError ? <p role="alert" className="mt-2 text-footnote text-destructive">Couldn’t save: {saveError}</p> : null}
    <p className="mt-3 text-center text-footnote text-muted-foreground">{where(file)} · {yaml ? 'YAML opens read-only, so its comments and formatting are kept' : 'Edits save to the file'}</p>
  </div>;
}

/** The viewer for a model, image or data file. */
export function FileView({ notes, file }: { notes: NotesState; file: OtherFile }) {
  if (file.kind === 'image') return <ImageView notes={notes} file={file} />;
  if (file.kind === 'json' || file.kind === 'yaml') return <DataView notes={notes} file={file} />;
  return <ModelView notes={notes} file={file} />;
}

/** The detail column's label for a file of this kind. */
export const viewerLabel = (file: OtherFile) =>
  file.kind === 'image' ? 'Image' : file.kind === 'json' ? 'JSON' : file.kind === 'yaml' ? 'YAML' : 'Model';
