import { useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Composer } from '@touchkit/workbench';
import '@touchkit/workbench/styles.css';
import { FloatingChat, type FloatingChatFabPosition } from './floating-chat';
import { K, KFONT } from './chat-tokens';
import '../styles.css';

interface Args {
  width: number;
  height: number;
  peek: number;
  working: boolean;
  fabPosition: FloatingChatFabPosition;
  tone: 'auto' | 'dark' | 'light';
}

const LINES = [
  ['You', 'Summarise what changed in the last release.'],
  ['TouchKit', 'Three things: the new floating chat surface, a tile map, and the docs restructure.'],
  ['You', 'Which one needs a follow-up?'],
  ['TouchKit', 'The map — attribution and a light tile set are still open.'],
];

function Transcript() {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto', padding: '18px 18px 12px', color: 'inherit' }}>
      {LINES.map(([author, copy], index) => (
        // The newest lines hug the composer so they are what peeks out of the closed chat.
        <div key={copy} style={{ marginBottom: 16, marginTop: index === 0 ? 'auto' : undefined }}>
          <div style={{ color: index % 2 ? '#68A7FF' : 'var(--tk-label2)', fontSize: 12, fontWeight: 700, marginBottom: 4 }}>{author}</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.5 }}>{copy}</div>
        </div>
      ))}
    </div>
  );
}

function Demo(args: Args) {
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <div style={{ position: 'relative', width: args.width, height: args.height, overflow: 'hidden', fontFamily: KFONT, background: K.bg, color: K.label }}>
      {/* Any scrolling host: the chat follows its scroll direction like a TabBar. */}
      <div ref={scrollRef} style={{ position: 'absolute', inset: 0, overflow: 'auto', padding: 20, boxSizing: 'border-box' }}>
        <h1 style={{ margin: '4px 0 16px', fontSize: 24 }}>Release notes</h1>
        {Array.from({ length: 14 }, (_, i) => (
          <div key={i} style={{ height: 88, marginBottom: 12, borderRadius: 14, background: 'rgba(255,255,255,.06)' }} />
        ))}
      </div>
      <FloatingChat peek={args.peek} working={args.working} fabPosition={args.fabPosition} tone={args.tone} scrollRef={scrollRef}>
        <FloatingChat.Chat><Transcript /></FloatingChat.Chat>
        <FloatingChat.Composer>
          <div style={{ padding: 8 }}>
            <Composer wide showOptions={false} showCheckout={false} placeholder="Ask about this page" onSend={() => undefined} />
          </div>
        </FloatingChat.Composer>
      </FloatingChat>
    </div>
  );
}

const meta: Meta<Args> = {
  title: 'Containers/FloatingChat',
  render: (args) => <Demo {...args} />,
  args: { width: 430, height: 760, peek: 0, working: false, fabPosition: 'bottom-center', tone: 'auto' },
  argTypes: {
    fabPosition: {
      control: 'select',
      options: ['top-left', 'top-center', 'top-right', 'center-left', 'center-right', 'bottom-left', 'bottom-center', 'bottom-right'],
    },
    tone: { control: 'radio', options: ['auto', 'dark', 'light'] },
  },
  parameters: {
    docs: {
      description: {
        component:
          'The standalone floating chat surface: a FloatingSheet whose body is the transcript and whose foot is the composer. Drop it into any positioned host — here a plain scrolling page.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const OverScrollingPage: Story = {};
export const Peeking: Story = { args: { peek: 200 } };
export const Working: Story = { args: { working: true } };
