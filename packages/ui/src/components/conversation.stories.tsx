import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Composer, ComposerCard, ComposerFooter, ComposerInput, ComposerSend, ComposerSpacer, ComposerStop } from '@/components/ui/composer/composer';
import {
  AssistantMessage,
  Conversation,
  ConversationComposer,
  ConversationEmpty,
  ConversationMessages,
  ConversationSuggestions,
  ConversationTyping,
  MessageMarkdown,
  Suggestion,
  ToolCall,
  UserMessage,
  WorkLog,
} from '@/components/ui/conversation';
import { AppearanceProvider, ThemeScope, type Appearance } from '@/lib/theme';

/* A conversation fills the pane it is given: the frame is `w-full max-w-…` and as tall as the canvas, so a
   phone-sized canvas shows the narrow layout. */
function Frame({ appearance = 'light', children }: { appearance?: Appearance; children: ReactNode }) {
  return (
    <AppearanceProvider value={appearance}>
      <ThemeScope scope="chat" className="flex h-dvh justify-center bg-background font-sans text-foreground">
        <div className="flex h-full w-full max-w-[760px] flex-col">{children}</div>
      </ThemeScope>
    </AppearanceProvider>
  );
}

const meta: Meta = {
  title: 'Organisms/Conversation',
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj;

const SHOT =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="420" height="220"><rect width="420" height="220" fill="#1f2937"/><rect x="24" y="24" width="220" height="14" rx="7" fill="#64748b"/><rect x="24" y="130" width="120" height="64" rx="10" fill="#ef4444"/></svg>');

function Box({ streaming }: { streaming?: boolean }) {
  return (
    <Composer streaming={streaming}>
      <ComposerCard>
        <ComposerInput placeholder="Ask anything" />
        <ComposerFooter>
          <ComposerSpacer />
          <ComposerStop />
          <ComposerSend morph={false} />
        </ComposerFooter>
      </ComposerCard>
    </Composer>
  );
}

function Thread({ empty, streaming, workLogOpen }: { empty?: boolean; streaming?: boolean; workLogOpen?: boolean }) {
  return (
    <Conversation empty={empty}>
      <ConversationEmpty title="What are we building?" description="Start a thread — ask anything about this workspace." />
      <ConversationMessages threadKey="t1" streaming={streaming}>
        <UserMessage key="u1" attachments={[{ id: 'shot', name: 'checkout.png', src: SHOT, kind: 'image' }, { id: 'log', name: 'build.log', kind: 'text', size: 18400 }]}>
          The checkout button is clipped on mobile, can you fix it?
        </UserMessage>
        <AssistantMessage key="a1">
          <WorkLog summary="Worked for 1m 4s" defaultOpen={workLogOpen}>
            <ToolCall icon="doc-text" title="Read" description="checkout/button.tsx" />
            <ToolCall icon="doc-text" title="Edited" description="checkout/button.tsx" code={'- className="w-[420px]"\n+ className="w-full max-w-[420px]"'} />
            <ToolCall status="running" title="Running" description="pnpm nx test checkout" />
            <ToolCall status="error" title="Type check failed" description="2 errors" />
          </WorkLog>
          <MessageMarkdown markdown="The button had a fixed **420px** width. It is now `w-full` with a max width, so it shrinks inside narrow screens." />
        </AssistantMessage>
        <UserMessage key="u2">Thanks. Anything else?</UserMessage>
        <AssistantMessage key="a2">{streaming ? <ConversationTyping /> : <WorkLog summary="Worked for 3s" />}</AssistantMessage>
      </ConversationMessages>
      <ConversationComposer>
        <Box streaming={streaming} />
      </ConversationComposer>
      <ConversationSuggestions>
        <Suggestion>Plan a trip</Suggestion>
        <Suggestion>Explain this repo</Suggestion>
        <Suggestion>Write tests</Suggestion>
      </ConversationSuggestions>
    </Conversation>
  );
}

/** No thread yet: the EmptyState over a centred composer, suggestions under it. */
export const Empty: Story = { render: () => <Frame><Thread empty /></Frame> };
export const EmptyDark: Story = { render: () => <Frame appearance="dark"><Thread empty /></Frame> };

/** A thread: attachments on the user's turn, a work log (done, running, failed calls), the docked composer. */
export const ThreadView: Story = { name: 'Thread', render: () => <Frame><Thread workLogOpen /></Frame> };
export const ThreadDark: Story = { render: () => <Frame appearance="dark"><Thread workLogOpen /></Frame> };

/** A reply is arriving: the typing dots, the log `aria-busy`, ComposerStop beside send. */
export const Streaming: Story = { render: () => <Frame><Thread streaming /></Frame> };

/** Press a suggestion: the empty state leaves and the composer flies down to its dock. */
function Starting() {
  const [empty, setEmpty] = useState(true);
  return (
    <Conversation empty={empty}>
      <ConversationEmpty title="What are we building?" />
      <ConversationMessages threadKey="t2">
        {empty ? null : <UserMessage key="u1">Plan a trip</UserMessage>}
        {empty ? null : (
          <AssistantMessage key="a1">
            <ConversationTyping />
          </AssistantMessage>
        )}
      </ConversationMessages>
      <ConversationComposer>
        <Box />
      </ConversationComposer>
      <ConversationSuggestions>
        <Suggestion onClick={() => setEmpty(false)}>Plan a trip</Suggestion>
      </ConversationSuggestions>
    </Conversation>
  );
}
export const FirstMessage: Story = { render: () => <Frame><Starting /></Frame> };
