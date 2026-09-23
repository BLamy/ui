/* ChatDemo — the reference composition from the ChatKit prototype (apps and the Pages story reuse it). */
import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from 'react';
import { cn, SideDrawer, type Appearance } from '@brett_lamy/ui';
import { Button } from 'react-aria-components';
import { ChannelList } from '../lib/channel-list';
import { ChatAvatar } from '../lib/chat-avatar';
import { ChatIcon, chatIconPaths } from '../lib/chat-icon';
import { ChatShell, useChatShell } from '../lib/chat-shell';
import {
  ChatUsersProvider,
  type ChatChannel,
  type ChatChannels,
  type ChatMessageData,
  type ChatUsers,
} from '../lib/chat-users';
import { Composer } from '../lib/composer';
import { kvib } from '../lib/kvib';
import { Message } from '../lib/message';
import { WorkspaceRail } from '../lib/workspace-rail';

const KP = chatIconPaths;

/* The chat tokens (`K` in lib/chat-tokens; --ck-* on ChatShell) as utilities. */
const SEP_BORDER = 'border-ck-sep';
const SEP_BG = 'bg-ck-sep';
const MUT = 'text-ck-mut';
const MUT3 = 'text-ck-mut3';
const ICON_BUTTON = 'grid cursor-pointer border-0 bg-transparent p-1';

export const USERS: ChatUsers = {
  ada: { name: 'Ada', c: '#0A84FF', role: '#7EB6FF' },
  miles: { name: 'Miles', c: '#BF5AF2', role: '#D8A9F0' },
  noor: { name: 'Noor', c: '#FF9F0A', role: '#FFC46B' },
  theo: { name: 'Theo', c: '#32D74B', role: '#8CE8A5' },
  stitch: { name: 'Stitch', c: '#5E5CE6', role: '#A6A5F2', bot: true },
};

export function seed(): ChatChannels {
  return {
    general: {
      section: 'Team',
      label: 'general',
      msgs: [
        { id: 'g1', u: 'noor', t: '9:12 AM', txt: 'Morning! Docs site is organized by atomic tiers now.', reacts: [['🎉', 2, false]] },
        { id: 'g2', u: 'theo', t: '9:15 AM', txt: 'Saw that — the Sidebar variants demo is really nice.', reacts: [] },
      ],
    },
    dev: {
      section: 'Team',
      label: 'dev',
      unread: true,
      msgs: [
        { id: 'd1', u: 'ada', t: '10:08 AM', txt: "that's the evals one", reacts: [['👍', 1, false]] },
        {
          id: 'd2', u: 'stitch', t: '10:08 AM',
          txt: '@miles the QA evals bot responds to comments on eval-failure PRs. It updates the PR and reruns the eval.',
          reacts: [],
          thread: {
            title: 'eval PR prompts / comments',
            msgs: [
              { id: 'd2t1', u: 'miles', t: '10:10 AM', txt: "I didn't tag it 🤷 but ok — I won't comment on eval PRs then." },
              { id: 'd2t2', u: 'ada', t: '11:01 AM', txt: "commenting is fine, it doesn't need to be tagged though" },
            ],
          },
        },
        {
          id: 'd3', u: 'ada', t: '11:45 AM',
          txt: '@theo anecdotally I\'ve been seeing much better bugs — things like "I clicked this button and no sidebar opened", or "your bundle is 1.6MB, implement code splitting".',
          reacts: [['🎉', 1, false], ['👍', 1, true]],
          thread: {
            title: 'More relevant bugs',
            msgs: [
              { id: 'd3t1', u: 'theo', t: '12:02 PM', txt: 'Yeah, it recommended I tree-shake the icon set — 40% smaller.' },
              { id: 'd3t2', u: 'ada', t: '12:04 PM', txt: 'Testing and Network categories are getting more results too, not just Accessibility.' },
            ],
          },
        },
        {
          id: 'd4', u: 'theo', t: '11:49 AM',
          txt: "Added an issue for the thing from GTM planning (if a repo is connected to an existing project, don't spawn a new instance) — hub/RQI-108. fyi @ada, assigned to you.",
          reacts: [],
          thread: {
            title: 'Repo connect spawning new project',
            msgs: [
              { id: 'd4t1', u: 'theo', t: '11:49 AM', txt: "Has the link to the customer's post in #general and their admin history." },
              { id: 'd4t2', u: 'ada', t: '12:33 PM', txt: "I do remember when we discussed this a few weeks back — I think I didn't fully get the point you were raising. I do now 🙂" },
            ],
          },
        },
      ],
    },
    design: {
      section: 'Team',
      label: 'design',
      msgs: [
        { id: 's1', u: 'miles', t: '8:40 AM', txt: 'Credenza height morph is buttery now — spring on transform, not layout.', reacts: [['🙏', 1, false]] },
      ],
    },
    'ws-haptics': {
      section: 'Workstreams',
      label: 'ws-haptics',
      msgs: [
        { id: 'h1', u: 'noor', t: 'Mon', txt: 'A–Z index scrub now ticks per letter with Haptics.selection(). Repeats debounced.', reacts: [] },
      ],
    },
    'ws-docs': {
      section: 'Workstreams',
      label: 'ws-docs',
      unread: true,
      msgs: [
        { id: 'w1', u: 'stitch', t: 'Tue', txt: 'Nightly link check: 0 broken anchors across 26 pages.', reacts: [] },
      ],
    },
    'bot-alerts': {
      section: 'Bots',
      label: 'bot-alerts',
      msgs: [
        { id: 'b1', u: 'stitch', t: '7:02 AM', txt: 'Deploy blui-docs@4f21c9 → prod. 34s, all checks green.', reacts: [] },
      ],
    },
  };
}

