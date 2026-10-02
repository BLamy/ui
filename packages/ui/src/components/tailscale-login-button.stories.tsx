import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { TailscaleLoginButton, TailscaleStatusBadge } from '@/components/ui/tailscale-login-button';
import type { TailscaleStatus } from '@/lib/tailscale';
import { createFakeTailscaleClient } from '@/lib/tailscale-fake';
import { TailscaleProvider } from '@/lib/tailscale-react';
import { Pad } from '../stories/frame';

const meta: Meta<typeof TailscaleLoginButton> = {
  title: 'Molecules/TailscaleLoginButton',
  component: TailscaleLoginButton,
  args: { variant: 'default', size: 'default' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['default', 'outline', 'secondary'] },
    size: { control: 'inline-radio', options: ['sm', 'default', 'lg', 'pill'] },
  },
};
export default meta;
type Story = StoryObj<typeof TailscaleLoginButton>;

/* States are driven by props (no client); `Live` runs the in-memory fake tailnet. */
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

export const Variants: Story = {
  render: () => (
    <Pad>
      <div className="grid justify-items-start gap-3">
        <TailscaleLoginButton status="idle" onSignIn={noop} />
        <TailscaleLoginButton status="idle" variant="outline" onSignIn={noop} />
        <TailscaleLoginButton status="idle" variant="secondary" size="sm" onSignIn={noop} />
        <TailscaleLoginButton status="idle" size="pill" onSignIn={noop} />
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

export const Live: Story = {
  render: (args) => (
    <Pad>
      <LiveDemo {...args} />
    </Pad>
  ),
};
