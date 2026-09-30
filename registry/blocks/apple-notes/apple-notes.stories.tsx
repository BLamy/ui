import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppearanceProvider } from '@/lib/theme';
import AppleNotes from './page';

const meta: Meta<typeof AppleNotes> = {
  title: 'Blocks/Apple Notes',
  component: AppleNotes,
  parameters: { layout: 'fullscreen' },
};
export default meta;
/** The desk behind the device frames: a fixed backdrop, not a theme color. */
const DESK = '#e6e8eb';

type Story = StoryObj<typeof AppleNotes>;

/** The block fills whatever box it's given; these stories give it the viewport, an iPad or a phone-sized frame. */
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

export const Light: Story = { render: (args) => <Full><AppleNotes {...args} /></Full> };

export const Dark: Story = {
  render: (args) => (
    <AppearanceProvider value="dark">
      <Full><AppleNotes {...args} /></Full>
    </AppearanceProvider>
  ),
};

/** Thumbnails instead of rows; the list column steps aside and the gallery fills the window. */
export const Gallery: Story = { args: { initialView: 'gallery' }, render: (args) => <Full><AppleNotes {...args} /></Full> };

/** iPad: list and note tiled; the folders float in from the sidebar button. */
export const Tablet: Story = {
  args: { initialNote: 'n4' },
  render: (args) => <Device width={834} height={860}><AppleNotes {...args} /></Device>,
};

export const Phone: Story = { render: (args) => <Device width={390} height={844}><AppleNotes {...args} /></Device> };

export const PhoneDark: Story = {
  render: (args) => (
    <AppearanceProvider value="dark">
      <Device width={390} height={844}><AppleNotes {...args} /></Device>
    </AppearanceProvider>
  ),
};

/** A locked note, before View Note. */
export const LockedNote: Story = { args: { initialNote: 'n5' }, render: (args) => <Full><AppleNotes {...args} /></Full> };
