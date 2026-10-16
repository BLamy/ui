/* The master list lives in NavigationStack, rooted at the sidebar's location. Only folder rows change its screens. */
import { useRef, useState } from 'react';
import { Chevron } from '@/components/ui/icon-swap';
import { NavigationStack, type Screen } from '@/components/ui/navigation-stack';
import { Button } from '@/components/ui/button';
import { SearchField } from '@/components/ui/search-field';
import { TreeFileIcon } from '@/components/ui/tree';
import type { MarkdownEditorHandle } from '@/components/ui/markdown-editor';
import { SplitViewContent, SplitViewDetail, SplitViewEmpty, SplitViewHeader, SplitViewSupplementary, SplitViewToggle, useSplitView } from '@/components/ui/split-view';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import type { Folder } from './data';
import { FolderTree } from './folder-tree';
import { NoteList } from './note-list';
import { EditorTools, NoteEditor } from './note-editor';
import { ItemMenu, RenameField } from './item-menu';
import { BarButton, BottomBar, FilterMenu, NoteMenu, ShareMenu, ViewToggle } from './parts';
import type { NotesState, OtherFile } from './use-notes';

function FolderRows({ notes, folders }: { notes: NotesState; folders: Folder[] }) {
  const row = 'flex min-h-12 w-full items-center gap-2 rounded-md px-2 text-left text-detail text-foreground';
  return <div className="mx-3">
    {folders.map((f) => notes.isRenaming(f.id)
      ? <div key={f.id} className={row}><Icon name="folder" size={21} className="shrink-0 text-primary" /><RenameField notes={notes} id={f.id} name={f.title} /></div>
      : <ItemMenu key={f.id} notes={notes} id={f.id} label={f.title}>
        <button type="button" aria-label={`Open folder ${f.title}`} data-tkrow=""
          onClick={() => notes.openFolder(f.id)}
          className={cn(row, 'cursor-pointer border-0 bg-transparent outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring')}>
          <Icon name="folder" size={21} className="shrink-0 text-primary" />
          <span className="min-w-0 flex-1 truncate">{f.title}{f.connected === false ? <span className="block text-caption text-muted-foreground">Reconnect folder</span> : null}</span>
          <span className="text-caption text-muted-foreground">{notes.count(f)}</span><Chevron direction="right" size={15} />
        </button>
      </ItemMenu>)}
  </div>;
}

/** Files Notes doesn't open, under All Files: listed by name, dimmed, not interactive. */
function OtherFileRows({ notes, files }: { notes: NotesState; files: OtherFile[] }) {
  if (!files.length) return null;
  return <ul aria-label="Other files" className="m-0 list-none px-5">
    {files.map((f) => <li key={f.id} title={`${f.path} · Notes opens Markdown files only`}
      className="flex min-h-11 items-center gap-2 rounded-lg px-2 text-subhead text-muted-foreground opacity-60">
      <TreeFileIcon name={f.name} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{f.name}
        {notes.query ? <span className="block truncate text-caption">{f.path.split('/').slice(1, -1).join('/')}</span> : null}</span>
    </li>)}
  </ul>;
}

function EmptyFolder({ notes, folder }: { notes: NotesState; folder: Folder }) {
  const s = useSplitView();
  const none = !notes.rootFolder;
  return <div className="px-6 pt-16 text-center">
    <Icon name="folder" size={42} className="mx-auto mb-3 text-muted-foreground" />
    <h2 className="m-0 text-title font-semibold">{notes.query ? 'No Results' : none ? 'Your folders, your notes' : 'No Notes'}</h2>
    <p className="text-detail leading-relaxed text-muted-foreground">{notes.query ? 'Try another search.' : none
      ? 'Add a folder from your Mac to browse and edit its Markdown files.' : `Markdown files in ${folder.title} will appear here.`}</p>
    {none && !notes.query ? <Button variant="secondary" isDisabled={!notes.files.canOpenFolder || notes.files.busy}
      onPress={() => { void notes.addFolder().then((id) => { if (id && s.collapsed) s.show('supplementary'); }); }}>Choose Folder…</Button> : null}
  </div>;
}

