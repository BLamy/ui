import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ArtifactChatContainer } from './artifact-chat-container';
import { Composer } from './composer';
import { K, KFONT } from './chat-tokens';
import '../styles.css';

interface DemoProps {
  width: number;
  height: number;
  working?: boolean;
  defaultChatOpen?: boolean;
}

function Transcript() {
  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 18, background: K.bg, color: K.label }}>
      <div style={{ fontWeight: 750, fontSize: 15, marginBottom: 22 }}>Artifact chat</div>
      {[
        ['You', 'Can you compare the conversion rate by region?'],
        ['TouchKit', 'I added the regional breakdown to the artifact. West is leading at 34%.'],
        ['You', 'Call out the biggest change from last month.'],
      ].map(([author, copy], index) => (
        <div key={copy} style={{ marginBottom: 18 }}>
          <div style={{ color: index % 2 ? '#68A7FF' : K.mut, fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{author}</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{copy}</div>
        </div>
      ))}
    </div>
  );
}

function Artifact() {
  return (
    <div style={{ minHeight: '100%', padding: 28, boxSizing: 'border-box', background: '#F6F7FA', color: '#15161A' }}>
      <div style={{ color: '#767A84', fontSize: 12, fontWeight: 700, letterSpacing: '.08em' }}>LIVE ARTIFACT</div>
      <h1 style={{ fontSize: 28, margin: '8px 0 24px' }}>Quarterly performance</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12 }}>
        {['Revenue\n$1.84M', 'Conversion\n28.4%', 'Retention\n91.2%'].map((value) => {
          const [label, metric] = value.split('\n');
          return <div key={label} style={{ background: '#fff', border: '1px solid #E1E3E8', borderRadius: 14, padding: 18 }}>
            <div style={{ color: '#777B84', fontSize: 12 }}>{label}</div><strong style={{ display: 'block', fontSize: 22, marginTop: 8 }}>{metric}</strong>
          </div>;
        })}
      </div>
      <div style={{ height: 230, marginTop: 16, padding: 18, border: '1px solid #E1E3E8', borderRadius: 14, background: '#fff' }}>
        <strong>Conversion by region</strong>
        <div style={{ height: 170, display: 'flex', alignItems: 'end', gap: 18, padding: '14px 10px 0' }}>
          {[58, 92, 72, 48, 82].map((height, index) => <div key={index} style={{ flex: 1, height: `${height}%`, minWidth: 18, borderRadius: '7px 7px 2px 2px', background: index === 1 ? '#0A84FF' : '#B7D7FF' }} />)}
        </div>
      </div>
    </div>
  );
}

function Demo({ width, height, working = false, defaultChatOpen = false }: DemoProps) {
  const [busy, setBusy] = useState(working);
  return (
    <div style={{ width, height, overflow: 'hidden', fontFamily: KFONT }}>
      <ArtifactChatContainer
        breakpoint={760}
        working={busy}
        workingLabel="Working on the artifact…"
        onAdd={() => setBusy(false)}
        defaultChatOpen={defaultChatOpen}
      >
        <ArtifactChatContainer.Chat><Transcript /></ArtifactChatContainer.Chat>
        <ArtifactChatContainer.Composer>
          <div style={{ padding: 8, background: 'transparent' }}>
            <Composer tint="#0A84FF" placeholder="Ask about this artifact" onSend={() => setBusy(true)} />
          </div>
        </ArtifactChatContainer.Composer>
        <ArtifactChatContainer.Content><Artifact /></ArtifactChatContainer.Content>
      </ArtifactChatContainer>
    </div>
  );
}

const meta: Meta<DemoProps> = {
  title: 'Templates/ArtifactChatContainer',
  render: (args) => <Demo {...args} />,
};
export default meta;
type Story = StoryObj<DemoProps>;

export const Split: Story = { args: { width: 1100, height: 680 } };
export const FloatingComposer: Story = { args: { width: 430, height: 720 } };
export const FullChatDrawer: Story = { args: { width: 430, height: 720, defaultChatOpen: true } };
export const Working: Story = { args: { width: 430, height: 720, working: true } };
