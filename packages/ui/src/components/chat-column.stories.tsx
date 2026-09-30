import type { Meta, StoryObj } from '@storybook/react-vite';
import { Composer, ComposerAttach, ComposerAttachments, ComposerCard, ComposerExpand, ComposerFooter, ComposerInput, ComposerSend, ComposerSpacer } from '@/components/ui/composer/composer';
import '../styles.css';
import { ChatColumn, ChatColumnComposer, ChatColumnTranscript } from '@/components/ui/chat-column';
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

const meta: Meta<typeof ChatColumn> = {
  title: 'Organisms/ChatColumn',
  component: ChatColumn,
};
export default meta;
type Story = StoryObj<typeof ChatColumn>;

/** A ChatColumn on a plain page: the transcript on the dark chat palette, the Workbench Composer in the `glass`
    scope (as ArtifactChatContainer docks it). */
export const Default: Story = {
  render: () => (
    <div className="relative isolate flex h-[560px] w-[400px] min-h-0 min-w-0 overflow-hidden rounded-[18px] bg-background font-sans text-foreground">
      <ChatColumn className="flex-1">
        <ChatColumnTranscript>
          <ThemeScope scope="chat" appearance="dark" className="box-border flex h-full flex-col justify-end gap-3.5 bg-background p-[18px] text-foreground">
            <div className="text-[13.5px]">Which region moved the most against last month?</div>
            <div className="text-[13.5px] text-muted-foreground">Northeast — up 6.1 points.</div>
          </ThemeScope>
        </ChatColumnTranscript>
        <ChatColumnComposer>
          <ThemeScope scope="glass" appearance="dark" className="min-w-0">
            <ChatComposer placeholder="Reply…" />
          </ThemeScope>
        </ChatColumnComposer>
      </ChatColumn>
    </div>
  ),
};
