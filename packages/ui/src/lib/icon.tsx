import { useId, type CSSProperties } from 'react';
import { cn } from './utils';

/**
 * One piece of an icon, drawn on a 24px grid in `currentColor`.
 *
 * - `d` a path, `c` a circle `[cx, cy, r]`, `r` a rounded rect `[x, y, w, h, rx?]`.
 * - Stroked by default (round caps and joins). `f: 1` fills instead; `f: 2` fills *and* strokes, so a filled
 *   variant keeps its outline's exact size and rounded corners.
 * - `k: 1` knocks the shape out of everything else (a mask, so it works on any background): the tick in
 *   `check-circle-fill`, the gap beside a slash. `o: 1` draws a shape over the knockouts instead of being cut.
 * - `w` scales the stroke width for that shape; `fr: 1` uses the even-odd fill rule.
 * - `bg: 1` strokes in the page background at a fixed width (legacy; prefer `k`). `rx` is ignored (legacy).
 */
export type IconShape = {
  d?: string;
  c?: readonly number[];
  r?: readonly number[];
  f?: number;
  k?: number;
  o?: number;
  w?: number;
  fr?: number;
  bg?: number;
  rx?: number;
};

/* ══ shared pieces ══ */
const RING = { c: [12, 12, 8.6] } as const;
const DISC = { c: [12, 12, 8.6], f: 2 } as const;
const LOCK_BODY = 'M6 10.6h12v9H6z';
const LOCK_SHACKLE = 'M8.6 10.6V8a3.4 3.4 0 0 1 6.8 0v2.6';
const LOCK_SHACKLE_OPEN = 'M8.6 10.6V8a3.4 3.4 0 0 1 6.59-1.16';
const STAR = 'M12 3.8l2.34 4.98 5.26.66-3.87 3.74 1 5.42L12 15.98 7.27 18.6l1-5.42L4.4 9.44l5.26-.66L12 3.8z';
const HEART = 'M12 19.3s-7.3-4.4-7.3-9.6A4.1 4.1 0 0 1 12 7.1a4.1 4.1 0 0 1 7.3 2.6c0 5.2-7.3 9.6-7.3 9.6z';
const MOON = 'M19.8 14.3A8.3 8.3 0 1 1 9.7 4.2a6.8 6.8 0 0 0 10.1 10.1z';
const BELL = 'M12 4.2a5.8 5.8 0 0 1 5.8 5.8c0 2.9.9 4.4 1.9 5.4H4.3c1-1 1.9-2.5 1.9-5.4A5.8 5.8 0 0 1 12 4.2z';
const CLAPPER = 'M10.1 19.2a2 2 0 0 0 3.8 0';
const FOLDER = 'M3.8 7.2c0-.9.7-1.6 1.6-1.6h4.1l1.9 2h7.2c.9 0 1.6.7 1.6 1.6v8.6c0 .9-.7 1.6-1.6 1.6H5.4c-.9 0-1.6-.7-1.6-1.6z';
const HOUSE = 'M4.5 10.8L12 4.5l7.5 6.3V19a1 1 0 0 1-1 1h-4v-5.5h-5V20h-4a1 1 0 0 1-1-1z';
const MAPPIN = 'M12 20.5s-6-5.6-6-10.3a6 6 0 0 1 12 0c0 4.7-6 10.3-6 10.3z';
const SHIELD = 'M12 3.3L19 6v5.4c0 4.3-2.9 7.7-7 9.3-4.1-1.6-7-5-7-9.3V6z';
const SHIELD_CHECK = 'M9 12l2.2 2.2L15.2 10';
const KEY_SHAFT = 'M12 12h8.8M17.6 12v3.4M20.8 12v2.6';
const WARNING = 'M10.4 4.6a1.8 1.8 0 0 1 3.2 0l7 12.6a1.8 1.8 0 0 1-1.6 2.7H5a1.8 1.8 0 0 1-1.6-2.7z';
const TRASH_BODY = 'M7 7l.9 11.1c.1 1.1 1 1.9 2.1 1.9h4c1.1 0 2-.8 2.1-1.9L17 7';
const TRASH_LID = [{ d: 'M5 7h14' }, { d: 'M9.3 7V5.4c0-.8.6-1.4 1.4-1.4h2.6c.8 0 1.4.6 1.4 1.4V7' }] as const;
const TRASH_LINES = 'M10.2 10.5v5.2M13.8 10.5v5.2';
const TRAY = 'M3.5 13.5l2.4-7.2a1.5 1.5 0 0 1 1.4-1.1h9.4a1.5 1.5 0 0 1 1.4 1.1l2.4 7.2v4.3a1.5 1.5 0 0 1-1.5 1.5h-14a1.5 1.5 0 0 1-1.5-1.5z';
const TRAY_SLOT = 'M3.5 13.5h4.6l1.3 2.3h5.2l1.3-2.3h4.6';
const ARCHIVE_BODY = 'M5 9v9.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V9';
const FLAG_POLE = 'M5.5 20.6V4.6';
const FLAG = 'M5.5 4.8c2.2-1.2 4.2-1.2 6.3 0s4.1 1.2 6.4 0v8.6c-2.3 1.2-4.3 1.2-6.4 0s-4.1-1.2-6.3 0';
const PUSHPIN = 'M10.2 4v5.2L7.4 12.6v1.6h9.2v-1.6l-2.8-3.4V4';
const TAG = 'M3.8 12.6V4.8a1 1 0 0 1 1-1h7.8l7.6 7.6a1 1 0 0 1 0 1.4l-7.8 7.8a1 1 0 0 1-1.4 0z';
const BOOKMARK = 'M6.6 5.2c0-.8.6-1.4 1.4-1.4h8c.8 0 1.4.6 1.4 1.4v15l-5.4-3.8-5.4 3.8z';
const BRIEFCASE = 'M3.8 8.8c0-.8.6-1.4 1.4-1.4h13.6c.8 0 1.4.6 1.4 1.4v9c0 .8-.6 1.4-1.4 1.4H5.2c-.8 0-1.4-.6-1.4-1.4z';
const BRIEFCASE_HANDLE = 'M9 7.4V5.6c0-.6.4-1 1-1h4c.6 0 1 .4 1 1v1.8';
const CAMERA = 'M3.5 8.6c0-.8.6-1.4 1.4-1.4h2.4l1.5-2.2h6.4l1.5 2.2h2.4c.8 0 1.4.6 1.4 1.4v9c0 .8-.6 1.4-1.4 1.4H4.9c-.8 0-1.4-.6-1.4-1.4z';
const VIDEO_BODY = 'M3 6.8h11.5v10.4H3z';
const VIDEO_LENS = 'M14.8 10.7l4.7-2.8v8.2l-4.7-2.8z';
const PAPERPLANE = 'M20.5 3.5L3.5 10.6l6.6 2.8 2.8 6.6z';
const PLAY_SMALL = 'M10 8.6c0-.6.6-.9 1.1-.6l5 3.4c.4.3.4.9 0 1.2l-5 3.4c-.5.3-1.1 0-1.1-.6z';
const LOCATION = 'M20 4L3.8 11l7 2.2L13 20z';
const BOLT = 'M13.2 3L5.8 13.2h5.6L10.6 21l7.6-10.2h-5.6z';
const CLOUD = 'M7.2 18.6h10.4a4.1 4.1 0 0 0 .7-8.1 6.1 6.1 0 0 0-11.8-1.1 4.6 4.6 0 0 0 .7 9.2z';
const SUN_RAYS = 'M12 3.4v2M12 18.6v2M3.4 12h2M18.6 12h2M5.92 5.92l1.41 1.41M16.67 16.67l1.41 1.41M5.92 18.08l1.41-1.41M16.67 7.33l1.41-1.41';
const BATTERY = 'M2.8 8.2c0-.8.6-1.4 1.4-1.4h13.2c.8 0 1.4.6 1.4 1.4v7.6c0 .8-.6 1.4-1.4 1.4H4.2c-.8 0-1.4-.6-1.4-1.4z';
const ENVELOPE = [3.5, 5.5, 17, 13, 2] as const;
const ENVELOPE_FLAP = 'M4.6 7.4l7.4 5.6 7.4-5.6';
const MESSAGE = 'M12 3.8c4.8 0 8.6 3.2 8.6 7.1s-3.8 7.1-8.6 7.1c-.9 0-1.8-.1-2.6-.3l-3.9 1.7.9-3.1c-1.5-1.3-2.4-3.2-2.4-5.4 0-3.9 3.2-7.1 8-7.1z';
const PERSON_HEAD = [12, 7.8, 3.6] as const;
const PERSON_BODY = 'M5.2 19.8c.5-3.6 3.2-6 6.8-6s6.3 2.4 6.8 6z';
const round = (n: number) => Math.round(n * 100) / 100;
/** The speaker body, shifted right by `dx` (each speaker variant centers its own content, as SF Symbols does). */
const speaker = (dx: number) =>
  `M${round(2.8 + dx)} 9.7c0-.6.4-1 1-1h2.4l3.6-3.3c.6-.5 1.5-.1 1.5.7v11.8c0 .8-.9 1.2-1.5.7l-3.6-3.3H${round(3.8 + dx)}c-.6 0-1-.4-1-1z`;
