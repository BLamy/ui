/* Sample mail for the Apple Mail clone: one iCloud account, its mailboxes, smart mailboxes, and a week of
   messages. Times are relative to a fixed "now" so the list reads the same on every render. */

/** The clock the block reads: Sunday, September 27 2026, 9:41 AM. */
export const NOW = new Date(2026, 8, 27, 9, 41);

const at = (daysAgo: number, h: number, m: number) => new Date(2026, 8, 27 - daysAgo, h, m);

export interface Person {
  name: string;
  email: string;
}
export interface Attachment {
  name: string;
  size: string;
  kind: 'pdf' | 'image' | 'doc' | 'zip';
}
/** An earlier message in the same conversation. */
export interface ThreadEntry {
  from: Person;
  date: Date;
  body: string[];
}
export interface Message {
  id: string;
  /** Mailbox the message lives in (a folder id — never a smart mailbox). */
  box: string;
  from: Person;
  to: Person[];
  cc?: Person[];
  subject: string;
  date: Date;
  /** Paragraphs. Lines starting with "> " are quoted text. */
  body: string[];
  unread?: boolean;
  flagged?: boolean;
  attachments?: Attachment[];
  thread?: ThreadEntry[];
}

export type Glyph =
  | 'tray' | 'star' | 'flag' | 'doc' | 'paperplane' | 'junk' | 'trash' | 'archive' | 'folder' | 'gear' | 'clock'
  | 'envelopeBadge' | 'paperclip';

export interface Mailbox {
  id: string;
  title: string;
  glyph: Glyph;
  /** What the sidebar count shows: unread messages (default) or every message. */
  count?: 'unread' | 'all' | 'none';
  /** Smart mailboxes match across folders instead of holding messages. */
  match?: (m: Message) => boolean;
}

export const ME: Person = { name: 'Brett Lamy', email: 'brett@icloud.com' };
const p = (name: string, email: string): Person => ({ name, email });
const MOM = p('Linda Lamy', 'linda.lamy@me.com');
const SAM = p('Sam Okafor', 'sam@okafor.studio');
const WEI = p('Wei Chen', 'wei@fieldnotes.dev');
const ANYA = p('Anya Kowalski', 'anya.k@fastmail.com');
const HANA = p('Hana Sato', 'hana@sato.design');
const LUCA = p('Luca Moretti', 'luca.moretti@gmail.com');
const NOOR = p('Noor Haddad', 'noor@haddad.co');

/** Senders marked VIP. */
export const VIPS = new Set([MOM.email, SAM.email]);

const inInbox = (m: Message) => m.box === 'inbox';
export const FAVORITES: Mailbox[] = [
  { id: 'inbox', title: 'Inbox', glyph: 'tray' },
  { id: 'vip', title: 'VIP', glyph: 'star', match: (m) => inInbox(m) && VIPS.has(m.from.email) },
  { id: 'flagged', title: 'Flagged', glyph: 'flag', count: 'all', match: (m) => !!m.flagged && m.box !== 'trash' },
  { id: 'drafts', title: 'Drafts', glyph: 'doc', count: 'all' },
  { id: 'sent', title: 'Sent', glyph: 'paperplane', count: 'none' },
];
export const SMART: Mailbox[] = [
  { id: 'today', title: 'Today', glyph: 'clock', match: (m) => inInbox(m) && m.date.toDateString() === NOW.toDateString() },
  { id: 'unread', title: 'Unread', glyph: 'envelopeBadge', match: (m) => inInbox(m) && !!m.unread },
  { id: 'attachments', title: 'Attachments', glyph: 'paperclip', count: 'none', match: (m) => !!m.attachments?.length && m.box !== 'trash' && m.box !== 'junk' },
];
export const ICLOUD: Mailbox[] = [
  { id: 'junk', title: 'Junk', glyph: 'junk' },
  { id: 'trash', title: 'Trash', glyph: 'trash', count: 'none' },
  { id: 'archive', title: 'Archive', glyph: 'archive', count: 'none' },
  { id: 'receipts', title: 'Receipts', glyph: 'folder' },
  { id: 'travel', title: 'Travel', glyph: 'folder' },
  { id: 'family', title: 'Family', glyph: 'folder' },
];
export const MAILBOXES = [...FAVORITES, ...SMART, ...ICLOUD];
/** Folders a message can be moved into. */
export const MOVE_TARGETS = MAILBOXES.filter((b) => !b.match && b.id !== 'drafts' && b.id !== 'sent');

