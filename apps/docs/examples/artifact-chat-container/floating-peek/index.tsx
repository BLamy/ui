import { useState, type ReactNode } from 'react'
import {
  ArtifactChatContainer,
  Composer,
  ComposerAttach,
  ComposerAttachments,
  ComposerCard,
  ComposerFooter,
  ComposerInput,
  ComposerSend,
  ComposerSpacer,
} from '@brett_lamy/ui'

const messages = [
  ['You', 'Compare conversion by region.'],
  ['BL UI', 'Added the regional breakdown — West leads at 34%.'],
  ['You', 'Which region moved most?'],
  ['BL UI', 'Northeast, up 6.1 points. Highlighted in the chart.'],
]

function Transcript() {
  return (
    <div
      style={{
        height: '100%',
        overflow: 'auto',
        padding: '18px 18px 14px',
        background: 'var(--card)',
        color: 'var(--foreground)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {messages.map(([who, text], i) => (
        <div
          key={text}
          style={{ marginBottom: 16, marginTop: i === 0 ? 'auto' : undefined }}
        >
          <div
            style={{
              color: i % 2 ? 'var(--primary)' : 'var(--muted-foreground)',
              fontSize: 11,
              fontWeight: 700,
            }}
          >
            {who}
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.5, marginTop: 3 }}>
            {text}
          </div>
        </div>
      ))}
    </div>
  )
}

function Artifact({ title = 'Quarterly performance' }: { title?: string }) {
  return (
    <div
      style={{
        minHeight: '100%',
        boxSizing: 'border-box',
        padding: 22,
        background: '#F6F7FA',
        color: '#15161A',
      }}
    >
      <div
        style={{
          color: '#777B84',
          fontSize: 11,
          fontWeight: 750,
          letterSpacing: '.08em',
        }}
      >
        LIVE ARTIFACT
      </div>
      <h2 style={{ fontSize: 24, margin: '8px 0 18px' }}>{title}</h2>
      <div
        style={{
          height: 200,
          border: '1px solid #E1E3E8',
          borderRadius: 13,
          padding: 16,
          background: '#fff',
          display: 'flex',
          alignItems: 'end',
          gap: 12,
        }}
      >
        {[55, 92, 68, 44, 78].map((h, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              height: `${h}%`,
              borderRadius: '6px 6px 2px 2px',
              background: i === 1 ? '#0A84FF' : '#B7D7FF',
            }}
          />
        ))}
      </div>
    </div>
  )
}

function ChatComposer({
  placeholder = 'Do anything',
  onSubmit,
}: {
  placeholder?: string
  onSubmit?: () => void
}) {
  return (
    <div style={{ padding: 8 }}>
      <Composer onSubmit={onSubmit}>
        <ComposerCard>
          <ComposerAttachments />
          <ComposerInput placeholder={placeholder} />
          <ComposerFooter>
            <ComposerAttach />
            <ComposerSpacer />
            <ComposerSend />
          </ComposerFooter>
        </ComposerCard>
      </Composer>
    </div>
  )
}

function Frame({ width, children }: { width: number; children: ReactNode }) {
  return (
    <div
      style={{
        width,
        maxWidth: '100%',
        height: 480,
        margin: '0 auto',
        borderRadius: 12,
        overflow: 'hidden',
        boxShadow: 'inset 0 0 0 1px var(--border)',
      }}
    >
      {children}
    </div>
  )
}

// Always floating, with the newest replies peeking above the composer. While
// `working`, the card becomes a status pill; tapping it (or dragging the chat
// open) brings the composer back.
export default function FloatingPeek() {
  const [working, setWorking] = useState(false)
  return (
    <div>
      <Frame width={430}>
        <ArtifactChatContainer
          layout="floating"
          peek={140}
          working={working}
          onAdd={() => setWorking(false)}
          workingLabel="Updating the chart…"
        >
          <ArtifactChatContainer.Chat>
            <Transcript />
          </ArtifactChatContainer.Chat>
          <ArtifactChatContainer.Composer>
            <ChatComposer onSubmit={() => setWorking(true)} />
          </ArtifactChatContainer.Composer>
          <ArtifactChatContainer.Content>
            <Artifact title="Regional chart" />
          </ArtifactChatContainer.Content>
        </ArtifactChatContainer>
      </Frame>
      <div
        style={{
          textAlign: 'center',
          marginTop: 8,
          fontSize: 12,
          color: 'var(--muted-foreground)',
        }}
      >
        Send a message to see the working pill; drag the grip up with a flick to
        open the chat, down past rest to fold it into the FAB.
      </div>
    </div>
  )
}
