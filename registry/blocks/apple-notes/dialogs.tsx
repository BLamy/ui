/* New note, new folder, delete confirmations and Move or Copy: a Credenza over the whole app — a centered dialog on wide
   layouts, a bottom tray you can drag away on the phone. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Credenza, CredenzaBackdrop, CredenzaClose, CredenzaContent, CredenzaHeader, CredenzaTitle, CredenzaView } from '@/components/ui/credenza';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useSplitView } from '@/components/ui/split-view';
import type { NotesState } from './use-notes';

const message = (e: unknown) => e instanceof Error ? e.message : String(e);

/** Keeps the last non-null value, so a closing sheet keeps showing what it showed while it animates away. */
function useLast<T>(value: T | null) {
  const last = useRef(value);
  if (value !== null) last.current = value;
  return last.current;
}

/** Notes' sheet: a dialog beside the columns, a tray when they have collapsed to one (Credenza's `"auto"` follows the
    split view's size class). Closing it (×, Escape, the scrim, a drag down or a Cancel) runs `onClose`. */
export function NotesCredenza({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  return <Credenza open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
    <CredenzaBackdrop />
    <CredenzaContent>
      <CredenzaHeader><CredenzaTitle>{title}</CredenzaTitle><CredenzaClose /></CredenzaHeader>
      <CredenzaView>{children}</CredenzaView>
    </CredenzaContent>
  </Credenza>;
}

/** A sheet's Cancel: closes it, like the ×. */
function Cancel() {
  return <CredenzaClose render={<Button variant="secondary" className="flex-1" />}>Cancel</CredenzaClose>;
}

function CreateForm({ notes, kind }: { notes: NotesState; kind: 'file' | 'folder' }) {
  const s = useSplitView();
  const folder = kind === 'folder';
  const [name, setName] = useState(folder ? '' : 'Untitled.md');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  // The field takes focus as the sheet opens (`data-autofocus`: the dialog's initial focus looks for the attribute,
  // which React's `autoFocus` doesn't render). The stem is selected, so typing replaces “Untitled” and keeps “.md”.
  useEffect(() => {
    const frame = requestAnimationFrame(() => form.current?.querySelector('input')?.setSelectionRange(0, folder ? name.length : name.replace(/\.mdx?$/i, '').length));
    return () => cancelAnimationFrame(frame);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <form ref={form} className="px-4 pt-0.5 pb-4" onSubmit={(e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError(null);
    void (folder ? notes.createFolder(name.trim()) : notes.create(name.trim()))
      .then(() => { if (!folder) s.show('detail'); })
      .catch((err: unknown) => { setError(message(err)); setBusy(false); });
  }}>
    <Field invalid={error ? true : undefined} className="mb-1">
      <FieldLabel className="text-footnote text-muted-foreground">{folder ? 'Folder name' : 'File name'} in {notes.folder.path ? notes.folder.title : 'Notes'}</FieldLabel>
      <Input value={name} onValueChange={(v) => { setName(v); setError(null); }} data-autofocus="" spellCheck={false} autoCapitalize="off" autoCorrect="off" />
    </Field>
    <p role={error ? 'alert' : undefined} className="m-0 min-h-5 text-footnote text-destructive">{error}</p>
    <div className="mt-2 flex gap-2">
      <Cancel />
      <Button type="submit" className="flex-1" disabled={busy || !name.trim()}>{folder ? 'Create Folder' : 'Create Note'}</Button>
    </div>
  </form>;
}

function DeleteConfirm({ notes, id }: { notes: NotesState; id: string }) {
  const n = notes.notes.find((item) => item.id === id);
  const f = notes.folders.find((item) => item.id === id);
  const where = (n?.file.source ?? f?.source) === 'browser' ? 'this browser' : 'your computer';
  const inside = f ? notes.count(f) : 0;
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return <div className="px-4 pt-0.5 pb-4">
    <p className="m-0 mb-4 text-subhead leading-[1.45] text-muted-foreground">
      {f ? `The folder${inside ? ` and the ${inside} ${inside === 1 ? 'note' : 'notes'} in it` : ''} will be deleted from ${where}.` : `The file will be deleted from ${where}.`} You can’t undo this.
    </p>
    {error ? <p role="alert" className="m-0 mb-3 text-footnote text-destructive">{error}</p> : null}
    <div className="flex gap-2">
      <Cancel />
      <Button variant="destructive" className="flex-1" disabled={busy} onClick={() => {
        setBusy(true);
        void notes.remove(id).then(() => notes.setDeleting(null)).catch((e: unknown) => { setError(message(e)); setBusy(false); });
      }}>Delete</Button>
    </div>
  </div>;
}

/** Files dragged onto another location: move them (they leave this one) or copy them, to the top of that location. */
function TransferConfirm({ notes, paths, to }: { notes: NotesState; paths: string[]; to: string }) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const what = paths.length === 1 ? `“${paths[0]!.slice(paths[0]!.lastIndexOf('/') + 1)}”` : `${paths.length} files`;
  const go = (mode: 'move' | 'copy') => {
    const target = notes.transfer?.to.path;
    if (!target) return;
    setBusy(true); setError(null);
    void notes.transferFiles(paths, target, mode).then(() => notes.setTransfer(null)).catch((e: unknown) => { setError(message(e)); setBusy(false); });
  };
  return <div className="px-4 pt-0.5 pb-4">
    <p className="m-0 mb-4 text-subhead leading-[1.45] text-muted-foreground">
      Move {what} to {to}, or keep {paths.length === 1 ? 'it' : 'them'} here and put a copy there? {paths.length === 1 ? 'It goes' : 'They go'} at the top of {to}.
    </p>
    {error ? <p role="alert" className="m-0 mb-3 text-footnote text-destructive">{error}</p> : null}
    <div className="flex gap-2">
      <Cancel />
      <Button variant="secondary" className="flex-1" disabled={busy} onClick={() => go('copy')}>Copy</Button>
      <Button className="flex-1" disabled={busy} onClick={() => go('move')}>Move</Button>
    </div>
  </div>;
}

/** Render inside the SplitView, so the sheet covers every column and knows when the layout is the phone's. */
export function NotesDialogs({ notes }: { notes: NotesState }) {
  const creating = useLast(notes.creating);
  const deleting = useLast(notes.deleting);
  const transfer = useLast(notes.transfer);
  const name = deleting ? notes.notes.find((n) => n.id === deleting)?.file.name ?? notes.folders.find((f) => f.id === deleting)?.title : '';
  return <>
    <NotesCredenza open={!!notes.creating} onClose={() => notes.setCreating(null)}
      title={creating === 'folder' ? 'New Folder' : 'New Note'}>
      {/* Keyed so each opening starts from a fresh name. */}
      {creating ? <CreateForm key={`${creating}:${notes.creating ? 'open' : 'closed'}`} notes={notes} kind={creating} /> : null}
    </NotesCredenza>
    <NotesCredenza open={!!notes.transfer} onClose={() => notes.setTransfer(null)}
      title={transfer ? `Move or Copy to ${transfer.to.title}?` : ''}>
      {transfer ? <TransferConfirm key={transfer.paths.join('\n')} notes={notes} paths={transfer.paths} to={transfer.to.title} /> : null}
    </NotesCredenza>
    <NotesCredenza open={!!notes.deleting} onClose={() => notes.setDeleting(null)} title={`Delete “${name}”?`}>
      {deleting ? <DeleteConfirm key={deleting} notes={notes} id={deleting} /> : null}
    </NotesCredenza>
  </>;
}
