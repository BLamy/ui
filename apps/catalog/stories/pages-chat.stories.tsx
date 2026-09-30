import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppearanceProvider } from '@/lib/theme';
import DiscordClone, { type ThreadState } from '@brett_lamy/registry/blocks/discord-clone/page';

/* The Discord clone block (registry/blocks/discord-clone), at the sizes the old ChatDemo stories used. */

interface ChatPageArgs {
  width: number;
  height: number;
  tint: string;
  showMembers: boolean;
  defaultThread: ThreadState | null;
}

const meta: Meta<ChatPageArgs> = {
  title: 'Pages/Chat',
  args: { tint: '#0A84FF', showMembers: true, defaultThread: { id: 'd4', mode: 'panel' } },
  render: ({ width, height, ...props }) => (
    <div style={{ width, height, overflow: 'hidden' }}>
      <DiscordClone {...props} />
    </div>
  ),
};
export default meta;
type Story = StoryObj<ChatPageArgs>;

export const Desktop: Story = {
  args: { width: 1280, height: 720 },
};

export const Compact: Story = {
  args: { width: 390, height: 720 },
};

/** The block under an ambient AppearanceProvider. */
const inAppearance =
  (appearance: 'light' | 'dark') =>
  ({ width, height, ...props }: ChatPageArgs) => (
    <AppearanceProvider value={appearance}>
      <div style={{ width, height, overflow: 'hidden' }}>
        <DiscordClone {...props} />
      </div>
    </AppearanceProvider>
  );
export const AppearanceLight: Story = { args: { width: 1280, height: 720 }, render: inAppearance('light') };
export const AppearanceDark: Story = { args: { width: 1280, height: 720 }, render: inAppearance('dark') };
export const AppearanceLightCompact: Story = { args: { width: 390, height: 720 }, render: inAppearance('light') };

/** ≥1180px shell: the thread's ChatShellPanel docks as a column beside the channel. */
export const ThreadFixedDrawer: Story = {
  args: { width: 1280, height: 720, defaultThread: { id: 'd4', mode: 'panel' } },
  parameters: {
    docs: {
      description: {
        story: 'ChatShellPanel docks the thread as a column from 1180px (below that the same panel overlays). The reply composer autofocuses.',
      },
    },
  },
};

/** Below 1180px the same panel overlays the channel. */
export const ThreadOverlayDrawer: Story = {
  args: { width: 1000, height: 720, defaultThread: { id: 'd4', mode: 'panel' } },
};

/** A thread in `full` mode replaces the channel, with a back button and "Open as drawer". */
export const ThreadFullView: Story = {
  args: { width: 1280, height: 720, defaultThread: { id: 'd3', mode: 'full' } },
  parameters: {
    docs: {
      description: {
        story: 'Full-thread view (also reached from the thread rows under the active channel). The header shows ChatShellBack and an outline ChatShellHeaderAction.',
      },
    },
  },
};

/** Wide enough for the member list (ChatShellAside docks from 1320px); no thread open. */
export const WithMembers: Story = {
  args: { width: 1360, height: 720, defaultThread: null },
};
