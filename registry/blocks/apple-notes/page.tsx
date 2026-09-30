/* Apple Notes clone — folders, notes grouped by date (or a gallery of thumbnails), and a Markdown note
   editor with checklists and tables; pin, lock, share, search, swipe actions and new notes.
   One SplitView at every size: three tiled columns at regular width (≥1024), list · note with the folders
   floating over them on an iPad, and a stack with large titles and back buttons on an iPhone. */
import { useState, type CSSProperties } from 'react';
import { SplitView } from '@/components/ui/split-view';
import { AppearanceProvider, BLProvider, useAppearance, type Appearance } from '@/lib/theme';
import { ListColumn, NoteColumn } from './columns';
import { FoldersSidebar } from './folders';
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

/** Notes' yellow accent (light / dark) … */
const NOTES_TINT = { light: '#E0A500', dark: '#FFD60A' } as const;
/** … with dark text on it (selected rows, the checked-circle fill): the app's palette overrides the theme's
    primary-foreground on the block's root. */
const NOTES_ON_TINT = { '--primary-foreground': '#1C1C1E' } as CSSProperties;

export default function AppleNotes({ appearance, initialFolder = 'all', initialNote = 'n1', initialView = 'list' }: AppleNotesProps) {
  const ambient = useAppearance();
  const dark = (appearance ?? ambient) === 'dark';
  const [compact, setCompact] = useState(false);
  const notes = useNotes({ folder: initialFolder, note: initialNote, view: initialView });

  return (
    <AppearanceProvider value={dark ? 'dark' : 'light'}>
      <BLProvider tint={NOTES_TINT[dark ? 'dark' : 'light']} className="bg-background" style={NOTES_ON_TINT}>
        {/* Gallery view hides the list column (the phone keeps it: the gallery takes its place in the stack). */}
        <SplitView aria-label="Notes" onWidthClassChange={(wc) => setCompact(wc === 'compact')}
          supplementaryVisible={notes.view === 'list' || compact}
          selection={{ sidebar: notes.tag ? null : notes.folderId, supplementary: notes.selectedId }}>
          <FoldersSidebar notes={notes} />
          <ListColumn notes={notes} />
          <NoteColumn notes={notes} />
        </SplitView>
      </BLProvider>
    </AppearanceProvider>
  );
}
