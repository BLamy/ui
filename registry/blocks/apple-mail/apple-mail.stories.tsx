import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppearanceProvider } from '@brett_lamy/ui';
import AppleMail from './page';

const meta: Meta<typeof AppleMail> = {
  title: 'Blocks/Apple Mail',
  component: AppleMail,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof AppleMail>;

/** The block fills whatever box it's given; these stories give it the viewport, an iPad or a phone-sized frame. */
function Full({ children }: { children: ReactNode }) {
  return <div style={{ height: '100vh', width: '100%' }}>{children}</div>;
}
function Device({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: '#e6e8eb', padding: 16, boxSizing: 'border-box' }}>
      <div style={{ width, height, borderRadius: 24, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,.18)' }}>{children}</div>
    </div>
  );
}

export const Light: Story = { render: (args) => <Full><AppleMail {...args} /></Full> };

export const Dark: Story = {
  render: (args) => (
    <AppearanceProvider value="dark">
      <Full><AppleMail {...args} /></Full>
    </AppearanceProvider>
  ),
};

/** iPad: list and message tiled; the mailboxes float in from the sidebar button. */
export const Tablet: Story = { render: (args) => <Device width={834} height={860}><AppleMail {...args} /></Device> };

export const Phone: Story = { render: (args) => <Device width={390} height={844}><AppleMail {...args} /></Device> };

export const PhoneDark: Story = {
  render: (args) => (
    <AppearanceProvider value="dark">
      <Device width={390} height={844}><AppleMail {...args} /></Device>
    </AppearanceProvider>
  ),
};

/** A reply in the compose sheet, the original quoted below. */
export const Compose: Story = {
  args: {
    initialDraft: {
      to: 'sam@okafor.studio', cc: '', subject: 'Re: Cabin weekend — final headcount', replyTo: 'm1',
      body: 'Count us in! I’ll bring the camp stove and the good kettle.\n\n> On Sep 27, 2026, Sam Okafor wrote:\n>\n> Booking closes tonight so I need a yes or no by 6.',
    },
  },
  render: (args) => <Full><AppleMail {...args} /></Full>,
};