const WAVES_3 = 'M14.2 9.6a3.6 3.6 0 0 1 0 4.8M16.6 7.5a6.6 6.6 0 0 1 0 9M18.8 5.6a9.6 9.6 0 0 1 0 12.8';
const SLASH = 'M4.5 4.5l15 15';
/** A slash with a gap cut on either side of it, so it reads over whatever it crosses. */
const slash = (d = SLASH) => [{ d, k: 1, w: 2.6 }, { d, o: 1 }] as const;

/* ══ Icons ══ canonical names (kebab-case, SF Symbols vocabulary). Legacy keys are appended below. */
const SHAPES = {
  /* ── media ── transport glyphs are solid, as in SF Symbols */
  play: [{ d: 'M7.2 4.6c0-1 1.1-1.6 1.9-1.1l11 6.9c.8.5.8 1.7 0 2.2l-11 6.9c-.8.5-1.9-.1-1.9-1.1z', f: 1 }],
  pause: [{ r: [5.6, 4, 4.4, 16, 1.2], f: 1 }, { r: [14, 4, 4.4, 16, 1.2], f: 1 }],
  stop: [{ r: [5, 5, 14, 14, 2.4], f: 1 }],
  forward: [
    { d: 'M2.6 6.6c0-.8.9-1.3 1.6-.9l7.6 5.4c.6.4.6 1.3 0 1.8l-7.6 5.4c-.7.4-1.6-.1-1.6-.9z', f: 1 },
    { d: 'M12 6.6c0-.8.9-1.3 1.6-.9l7.6 5.4c.6.4.6 1.3 0 1.8l-7.6 5.4c-.7.4-1.6-.1-1.6-.9z', f: 1 },
  ],
  backward: [
    { d: 'M21.4 6.6c0-.8-.9-1.3-1.6-.9l-7.6 5.4c-.6.4-.6 1.3 0 1.8l7.6 5.4c.7.4 1.6-.1 1.6-.9z', f: 1 },
    { d: 'M12 6.6c0-.8-.9-1.3-1.6-.9l-7.6 5.4c-.6.4-.6 1.3 0 1.8l7.6 5.4c.7.4 1.6-.1 1.6-.9z', f: 1 },
  ],
  'play-circle': [RING, { d: PLAY_SMALL, f: 1 }],
  'play-circle-fill': [DISC, { d: PLAY_SMALL, f: 1, k: 1 }],
  shuffle: [
    { d: 'M3.5 7.5h2.6c2 0 3.2.9 4.3 2.6l3.2 3.8c1.1 1.7 2.3 2.6 4.3 2.6h2.6' },
    { d: 'M3.5 16.5h2.6c1.5 0 2.6-.5 3.5-1.5M14.4 9c.9-1 2-1.5 3.5-1.5h2.6' },
    { d: 'M18 5l2.5 2.5L18 10M18 14l2.5 2.5L18 19' },
  ],
  repeat: [
    { d: 'M4 11V9.6A2.6 2.6 0 0 1 6.6 7h12.6M20 13v1.4a2.6 2.6 0 0 1-2.6 2.6H4.8' },
    { d: 'M16.8 4.4l2.6 2.6-2.6 2.6M7.2 19.6L4.6 17l2.6-2.6' },
  ],
  'repeat-1': [
    { d: 'M4 11V9.6A2.6 2.6 0 0 1 6.6 7h12.6M20 13v1.4a2.6 2.6 0 0 1-2.6 2.6H4.8' },
    { d: 'M16.8 4.4l2.6 2.6-2.6 2.6M7.2 19.6L4.6 17l2.6-2.6' },
    { d: 'M11 10.5l1.4-1v5', w: 0.85 },
  ],
  'quote-bubble': [
    { d: 'M4.4 5.6c0-1 .8-1.8 1.8-1.8h11.6c1 0 1.8.8 1.8 1.8v8.8c0 1-.8 1.8-1.8 1.8H11l-4.2 3.6v-3.6h-.6c-1 0-1.8-.8-1.8-1.8z' },
    { d: 'M9.6 8.2c-.9 0-1.4.6-1.4 1.3s.5 1.2 1.2 1.2c.4 0 .5.6-.6 1.4M14.4 8.2c-.9 0-1.4.6-1.4 1.3s.5 1.2 1.2 1.2c.4 0 .5.6-.6 1.4' },
  ],
  queue: [{ d: 'M4 6.5h14M4 11.5h9M4 16.5h6' }, { d: 'M15.2 13.6c0-.5.5-.8 1-.5l4.2 2.6c.4.3.4.9 0 1.1l-4.2 2.6c-.5.3-1-.1-1-.6z', f: 1 }],
  airplay: [
    { d: 'M6.6 16.4H5a1.6 1.6 0 0 1-1.6-1.6V6a1.6 1.6 0 0 1 1.6-1.6h14A1.6 1.6 0 0 1 20.6 6v8.8a1.6 1.6 0 0 1-1.6 1.6h-1.6' },
    { d: 'M11.3 13.4c.4-.5 1-.5 1.4 0l4 4.8c.4.5 0 1.2-.7 1.2H8c-.7 0-1.1-.7-.7-1.2z', f: 1 },
  ],
  speaker: [{ d: speaker(4.6) }],
  'speaker-fill': [{ d: speaker(4.6), f: 2 }],
  'speaker-low': [{ d: speaker(3) }, { d: 'M17.2 9.6a3.6 3.6 0 0 1 0 4.8' }],
  'speaker-low-fill': [{ d: speaker(3), f: 2 }, { d: 'M17.2 9.6a3.6 3.6 0 0 1 0 4.8' }],
  'speaker-high': [{ d: speaker(0) }, { d: WAVES_3 }],
  'speaker-high-fill': [{ d: speaker(0), f: 2 }, { d: WAVES_3 }],
  'speaker-slash': [{ d: speaker(3.6) }, ...slash()],
  'speaker-slash-fill': [{ d: speaker(3.6), f: 2 }, ...slash()],
  mic: [{ r: [9, 3.6, 6, 10.4, 3] }, { d: 'M6 11.4a6 6 0 0 0 12 0M12 17.4v3' }],
  'mic-fill': [{ r: [9, 3.6, 6, 10.4, 3], f: 2 }, { d: 'M6 11.4a6 6 0 0 0 12 0M12 17.4v3' }],
  'music-note': [{ d: 'M12 17.2V4.2l5.6 2v3.2L12 7.4' }, { c: [9.4, 17.2, 2.6], f: 2 }],
  'music-notes': [{ d: 'M9 17.5V5.6l10-2v11.6' }, { c: [6.8, 17.6, 2.3], f: 1 }, { c: [16.8, 15.4, 2.3], f: 1 }],
  'music-note-list': [{ d: 'M4 6.5h10M4 11h10M4 15.5h6' }, { d: 'M18 5v10.4' }, { c: [15.8, 15.6, 2.2], f: 2 }],
  'books-vertical': [{ d: 'M5 4.5v15M9 4.5v15' }, { d: 'M13 5.2l3.6-1 3.8 14.6-3.6 1z' }],
  'e-square-fill': [{ r: [4, 4, 16, 16, 3], f: 1 }, { d: 'M14.4 8H9.8v8h4.6M9.8 12h4', k: 1, w: 1.1 }],
  waveform: [{ d: 'M4.5 10.2v3.6' }, { d: 'M8.25 7.5v9' }, { d: 'M12 4.8v14.4' }, { d: 'M15.75 7.5v9' }, { d: 'M19.5 10.2v3.6' }],
  radiowaves: [
    { c: [12, 12, 2], f: 1 },
    { d: 'M8.2 15.8a5.4 5.4 0 0 1 0-7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6M5.4 18.6a9.4 9.4 0 0 1 0-13.2M18.6 5.4a9.4 9.4 0 0 1 0 13.2' },
  ],
  headphones: [
    { d: 'M4.5 16v-3.5a7.5 7.5 0 0 1 15 0V16' },
    { d: 'M4.5 14.4h3v5.2h-1.6c-.8 0-1.4-.6-1.4-1.4zM19.5 14.4h-3v5.2h1.6c.8 0 1.4-.6 1.4-1.4z', f: 2 },
  ],
  photo: [{ d: 'M3.8 5.8h16.4v12.4H3.8z', rx: 1 }, { c: [9, 10, 1.6] }, { d: 'M4.5 17l5.2-4.6 3.6 3.1 2.4-2.1 4 3.6' }],
  camera: [{ d: CAMERA }, { c: [12, 12.6, 3.3] }],
  'camera-fill': [{ d: CAMERA, f: 2 }, { c: [12, 12.6, 3.3], k: 1 }],
  video: [{ d: VIDEO_BODY, rx: 1 }, { d: VIDEO_LENS, f: 1 }],
  'video-fill': [{ d: VIDEO_BODY, f: 2 }, { d: VIDEO_LENS, f: 2 }],

  /* ── security ── */
  lock: [{ d: LOCK_BODY, rx: 1 }, { d: LOCK_SHACKLE }],
  'lock-fill': [{ d: LOCK_BODY, f: 2 }, { d: LOCK_SHACKLE }],
  'lock-open': [{ d: LOCK_BODY }, { d: LOCK_SHACKLE_OPEN }],
  'lock-open-fill': [{ d: LOCK_BODY, f: 2 }, { d: LOCK_SHACKLE_OPEN }],
  'lock-rotation': [
    { d: 'M19.6 12a7.6 7.6 0 1 1-2.2-5.4' },
    { d: 'M17.8 3.4v3.4h-3.4' },
    { r: [9.1, 11, 5.8, 4.6, 1], f: 1 },
    { d: 'M10.4 11V9.9a1.6 1.6 0 0 1 3.2 0V11' },
  ],
  key: [{ c: [7.6, 12, 4.4] }, { c: [6.8, 12, 1.2], f: 1 }, { d: KEY_SHAFT }],
  'key-fill': [{ c: [7.6, 12, 4.4], f: 2 }, { c: [6.8, 12, 1.3], f: 1, k: 1 }, { d: KEY_SHAFT }],
  passkey: [
    { c: [9, 7.8, 3.4] },
    { d: 'M3.2 19.2c.7-3.4 3.1-5.3 5.8-5.3 1.2 0 2.3.3 3.2.9' },
    { c: [17.2, 12.4, 2.2] },
    { d: 'M17.2 14.6v5.6M17.2 17.6h1.8M17.2 19.6h1.4' },
  ],
  shield: [{ d: SHIELD }],
  'shield-fill': [{ d: SHIELD, f: 2 }],
  'shield-check': [{ d: SHIELD }, { d: SHIELD_CHECK }],
  'shield-check-fill': [{ d: SHIELD, f: 2 }, { d: SHIELD_CHECK, k: 1 }],
  'shield-exclamation': [{ d: SHIELD }, { d: 'M12 8v5' }, { c: [12, 16, 0.4], f: 2 }],
  eye: [{ d: 'M2.4 12s3.5-6.4 9.6-6.4 9.6 6.4 9.6 6.4-3.5 6.4-9.6 6.4S2.4 12 2.4 12z' }, { c: [12, 12, 3] }],
  'eye-slash': [
    { d: 'M9.6 5.9A9.8 9.8 0 0 1 12 5.6c6.1 0 9.6 6.4 9.6 6.4a17 17 0 0 1-2.6 3.4M6.3 7.5C3.9 9.2 2.4 12 2.4 12s3.5 6.4 9.6 6.4c1.6 0 3-.4 4.2-1' },
    { d: 'M9.9 9.9a3 3 0 0 0 4.2 4.2M3.8 3.8l16.4 16.4' },
  ],
  faceid: [
    { d: 'M4 8.4V6c0-1.1.9-2 2-2h2.4M15.6 4H18c1.1 0 2 .9 2 2v2.4M20 15.6V18c0 1.1-.9 2-2 2h-2.4M8.4 20H6c-1.1 0-2-.9-2-2v-2.4' },
    { d: 'M9 9.2v1.4M15 9.2v1.4M12.2 9.2v3.8h-1M9.6 15.8c1.4 1.1 3.4 1.1 4.8 0' },
  ],
  qrcode: [
    { r: [4, 4, 6, 6, 1.2] },
    { r: [14, 4, 6, 6, 1.2] },
    { r: [4, 14, 6, 6, 1.2] },
    { d: 'M14 14h2.4v2.4M20 14v.1M18.2 18.2H20V20M14 20h2' },
  ],
  warning: [{ d: WARNING }, { d: 'M12 9.4v4' }, { c: [12, 16.6, 1.05], f: 1 }],
  'warning-fill': [{ d: WARNING, f: 2 }, { d: 'M12 9.4v4', k: 1 }, { c: [12, 16.6, 1.05], f: 1, k: 1 }],

  /* ── system ── */
  wifi: [{ d: 'M3.6 9.4a12 12 0 0 1 16.8 0' }, { d: 'M6.6 12.6a7.8 7.8 0 0 1 10.8 0' }, { d: 'M9.6 15.7a3.6 3.6 0 0 1 4.8 0' }, { c: [12, 18.6, .9], f: 1 }],
  bluetooth: [{ d: 'M7 7.5l10 9-5 4.5V3l5 4.5-10 9' }],
  antenna: [
    { c: [12, 10.4, 1.7], f: 1 },
    { d: 'M12 12.6V21' },
    { d: 'M8.6 7a5 5 0 0 0 0 6.8M15.4 7a5 5 0 0 1 0 6.8M5.6 4a9 9 0 0 0 0 12.8M18.4 4a9 9 0 0 1 0 12.8' },
  ],
  cellularbars: [
    { r: [3.6, 15.4, 3, 4.2, 1], f: 1 },
    { r: [8.2, 12, 3, 7.6, 1], f: 1 },
    { r: [12.8, 8.4, 3, 11.2, 1], f: 1 },
    { r: [17.4, 4.4, 3, 15.2, 1], f: 1 },
  ],
  hotspot: [{ d: 'M10.6 8.4H8.2a3.6 3.6 0 0 0 0 7.2h2.4M13.4 8.4h2.4a3.6 3.6 0 0 1 0 7.2h-2.4' }, { d: 'M8.8 12h6.4' }],
  vpn: [
    { r: [2.8, 6.2, 18.4, 11.6, 2.8] },
    { d: 'M5.2 9.4l1.6 5.2 1.6-5.2M10.6 14.6V9.4H12a1.5 1.5 0 0 1 0 3h-1.4M15.8 14.6V9.4l3 5.2V9.4', w: 0.8 },
  ],
  airplane: [{ d: 'M10.4 3.6c0-1 .7-1.6 1.6-1.6s1.6.6 1.6 1.6v5.6l7.4 4.4v2l-7.4-2.3v4.9l2 1.5V21l-3.6-1-3.6 1v-1.3l2-1.5v-4.9L3 15.6v-2l7.4-4.4z', f: 1 }],
  battery: [{ d: BATTERY }, { d: 'M21.2 10.4v3.2' }, { r: [5, 9, 8.5, 6, .6], f: 1 }],
  'battery-full': [{ d: BATTERY }, { d: 'M21.2 10.4v3.2' }, { r: [5, 9, 11.6, 6, .6], f: 1 }],
  'battery-empty': [{ d: BATTERY }, { d: 'M21.2 10.4v3.2' }],
  bolt: [{ d: BOLT }],
  'bolt-fill': [{ d: BOLT, f: 2 }],
  power: [{ d: 'M12 3.6v7.6' }, { d: 'M7.4 6.4a7.4 7.4 0 1 0 9.2 0' }],
  hourglass: [
    { d: 'M6.5 3.5h11M6.5 20.5h11' },
    { d: 'M8 3.5c0 4.2 4 5.4 4 8.5s-4 4.3-4 8.5M16 3.5c0 4.2-4 5.4-4 8.5s4 4.3 4 8.5' },
    { d: 'M9.6 19.2c.6-1.8 1.4-2.6 2.4-3.2 1 .6 1.8 1.4 2.4 3.2z', f: 1 },
  ],
  hand: [{ d: 'M8.2 12.6V6.4a1.3 1.3 0 0 1 2.6 0V11M10.8 11V4.9a1.3 1.3 0 0 1 2.6 0V11M13.4 11V5.9a1.3 1.3 0 0 1 2.6 0V12M16 12V8.6a1.3 1.3 0 0 1 2.6 0v5.2c0 4-2.5 6.7-6.2 6.7-2.6 0-4.1-1.3-5.4-3.4l-2.3-3.8a1.3 1.3 0 0 1 2.2-1.4l1.3 1.9' }],
  moon: [{ d: MOON }],
  'moon-fill': [{ d: MOON, f: 2 }],
  bell: [{ d: BELL }, { d: CLAPPER }],
  'bell-fill': [{ d: BELL, f: 2 }, { d: CLAPPER }],
  'bell-slash': [{ d: BELL }, { d: CLAPPER }, ...slash()],
  gear: [{ c: [12, 12, 2.8] }, { d: 'M10.3 3.6h3.4l.5 2.3 1.6.9 2.2-.8 1.7 2.9-1.8 1.6v1.9l1.8 1.6-1.7 2.9-2.2-.8-1.6.9-.5 2.3h-3.4l-.5-2.3-1.6-.9-2.2.8-1.7-2.9 1.8-1.6v-1.9L4.3 8.9 6 6l2.2.8 1.6-.9z' }],
  sliders: [{ d: 'M4 8h4.6' }, { d: 'M13.4 8H20' }, { c: [11, 8, 2.2] }, { d: 'M4 16h8.6' }, { d: 'M17.4 16H20' }, { c: [15, 16, 2.2] }],
  sun: [{ c: [12, 12, 3.9] }, { d: SUN_RAYS }],
  'sun-fill': [{ c: [12, 12, 3.9], f: 2 }, { d: SUN_RAYS }],
  accessibility: [
    { c: [12, 4.8, 1.9], f: 1 },
    { d: 'M4.8 8.4c2.4.8 4.8 1.2 7.2 1.2s4.8-.4 7.2-1.2' },
    { d: 'M12 9.8v5l-3.2 5.8M12 14.8l3.2 5.8' },
  ],
  sos: [{ d: 'M8.2 9.3c-.3-.5-.9-.8-1.6-.8-.9 0-1.6.6-1.6 1.4 0 1.8 3.4 1.2 3.4 3.1 0 .9-.8 1.5-1.8 1.5-.8 0-1.4-.3-1.8-.9M12 8.5c1.2 0 2 1.2 2 3.25S13.2 15 12 15s-2-1.2-2-3.25.8-3.25 2-3.25zM19 9.3c-.3-.5-.9-.8-1.6-.8-.9 0-1.6.6-1.6 1.4 0 1.8 3.4 1.2 3.4 3.1 0 .9-.8 1.5-1.8 1.5-.8 0-1.4-.3-1.8-.9' }],
  flower: [{ c: [12, 7.4, 3], f: 1 }, { c: [12, 16.6, 3], f: 1 }, { c: [7.4, 12, 3], f: 1 }, { c: [16.6, 12, 3], f: 1 }],
  location: [{ d: LOCATION }],
  'location-fill': [{ d: LOCATION, f: 2 }],
  cloud: [{ d: CLOUD }],
  'cloud-fill': [{ d: CLOUD, f: 2 }],
  iphone: [{ r: [6.6, 3.2, 10.8, 17.6, 2.6] }, { d: 'M10.8 5.9h2.4' }],
  laptop: [{ d: 'M5 6.2c0-.7.5-1.2 1.2-1.2h11.6c.7 0 1.2.5 1.2 1.2V15H5z' }, { d: 'M2.8 18.4h18.4' }],
  applewatch: [
    { d: 'M8.4 6.4h7.2c1.1 0 2 .9 2 2v7.2c0 1.1-.9 2-2 2H8.4c-1.1 0-2-.9-2-2V8.4c0-1.1.9-2 2-2z' },
    { d: 'M9 6.4l.6-3h4.8l.6 3M9 17.6l.6 3h4.8l.6-3' },
  ],
  keyboard: [
    { d: 'M3 7c0-.8.6-1.4 1.4-1.4h15.2c.8 0 1.4.6 1.4 1.4v10c0 .8-.6 1.4-1.4 1.4H4.4c-.8 0-1.4-.6-1.4-1.4z' },
    { d: 'M6.6 9.4h.1M10 9.4h.1M13.4 9.4h.1M16.8 9.4h.1M6.6 12.4h.1M10 12.4h.1M13.4 12.4h.1M16.8 12.4h.1M8.4 15.4h7.2' },
  ],
  internaldrive: [
    { d: 'M4 6.5c0-1 .8-1.8 1.8-1.8h12.4c1 0 1.8.8 1.8 1.8v11c0 1-.8 1.8-1.8 1.8H5.8c-1 0-1.8-.8-1.8-1.8z' },
    { d: 'M4 13.6h16' },
    { c: [16.4, 16.5, .9], f: 1 },
  ],
  'switch-2': [
    { d: 'M7.5 4.6h9a3.6 3.6 0 0 1 0 7.2h-9a3.6 3.6 0 0 1 0-7.2z' }, { c: [16.5, 8.2, 2], f: 1 },
    { d: 'M7.5 12.8h9a3.6 3.6 0 0 1 0 7.2h-9a3.6 3.6 0 0 1 0-7.2z' }, { c: [7.5, 16.4, 2], f: 1 },
  ],
  car: [
    { d: 'M4 15.6v-3l1.8-4.8c.2-.6.8-1 1.4-1h9.6c.6 0 1.2.4 1.4 1l1.8 4.8v3z' },
    { d: 'M5.4 15.6v2.2M18.6 15.6v2.2M4.4 12.4h15.2' },
    { c: [7.6, 13.8, .9], f: 1 },
    { c: [16.4, 13.8, .9], f: 1 },
  ],
  bed: [{ d: 'M3.5 18V7M3.5 14.5h17V18M20.5 14.5V12c0-1.4-1.1-2.5-2.5-2.5h-7v5' }, { c: [7.2, 11.2, 1.8], f: 1 }],

  /* ── productivity ── */
  cart: [{ d: 'M3 4h2.4l2.2 10.4c.1.6.7 1 1.3 1h8.6c.6 0 1.1-.4 1.3-1L20.4 8H6.4' }, { c: [9.5, 19, 1.5], f: 1 }, { c: [17, 19, 1.5], f: 1 }],
  flag: [{ d: FLAG_POLE }, { d: FLAG }],
  'flag-fill': [{ d: FLAG_POLE }, { d: FLAG + 'z', f: 2 }],
  tray: [{ d: TRAY }, { d: TRAY_SLOT }],
  'tray-fill': [{ d: TRAY, f: 2 }, { d: TRAY_SLOT, k: 1 }],
  archivebox: [{ r: [3.5, 5, 17, 4, 1] }, { d: ARCHIVE_BODY }, { d: 'M10 13h4' }],
  'xmark-bin': [{ r: [3.5, 5, 17, 4, 1] }, { d: ARCHIVE_BODY }, { d: 'M10 12.5l4 4M14 12.5l-4 4' }],
  'archivebox-fill': [{ r: [3.5, 5, 17, 4, 1], f: 2 }, { d: ARCHIVE_BODY + 'z', f: 2 }, { d: 'M10 13h4', k: 1 }, { d: 'M3.5 9.9h17', k: 1, w: 0.6 }],
  trash: [...TRASH_LID, { d: TRASH_BODY }, { d: 'M10.2 10.5v5.2' }, { d: 'M13.8 10.5v5.2' }],
  'trash-fill': [...TRASH_LID, { d: TRASH_BODY + 'z', f: 2 }, { d: TRASH_LINES, k: 1 }],
  folder: [{ d: FOLDER }],
  'folder-fill': [{ d: FOLDER, f: 2 }],
  'folder-badge-plus': [{ d: FOLDER }, { d: 'M12 10.6v5.6M9.2 13.4h5.6' }],
  'folder-badge-gear': [
    { d: 'M11 18.8H5.4c-.9 0-1.6-.7-1.6-1.6V7.2c0-.9.7-1.6 1.6-1.6h4.1l1.9 2h7.2c.9 0 1.6.7 1.6 1.6v2.3' },
    { c: [17.2, 16.4, 1.6] },
    { d: 'M17.2 12.6v1.2M17.2 19v1.2M13.4 16.4h1.2M19.8 16.4H21M14.5 13.7l.8.8M19.1 18.3l.8.8M14.5 19.1l.8-.8M19.1 14.5l.8-.8' },
  ],
  pushpin: [{ d: 'M9 3.8h6' }, { d: PUSHPIN }, { d: 'M12 14.2v6' }],
  'pushpin-fill': [{ d: 'M9 3.8h6' }, { d: PUSHPIN + 'z', f: 2 }, { d: 'M12 14.2v6' }],
  'pushpin-slash': [{ d: 'M9 3.8h6' }, { d: PUSHPIN }, { d: 'M12 14.2v6' }, ...slash('M4.5 4.5l15 15')],
  mappin: [{ d: MAPPIN }, { c: [12, 10.2, 2.2] }],
  'mappin-fill': [{ d: MAPPIN, f: 2 }, { c: [12, 10.2, 2.3], f: 1, k: 1 }],
  checklist: [{ c: [6, 7, 2.4] }, { d: 'M4.9 7.1l.8.8 1.5-1.6', w: 0.8 }, { c: [6, 17, 2.4] }, { d: 'M11 7h9.5M11 17h9.5' }],
  table: [{ r: [3.5, 4.5, 17, 15, 2] }, { d: 'M3.5 9.5h17M3.5 14.5h17M9.2 9.5v10M14.8 9.5v10' }],
  list: [
    { d: 'M9 6.5h11M9 12h11M9 17.5h11' },
    { c: [4.8, 6.5, 1.1], f: 1 },
    { c: [4.8, 12, 1.1], f: 1 },
    { c: [4.8, 17.5, 1.1], f: 1 },
  ],
  grid: [{ r: [4, 4, 7, 7, 1.6] }, { r: [13, 4, 7, 7, 1.6] }, { r: [4, 13, 7, 7, 1.6] }, { r: [13, 13, 7, 7, 1.6] }],
  'grid-fill': [{ r: [4, 4, 7, 7, 1.6], f: 2 }, { r: [13, 4, 7, 7, 1.6], f: 2 }, { r: [4, 13, 7, 7, 1.6], f: 2 }, { r: [13, 13, 7, 7, 1.6], f: 2 }],
  wallet: [
    { d: 'M4 7.4c0-1 .8-1.8 1.8-1.8h12.4c1 0 1.8.8 1.8 1.8v9.2c0 1-.8 1.8-1.8 1.8H5.8c-1 0-1.8-.8-1.8-1.8z' },
    { d: 'M4 9.8h16' },
    { d: 'M14.6 14.6h3' },
  ],
  share: [{ d: 'M12 3.8v11' }, { d: 'M8.2 7.4L12 3.6l3.8 3.8' }, { d: 'M8.5 10.5H7c-.9 0-1.6.7-1.6 1.6v6.6c0 .9.7 1.6 1.6 1.6h10c.9 0 1.6-.7 1.6-1.6v-6.6c0-.9-.7-1.6-1.6-1.6h-1.5' }],
  download: [{ d: 'M12 3.6v10.6' }, { d: 'M8.2 10.6l3.8 3.8 3.8-3.8' }, { d: 'M8.5 10.5H7c-.9 0-1.6.7-1.6 1.6v6.6c0 .9.7 1.6 1.6 1.6h10c.9 0 1.6-.7 1.6-1.6v-6.6c0-.9-.7-1.6-1.6-1.6h-1.5' }],
  compose: [{ d: 'M11.5 4.5H6.2c-.9 0-1.7.8-1.7 1.7v11.6c0 .9.8 1.7 1.7 1.7h11.6c.9 0 1.7-.8 1.7-1.7v-5.3' }, { d: 'M17.6 3.9a1.9 1.9 0 0 1 2.6 2.6L12.4 14.3l-3.5.9.9-3.5z' }],
  pencil: [{ d: 'M16.2 4.6a1.9 1.9 0 0 1 2.7 0l.5.5a1.9 1.9 0 0 1 0 2.7L8.8 18.4l-4.2 1 1-4.2z' }, { d: 'M14.2 6.6l3.2 3.2' }],
  paperclip: [{ d: 'M19.5 11.2l-7.6 7.6a4.6 4.6 0 0 1-6.5-6.5l8.1-8.1a3.1 3.1 0 0 1 4.4 4.4l-8 8a1.55 1.55 0 0 1-2.2-2.2l7.3-7.3' }],
  calendar: [
    { d: 'M4.2 6.6c0-.9.7-1.6 1.6-1.6h12.4c.9 0 1.6.7 1.6 1.6v11.8c0 .9-.7 1.6-1.6 1.6H5.8c-.9 0-1.6-.7-1.6-1.6z' },
    { d: 'M4.2 9.6h15.6M8.4 3.4v3.2M15.6 3.4v3.2' },
  ],
  'calendar-fill': [
    { d: 'M4.2 6.6c0-.9.7-1.6 1.6-1.6h12.4c.9 0 1.6.7 1.6 1.6v11.8c0 .9-.7 1.6-1.6 1.6H5.8c-.9 0-1.6-.7-1.6-1.6z', f: 2 },
    { d: 'M4.2 9.6h15.6', k: 1, w: 0.7 },
    { d: 'M8.4 3.4v3.2M15.6 3.4v3.2' },
  ],
  clock: [{ c: [12, 12, 8.4] }, { d: 'M12 7.2V12l3.1 1.9' }],
  'clock-fill': [{ c: [12, 12, 8.4], f: 2 }, { d: 'M12 7.2V12l3.1 1.9', k: 1 }],
  tag: [{ d: TAG }, { c: [8.4, 8.4, 1.4] }],
  'tag-fill': [{ d: TAG, f: 2 }, { c: [8.4, 8.4, 1.5], f: 1, k: 1 }],
  doc: [{ d: 'M7 3.8h6.6l4.4 4.4v12H7z' }, { d: 'M13.4 3.8v4.6H18' }, { d: 'M9.6 12.6h5M9.6 15.8h5' }],
  note: [{ r: [5, 3.5, 14, 17, 2] }, { d: 'M8.5 8h7M8.5 12h7M8.5 16h4' }],
  copy: [{ r: [8, 8, 12, 12, 2] }, { d: 'M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2' }],
  link: [{ d: 'M10.4 13.6a3.6 3.6 0 0 0 5.1 0l2.9-2.9a3.6 3.6 0 0 0-5.1-5.1l-1.2 1.2' }, { d: 'M13.6 10.4a3.6 3.6 0 0 0-5.1 0l-2.9 2.9a3.6 3.6 0 0 0 5.1 5.1l1.2-1.2' }],
  bookmark: [{ d: BOOKMARK }],
  'bookmark-fill': [{ d: BOOKMARK, f: 2 }],
  book: [{ d: 'M12 6.4C10.2 5 7.8 4.4 4.4 4.6v13.2c3.4-.2 5.8.4 7.6 1.8 1.8-1.4 4.2-2 7.6-1.8V4.6c-3.4-.2-5.8.4-7.6 1.8zM12 6.4v13.2' }],
  briefcase: [{ d: BRIEFCASE }, { d: BRIEFCASE_HANDLE }, { d: 'M3.8 12.8h16.4' }],
  'briefcase-fill': [{ d: BRIEFCASE, f: 2 }, { d: BRIEFCASE_HANDLE }, { d: 'M3.8 12.8h16.4', k: 1, w: 0.7 }],
  gift: [
    { d: 'M4 9.4h16v3.2H4zM5.4 12.6h13.2v7H5.4zM12 9.4v10.2' },
    { d: 'M12 9.4c-1-3-4.8-4-5-1.8-.1 1.4 2 1.8 5 1.8zM12 9.4c1-3 4.8-4 5-1.8.1 1.4-2 1.8-5 1.8z' },
  ],
  'chart-bar': [{ d: 'M4.5 20v-7M9.5 20V7M14.5 20v-9M19.5 20V4' }],
  textformat: [
    { d: 'M3 18.5L7.6 6.5h.8l4.6 12M4.6 14.4h6.8' },
    { d: 'M20.6 18.5v-5.6a2.6 2.6 0 0 0-5-1M15.2 15.9c0-1.5 1.4-2.2 3.3-2.2h2.1v1.5a2.5 2.5 0 0 1-2.6 2.4c-1.6 0-2.8-.5-2.8-1.7z' },
  ],
  'filter-circle': [RING, { d: 'M8 9.3h8M9.6 12.3h4.8M11 15.3h2' }],
  'filter-circle-fill': [DISC, { d: 'M8 9.3h8M9.6 12.3h4.8M11 15.3h2', k: 1 }],
  layers: [{ d: 'M12 3.6l8.2 4.6L12 12.8 3.8 8.2 12 3.6z' }, { d: 'M4.6 12.4L12 16.6l7.4-4.2' }],

  /* ── communication ── */
  envelope: [{ r: ENVELOPE }, { d: ENVELOPE_FLAP }],
  'envelope-fill': [{ r: ENVELOPE, f: 2 }, { d: ENVELOPE_FLAP, k: 1 }],
  'envelope-open': [{ d: 'M3.5 10l8.5-5.8 8.5 5.8v8.5a1.5 1.5 0 0 1-1.5 1.5h-14a1.5 1.5 0 0 1-1.5-1.5z' }, { d: 'M3.8 10.3l8.2 5.4 8.2-5.4' }],
  'envelope-badge': [
    { d: 'M13 5.5H5.5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2V12' },
    { d: 'M4.6 7.4l7.4 5.6 3.2-2.4' },
    { c: [18.5, 6.5, 2.6], f: 1 },
  ],
  paperplane: [{ d: PAPERPLANE }, { d: 'M20.5 3.5l-10.4 9.9' }],
  'paperplane-fill': [{ d: PAPERPLANE, f: 2 }, { d: 'M17 6.8l-6.9 6.6', k: 1 }],
  reply: [{ d: 'M9.5 7.5L4.5 12l5 4.5' }, { d: 'M4.8 12H14a5.5 5.5 0 0 1 5.5 5.5V19' }],
  'reply-all': [{ d: 'M12.5 7.5L8 12l4.5 4.5' }, { d: 'M7.5 7.5L3 12l4.5 4.5' }, { d: 'M8.3 12H15a5 5 0 0 1 5 5v1.5' }],
  'arrow-forward': [{ d: 'M14.5 7.5l5 4.5-5 4.5' }, { d: 'M19.2 12H10a5.5 5.5 0 0 0-5.5 5.5V19' }],
  'phone-fill': [{ d: 'M6.9 3.9c.8-.8 2-.7 2.7.2l1.2 1.6c.6.8.5 1.9-.2 2.6l-.7.7c.4 1.2 2.1 2.9 3.3 3.3l.7-.7c.7-.7 1.8-.8 2.6-.2l1.6 1.2c.9.7 1 2 .2 2.7l-1 1c-.8.8-2 1.1-3.1.7-2-.7-4.2-2.2-5.9-3.9-1.7-1.7-3.2-3.9-3.9-5.9-.4-1.1-.1-2.3.7-3.1l1-1z', f: 1 }],
  'message-fill': [{ d: MESSAGE, f: 1 }],
  bubble: [{ d: MESSAGE }],
  person: [{ c: [12, 12, 8.6] }, { c: [12, 9.8, 2.9] }, { d: 'M6.9 18.3c1-2.5 2.9-3.8 5.1-3.8s4.1 1.3 5.1 3.8' }],
  'person-fill': [
    DISC,
    { c: [12, 9.6, 3.1], f: 1, k: 1 },
    { d: 'M6.6 18.3c1.1-2.8 3.1-4.2 5.4-4.2s4.3 1.4 5.4 4.2c-1.5 1.4-3.4 2.2-5.4 2.2s-3.9-.8-5.4-2.2z', f: 1, k: 1 },
  ],
  'person-bust': [{ c: PERSON_HEAD }, { d: PERSON_BODY }],
  'person-bust-fill': [{ c: PERSON_HEAD, f: 2 }, { d: PERSON_BODY, f: 2 }],
  people: [{ c: [9, 8.8, 3] }, { d: 'M3.6 18.6c.9-2.7 3-4.1 5.4-4.1s4.5 1.4 5.4 4.1' }, { c: [16.8, 9.6, 2.4] }, { d: 'M16.4 14.7c2.1.2 3.6 1.4 4.3 3.4' }],
  'people-fill': [
    { c: [9, 8.8, 3], f: 2 },
    { d: 'M3.6 18.6c.9-2.7 3-4.1 5.4-4.1s4.5 1.4 5.4 4.1z', f: 2 },
    { c: [16.8, 9.6, 2.4], f: 2 },
    { d: 'M16.1 14.7c2.3.1 3.9 1.4 4.6 3.9h-4.2c-.1-1.5-.2-2.7-.4-3.9z', f: 2 },
  ],
  globe: [{ c: [12, 12, 8.4] }, { d: 'M3.8 12h16.4M12 3.6c2.3 2.3 3.4 5.1 3.4 8.4s-1.1 6.1-3.4 8.4c-2.3-2.3-3.4-5.1-3.4-8.4S9.7 5.9 12 3.6z' }],

  /* ── navigation ── */
  'chevron-right': [{ d: 'M9 5.5l6.5 6.5L9 18.5' }],
  'chevron-left': [{ d: 'M15 5.5L8.5 12l6.5 6.5' }],
  'chevron-up': [{ d: 'M5.5 15L12 8.5l6.5 6.5' }],
  'chevron-down': [{ d: 'M5.5 9l6.5 6.5L18.5 9' }],
  'chevron-up-down': [{ d: 'M8 9.5l4-4 4 4M8 14.5l4 4 4-4' }],
  'arrow-right': [{ d: 'M4.5 12h14.6' }, { d: 'M13 5.9l6.1 6.1-6.1 6.1' }],
  'arrow-left': [{ d: 'M19.5 12H4.9' }, { d: 'M11 5.9L4.9 12l6.1 6.1' }],
  'arrow-up': [{ d: 'M12 19.5V4.9' }, { d: 'M5.9 11L12 4.9l6.1 6.1' }],
  'arrow-down': [{ d: 'M12 4.5v14.6' }, { d: 'M5.9 13l6.1 6.1 6.1-6.1' }],
  'arrow-up-right': [{ d: 'M6.5 17.5L17 7' }, { d: 'M8.6 7H17v8.4' }],
  'arrow-clockwise': [{ d: 'M18.24 8.8A7.2 7.2 0 1 1 12 5.2' }, { d: 'M9.8 3l2.2 2.2-2.2 2.2' }],
  'arrow-counterclockwise': [{ d: 'M5.76 8.8A7.2 7.2 0 1 0 12 5.2' }, { d: 'M14.2 3L12 5.2l2.2 2.2' }],
  'arrow-up-circle': [RING, { d: 'M12 16.4V8M8.6 11.2L12 7.8l3.4 3.4' }],
  'arrow-down-circle': [RING, { d: 'M12 7.6V16M8.6 12.8l3.4 3.4 3.4-3.4' }],
  house: [{ d: HOUSE }],
  'house-fill': [{ d: HOUSE, f: 2 }],
  magnifyingglass: [{ c: [11, 11, 6.2] }, { d: 'M15.7 15.7L20.3 20.3' }],
  sidebar: [{ d: 'M3.5 5.5h17v13h-17z', rx: 1 }, { d: 'M9.5 5.5v13' }],
  menu: [{ d: 'M4 7h16M4 12h16M4 17h16' }],
  ellipsis: [{ c: [5.5, 12, 1.7], f: 1 }, { c: [12, 12, 1.7], f: 1 }, { c: [18.5, 12, 1.7], f: 1 }],
  'ellipsis-circle': [RING, { c: [8.2, 12, 1.25], f: 1 }, { c: [12, 12, 1.25], f: 1 }, { c: [15.8, 12, 1.25], f: 1 }],
  'ellipsis-circle-fill': [DISC, { c: [8.2, 12, 1.3], f: 1, k: 1 }, { c: [12, 12, 1.3], f: 1, k: 1 }, { c: [15.8, 12, 1.3], f: 1, k: 1 }],
  plus: [{ d: 'M12 5v14M5 12h14' }],
  minus: [{ d: 'M5 12h14' }],
  xmark: [{ d: 'M6.8 6.8l10.4 10.4M17.2 6.8L6.8 17.2' }],
  check: [{ d: 'M5.5 12.6l4.3 4.3 8.7-9.3' }],

  /* ── shapes & status ── */
  circle: [RING],
  'circle-fill': [DISC],
  'check-circle': [RING, { d: 'M8.2 12.3l2.6 2.6 5-5.4' }],
  'check-circle-fill': [DISC, { d: 'M8.2 12.3l2.6 2.6 5-5.4', k: 1 }],
  'xmark-circle': [RING, { d: 'M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6' }],
  'xmark-circle-fill': [DISC, { d: 'M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6', k: 1 }],
  'plus-circle': [RING, { d: 'M12 8v8M8 12h8' }],
  'plus-circle-fill': [DISC, { d: 'M12 8v8M8 12h8', k: 1 }],
  'minus-circle': [RING, { d: 'M8 12h8' }],
  'minus-circle-fill': [DISC, { d: 'M8 12h8', k: 1 }],
  info: [{ c: [12, 12, 8.6] }, { d: 'M12 11v5.2' }, { d: 'M12 7.9v.01' }],
  'info-fill': [DISC, { d: 'M12 11v5.2', k: 1 }, { c: [12, 7.9, 1.15], f: 1, k: 1 }],
  'exclamation-circle': [RING, { d: 'M12 7.6v5.2' }, { c: [12, 16.1, 1.05], f: 1 }],
  'exclamation-circle-fill': [DISC, { d: 'M12 7.6v5.2', k: 1 }, { c: [12, 16.1, 1.15], f: 1, k: 1 }],
  'question-circle': [RING, { d: 'M9.7 9.7a2.4 2.4 0 1 1 3.3 2.2c-.6.3-1 .8-1 1.4v.3' }, { c: [12, 16.4, 1.05], f: 1 }],
  'question-circle-fill': [DISC, { d: 'M9.7 9.7a2.4 2.4 0 1 1 3.3 2.2c-.6.3-1 .8-1 1.4v.3', k: 1 }, { c: [12, 16.4, 1.15], f: 1, k: 1 }],
  star: [{ d: STAR }],
  'star-fill': [{ d: STAR, f: 2 }],
  heart: [{ d: HEART }],
  'heart-fill': [{ d: HEART, f: 2 }],
  pulse: [{ c: [12, 12, 3], f: 1 }, { c: [12, 12, 8] }],
  drop: [{ d: 'M12 3.5c3.2 3.9 6 7 6 10.2a6 6 0 1 1-12 0C6 10.5 8.8 7.4 12 3.5z' }],
} as const satisfies Record<string, readonly IconShape[]>;

