/* The master list lives in NavigationStack, rooted at the sidebar's location. Only folder rows change its screens. */
import { useRef, useState, type ReactNode } from 'react';
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
import { fileDragProps, hasComputerFiles, useDropTarget } from './drag';
import { FolderTree } from './folder-tree';
import { FileView, viewerLabel } from './file-views';
import { NoteList } from './note-list';
import { EditorTools, NoteEditor } from './note-editor';
import { ItemMenu, RenameField } from './item-menu';
import { BarButton, BottomBar, FilterMenu, NoteMenu, ShareMenu, ViewToggle } from './parts';
import { viewable, type NotesState, type OtherFile } from './use-notes';

/** Files from your computer dropped on a folder (a row, or the list itself) are copied into it. Nothing is embedded. */
function useUploadTarget(notes: NotesState, folder: Folder) {
  return useDropTarget({
    accepts: (data) => !!folder.path && folder.connected !== false && hasComputerFiles(data),
    onDrop: (data) => { const list = [...data.files]; void notes.files.run(() => notes.upload(folder.path!, list)); },
  });
}

function FolderRow({ notes, f, className }: { notes: NotesState; f: Folder; className: string }) {
  const { dropProps } = useUploadTarget(notes, f);
  return <ItemMenu notes={notes} id={f.id} label={f.title}>
    <button type="button" aria-label={`Open folder ${f.title}`} data-tkrow="" {...dropProps}
      onClick={() => notes.openFolder(f.id)}
      className={cn(className, 'cursor-pointer border-0 bg-transparent outline-none hover:bg-secondary focus-visible:ring-2 focus-visible:ring-ring data-[drop-target]:bg-secondary data-[drop-target]:ring-2 data-[drop-target]:ring-primary')}>
      <Icon name="folder" size={21} className="shrink-0 text-primary" />
      <span className="min-w-0 flex-1 truncate">{f.title}{f.connected === false ? <span className="block text-caption text-muted-foreground">Reconnect folder</span> : null}</span>
      <span className="text-caption text-muted-foreground">{notes.count(f)}</span><Chevron direction="right" size={15} />
    </button>
  </ItemMenu>;
}

function FolderRows({ notes, folders }: { notes: NotesState; folders: Folder[] }) {
  const row = 'flex min-h-12 w-full items-center gap-2 rounded-md px-2 text-left text-detail text-foreground';
  return <div className="mx-3">
    {folders.map((f) => notes.isRenaming(f.id)
      ? <div key={f.id} className={row}><Icon name="folder" size={21} className="shrink-0 text-primary" /><RenameField notes={notes} id={f.id} name={f.title} /></div>
      : <FolderRow key={f.id} notes={notes} f={f} className={row} />)}
  </div>;
}

/** Files that aren't notes. A model, image or JSON/YAML file opens in its viewer; anything else is listed by name, dimmed. Every row
    drags onto a note to embed it, or onto another location to move or copy it. */
function OtherFileRows({ notes, files, onOpen }: { notes: NotesState; files: OtherFile[]; onOpen: (id: string) => void }) {
  if (!files.length) return null;
  return <ul aria-label="Other files" className="m-0 list-none! px-5">
    {files.map((f) => {
      const where = notes.query ? <span className="block truncate text-caption opacity-70">{f.path.split('/').slice(1, -1).join('/')}</span> : null;
      if (viewable(f.kind)) {
        const selected = notes.selectedId === f.id;
        return <li key={f.id}>
          <button type="button" {...fileDragProps(f.path)} onClick={() => onOpen(f.id)} aria-current={selected || undefined} title={f.path}
            className={cn('flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg border-0 bg-transparent px-2 text-left text-subhead text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring',
              selected ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary')}>
            {f.kind === 'stl' || f.kind === 'image' ? <Icon name={f.kind === 'stl' ? 'cube' : 'photo'} size={18} className={cn('shrink-0', !selected && 'text-primary')} />
              : <TreeFileIcon name={f.name} className="shrink-0" />}
            <span className="min-w-0 flex-1 truncate">{f.name}{where}</span>
          </button>
        </li>;
      }
      return <li key={f.id} {...fileDragProps(f.path)} title={`${f.path} · Drag onto a note to embed it`}
        className="flex min-h-11 cursor-grab items-center gap-2 rounded-lg px-2 text-subhead text-muted-foreground opacity-60">
        <TreeFileIcon name={f.name} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">{f.name}{where}</span>
      </li>;
    })}
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
          <UploadArea notes={notes} folder={folder}>
            <FolderRows notes={notes} folders={children} />
            <div className="pb-12"><NoteList notes={notes} items={list} onOpen={open} /><OtherFileRows notes={notes} files={others} onOpen={open} /></div>
            {!list.length && !children.length && !others.length ? <EmptyFolder notes={notes} folder={folder} /> : null}
          </UploadArea>
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

/** The list's own area takes files from your computer into the folder it shows. */
function UploadArea({ notes, folder, children }: { notes: NotesState; folder: Folder; children: ReactNode }) {
  const { dropProps } = useUploadTarget(notes, folder);
  return <div {...dropProps} className="min-h-[60vh] rounded-xl data-[drop-target]:bg-secondary/60 data-[drop-target]:ring-2 data-[drop-target]:ring-primary data-[drop-target]:ring-inset">{children}</div>;
}

export function NoteColumn({ notes }: { notes: NotesState }) {
  const s = useSplitView();
  const n = notes.selected;
  const model = notes.selectedFile;
  const [source, setSource] = useState(false);
  const [format, setFormat] = useState(false);
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const compose = <BarButton label="New note" onPress={() => notes.startCreating('file')}><Icon name="compose" /></BarButton>;
  const tools = n ? <EditorTools editorRef={editorRef} format={format} onFormat={() => setFormat((v) => !v)} source={source} onSource={() => setSource((v) => !v)} /> : null;
  const name = n ? notes.isRenaming(n.id, 'title')
    ? <RenameField notes={notes} id={n.id} name={n.file.name} className="text-body font-semibold" />
    : <span title={`${n.file.path} · ${notes.fileStatus(n).label} · Double-click to rename`}
      onDoubleClick={() => { if (!n.file.standalone) notes.setRenaming({ id: n.id, in: 'title' }); }}>{n.file.name}</span> : undefined;
  if (!n && model) return <SplitViewDetail aria-label={viewerLabel(model)}>
    <SplitViewHeader title={<span title={model.path}>{model.name}</span>} titleAlign="leading" trailing={compose} />
    <SplitViewContent key={model.id}><FileView notes={notes} file={model} /></SplitViewContent>
  </SplitViewDetail>;
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
