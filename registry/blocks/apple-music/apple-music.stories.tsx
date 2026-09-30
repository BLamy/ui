import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppearanceProvider } from '@/lib/theme';
import AppleMusic from './page';

const meta: Meta<typeof AppleMusic> = {
  title: 'Blocks/Apple Music',
  component: AppleMusic,
  parameters: { layout: 'fullscreen' },
};
export default meta;
/** The desk behind the device frames: a fixed backdrop, not a theme color. */
const DESK = '#e6e8eb';

type Story = StoryObj<typeof AppleMusic>;

/** The block fills whatever box it's given; these stories give it the viewport or a device-sized frame. */
function Full({ children }: { children: ReactNode }) {
  return <div className="h-screen w-full">{children}</div>;
}
function Frame({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  return (
    <div className="box-border grid min-h-screen place-items-center p-4" style={{ background: DESK }}>
      <div className="overflow-hidden rounded-[28px] shadow-[0_12px_40px_black] shadow-black/18" style={{ width, height }}>{children}</div>
    </div>
  );
}
const dark = (node: ReactNode) => <AppearanceProvider value="dark">{node}</AppearanceProvider>;

export const Light: Story = { render: (args) => <Full><AppleMusic {...args} /></Full> };

export const Dark: Story = { render: (args) => dark(<Full><AppleMusic {...args} /></Full>) };

/** An album page tints its buttons and links from the artwork. */
export const Album: Story = {
  args: { initialSection: 'albums', initialAlbum: 'neon-tidewater' },
  render: (args) => <Full><AppleMusic {...args} /></Full>,
};

/** The mini player, expanded: the same element, grown to the whole window in the album's colors. */
export const NowPlaying: Story = {
  args: { initialAlbum: 'velvet-static', nowPlaying: true },
  render: (args) => <Full><AppleMusic {...args} /></Full>,
};

/** Tablet: the sidebar floats over the content from the toggle. */
export const Tablet: Story = { render: (args) => <Frame width={834} height={800}><AppleMusic {...args} /></Frame> };

export const Phone: Story = { render: (args) => <Frame width={390} height={844}><AppleMusic {...args} /></Frame> };

export const PhoneDark: Story = {
  args: { initialSection: 'library' },
  render: (args) => dark(<Frame width={390} height={844}><AppleMusic {...args} /></Frame>),
};

export const PhoneAlbum: Story = {
  args: { initialSection: 'library', initialAlbum: 'copperline' },
  render: (args) => <Frame width={390} height={844}><AppleMusic {...args} /></Frame>,
};

export const PhoneNowPlaying: Story = {
  args: { initialAlbum: 'soft-machinery', nowPlaying: true },
  render: (args) => dark(<Frame width={390} height={844}><AppleMusic {...args} /></Frame>),
};