/** Legacy keys whose geometry differs from the canonical icon; kept so existing usages render unchanged. */
const LEGACY = {
  chevL: [{ d: 'M15 5l-7 7 7 7' }],
  starF: [{ d: STAR, f: 1 }],
  xcirc: [{ c: [12, 12, 9], f: 1 }, { d: 'M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6', bg: 1 }],
  mail: [{ d: 'M3 5.8h18v12.4H3z', rx: 1 }, { d: 'M4.5 7.5l7.5 5.5 7.5-5.5' }],
} as const satisfies Record<string, readonly IconShape[]>;

/** Legacy names → the canonical icon they draw (identical geometry). */
export const ICON_ALIASES = {
  chev: 'chevron-right',
  search: 'magnifyingglass',
  person2: 'people',
  x: 'xmark',
  home: 'house',
  wave: 'waveform',
  pin: 'mappin',
  phone: 'phone-fill',
  message: 'message-fill',
} as const satisfies Record<string, keyof typeof SHAPES>;

/** A canonical icon name (listed in `ICON_NAMES`). */
export type IconCanonicalName = keyof typeof SHAPES;
/** Every name `Icon` draws: canonical names plus the legacy keys and aliases. */
export type IconName = IconCanonicalName | keyof typeof LEGACY | keyof typeof ICON_ALIASES;

