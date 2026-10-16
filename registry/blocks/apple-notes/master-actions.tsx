import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { useSplitView } from '@/components/ui/split-view';
import { Icon } from '@/lib/icon';
import { BarButton } from './parts';
import type { NotesState } from './use-notes';

/** The sidebar's + folder button: add a location, open a file, or make a note or folder in the current one. */
export function FolderActions({ notes, onOpen }: { notes: NotesState; onOpen: () => void }) {
  const s = useSplitView();
  const here = notes.folder.path ? ` in “${notes.folder.title}”` : '';
  const toList = (id?: string | null) => { if (id !== null && s.collapsed) s.show('supplementary'); };
  return <DropdownMenu>
    <BarButton label="Add"><Icon name="folder-badge-plus" /></BarButton>
    <DropdownMenuContent aria-label="Add" placement="bottom end" onAction={(key) => {
      if (key === 'add') void notes.addFolder().then((id) => toList(id ?? null));
      if (key === 'open') void notes.openFiles().then((id) => { if (id) onOpen(); });
      if (key === 'new') notes.startCreating('file');
      if (key === 'folder') notes.startCreating('folder');
      if (key === 'remove') void notes.files.run(() => notes.removeFolder());
    }}>
      <DropdownMenuItem id="add" isDisabled={!notes.files.canOpenFolder || notes.files.busy}>Add Folder…</DropdownMenuItem>
      <DropdownMenuItem id="open" isDisabled={!notes.files.canOpenFile || notes.files.busy}>Open File…</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem id="new" isDisabled={!notes.folder.path && !notes.files.ready}>New Note{here}</DropdownMenuItem>
      <DropdownMenuItem id="folder" isDisabled={!notes.folder.path}>New Folder{here}</DropdownMenuItem>
      {notes.rootFolder?.source === 'local' && notes.rootFolder.path ? <>
        <DropdownMenuSeparator /><DropdownMenuItem id="remove">Remove “{notes.rootFolder.title}” from Notes</DropdownMenuItem>
      </> : null}
    </DropdownMenuContent>
  </DropdownMenu>;
}
