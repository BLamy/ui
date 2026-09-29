import type { ChatUsers } from './components/chat-users';
import type { ChatPresence } from './components/user-panel';

/* Sample data for the Discord clone. Swap it for your API. */

export interface Reaction {
  emoji: string;
  count: number;
  /** you reacted with it */
  mine: boolean;
}

export interface Reply {
  id: string;
  user: string;
  time: string;
  text: string;
}

export interface Thread {
  title: string;
  replies: Reply[];
}

export interface MessageData {
  id: string;
  user: string;
  time: string;
  text: string;
  reactions: Reaction[];
  thread?: Thread | null;
}

export interface Channel {
  id: string;
  group: string;
  name: string;
  topic: string;
  unread?: boolean;
  mentions?: number;
  messages: MessageData[];
}

/** Keyed by id; message text can @mention these ids. */
export const USERS: ChatUsers = {
  ada: { name: 'Ada', c: '#0A84FF', role: '#7EB6FF' },
  miles: { name: 'Miles', c: '#BF5AF2', role: '#D8A9F0' },
  noor: { name: 'Noor', c: '#FF9F0A', role: '#FFC46B' },
  theo: { name: 'Theo', c: '#32D74B', role: '#8CE8A5' },
  stitch: { name: 'Stitch', c: '#5E5CE6', role: '#A6A5F2', bot: true },
};

/** The signed-in user. */
export const ME = 'ada';

export const PRESENCE: Record<string, ChatPresence> = {
  ada: 'online',
  miles: 'idle',
  noor: 'online',
  theo: 'offline',
  stitch: 'online',
};

export const WORKSPACES = [
  { id: 'blui', label: 'T', title: 'BL UI HQ' },
  { id: 'creamery', label: 'C', color: '#BF5AF2', title: 'Creamery' },
];

const r = (emoji: string, count: number, mine = false): Reaction => ({ emoji, count, mine });

export const CHANNELS: Channel[] = [
  {
    id: 'general',
    group: 'Team',
    name: 'general',
    topic: 'Company-wide chatter and announcements',
    messages: [
      { id: 'g1', user: 'noor', time: '9:12 AM', text: 'Morning! Docs site is organized by atomic tiers now.', reactions: [r('🎉', 2)] },
      { id: 'g2', user: 'theo', time: '9:15 AM', text: 'Saw that — the Sidebar variants demo is really nice.', reactions: [] },
    ],
  },
  {
    id: 'dev',
    group: 'Team',
    name: 'dev',
    topic: 'Sidebar thread → full view · preview card → SideDrawer',
    unread: true,
    messages: [
      { id: 'd1', user: 'ada', time: '10:08 AM', text: "that's the evals one", reactions: [r('👍', 1)] },
      {
        id: 'd2',
        user: 'stitch',
        time: '10:08 AM',
        text: '@miles the QA evals bot responds to comments on eval-failure PRs. It updates the PR and reruns the eval.',
        reactions: [],
        thread: {
          title: 'eval PR prompts / comments',
          replies: [
            { id: 'd2t1', user: 'miles', time: '10:10 AM', text: "I didn't tag it 🤷 but ok — I won't comment on eval PRs then." },
            { id: 'd2t2', user: 'ada', time: '11:01 AM', text: "commenting is fine, it doesn't need to be tagged though" },
          ],
        },
      },
      {
        id: 'd3',
        user: 'ada',
        time: '11:45 AM',
        text: '@theo anecdotally I\'ve been seeing much better bugs — things like "I clicked this button and no sidebar opened", or "your bundle is 1.6MB, implement code splitting".',
        reactions: [r('🎉', 1), r('👍', 1, true)],
        thread: {
          title: 'More relevant bugs',
          replies: [
            { id: 'd3t1', user: 'theo', time: '12:02 PM', text: 'Yeah, it recommended I tree-shake the icon set — 40% smaller.' },
            { id: 'd3t2', user: 'ada', time: '12:04 PM', text: 'Testing and Network categories are getting more results too, not just Accessibility.' },
          ],
        },
      },
      {
        id: 'd4',
        user: 'theo',
        time: '11:49 AM',
        text: "Added an issue for the thing from GTM planning (if a repo is connected to an existing project, don't spawn a new instance) — hub/RQI-108. fyi @ada, assigned to you.",
        reactions: [],
        thread: {
          title: 'Repo connect spawning new project',
          replies: [
            { id: 'd4t1', user: 'theo', time: '11:49 AM', text: "Has the link to the customer's post in #general and their admin history." },
            { id: 'd4t2', user: 'ada', time: '12:33 PM', text: "I do remember when we discussed this a few weeks back — I think I didn't fully get the point you were raising. I do now 🙂" },
          ],
        },
      },
    ],
  },
  {
    id: 'design',
    group: 'Team',
    name: 'design',
    topic: 'Critique, motion studies, and pixels',
    messages: [
      { id: 's1', user: 'miles', time: '8:40 AM', text: 'Credenza height morph is buttery now — spring on transform, not layout.', reactions: [r('🙏', 1)] },
    ],
  },
  {
    id: 'ws-haptics',
    group: 'Workstreams',
    name: 'ws-haptics',
    topic: 'Taptic patterns across the kit',
    messages: [
      { id: 'h1', user: 'noor', time: 'Mon', text: 'A–Z index scrub now ticks per letter with Haptics.selection(). Repeats debounced.', reactions: [] },
    ],
  },
  {
    id: 'ws-docs',
    group: 'Workstreams',
    name: 'ws-docs',
    topic: 'The docs site and its live examples',
    unread: true,
    messages: [
      { id: 'w1', user: 'stitch', time: 'Tue', text: 'Nightly link check: 0 broken anchors across 26 pages.', reactions: [] },
    ],
  },
  {
    id: 'bot-alerts',
    group: 'Bots',
    name: 'bot-alerts',
    topic: 'Deploys and checks',
    messages: [
      { id: 'b1', user: 'stitch', time: '7:02 AM', text: 'Deploy blui-docs@4f21c9 → prod. 34s, all checks green.', reactions: [] },
    ],
  },
];

/** What the bot says back when you post (the demo's stand-in for a server). */
export const BOT_REPLY = { user: 'stitch', text: "Noted — I'll add that to today's digest." };
