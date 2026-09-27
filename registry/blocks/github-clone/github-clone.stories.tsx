import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppearanceProvider } from '@brett_lamy/ui';
import GithubClone from './page';

const meta: Meta<typeof GithubClone> = {
  title: 'Blocks/GitHub clone',
  component: GithubClone,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof GithubClone>;

/** The block fills whatever box it's given; these stories give it the viewport or a phone-sized frame. */
function Full({ children }: { children: ReactNode }) {
  return <div style={{ height: '100vh', width: '100%' }}>{children}</div>;
}

export const Light: Story = { render: (args) => <Full><GithubClone {...args} /></Full> };

export const Dark: Story = {
  render: (args) => (
    <AppearanceProvider value="dark">
      <Full><GithubClone {...args} /></Full>
    </AppearanceProvider>
  ),
};

export const Phone: Story = {
  render: (args) => (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: '#e6e8eb', padding: 16, boxSizing: 'border-box' }}>
      <div style={{ width: 390, height: 844, borderRadius: 24, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,.18)' }}>
        <GithubClone {...args} />
      </div>
    </div>
  ),
};

export const PullRequest: Story = {
  args: { initialPullRequest: 488 },
  render: (args) => <Full><GithubClone {...args} /></Full>,
};
