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
import { SideDrawer } from '@touchkit/ui';
import { ChannelList } from '../lib/channel-list';
import { ChatAvatar } from '../lib/chat-avatar';
import { ChatIcon, chatIconPaths } from '../lib/chat-icon';
import { ChatShell, useChatShell } from '../lib/chat-shell';
import { K, KEASE, KFONT } from '../lib/chat-tokens';
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
        { id: 'g1', u: 'noor', t: '9:12 AM', txt: 'Morning! Docs site now has every Beautiful UI primitive on its own page.', reacts: [['🎉', 2, false]] },
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
        { id: 'b1', u: 'stitch', t: '7:02 AM', txt: 'Deploy touchkit-docs@4f21c9 → prod. 34s, all checks green.', reacts: [] },
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
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          fontFamily: KFONT,
          maxWidth: mode === 'full' ? 760 : 'none',
          width: '100%',
          margin: '0 auto',
          boxSizing: 'border-box',
        }}
      >
        <div className="ck-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 0 10px' }}>
          {mode === 'drawer' ? (
            <div style={{ padding: '6px 16px 12px', borderBottom: '1px solid ' + K.sep }}>
              <div style={{ fontSize: 16, fontWeight: 750, color: K.label, lineHeight: 1.3 }}>{thMsg.thread.title}</div>
              <div style={{ fontSize: 11.5, color: K.mut3, marginTop: 3 }}>
                Started by <span style={{ color: USERS[thMsg.u].role, fontWeight: 600 }}>{USERS[thMsg.u].name}</span> in #{ch.label}
              </div>
            </div>
          ) : null}
          <div style={{ padding: '10px 4px 0' }}>
            <Message m={{ ...thMsg, thread: null }} tint={tint} onReact={react} onOpenThread={() => {}} onStartThread={() => {}} />
            {thMsg.thread.msgs.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 18px', fontSize: 10.5, color: K.mut3 }}>
                <span style={{ flex: 1, height: 1, background: K.sep }} />
                {thMsg.thread.msgs.length} {thMsg.thread.msgs.length === 1 ? 'reply' : 'replies'}
                <span style={{ flex: 1, height: 1, background: K.sep }} />
              </div>
            )}
            {thMsg.thread.msgs.map((m) => (
              <div key={m.id} style={{ animation: 'ck-in .2s ' + KEASE }}>
                <Message m={{ ...m, reacts: [] }} tint={tint} onReact={() => {}} onOpenThread={() => {}} onStartThread={() => {}} />
              </div>
            ))}
            {!thMsg.thread.msgs.length && (
              <div style={{ padding: '14px 18px', fontSize: 12.5, color: K.mut3 }}>No replies yet — say something.</div>
            )}
          </div>
        </div>
        <div style={{ flexShrink: 0, padding: '0 12px 12px' }}>
          <Composer placeholder={'Reply in "' + thMsg.thread.title + '"'} onSend={sendThread} tint={tint} autoFocus={mode === 'drawer'} />
        </div>
      </div>
    );
  return (
    <ChatUsersProvider users={USERS}>
      <ChatShell breakpoint={880} className={className} style={style}>
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
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '0 16px', height: 46, borderBottom: '1px solid ' + K.sep, flexShrink: 0 }}>
          {compact && (
            <button
              onClick={() => {
                kvib([6]);
                setNavOpen(true);
              }}
              aria-label="Channels"
              style={{ border: 0, background: 'none', color: K.mut, cursor: 'pointer', padding: 4, display: 'grid' }}
            >
              <ChatIcon d={KP.menu} size={17} sw={2} />
            </button>
          )}
          {fullThread && thMsg?.thread ? (
            <Fragment>
              <button
                onClick={() => {
                  kvib([5]);
                  setThread(null);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 4, border: 0, background: 'none', color: tint, fontSize: 13, fontWeight: 650, cursor: 'pointer', fontFamily: KFONT, padding: '4px 6px 4px 0', flexShrink: 0 }}
              >
                <ChatIcon d={KP.chev} size={13} style={{ transform: 'rotate(180deg)' }} />#{ch.label}
              </button>
              <span style={{ color: K.mut3, display: 'grid' }}>
                <ChatIcon d={KP.thread} size={14} />
              </span>
              <span style={{ fontSize: 14, fontWeight: 750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{thMsg.thread.title}</span>
              <button
                onClick={() => thread && setThread({ id: thread.id, mode: 'drawer' })}
                style={{ border: '1px solid ' + K.sep, background: 'none', color: K.mut, fontSize: 11.5, fontWeight: 600, borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontFamily: KFONT, flexShrink: 0 }}
              >
                Open as drawer
              </button>
            </Fragment>
          ) : (
            <Fragment>
              <span style={{ color: K.mut3, display: 'grid' }}>
                <ChatIcon d={KP.hash} size={15} sw={2.2} />
              </span>
              <span style={{ fontSize: 14, fontWeight: 750 }}>{ch.label}</span>
              <span style={{ fontSize: 11.5, color: K.mut3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                Sidebar thread → full view · preview card → SideDrawer
              </span>
              <button
                onClick={() => kvib([5])}
                aria-label="Members"
                style={{ border: 0, background: 'none', color: memberCol ? tint : K.mut3, cursor: 'pointer', padding: 4, display: 'grid' }}
              >
                <ChatIcon d={KP.people} size={16} />
              </button>
            </Fragment>
          )}
        </div>
        {fullThread ? (
          <div style={{ flex: 1, minHeight: 0 }}>{threadBody('full')}</div>
        ) : (
          <Fragment>
            <div ref={scrollRef} className="ck-scroll" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px 0', position: 'relative' }}>
              <div style={{ padding: '0 18px 10px' }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: K.fill2, display: 'grid', placeItems: 'center', color: K.mut, marginBottom: 8 }}>
                  <ChatIcon d={KP.hash} size={20} sw={2.2} />
                </div>
                <div style={{ fontSize: 15.5, fontWeight: 750 }}>Welcome to #{ch.label}</div>
                <div style={{ fontSize: 12, color: K.mut3, marginTop: 2 }}>Hover a message to react or start a thread.</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 18px 8px', fontSize: 10.5, color: K.mut3, fontWeight: 600 }}>
                <span style={{ flex: 1, height: 1, background: K.sep }} />August 12, 2026<span style={{ flex: 1, height: 1, background: K.sep }} />
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
            <div style={{ flexShrink: 0, padding: '0 14px 12px' }}>
              <Composer placeholder={'Message #' + ch.label} onSend={sendMain} tint={tint} />
            </div>
          </Fragment>
        )}
      </div>
      {memberCol ? (
        <div style={{ width: 168, flexShrink: 0, borderLeft: '1px solid ' + K.sep, background: K.side, padding: '12px 12px', boxSizing: 'border-box' }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.7px', textTransform: 'uppercase', color: K.mut3, marginBottom: 8 }}>
            Team — {Object.keys(USERS).length}
          </div>
          {Object.entries(USERS).map(([id, u]) => (
            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
              <ChatAvatar user={u} size={24} square={u.bot} />
              <span style={{ fontSize: 12.5, color: u.role, fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
              {u.bot && (
                <span style={{ fontSize: 8.5, fontWeight: 800, background: '#5E5CE6', color: '#fff', borderRadius: 4, padding: '1px 4px' }}>APP</span>
              )}
            </div>
          ))}
        </div>
      ) : null}
      <SideDrawer mode={drawerMode} open={drawerOpen} onClose={() => setThread(null)} title="Thread" width={Math.min(360, w - 60)}>
        <div style={{ '--tk-label': K.label, '--tk-label2': K.mut, '--tk-sep': K.sep, height: '100%', boxSizing: 'border-box' } as CSSProperties}>
          {threadBody('drawer')}
        </div>
      </SideDrawer>
    </Fragment>
  );
}
