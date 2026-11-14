import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { BLProvider } from '@/lib/theme';
import { Composer, ComposerCard, ComposerFooter, ComposerInput, ComposerSend, ComposerSpacer } from '@/components/ui/composer/composer';
import '../styles.css';
import {
  ArtifactChatContainer,
  ArtifactChatContainerChat,
  ArtifactChatContainerComposer,
  ArtifactChatContainerContent,
  type ArtifactChatContainerProps,
} from '@/components/ui/artifact-chat-container';

/* The chat composer: the Composer parts, trimmed to editor + send. */
function ChatComposer({ onSubmit }: { onSubmit?: () => void }) {
  return (
    <Composer onSubmit={onSubmit}>
      <ComposerCard>
        <ComposerInput placeholder="Do anything" />
        <ComposerFooter>
          <ComposerSpacer />
          <ComposerSend />
        </ComposerFooter>
      </ComposerCard>
    </Composer>
  );
}

const TURNS = [
  ['You', 'Can you compare the conversion rate by region?'],
  ['BL UI', 'I added the regional breakdown to the artifact. West is leading at 34%.'],
  ['You', 'Which region moved the most against last month?'],
  ['BL UI', 'Northeast — up 6.1 points. I highlighted it in the chart.'],
  ['You', 'Call out the biggest change from last month.'],
  ['BL UI', 'Northeast again: conversion rose from 28.0% to 34.1%, driven by the new onboarding flow.'],
] as const;

/* A token-driven transcript (as a host's would be): the newest turn at the bottom. */
function Transcript() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-auto px-4.5 pt-4.5 pb-3.5 text-foreground">
      {TURNS.map(([author, copy], index) => (
        <div key={copy} className={index === 0 ? 'mt-auto mb-4.5' : 'mb-4.5'}>
          <div className={index % 2 ? 'mb-1 text-caption font-bold text-primary' : 'mb-1 text-caption font-bold text-muted-foreground'}>{author}</div>
          <div className="text-subhead">{copy}</div>
        </div>
      ))}
    </div>
  );
}

