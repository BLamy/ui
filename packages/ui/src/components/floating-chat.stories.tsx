import { useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Composer, ComposerAttach, ComposerAttachments, ComposerCard, ComposerExpand, ComposerFooter, ComposerInput, ComposerSend, ComposerSpacer } from '@/components/ui/composer/composer';
import '../styles.css';
import { FloatingChat, type FloatingChatFabPosition } from '@/components/ui/floating-chat';
import { ThemeScope } from '@/lib/theme';

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
  ['BL UI', 'Three things: the new floating chat surface, a tile map, and the docs restructure.'],
  ['You', 'Which one needs a follow-up?'],
  ['BL UI', 'The map — attribution and a light tile set are still open.'],
];

/** The assistant's name colour (content). */
const ASSISTANT_INK = '#68A7FF';

function Transcript() {
  return (
    <div className="flex h-full flex-col overflow-auto px-[18px] pt-[18px] pb-3 text-inherit">
      {LINES.map(([author, copy], index) => (
        // The newest lines hug the composer so they are what peeks out of the closed chat.
        <div key={copy} className={index === 0 ? 'mt-auto mb-4' : 'mb-4'}>
          {/* The user's name takes the bump's own text colour. */}
          <div className="mb-1 text-[12px] font-bold" style={index % 2 ? { color: ASSISTANT_INK } : undefined}>{author}</div>
          <div className="text-[13.5px] leading-[1.5]">{copy}</div>
        </div>
      ))}
    </div>
  );
}

function Demo(args: Args) {
  const scrollRef = useRef<HTMLDivElement>(null);
  return (
    <ThemeScope scope="chat" appearance="dark" className="relative overflow-hidden bg-background font-ios text-foreground" style={{ width: args.width, height: args.height }}>
      {/* Any scrolling host: the chat follows its scroll direction like a TabBar. */}
      <div ref={scrollRef} className="absolute inset-0 box-border overflow-auto p-5">
        <h1 className="mt-1 mb-4 text-[24px]">Release notes</h1>
        {Array.from({ length: 14 }, (_, i) => (
          <div key={i} className="mb-3 h-[88px] rounded-[14px] bg-white/6" />
        ))}
      </div>
      <FloatingChat peek={args.peek} working={args.working} fabPosition={args.fabPosition} tone={args.tone} scrollRef={scrollRef}>
        <FloatingChat.Chat><Transcript /></FloatingChat.Chat>
        <FloatingChat.Composer>
          <div className="p-2">
            <ChatComposer placeholder="Ask about this page" />
          </div>
        </FloatingChat.Composer>
      </FloatingChat>
    </ThemeScope>
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
          'The standalone floating chat: the host\'s Workbench Composer floats over any positioned host and the transcript hangs off a draggable top bump of that composer (added through a ComposerOutlet). Drag the handle up to open, down past rest to fold into a FAB.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const OverScrollingPage: Story = {};
export const Peeking: Story = { args: { peek: 200 } };
export const Working: Story = { args: { working: true } };
