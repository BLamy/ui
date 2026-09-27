/* Apple Notes clone — folders, notes grouped by date (or a gallery of thumbnails), and a Markdown note
   editor with checklists and tables; pin, lock, share, search, swipe actions and new notes.
   Regular width (≥1024): three tiled columns. Medium (iPad): list · note, the folders float over them.
   Compact (iPhone): a NavigationStack with large titles. */
import type { CSSProperties } from 'react';
import {
  AppearanceProvider, BLProvider, SplitView, useAppearance, useContainerWidth, type Appearance, type SplitViewWidthClass,
} from '@brett_lamy/ui';
import { ListColumn, NoteColumn } from './columns';
import { FoldersSidebar } from './folders';
import { PhoneNotes } from './phone';
import { useNotes, type NotesView } from './use-notes';

export interface AppleNotesProps {
  /** Light or dark. Defaults to the ambient AppearanceProvider, else light. */
  appearance?: Appearance;
  /** Folder to open on (e.g. 'all', 'notes', 'recipes', 'deleted'). */
  initialFolder?: string;
  /** Note selected at mount, e.g. 'n1'. */
  initialNote?: string | null;
  initialView?: NotesView;
}

export default function AppleNotes({ appearance, initialFolder = 'all', initialNote = 'n1', initialView = 'list' }: AppleNotesProps) {
  const ambient = useAppearance();
  const dark = (appearance ?? ambient) === 'dark';
  const [ref, width] = useContainerWidth<HTMLDivElement>(1280);
  const widthClass: SplitViewWidthClass = width >= 1024 ? 'regular' : width >= 640 ? 'medium' : 'compact';
  const notes = useNotes({ folder: initialFolder, note: initialNote, view: initialView });

  return (
    <AppearanceProvider value={dark ? 'dark' : 'light'}>
      {/* Notes' yellow, with dark text on it (selected rows, the checked-circle fill). */}
      <BLProvider tint={dark ? '#FFD60A' : '#E0A500'} className="bg-background" style={{ '--bl-on-tint': '#1C1C1E' } as CSSProperties}>
        <div ref={ref} className="relative h-full w-full">
          {widthClass === 'compact' ? <PhoneNotes notes={notes} /> : (
            <SplitView aria-label="Notes" widthClass={widthClass}
              selection={{ sidebar: notes.tag ? null : notes.folderId, supplementary: notes.selectedId }}>
              <FoldersSidebar notes={notes} />
              {notes.view === 'list' ? <ListColumn notes={notes} /> : null}
              <NoteColumn notes={notes} />
            </SplitView>
          )}
        </div>
      </BLProvider>
    </AppearanceProvider>
  );
}
