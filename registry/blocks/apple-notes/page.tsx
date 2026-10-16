/* Notes for real Markdown/MDX files. The sidebar holds added Mac folders; the master list
   navigates folders in a stack or tree, and leaf selection opens the note in the detail column. */
import { type CSSProperties } from 'react';
import { SplitView } from '@/components/ui/split-view';
import { AppearanceProvider, BLProvider, useAppearance, type Appearance } from '@/lib/theme';
import { ListColumn, NoteColumn } from './columns';
import { FoldersSidebar } from './folders';
import { useNotes, type NotesView } from './use-notes';

export interface AppleNotesProps {
  /** Light or dark. Defaults to the ambient AppearanceProvider, else light. */
  appearance?: Appearance;
  /** Folder to open on. Defaults to the root list of added folders. */
  initialFolder?: string;
  /** A file id to select at mount. No note is selected by default. */
  initialNote?: string | null;
  initialView?: NotesView;
}

/** Notes' yellow accent (light / dark) … */
const NOTES_TINT = { light: '#E0A500', dark: '#FFD60A' } as const;
/** … with dark text on it (selected rows, the checked-circle fill): the app's palette overrides the theme's
    primary-foreground on the block's root. */
const NOTES_ON_TINT = { '--primary-foreground': '#1C1C1E' } as CSSProperties;

export default function AppleNotes({ appearance, initialFolder = 'folders', initialNote = null, initialView = 'list' }: AppleNotesProps) {
  const ambient = useAppearance();
  const dark = (appearance ?? ambient) === 'dark';
  const notes = useNotes({ folder: initialFolder, note: initialNote, view: initialView });

  return (
    <AppearanceProvider value={dark ? 'dark' : 'light'}>
      <BLProvider tint={NOTES_TINT[dark ? 'dark' : 'light']} className="bg-background" style={NOTES_ON_TINT}>
        <SplitView aria-label="Notes"
          selection={{ sidebar: notes.sidebarId, supplementary: notes.selectedId }}>
          <FoldersSidebar notes={notes} />
          <ListColumn notes={notes} />
          <NoteColumn notes={notes} />
        </SplitView>
      </BLProvider>
    </AppearanceProvider>
  );
}
