/* iPhone: a NavigationStack — Folders → a folder's notes (list or gallery) → the note — with large titles and
   bottom toolbars. Opens on the notes list with Folders one step back, as Notes does. */
import { useRef, useState } from 'react';
import { NavigationStack, NumberMorph, type MarkdownEditorHandle, type Screen } from '@brett_lamy/ui';
import { ListTop } from './columns';
import { FoldersList } from './folders';
import { G } from './glyphs';
import { EditorTools, NoteEditor } from './note-editor';
import { NoteGallery, NoteList } from './note-list';
import { BarButton, BottomBar, NoteMenu, ShareMenu, ViewToggle } from './parts';
import type { NotesState } from './use-notes';

export function PhoneNotes({ notes, initialDepth = 1 }: { notes: NotesState; initialDepth?: number }) {
  const [depth, setDepth] = useState(initialDepth);
  const [format, setFormat] = useState(false);
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const n = notes.selected;
  const open = (id: string) => { notes.select(id); setDepth(2); };
  const create = () => { notes.create(); setDepth(2); };

  const screens: Screen[] = [{
    key: 'folders', title: 'Folders', largeTitle: true, grouped: true,
    content: <FoldersList notes={notes} onOpen={() => setDepth(1)} />,
    overlay: (
      <BottomBar className="justify-between px-3">
        <BarButton label="New folder"><G name="folderPlus" size={24} /></BarButton>
        <BarButton label="New note" onPress={create}><G name="compose" size={24} /></BarButton>
      </BottomBar>
    ),
    bottomInset: 50,
  }];
  if (depth >= 1) screens.push({
    key: `folder-${notes.tag ?? notes.folderId}`, title: notes.tag ? `#${notes.tag}` : notes.folder.title, largeTitle: true, grouped: notes.view === 'list',
    trailing: <ViewToggle view={notes.view} onChange={notes.setView} />,
    subheader: <div className="-mx-4"><ListTop notes={notes} large={false} /></div>,
    content: notes.view === 'list'
      ? <NoteList notes={notes} selectable={false} inset onOpen={open} />
      : <NoteGallery notes={notes} selectable={false} onOpen={open} />,
    overlay: (
      <BottomBar>
        <span className="w-10" />
        <span className="flex-1 text-center text-[12px] text-foreground"><NumberMorph value={notes.list.length} /> {notes.list.length === 1 ? 'Note' : 'Notes'}</span>
        <BarButton label="New note" onPress={create}><G name="compose" size={24} /></BarButton>
      </BottomBar>
    ),
    bottomInset: 50,
    hideChromeOnScroll: false,
  });
  if (depth >= 2 && n) screens.push({
    key: `note-${n.id}`, title: '',
    trailing: <><ShareMenu n={n} /><NoteMenu notes={notes} n={n} onDeleted={() => setDepth(1)} /></>,
    content: <NoteEditor notes={notes} n={n} editorRef={editorRef} format={format} />,
    overlay: (
      <BottomBar className="justify-between px-3">
        <EditorTools editorRef={editorRef} format={format} onFormat={() => setFormat((f) => !f)} disabled={notes.isLocked(n)} />
        <BarButton label="New note" onPress={create}><G name="compose" size={24} /></BarButton>
      </BottomBar>
    ),
    bottomInset: 50,
    hideChromeOnScroll: false,
  });
  return <NavigationStack screens={screens} onPop={() => setDepth((d) => Math.max(0, d - 1))} />;
}