export const MESSAGES: Message[] = [
  {
    id: 'm1', box: 'inbox', from: SAM, to: [ME], subject: 'Cabin weekend — final headcount', date: at(0, 9, 32), unread: true, flagged: true,
    body: [
      'Hey Brett,',
      'Booking closes tonight so I need a yes or no by 6. We have the big cabin at Lost Lake from Friday the 9th through Sunday — three bedrooms, a wood stove and a dock that is apparently "rustic".',
      'I put you and Maya down for the loft. If you can bring the camp stove and the good kettle, I will handle groceries.',
      'Directions and the house rules are attached. Please actually read the part about the bears.',
      'Sam',
    ],
    attachments: [{ name: 'Lost Lake Cabin.pdf', size: '1.2 MB', kind: 'pdf' }],
  },
  {
    id: 'm2', box: 'inbox', from: WEI, to: [ME], cc: [ANYA], subject: 'Re: SplitView review', date: at(0, 9, 12), unread: true,
    body: [
      'Hi Brett,',
      'I tried the new build at every size: tiled at desktop width, floating over the list on the iPad, and as a stack on the phone. The column I was reading stays where it is and just changes shape, so nothing flashes and the scroll position survives.',
      'Two small things. The divider could use a slightly larger hit area on touch, and Esc should close the overlay sidebar before it pops the stack. Otherwise I think it is ready to ship.',
      'Want me to record a pass at half speed for Thursday?',
      'Wei',
      '> On Sep 26, 2026, at 4:18 PM, Brett Lamy wrote:',
      '> Columns persist between size classes now — the detail slides into the stack instead of remounting. Could you give it a spin on your iPad before the review?',
    ],
    thread: [
      { from: ME, date: at(1, 16, 18), body: ['Columns persist between size classes now — the detail slides into the stack instead of remounting. Could you give it a spin on your iPad before the review?', 'Brett'] },
      { from: ANYA, date: at(1, 14, 2), body: ['Looping Wei in. The resize handle feels great with a trackpad, but I could not find it on the iPad at first.', 'Anya'] },
    ],
  },
  {
    id: 'm3', box: 'inbox', from: p('United Airlines', 'notifications@united.com'), to: [ME], subject: 'Check in now for your flight to Tokyo', date: at(0, 7, 5), unread: true,
    body: [
      'It is time to check in for UA 837, San Francisco (SFO) to Tokyo (NRT), departing Monday, September 28 at 11:25 AM.',
      'Seat 31K · Economy · Boarding group 3',
      'Add your boarding pass to Wallet to get live updates on gate changes and boarding times.',
    ],
  },
  {
    id: 'm4', box: 'inbox', from: MOM, to: [ME], subject: 'Grandma’s 90th — photos!', date: at(1, 20, 44),
    body: [
      'Hi sweetheart,',
      'Here are the photos from Saturday. Grandma has already asked for prints of the one with all the cousins on the porch, so if you can send me the full-size version I will take it to the drugstore.',
      'Thank you for driving up. It meant the world to her.',
      'Love, Mom',
    ],
    attachments: [
      { name: 'IMG_4410.HEIC', size: '3.1 MB', kind: 'image' },
      { name: 'IMG_4412.HEIC', size: '2.8 MB', kind: 'image' },
      { name: 'IMG_4425.HEIC', size: '3.4 MB', kind: 'image' },
    ],
  },
  {
    id: 'm5', box: 'inbox', from: HANA, to: [ME], subject: 'Offsite agenda', date: at(1, 15, 30), unread: true,
    body: [
      'Morning all,',
      'Tuesday is prototyping, Wednesday is the motion review. Bring your gnarliest interruptions — the ones where a spring gets retargeted halfway through and you are not sure what should happen.',
      'Lunch is on the roof if the weather holds.',
      'Hana',
    ],
    attachments: [{ name: 'Offsite Agenda.pdf', size: '184 KB', kind: 'pdf' }],
  },
  {
    id: 'm6', box: 'inbox', from: LUCA, to: [ME], subject: 'Re: Haptics on Android', date: at(1, 11, 3),
    body: [
      'Vibration patterns are fine, but selection ticks feel mushy below 10 ms on the Pixel. I measured a handful of devices; numbers are in the sheet.',
      'I would bump the selection pulse to 12 ms on Android only and leave iOS alone.',
      'Luca',
    ],
    attachments: [{ name: 'haptics-latency.numbers', size: '96 KB', kind: 'doc' }],
  },
  {
    id: 'm7', box: 'inbox', from: p('Apple', 'no_reply@email.apple.com'), to: [ME], subject: 'Your receipt from Apple', date: at(2, 18, 21),
    body: ['iCloud+ with 2 TB of storage — Monthly', 'Billed to Visa •••• 4417', 'Total $9.99'],
  },
  {
    id: 'm8', box: 'inbox', from: NOOR, to: [ME], subject: 'Docs screenshots', date: at(3, 10, 48),
    body: [
      'Light and dark captures for every live example are in the shared folder. I kept the window at 1400 × 900 so they line up with the visual regression baselines.',
      'Noor',
    ],
  },
  {
    id: 'm9', box: 'inbox', from: p('Stratechery', 'email@stratechery.com'), to: [ME], subject: 'The Split Screen Future', date: at(4, 6, 0),
    body: [
      'Every platform eventually converges on the same idea: a list, a detail, and a way to move between them that respects where you came from.',
      'Today I want to look at why that pattern keeps winning, and what it means for apps that start life on the phone.',
    ],
  },
  {
    id: 'm10', box: 'inbox', from: ANYA, to: [ME], subject: 'Dark mode hairlines', date: at(5, 16, 12), flagged: true,
    body: [
      'Separators at 48% read a touch heavy on the sidebar tint. Could we try the fill token instead? I mocked both side by side.',
      'Anya',
    ],
    attachments: [{ name: 'hairlines.png', size: '640 KB', kind: 'image' }],
  },
  {
    id: 'm11', box: 'inbox', from: p('Figma', 'no-reply@figma.com'), to: [ME], subject: 'Hana Sato invited you to “Mail — iPad”', date: at(9, 12, 30),
    body: ['Hana Sato has invited you to edit the file “Mail — iPad” in the Field Notes team.', 'Open in Figma'],
  },
  {
    id: 'j1', box: 'junk', from: p('Prize Center', 'winner@prize-center.biz'), to: [ME], subject: 'You have (1) unclaimed reward', date: at(0, 3, 14), unread: true,
    body: ['Congratulations! Your reward is waiting. Confirm your shipping details within 24 hours to claim.'],
  },
  {
    id: 'd1', box: 'drafts', from: ME, to: [SAM], subject: 'Re: Cabin weekend — final headcount', date: at(0, 9, 36),
    body: ['We are in! I will bring the stove, the kettle and far too much coffee.'],
  },
  {
    id: 's1', box: 'sent', from: ME, to: [WEI], cc: [ANYA], subject: 'SplitView review', date: at(1, 16, 18),
    body: ['Columns persist between size classes now — the detail slides into the stack instead of remounting. Could you give it a spin on your iPad before the review?', 'Brett'],
  },
  {
    id: 's2', box: 'sent', from: ME, to: [MOM], subject: 'Re: Grandma’s 90th — photos!', date: at(1, 21, 2),
    body: ['Full-size versions are on their way — look for a shared album called “Grandma 90”.', 'Love you'],
  },
  {
    id: 'r1', box: 'receipts', from: p('Blue Bottle Coffee', 'orders@bluebottlecoffee.com'), to: [ME], subject: 'Your subscription has shipped', date: at(6, 8, 15),
    body: ['Hayes Valley Espresso · 2 bags', 'Arriving Thursday'],
  },
  {
    id: 't1', box: 'travel', from: p('Hotel Gracery Shinjuku', 'reservations@gracery.com'), to: [ME], subject: 'Reservation confirmed: Sep 28 – Oct 3', date: at(12, 22, 40), flagged: true,
    body: ['Thank you for your reservation. Check-in from 2:00 PM. Confirmation number 48F-22917.'],
    attachments: [{ name: 'Confirmation.pdf', size: '88 KB', kind: 'pdf' }],
  },
  {
    id: 'a1', box: 'archive', from: HANA, to: [ME], subject: 'Motion review notes', date: at(16, 17, 5),
    body: ['Everything that moves now uses one of the four springs. The only exception left is the confetti, which is allowed to be silly.'],
  },
];

const DAY = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Mail's list timestamp: a time today, "Yesterday", a weekday this week, else a short date. */
export function relativeTime(d: Date) {
  const days = Math.round((startOfDay(NOW) - startOfDay(d)) / DAY);
  if (days <= 0) return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: '2-digit' });
}

/** The message header's full timestamp. */
export function longTime(d: Date) {
  const day = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  return `${day} at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

/** Preview lines under the subject: the body without quoted text. */
export const preview = (m: Message) => m.body.filter((l) => !l.startsWith('>')).join(' ');

export const initials = (who: Person) => {
  const [f = '', l = ''] = who.name.split(' ');
  return { f: f || who.name, l: l || ' ' };
};
