/* The entire master list lives in NavigationStack. Only folder rows change its screens. */
import { useRef, useState } from 'react';
import { Chevron } from '@/components/ui/icon-swap';
import { NavigationStack, type Screen } from '@/components/ui/navigation-stack';
import { Button } from '@/components/ui/button';
import { SearchField } from '@/components/ui/search-field';
import { Segmented } from '@/components/ui/segmented';
import type { MarkdownEditorHandle } from '@/components/ui/markdown-editor';
import { SplitViewContent, SplitViewDetail, SplitViewEmpty, SplitViewHeader, SplitViewSupplementary, SplitViewToggle, useSplitView } from '@/components/ui/split-view';
import { Icon } from '@/lib/icon';
import { ROOT_FOLDER, type Folder } from './data';
import { FolderTree } from './folder-tree';
import { NoteList } from './note-list';
import { NoteEditor } from './note-editor';
import { CreationForm, FolderActions } from './master-actions';
import { BarButton, BottomBar, NoteMenu, ViewToggle } from './parts';
import type { NotesState } from './use-notes';

function FolderRows({ notes, folders }: { notes: NotesState; folders: Folder[] }) {
  return <div className="mx-3">
    {folders.map((f) => <button key={f.id} type="button" aria-label={`Open folder ${f.title}`} data-tkrow=""
      onClick={() => notes.openFolder(f.id)}
      className="flex min-h-12 w-full cursor-pointer items-center gap-2 rounded-md border-0 bg-transparent px-2 text-left text-detail text-foreground outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring">
      <Icon name="folder" size={21} className="shrink-0 text-primary" />
      <span className="min-w-0 flex-1 truncate">{f.title}{f.connected === false ? <span className="block text-caption text-muted-foreground">Reconnect folder</span> : null}</span>
      <span className="text-caption text-muted-foreground">{notes.count(f)}</span><Chevron direction="right" size={15} />
    </button>)}
  </div>;
}

function EmptyFolder({ notes, folder }: { notes: NotesState; folder: Folder }) {
  const s = useSplitView();
  const root = folder.id === ROOT_FOLDER.id;
  return <div className="px-6 pt-16 text-center">
    <Icon name="folder" size={42} className="mx-auto mb-3 text-muted-foreground" />
    <h2 className="m-0 text-title font-semibold">{notes.query ? 'No Results' : root ? 'Your folders, your notes' : 'No Notes'}</h2>
    <p className="text-detail leading-relaxed text-muted-foreground">{notes.query ? 'Try another search.' : root
      ? 'Add a folder from your Mac to browse and edit its Markdown files.' : 'Markdown files in this folder will appear here.'}</p>
    {root && !notes.query ? <Button variant="secondary" isDisabled={!notes.files.canOpenFolder || notes.files.busy}
      onPress={() => { void notes.addFolder().then((id) => { if (id && s.collapsed) s.show('supplementary'); }); }}>Choose Folder…</Button> : null}
  </div>;
}

export function ListColumn({ notes }: { notes: NotesState }) {
  const s = useSplitView();
  const open = (id: string) => { notes.select(id); s.select('supplementary', id); };
  const tree = notes.view === 'tree';
  const visibleTrail = tree ? [ROOT_FOLDER] : notes.trail;
  const screens: Screen[] = visibleTrail.map((folder, i) => {
    const { list, children } = notes.contents(folder);
    const active = i === visibleTrail.length - 1;
    return {
      key: folder.id, title: folder.title, largeTitle: true, hideChromeOnScroll: false,
      bottomInset: s.collapsed ? 50 : 0,
      leading: <SplitViewToggle />,
      trailing: <><ViewToggle view={notes.view} onChange={notes.setView} /><FolderActions notes={notes} onOpen={() => s.show('detail')} /></>,
      content: <>
        <div className="px-4 pb-3"><SearchField value={notes.query} onChange={notes.setQuery} aria-label="Search notes" /></div>
        {active && notes.files.error ? <div role="alert" className="mx-4 mb-3 break-words text-detail text-destructive">{notes.files.error}</div> : null}
        {active && notes.creating ? <CreationForm notes={notes} onCreated={() => s.show('detail')} /> : null}
        {folder.connected === false ? <div className="space-y-3 px-5 py-10 text-detail text-muted-foreground">
          <p>Reconnect {folder.title} to view the notes on your Mac.</p>
          <Button variant="secondary" onPress={() => { void notes.files.run(() => notes.files.reconnect(folder.id)); }}>Reconnect folder</Button>
        </div> : tree ? <FolderTree notes={notes} onOpen={open} /> : <>
          <FolderRows notes={notes} folders={children} />
          <NoteList notes={notes} items={list} onOpen={open} />
          {!list.length && !children.length && !notes.creating ? <EmptyFolder notes={notes} folder={folder} /> : null}
        </>}
      </>,
    };
  });
  return <SplitViewSupplementary aria-label="Notes" width={330} minWidth={280}>
    <div className="relative min-h-0 flex-1"><NavigationStack screens={screens}
      onPop={() => { const previous = notes.trail.at(-2); if (previous) notes.openFolder(previous.id); }} /></div>
    {s.collapsed ? <BottomBar className="justify-end">
      <BarButton label="New note" onPress={() => notes.setCreating('file')}><Icon name="compose" size={24} /></BarButton>
    </BottomBar> : null}
  </SplitViewSupplementary>;
}

export function NoteColumn({ notes }: { notes: NotesState }) {
  const s = useSplitView();
  const n = notes.selected;
  const [mode, setMode] = useState('editor');
  const [format, setFormat] = useState(false);
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  return <SplitViewDetail aria-label="Note">
    <SplitViewHeader title={n ? <span title={`${n.file.path} · ${notes.fileStatus(n).label}`}>{n.file.name}</span> : undefined} titleAlign="leading" trailing={<>
      {n ? <>
        {mode === 'editor' && !s.collapsed ? <Button variant="ghost" aria-label="Formatting" aria-pressed={format} preventFocusOnPress onPress={() => setFormat((v) => !v)}
          className="h-9 w-10 rounded-ctl px-0 text-primary"><Icon name="textformat" /></Button> : null}
        <Segmented aria-label="Note view" value={mode} onChange={(value) => setMode(String(value))} className="w-[134px] shrink-0"
          options={[{ id: 'editor', label: 'Editor' }, { id: 'source', label: 'Source' }]} />
      </> : null}
      {n ? <NoteMenu notes={notes} n={n} /> : null}
      <BarButton label="New note" onPress={() => { notes.setCreating('file'); s.show('supplementary'); }}><Icon name="compose" /></BarButton>
    </>} />
    {n ? <SplitViewContent key={n.id}><NoteEditor notes={notes} n={n} source={mode === 'source'} format={format} editorRef={editorRef} /></SplitViewContent>
      : <SplitViewEmpty icon={<Icon name="note" size={48} sw={1.2} />} title="No Note Selected" />}
  </SplitViewDetail>;
}
