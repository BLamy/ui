/* @internal: a shape table Icon merges in (lib/icon). Draw these with <Icon name>; the table is not package API. */
import type { IconShape } from '@/lib/icon';

/** Icon geometry for documents and writing: the glyphs docstream and its editor draw (hints, file tabs, the demo
    viewer, the slash menu, the replay and Strudel players) that the set didn't have. Drawn for BL UI on the same 24px
    grid and stroke as the rest (round caps and joins, `regular` 1.8), with SF Symbols names. */
const SQUARE = [3.5, 3.5, 17, 17, 2.6] as const;
const SLASH = 'M4.5 4.5l15 15';
const H = 'M4 5.5v13M12 5.5v13M4 12h8';
const DISPLAY = [3, 4, 18, 12.5, 2] as const;
const DISPLAY_STAND = 'M12 16.5V20M8 20h8';
const CAPTIONS = [3, 5.5, 18, 13, 2.4] as const;
const CC = 'M10.6 10.3a2.1 2.1 0 1 0 0 3.4M17 10.3a2.1 2.1 0 1 0 0 3.4';

export const DOCS_SHAPES = {
  /* ── text formatting ── */
  bold: [{ d: 'M7.5 4.8h5.2a3.5 3.5 0 0 1 0 7H7.5zM7.5 11.8h6.1a3.85 3.85 0 0 1 0 7.7H7.5z', w: 1.2 }],
  italic: [{ d: 'M10.2 4.8h7M6.8 19.2h7M14.4 4.8l-4.8 14.4' }],
  strikethrough: [
    { d: 'M16.7 7.4c-.6-1.7-2.3-2.8-4.7-2.8-2.7 0-4.6 1.4-4.6 3.5 0 1.2.6 2.2 2 2.9' },
    { d: 'M4.5 12h15' },
    { d: 'M7.3 16.4c.6 1.9 2.4 3 4.9 3 2.8 0 4.7-1.4 4.7-3.6 0-.7-.2-1.3-.6-1.8' },
  ],
  superscript: [{ d: 'M4.2 8l7.8 10.5M12 8L4.2 18.5' }, { d: 'M15.6 6.4a1.75 1.75 0 0 1 3.4.4c0 1.7-3.4 2.4-3.4 4.4h3.7', w: 0.85 }],
  heading: [{ d: 'M6.5 4.5v15M17.5 4.5v15M6.5 12h11' }],
  'heading-1': [{ d: H }, { d: 'M16.6 9.6l2.9-2.2v11.1' }],
  'heading-2': [{ d: H }, { d: 'M16.1 9.4a2.2 2.2 0 0 1 4.3.7c0 2.7-4.4 4.2-4.4 8.4h4.6' }],
  'heading-3': [
    { d: H },
    { d: 'M16 8.8c.4-.9 1.2-1.4 2.2-1.4 1.3 0 2.2.9 2.2 2.1s-1 2.2-2.4 2.2c1.5 0 2.6 1 2.6 2.4 0 1.5-1.1 2.6-2.6 2.6-1.1 0-2-.6-2.4-1.5' },
  ],
  quote: [{ d: 'M9.8 7.2c-2.7.7-4.3 2.6-4.3 5.6v4h4.2v-4.3H7.3M18.5 7.2c-2.7.7-4.3 2.6-4.3 5.6v4h4.2v-4.3H16' }],
  sum: [{ d: 'M17.5 6.4V4.5h-11l6 7.5-6 7.5h11v-1.9' }],
  'list-number': [
    { d: 'M10.5 6.5h9.5M10.5 12h9.5M10.5 17.5h9.5' },
    { d: 'M4.6 5.2l1.4-.9v4.4', w: 0.8 },
    { d: 'M4.5 10.6a1.3 1.3 0 0 1 2.5.4c0 1.1-2.5 1.6-2.5 3h2.6', w: 0.8 },
    { d: 'M4.6 16a1.25 1.25 0 0 1 2.3.4c0 .6-.5 1-1.2 1 .8 0 1.3.5 1.3 1.1 0 .7-.6 1.2-1.3 1.2-.6 0-1.1-.3-1.3-.8', w: 0.8 },
  ],
  code: [{ d: 'M8.4 7.4L3.8 12l4.6 4.6M15.6 7.4l4.6 4.6-4.6 4.6M13.4 5.4l-2.8 13.2' }],
  'doc-code': [
    { d: 'M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5z' },
    { d: 'M13.5 3.5V8.5h5M10.3 12.3l-2 2.1 2 2.1M13.7 12.3l2 2.1-2 2.1' },
  ],
  'folder-git': [
    { d: 'M3.5 7A1.5 1.5 0 0 1 5 5.5h4l2 2.5h8A1.5 1.5 0 0 1 20.5 9.5V17A1.5 1.5 0 0 1 19 18.5H5A1.5 1.5 0 0 1 3.5 17z' },
    { c: [9.4, 15.4, 1.15], w: 0.85 },
    { c: [14.6, 11.6, 1.15], w: 0.85 },
    { d: 'M9.4 10.4v3.85M14.6 12.75c0 1.5-1.9 2.2-4 2.6', w: 0.85 },
  ],

  /* ── blocks and callouts ── */
  lightbulb: [
    { d: 'M9 15.4c0-1.5-.6-2.4-1.5-3.5A5.5 5.5 0 1 1 17.5 8.6c0 1.3-.4 2.3-1 3.3-.9 1.1-1.5 2-1.5 3.5z' },
    { d: 'M9.3 18h5.4M10.4 20.6h3.2' },
  ],
  megaphone: [
    { d: 'M3.8 9.8v4.4a1 1 0 0 0 1 1h2.6l8.6 4.2V4.6L7.4 8.8H4.8a1 1 0 0 0-1 1z' },
    { d: 'M7.6 15.2l1.1 4.3M19.2 9.6a3.1 3.1 0 0 1 0 4.8' },
  ],
  'chevron-down-square': [{ r: SQUARE }, { d: 'M8 10.4l4 4 4-4' }],
  'slash-square': [{ r: SQUARE }, { d: 'M14.6 7.4l-5.2 9.2' }],
  'rectangle-top': [{ r: [3.5, 4.5, 17, 15, 2] }, { d: 'M3.5 9.4h17M10.2 4.5v4.9' }],
  macwindow: [
    { r: [3.5, 4.5, 17, 15, 2] },
    { d: 'M3.5 8.9h17' },
    { c: [6.3, 6.7, 0.7], f: 1 },
    { c: [8.6, 6.7, 0.7], f: 1 },
  ],
  flowchart: [{ r: [3.5, 3.5, 6, 6, 1.4] }, { r: [14.5, 14.5, 6, 6, 1.4] }, { d: 'M6.5 9.5V15a2.5 2.5 0 0 0 2.5 2.5h5.5' }],
  webhook: [{ c: [12, 6.6, 2.3] }, { c: [6.2, 16.9, 2.3] }, { c: [17.8, 16.9, 2.3] }, { d: 'M10.8 8.6L7.4 14.9M8.5 16.9h7M13.2 8.6l3.4 6.3' }],
  'arrow-up-right-square': [
    { d: 'M11 4.5H6A1.5 1.5 0 0 0 4.5 6v12A1.5 1.5 0 0 0 6 19.5h12a1.5 1.5 0 0 0 1.5-1.5v-5' },
    { d: 'M14.2 4.5h5.3v5.3M19.5 4.5l-8 8' },
  ],

  /* ── devices and media ── */
  display: [{ r: DISPLAY }, { d: DISPLAY_STAND }],
  'play-rectangle': [{ r: DISPLAY }, { d: DISPLAY_STAND }, { d: 'M10.6 7.9l3.9 2.35-3.9 2.35z', f: 2, w: 0.7 }],
  ipad: [{ r: [5, 3, 14, 18, 2.4] }, { d: 'M10.9 17.9h2.2' }],
  captions: [{ r: CAPTIONS }, { d: CC }],
  'captions-slash': [{ r: CAPTIONS }, { d: CC }, { d: SLASH, k: 1, w: 2.6 }, { d: SLASH, o: 1 }],
  'pause-circle': [{ c: [12, 12, 8.6] }, { d: 'M10 9.2v5.6M14 9.2v5.6' }],
  nosign: [{ c: [12, 12, 8.6] }, { d: 'M5.9 5.9l12.2 12.2' }],
  progress: [{ d: 'M12 3.4a8.6 8.6 0 1 1-8.6 8.6' }],
  drum: [
    { d: 'M4.5 10.4c0-1.6 3.4-2.9 7.5-2.9s7.5 1.3 7.5 2.9-3.4 2.9-7.5 2.9-7.5-1.3-7.5-2.9z' },
    { d: 'M4.5 10.4v6.2c0 1.6 3.4 2.9 7.5 2.9s7.5-1.3 7.5-2.9v-6.2M8 13v6.1M16 13v6.1' },
    { d: 'M7.4 3.5l3.4 4.6M16.6 3.5l-3.4 4.6' },
  ],
  pianokeys: [
    { r: [3.5, 4.5, 17, 15, 2] },
    { d: 'M9.2 12.5v7M14.8 12.5v7' },
    { r: [7.7, 4.5, 3, 8, 0.6], f: 2, w: 0.6 },
    { r: [13.3, 4.5, 3, 8, 0.6], f: 2, w: 0.6 },
  ],
} as const satisfies Record<string, readonly IconShape[]>;
