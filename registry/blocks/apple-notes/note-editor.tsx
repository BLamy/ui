/* The note: its date, then the note itself in a MarkdownEditor dressed as Notes — a big bold title line,
   round checklist circles that fill with the tint, hairline tables. Locked notes show the lock screen until
   you choose View Note; the note blurs in where the lock was. */
import { useRef, type RefObject } from 'react';
import { ContentSwap } from '@/components/ui/animated-height';
import { Button } from '@/components/ui/button';
import { MarkdownEditor, type MarkdownEditorClassNames, type MarkdownEditorHandle } from '@/components/ui/markdown-editor';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { longDate, type Note } from './data';
import type { NotesState } from './use-notes';

/* Notes typography and controls, styled through the editor's `classNames` slots (its stylesheet sits in a layer
   under utilities, so plain classes win). */
const NOTES_PARTS: MarkdownEditorClassNames = {
  // The first line is the title, whatever block it is.
  title: 'text-[28px] leading-[1.2] font-bold tracking-[-.4px] mb-2',
  heading: 'text-[21px] font-bold mt-5',
  // Checklists: round circles that fill with the tint; done items fade.
  checklist: 'pl-0',
  checklistItem: 'gap-2.5 items-start [&>label]:mt-[2px] data-[checked=true]:[&>div]:text-muted-foreground',
  checkbox: cn(
    'appearance-none m-0 size-[21px] rounded-full cursor-pointer',
    'shadow-[inset_0_0_0_1.6px_var(--tertiary-foreground,color-mix(in_oklab,var(--muted-foreground)_60%,transparent))] transition-[background-color,box-shadow] duration-200',
    'checked:bg-primary checked:shadow-none checked:bg-[length:13px_13px] checked:bg-center checked:bg-no-repeat',
    'checked:bg-[url(data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2024%2024%27%20fill=%27none%27%20stroke=%27white%27%20stroke-width=%273.2%27%20stroke-linecap=%27round%27%20stroke-linejoin=%27round%27%3E%3Cpath%20d=%27M6%2012.5l4%204%208-9%27/%3E%3C/svg%3E)]',
  ),
  // Tables: hairlines, no header fill.
  table: 'text-subhead',
  tableHeader: 'bg-transparent font-semibold border-border px-3 py-2',
  tableCell: 'border-border px-3 py-2',
};

function Locked({ onUnlock }: { onUnlock: () => void }) {
  return (
    <div className="grid min-h-[60vh] place-items-center px-6 text-center">
      <div className="flex flex-col items-center">
        <span className="mb-4 grid size-16 place-items-center rounded-full bg-secondary text-muted-foreground"><Icon name="lock-fill" size={30} /></span>
        <div className="text-title font-semibold">This note is locked.</div>
        <div className="mt-1 max-w-[280px] text-detail text-muted-foreground">Use Touch ID or enter your password to view this note.</div>
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
        <div className="mx-auto w-full max-w-[720px] px-6 pt-2 pb-28 select-text">
          <div className="pb-3 text-center text-footnote text-muted-foreground">{longDate(n.updated)}</div>
          <MarkdownEditor key={n.id} ref={editorRef} variant="ghost" aria-label="Note" defaultValue={n.body}
            autoFocus={!n.body} placeholder="Title" toolbar={format} minHeight={320}
            onFocus={() => { focused.current = true; }} onBlur={() => { focused.current = false; }}
            onValueChange={(md) => { if (focused.current) notes.edit(n.id, md); }}
            className="text-body leading-[1.5]" classNames={NOTES_PARTS} />
        </div>
      )}
    </ContentSwap>
  );
}

/** Editor tools for the toolbar: Aa (formatting bar), checklist, table. */
export function EditorTools({ editorRef, format, onFormat, disabled }: {
  editorRef: RefObject<MarkdownEditorHandle | null>; format: boolean; onFormat: () => void; disabled?: boolean;
}) {
  const tool = 'h-9 w-10 rounded-ctl px-0 text-primary data-hovered:bg-secondary';
  return (
    <>
      <Button variant="ghost" preventFocusOnPress aria-label="Format" aria-pressed={format} isDisabled={disabled} onPress={onFormat}
        className={cn(tool, format && 'bg-secondary')}><Icon name="textformat" /></Button>
      <Button variant="ghost" preventFocusOnPress aria-label="Checklist" isDisabled={disabled} className={tool}
        onPress={() => editorRef.current?.chain()?.toggleList('taskList', 'taskItem').run()}><Icon name="checklist" /></Button>
      <Button variant="ghost" preventFocusOnPress aria-label="Table" isDisabled={disabled} className={tool}
        onPress={() => editorRef.current?.insertMarkdown('| Column | Column |\n| --- | --- |\n|  |  |\n|  |  |')}><Icon name="table" /></Button>
    </>
  );
}