export interface ChatThreadState {
  id: string;
  mode: 'drawer' | 'full';
}

type ThreadState = ChatThreadState;

export interface ChatDemoProps {
  tint?: string;
  /** Light or dark palette. Defaults to the ambient `AppearanceProvider` value, else dark. */
  appearance?: Appearance;
  members?: boolean;
  /** thread open at mount — defaults to the prototype's `{id:'d4', mode:'drawer'}`; pass null for none */
  initialThread?: ChatThreadState | null;
  className?: string;
  style?: CSSProperties;
}

export function ChatDemo({
  tint = '#0A84FF',
  members: showMembers = true,
  initialThread = { id: 'd4', mode: 'drawer' },
  appearance,
  className,
  style,
}: ChatDemoProps) {
  const [chans, setChans] = useState<ChatChannels>(seed);
  const [cur, setCur] = useState('dev');
  const [thread, setThread] = useState<ThreadState | null>(initialThread);
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [cur, chans]);
  const ch = chans[cur];
  const upd = (fn: (c: ChatChannel) => ChatChannel) => setChans((c) => ({ ...c, [cur]: fn(c[cur]) }));
  const updMsg = (id: string, fn: (m: ChatMessageData) => ChatMessageData) =>
    upd((c) => ({ ...c, msgs: c.msgs.map((m) => (m.id === id ? fn(m) : m)) }));
  const react = (id: string, i: number) =>
    updMsg(id, (m) => {
      const r = m.reacts.map((x) => [...x] as [string, number, boolean]);
      if (i === -1) {
        const j = r.findIndex((x) => x[0] === '👍');
        if (j >= 0) i = j;
        else {
          r.push(['👍', 0, false]);
          i = r.length - 1;
        }
      }
      r[i][2] = !r[i][2];
      r[i][1] += r[i][2] ? 1 : -1;
      return { ...m, reacts: r.filter((x) => x[1] > 0) };
    });
  const startThread = (id: string) => {
    updMsg(id, (m) => ({
      ...m,
      thread: { title: m.txt.slice(0, 36) + (m.txt.length > 36 ? '…' : ''), msgs: [] },
    }));
    setThread({ id, mode: 'drawer' });
  };
  const sendMain = (txt: string) =>
    upd((c) => ({ ...c, msgs: [...c.msgs, { id: 'm' + Date.now(), u: 'ada', t: 'now', txt, reacts: [] }] }));
  const sendThread = (txt: string) =>
    thread &&
    updMsg(thread.id, (m) => ({
      ...m,
      thread: { ...m.thread!, msgs: [...m.thread!.msgs, { id: 't' + Date.now(), u: 'ada', t: 'now', txt }] },
    }));
  const thMsg = thread ? ch.msgs.find((m) => m.id === thread.id) ?? null : null;
  const threadBody = (mode: 'drawer' | 'full'): ReactNode =>
    !thMsg || !thMsg.thread ? null : (
      <div className={cn('mx-auto box-border flex h-full w-full flex-col font-ios', mode === 'full' ? 'max-w-[760px]' : 'max-w-none')}>
        <div className="ck-scroll min-h-0 flex-1 overflow-y-auto pt-1 pb-2.5">
          {mode === 'drawer' ? (
            <div className={cn('border-b px-4 pt-1.5 pb-3', SEP_BORDER)}>
              <div className="text-[16px] leading-[1.3] font-[750] text-ck-label">{thMsg.thread.title}</div>
              <div className={cn('mt-[3px] text-[11.5px]', MUT3)}>
                {/* One line: splitting the surrounding text into more nodes shifts its kerning. */}
                Started by <span className="ck-role font-semibold text-[color:var(--ck-role)]" style={{ '--ck-role': USERS[thMsg.u].role } as CSSProperties}>{USERS[thMsg.u].name}</span> in #{ch.label}
              </div>
            </div>
          ) : null}
          <div className="px-1 pt-2.5">
            <Message m={{ ...thMsg, thread: null }} tint={tint} onReact={react} onOpenThread={() => {}} onStartThread={() => {}} />
            {thMsg.thread.msgs.length > 0 && (
              <div className={cn('flex items-center gap-2 px-[18px] py-1.5 text-[10.5px]', MUT3)}>
                <span className={cn('h-px flex-1', SEP_BG)} />
                {thMsg.thread.msgs.length} {thMsg.thread.msgs.length === 1 ? 'reply' : 'replies'}
                <span className={cn('h-px flex-1', SEP_BG)} />
              </div>
            )}
            {thMsg.thread.msgs.map((m) => (
              <div key={m.id} className="animate-[ck-in_.2s_cubic-bezier(.32,.72,0,1)]">
                <Message m={{ ...m, reacts: [] }} tint={tint} onReact={() => {}} onOpenThread={() => {}} onStartThread={() => {}} />
              </div>
            ))}
            {!thMsg.thread.msgs.length && (
              <div className={cn('px-[18px] py-3.5 text-[12.5px]', MUT3)}>No replies yet — say something.</div>
            )}
          </div>
        </div>
        <div className="shrink-0 px-3 pb-3">
          <Composer placeholder={'Reply in "' + thMsg.thread.title + '"'} onSend={sendThread} tint={tint} autoFocus={mode === 'drawer'} />
        </div>
      </div>
    );
  return (
    <ChatUsersProvider users={USERS}>
      <ChatShell breakpoint={880} appearance={appearance} className={className} style={style}>
        <ChatShell.Rail>
          <WorkspaceRail tint={tint} />
        </ChatShell.Rail>
        <ChatShell.Nav>
          <ChannelNav
            chans={chans}
            cur={cur}
            tint={tint}
            onPick={(id, tid) => {
              setCur(id);
              setThread(tid ? { id: tid, mode: 'full' } : null);
            }}
          />
        </ChatShell.Nav>
        <ChatShell.Main>
          <ChannelMain
            ch={ch}
            tint={tint}
            members={showMembers}
            thread={thread}
            setThread={setThread}
            thMsg={thMsg}
            react={react}
            startThread={startThread}
            sendMain={sendMain}
            scrollRef={scrollRef}
            threadBody={threadBody}
          />
        </ChatShell.Main>
      </ChatShell>
    </ChatUsersProvider>
  );
}