/* A token-driven artifact, long enough to scroll behind the floating chat. */
function Artifact() {
  return (
    <div className="box-border min-h-full bg-muted p-7 text-foreground">
      <div className="text-caption font-bold tracking-wider text-muted-foreground uppercase">Live artifact</div>
      <h1 className="mt-2 mb-6 text-title font-bold">Quarterly performance</h1>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
        {[['Revenue', '$1.84M'], ['Conversion', '28.4%'], ['Retention', '91.2%']].map(([label, metric]) => (
          <div key={label} className="rounded-card border border-border bg-card p-4.5">
            <div className="text-caption text-muted-foreground">{label}</div>
            <strong className="mt-2 block text-title">{metric}</strong>
          </div>
        ))}
      </div>
      <div className="mt-4 h-[230px] rounded-card border border-border bg-card p-4.5">
        <strong>Conversion by region</strong>
        <div className="flex h-[170px] items-end gap-4.5 px-2.5 pt-3.5">
          {[58, 92, 72, 48, 82].map((height, index) => (
            <div key={index} className={index === 1 ? 'min-w-4.5 flex-1 rounded-t-md bg-primary' : 'min-w-4.5 flex-1 rounded-t-md bg-primary/30'} style={{ height: `${height}%` }} />
          ))}
        </div>
      </div>
      <div className="mt-4 overflow-hidden rounded-card border border-border bg-card">
        {[['Northeast', '34.1%', '+6.1'], ['West', '31.8%', '+2.4'], ['Midwest', '27.2%', '-0.8'], ['South', '24.6%', '+1.2'], ['Mountain', '22.9%', '+0.4'], ['Pacific', '21.7%', '+0.9']].map(([region, rate, delta], index) => (
          <div key={region} className={index ? 'flex items-center gap-3 border-t border-border px-4.5 py-3 text-subhead' : 'flex items-center gap-3 px-4.5 py-3 text-subhead'}>
            <span className="flex-1">{region}</span>
            <strong>{rate}</strong>
            <span className={delta.startsWith('-') ? 'w-12 text-right text-destructive' : 'w-12 text-right text-success'}>{delta}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type DemoProps = Partial<ArtifactChatContainerProps> & { frame?: 'desktop' | 'phone' };

/* The frame shrinks with the viewport (`w-full max-w-…`), so `--size 390x844` shows the container in a phone box and
   `layout="auto"` really floats there. */
function Demo({ frame = 'desktop', working: startWorking = false, ...props }: DemoProps) {
  const [busy, setBusy] = useState(startWorking);
  return (
    <BLProvider>
      <div className={frame === 'phone' ? 'h-[min(760px,100dvh)] w-full max-w-[430px] overflow-hidden' : 'h-[min(680px,100dvh)] w-full max-w-[1100px] overflow-hidden'}>
        <ArtifactChatContainer
          working={busy}
          workingLabel="Working on the artifact…"
          onComposingChange={(composing) => { if (composing) setBusy(false); }}
          {...props}
        >
          <ArtifactChatContainerContent><Artifact /></ArtifactChatContainerContent>
          <ArtifactChatContainerChat><Transcript /></ArtifactChatContainerChat>
          <ArtifactChatContainerComposer><ChatComposer onSubmit={() => setBusy(true)} /></ArtifactChatContainerComposer>
        </ArtifactChatContainer>
      </div>
    </BLProvider>
  );
}

const meta: Meta<DemoProps> = {
  title: 'Templates/ArtifactChatContainer',
  render: (args) => <Demo {...args} />,
  parameters: {
    docs: {
      description: {
        component:
          'The one chat shell: a chat column docked beside an artifact on a wide container, a FloatingSheet over it on a compact one (its body the transcript, its foot the composer). Drag the cap up for the whole chat, down past rest to fold it into the FAB.',
      },
    },
  },
  argTypes: {
    layout: { control: 'radio', options: ['auto', 'split', 'floating'] },
    chatSide: { control: 'radio', options: ['start', 'end'] },
    variant: { control: 'radio', options: ['glass', 'sheet'] },
    appearance: { control: 'radio', options: ['auto', 'light', 'dark'] },
    fabSide: { control: 'radio', options: ['top', 'bottom', 'start', 'end'] },
    fabAlign: { control: 'radio', options: ['start', 'center', 'end'] },
  },
};
export default meta;
type Story = StoryObj<DemoProps>;

/** Wide: the chat docks beside the artifact (it floats once the frame is under 760px wide). */
export const Split: Story = {};
/** Docked on the end edge, the way an assistant sits beside an app's page. */
export const SplitEnd: Story = { args: { chatSide: 'end', chatLabel: 'Assistant' } };
/** Compact: the chat floats over the artifact, resting on its composer. */
export const Floating: Story = { args: { frame: 'phone' } };
/** Floating with a peek: the newest replies stay readable above the composer. */
export const FloatingPeek: Story = { args: { frame: 'phone', peek: 180 } };
/** Grown over the artifact (drag the cap, press it, or Escape and the scrim to bring it back). */
export const FloatingGrown: Story = { args: { frame: 'phone', defaultOpen: true } };
/** Folded into its FAB (drag below rest to get here). */
export const FloatingFolded: Story = { args: { frame: 'phone', defaultMinimized: true } };
/** The agent is working: the composer is a tappable status until pressed. */
export const Working: Story = { args: { frame: 'phone', working: true, peek: 120 } };
/** The opaque `sheet` variant instead of glass. */
export const FloatingSheetVariant: Story = { name: 'Floating (sheet variant)', args: { frame: 'phone', variant: 'sheet', peek: 180 } };
/** `layout="floating"` floats the chat even on a wide container (maps, canvases). */
export const AlwaysFloating: Story = { args: { layout: 'floating', peek: 180 } };
/** A dark chat over a light page. */
export const DarkChatOnLightPage: Story = { args: { appearance: 'dark' } };

/** Resize across the breakpoint: the column becomes the floating chat and back, as the same composer and transcript
    (type a draft first: it survives the switch). */
function ResponsiveDemo() {
  const [wide, setWide] = useState(true);
  return (
    <BLProvider>
      <button type="button" data-testid="toggle-width" onClick={() => setWide((w) => !w)} className="m-2 rounded-md border border-border bg-card px-3 py-1.5 text-foreground">
        {wide ? 'Narrow (floating)' : 'Wide (split)'}
      </button>
      <div className={wide ? 'h-[640px] w-full max-w-[1100px] overflow-hidden' : 'h-[640px] w-full max-w-[560px] overflow-hidden'}>
        <ArtifactChatContainer>
          <ArtifactChatContainerContent><Artifact /></ArtifactChatContainerContent>
          <ArtifactChatContainerChat><Transcript /></ArtifactChatContainerChat>
          <ArtifactChatContainerComposer><ChatComposer /></ArtifactChatContainerComposer>
        </ArtifactChatContainer>
      </div>
    </BLProvider>
  );
}
export const SplitToFloating: Story = { render: () => <ResponsiveDemo /> };
