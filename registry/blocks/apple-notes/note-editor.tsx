/* The note: its date, then the note itself in a MarkdownEditor dressed as Notes — a big bold title line,
   round checklist circles that fill with the tint, hairline tables. Locked notes show the lock screen until
   you choose View Note; the note blurs in where the lock was. */
import { useRef, type RefObject } from 'react';
import { Button, ContentSwap, MarkdownEditor, cn, type MarkdownEditorHandle } from '@brett_lamy/ui';
import { longDate, type Note } from './data';
import { G } from './glyphs';
import type { NotesState } from './use-notes';

/* Notes typography and controls over the editor's own stylesheet (which is unlayered, hence the `!`). */
const NOTES_EDITOR = cn(
  'text-[17px] leading-[1.5]',
  // The first line is the title, whatever block it is.
  '[&_.ProseMirror>:first-child]:text-[28px]! [&_.ProseMirror>:first-child]:leading-[1.2]! [&_.ProseMirror>:first-child]:font-bold! [&_.ProseMirror>:first-child]:tracking-[-.4px]! [&_.ProseMirror>:first-child]:mb-2!',
  '[&_.ProseMirror_h2]:text-[21px]! [&_.ProseMirror_h2]:font-bold! [&_.ProseMirror_h2]:mt-5!',
  // Checklists: round circles that fill with the tint.
  '[&_ul[data-type=taskList]]:pl-0! [&_ul[data-type=taskList]_li]:gap-2.5! [&_ul[data-type=taskList]_li]:items-start',
  '[&_ul[data-type=taskList]_label]:mt-[2px]! [&_ul[data-type=taskList]_input]:appearance-none! [&_ul[data-type=taskList]_input]:m-0!',
  '[&_ul[data-type=taskList]_input]:size-[21px]! [&_ul[data-type=taskList]_input]:rounded-full! [&_ul[data-type=taskList]_input]:cursor-pointer',
  '[&_ul[data-type=taskList]_input]:shadow-[inset_0_0_0_1.6px_var(--bl-label3)] [&_ul[data-type=taskList]_input]:transition-[background-color,box-shadow] [&_ul[data-type=taskList]_input]:duration-200',
  '[&_ul[data-type=taskList]_input:checked]:bg-primary! [&_ul[data-type=taskList]_input:checked]:shadow-none!',
  '[&_ul[data-type=taskList]_input:checked]:bg-[url(data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%20fill=%27none%27%20stroke=%27white%27%20stroke-width=%273.2%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Cpath%20d=%27M6%2012.5l4%204%208-9%27/%3E%3C/svg%3E)]!',
  '[&_ul[data-type=taskList]_input:checked]:bg-[length:13px_13px]! [&_ul[data-type=taskList]_input:checked]:bg-center! [&_ul[data-type=taskList]_input:checked]:bg-no-repeat!',
  '[&_li[data-checked=true]>div]:text-muted-foreground',
  // Tables: hairlines, no header fill.
  '[&_.ProseMirror_th]:bg-transparent! [&_.ProseMirror_th]:font-semibold! [&_.ProseMirror_:is(th,td)]:border-border! [&_.ProseMirror_:is(th,td)]:px-3! [&_.ProseMirror_:is(th,td)]:py-2!',
  '[&_.ProseMirror_table]:text-[15px]',
);

function Locked({ onUnlock }: { onUnlock: () => void }) {
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div className="flex flex-col items-center">
        <span className="mb-4 grid size-16 place-items-center rounded-full bg-bl-fill text-muted-foreground"><G name="lockFill" size={30} /></span>
        <div className="text-[20px] font-semibold">This note is locked.</div>
        <div className="mt-1 max-w-[280px] text-[14px] text-muted-foreground">Use Touch ID or enter your password to view this note.</div>
        <Button variant="secondary" className="mt-5 text-primary" onPress={onUnlock}>View Note</Button>
      </div>
    </div>
  );
}

export function NoteEditor({ notes, n, editorRef, format }: {
  notes: NotesState; n: Note; editorRef: RefObject<MarkdownEditorHandle | null>; format: boolean;
}) {
  // Only edits made while the editor has focus count (the editor normalizes on load; that isn't a change).
  const focused = useRef(false);
  const locked = notes.isLocked(n);
  return (
    <ContentSwap id={locked ? `locked-${n.id}` : n.id}>
      {locked ? <Locked onUnlock={() => notes.unlock(n.id)} /> : (
        <div className="mx-auto box-border w-full max-w-[720px] px-6 pt-2 pb-28 select-text">
          <div className="pb-3 text-center text-[13px] text-muted-foreground">{longDate(n.updated)}</div>
          <MarkdownEditor key={n.id} ref={editorRef} variant="ghost" aria-label="Note" defaultValue={n.body}
            autoFocus={!n.body} placeholder="Title" toolbar={format} minHeight={320}
            onFocus={() => { focused.current = true; }} onBlur={() => { focused.current = false; }}
            onValueChange={(md) => { if (focused.current) notes.edit(n.id, md); }}
            className={NOTES_EDITOR} />
        </div>
      )}
    </ContentSwap>
  );
}

/** Editor tools for the toolbar: Aa (formatting bar), checklist, table. */
export function EditorTools({ editorRef, format, onFormat, disabled }: {
  editorRef: RefObject<MarkdownEditorHandle | null>; format: boolean; onFormat: () => void; disabled?: boolean;
}) {
  const tool = 'h-9 w-10 rounded-[10px] px-0 text-primary data-hovered:bg-bl-fill';
  return (
    <>
      <Button variant="ghost" preventFocusOnPress aria-label="Format" aria-pressed={format} isDisabled={disabled} onPress={onFormat}
        className={cn(tool, format && 'bg-bl-fill')}><G name="format" /></Button>
      <Button variant="ghost" preventFocusOnPress aria-label="Checklist" isDisabled={disabled} className={tool}
        onPress={() => editorRef.current?.chain()?.toggleList('taskList', 'taskItem').run()}><G name="checklist" /></Button>
      <Button variant="ghost" preventFocusOnPress aria-label="Table" isDisabled={disabled} className={tool}
        onPress={() => editorRef.current?.insertMarkdown('| Column | Column |\n| --- | --- |\n|  |  |\n|  |  |')}><G name="table" /></Button>
    </>
  );
}
