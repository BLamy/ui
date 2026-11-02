/* Hover cards for what the master list and the tree point at, the way Finder previews a file: a note's opening
   lines, word count, folder and last edit; a folder's notes, subfolders and latest notes; another file's type and
   path. They only show what opening the item shows in full, so touch (which never opens them) misses nothing. */
import { parseMarkdown, plainText } from '@brett_lamy/docstream/gitbook';
import { HoverCardHeader } from '@/components/ui/hover-card';
import { TreeFileIcon } from '@/components/ui/tree';
import { Icon, type IconName } from '@/lib/icon';
import type { Folder, Note } from './data';
import { viewerLabel } from './file-views';
import { viewable, type NotesState, type OtherFile } from './use-notes';

/** The note's text, without its Markdown: the first few paragraphs and headings. */
function excerpt(body: string) {
  return parseMarkdown(body).children
    .flatMap((b) => (b.type === 'paragraph' || b.type === 'heading' ? [plainText(b.children)] : []))
    .slice(0, 4).join(' ').slice(0, 320);
}

const edited = (d: Date) => d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
/** "notes/Work/Plans" — the path without the location's own root, as the rows show it. */
const where = (path: string) => path.split('/').slice(1, -1).join('/') || path.split('/')[0];

function Tile({ icon }: { icon: IconName }) {
  return <span className="grid size-10 place-items-center rounded-lg bg-secondary text-primary"><Icon name={icon} size={22} /></span>;
}

export function NotePreview({ notes, note }: { notes: NotesState; note: Note }) {
  const text = excerpt(notes.drafts[note.id]?.body ?? note.body);
  const words = note.body.split(/\s+/).filter(Boolean).length;
  return <>
    <HoverCardHeader media={<Tile icon="note" />} title={note.file.name} subtitle={note.file.standalone ? 'Opened file' : where(note.file.path)} />
    <p className="m-0 mt-3 line-clamp-5 text-footnote leading-snug text-foreground">{text || <span className="text-muted-foreground">Empty note</span>}</p>
    <div className="mt-2.5 text-caption text-muted-foreground">
      Edited {edited(note.updated)} · {words} {words === 1 ? 'word' : 'words'}
      {notes.files.unseen.has(note.id) ? <span className="block text-primary">Changed outside Notes</span> : null}
    </div>
  </>;
}

export function FolderPreview({ notes, folder }: { notes: NotesState; folder: Folder }) {
  const subfolders = notes.folders.filter((f) => f.parent === folder.id).length;
  const recent = notes.notes.filter((n) => n.folder === folder.id).sort((a, b) => b.updated.getTime() - a.updated.getTime()).slice(0, 3);
  const count = notes.count(folder);
  return <>
    <HoverCardHeader media={<Tile icon="folder" />} title={folder.title}
      subtitle={[`${count} ${count === 1 ? 'note' : 'notes'}`, subfolders ? `${subfolders} ${subfolders === 1 ? 'folder' : 'folders'}` : ''].filter(Boolean).join(' · ')} />
    {recent.length ? <ul className="m-0 mt-3 list-none! p-0">
      {recent.map((n) => <li key={n.id} className="flex items-baseline gap-2 py-0.5 text-footnote">
        <span className="min-w-0 flex-1 truncate text-foreground">{n.file.name}</span>
        <span className="shrink-0 text-muted-foreground">{n.updated.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
      </li>)}
    </ul> : null}
    {folder.path ? <div className="mt-2.5 truncate text-caption text-muted-foreground">{folder.path}</div> : null}
  </>;
}

export function FilePreview({ file }: { file: OtherFile }) {
  return <>
    <HoverCardHeader media={<span className="grid size-10 place-items-center rounded-lg bg-secondary"><TreeFileIcon name={file.name} /></span>}
      title={file.name} subtitle={viewable(file.kind) ? viewerLabel(file) : 'Drag onto a note to embed it'} />
    <div className="mt-2.5 truncate text-caption text-muted-foreground">{file.path}</div>
  </>;
}
