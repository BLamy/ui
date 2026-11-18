/* The notes of the landing page's live app. Each one is Markdown, drawn by MarkdownView, and each says something that
   is true of the kit and that the reader can try in the frame it is shown in: the tables and numbers come from
   lib/size-class.ts (640 and 1024), lib/motion.ts (the four springs) and the SplitView and Dialog docs pages. */
import type { IconName } from '@/lib/icon';

export interface Folder {
  id: string;
  title: string;
  icon: IconName;
}

export interface Note {
  id: string;
  folder: string;
  title: string;
  /** The line under the title in the list. */
  summary: string;
  /** When it was written, as the list shows it. */
  when: string;
  /** Newest first: a larger number is newer. */
  order: number;
  markdown: string;
}

/** The folder that shows every note. */
export const ALL = 'all';

export const FOLDERS: Folder[] = [
  { id: ALL, title: 'All Notes', icon: 'tray' },
  { id: 'containers', title: 'Containers', icon: 'sidebar' },
  { id: 'motion', title: 'Motion', icon: 'pulse' },
  { id: 'markdown', title: 'Markdown', icon: 'doc-text' },
  { id: 'theming', title: 'Theming', icon: 'drop' },
];

/** The folders a note can be filed in. */
export const FILING = FOLDERS.filter((f) => f.id !== ALL);
/** Where a note written from All Notes goes: it is Markdown the reader wrote. */
export const NEW_NOTE_FOLDER = 'markdown';

export const NOTES: Note[] = [
  {
    id: 'columns', folder: 'containers', title: 'Three columns, one app', when: 'Today', order: 6,
    summary: 'A SplitView reads the width of its own box, not the viewport.',
    markdown: [
      '## Three columns, one app',
      '',
      'This app is a `SplitView`: folders, a list and this note. It takes its size class from its own box, never the viewport, so it lays out the same way in a window, a pane or a phone frame.',
      '',
      '| Width | Size class | Layout |',
      '| --- | --- | --- |',
      '| under 640 px | compact | one column at a time, as a stack |',
      '| 640 to 1023 px | medium | list and note, with folders floating over them |',
      '| 1024 px and up | regular | three columns side by side |',
      '',
      'Change the width of the frame. The note you are reading stays mounted and keeps its scroll position: each column is one element for its whole life, and only its place changes.',
    ].join('\n'),
  },
  {
    id: 'dialogs', folder: 'containers', title: 'A dialog picks its own shape', when: 'Today', order: 5,
    summary: 'A centered card where there is room, a sheet where there is not.',
    markdown: [
      '## A dialog picks its own shape',
      '',
      'Press the compose button above the list. `Dialog` has `presentation="auto"` by default: it opens as a centered card in a medium or regular container, and as a sheet you can drag down in a compact one.',
      '',
      '- No media query: the choice comes from the container the dialog is written in.',
      '- It stays inside this frame, because the frame is the app\'s `BLProvider`, and popups render into it.',
      '- Focus is trapped while it is open, Esc closes it, and focus returns to the button.',
      '',
      'The sort menu beside it does the same: a popover when the frame is wide, a sheet when it is compact.',
    ].join('\n'),
  },
  {
    id: 'back', folder: 'containers', title: 'Back pops one level', when: 'Yesterday', order: 4,
    summary: 'The back button, Esc, the platform\'s back and an edge swipe.',
    markdown: [
      '## Back pops one level',
      '',
      'In a compact frame, picking a row pushes the next column. Four things pop it again:',
      '',
      '1. the back button in the bar,',
      '2. Esc,',
      '3. the platform\'s back,',
      '4. a swipe from the leading edge.',
      '',
      'Each pops the innermost level first. A popup that is open closes before the page under it moves.',
    ].join('\n'),
  },
  {
    id: 'springs', folder: 'motion', title: 'Four springs', when: 'Monday', order: 3,
    summary: 'snappy, smooth, tray and bouncy, in CSS and in JavaScript.',
    markdown: [
      '## Four springs',
      '',
      '| Preset | Stiffness / damping | Used for |',
      '| --- | --- | --- |',
      '| `snappy` | 620 / 48 | small controls |',
      '| `smooth` | 380 / 40 | layout and panels |',
      '| `tray` | 520 / 44 | sheets and height changes |',
      '| `bouncy` | 520 / 26 | rare, celebratory moments |',
      '',
      'The same physics are sampled into CSS easings, so a column that slides with a CSS transition and a sheet driven from JavaScript move on one curve. In Tailwind a spring is `duration-spring-smooth ease-spring-smooth`; in JavaScript it is `springs.smooth`.',
      '',
      'With `prefers-reduced-motion`, moves become jumps or short fades.',
    ].join('\n'),
  },
  {
    id: 'docstream', folder: 'markdown', title: 'This note is Markdown', when: 'Sunday', order: 2,
    summary: 'Drawn by MarkdownView, which renders while text is still arriving.',
    markdown: [
      '## This note is Markdown',
      '',
      'Every note here is a string, drawn by `MarkdownView` on docstream, the renderer in the same package. Pass it the text so far and it renders while the rest is still arriving: an unfinished block stays open until it is complete.',
      '',
      '```tsx',
      '<MarkdownView',
      '  markdown={answer}',
      '  streaming={streaming}',
      '/>',
      '```',
      '',
      '{% hint style="info" %}',
      'GitBook blocks render too: hints like this one, tabs, steppers, tables and task lists.',
      '{% endhint %}',
      '',
      '- [x] Tables and fenced code with syntax highlighting',
      '- [x] Task lists',
      '- [ ] Write a note of your own with the compose button',
    ].join('\n'),
  },
  {
    id: 'tokens', folder: 'theming', title: 'Looks come from tokens', when: 'Saturday', order: 1,
    summary: 'Colors, radii, type and shadows are variables you can replace.',
    markdown: [
      '## Looks come from tokens',
      '',
      'The colors are shadcn\'s CSS variables, so the kit takes on the palette of the app it is installed in. Radii, the type scale, shadows and the springs are tokens as well, and one stylesheet holds them all.',
      '',
      'Switch this page between light and dark with the button in the header: the frame follows, because it reads the same variables.',
    ].join('\n'),
  },
];
