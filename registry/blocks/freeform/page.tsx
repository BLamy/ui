/* Freeform — an infinite whiteboard, after Apple's: boards in a gallery; each board is a pannable, zoomable canvas of
   sticky notes, shapes, text, photos, links, connectors that follow what they're glued to, and freehand drawing on the
   PencilKit core. Select, move, resize, rotate, group, lock, align, arrange; undo and redo per board.
   Keys: V select · H hand (or hold Space) · P draw · C connector · ⌘Z undo · ⌘D duplicate · ⌘G group · ⌘A all ·
   ⌘C/X/V · arrows nudge · ⌘ +/−/0/1 zoom · scroll to pan, ⌘-scroll or pinch to zoom · Option-drag copies.
   All boards are invented sample data. */
import { BLProvider, useAppearance } from '@/lib/theme';
import { useContainerWidth } from '@/lib/container';
import { BoardGallery } from './boards';
import { SAMPLE_BOARDS } from './data';
import { BoardEditor } from './editor';
import type { Board } from './model';
import { FreeformProvider, useFreeform } from './store';

/** Freeform's accent: iOS system blue. */
const FREEFORM_TINT = { light: '#007AFF', dark: '#0A84FF' } as const;

export interface FreeformProps {
  /** The boards to start with. */
  defaultBoards?: Board[];
  /** A board to open on, by id ('board-launch', 'board-tokyo', 'board-ideas'); else the gallery. */
  initialBoard?: string | null;
}

export default function Freeform({ defaultBoards = SAMPLE_BOARDS, initialBoard = null }: FreeformProps) {
  const dark = useAppearance() === 'dark';
  return (
    <BLProvider tint={FREEFORM_TINT[dark ? 'dark' : 'light']}>
      <FreeformProvider boards={defaultBoards} openId={initialBoard}>
        <Shell />
      </FreeformProvider>
    </BLProvider>
  );
}

function Shell() {
  const f = useFreeform();
  const [ref, width] = useContainerWidth<HTMLDivElement>(1000);
  const compact = width < 640;
  return (
    <div ref={ref} data-slot="freeform" className="relative h-full w-full">
      {f.openId && f.board ? <BoardEditor key={f.openId} compact={compact} onBack={() => f.open(null)} /> : <BoardGallery compact={compact} />}
    </div>
  );
}
