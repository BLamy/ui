/* Cloudflare Studio — a system of Cloudflare's services, drawn and edited on a CloudflareDiagram, with a machine for any
   service that runs code, and exported as files: the system's JSON, a wrangler.jsonc for each Worker, and a module for each
   machine. It's kept in the browser as it changes, so a reload carries on where it was, and nothing goes over the network or
   needs an account. The inspector is the diagram's own panel: a column beside the board, a drawer, or a page pushed over
   it at a phone's size. Export is a Dialog (a sheet at a phone's size). */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CloudflareDiagram } from '@/components/ui/cloudflare-diagram';
import {
  Dialog, DialogBackdrop, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { FileUploadTrigger } from '@/components/ui/file-upload';
import { Input } from '@/components/ui/input';
import type { CloudflareSystem, SystemIssue } from '@/lib/cloudflare-system';
import { EMPTY_SYSTEM, parseSystem } from '@/lib/cloudflare-system';
import { cn } from '@/lib/utils';
import { EXAMPLE } from './example';
import { readSaved, studioFiles, writeSaved, type SavedStudio, type StudioFile } from './studio-files';

export interface CloudflareStudioProps {
  /** What it opens with when nothing's saved. Default: a file upload, across a Worker, R2, a Queue, a consumer and a
   *  Durable Object with a machine. */
  initial?: SavedStudio;
  /** Where in localStorage it's kept, or `null` to keep nothing. Default `cloudflare-studio`. */
  storageKey?: string | null;
  className?: string;
}

const storage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

/** A file's name once it's downloaded: a browser won't make folders, so the folder's in the name. */
export const downloadName = (path: string) => path.split('/').join('-');

function download(file: StudioFile) {
  const url = URL.createObjectURL(new Blob([file.text], { type: 'text/plain' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = downloadName(file.path);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A file that's opened, read as a studio: its name from the file's, unless it's the `system.json` this exports. */
export function openedStudio(fileName: string, text: string, current: string): { studio: SavedStudio | null; issues: SystemIssue[] } {
  const read = parseSystem(text);
  if (read.issues.some((i) => i.code === 'json' || i.code === 'shape')) return { studio: null, issues: read.issues };
  return { studio: { name: fileName.replace(/\.json$/i, '').replace(/^system$/, current), system: read.system }, issues: read.issues };
}

export default function CloudflareStudio({ initial = EXAMPLE, storageKey = 'cloudflare-studio', className }: CloudflareStudioProps) {
  const [studio, setStudio] = useState<SavedStudio>(() => (storageKey ? readSaved(storage()?.getItem(storageKey) ?? null) : null) ?? initial);
  // Something opened or started over replaces the board, and its undo history goes with it.
  const [generation, setGeneration] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [notes, setNotes] = useState<SystemIssue[]>([]);
  const [saved, setSaved] = useState<'saved' | 'not-saved' | 'off'>(storageKey ? 'saved' : 'off');
  const first = useRef(true);

  useEffect(() => {
    // What it opened with is already there (or is the example), so the first run writes nothing.
    if (first.current) { first.current = false; return; }
    if (!storageKey) return;
    try {
      storage()?.setItem(storageKey, writeSaved(studio));
      setSaved('saved');
    } catch {
      setSaved('not-saved');
    }
  }, [studio, storageKey]);

  const replace = (next: SavedStudio, issues: SystemIssue[] = []) => {
    setStudio(next);
    setGeneration((g) => g + 1);
    setNotes(issues);
  };
  const changeSystem = (system: CloudflareSystem) => setStudio((s) => ({ ...s, system }));
  const open = async (file: File) => {
    const { studio: opened, issues } = openedStudio(file.name, await file.text(), studio.name);
    if (opened) replace(opened, issues);
    else setNotes(issues);
  };
  const files = useMemo(() => (exporting ? studioFiles(studio.system) : []), [exporting, studio.system]);

  return (
    <div data-slot="cloudflare-studio" className={cn('relative flex h-full min-h-[560px] w-full flex-col bg-background text-foreground', className)}>
      <header data-slot="cloudflare-studio-bar" className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <Input
                    aria-label="System name"
          size="sm"
          value={studio.name}
          onValueChange={(name) => setStudio((s) => ({ ...s, name }))}
          className="min-w-0 flex-1 basis-40 font-semibold"
        />
        <span data-slot="cloudflare-studio-saved" data-saved={saved} role="status" className="text-footnote text-foreground/70">
          {saved === 'saved' ? 'Kept in this browser' : saved === 'not-saved' ? 'Couldn’t keep it in this browser' : ''}
        </span>
        <div role="group" aria-label="System" className="flex flex-wrap gap-2">
          <Button data-action="new" variant="secondary" size="sm" onClick={() => replace({ name: 'Untitled system', system: EMPTY_SYSTEM })}>New</Button>
          <FileUploadTrigger data-action="open" variant="secondary" size="sm" accept={['application/json', '.json']} multiple={false} onFiles={(picked) => { if (picked[0]) void open(picked[0]); }}>Open…</FileUploadTrigger>
          <Button data-action="export" size="sm" onClick={() => setExporting(true)}>Export…</Button>
        </div>
        {notes.length ? (
          <ul data-slot="cloudflare-studio-notes" aria-label="What the file said" className="m-0 flex w-full list-none flex-col gap-1 p-0 text-footnote">
            {notes.map((n, i) => (
              <li key={i} data-code={n.code} data-severity={n.severity} className={n.severity === 'error' ? 'text-destructive' : 'text-foreground/70'}>{n.message}</li>
            ))}
          </ul>
        ) : null}
      </header>
      <div className="relative min-h-0 flex-1">
        <CloudflareDiagram
          key={generation}
          editable
          services={studio.system.services}
          edges={studio.system.edges}
          onDataChange={changeSystem}
          title={studio.name || 'Untitled system'}
          aria-label={studio.name || 'Untitled system'}
        />
      </div>
      <Dialog open={exporting} onOpenChange={setExporting}>
        <DialogBackdrop />
        <DialogContent size="lg">
          <DialogClose />
          <DialogHeader>
            <DialogTitle>Export {studio.name}</DialogTitle>
            <DialogDescription>Files only: nothing’s deployed, and there’s no account. What a file still needs that the system doesn’t say is listed under it.</DialogDescription>
          </DialogHeader>
          <DialogBody data-part="files" className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
            {files.map((file) => (
              <section key={file.path} data-slot="cloudflare-studio-file" data-path={file.path} aria-label={file.path} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate font-mono text-footnote font-semibold">{file.path}</span>
                  <Button data-action="download" variant="secondary" size="sm" aria-label={`Download ${file.path}`} onClick={() => download(file)}>Download</Button>
                </div>
                {file.needs.length ? (
                  <ul data-slot="cloudflare-studio-needs" aria-label={`What ${file.path} still needs`} className="m-0 flex list-none flex-col gap-0.5 p-0 text-footnote text-foreground/70">
                    {file.needs.map((need, i) => <li key={i}>{need}</li>)}
                  </ul>
                ) : null}
                <pre data-slot="cloudflare-studio-file-text" className="bl-scroll m-0 max-h-60 overflow-auto rounded-ctl bg-secondary p-2 font-mono text-caption">{file.text}</pre>
              </section>
            ))}
          </DialogBody>
          <DialogFooter>
            <Button data-action="download-all" onClick={() => files.forEach(download)}>Download all {files.length}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
