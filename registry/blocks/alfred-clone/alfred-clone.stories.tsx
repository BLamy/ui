import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppearanceProvider } from '@/lib/theme';
import AlfredClone from './page';

const meta: Meta<typeof AlfredClone> = {
  title: 'Blocks/Alfred',
  component: AlfredClone,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof AlfredClone>;

/** The desk behind the narrow frame: a fixed backdrop, not a theme color. */
const DESK = '#e6e8eb';

/** The block fills whatever box it's given; these stories give it the viewport. */
function Full({ children }: { children: ReactNode }) {
  return <div className="h-screen w-full">{children}</div>;
}
const dark = (node: ReactNode) => <AppearanceProvider value="dark">{node}</AppearanceProvider>;

/** The bar at the root: every feature, ⌘1–⌘8. */
export const Light: Story = { render: (args) => <Full><AlfredClone {...args} /></Full> };

export const Dark: Story = { render: (args) => dark(<Full><AlfredClone {...args} /></Full>) };

/** Math typed at the root answers inline, above everything else. */
export const InlineMath: Story = {
  args: { initialQuery: '(1200 * 1.08) / 12' },
  render: (args) => <Full><AlfredClone {...args} /></Full>,
};

/** The calculator page, with a live result and history. */
export const Calculator: Story = {
  args: { initialPages: ['calc'], initialQuery: '2^10 + sqrt(144)' },
  render: (args) => dark(<Full><AlfredClone {...args} /></Full>),
};

/** Clipboard history: pinned first, the active clip previewed beside the list. */
export const Clipboard: Story = {
  args: { initialPages: ['clipboard'] },
  render: (args) => dark(<Full><AlfredClone {...args} /></Full>),
};

/** The emoji grid (arrow keys move in two dimensions). */
export const Emoji: Story = {
  args: { initialPages: ['emoji'] },
  render: (args) => <Full><AlfredClone {...args} /></Full>,
};

/** Two folders deep in File Search. */
export const Files: Story = {
  args: { initialPages: ['folder:~', 'folder:~/Projects', 'folder:~/Projects/alfred-clone'] },
  render: (args) => <Full><AlfredClone {...args} /></Full>,
};

/** A workflow mid-way: the GitHub issue's title page. */
export const Workflow: Story = {
  args: { initialPages: ['workflows', 'gh-repo', 'gh-title'], initialQuery: 'Launcher forgets the query on reopen' },
  render: (args) => dark(<Full><AlfredClone {...args} /></Full>),
};

/** A narrow container: no preview pane, a shorter legend. */
export const Narrow: Story = {
  args: { initialPages: ['clipboard'] },
  render: (args) => (
    <div className="box-border grid h-screen w-full place-items-center p-4" style={{ background: DESK }}>
      <div className="h-[640px] w-[420px] overflow-hidden rounded-[18px] shadow-[0_12px_40px_black] shadow-black/18"><AlfredClone {...args} /></div>
    </div>
  ),
};
