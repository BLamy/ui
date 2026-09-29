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
/** The desk behind the device frames: a fixed backdrop, not a theme color. */
const DESK = '#e6e8eb';

type Story = StoryObj<typeof GithubClone>;

/** The block fills whatever box it's given; these stories give it the viewport or a phone-sized frame. */
function Full({ children }: { children: ReactNode }) {
  return <div className="h-screen w-full">{children}</div>;
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
    <div className="box-border grid min-h-screen place-items-center p-4" style={{ background: DESK }}>
      <div className="h-[844px] w-[390px] overflow-hidden rounded-[24px] shadow-[0_12px_40px_black] shadow-black/18">
        <GithubClone {...args} />
      </div>
    </div>
  ),
};

export const PullRequest: Story = {
  args: { initialPullRequest: 488 },
  render: (args) => <Full><GithubClone {...args} /></Full>,
};

/** The Code tab's file viewer: SyntaxHighlighting with GitHub's gutter and Primer colors. */
export const FileView: Story = {
  args: { initialPath: 'src/queue.ts' },
  render: (args) => <Full><GithubClone {...args} /></Full>,
};

export const FileViewDark: Story = {
  args: { initialPath: 'src/queue.ts' },
  render: (args) => (
    <AppearanceProvider value="dark">
      <Full><GithubClone {...args} /></Full>
    </AppearanceProvider>
  ),
};

/** Files changed: +/- rows and gutters, syntax colors inside the lines. */
export const FilesChanged: Story = {
  args: { initialPullRequest: 488, initialPullRequestTab: 'files' },
  render: (args) => <Full><GithubClone {...args} /></Full>,
};

export const FilesChangedDark: Story = {
  args: { initialPullRequest: 488, initialPullRequestTab: 'files' },
  render: (args) => (
    <AppearanceProvider value="dark">
      <Full><GithubClone {...args} /></Full>
    </AppearanceProvider>
  ),
};
