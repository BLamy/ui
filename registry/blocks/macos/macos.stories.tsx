import { useEffect, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { createTailscale } from '@/lib/tailscale';
import { AppearanceProvider } from '@/lib/theme';
import { createDemoTailnet } from '../safari/data';
import MacOS, { type MacOSProps } from './page';

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
/** The desktop on the simulated tailnet (stories only: the block's own default is the real Tailscale), signed out until someone signs in. */
const demo = (args: MacOSProps) => <MacOS {...args} tailscale={createDemoTailnet().options} />;

/** The same, already signed in (an auth key), as on a later visit: the menu bar and the Safari window share this one controller. */
function Connected(props: MacOSProps) {
  const [controller] = useState(() => createTailscale({ ...createDemoTailnet().options, auth: { mode: 'auth-key', authKey: 'demo' } }));
  useEffect(() => {
    const off = controller.activate();
    void controller.signIn();
    return () => { off(); void controller.dispose(); };
  }, [controller]);
  return <MacOS {...props} controller={controller} />;
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

/** The menu bar's Tailscale item before anyone has signed in: the mark is dim, and the menu is the sign-in. */
export const TailscaleSignedOut: Story = {
  args: { defaultOpen: false, initialMenu: 'tailscale' },
  render: (args) => <Full>{demo(args)}</Full>,
};

/** Signed in: the Tailscale menu with the tailnet, this device and the exit nodes drawn like Wi-Fi networks. */
export const TailscaleMenu: Story = {
  args: { defaultOpen: false, initialMenu: 'tailscale' },
  render: (args) => <Full><Connected {...args} /></Full>,
};

export const TailscaleMenuDark: Story = {
  args: { defaultOpen: false, initialMenu: 'tailscale' },
  render: (args) => dark(<Full><Connected {...args} /></Full>),
};

/** The Wi-Fi menu: a switch, the network this Mac is on (checked), nearby ones with locks and signal bars, and Network Settings…. */
export const WifiMenu: Story = {
  args: { defaultOpen: false, initialMenu: 'wifi' },
  render: (args) => <Full>{demo(args)}</Full>,
};

export const WifiMenuDark: Story = {
  args: { defaultOpen: false, initialMenu: 'wifi' },
  render: (args) => dark(<Full>{demo(args)}</Full>),
};

/** Safari opened from the desktop, signed in: its shield menu and the menu bar's Tailscale item are one controller, so an exit
    node chosen in either shows in both (Safari picks one itself when a public address needs it). */
export const SafariOnTheTailnet: Story = {
  args: { initialApps: ['safari'], defaultOpen: false },
  render: (args) => <Full><Connected {...args} /></Full>,
};

/** Safari signed out: its gate, and the same sign-in in the menu bar's Tailscale item. */
export const SafariGate: Story = {
  args: { initialApps: ['safari'], defaultOpen: false },
  render: (args) => dark(<Full>{demo(args)}</Full>),
};
