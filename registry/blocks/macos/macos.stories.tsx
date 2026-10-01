import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppearanceProvider } from '@/lib/theme';
import MacOS from './page';

const meta: Meta<typeof MacOS> = {
  title: 'Blocks/macOS',
  component: MacOS,
  parameters: { layout: 'fullscreen' },
};
export default meta;

type Story = StoryObj<typeof MacOS>;

/** The desk behind the narrow frame: a fixed backdrop, not a theme color. */
const DESK = '#e6e8eb';

/** The block fills whatever box it's given; these stories give it the viewport. */
function Full({ children }: { children: ReactNode }) {
  return <div className="h-screen w-full">{children}</div>;
}
const dark = (node: ReactNode) => <AppearanceProvider value="dark">{node}</AppearanceProvider>;

/** The desktop with Alfred open at the root: the apps first (⌘1–⌘9), then Alfred's own features. */
export const Light: Story = { render: (args) => <Full><MacOS {...args} /></Full> };

export const Dark: Story = { render: (args) => dark(<Full><MacOS {...args} /></Full>) };

/** Math typed at the root answers inline, above everything else. */
export const InlineMath: Story = {
  args: { initialQuery: '(1200 * 1.08) / 12' },
  render: (args) => <Full><MacOS {...args} /></Full>,
};

/** The calculator page, with a live result and history. */
export const Calculator: Story = {
  args: { initialPages: ['calc'], initialQuery: '2^10 + sqrt(144)' },
  render: (args) => dark(<Full><MacOS {...args} /></Full>),
};

/** Clipboard history: pinned first, the active clip previewed beside the list. */
export const Clipboard: Story = {
  args: { initialPages: ['clipboard'] },
  render: (args) => dark(<Full><MacOS {...args} /></Full>),
};

/** The emoji grid (arrow keys move in two dimensions). */
export const Emoji: Story = {
  args: { initialPages: ['emoji'] },
  render: (args) => <Full><MacOS {...args} /></Full>,
};

/** Two folders deep in File Search. */
export const Files: Story = {
  args: { initialPages: ['folder:~', 'folder:~/Projects', 'folder:~/Projects/alfred-clone'] },
  render: (args) => <Full><MacOS {...args} /></Full>,
};

/** A workflow mid-way: the GitHub issue's title page. */
export const Workflow: Story = {
  args: { initialPages: ['workflows', 'gh-repo', 'gh-title'], initialQuery: 'Launcher forgets the query on reopen' },
  render: (args) => dark(<Full><MacOS {...args} /></Full>),
};

/** A narrow container: no preview pane, a shorter legend. */
export const Narrow: Story = {
  args: { initialPages: ['clipboard'] },
  render: (args) => (
    <div className="box-border grid h-screen w-full place-items-center p-4" style={{ background: DESK }}>
      <div className="h-[640px] w-[420px] overflow-hidden rounded-[18px] shadow-[0_12px_40px_black] shadow-black/18"><MacOS {...args} /></div>
    </div>
  ),
};

/** Phone width: the desktop becomes an iPhone — a springboard of the same apps; tap one and it zooms open, the home bar sends it back. */
export const Phone: Story = {
  args: { defaultOpen: false },
  render: (args) => (
    <div className="box-border grid h-screen w-full place-items-center p-4" style={{ background: DESK }}>
      <div className="h-[780px] max-h-full w-[390px] overflow-hidden rounded-[44px] shadow-[0_12px_40px_black] shadow-black/18"><MacOS {...args} /></div>
    </div>
  ),
};

/** An app open in its window, the bar hidden — the Dock shows it running. */
export const Reminders: Story = {
  args: { initialApps: ['reminders'], defaultOpen: false },
  render: (args) => <Full><MacOS {...args} /></Full>,
};

/** Several apps stacked: the last opened is in front and the menu bar names it. */
export const Windows: Story = {
  args: { initialApps: ['mail', 'notes', 'music'], defaultOpen: false },
  render: (args) => dark(<Full><MacOS {...args} /></Full>),
};

/** Typing an app's name finds it; Enter opens it. */
export const LaunchApp: Story = {
  args: { initialQuery: 'remin' },
  render: (args) => <Full><MacOS {...args} /></Full>,
};

/** Right-click the Dock for Turn Magnification Off and Turn Hiding On. Here it starts hidden with magnification off:
    move the pointer to the bottom edge and the Dock slides up, and zoomed windows fill the room it left. */
export const DockHidden: Story = {
  args: { initialApps: ['notes'], defaultOpen: false, dock: { hide: true, magnify: false } },
  render: (args) => <Full><MacOS {...args} /></Full>,
};
