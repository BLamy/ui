import { useEffect, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TailscaleMenu, type TailscaleMenuProps } from '@/components/ui/tailscale-menu';
import { createTailscale } from '@/lib/tailscale';
import { createFakeTailscaleClient, type FakeTailscaleOptions } from '@/lib/tailscale-fake';
import { TailscaleProvider, useTailscale } from '@/lib/tailscale-react';
import { Pad } from '../stories/frame';

const meta: Meta<typeof TailscaleMenu> = {
  title: 'Molecules/TailscaleMenu',
  component: TailscaleMenu,
  args: { variant: 'radio', detail: '4 pages and 17 requests this session, all through Tailscale.' },
  argTypes: { variant: { control: 'inline-radio', options: ['radio', 'networks'] } },
};
export default meta;
type Story = StoryObj<typeof TailscaleMenu>;

/* These stories run on the in-memory fake tailnet (lib/tailscale-fake), signed in with a key, so every render is the same.
   Real apps put the menu under a TailscaleProvider with createTailscaleConnectClient. */
const NODES: FakeTailscaleOptions = {
  tailnet: 'tail1234.ts.net',
  exitNodes: ['bretts-macbook-pro', 'mac-mini'],
  offlineExitNodes: ['bretts-macbook-air'],
  routes: { nas: () => new Response('ok') },
  startMs: 1,
};

/** Signs in and selects `exitNode`, and shows its children only then: the first paint is the settled one. */
function Settled({ exitNode, children }: { exitNode?: string; children: ReactNode }) {
  const tailscale = useTailscale();
  const connected = tailscale.getSnapshot().status === 'connected';
  const [chosen, setChosen] = useState(!exitNode);
  useEffect(() => { void tailscale.signIn(); }, [tailscale]);
  useEffect(() => {
    if (connected && exitNode) void tailscale.setExitNode(`node-${exitNode}`).then(() => setChosen(true));
  }, [connected, exitNode, tailscale]);
  return connected && chosen ? children : null;
}

function Tailnet({ exitNode, nodes = NODES, children }: { exitNode?: string; nodes?: FakeTailscaleOptions; children: ReactNode }) {
  const [tailscale] = useState(() => createTailscale({ client: createFakeTailscaleClient(nodes).client, auth: { mode: 'auth-key', authKey: 'story' }, hostname: 'iphone', popup: false, lockName: false }));
  return (
    <TailscaleProvider tailscale={tailscale}>
      <Settled exitNode={exitNode}>{children}</Settled>
    </TailscaleProvider>
  );
}

const menu = (extra: { dark?: boolean; exitNode?: string; nodes?: FakeTailscaleOptions; props?: Partial<TailscaleMenuProps> } = {}): Story => ({
  render: (args) => (
    <Pad dark={extra.dark} w={320}>
      <Tailnet exitNode={extra.exitNode} nodes={extra.nodes}>
        <TailscaleMenu {...args} {...extra.props} />
      </Tailnet>
    </Pad>
  ),
});

/** Safari's shield menu: a radio list with "None: your devices only" first and offline devices marked. */
export const Radio: Story = menu({ props: { variant: 'radio' } });

export const RadioActive: Story = menu({ exitNode: 'bretts-macbook-pro', props: { variant: 'radio' } });

/** The menu-bar look: exit nodes as networks, like macOS's Wi-Fi menu: None at the top, a check for the one in use, a trailing glyph, the offline device dimmed and not selectable. */
export const Networks: Story = menu({ props: { variant: 'networks' } });

export const NetworksActive: Story = menu({ exitNode: 'mac-mini', props: { variant: 'networks' } });

export const NetworksDark: Story = menu({ dark: true, exitNode: 'mac-mini', props: { variant: 'networks' } });

/** Nothing offers to be an exit node. */
export const NoExitNode: Story = menu({ nodes: { ...NODES, exitNodes: [], offlineExitNodes: [] }, props: { variant: 'networks' } });