/* ── Slot children read the shell with useChatShell() — no render props, no prop drilling ── */
export interface ChannelNavProps {
  chans: ChatChannels;
  cur: string;
  tint: string;
  onPick: (id: string, threadId?: string) => void;
}

export function ChannelNav({ chans, cur, tint, onPick }: ChannelNavProps) {
  const { compact, setNavOpen } = useChatShell();
  return (
    <ChannelList
      chans={chans}
      cur={cur}
      tint={tint}
      onClose={compact ? () => setNavOpen(false) : null}
      onPick={(id, tid) => {
        onPick(id, tid);
        setNavOpen(false);
      }}
    />
  );
}

export interface ChannelMainProps {
  ch: ChatChannel;
  tint: string;
  members?: boolean;
  thread: ThreadState | null;
  setThread: (t: ThreadState | null) => void;
  thMsg: ChatMessageData | null;
  react: (id: string, i: number) => void;
  startThread: (id: string) => void;
  sendMain: (txt: string) => void;
  scrollRef: RefObject<HTMLDivElement | null>;
  threadBody: (mode: 'drawer' | 'full') => ReactNode;
}

export function ChannelMain({
  ch,
  tint,
  members: showMembers,
  thread,
  setThread,
  thMsg,
  react,
  startThread,
  sendMain,
  scrollRef,
  threadBody,
}: ChannelMainProps) {
  const { w, compact, setNavOpen } = useChatShell();
  const fullThread = !!thMsg && thread?.mode === 'full';
  const drawerOpen = !!thMsg && thread?.mode === 'drawer';
  const drawerMode = w >= 1180 ? 'fixed' : 'overlay';
  const memberCol = showMembers && w >= 1320 && !drawerOpen && !fullThread;
  return (
    <Fragment>
      <div className="flex min-w-0 flex-1 flex-col" style={{ '--ck-tint': tint } as CSSProperties}>
        <div className={cn('flex h-[46px] shrink-0 items-center gap-[9px] border-b px-4', SEP_BORDER)}>
          {compact && (
            <Button
              onPress={() => {
                kvib([6]);
                setNavOpen(true);
              }}
              aria-label="Channels"
              className={cn(ICON_BUTTON, MUT)}
            >
              <ChatIcon d={KP.menu} size={17} sw={2} />
            </Button>
          )}
          {fullThread && thMsg?.thread ? (
            <Fragment>
              <Button
                onPress={() => {
                  kvib([5]);
                  setThread(null);
                }}
                className="flex shrink-0 cursor-pointer items-center gap-1 border-0 bg-transparent py-1 pr-1.5 pl-0 font-ios text-[13px] font-[650] text-[color:var(--ck-tint)]"
              >
                <ChatIcon d={KP.chev} size={13} className="rotate-180" />#{ch.label}
              </Button>
              <span className={cn('grid', MUT3)}>
                <ChatIcon d={KP.thread} size={14} />
              </span>
              <span className="flex-1 overflow-hidden text-[14px] font-[750] text-ellipsis whitespace-nowrap">{thMsg.thread.title}</span>
              <Button
                onPress={() => thread && setThread({ id: thread.id, mode: 'drawer' })}
                className={cn(
                  'shrink-0 cursor-pointer rounded-[8px] border bg-transparent px-2.5 py-1 font-ios text-[11.5px] font-semibold',
                  SEP_BORDER,
                  MUT,
                )}
              >
                Open as drawer
              </Button>
            </Fragment>
          ) : (
            <Fragment>
              <span className={cn('grid', MUT3)}>
                <ChatIcon d={KP.hash} size={15} sw={2.2} />
              </span>
              <span className="text-[14px] font-[750]">{ch.label}</span>
              <span className={cn('flex-1 overflow-hidden text-[11.5px] text-ellipsis whitespace-nowrap', MUT3)}>
                Sidebar thread → full view · preview card → SideDrawer
              </span>
              <Button
                onPress={() => kvib([5])}
                aria-label="Members"
                className={cn(ICON_BUTTON, memberCol ? 'text-[color:var(--ck-tint)]' : MUT3)}
              >
                <ChatIcon d={KP.people} size={16} />
              </Button>
            </Fragment>
          )}
        </div>
        {fullThread ? (
          <div className="min-h-0 flex-1">{threadBody('full')}</div>
        ) : (
          <Fragment>
            <div ref={scrollRef} className="ck-scroll relative min-h-0 flex-1 overflow-y-auto py-3">
              <div className="px-[18px] pb-2.5">
                <div className={cn('mb-2 grid size-10 place-items-center rounded-[12px] bg-ck-fill2', MUT)}>
                  <ChatIcon d={KP.hash} size={20} sw={2.2} />
                </div>
                <div className="text-[15.5px] font-[750]">Welcome to #{ch.label}</div>
                <div className={cn('mt-0.5 text-[12px]', MUT3)}>Hover a message to react or start a thread.</div>
              </div>
              <div className={cn('flex items-center gap-2 px-[18px] pt-1 pb-2 text-[10.5px] font-semibold', MUT3)}>
                <span className={cn('h-px flex-1', SEP_BG)} />August 12, 2026<span className={cn('h-px flex-1', SEP_BG)} />
              </div>
              {ch.msgs.map((m) => (
                <Message
                  key={m.id}
                  m={m}
                  tint={tint}
                  onReact={react}
                  onOpenThread={(id) => {
                    kvib([6]);
                    setThread({ id, mode: 'drawer' });
                  }}
                  onStartThread={startThread}
                />
              ))}
            </div>
            <div className="shrink-0 px-3.5 pb-3">
              <Composer placeholder={'Message #' + ch.label} onSend={sendMain} tint={tint} />
            </div>
          </Fragment>
        )}
      </div>
      {memberCol ? (
        <div className={cn('box-border w-[168px] shrink-0 border-l bg-ck-side p-3', SEP_BORDER)}>
          <div className={cn('mb-2 text-[10px] font-bold tracking-[.7px] uppercase', MUT3)}>
            Team — {Object.keys(USERS).length}
          </div>
          {Object.entries(USERS).map(([id, u]) => (
            <div key={id} className="flex items-center gap-2 py-1">
              <ChatAvatar user={u} size={24} square={u.bot} />
              <span
                className="ck-role flex-1 overflow-hidden text-[12.5px] font-semibold text-ellipsis whitespace-nowrap text-[color:var(--ck-role)]"
                style={{ '--ck-role': u.role } as CSSProperties}
              >
                {u.name}
              </span>
              {u.bot && (
                <span className="rounded-[4px] bg-[#5E5CE6] px-1 py-px text-[8.5px] font-extrabold text-white">APP</span>
              )}
            </div>
          ))}
        </div>
      ) : null}
      <SideDrawer mode={drawerMode} open={drawerOpen} onClose={() => setThread(null)} title="Thread" width={Math.min(360, w - 60)}>
        <div className="box-border h-full [--bl-label:var(--ck-label,#EDEDF2)] [--bl-label2:var(--ck-mut,rgba(235,235,245,.6))] [--bl-sep:var(--ck-sep,rgba(255,255,255,.07))]">
          {threadBody('drawer')}
        </div>
      </SideDrawer>
    </Fragment>
  );
}
