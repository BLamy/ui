/* The landing page's live app: Notes, built from the kit's own parts and nothing else. A SplitView of three columns
   (folders, a list, a note), a Dialog that adds a note, a DropdownMenu that sorts the list, a SearchInput that filters
   it, and MarkdownView drawing each note. It holds real state: a note you add is filed, listed, selected and rendered.
   It is a plain composition of public parts, the way an app would write it; the stage around it only sets its width. */
import { useId, useMemo, useState } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { Dialog, DialogBackdrop, DialogBody, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroupLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { EmptyState } from '@/components/ui/empty-state';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { MarkdownView } from '@/components/ui/markdown-view';
import { SearchInput } from '@/components/ui/search-input';
import {
  SplitView, SplitViewContent, SplitViewDetail, SplitViewHeader, SplitViewItem, SplitViewSection, SplitViewSidebar, SplitViewSidebarTrigger,
  SplitViewSupplementary, createSplitViewController, useSplitView,
} from '@/components/ui/split-view';
import { Textarea } from '@/components/ui/textarea';
import { Icon } from '@/lib/icon';
import { cx } from '@/lib/utils';
import { ALL, FOLDERS, NEW_NOTE_FOLDER, NOTES, type Note } from './notes-data';

type Sort = 'newest' | 'title';
/** What the compose dialog hands back. */
type Draft = Pick<Note, 'title' | 'markdown'>;

/** A bar's icon button, in the tint. It also renders popup triggers: `<DialogTrigger render={<BarButton label="…" />}>`. */
function BarButton({ label, className, ...props }: Omit<ButtonProps, 'aria-label'> & { label: string }) {
  return <Button variant="ghost" aria-label={label} {...props} className={cx('h-9 w-10 rounded-ctl px-0 text-primary hover:bg-secondary', className)} />;
}

const inFolder = (notes: Note[], folder: string | null | undefined) => (!folder || folder === ALL ? notes : notes.filter((n) => n.folder === folder));

function Folders({ notes }: { notes: Note[] }) {
  return (
    <SplitViewSidebar aria-label="Folders" width={232}>
      <SplitViewHeader title="Folders" />
      <SplitViewContent className="px-2.5 pb-4">
        <SplitViewSection title="About the kit">
          {FOLDERS.map((f) => (
            <SplitViewItem key={f.id} value={f.id} title={f.title} icon={f.icon} trailing={inFolder(notes, f.id).length} />
          ))}
        </SplitViewSection>
      </SplitViewContent>
    </SplitViewSidebar>
  );
}

function SortMenu({ sort, onSort }: { sort: Sort; onSort: (sort: Sort) => void }) {
  return (
    <DropdownMenu presentation="auto">
      <DropdownMenuTrigger render={<BarButton label="Sort notes" />}><Icon name="ellipsis-circle" /></DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup value={sort} onValueChange={(v) => onSort(v as Sort)}>
          <DropdownMenuGroupLabel>Sort by</DropdownMenuGroupLabel>
          <DropdownMenuRadioItem value="newest" closeOnSelect>Newest first</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="title" closeOnSelect>Title</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** The compose button and its Dialog. No `presentation`: "auto" is the default, so it is a card in a medium or regular
    frame and a sheet in a compact one. */
function NewNote({ onAdd }: { onAdd: (draft: Draft) => void }) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const titleId = useId();
  const named = title.trim() || 'Untitled';
  return (
    <Dialog onOpenChange={(open) => { if (open) { setTitle(''); setText(''); } }}>
      <DialogTrigger render={<BarButton label="New note" />}><Icon name="compose" /></DialogTrigger>
      <DialogBackdrop />
      <DialogContent initialFocus={`#${CSS.escape(titleId)}`}>
        <DialogClose />
        <DialogHeader>
          <DialogTitle>New note</DialogTitle>
          <DialogDescription>Write Markdown. The renderer that draws the other notes draws yours.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-4">
          <Field>
            <FieldLabel>Title</FieldLabel>
            <Input id={titleId} value={title} onValueChange={setTitle} placeholder="Untitled" />
          </Field>
          <Field>
            <FieldLabel>Text</FieldLabel>
            <Textarea value={text} onValueChange={setText} rows={4} placeholder={'**Bold**, `code`, lists and tables.'} className="font-mono" />
          </Field>
        </DialogBody>
        <DialogFooter>
          <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
          <DialogClose render={<Button />} value="add" disabled={!title.trim() && !text.trim()} action={() => onAdd({ title: named, markdown: `## ${named}\n\n${text.trim()}` })}>
            Add note
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NoteList({ notes, onAdd }: { notes: Note[]; onAdd: (draft: Draft) => void }) {
  const s = useSplitView();
  const folder = FOLDERS.find((f) => f.id === s.value.sidebar) ?? FOLDERS[0];
  const [sort, setSort] = useState<Sort>('newest');
  const [query, setQuery] = useState('');
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = inFolder(notes, folder.id).filter((n) => !q || `${n.title} ${n.summary} ${n.markdown}`.toLowerCase().includes(q));
    return list.sort((a, b) => (sort === 'title' ? a.title.localeCompare(b.title) : b.order - a.order));
  }, [notes, folder.id, sort, query]);
  return (
    <SplitViewSupplementary aria-label={folder.title} width={320}>
      <SplitViewHeader
        title={folder.title}
        leading={<SplitViewSidebarTrigger />}
        trailing={<><SortMenu sort={sort} onSort={setSort} /><NewNote onAdd={onAdd} /></>}
      />
      <SplitViewContent>
        <div className="px-4 pt-1 pb-2"><SearchInput aria-label="Search notes" value={query} onValueChange={setQuery} /></div>
        {shown.length === 0 ? (
          <EmptyState className="h-40" title={query ? 'No matches' : 'No notes'} description={query ? `Nothing here mentions “${query}”.` : 'Add one with the compose button.'} />
        ) : null}
        {shown.map((n) => (
          <SplitViewItem
            key={n.id}
            value={n.id}
            variant="row"
            title={<span className="font-semibold">{n.title}</span>}
            description={<><span className="me-1.5 text-foreground/80">{n.when}</span>{n.summary}</>}
          />
        ))}
      </SplitViewContent>
    </SplitViewSupplementary>
  );
}

function NotePage({ notes }: { notes: Note[] }) {
  const s = useSplitView();
  const note = notes.find((n) => n.id === s.value.supplementary);
  return (
    <SplitViewDetail aria-label="Note">
      <SplitViewHeader leading={s.columns.includes('supplementary') ? null : <SplitViewSidebarTrigger />} />
      {note ? (
        <SplitViewContent key={note.id}>
          <article className="mx-auto max-w-2xl px-6 pt-1 pb-10 select-text">
            <p className="m-0 mb-4 text-center text-footnote text-muted-foreground">{note.when}</p>
            <MarkdownView markdown={note.markdown} />
          </article>
        </SplitViewContent>
      ) : (
        <EmptyState icon={<Icon name="note" />} title="No note selected" />
      )}
    </SplitViewDetail>
  );
}

/** Notes: folders, a list and a note. It fills the box it is given and lays itself out from that box's width. */
export default function NotesApp() {
  const [notes, setNotes] = useState(NOTES);
  const [controller] = useState(createSplitViewController);
  const add = (draft: Draft) => {
    const id = `note-${notes.length + 1}`;
    // Filed where the reader is; from All Notes, with the other Markdown.
    const here = controller.getValue().sidebar;
    const folder = here && here !== ALL ? here : NEW_NOTE_FOLDER;
    const summary = draft.markdown.split('\n').slice(1).join(' ').replace(/[#*`>_|-]/g, '').replace(/\s+/g, ' ').trim();
    setNotes((all) => [{ ...draft, id, folder, summary: summary || 'No more text', when: 'Now', order: all.length + 1 }, ...all]);
    // Select it, and show it: `show` puts the note on top while the split view is a stack.
    controller.select('supplementary', id);
    controller.show('detail');
  };
  return (
    <SplitView
      aria-label="Notes"
      controller={controller}
      defaultValue={{ sidebar: ALL, supplementary: NOTES[0].id }}
      onValueChange={(value, details) => {
        // A folder pressed: open its first note, as Notes does, unless the open one is already in it.
        if (details.column !== 'sidebar' || details.reason !== 'item-press') return;
        const list = inFolder(notes, value.sidebar);
        if (!list.some((n) => n.id === value.supplementary)) controller.setValue({ ...value, supplementary: list[0]?.id });
      }}
    >
      <Folders notes={notes} />
      <NoteList notes={notes} onAdd={add} />
      <NotePage notes={notes} />
    </SplitView>
  );
}
