import { useEffect, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { buttonVariants } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { TailscaleExitNodes, TailscaleLoginButton, TailscaleMark, TailscaleStatusBadge, TailscaleSummary } from '@/components/ui/tailscale-controls';
import { createTailscale, type TailscaleStatus } from '@/lib/tailscale';
import { createFakeTailscaleClient, type FakeTailscaleOptions } from '@/lib/tailscale-fake';
import { TailscaleProvider, useTailscale } from '@/lib/tailscale-react';
import { Pad } from '../stories/frame';

const meta: Meta<typeof TailscaleLoginButton> = {
  title: 'Molecules/Tailscale',
  component: TailscaleLoginButton,
  args: { variant: 'contrast', size: 'default' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['contrast', 'outline', 'secondary', 'default'] },
    size: { control: 'inline-radio', options: ['sm', 'default', 'lg', 'pill'] },
  },
};
export default meta;
type Story = StoryObj<typeof TailscaleLoginButton>;

/* The login button and badge are driven by props here (no client); `Live` and the panel stories run the in-memory
   fake tailnet (lib/tailscale-fake), signed in with a key, so every render is the same. */
const noop = () => undefined;
const state = (status: TailscaleStatus, dark?: boolean): Story => ({
  render: (args) => (
    <Pad dark={dark}>
      <div className="grid justify-items-start gap-3">
        <TailscaleLoginButton {...args} status={status} onSignIn={noop} onCancel={noop} onSignOut={noop} />
        <TailscaleStatusBadge
          status={status}
          tailnet="tail1234.ts.net"
          loginUrl={status === 'signing-in' ? 'https://login.tailscale.com/a/example' : null}
          error="The Tailscale client failed to start."
        />
      </div>
    </Pad>
  ),
});

export const Idle: Story = state('idle');
export const SigningIn: Story = state('signing-in');
export const NeedsApproval: Story = state('needs-approval');
export const Connected: Story = state('connected');
export const ConnectedDark: Story = state('connected', true);
export const Failed: Story = state('error');
export const FailedDark: Story = state('error', true);

/** The login button is the kit's Button: its variants (default `contrast`) and sizes; the badge with its details
    inline, stacked, or the pill alone. */
export const Variants: Story = {
  render: () => (
    <Pad>
      <div className="grid justify-items-start gap-3">
        <TailscaleLoginButton status="idle" onSignIn={noop} />
        <TailscaleLoginButton status="idle" variant="outline" onSignIn={noop} />
        <TailscaleLoginButton status="idle" variant="secondary" size="sm" onSignIn={noop} />
        <TailscaleLoginButton status="error" variant="outline" size="sm" onSignIn={noop} />
        <TailscaleLoginButton status="idle" size="pill" onSignIn={noop} />
        <TailscaleStatusBadge status="connected" tailnet="tail1234.ts.net" />
        <TailscaleStatusBadge status="connected" tailnet="tail1234.ts.net" variant="stacked" />
        <TailscaleStatusBadge status="connected" tailnet="tail1234.ts.net" variant="pill" />
      </div>
    </Pad>
  ),
};

/** The head of a connection panel in each state, driven by props (no provider): connected, on the way, waiting for
    an admin, and not connected. */
export const SummaryStates: Story = {
  render: () => (
    <Pad w={320}>
      <div className="grid gap-4">
        <TailscaleSummary status="connected" tailnet="tail1234.ts.net" selfName="iphone.tail1234.ts.net." detail="4 pages and 17 requests this session." />
        <TailscaleSummary status="starting" tailnet="tail1234.ts.net" />
        <TailscaleSummary status="needs-approval" selfName="iphone" />
        <TailscaleSummary status="idle" />
      </div>
    </Pad>
  ),
};

function LiveDemo(args: Story['args']) {
  const [fake] = useState(() => createFakeTailscaleClient({ tailnet: 'demo-tailnet.ts.net', approveAfterMs: 1200 }));
  return (
    <TailscaleProvider options={{ client: fake.client, popup: false, lockName: false }}>
      <div className="grid justify-items-start gap-3">
        <TailscaleLoginButton {...args} />
        <TailscaleStatusBadge />
      </div>
    </TailscaleProvider>
  );
}

/** The real flow on the fake tailnet: sign in, approve, sign out. */
export const Live: Story = {
  render: (args) => (
    <Pad>
      <LiveDemo {...args} />
    </Pad>
  ),
};

/* ── the connection panel: TailscaleSummary + TailscaleExitNodes + TailscaleLoginButton ── */

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

function PanelBody({ onAction }: { onAction?: (id: string | null) => Promise<void> }) {
  return (
    <div className="flex flex-col gap-3">
      <TailscaleSummary detail="4 pages and 17 requests this session, all through Tailscale." />
      <TailscaleExitNodes onAction={onAction} />
      <TailscaleLoginButton size="sm" variant="outline" />
    </div>
  );
}

const panel = (extra: { dark?: boolean; exitNode?: string; nodes?: FakeTailscaleOptions; onAction?: (id: string | null) => Promise<void> } = {}): Story => ({
  render: () => (
    <Pad dark={extra.dark} w={320}>
      <Tailnet exitNode={extra.exitNode} nodes={extra.nodes}>
        <PanelBody onAction={extra.onAction} />
      </Tailnet>
    </Pad>
  ),
});

/** The parts of a connection panel, composed: where you are, the exit nodes like a Wi-Fi menu (None first, a check
    for the one in use, the offline device dimmed and not selectable), and sign out. */
export const Panel: Story = panel();
export const PanelExitNode: Story = panel({ exitNode: 'mac-mini' });
export const PanelDark: Story = panel({ dark: true, exitNode: 'mac-mini' });
/** Choosing a node shows "Connecting…" and a spinner on its row while the switch runs (this one never finishes). */
export const PanelConnecting: Story = panel({ onAction: () => new Promise<void>(() => undefined) });
/** A refused switch shows its message under the list. Choose a node to see it. */
export const PanelFailed: Story = panel({ onAction: () => Promise.reject(new Error('The exit node refused the connection.')) });
/** Nothing offers to be an exit node. */
export const PanelNoExitNode: Story = panel({ nodes: { ...NODES, exitNodes: [], offlineExitNodes: [] } });

/** The panel where it lives: in a popover from a toolbar button. */
export const InPopover: Story = {
  render: () => (
    <Pad w={360}>
      <div className="flex h-[420px] items-start justify-end">
        <Tailnet exitNode="bretts-macbook-pro">
          <Popover defaultOpen>
            <PopoverTrigger aria-label="Tailscale connection" className={buttonVariants({ variant: 'quiet', size: 'icon' })}>
              <TailscaleMark size={18} />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <PopoverTitle className="sr-only">Tailscale</PopoverTitle>
              <PanelBody />
            </PopoverContent>
          </Popover>
        </Tailnet>
      </div>
    </Pad>
  ),
};
