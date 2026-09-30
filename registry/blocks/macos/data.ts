/* Alfred sample data — every name, path and snippet here is invented. Times are fixed strings so frames repeat. */

/* ── Clipboard history ── */

export type ClipKind = 'text' | 'link' | 'code' | 'color' | 'image';
export interface Clip {
  id: string;
  kind: ClipKind;
  /** What's on the clipboard (a color's hex, an image's caption). */
  text: string;
  /** The app it was copied from. */
  app: string;
  /** When, as shown ("2 min ago"). */
  when: string;
  pinned?: boolean;
  /** Images: pixel size and the two stops of the placeholder. */
  image?: { w: number; h: number; from: string; to: string };
}

export const CLIPS: Clip[] = [
  { id: 'c-addr', kind: 'text', text: '1 Infinite Loop, Cupertino, CA 95014', app: 'Contacts', when: 'Pinned Mar 4', pinned: true },
  { id: 'c-wifi', kind: 'text', text: 'guest-network-4417 / tulip-orbit-canyon', app: 'Notes', when: 'Pinned Feb 18', pinned: true },
  { id: 'c-link', kind: 'link', text: 'https://www.alfredapp.com/help/features/clipboard/', app: 'Safari', when: '2 min ago' },
  { id: 'c-code', kind: 'code', text: "const hotkey = matchesHotkey(event, 'alt+space');\nif (hotkey) launcher.toggle();", app: 'Xcode', when: '8 min ago' },
  { id: 'c-color', kind: 'color', text: '#5E5CE6', app: 'Figma', when: '14 min ago' },
  { id: 'c-shot', kind: 'image', text: 'Screenshot 2026-09-29 at 9.12.44', app: 'Screenshot', when: '27 min ago', image: { w: 1440, h: 900, from: '#7F7FD5', to: '#86A8E7' } },
  { id: 'c-mail', kind: 'text', text: 'Thanks — I’ll take a look this afternoon and get back to you before the standup tomorrow.', app: 'Mail', when: '1 hr ago' },
  { id: 'c-cmd', kind: 'code', text: 'pnpm nx run-many -t typecheck', app: 'Terminal', when: '2 hr ago' },
  { id: 'c-track', kind: 'text', text: '1Z 999 AA1 01 2345 6784', app: 'Safari', when: 'Yesterday' },
  { id: 'c-color2', kind: 'color', text: '#FF9F0A', app: 'Figma', when: 'Yesterday' },
  { id: 'c-link2', kind: 'link', text: 'https://github.com/brett/ui/pull/482', app: 'Slack', when: 'Yesterday' },
];

/* ── Snippets ── */

export interface Snippet { keyword: string; name: string; text: string; collection: string }

export const SNIPPETS: Snippet[] = [
  { keyword: ';addr', name: 'Home address', text: '1 Infinite Loop\nCupertino, CA 95014\nUnited States', collection: 'Personal' },
  { keyword: ';sig', name: 'Email signature', text: 'Best,\nBrett Lamy\nDesign Engineer · Replay\nbrett@example.com', collection: 'Personal' },
  { keyword: ';email', name: 'Email address', text: 'brett@example.com', collection: 'Personal' },
  { keyword: ';date', name: 'Today’s date', text: 'Tuesday, September 29, 2026', collection: 'Dynamic' },
  { keyword: ';shrug', name: 'Shrug', text: '¯\\_(ツ)_/¯', collection: 'Fun' },
  { keyword: ';flip', name: 'Table flip', text: '(╯°□°)╯︵ ┻━┻', collection: 'Fun' },
  { keyword: ';zoom', name: 'Meeting link', text: 'https://meet.example.com/brett-standup', collection: 'Work' },
  { keyword: ';lgtm', name: 'Code review approval', text: 'LGTM! Nice work — ship it once CI is green. 🚢', collection: 'Work' },
  { keyword: ';thx', name: 'Thanks reply', text: 'Thank you so much, really appreciate it!', collection: 'Work' },
];

/* ── Emoji ── [char, name, keywords] */

