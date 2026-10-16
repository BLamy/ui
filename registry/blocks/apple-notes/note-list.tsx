import { ListRow } from '@/components/ui/list';
import { cn } from '@/lib/utils';
import { shortDate, snippet, type Note } from './data';
import { ItemMenu, RenameField } from './item-menu';
import type { NotesState } from './use-notes';
import { UnreadDot } from './parts';

/** Leaf rows only select the note. They never change the master list's navigation path. */
export function NoteList({ notes, items, onOpen }: { notes: NotesState; items: Note[]; onOpen: (id: string) => void }) {
  return <div>
    {items.map((note) => {
      const selected = notes.selectedId === note.id;
      const meta = <span className={cn('mt-0.5 flex gap-2 text-detail', selected ? 'opacity-80' : 'text-muted-foreground')}>
        <span className="shrink-0">{shortDate(note.updated)}</span><span className="min-w-0 truncate">{snippet(note)}</span>
      </span>;
      // A row is a button: while renaming, the name field takes its place.
      if (notes.isRenaming(note.id)) return <div key={note.id} className="px-5">
        <div className={cn('rounded-lg px-2 py-2', selected && 'bg-primary text-primary-foreground')}>
          <div className="flex text-[15.5px] font-semibold"><RenameField notes={notes} id={note.id} name={note.file.name} /></div>{meta}
        </div>
      </div>;
      return <ItemMenu key={note.id} notes={notes} id={note.id} label={note.file.name}>
        <ListRow divider={false} onPress={() => onOpen(note.id)} onDelete={note.file.standalone ? undefined : () => notes.setDeleting(note.id)}
          className="[&>[data-slot=list-row-content]]:bg-transparent [&>[data-slot=list-row-content]]:px-5"
          title={<span className={cn('relative block rounded-lg px-2 py-2', selected && 'bg-primary text-primary-foreground')}>
            <span className="flex items-center gap-2 text-[15.5px] font-semibold"><span className="min-w-0 flex-1 truncate">{note.file.name}</span>{notes.files.unseen.has(note.id) ? <UnreadDot /> : null}</span>
            {meta}
            {notes.query ? <span className="mt-1 block truncate text-caption opacity-70">{note.file.path.split('/').slice(1).join('/')}</span> : null}
          </span>} />
      </ItemMenu>;
    })}
  </div>;
}