/* ══ Icons ══ Every name (canonical, legacy, alias) → its shapes. Indexable by any string, as before (unknown → undefined). */
const IC_MAP = {
  ...SHAPES,
  ...LEGACY,
  ...(Object.fromEntries(Object.entries(ICON_ALIASES).map(([k, v]) => [k, SHAPES[v]])) as {
    [K in keyof typeof ICON_ALIASES]: (typeof SHAPES)[(typeof ICON_ALIASES)[K]];
  }),
} satisfies Record<IconName, readonly IconShape[]>;
export const IC: Readonly<Record<IconName, readonly IconShape[]>> & { readonly [name: string]: readonly IconShape[] | undefined } = IC_MAP;

/** Canonical names, sorted. */
export const ICON_NAMES = (Object.keys(SHAPES) as IconCanonicalName[]).sort();

export type IconCategory = 'media' | 'security' | 'system' | 'productivity' | 'communication' | 'navigation' | 'status';

/** Canonical names grouped for galleries, in drawing order (the grouping follows the source above). */
export const ICON_CATEGORIES: Record<IconCategory, readonly IconCanonicalName[]> = (() => {
  const keys = Object.keys(SHAPES) as IconCanonicalName[];
  const at = (first: IconCanonicalName, next?: IconCanonicalName) =>
    keys.slice(keys.indexOf(first), next ? keys.indexOf(next) : undefined);
  return {
    media: at('play', 'lock'),
    security: at('lock', 'wifi'),
    system: at('wifi', 'cart'),
    productivity: at('cart', 'envelope'),
    communication: at('envelope', 'chevron-right'),
    navigation: at('chevron-right', 'circle'),
    status: at('circle'),
  };
})();