export interface Emoji { char: string; name: string; keywords: string[] }
const e = (char: string, name: string, keywords = ''): Emoji => ({ char, name, keywords: keywords ? keywords.split(' ') : [] });

export const EMOJI_GROUPS: { heading: string; items: Emoji[] }[] = [
  {
    heading: 'Smileys',
    items: [
      e('😀', 'Grinning Face', 'smile happy joy'), e('😃', 'Grinning Face with Big Eyes', 'smile happy'), e('😄', 'Grinning Squinting Face', 'laugh happy'),
      e('😁', 'Beaming Face', 'grin teeth'), e('😆', 'Laughing', 'lol haha'), e('😅', 'Grinning with Sweat', 'phew relief'),
      e('🤣', 'Rolling on the Floor Laughing', 'rofl lol'), e('😂', 'Tears of Joy', 'lol cry laugh'), e('🙂', 'Slightly Smiling', 'smile'),
      e('😉', 'Winking Face', 'wink flirt'), e('😊', 'Smiling with Smiling Eyes', 'blush happy'), e('😇', 'Halo', 'angel innocent'),
      e('🥰', 'Smiling with Hearts', 'love adore'), e('😍', 'Heart Eyes', 'love crush'), e('🤩', 'Star-Struck', 'wow amazing'),
      e('😘', 'Blowing a Kiss', 'kiss love'), e('😋', 'Savoring Food', 'yum delicious'), e('😜', 'Winking with Tongue', 'silly joke'),
      e('🤪', 'Zany Face', 'crazy wild'), e('🤔', 'Thinking Face', 'hmm think wonder'), e('🤨', 'Raised Eyebrow', 'skeptical doubt'),
      e('😐', 'Neutral Face', 'meh blank'), e('🙄', 'Rolling Eyes', 'eyeroll whatever'), e('😬', 'Grimacing', 'awkward yikes'),
      e('😌', 'Relieved', 'calm content'), e('😴', 'Sleeping', 'zzz tired sleep'), e('🥳', 'Partying Face', 'party celebrate birthday'),
      e('😎', 'Sunglasses', 'cool'), e('🤓', 'Nerd Face', 'geek glasses'), e('😭', 'Loudly Crying', 'sad sob cry'),
      e('😱', 'Screaming in Fear', 'shock scared omg'), e('🤯', 'Exploding Head', 'mind blown wow'),
    ],
  },
  {
    heading: 'People & Gestures',
    items: [
      e('👍', 'Thumbs Up', '+1 yes like approve'), e('👎', 'Thumbs Down', '-1 no dislike'), e('👏', 'Clapping Hands', 'applause bravo'),
      e('🙌', 'Raising Hands', 'hooray celebrate'), e('🙏', 'Folded Hands', 'please thanks pray'), e('🤝', 'Handshake', 'deal agree'),
      e('👋', 'Waving Hand', 'hello hi bye wave'), e('✌️', 'Victory Hand', 'peace'), e('🤞', 'Crossed Fingers', 'luck hope'),
      e('👌', 'OK Hand', 'okay perfect'), e('🤙', 'Call Me Hand', 'shaka'), e('💪', 'Flexed Biceps', 'strong muscle'),
      e('👀', 'Eyes', 'look see watching'), e('🧠', 'Brain', 'smart think'), e('🫡', 'Saluting Face', 'respect yes sir'),
      e('🤷', 'Person Shrugging', 'shrug dunno'),
    ],
  },
  {
    heading: 'Nature & Food',
    items: [
      e('🐶', 'Dog Face', 'puppy pet'), e('🐱', 'Cat Face', 'kitten pet'), e('🦊', 'Fox', 'animal'), e('🐼', 'Panda', 'animal bear'),
      e('🐸', 'Frog', 'animal'), e('🦄', 'Unicorn', 'magic'), e('🌸', 'Cherry Blossom', 'flower spring'), e('🌈', 'Rainbow', 'pride weather'),
      e('☀️', 'Sun', 'sunny weather'), e('🌙', 'Crescent Moon', 'night'), e('⚡️', 'High Voltage', 'lightning zap fast'), e('🔥', 'Fire', 'lit hot flame'),
      e('🍕', 'Pizza', 'food slice'), e('🍔', 'Hamburger', 'burger food'), e('🌮', 'Taco', 'food mexican'), e('☕️', 'Hot Beverage', 'coffee tea'),
    ],
  },
  {
    heading: 'Objects & Symbols',
    items: [
      e('🚀', 'Rocket', 'ship launch space'), e('🎉', 'Party Popper', 'tada celebrate'), e('✨', 'Sparkles', 'magic shiny new'), e('💡', 'Light Bulb', 'idea'),
      e('💻', 'Laptop', 'computer mac'), e('⌨️', 'Keyboard', 'type'), e('📎', 'Paperclip', 'attach'), e('📌', 'Pushpin', 'pin'),
      e('🔒', 'Locked', 'lock secure'), e('🔑', 'Key', 'password'), e('🎯', 'Direct Hit', 'target goal bullseye'), e('🏆', 'Trophy', 'win award'),
      e('❤️', 'Red Heart', 'love like'), e('✅', 'Check Mark Button', 'done yes complete'), e('❌', 'Cross Mark', 'no wrong'), e('⚠️', 'Warning', 'caution alert'),
      e('💯', 'Hundred Points', '100 perfect'), e('🚢', 'Ship', 'boat ship it'), e('🐛', 'Bug', 'insect error'), e('🧪', 'Test Tube', 'test experiment'),
    ],
  },
];

