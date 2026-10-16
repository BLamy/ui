import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Icon } from '@/lib/icon';
import { BarButton } from './parts';
import type { NotesState } from './use-notes';

export function FolderActions({ notes, onOpen }: { notes: NotesState; onOpen: () => void }) {
  return <DropdownMenu>
    <BarButton label="Folder actions"><Icon name="ellipsis-circle" size={20} /></BarButton>
    <DropdownMenuContent aria-label="Folder actions" placement="bottom end" onAction={(key) => {
      if (key === 'add') void notes.addFolder();
      if (key === 'open') void notes.openFiles().then((id) => { if (id) onOpen(); });
      if (key === 'new') notes.setCreating('file');
      if (key === 'folder') notes.setCreating('folder');
      if (key === 'remove') void notes.files.run(() => notes.removeFolder());
    }}>
      <DropdownMenuItem id="add" isDisabled={!notes.files.canOpenFolder || notes.files.busy}>Add Folder…</DropdownMenuItem>
      <DropdownMenuItem id="open" isDisabled={!notes.files.canOpenFile || notes.files.busy}>Open File…</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem id="new" isDisabled={!notes.folder.path && !notes.files.ready}>New Note…</DropdownMenuItem>
      <DropdownMenuItem id="folder" isDisabled={!notes.folder.path}>New Folder…</DropdownMenuItem>
      {notes.rootFolder?.source === 'local' && notes.rootFolder.path ? <>
        <DropdownMenuSeparator /><DropdownMenuItem id="remove">Remove Folder from Notes</DropdownMenuItem>
      </> : null}
    </DropdownMenuContent>
  </DropdownMenu>;
}

export function CreationForm({ notes, onCreated }: { notes: NotesState; onCreated: () => void }) {
  const folder = notes.creating === 'folder';
  const [name, setName] = useState(folder ? '' : 'Untitled.md');
  return <form className="mx-4 mb-4 space-y-2 rounded-lg border border-border p-3" onSubmit={(e) => {
    e.preventDefault();
    void notes.files.run(async () => {
      if (folder) await notes.createFolder(name);
      else { await notes.create(name); onCreated(); }
    });
  }}>
    <div className="text-detail font-semibold">{folder ? 'New Folder' : 'New Note'} <span className="font-normal text-muted-foreground">in {notes.folder.path ? notes.folder.title : 'Notes'}</span></div>
    <input autoFocus aria-label={folder ? 'Folder name' : 'File name'} value={name} onChange={(e) => setName(e.target.value)}
      className="min-w-0 w-full rounded-md border border-input bg-background px-2.5 py-2 text-detail text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
    <div className="flex gap-1"><Button type="submit" size="sm" isDisabled={notes.files.busy}>{folder ? 'Create folder' : 'Create note'}</Button>
      <Button variant="ghost" size="sm" onPress={() => notes.setCreating(null)}>Cancel</Button></div>
  </form>;
}