/** Extra search words per icon (SF Symbols names and common synonyms). */
export const ICON_KEYWORDS: Partial<Record<IconCanonicalName, string>> = {
  play: 'start resume transport', pause: 'transport', stop: 'transport square', forward: 'next skip fast-forward',
  backward: 'previous back rewind', shuffle: 'random', repeat: 'loop', 'repeat-1': 'loop once',
  'quote-bubble': 'lyrics quote', queue: 'up next list play', airplay: 'cast screen', speaker: 'volume sound audio',
  'speaker-low': 'volume sound', 'speaker-high': 'volume loud sound', 'speaker-slash': 'mute silent volume',
  mic: 'microphone record dictate voice', 'music-note': 'song audio', 'music-notes': 'song music audio',
  'music-note-list': 'playlist songs tracks', 'books-vertical': 'library shelf collection', 'e-square-fill': 'explicit parental advisory',
  waveform: 'siri voice audio voicemail', radiowaves: 'broadcast radio live', photo: 'image picture',
  camera: 'photo picture', video: 'camera facetime movie', lock: 'secure private password', 'lock-open': 'unlock unsecure',
  key: 'password credential', passkey: 'person key credential', shield: 'security protect', 'shield-check': 'verified secure', 'shield-exclamation': 'security warning alert breach compromised',
  'lock-rotation': 'codes verification one-time otp totp 2fa authenticator',
  eye: 'show visible reveal', 'eye-slash': 'hide hidden conceal', faceid: 'face biometric', qrcode: 'scan code',
  warning: 'exclamationmark triangle alert caution', wifi: 'wireless network', antenna: 'cellular mobile data',
  cellularbars: 'signal cellular', hotspot: 'personal link tether', vpn: 'network private', airplane: 'flight travel mode',
  battery: 'power charge', bolt: 'charge lightning power', power: 'shutdown on off', hourglass: 'screen time wait timer',
  hand: 'privacy stop raised', moon: 'focus sleep dark night', bell: 'notification alert', 'bell-slash': 'mute silence',
  gear: 'settings preferences cog', sliders: 'settings adjust controls filter', sun: 'brightness display light day',
  accessibility: 'a11y person', sos: 'emergency', flower: 'wallpaper macro', location: 'gps navigation arrow',
  cloud: 'icloud weather', iphone: 'phone device mobile', laptop: 'mac computer device',
  applewatch: 'watch wearable device', keyboard: 'typing keys input', internaldrive: 'storage disk drive ssd',
  'switch-2': 'control center toggles settings', car: 'vehicle drive carplay', bed: 'sleep bedtime rest',
  cart: 'shopping groceries basket', flag: 'report mark', tray: 'inbox', archivebox: 'archive box store', 'xmark-bin': 'junk spam',
  trash: 'delete remove bin', folder: 'directory', 'folder-badge-plus': 'new folder add', 'folder-badge-gear': 'smart folder settings', pushpin: 'pin keep',
  'pushpin-slash': 'unpin', mappin: 'pin place map location', checklist: 'todo tasks', table: 'grid spreadsheet',
  list: 'bullets', grid: 'gallery squares', 'grid-fill': 'apps home screen squares', wallet: 'pass card pay apple pay', share: 'export upload square arrow', download: 'save import',
  compose: 'write new edit square pencil', pencil: 'edit write', paperclip: 'attachment attach', calendar: 'date event schedule', 'calendar-fill': 'date event schedule',
  clock: 'time recent history', tag: 'label', doc: 'document file page', note: 'document text', copy: 'duplicate doc on doc',
  link: 'url chain', bookmark: 'save read later', book: 'read library', briefcase: 'work job', gift: 'present birthday',
  'chart-bar': 'stats graph analytics', textformat: 'font text size aa', 'filter-circle': 'filter sort', 'filter-circle-fill': 'filter sort active',
  layers: 'stack square stack copy', envelope: 'mail email message', 'envelope-open': 'read mail', 'envelope-badge': 'unread mail',
  paperplane: 'send', reply: 'respond mail', 'reply-all': 'respond mail', 'arrow-forward': 'forward mail send on',
  'phone-fill': 'call telephone', 'message-fill': 'chat sms imessage bubble', bubble: 'chat message comment',
  person: 'contact account profile user avatar', 'person-bust': 'contact user profile', people: 'group contacts users',
  globe: 'web internet language world', 'chevron-right': 'disclosure next', 'chevron-left': 'back previous',
  'chevron-up': 'collapse', 'chevron-down': 'expand', 'chevron-up-down': 'select picker sort', 'arrow-clockwise': 'refresh reload redo',
  'arrow-counterclockwise': 'undo recover reset', 'arrow-up-right': 'external open', house: 'home',
  magnifyingglass: 'search find', sidebar: 'panel', menu: 'hamburger lines', ellipsis: 'more overflow',
  'ellipsis-circle': 'more options', plus: 'add new', minus: 'remove subtract', xmark: 'close dismiss cancel x',
  check: 'checkmark done tick', 'check-circle': 'checkmark done success', 'xmark-circle': 'close clear error',
  'plus-circle': 'add new', info: 'information about details', 'exclamation-circle': 'alert error', 'question-circle': 'help',
  star: 'favorite rate', heart: 'love like favorite', pulse: 'record live dot', drop: 'water ink color',
};

