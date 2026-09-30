import type { IconShape } from '@/lib/icon';

/** Icon geometry merged in from the former PencilKit icon set (`PKI`; 2.0: one `Icon`). Canonical kebab-case
    names — none of these match an existing icon's geometry, so each is new. PencilKit draws them at `sw={1.7}`. */
export const PENCILKIT_SHAPES = {
  /** PencilKit pen tool (was `PKI.pen`). */
  'pencil-tip': [{ d: 'M13.2 4.6l6.2 6.2L9 21.2H3.2V15z' }, { d: 'M11 7l6 6' }],
  /** PencilKit marker tool (was `PKI.marker`). */
  highlighter: [{ d: 'M14.6 3.6l5.8 5.8-8.6 8.6H6.4v-5.4z' }, { d: 'M6.4 17.6L4 21.2' }, { d: 'M3 21.2h17' }],
  /** PencilKit pencil tool (was `PKI.pencil`; slimmer than `pencil`). */
  'pencil-sketch': [{ d: 'M4.5 19.5l1-4L16.8 4.2a2 2 0 0 1 2.8 2.8L8.5 18.3l-4 1.2z' }, { d: 'M14.6 6.4l3 3' }],
  /** PencilKit eraser tool (was `PKI.eraser`). */
  eraser: [
    { d: 'M7.8 20.5h8.7' },
    { d: 'M4.6 15.1l8.3-8.3a2 2 0 0 1 2.8 0l2.5 2.5a2 2 0 0 1 0 2.8l-7.4 7.4H8.4a2 2 0 0 1-1.4-.6z' },
    { d: 'M10.3 10.2l4.6 4.6' },
  ],
  /** Undo (was `PKI.undo`). */
  'arrow-uturn-backward': [{ d: 'M7.5 9.2H14a5 5 0 0 1 0 10h-3.4' }, { d: 'M10.8 5.8L7.4 9.2l3.4 3.4' }],
  /** Redo (was `PKI.redo`). */
  'arrow-uturn-forward': [{ d: 'M16.5 9.2H10a5 5 0 0 0 0 10h3.4' }, { d: 'M13.2 5.8l3.4 3.4-3.4 3.4' }],
  /** Single-path trash can (was `PKI.trash`; `trash` draws its lid and lines separately). */
  'trash-slim': [
    { d: 'M5 7h14M9.5 7V5.4A1.4 1.4 0 0 1 10.9 4h2.2a1.4 1.4 0 0 1 1.4 1.4V7M7 7l.8 12a1.4 1.4 0 0 0 1.4 1.3h5.6a1.4 1.4 0 0 0 1.4-1.3L17 7' },
  ],
} as const satisfies Record<string, readonly IconShape[]>;
