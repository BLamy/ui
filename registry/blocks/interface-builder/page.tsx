/* Interface Builder — Xcode's storyboard for React, with Framer's motion. Scenes are components; drag the kit's
   components in from the library, wire segues between scenes, and give outlets (refs), actions (event handlers),
   bindings (props from state and context), delegates (callback props) and the first responder (focus and the
   responder chain) their React meaning; animate anything the way framer-motion does, with spring and bezier
   editors, and run the whole storyboard as a live prototype. Every scene exports as a React component.
   Pointer: click (or ⌘-click) selects what's under it, in any scene (a scene shown inside another is edited in place)
   · ⇧-click adds · right-click lists everything under the pointer · double-click edits a text where it is.
   Keys: ⌘Z / ⇧⌘Z undo · ⌫ delete · ⌘D duplicate · ⌘C / ⌘V · ⌘↑ / ⌘↓ reorder · Esc select parent · Enter select child ·
   ⇧⌘L library · ⌘R run · ⌘ + / − / 0 / 1 zoom · scroll to pan. */
import { useAppearance } from '@/lib/theme';
import { SAMPLE_DOC } from './data';
import { Editor } from './editor';
import type { Doc } from './model';
import { BuilderProvider, type Selection } from './store';

export interface InterfaceBuilderProps {
  /** The storyboard to open (the Plant Pal sample by default). */
  defaultDocument?: Doc;
  /** What to select at first, e.g. `{ kind: 'scene', scene: 'garden' }`. */
  initialSelection?: Selection;
  /** Light or dark chrome; defaults to the ambient appearance. */
  appearance?: 'light' | 'dark';
  /** Start in the preview. */
  initialRunning?: boolean;
}

export default function InterfaceBuilder({ defaultDocument = SAMPLE_DOC, initialSelection, appearance, initialRunning = false }: InterfaceBuilderProps) {
  const ambient = useAppearance();
  return (
    <BuilderProvider doc={defaultDocument} selection={initialSelection}>
      <Editor appearance={appearance ?? (ambient === 'dark' ? 'dark' : 'light')} initialRunning={initialRunning} />
    </BuilderProvider>
  );
}