/** Stroke widths for each weight (SF Symbols-style). `regular` is the default. */
export const ICON_WEIGHTS = { ultralight: 1.2, light: 1.5, regular: 1.8, medium: 2, semibold: 2.2, bold: 2.5 } as const;
export type IconWeight = keyof typeof ICON_WEIGHTS;

export interface IconProps {
  name?: IconName | (string & {});
  /** Custom geometry drawn with the same stroke system (overrides `name`). */
  shapes?: readonly IconShape[];
  /** Width and height in px. Default 22. */
  size?: number;
  /** Stroke weight. Default `regular` (1.8). */
  weight?: IconWeight;
  /** Explicit stroke width; overrides `weight`. */
  sw?: number;
  className?: string;
  style?: CSSProperties;
  /** Accessible name: renders `role="img"` with a `<title>`. Without it (or `aria-label`) the icon is hidden from AT. */
  title?: string;
  'aria-label'?: string;
}

function shapeEl(e: IconShape, i: number, sw: number, mask: boolean) {
  const ink = mask ? 'black' : 'currentColor';
  const fill = e.f ? ink : 'none';
  const stroke = e.f === 1 ? 'none' : e.bg ? 'var(--bl-bg,#fff)' : ink;
  const strokeWidth = e.bg ? 2 : sw * (e.w ?? 1);
  if (e.c) return <circle key={i} cx={e.c[0]} cy={e.c[1]} r={e.c[2]} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
  const common = { fill, stroke, strokeWidth, strokeLinecap: 'round', strokeLinejoin: 'round', fillRule: e.fr ? 'evenodd' : undefined } as const;
  if (e.r) return <rect key={i} x={e.r[0]} y={e.r[1]} width={e.r[2]} height={e.r[3]} rx={e.r[4]} {...common} />;
  return <path key={i} d={e.d} {...common} />;
}

