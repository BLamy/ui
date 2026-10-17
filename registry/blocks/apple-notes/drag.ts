/* Dragging files around Notes. A row carries its path under NOTES_FILE; drops take those, or files from your
   computer ("Files"). Every target says what it does: the editor embeds, a folder uploads, a location moves or copies. */
import { useRef, useState, type DragEvent } from 'react';

/** Paths dragged from Notes' own rows (lowercase: browsers lowercase drag types). */
export const NOTES_FILE = 'application/x-bl-notes-file';

export const draggedPaths = (data: DataTransfer) => data.getData(NOTES_FILE).split('\n').filter(Boolean);
export const hasNotesFiles = (data: DataTransfer) => [...data.types].includes(NOTES_FILE);
export const hasComputerFiles = (data: DataTransfer) => [...data.types].includes('Files');

/** Props that make a row draggable as the file at `path`. */
export function fileDragProps(path: string) {
  return {
    draggable: true,
    onDragStart(e: DragEvent) {
      e.dataTransfer.setData(NOTES_FILE, path);
      e.dataTransfer.setData('text/plain', path);
      e.dataTransfer.effectAllowed = 'copyMove';
    },
  };
}

/** A native drop target. `accepts` sees only the drag's types (its data is readable only on drop). */
export function useDropTarget({ accepts, onDrop, effect = 'copy' }: {
  accepts: (data: DataTransfer) => boolean;
  onDrop: (data: DataTransfer) => void;
  effect?: 'copy' | 'move';
}) {
  const [over, setOver] = useState(false);
  // Entering a child fires dragenter before the parent's dragleave: count, so the highlight doesn't flicker.
  const depth = useRef(0);
  return {
    isDropTarget: over,
    dropProps: {
      'data-drop-target': over || undefined,
      onDragEnter(e: DragEvent) {
        if (!accepts(e.dataTransfer)) return;
        e.preventDefault();
        depth.current++; setOver(true);
      },
      onDragOver(e: DragEvent) {
        if (!accepts(e.dataTransfer)) return;
        e.preventDefault(); e.stopPropagation();
        e.dataTransfer.dropEffect = effect;
      },
      onDragLeave() {
        if (--depth.current <= 0) { depth.current = 0; setOver(false); }
      },
      onDrop(e: DragEvent) {
        depth.current = 0; setOver(false);
        if (!accepts(e.dataTransfer)) return;
        e.preventDefault(); e.stopPropagation();
        onDrop(e.dataTransfer);
      },
    },
  };
}
