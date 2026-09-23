import type { Meta, StoryObj } from '@storybook/react-vite';
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
import { ChatColumn } from './chat-column';
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

const meta: Meta<typeof ChatColumn> = {
  title: 'Organisms/ChatColumn',
  component: ChatColumn,
};
export default meta;
type Story = StoryObj<typeof ChatColumn>;

export const Default: Story = {
  render: () => (
    <div
      className="ck-artifact-chat relative isolate min-h-0 min-w-0 overflow-hidden bg-[color:var(--bl-bg,#fff)] text-[color:var(--bl-label,#111)]"
      style={{ width: 400, height: 560, display: 'flex', borderRadius: 18, fontFamily: KFONT }}
    >
      <ChatColumn style={{ flex: 1 }}>
        <ChatColumn.Transcript>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 14, padding: 18, background: K.bg, color: K.label, boxSizing: 'border-box' }}>
            <div style={{ fontSize: 13.5 }}>Which region moved the most against last month?</div>
            <div style={{ fontSize: 13.5, color: K.mut }}>Northeast — up 6.1 points.</div>
          </div>
        </ChatColumn.Transcript>
        <ChatColumn.Composer>
          <ChatComposer placeholder="Reply…" />
        </ChatColumn.Composer>
      </ChatColumn>
    </div>
  ),
};
