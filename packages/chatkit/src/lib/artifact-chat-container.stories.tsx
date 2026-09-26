import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppearanceProvider, BLProvider, type Appearance } from '@brett_lamy/ui';
import {
  Composer,
  ComposerAttach,
  ComposerAttachments,
  ComposerCard,
  ComposerExpand,
  ComposerFooter,
  ComposerInput,
  ComposerSend,
  ComposerSpacer,
} from '@brett_lamy/workbench';
import '@brett_lamy/workbench/styles.css';
import { ArtifactChatContainer, type ArtifactChatFabPosition } from './artifact-chat-container';
import { K, KFONT } from './chat-tokens';
import '../styles.css';

/* The chat composer: the Workbench Composer parts, trimmed to editor + send. */
function ChatComposer({ placeholder, onSubmit }: { placeholder: string; onSubmit?: () => void }) {
  return (
    <Composer onSubmit={onSubmit}>
      <ComposerCard>
        <ComposerExpand />
        <ComposerAttachments />
        <ComposerInput placeholder={placeholder} />
        <ComposerFooter>
          <ComposerAttach />
          <ComposerSpacer />
          <ComposerSend />
        </ComposerFooter>
      </ComposerCard>
    </Composer>
  );
}

interface DemoProps {
  width: number;
  height: number;
  working?: boolean;
  defaultChatOpen?: boolean;
  fabPosition?: ArtifactChatFabPosition;
}

