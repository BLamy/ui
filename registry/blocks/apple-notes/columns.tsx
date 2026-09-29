/* The list and note columns (the folders column lives in folders.tsx). The same columns serve every width. In
   gallery view the list column steps aside (SplitView `supplementaryVisible`) and the gallery fills the detail;
   opening a card shows the note there with a way back. On the phone SplitView stacks the columns — the gallery
   takes the list's place — and the toolbars move to bottom bars. */
import { useRef, useState } from 'react';
import {
  Chevron, Icon, NumberMorph, SearchField, SplitViewContent, SplitViewDetail, SplitViewEmpty, SplitViewHeader,
  SplitViewSupplementary, SplitViewToggle, cn, useSplitView, type MarkdownEditorHandle,
} from '@brett_lamy/ui';
import { NoteGallery, NoteList } from './note-list';
import { EditorTools, NoteEditor } from './note-editor';
import { BarButton, BottomBar, LockButton, NoteMenu, ShareMenu, ViewToggle } from './parts';
import type { NotesState } from './use-notes';

const count = (n: number) => <><NumberMorph value={n} /> {n === 1 ? 'note' : 'notes'}</>;

/** Note count (wide layouts; the phone shows it in the bottom bar) and search, under the large title. */
function ListTop({ notes }: { notes: NotesState }) {
  const s = useSplitView();
  return (
    <div className="px-4 pb-2">
      {s.collapsed ? null : <div className="-mt-2 mb-2.5 text-[14px] text-muted-foreground">{count(notes.list.length)}</div>}
      <SearchField value={notes.query} onChange={notes.setQuery} aria-label="Search notes" />
    </div>
  );
}

const listTitle = (notes: NotesState) => (notes.tag ? `#${notes.tag}` : notes.folder.title);

export function ListColumn({ notes }: { notes: NotesState }) {
  const s = useSplitView();
  const open = (id: string) => { notes.select(id); s.select('supplementary', id); };
  const create = () => { notes.create(); s.show('detail'); };
  // The phone keeps this column in gallery view and shows the gallery in it; the list reads as inset cards.
  const gallery = notes.view === 'gallery';
  const grouped = s.collapsed && !gallery;
  return (
    <SplitViewSupplementary aria-label="Notes" width={330} minWidth={280} className={cn(grouped && 'bg-muted')}>
      <SplitViewHeader largeTitle title={listTitle(notes)} leading={<SplitViewToggle />}
        trailing={<ViewToggle view={notes.view} onChange={notes.setView} />} />
      <SplitViewContent>
        <ListTop notes={notes} />
        {s.collapsed && gallery ? <NoteGallery notes={notes} onOpen={open} /> : <NoteList notes={notes} inset={grouped} onOpen={open} />}
      </SplitViewContent>
      {s.collapsed ? (
        <BottomBar>
          <span className="w-10" />
          <span className="flex-1 text-center text-[12px] text-foreground capitalize">{count(notes.list.length)}</span>
          <BarButton label="New note" onPress={create}><Icon name="compose" size={24} /></BarButton>
        </BottomBar>
      ) : null}
    </SplitViewSupplementary>
  );
}

export function NoteColumn({ notes }: { notes: NotesState }) {
  const s = useSplitView();
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const [format, setFormat] = useState(false);
  // Gallery view (wide): the gallery, until a card is opened.
  const [open, setOpen] = useState(false);
  const gallery = notes.view === 'gallery' && !s.collapsed;
  const n = gallery && !open ? null : notes.selected;
  const create = () => { notes.create(); setOpen(true); s.show('detail'); };
  const compose = <BarButton label="New note" onPress={create}><Icon name="compose" /></BarButton>;
  const tools = n ? <EditorTools editorRef={editorRef} format={format} onFormat={() => setFormat((f) => !f)} disabled={notes.isLocked(n)} /> : null;
  return (
    <SplitViewDetail aria-label={n ? 'Note' : gallery ? 'Gallery' : 'Note'}>
      <SplitViewHeader largeTitle={gallery && !n} title={gallery && !n ? listTitle(notes) : undefined}
        leading={<>
          {/* In list view the list column carries the sidebar button. */}
          {gallery ? <SplitViewToggle /> : null}
          {gallery && n ? (
            <BarButton label="Back to gallery" onPress={() => setOpen(false)} className="w-auto gap-0.5 pr-2 pl-1">
              <Chevron direction="left" size={20} /><span className="text-[17px] font-normal">Gallery</span>
            </BarButton>
          ) : null}
        </>}
        trailing={n ? <>
          {s.collapsed ? null : <>{tools}<LockButton notes={notes} n={n} /></>}
          <ShareMenu n={n} />
          <NoteMenu notes={notes} n={n} onDeleted={() => { if (s.collapsed) s.back(); }} />
          {s.collapsed ? null : compose}
        </> : <>
          {gallery ? <ViewToggle view={notes.view} onChange={(v) => { notes.setView(v); setOpen(false); }} /> : null}
          {compose}
        </>} />
      {n ? (
        <SplitViewContent key={n.id}>
          <NoteEditor notes={notes} n={n} editorRef={editorRef} format={format} />
        </SplitViewContent>
      ) : gallery ? (
        <SplitViewContent>
          <ListTop notes={notes} />
          <NoteGallery notes={notes} selected={notes.selectedId} onOpen={(id) => { notes.select(id); setOpen(true); }} />
        </SplitViewContent>
      ) : <SplitViewEmpty icon={<Icon name="note" size={48} sw={1.2} />} title="No Note Selected" />}
      {s.collapsed && n ? <BottomBar className="justify-between px-3">{tools}<BarButton label="New note" onPress={create}><Icon name="compose" size={24} /></BarButton></BottomBar> : null}
    </SplitViewDetail>
  );
}
