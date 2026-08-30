import type { Meta, StoryObj } from '@storybook/react-vite';
import { chatTokens, KFONT } from './chat-tokens';
import { RichText } from './rich-text';
import { USERS } from '../demos/chat-demo';
import '../styles.css';

const meta: Meta<typeof RichText> = {
  title: 'Atoms/RichText',
  component: RichText,
  decorators: [
    (Story) => (
      <div
        style={{
          width: 420,
          padding: 24,
          background: chatTokens.bg,
          color: chatTokens.label,
          colorScheme: 'dark',
          fontFamily: KFONT,
          fontSize: 13.5,
          lineHeight: 1.55,
          borderRadius: 12,
        }}
      >
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof RichText>;

export const Plain: Story = {
  args: { text: 'Nightly link check: 0 broken anchors across 26 pages.', users: USERS },
};

export const WithMentions: Story = {
  args: {
    text: '@miles the QA evals bot responds to comments on eval-failure PRs. fyi @ada, assigned to you.',
    users: USERS,
  },
};

export const UnknownMention: Story = {
  args: { text: 'ping @nobody — unknown mentions render as plain text', users: USERS },
};