export function Icon({ name, shapes, size, weight, sw, className, style, title, 'aria-label': ariaLabel }: IconProps) {
  const rawId = useId();
  size = size || 22;
  sw = sw || (weight && ICON_WEIGHTS[weight]) || 1.8;
  const els: readonly IconShape[] = shapes || (name && (IC as Record<string, readonly IconShape[]>)[name]) || IC.info;
  const knocks = els.filter((e) => e.k);
  const label = ariaLabel ?? title;
  const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true as const };
  let body;
  if (knocks.length) {
    const id = 'bl-icon-' + rawId.replace(/[^a-zA-Z0-9_-]/g, '');
    body = (
      <>
        <mask id={id} maskUnits="userSpaceOnUse" x="0" y="0" width="24" height="24">
          <rect width="24" height="24" fill="white" />
          {knocks.map((e, i) => shapeEl(e, i, sw, true))}
        </mask>
        <g mask={`url(#${id})`}>{els.map((e, i) => (e.k || e.o ? null : shapeEl(e, i, sw, false)))}</g>
        {els.map((e, i) => (e.o && !e.k ? shapeEl(e, i, sw, false) : null))}
      </>
    );
  } else {
    body = els.map((e, i) => shapeEl(e, i, sw, false));
  }
  return (
    <svg data-slot="icon" className={cn('block shrink-0', className)} width={size} height={size} viewBox="0 0 24 24"
      style={style} {...a11y}>
      {label ? <title>{title ?? label}</title> : null}
      {body}
    </svg>
  );
}
