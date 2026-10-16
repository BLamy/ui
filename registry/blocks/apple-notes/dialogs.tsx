/* New note, new folder and delete confirmations: a Credenza over the whole app — a centered dialog on wide
   layouts, a bottom tray you can drag away on the phone. */
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Credenza } from '@/components/ui/credenza';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TextField } from '@/components/ui/text-field';
import { useSplitView } from '@/components/ui/split-view';
import type { NotesState } from './use-notes';

const message = (e: unknown) => e instanceof Error ? e.message : String(e);

/** Keeps the last non-null value, so a closing sheet keeps showing what it showed while it animates away. */
function useLast<T>(value: T | null) {
  const last = useRef(value);
  if (value !== null) last.current = value;
  return last.current;
}

function CreateForm({ notes, kind }: { notes: NotesState; kind: 'file' | 'folder' }) {
  const s = useSplitView();
  const folder = kind === 'folder';
  const [name, setName] = useState(folder ? '' : 'Untitled.md');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  // The stem is selected, so typing replaces “Untitled” and keeps “.md”.
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
    <TextField value={name} onChange={(v) => { setName(v); setError(null); }} isInvalid={!!error} className="mb-1">
      <Label className="text-footnote text-muted-foreground">{folder ? 'Folder name' : 'File name'} in {notes.folder.path ? notes.folder.title : 'Notes'}</Label>
      <Input data-autofocus="" spellCheck={false} autoCapitalize="off" autoCorrect="off" />
    </TextField>
    <p role={error ? 'alert' : undefined} className="m-0 min-h-5 text-footnote text-destructive">{error}</p>
    <div className="mt-2 flex gap-2">
      <Button variant="secondary" className="flex-1" onPress={() => notes.setCreating(null)}>Cancel</Button>
      <Button type="submit" className="flex-1" isDisabled={busy || !name.trim()}>{folder ? 'Create Folder' : 'Create Note'}</Button>
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
      <Button variant="secondary" className="flex-1" onPress={() => notes.setDeleting(null)}>Cancel</Button>
      <Button variant="destructive" className="flex-1" isDisabled={busy} onPress={() => {
        setBusy(true);
        void notes.remove(id).then(() => notes.setDeleting(null)).catch((e: unknown) => { setError(message(e)); setBusy(false); });
      }}>Delete</Button>
    </div>
  </div>;
}

/** Render inside the SplitView, so the sheet covers every column and knows when the layout is the phone's. */
export function NotesDialogs({ notes }: { notes: NotesState }) {
  const s = useSplitView();
  const creating = useLast(notes.creating);
  const deleting = useLast(notes.deleting);
  const name = deleting ? notes.notes.find((n) => n.id === deleting)?.file.name ?? notes.folders.find((f) => f.id === deleting)?.title : '';
  return <>
    <Credenza compact={s.collapsed} open={!!notes.creating} onClose={() => notes.setCreating(null)}
      title={creating === 'folder' ? 'New Folder' : 'New Note'}>
      {/* Keyed so each opening starts from a fresh name. */}
      {creating ? <CreateForm key={`${creating}:${notes.creating ? 'open' : 'closed'}`} notes={notes} kind={creating} /> : null}
    </Credenza>
    <Credenza compact={s.collapsed} open={!!notes.deleting} onClose={() => notes.setDeleting(null)} title={`Delete “${name}”?`}>
      {deleting ? <DeleteConfirm key={deleting} notes={notes} id={deleting} /> : null}
    </Credenza>
  </>;
}
