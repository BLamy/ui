import type { Meta, StoryObj } from '@storybook/react-vite';
import { Composer } from '@touchkit/workbench';
import '@touchkit/workbench/styles.css';
import { ChatColumn } from './chat-column';
import { K, KFONT } from './chat-tokens';
import '../styles.css';

const meta: Meta<typeof ChatColumn> = {
  title: 'Organisms/ChatColumn',
  component: ChatColumn,
};
export default meta;
type Story = StoryObj<typeof ChatColumn>;

export const Default: Story = {
  render: () => (
    <div className="ck-artifact-chat" style={{ width: 400, height: 560, display: 'flex', borderRadius: 18, fontFamily: KFONT }}>
      <ChatColumn style={{ flex: 1 }}>
        <ChatColumn.Transcript>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 14, padding: 18, background: K.bg, color: K.label, boxSizing: 'border-box' }}>
            <div style={{ fontSize: 13.5 }}>Which region moved the most against last month?</div>
            <div style={{ fontSize: 13.5, color: K.mut }}>Northeast — up 6.1 points.</div>
          </div>
        </ChatColumn.Transcript>
        <ChatColumn.Composer>
          <Composer wide showOptions={false} showCheckout={false} placeholder="Reply…" onSend={() => undefined} />
        </ChatColumn.Composer>
      </ChatColumn>
    </div>
  ),
};
