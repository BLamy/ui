import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useSplitView } from '@/components/ui/split-view';
import { Icon } from '@/lib/icon';
import { BarButton } from './parts';
import type { NotesState } from './use-notes';

/** The sidebar's + folder button: add a location, open a file, or make a note or folder in the current one. */
export function FolderActions({ notes, onOpen }: { notes: NotesState; onOpen: () => void }) {
  const s = useSplitView();
  const here = notes.folder.path ? ` in “${notes.folder.title}”` : '';
  const toList = (id?: string | null) => { if (id !== null && s.collapsed) s.show('supplementary'); };
  return <DropdownMenu onAction={(value) => {
    if (value === 'add') void notes.addFolder().then((id) => toList(id ?? null));
    if (value === 'open') void notes.openFiles().then((id) => { if (id) onOpen(); });
    if (value === 'new') notes.startCreating('file');
    if (value === 'folder') notes.startCreating('folder');
    if (value === 'remove') void notes.files.run(() => notes.removeFolder());
  }}>
    <DropdownMenuTrigger render={<BarButton label="Add" />}><Icon name="folder-badge-plus" /></DropdownMenuTrigger>
    <DropdownMenuContent side="bottom" align="end">
      <DropdownMenuItem value="add" disabled={!notes.files.canOpenFolder || notes.files.busy}>Add Folder…</DropdownMenuItem>
      <DropdownMenuItem value="open" disabled={!notes.files.canOpenFile || notes.files.busy}>Open File…</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem value="new" disabled={!notes.folder.path && !notes.files.ready}>New Note{here}</DropdownMenuItem>
      <DropdownMenuItem value="folder" disabled={!notes.folder.path}>New Folder{here}</DropdownMenuItem>
      {notes.rootFolder?.source === 'local' && notes.rootFolder.path ? <>
        <DropdownMenuSeparator /><DropdownMenuItem value="remove">Remove “{notes.rootFolder.title}” from Notes</DropdownMenuItem>
      </> : null}
    </DropdownMenuContent>
  </DropdownMenu>;
}
