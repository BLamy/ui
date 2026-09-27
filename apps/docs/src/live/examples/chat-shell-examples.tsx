/* ChatShell page — the Discord-style rail on its own (tiles morph circle → squircle, the pill grows from a
   nub to full), and a hand-rolled compact composition driving the drawer through useChatShell. */
import { useState } from 'react';
import { ChatShell, WorkspaceRail, useChatShell, useAppearance, type Workspace } from '@brett_lamy/ui';
import type { LiveSpec } from '../frame';

const WORKSPACES: Workspace[] = [
  { id: 'blui', label: 'B', color: '#0A84FF', title: 'BL UI HQ', active: true },
  { id: 'creamery', label: 'C', color: '#BF5AF2', title: 'Creamery', unread: true },
  { id: 'lab', label: 'L', color: '#30D158', title: 'Motion Lab', mentions: 3 },
  { id: 'ops', label: 'O', color: '#FF9F0A', title: 'Ops', unread: true },
];

const railCode = `import { WorkspaceRail } from '@brett_lamy/ui'

// Hover a tile: it rounds from a circle to a squircle and the pill on its edge grows from the
// unread nub. Select one: the pill runs full height on a springy curve. Arrow keys move between tiles.
export default function Rail() {
  return (
    <WorkspaceRail
      home={{ unread: true }}
      workspaces={[
        { id: 'blui', label: 'B', color: '#0A84FF', title: 'BL UI HQ', active: true },
        { id: 'creamery', label: 'C', color: '#BF5AF2', title: 'Creamery', unread: true },
        { id: 'lab', label: 'L', color: '#30D158', title: 'Motion Lab', mentions: 3 },
      ]}
      onAdd={() => {}}
    />
  )
}`;

const composeCode = `import { ChatShell, WorkspaceRail, useChatShell } from '@brett_lamy/ui'

function Header() {
  const { compact, setNavOpen } = useChatShell()
  return compact ? <button onClick={() => setNavOpen(true)}>☰</button> : null
}

// A hand-rolled shell: below the breakpoint the rail and channels move into a drawer that
// slides in over a scrim, and the header's hamburger opens it.
export default function Chat() {
  return (
    <ChatShell breakpoint={880}>
      <ChatShell.Rail><WorkspaceRail /></ChatShell.Rail>
      <ChatShell.Nav><Channels /></ChatShell.Nav>
      <ChatShell.Main><Header /><Conversation /></ChatShell.Main>
    </ChatShell>
  )
}`;

function Channels({ current, onPick }: { current: string; onPick: (c: string) => void }) {
  const { setNavOpen } = useChatShell();
  return (
    <nav style={{ width: 200, padding: '14px 10px', boxSizing: 'border-box', background: 'var(--ck-side, #16161c)', borderRight: '1px solid var(--ck-sep)' }}>
      <div style={{ fontSize: 13, fontWeight: 800, padding: '0 8px 10px' }}>Motion Lab</div>
      {['general', 'springs', 'morphs', 'haptics'].map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => {
            onPick(c);
            setNavOpen(false);
          }}
          style={{
            display: 'block', width: '100%', textAlign: 'left', border: 0, borderRadius: 7, padding: '6px 8px', font: 'inherit', fontSize: 13.5, cursor: 'pointer',
            background: current === c ? 'var(--ck-fill2)' : 'transparent', color: current === c ? 'var(--ck-label)' : 'var(--ck-mut)',
          }}
        >
          # {c}
        </button>
      ))}
    </nav>
  );
}

function Main({ channel }: { channel: string }) {
  const { compact, setNavOpen } = useChatShell();
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid var(--ck-sep)', fontWeight: 700 }}>
        {compact ? (
          <button type="button" aria-label="Open navigation" onClick={() => setNavOpen(true)} style={{ border: 0, background: 'transparent', color: 'inherit', fontSize: 18, cursor: 'pointer' }}>☰</button>
        ) : null}
        # {channel}
      </div>
      <div style={{ flex: 1, padding: 16, display: 'grid', alignContent: 'end', gap: 10, fontSize: 13.5, color: 'var(--ck-mut)' }}>
        <div>Springs everywhere: interruptible, velocity-preserving.</div>
        <div style={{ color: 'var(--ck-label)' }}>The drawer should slide in over a scrim, not teleport.</div>
      </div>
    </div>
  );
}

export const CHAT_SHELL_EXAMPLES: Record<string, LiveSpec> = {
  chatshell_rail: {
    title: 'WorkspaceRail · the pill and tile morph', theme: 'bl', h: 330,
    code: railCode,
    Render: function RailLive() {
      const appearance = useAppearance() === 'light' ? 'light' : 'dark';
      return (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ height: 300, display: 'flex', borderRadius: 12, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px var(--bl-sep)' }}>
            <ChatShell appearance={appearance} breakpoint={0}>
              <ChatShell.Rail>
                <WorkspaceRail home={{ unread: true }} workspaces={WORKSPACES} onAdd={() => {}} />
              </ChatShell.Rail>
              <ChatShell.Main>
                <div style={{ width: 220, padding: 18, fontSize: 13, lineHeight: 1.5, color: 'var(--ck-mut)' }}>
                  Hover and select the tiles: corners and the pill spring between states.
                </div>
              </ChatShell.Main>
            </ChatShell>
          </div>
        </div>
      );
    },
  },
  chatshell_compose: {
    title: 'ChatShell · a hand-rolled compact composition', theme: 'bl', h: 480,
    code: composeCode,
    Render: function ComposeLive() {
      const [channel, setChannel] = useState('springs');
      const appearance = useAppearance() === 'light' ? 'light' : 'dark';
      return (
        <div style={{ width: 430, maxWidth: '100%', height: 440, margin: '0 auto', borderRadius: 12, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px var(--bl-sep)' }}>
          <ChatShell appearance={appearance} breakpoint={880}>
            <ChatShell.Rail>
              <WorkspaceRail workspaces={WORKSPACES} defaultSelectedKey="lab" />
            </ChatShell.Rail>
            <ChatShell.Nav>
              <Channels current={channel} onPick={setChannel} />
            </ChatShell.Nav>
            <ChatShell.Main>
              <Main channel={channel} />
            </ChatShell.Main>
          </ChatShell>
        </div>
      );
    },
  },
};
