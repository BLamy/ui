import type { Meta, StoryObj } from '@storybook/react-vite';
import { RichText } from './components/rich-text';
import { USERS, ChatFrame } from './chat.fixtures';

const meta: Meta<typeof RichText> = {
  title: 'Atoms/RichText',
  component: RichText,
  decorators: [
    (Story) => (
      <ChatFrame className="w-[420px] rounded-[12px] p-6 font-sans text-[13.5px] leading-[1.55]">
        <Story />
      </ChatFrame>
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
