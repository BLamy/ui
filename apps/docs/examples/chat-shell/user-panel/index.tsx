import type { ReactNode } from 'react'
import {
  ChatAvatar,
  ChatShell,
  UserPanel,
  UserPanelInfo,
  UserPanelName,
  UserPanelStatus,
  type ChatUser,
} from '@brett_lamy/ui'

const me: ChatUser = { name: 'Ada', c: '#0A84FF', role: '#7EB6FF' }

// A rounded, hairline-bordered window with the page background; `width` caps
// it, centered.
function Window({ width, children }: { width?: number; children: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: width,
        margin: '0 auto',
        borderRadius: 14,
        overflow: 'hidden',
        background: 'var(--bl-bg)',
        color: 'var(--bl-label)',
        boxShadow: '0 0 0 1px var(--bl-sep), 0 10px 30px rgba(0,0,0,.06)',
        isolation: 'isolate',
      }}
    >
      {children}
    </div>
  )
}

// The foot of the sidebar: who you are, your presence, and quick actions.
export default function Me() {
  return (
    <Window width={260}>
      <ChatShell style={{ height: 'auto' }}>
        <div style={{ flex: 1, background: 'var(--ck-side)' }}>
          <UserPanel>
            <ChatAvatar user={me} size={26} status="online" />
            <UserPanelInfo>
              <UserPanelName>Ada Lovelace</UserPanelName>
              <UserPanelStatus status="online" />
            </UserPanelInfo>
          </UserPanel>
        </div>
      </ChatShell>
    </Window>
  )
}