/* ── Files ── */

export type FileKind = 'folder' | 'pdf' | 'image' | 'code' | 'doc' | 'sheet' | 'zip' | 'video' | 'audio' | 'app' | 'md';
export interface FileNode { name: string; kind: FileKind; size?: string; modified: string; children?: FileNode[] }

const f = (name: string, kind: FileKind, size: string, modified: string): FileNode => ({ name, kind, size, modified });
const dir = (name: string, modified: string, children: FileNode[]): FileNode => ({ name, kind: 'folder', modified, children });

export const HOME: FileNode = dir('brett', 'Today', [
  dir('Desktop', 'Today', [
    f('Screenshot 2026-09-29 at 9.12.44.png', 'image', '1.4 MB', 'Today, 9:12 AM'),
    f('Launch checklist.md', 'md', '6 KB', 'Today, 8:40 AM'),
    f('Invoice-0419.pdf', 'pdf', '212 KB', 'Yesterday'),
  ]),
  dir('Documents', 'Yesterday', [
    dir('Taxes', 'Apr 12', [f('2025 Return.pdf', 'pdf', '2.1 MB', 'Apr 12'), f('Receipts.numbers', 'sheet', '840 KB', 'Apr 10')]),
    f('Resume — Brett Lamy.pdf', 'pdf', '188 KB', 'Aug 30'),
    f('Q3 Planning.key', 'doc', '14.2 MB', 'Sep 21'),
    f('Budget 2026.numbers', 'sheet', '1.1 MB', 'Sep 18'),
    f('Wedding toast.pages', 'doc', '96 KB', 'Jun 2'),
  ]),
  dir('Downloads', 'Today', [
    f('Alfred_5.5_2257.dmg', 'app', '9.8 MB', 'Today, 7:02 AM'),
    f('brand-assets.zip', 'zip', '48.3 MB', 'Yesterday'),
    f('keynote-recording.mov', 'video', '1.2 GB', 'Sep 25'),
    f('podcast-ep-112.mp3', 'audio', '64 MB', 'Sep 22'),
  ]),
  dir('Projects', 'Today', [
    dir('alfred-clone', 'Today', [
      dir('src', 'Today', [f('launcher.tsx', 'code', '18 KB', 'Today, 9:30 AM'), f('calc.ts', 'code', '5 KB', 'Today, 9:02 AM'), f('pages.tsx', 'code', '24 KB', 'Today, 9:28 AM')]),
      f('README.md', 'md', '3 KB', 'Today, 8:55 AM'),
      f('package.json', 'code', '1 KB', 'Yesterday'),
    ]),
    dir('ui', 'Yesterday', [
      f('command-menu.tsx', 'code', '42 KB', 'Yesterday'),
      f('CHANGELOG.md', 'md', '28 KB', 'Yesterday'),
    ]),
    f('ideas.md', 'md', '2 KB', 'Sep 27'),
  ]),
  dir('Pictures', 'Sep 20', [
    f('Yosemite-sunrise.heic', 'image', '4.2 MB', 'Sep 20'),
    f('Team offsite.jpg', 'image', '3.6 MB', 'Sep 12'),
  ]),
  dir('Music', 'Aug 3', [f('Focus mix.m4a', 'audio', '88 MB', 'Aug 3')]),
]);

