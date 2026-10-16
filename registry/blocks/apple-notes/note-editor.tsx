import { useEffect, useRef, type RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { MarkdownEditor, type MarkdownEditorClassNames, type MarkdownEditorHandle } from '@/components/ui/markdown-editor';
import { BROWSER_ROOT } from './use-note-files';
import type { Note } from './data';
import type { NotesState } from './use-notes';
import { useNoteDemos } from './use-note-demos';

const NOTES_PARTS: MarkdownEditorClassNames = {
  title: 'text-[28px] leading-[1.2] font-bold tracking-[-.4px] mb-2',
  heading: 'text-[21px] font-bold mt-5',
  checklist: 'pl-0',
  checklistItem: 'gap-2.5 items-start [&>label]:mt-[2px] data-[checked=true]:[&>div]:text-muted-foreground',
  checkbox: 'size-[21px] cursor-pointer',
  table: 'text-subhead',
  tableHeader: 'bg-transparent font-semibold border-border px-3 py-2',
  tableCell: 'border-border px-3 py-2',
};

/** The document is owned by Docstream, including its first-party property sheet. Both views autosave. */
export function NoteEditor({ notes, n, source, format, editorRef }: {
  notes: NotesState; n: Note; source: boolean; format: boolean; editorRef: RefObject<MarkdownEditorHandle | null>;
}) {
  const root = useRef<HTMLDivElement>(null);
  const demos = useNoteDemos(n.body, n.file.path, notes.files.directoryRoots);
  const { unseen, markSeen } = notes.files;
  useEffect(() => {
    const see = () => {
      const element = root.current;
      const box = element?.getBoundingClientRect();
      if (element && box && !element.closest('[inert]') && box.right > 0 && box.left < window.innerWidth && document.visibilityState === 'visible' && document.hasFocus()) markSeen(n.id);
    };
    see(); window.addEventListener('focus', see); document.addEventListener('visibilitychange', see);
    return () => { window.removeEventListener('focus', see); document.removeEventListener('visibilitychange', see); };
  }, [n.id, n.body, unseen, markSeen]);
  const status = notes.fileStatus(n);
  const draft = notes.drafts[n.id];
  const info = n.file;
  const onSaveKey = (event: { metaKey: boolean; ctrlKey: boolean; key: string; preventDefault(): void }) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 's') {
      event.preventDefault(); if (!status.conflict) void notes.save(n.id); return true;
    }
    return false;
  };
  return <div ref={root} className="mx-auto w-full max-w-[720px] px-6 pt-4 pb-28 select-text">
    <div role="status" aria-live="polite" className="sr-only">{status.label}</div>
    <div className="pb-4 text-center text-footnote text-muted-foreground"><time dateTime={n.updated.toISOString()}>
      {n.updated.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} at {n.updated.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
    </time></div>
    {demos.error ? <p role="status" className="text-caption text-muted-foreground">{demos.error}</p> : null}
    {draft?.error && !status.conflict ? <div role="alert" className="mb-4 flex items-center gap-2 text-detail text-destructive">
      <span className="flex-1">{draft.error}</span><Button size="sm" variant="ghost" onPress={() => { void notes.save(n.id); }}>Retry</Button>
    </div> : null}
    {status.conflict ? <div role="alert" className="space-y-2 rounded-lg border border-border bg-secondary p-3 text-detail">
      <p className="m-0">{status.missing ? 'This file is no longer available. Your edits are still here.' : 'The file changed in another editor. Your edits have been kept. Choose which version to save.'}</p>
      {!status.missing ? <details><summary className="cursor-pointer">View current file</summary><pre className="max-h-60 overflow-auto whitespace-pre-wrap break-words font-mono text-caption">{draft?.conflict ?? notes.files.notes.find((item) => item.id === n.id)?.body}</pre></details> : null}
      <div className="flex flex-wrap gap-1">
        {!status.missing ? <>
          <Button size="sm" variant="secondary" isDisabled={!!draft?.saving} onPress={() => notes.revert(n.id)}>Use disk version</Button>
          <Button size="sm" isDisabled={!!draft?.saving} onPress={() => { void notes.save(n.id, true); }}>Keep my edits</Button>
        </> : <Button size="sm" isDisabled={!notes.files.ready || !notes.files.isOpfsWritable || !!draft?.saving} onPress={() => {
          void notes.files.run(async () => {
            const extension = /\.mdx$/i.test(info.name) ? '.mdx' : '.md';
            const id = await notes.files.create(BROWSER_ROOT, `${info.name.replace(/\.mdx?$/i, '')} recovered ${Date.now()}${extension}`, n.body);
            notes.revert(n.id); notes.select(id);
          });
        }}>Keep a copy in Notes</Button>}
      </div>
    </div> : null}
    {source ? <textarea aria-label={`${info.name} source`} value={n.body} spellCheck={false} autoCapitalize="off" autoCorrect="off"
      onChange={(e) => notes.edit(n.id, e.target.value)}
      onKeyDown={onSaveKey}
      className="min-h-[60vh] w-full resize-none border-0 bg-transparent p-0 font-mono text-[14px] leading-6 text-foreground outline-none" /> :
      <MarkdownEditor key={n.id} ref={editorRef} value={n.body} variant="ghost" toolbar={format} aria-label={`${info.name} note`}
        demoResolver={demos.resolver} demoVFS={demos.vfs} demoRuntime={demos.runtime}
        placeholder="Start writing…" minHeight="60vh" onKeyDown={onSaveKey}
        onValueChange={(markdown) => {
          if (markdown !== n.body) notes.edit(n.id, markdown);
        }}
        className="text-body leading-[1.5]" classNames={NOTES_PARTS} />
    }
  </div>;
}