function Transcript() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto', padding: '18px 18px 14px', background: K.bg, color: K.label }}>
      {[
        ['You', 'Can you compare the conversion rate by region?'],
        ['BL UI', 'I added the regional breakdown to the artifact. West is leading at 34%.'],
        ['You', 'Which region moved the most against last month?'],
        ['BL UI', 'Northeast — up 6.1 points. I highlighted it in the chart.'],
        ['You', 'Call out the biggest change from last month.'],
      ].map(([author, copy], index) => (
        <div key={copy} style={{ marginBottom: 18, marginTop: index === 0 ? 'auto' : undefined }}>
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
      {/* Runs behind the floating overlay so its translucency reads against real content. */}
      <div style={{ marginTop: 16, border: '1px solid #E1E3E8', borderRadius: 14, background: '#fff', overflow: 'hidden' }}>
        {[['Northeast', '34.1%', '+6.1'], ['West', '31.8%', '+2.4'], ['Midwest', '27.2%', '-0.8'], ['South', '24.6%', '+1.2'], ['Mountain', '22.9%', '+0.4']].map(([region, rate, delta], index) => (
          <div key={region} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', borderTop: index ? '1px solid #EEF0F4' : 0, fontSize: 13.5 }}>
            <span style={{ flex: 1 }}>{region}</span>
            <strong>{rate}</strong>
            <span style={{ width: 46, textAlign: 'right', color: delta.startsWith('-') ? '#C7362F' : '#1B873F' }}>{delta}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Demo({ width, height, working = false, defaultChatOpen = false, fabPosition = 'bottom-center' }: DemoProps) {
  const [busy, setBusy] = useState(working);
  return (
    <div style={{ width, height, overflow: 'hidden', fontFamily: KFONT }}>
      <ArtifactChatContainer
        breakpoint={760}
        working={busy}
        workingLabel="Working on the artifact…"
        onAdd={() => setBusy(false)}
        defaultChatOpen={defaultChatOpen}
        fabPosition={fabPosition}
      >
        <ArtifactChatContainer.Chat><Transcript /></ArtifactChatContainer.Chat>
        <ArtifactChatContainer.Composer>
          <div style={{ padding: 8, background: 'transparent' }}>
            <ChatComposer placeholder="Do anything" onSubmit={() => setBusy(true)} />
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
  parameters: {
    docs: {
      description: {
        component: 'Composes the Workbench Composer parts. In compact mode the transcript hangs off a draggable top bump of the composer: drag its handle up to reveal the full chat, down to collapse it or fold it into a FAB.',
      },
    },
  },
  argTypes: {
    fabPosition: {
      control: 'select',
      options: ['top-left', 'top-center', 'top-right', 'center-left', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'],
    },
  },
};
export default meta;
type Story = StoryObj<DemoProps>;

export const Split: Story = { args: { width: 1100, height: 680 } };
export const FloatingComposer: Story = { args: { width: 430, height: 720 } };
export const FullChatDrawer: Story = { args: { width: 430, height: 720, defaultChatOpen: true } };
export const Working: Story = { args: { width: 430, height: 720, working: true } };
/** Resize across the breakpoint: the chat column becomes the floating chat and back, as the same composer and
    transcript (type a draft first — it survives the switch). */
function ResponsiveDemo() {
  const [wide, setWide] = useState(true);
  return (
    <div style={{ fontFamily: KFONT }}>
      <button data-testid="toggle-width" onClick={() => setWide((w) => !w)} style={{ margin: 8, padding: '6px 12px' }}>
        {wide ? 'Narrow (floating)' : 'Wide (split)'}
      </button>
      <div style={{ width: wide ? 1100 : 560, height: 640, overflow: 'hidden' }}>
        <ArtifactChatContainer breakpoint={760}>
          <ArtifactChatContainer.Chat><Transcript /></ArtifactChatContainer.Chat>
          <ArtifactChatContainer.Composer>
            <div style={{ padding: 8, background: 'transparent' }}>
              <ChatComposer placeholder="Do anything" />
            </div>
          </ArtifactChatContainer.Composer>
          <ArtifactChatContainer.Content><Artifact /></ArtifactChatContainer.Content>
        </ArtifactChatContainer>
      </div>
    </div>
  );
}
export const SplitToFloating: Story = { render: () => <ResponsiveDemo /> };
/** `layout="floating"` with a `peek` keeps the newest replies visible above the composer even in a wide container. */
export const AlwaysFloatingWithPeek: Story = {
  args: { width: 1100, height: 680 },
  render: (args) => (
    <div style={{ width: args.width, height: args.height, overflow: 'hidden', fontFamily: KFONT }}>
      <ArtifactChatContainer layout="floating" peek={180}>
        <ArtifactChatContainer.Chat><Transcript /></ArtifactChatContainer.Chat>
        <ArtifactChatContainer.Composer>
          <div style={{ padding: 8, background: 'transparent' }}>
            <ChatComposer placeholder="Do anything" />
          </div>
        </ArtifactChatContainer.Composer>
        <ArtifactChatContainer.Content><Artifact /></ArtifactChatContainer.Content>
      </ArtifactChatContainer>
    </div>
  ),
};

/* ── Appearance: the container follows an ambient AppearanceProvider. The transcript and artifact below are
   token-driven (--bl-*), as a host's would be; BLProvider follows the same ambient value. */
function ThemedTranscript() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto', padding: '18px 18px 14px', color: 'var(--bl-label)' }}>
      {[
        ['You', 'Can you compare the conversion rate by region?'],
        ['BL UI', 'I added the regional breakdown to the artifact. West is leading at 34%.'],
        ['You', 'Which region moved the most against last month?'],
        ['BL UI', 'Northeast — up 6.1 points. I highlighted it in the chart.'],
      ].map(([author, copy], index) => (
        <div key={copy} style={{ marginBottom: 18, marginTop: index === 0 ? 'auto' : undefined }}>
          <div style={{ color: index % 2 ? 'var(--bl-tint)' : 'var(--bl-label2)', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{author}</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{copy}</div>
        </div>
      ))}
    </div>
  );
}

function ThemedArtifact() {
  const card = { background: 'var(--bl-card)', border: '1px solid var(--bl-sep)', borderRadius: 14 };
  return (
    <div style={{ minHeight: '100%', padding: 28, boxSizing: 'border-box', background: 'var(--bl-bg2)', color: 'var(--bl-label)' }}>
      <div style={{ color: 'var(--bl-label2)', fontSize: 12, fontWeight: 700, letterSpacing: '.08em' }}>LIVE ARTIFACT</div>
      <h1 style={{ fontSize: 28, margin: '8px 0 24px' }}>Quarterly performance</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 12 }}>
        {['Revenue\n$1.84M', 'Conversion\n28.4%', 'Retention\n91.2%'].map((value) => {
          const [label, metric] = value.split('\n');
          return <div key={label} style={{ ...card, padding: 18 }}>
            <div style={{ color: 'var(--bl-label2)', fontSize: 12 }}>{label}</div><strong style={{ display: 'block', fontSize: 22, marginTop: 8 }}>{metric}</strong>
          </div>;
        })}
      </div>
      <div style={{ ...card, height: 230, marginTop: 16, padding: 18 }}>
        <strong>Conversion by region</strong>
        <div style={{ height: 170, display: 'flex', alignItems: 'end', gap: 18, padding: '14px 10px 0' }}>
          {[58, 92, 72, 48, 82].map((height, index) => <div key={index} style={{ flex: 1, height: `${height}%`, minWidth: 18, borderRadius: '7px 7px 2px 2px', background: index === 1 ? 'var(--bl-tint)' : 'var(--bl-fill2)' }} />)}
        </div>
      </div>
    </div>
  );
}

function ThemedDemo({ appearance, width, height, layout }: { appearance: Appearance; width: number; height: number; layout?: 'split' | 'floating' }) {
  return (
    <AppearanceProvider value={appearance}>
      <div style={{ width, height, overflow: 'hidden', fontFamily: KFONT }}>
        <BLProvider>
          <ArtifactChatContainer layout={layout} peek={layout === 'floating' ? 150 : 0}>
            <ArtifactChatContainer.Chat><ThemedTranscript /></ArtifactChatContainer.Chat>
            <ArtifactChatContainer.Composer>
              <div style={{ padding: 8, background: 'transparent' }}>
                <ChatComposer placeholder="Do anything" />
              </div>
            </ArtifactChatContainer.Composer>
            <ArtifactChatContainer.Content><ThemedArtifact /></ArtifactChatContainer.Content>
          </ArtifactChatContainer>
        </BLProvider>
      </div>
    </AppearanceProvider>
  );
}

export const AppearanceLight: Story = { args: { width: 1100, height: 680 }, render: (a) => <ThemedDemo appearance="light" width={a.width} height={a.height} /> };
export const AppearanceDark: Story = { args: { width: 1100, height: 680 }, render: (a) => <ThemedDemo appearance="dark" width={a.width} height={a.height} /> };
/** The floating glass chat in both appearances, side by side. */
export const AppearanceFloating: Story = {
  args: { width: 430, height: 720 },
  render: (a) => (
    <div style={{ display: 'flex', gap: 16 }}>
      <ThemedDemo appearance="light" width={a.width} height={a.height} layout="floating" />
      <ThemedDemo appearance="dark" width={a.width} height={a.height} layout="floating" />
    </div>
  ),
};
