import type { IconShape } from '@/lib/icon';

/** Icon geometry merged in from the former Workbench icon set (`WIcon`; 2.0: one `Icon`). Canonical kebab-case
    names. Only `plus` matched an existing icon exactly; every other shape differs from its namesake, so it is new.
    `xmark-large`, `arrow-up-compact` and `line-3-horizontal` are the same geometry as the chat set's (same names).
    The Workbench draws them at `sw={1.7}` (WIcon's default stroke). */
export const WORKBENCH_SHAPES = {
  /** Workbench `sidebar`. */
  'sidebar-left': [{ d: 'M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 17V7A1.5 1.5 0 0 1 4 5.5z' }, { d: 'M9 5.5v13' }],
  /** Workbench `panelR`. */
  'sidebar-right': [{ d: 'M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 17V7A1.5 1.5 0 0 1 4 5.5z' }, { d: 'M15 5.5v13' }],
  /** Workbench `panelB`. */
  'panel-bottom': [{ d: 'M4 5.5h16a1.5 1.5 0 0 1 1.5 1.5v10a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 17V7A1.5 1.5 0 0 1 4 5.5z' }, { d: 'M2.5 13.5h19' }],
  /** Workbench `compose`. */
  'square-pencil': [{ d: 'M11 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5' }, { d: 'M17.3 4.2a1.9 1.9 0 0 1 2.7 2.7l-7.6 7.6-3.4.7.7-3.4z' }],
  /** Workbench `search`. */
  magnifier: [{ d: 'M10.8 4a6.8 6.8 0 1 1 0 13.6 6.8 6.8 0 0 1 0-13.6z' }, { d: 'M15.9 15.9L20.5 20.5' }],
  /** Workbench `folder`. */
  'folder-closed': [{ d: 'M3.5 7A1.5 1.5 0 0 1 5 5.5h4l2 2.5h8A1.5 1.5 0 0 1 20.5 9.5V17A1.5 1.5 0 0 1 19 18.5H5A1.5 1.5 0 0 1 3.5 17z' }],
  /** Workbench `folderP`. */
  'folder-plus': [{ d: 'M3.5 7A1.5 1.5 0 0 1 5 5.5h4l2 2.5h8A1.5 1.5 0 0 1 20.5 9.5V17A1.5 1.5 0 0 1 19 18.5H5A1.5 1.5 0 0 1 3.5 17z' }, { d: 'M12 11.2v4M10 13.2h4' }],
  /** Workbench `chevD`. */
  'chevron-down-wide': [{ d: 'M6 9.5l6 6 6-6' }],
  /** Workbench `chevR`. */
  'chevron-right-wide': [{ d: 'M9.5 6l6 6-6 6' }],
  /** Workbench `chevU`. */
  'chevron-up-wide': [{ d: 'M6 14.5l6-6 6 6' }],
  /** Workbench `x`. */
  'xmark-large': [{ d: 'M6 6l12 12M18 6L6 18' }],
  /** Workbench `gear`. */
  gearshape: [{ d: 'M12 8.6a3.4 3.4 0 1 1 0 6.8 3.4 3.4 0 0 1 0-6.8z' }, { d: 'M12 2.8l.9 2.4a7 7 0 0 1 2.1.9l2.4-1 1.5 1.5-1 2.4c.4.6.7 1.3.9 2.1l2.4.9v2l-2.4.9a7 7 0 0 1-.9 2.1l1 2.4-1.5 1.5-2.4-1a7 7 0 0 1-2.1.9l-.9 2.4h-2l-.9-2.4a7 7 0 0 1-2.1-.9l-2.4 1-1.5-1.5 1-2.4a7 7 0 0 1-.9-2.1l-2.4-.9v-2l2.4-.9c.2-.8.5-1.5.9-2.1l-1-2.4L6.1 5l2.4 1a7 7 0 0 1 2.1-.9l.9-2.4z' }],
  /** Workbench `term`. */
  terminal: [{ d: 'M4 5h16a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 20 19H4a1.5 1.5 0 0 1-1.5-1.5v-11A1.5 1.5 0 0 1 4 5z' }, { d: 'M6.5 9l3 3-3 3M12 15h5' }],
  /** Workbench `globe`. */
  network: [{ d: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z' }, { d: 'M3 12h18M12 3c2.6 2.3 4 5.5 4 9s-1.4 6.7-4 9c-2.6-2.3-4-5.5-4-9s1.4-6.7 4-9z' }],
  /** Workbench `files`. */
  'square-on-square': [{ d: 'M8 7.5V5.4A1.4 1.4 0 0 1 9.4 4h9.2A1.4 1.4 0 0 1 20 5.4v9.2a1.4 1.4 0 0 1-1.4 1.4h-2.1' }, { d: 'M4 9.4A1.4 1.4 0 0 1 5.4 8h9.2A1.4 1.4 0 0 1 16 9.4v9.2a1.4 1.4 0 0 1-1.4 1.4H5.4A1.4 1.4 0 0 1 4 18.6z' }],
  /** Workbench `diff`. */
  'doc-text': [{ d: 'M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5z' }, { d: 'M13.5 3.5V8.5h5M9.4 12h5.2M12 15.8h-2.6' }],
  /** Workbench `bot`. */
  robot: [{ d: 'M7 9.5h10A2.5 2.5 0 0 1 19.5 12v4A2.5 2.5 0 0 1 17 18.5H7A2.5 2.5 0 0 1 4.5 16v-4A2.5 2.5 0 0 1 7 9.5z' }, { d: 'M12 9.5V6.2M12 6a1.3 1.3 0 1 1 0-2.6 1.3 1.3 0 0 1 0 2.6zM9 13.3v1.4M15 13.3v1.4' }],
  /** Workbench `expand`. */
  'arrows-expand': [{ d: 'M14 4.5h5.5V10M10 19.5H4.5V14M19.5 4.5L14 10M4.5 19.5L10 14' }],
  /** Workbench `restore`. */
  'arrows-collapse': [{ d: 'M9.5 4v5.5H4M14.5 20v-5.5H20M9.5 9.5L4 4M14.5 14.5L20 20' }],
  /** Workbench `up`. */
  'arrow-up-compact': [{ d: 'M12 19V5M6 11l6-6 6 6' }],
  /** Workbench `stop`. */
  'stop-square': [{ d: 'M8 8h8v8H8z' }],
  /** Workbench `branch`. */
  branch: [{ d: 'M7 4.5a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6zM7 15.9a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6zM17 6.1a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6z' }, { d: 'M7 8.1v7.8M17 9.7c0 3.2-3.4 3.5-6 4.1a4.3 4.3 0 0 0-2.7 1.5' }],
  /** Workbench `trash`. */
  bin: [{ d: 'M5 7h14M9.5 7V5.2A1.2 1.2 0 0 1 10.7 4h2.6a1.2 1.2 0 0 1 1.2 1.2V7M7 7l.8 12a1.4 1.4 0 0 0 1.4 1.3h5.6a1.4 1.4 0 0 0 1.4-1.3L17 7' }],
  /** Workbench `split`. */
  'rectangle-split': [{ d: 'M5 4.5h14A1.5 1.5 0 0 1 20.5 6v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18V6A1.5 1.5 0 0 1 5 4.5z' }, { d: 'M12 4.5v15' }],
  /** Workbench `check`. */
  checkmark: [{ d: 'M4.5 12.5l5 5 10-11' }],
  /** Workbench `checkC`. */
  'checkmark-circle': [{ d: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18z' }, { d: 'M8.2 12.4l2.6 2.6 5-5.6' }],
  /** Workbench `clock`. */
  'clock-dial': [{ d: 'M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z' }, { d: 'M12 7.5V12l3.2 2' }],
  /** Workbench `lock`. */
  'lock-rounded': [{ d: 'M7 10.5V8a5 5 0 0 1 10 0v2.5' }, { d: 'M6.5 10.5h11A1.5 1.5 0 0 1 19 12v6a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 18v-6a1.5 1.5 0 0 1 1.5-1.5z' }],
  /** Workbench `spark`. */
  asterisk: [{ d: 'M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9' }],
  /** Workbench `doc`. */
  'doc-corner': [{ d: 'M13.5 3.5H7A1.5 1.5 0 0 0 5.5 5v14A1.5 1.5 0 0 0 7 20.5h10a1.5 1.5 0 0 0 1.5-1.5V8.5z' }, { d: 'M13.5 3.5V8.5h5' }],
  /** Workbench `msg`. */
  'bubble-left': [{ d: 'M4.5 6.5A2 2 0 0 1 6.5 4.5h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-4.5 3.5z' }],
  /** Workbench `dl`. */
  'arrow-down-to-line': [{ d: 'M12 4v11M7 10.5l5 5 5-5M5 19.5h14' }],
  /** Workbench `at`. */
  at: [{ d: 'M12 8a4 4 0 1 0 4 4v-4' }, { d: 'M16 12a4 4 0 1 1-1.2-2.9' }, { d: 'M12 3a9 9 0 1 0 6.4 15.3' }],
  /** Workbench `hamburger`. */
  'line-3-horizontal': [{ d: 'M4 6.5h16M4 12h16M4 17.5h16' }],
  /** Workbench `play`. */
  'play-outline': [{ d: 'M8 5.5l11 6.5-11 6.5z' }],
  /** Workbench `clip`. */
  'paperclip-diagonal': [{ d: 'M20 11.4l-7.9 7.9a5 5 0 0 1-7.1-7.1l8.3-8.3a3.3 3.3 0 0 1 4.7 4.7l-8.3 8.3a1.7 1.7 0 0 1-2.4-2.4l7.6-7.6' }],
  /** Workbench `star`. */
  'star-sharp': [{ d: 'M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z' }],
  /** Workbench `grip`. */
  'grip-dots': [{ d: 'M9 7h.01M15 7h.01M9 12h.01M15 12h.01M9 17h.01M15 17h.01' }],
} as const satisfies Record<string, readonly IconShape[]>;
