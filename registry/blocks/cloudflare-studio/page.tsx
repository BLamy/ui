/* Cloudflare Studio — a system of Cloudflare's services, drawn and edited on a CloudflareDiagram, with a machine for any
   service that runs code, and exported as files: the system's JSON, a wrangler.jsonc for each Worker, and a module for each
   machine. It's kept in the browser as it changes, so a reload carries on where it was, and nothing goes over the network or
   needs an account. The inspector is the diagram's own: a SideDrawer beside the board, or a Credenza tray under it at a
   phone's size. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { CloudflareDiagram } from '@/components/ui/cloudflare-diagram';
import { Credenza } from '@/components/ui/credenza';
import { FileUploadButton } from '@/components/ui/file-upload';
import { Input } from '@/components/ui/input';
import { TextField } from '@/components/ui/text-field';
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

export default function CloudflareStudio({ initial = EXAMPLE, storageKey = 'cloudflare-studio', className }: CloudflareStudioProps) {
  const [studio, setStudio] = useState<SavedStudio>(() => (storageKey ? readSaved(storage()?.getItem(storageKey) ?? null) : null) ?? initial);
  // Something loaded or started over replaces the board, and its undo history goes with it.
  const [generation, setGeneration] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [notes, setNotes] = useState<SystemIssue[]>([]);
  const [saved, setSaved] = useState<'saved' | 'not-saved' | 'off'>(storageKey ? 'saved' : 'off');
  const first = useRef(true);

  useEffect(() => {
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
    const read = parseSystem(await file.text());
    if (read.issues.some((i) => i.code === 'json' || i.code === 'shape')) { setNotes(read.issues); return; }
    replace({ name: file.name.replace(/\.json$/i, '').replace(/^system$/, studio.name), system: read.system }, read.issues);
  };
  const files = useMemo(() => (exporting ? studioFiles(studio.system) : []), [exporting, studio.system]);

  return (
    <div data-slot="cloudflare-studio" className={cn('relative flex h-full min-h-[560px] w-full flex-col bg-background text-foreground', className)}>
      <header data-slot="cloudflare-studio-bar" className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <TextField aria-label="The system’s name" value={studio.name} onChange={(name) => setStudio((s) => ({ ...s, name }))} className="min-w-0 flex-1 basis-40">
          <Input data-slot="cloudflare-studio-name" size="sm" className="font-semibold" />
        </TextField>
        <span data-slot="cloudflare-studio-saved" data-saved={saved} role="status" className="text-footnote text-muted-foreground">
          {saved === 'saved' ? 'Kept in this browser' : saved === 'not-saved' ? 'Couldn’t keep it in this browser' : ''}
        </span>
        <div className="flex flex-wrap gap-2">
          <Button data-slot="cloudflare-studio-new" variant="secondary" size="sm" onPress={() => replace({ name: 'Untitled system', system: EMPTY_SYSTEM })}>New</Button>
          <FileUploadButton data-slot="cloudflare-studio-open" variant="secondary" size="sm" accept={['application/json', '.json']} multiple={false} onFiles={(entries) => { if (entries[0]) void open(entries[0].file); }}>Open</FileUploadButton>
          <Button data-slot="cloudflare-studio-export" size="sm" onPress={() => setExporting(true)}>Export</Button>
        </div>
        {notes.length ? (
          <ul data-slot="cloudflare-studio-notes" className="m-0 flex w-full list-none flex-col gap-1 p-0 text-footnote">
            {notes.map((n, i) => <li key={i} data-code={n.code} className={n.severity === 'error' ? 'text-destructive' : 'text-muted-foreground'}>{n.message}</li>)}
          </ul>
        ) : null}
      </header>
      <div className="relative min-h-0 flex-1">
        <CloudflareDiagram
          key={generation}
          editable
          services={studio.system.services}
          edges={studio.system.edges}
          onChange={(change) => changeSystem({ services: change.services, edges: change.edges })}
          aria-label={studio.name}
        />
      </div>
      <Credenza open={exporting} onClose={() => setExporting(false)} title={`Export ${studio.name}`}>
        <div data-slot="cloudflare-studio-files" className="bl-scroll flex max-h-[70vh] flex-col gap-4 overflow-y-auto pb-2">
          <p className="m-0 text-footnote text-muted-foreground">Files only: nothing’s deployed. What a file still needs that the system doesn’t say is under it.</p>
          <div><Button data-slot="cloudflare-studio-download-all" size="sm" onPress={() => files.forEach(download)}>Download all {files.length}</Button></div>
          {files.map((file) => (
            <section key={file.path} data-slot="cloudflare-studio-file" data-path={file.path} aria-label={file.path} className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-mono text-footnote font-semibold">{file.path}</span>
                <Button data-slot="cloudflare-studio-download" variant="secondary" size="sm" aria-label={`Download ${file.path}`} onPress={() => download(file)}>Download</Button>
              </div>
              {file.needs.length ? (
                <ul data-slot="cloudflare-studio-needs" className="m-0 flex list-none flex-col gap-0.5 p-0 text-footnote text-muted-foreground">
                  {file.needs.map((need, i) => <li key={i}>{need}</li>)}
                </ul>
              ) : null}
              <pre data-slot="cloudflare-studio-file-text" className="bl-scroll m-0 max-h-60 overflow-auto rounded-ctl bg-secondary p-2 font-mono text-caption">{file.text}</pre>
            </section>
          ))}
        </div>
      </Credenza>
    </div>
  );
}
