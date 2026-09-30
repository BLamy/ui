import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppearanceProvider } from '@/lib/theme';
import { SAMPLE_BOARDS } from './data';
import Freeform from './page';

const meta: Meta<typeof Freeform> = {
  title: 'Blocks/Freeform',
  component: Freeform,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof Freeform>;

/** The block fills whatever box it's given; these stories give it the viewport. */
function Full({ children }: { children: ReactNode }) {
  return <div className="h-screen w-full">{children}</div>;
}
const dark = (node: ReactNode) => <AppearanceProvider value="dark">{node}</AppearanceProvider>;

/** The gallery: every board with a live thumbnail. */
export const Gallery: Story = { render: (args) => <Full><Freeform {...args} /></Full> };

export const GalleryDark: Story = { render: (args) => dark(<Full><Freeform {...args} /></Full>) };

/** A board: a flow of connectors glued to shapes, sticky notes, a hand-drawn ring. Drag anything; the arrows follow. */
export const Board: Story = {
  args: { initialBoard: 'board-launch' },
  render: (args) => <Full><Freeform {...args} /></Full>,
};

export const BoardDark: Story = {
  args: { initialBoard: 'board-launch' },
  render: (args) => dark(<Full><Freeform {...args} /></Full>),
};

/** Photos, a link card, stickies and a route drawn with the marker. */
export const Photos: Story = {
  args: { initialBoard: 'board-tokyo' },
  render: (args) => <Full><Freeform {...args} /></Full>,
};

/** The grid background, and two frames holding stickies. */
export const Grid: Story = {
  args: { initialBoard: 'board-ideas' },
  render: (args) => <Full><Freeform {...args} /></Full>,
};

/** An empty board: add a sticky, a shape or a drawing from the bar below. */
export const Blank: Story = {
  args: { defaultBoards: [{ id: 'blank', title: 'Untitled', items: [], favorite: false, edited: 'Just now', background: 'dots' }, ...SAMPLE_BOARDS], initialBoard: 'blank' },
  render: (args) => <Full><Freeform {...args} /></Full>,
};

/** A narrow container: a compact header, no zoom cluster, the same gestures. */
export const Narrow: Story = {
  args: { initialBoard: 'board-tokyo' },
  render: (args) => (
    <div className="box-border grid h-screen w-full place-items-center p-4" style={{ background: '#e6e8eb' }}>
      <div className="relative h-[700px] w-[400px] overflow-hidden rounded-[18px] shadow-[0_12px_40px_black] shadow-black/18"><Freeform {...args} /></div>
    </div>
  ),
};
