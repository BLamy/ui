/* The split layout's list and note columns (the folders column lives in folders.tsx). In gallery view the
   list column leaves and the gallery fills the detail; opening a card shows the note there with a way back. */
import { useRef, useState } from 'react';
import {
  Chevron, NumberMorph, SearchField, SplitViewContent, SplitViewDetail, SplitViewEmpty, SplitViewHeader, SplitViewSupplementary,
  SplitViewToggle, type MarkdownEditorHandle,
} from '@brett_lamy/ui';
import { G } from './glyphs';
import { NoteGallery, NoteList } from './note-list';
import { EditorTools, NoteEditor } from './note-editor';
import { BarButton, LockButton, NoteMenu, ShareMenu, ViewToggle } from './parts';
import type { NotesState } from './use-notes';

/** Folder title, note count and search — the top of the list and of the gallery. */
export function ListTop({ notes, large = true }: { notes: NotesState; large?: boolean }) {
  return (
    <div className="px-4 pb-2">
      {large ? (
        <>
          <h1 className="m-0 truncate text-[30px] leading-[1.15] font-bold tracking-[-.5px]">{notes.tag ? `#${notes.tag}` : notes.folder.title}</h1>
          <div className="mb-2.5 text-[14px] text-muted-foreground"><NumberMorph value={notes.list.length} /> {notes.list.length === 1 ? 'note' : 'notes'}</div>
        </>
      ) : null}
      <SearchField value={notes.query} onChange={notes.setQuery} aria-label="Search notes" />
    </div>
  );
}

export function ListColumn({ notes }: { notes: NotesState }) {
  return (
    <SplitViewSupplementary aria-label="Notes" width={330} minWidth={280}>
      <SplitViewHeader leading={<SplitViewToggle />} trailing={<ViewToggle view={notes.view} onChange={notes.setView} />} className="shadow-none" />
      <SplitViewContent>
        <ListTop notes={notes} />
        <NoteList notes={notes} selectable onOpen={notes.select} />
      </SplitViewContent>
    </SplitViewSupplementary>
  );
}

export function NoteColumn({ notes }: { notes: NotesState }) {
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const [format, setFormat] = useState(false);
  // Gallery view: the gallery, until a card is opened.
  const [open, setOpen] = useState(false);
  const gallery = notes.view === 'gallery';
  const n = gallery && !open ? null : notes.selected;
  return (
    <SplitViewDetail aria-label={n ? 'Note' : gallery ? 'Gallery' : 'Note'}>
      <SplitViewHeader
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
          <EditorTools editorRef={editorRef} format={format} onFormat={() => setFormat((f) => !f)} disabled={notes.isLocked(n)} />
          <LockButton notes={notes} n={n} />
          <ShareMenu n={n} />
          <NoteMenu notes={notes} n={n} />
          <BarButton label="New note" onPress={() => { notes.create(); setOpen(true); }}><G name="compose" /></BarButton>
        </> : <>
          {gallery ? <ViewToggle view={notes.view} onChange={(v) => { notes.setView(v); setOpen(false); }} /> : null}
          <BarButton label="New note" onPress={() => { notes.create(); setOpen(true); }}><G name="compose" /></BarButton>
        </>} />
      {n ? (
        <SplitViewContent key={n.id}>
          <NoteEditor notes={notes} n={n} editorRef={editorRef} format={format} />
        </SplitViewContent>
      ) : gallery ? (
        <SplitViewContent>
          <ListTop notes={notes} />
          <NoteGallery notes={notes} selectable onOpen={(id) => { notes.select(id); setOpen(true); }} />
        </SplitViewContent>
      ) : <SplitViewEmpty icon={<G name="note" size={48} sw={1.2} />} title="No Note Selected" />}
    </SplitViewDetail>
  );
}