/** The master list is the location chosen in the sidebar: its folders push screens, its notes open in the detail. */
export function ListColumn({ notes }: { notes: NotesState }) {
  const s = useSplitView();
  const open = (id: string) => { notes.select(id); s.select('supplementary', id); };
  const tree = notes.view === 'tree';
  const visibleTrail = notes.rootFolder ? tree ? [notes.rootFolder] : notes.trail : [notes.folder];
  const screens: Screen[] = visibleTrail.map((folder, i) => {
    const { list, children, others } = notes.contents(folder);
    const active = i === visibleTrail.length - 1;
    return {
      key: folder.id, title: notes.rootFolder ? folder.title : 'Notes', largeTitle: true, hideChromeOnScroll: false,
      bottomInset: s.collapsed ? 50 : 0,
      leading: i === 0 ? <SplitViewToggle /> : undefined,
      trailing: <ViewToggle view={notes.view} onChange={notes.setView} />,
      content: <>
        <div className="flex items-center gap-1.5 pr-2.5 pb-3 pl-4">
          <SearchField value={notes.query} onChange={notes.setQuery} aria-label={`Search ${folder.title}`} className="min-w-0 flex-1" />
          <FilterMenu filter={notes.filter} onChange={notes.setFilter} />
        </div>
        {active && notes.files.error ? <div role="alert" className="mx-4 mb-3 break-words text-detail text-destructive">{notes.files.error}</div> : null}
        {folder.connected === false ? <div className="space-y-3 px-5 py-10 text-detail text-muted-foreground">
          <p>Reconnect {folder.title} to view the notes on your Mac.</p>
          <Button variant="secondary" onPress={() => { void notes.files.run(() => notes.files.reconnect(folder.id)); }}>Reconnect folder</Button>
        </div> : tree && notes.rootFolder ? <FolderTree notes={notes} root={notes.rootFolder} onOpen={open} /> : <>
          <FolderRows notes={notes} folders={children} />
          <div className="pb-12"><NoteList notes={notes} items={list} onOpen={open} /><OtherFileRows notes={notes} files={others} /></div>
          {!list.length && !children.length && !others.length ? <EmptyFolder notes={notes} folder={folder} /> : null}
        </>}
      </>,
    };
  });
  return <SplitViewSupplementary aria-label="Notes" width={330} minWidth={280}>
    <div className="relative min-h-0 flex-1"><NavigationStack screens={screens}
      onPop={() => { const previous = notes.trail.at(-2); if (previous) notes.openFolder(previous.id); }} /></div>
    {s.collapsed ? <BottomBar className="justify-end">
      <BarButton label="New note" onPress={() => notes.startCreating('file')}><Icon name="compose" size={24} /></BarButton>
    </BottomBar> : null}
  </SplitViewSupplementary>;
}

export function NoteColumn({ notes }: { notes: NotesState }) {
  const s = useSplitView();
  const n = notes.selected;
  const [source, setSource] = useState(false);
  const [format, setFormat] = useState(false);
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const compose = <BarButton label="New note" onPress={() => notes.startCreating('file')}><Icon name="compose" /></BarButton>;
  const tools = n ? <EditorTools editorRef={editorRef} format={format} onFormat={() => setFormat((v) => !v)} source={source} onSource={() => setSource((v) => !v)} /> : null;
  const name = n ? notes.isRenaming(n.id, 'title')
    ? <RenameField notes={notes} id={n.id} name={n.file.name} className="text-body font-semibold" />
    : <span title={`${n.file.path} · ${notes.fileStatus(n).label} · Double-click to rename`}
      onDoubleClick={() => { if (!n.file.standalone) notes.setRenaming({ id: n.id, in: 'title' }); }}>{n.file.name}</span> : undefined;
  return <SplitViewDetail aria-label="Note">
    <SplitViewHeader title={name} titleAlign="leading" trailing={n ? <>
      {s.collapsed ? null : tools}
      <ShareMenu n={n} />
      <NoteMenu notes={notes} n={n} />
      {s.collapsed ? null : compose}
    </> : compose} />
    {n ? <SplitViewContent key={n.id}><NoteEditor notes={notes} n={n} source={source} format={format} editorRef={editorRef} /></SplitViewContent>
      : <SplitViewEmpty icon={<Icon name="note" size={48} sw={1.2} />} title="No Note Selected" />}
    {s.collapsed && n ? <BottomBar className="justify-between px-3">{tools}{compose}</BottomBar> : null}
  </SplitViewDetail>;
}
