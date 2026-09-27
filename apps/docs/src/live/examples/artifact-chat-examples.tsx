/* ArtifactChatContainer page — resizing across the breakpoint (the chat column becomes the floating sheet
   with the same composer and transcript), and an always-floating chat with a peek. Registered in live-core. */
import { useState, type ReactNode } from 'react';
import {
  ArtifactChatContainer, Composer, ComposerAttach, ComposerAttachments, ComposerCard, ComposerFooter, ComposerInput,
  ComposerSend, ComposerSpacer,
} from '@brett_lamy/ui';
import type { LiveSpec } from '../frame';

function Transcript() {
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '18px 18px 14px', background: 'var(--bl-card, #131318)', color: 'var(--bl-label, #EDEDF2)', display: 'flex', flexDirection: 'column' }}>
      {[['You', 'Compare conversion by region.'], ['BL UI', 'Added the regional breakdown — West leads at 34%.'], ['You', 'Which region moved most?'], ['BL UI', 'Northeast, up 6.1 points. Highlighted in the chart.']].map(([who, text], i) => (
        <div key={text} style={{ marginBottom: 16, marginTop: i === 0 ? 'auto' : undefined }}>
          <div style={{ color: i % 2 ? 'var(--bl-tint)' : 'var(--bl-label2)', fontSize: 11, fontWeight: 700 }}>{who}</div>
          <div style={{ fontSize: 13, lineHeight: 1.5, marginTop: 3 }}>{text}</div>
        </div>
      ))}
    </div>
  );
}

function Artifact({ title = 'Quarterly performance' }: { title?: string }) {
  return (
    <div style={{ minHeight: '100%', boxSizing: 'border-box', padding: 22, background: '#F6F7FA', color: '#15161A' }}>
      <div style={{ color: '#777B84', fontSize: 11, fontWeight: 750, letterSpacing: '.08em' }}>LIVE ARTIFACT</div>
      <h2 style={{ fontSize: 24, margin: '8px 0 18px' }}>{title}</h2>
      <div style={{ height: 200, border: '1px solid #E1E3E8', borderRadius: 13, padding: 16, background: '#fff', display: 'flex', alignItems: 'end', gap: 12 }}>
        {[55, 92, 68, 44, 78].map((h, i) => <div key={i} style={{ flex: 1, height: `${h}%`, borderRadius: '6px 6px 2px 2px', background: i === 1 ? '#0A84FF' : '#B7D7FF' }} />)}
      </div>
    </div>
  );
}

function ChatComposer({ placeholder = 'Do anything', onSubmit }: { placeholder?: string; onSubmit?: () => void }) {
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
  );
}

function Frame({ width, children }: { width: number; children: ReactNode }) {
  return (
    <div style={{ width, maxWidth: '100%', height: 480, margin: '0 auto', borderRadius: 12, overflow: 'hidden', boxShadow: 'inset 0 0 0 1px var(--bl-sep)' }}>
      {children}
    </div>
  );
}

const resizeCode = `import { ArtifactChatContainer, Composer, ComposerCard, ComposerInput, ComposerFooter,
  ComposerSpacer, ComposerSend } from '@brett_lamy/ui'

// Resize across the breakpoint. The composer and the transcript are rendered once and move between the
// docked column and the floating sheet — a half-typed draft survives — and the composer flies to its new
// place while the column slides away and the artifact grows into the room.
export default function Workspace() {
  return (
    <ArtifactChatContainer breakpoint={620}>
      <ArtifactChatContainer.Chat><Conversation /></ArtifactChatContainer.Chat>
      <ArtifactChatContainer.Composer>
        <Composer onSubmit={send}>
          <ComposerCard>
            <ComposerInput placeholder="Do anything" />
            <ComposerFooter><ComposerSpacer /><ComposerSend /></ComposerFooter>
          </ComposerCard>
        </Composer>
      </ArtifactChatContainer.Composer>
      <ArtifactChatContainer.Content><Artifact /></ArtifactChatContainer.Content>
    </ArtifactChatContainer>
  )
}`;

const peekCode = `import { ArtifactChatContainer } from '@brett_lamy/ui'

// Always floating, with the newest replies peeking above the composer. While \`working\`, the card becomes
// a status pill; tapping it (or dragging the chat open) brings the composer back.
export default function MapWorkspace() {
  return (
    <ArtifactChatContainer layout="floating" peek={140} working={working} onAdd={() => setWorking(false)}
      workingLabel="Updating the chart…">
      <ArtifactChatContainer.Chat><Conversation /></ArtifactChatContainer.Chat>
      <ArtifactChatContainer.Composer><ChatComposer /></ArtifactChatContainer.Composer>
      <ArtifactChatContainer.Content><Artifact /></ArtifactChatContainer.Content>
    </ArtifactChatContainer>
  )
}`;

export const ARTIFACT_CHAT_EXAMPLES: Record<string, LiveSpec> = {
  artifact_resize: {
    title: 'ArtifactChatContainer · resize across the breakpoint', theme: 'bl', h: 560,
    code: resizeCode,
    Render: function ResizeLive() {
      const [width, setWidth] = useState(670);
      return (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', margin: '0 0 10px', fontSize: 12.5, color: 'var(--bl-label2)' }}>
            <span>Width</span>
            <input aria-label="Container width" type="range" min={380} max={670} step={10} value={width} onChange={(e) => setWidth(Number(e.currentTarget.value))} style={{ width: 220 }} />
            <span style={{ fontVariantNumeric: 'tabular-nums', width: 120, whiteSpace: 'nowrap' }}>{width}px · {width < 620 ? "floating" : "split"}</span>
          </div>
          <Frame width={width}>
            <ArtifactChatContainer breakpoint={620} chatWidth={280}>
              <ArtifactChatContainer.Chat><Transcript /></ArtifactChatContainer.Chat>
              <ArtifactChatContainer.Composer><ChatComposer placeholder="Type a draft, then drag the slider" /></ArtifactChatContainer.Composer>
              <ArtifactChatContainer.Content><Artifact /></ArtifactChatContainer.Content>
            </ArtifactChatContainer>
          </Frame>
        </div>
      );
    },
  },
  artifact_peek: {
    title: 'ArtifactChatContainer · always floating, peeking', theme: 'bl', h: 540,
    code: peekCode,
    Render: function PeekLive() {
      const [working, setWorking] = useState(false);
      return (
        <div>
          <Frame width={430}>
            <ArtifactChatContainer layout="floating" peek={140} working={working} onAdd={() => setWorking(false)} workingLabel="Updating the chart…">
              <ArtifactChatContainer.Chat><Transcript /></ArtifactChatContainer.Chat>
              <ArtifactChatContainer.Composer><ChatComposer onSubmit={() => setWorking(true)} /></ArtifactChatContainer.Composer>
              <ArtifactChatContainer.Content><Artifact title="Regional chart" /></ArtifactChatContainer.Content>
            </ArtifactChatContainer>
          </Frame>
          <div style={{ textAlign: 'center', marginTop: 8, fontSize: 12, color: 'var(--bl-label2)' }}>
            Send a message to see the working pill; drag the grip up with a flick to open the chat, down past rest to fold it into the FAB.
          </div>
        </div>
      );
    },
  },
};