/** Finds a node by its path ('~', '~/Projects/ui'). */
export function nodeAt(path: string): FileNode | null {
  const parts = path.split('/').slice(1);
  let n: FileNode | undefined = HOME;
  for (const p of parts) n = n?.children?.find((c) => c.name === p);
  return n ?? null;
}

/** Every file and folder under `path` (depth-first), with its path. */
export function descendants(path: string): { node: FileNode; path: string }[] {
  const out: { node: FileNode; path: string }[] = [];
  const walk = (n: FileNode, p: string) => n.children?.forEach((c) => { const cp = `${p}/${c.name}`; out.push({ node: c, path: cp }); walk(c, cp); });
  const root = nodeAt(path);
  if (root) walk(root, path);
  return out;
}

/** A file's path by its name (names are unique in this sample tree). */
export function pathOf(name: string): string | null {
  return descendants('~').find((d) => d.node.name === name)?.path ?? null;
}

/* ── GitHub workflow ── */

export interface Repo { name: string; description: string; stars: string; lang: string; langColor: string }
export const REPOS: Repo[] = [
  { name: 'brett/ui', description: 'iOS-flavoured React components', stars: '2.4k', lang: 'TypeScript', langColor: '#3178C6' },
  { name: 'brett/docstream', description: 'Markdown docs that render components', stars: '812', lang: 'TypeScript', langColor: '#3178C6' },
  { name: 'brett/alfred-workflows', description: 'A few handy Alfred workflows', stars: '356', lang: 'Swift', langColor: '#F05138' },
  { name: 'replay/devtools', description: 'Time-travel debugging for the web', stars: '5.1k', lang: 'JavaScript', langColor: '#F1E05A' },
];

export interface IssueLabel { id: string; name: string; color: string; description: string }
export const LABELS: IssueLabel[] = [
  { id: 'bug', name: 'bug', color: '#FF453A', description: 'Something isn’t working' },
  { id: 'enhancement', name: 'enhancement', color: '#30D158', description: 'New feature or request' },
  { id: 'docs', name: 'documentation', color: '#0A84FF', description: 'Improvements or additions to docs' },
  { id: 'question', name: 'question', color: '#BF5AF2', description: 'Further information is requested' },
];

export const TIMERS = [
  { minutes: 5, name: 'Short break' },
  { minutes: 15, name: 'Quick task' },
  { minutes: 25, name: 'Pomodoro' },
  { minutes: 45, name: 'Deep work' },
  { minutes: 60, name: 'One hour' },
];

/* ── Web searches ── */

export interface Engine { id: string; name: string; url: string; host: string }
export const ENGINES: Engine[] = [
  { id: 'google', name: 'Google', url: 'https://www.google.com/search?q=', host: 'google.com' },
  { id: 'github', name: 'GitHub', url: 'https://github.com/search?q=', host: 'github.com' },
  { id: 'wikipedia', name: 'Wikipedia', url: 'https://en.wikipedia.org/wiki/Special:Search?search=', host: 'wikipedia.org' },
  { id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/results?search_query=', host: 'youtube.com' },
  { id: 'maps', name: 'Maps', url: 'https://maps.apple.com/?q=', host: 'maps.apple.com' },
  { id: 'amazon', name: 'Amazon', url: 'https://www.amazon.com/s?k=', host: 'amazon.com' },
];

/** The initial Trash, for the Empty Trash confirmation. */
export const TRASH = { items: 47, size: '1.2 GB' };
