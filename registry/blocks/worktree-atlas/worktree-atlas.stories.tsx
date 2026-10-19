import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppearanceProvider } from '@/lib/theme';
import { createDemoSource } from './data';
import WorktreeAtlas, { type WorktreeAtlasProps } from './page';

const meta: Meta<typeof WorktreeAtlas> = {
  title: 'Blocks/Worktree Atlas',
  component: WorktreeAtlas,
  parameters: { layout: 'fullscreen' },
};
export default meta;
/** The desk behind the device frames: a fixed backdrop, not a theme color. */
const DESK = '#e6e8eb';
const UI = '/Users/you/Code/ui';

type Story = StoryObj<typeof WorktreeAtlas>;

function Full({ children }: { children: ReactNode }) {
  return <div className="h-screen w-full">{children}</div>;
}
function Device({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  return (
    <div className="box-border grid min-h-screen place-items-center p-4" style={{ background: DESK }}>
      <div className="overflow-hidden rounded-[24px] shadow-[0_12px_40px_black] shadow-black/18" style={{ width, height }}>{children}</div>
    </div>
  );
}

/** The sample repositories with no latency, so screenshots are stable; one source per story, so deletes stay put. */
function Sample(props: WorktreeAtlasProps) {
  const [source] = useState(() => createDemoSource({ latency: 0 }));
  return <WorktreeAtlas {...props} source={source} />;
}

export const Light: Story = {
  args: { initialProject: UI, initialWorktree: `${UI}#worktree-atlas` },
  render: (args) => <Full><Sample {...args} /></Full>,
};

export const Dark: Story = {
  args: { initialProject: UI, initialWorktree: `${UI}#segmented-hit-target` },
  render: (args) => (
    <AppearanceProvider value="dark">
      <Full><Sample {...args} /></Full>
    </AppearanceProvider>
  ),
};

/** Every repository's worktrees in one list. */
export const AllWorktrees: Story = { render: (args) => <Full><Sample {...args} /></Full> };

export const Tablet: Story = {
  args: { initialProject: UI, initialWorktree: `${UI}#pierre-trees` },
  render: (args) => <Device width={834} height={860}><Sample {...args} /></Device>,
};

export const Phone: Story = {
  args: { initialProject: UI },
  render: (args) => <Device width={390} height={844}><Sample {...args} /></Device>,
};

/** No `source`: the browser source, which opens on the folder picker welcome. */
export const Browser: Story = { render: (args) => <Full><WorktreeAtlas {...args} /></Full> };
