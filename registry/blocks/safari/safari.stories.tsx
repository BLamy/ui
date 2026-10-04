import { useEffect, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { createTailscale } from '@/lib/tailscale';
import { AppearanceProvider } from '@/lib/theme';
import { createDemoTailnet, EXIT_NODE_ID, HOME, NOTES, PUBLIC_SITE } from './data';
import Safari, { type SafariProps } from './page';

const meta: Meta<typeof Safari> = {
  title: 'Blocks/Safari',
  component: Safari,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof Safari>;

function Full({ children }: { children: ReactNode }) {
  return <div className="h-screen w-full">{children}</div>;
}
function Device({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  return (
    <div className="box-border grid min-h-screen place-items-center p-4">
      <div className="overflow-hidden rounded-[24px] shadow-black/18 shadow-lg" style={{ width, height }}>{children}</div>
    </div>
  );
}

/** Safari on a simulated tailnet that is already signed in (an auth key), as a person arrives on a later visit. These stories
    use the simulation on purpose: the block's own default is the real Tailscale. */
function Connected({ exitNode, ...props }: SafariProps & { exitNode?: boolean }) {
  const [controller] = useState(() => createTailscale({ ...createDemoTailnet().options, auth: { mode: 'auth-key', authKey: 'demo' } }));
  useEffect(() => {
    const off = controller.activate();
    void controller.signIn();
    let cancelled = false;
    // Choose the exit node as soon as the net map lists it.
    const unsubscribe = exitNode ? controller.subscribe(() => {
      const s = controller.getSnapshot();
      if (!cancelled && s.status === 'connected' && !s.exitNodeId && s.peers.some((p) => p.id === EXIT_NODE_ID)) void controller.setExitNode(EXIT_NODE_ID);
    }) : () => {};
    return () => { cancelled = true; unsubscribe(); off(); void controller.dispose(); };
  }, [controller, exitNode]);
  return <Safari {...props} controller={controller} />;
}

/** The first thing anyone sees: nothing works until Tailscale is connected. (Real Tailscale: nothing loads until sign-in is pressed.) */
export const Gate: Story = { render: (args) => <Full><Safari {...args} /></Full> };

/** Signed in, on the start page: the devices on the tailnet and the report. */
export const StartPage: Story = { render: (args) => <Full><Connected {...args} /></Full> };

/** A page fetched through the tailnet: its stylesheet and images were fetched the same way and inlined. */
export const Browsing: Story = { render: (args) => <Full><Connected {...args} initialUrls={[`http://${HOME}/`]} /></Full> };

/** Two tabs: the tab strip appears. */
export const Tabs: Story = { render: (args) => <Full><Connected {...args} initialUrls={[`http://${HOME}/`, `http://${NOTES}/`]} /></Full> };

/** A public address with no exit node chosen fails, and the error page offers the exit node. Nothing is requested from the public internet. */
export const NotOnTheTailnet: Story = { render: (args) => <Full><Connected {...args} initialUrls={[`http://${PUBLIC_SITE}/`]} /></Full> };

/** With the exit node chosen, the same public address loads, through it. */
export const ThroughAnExitNode: Story = { render: (args) => <Full><Connected {...args} exitNode initialUrls={[`http://${PUBLIC_SITE}/`]} /></Full> };

export const Dark: Story = {
  render: (args) => (
    <AppearanceProvider value="dark">
      <Full><Connected {...args} /></Full>
    </AppearanceProvider>
  ),
};

export const GateDark: Story = {
  render: (args) => (
    <AppearanceProvider value="dark">
      <Full><Safari {...args} /></Full>
    </AppearanceProvider>
  ),
};

/** Narrow: the tab strip steps aside for the overview button. */
export const Phone: Story = { render: (args) => <Device width={390} height={720}><Connected {...args} initialUrls={[`http://${NOTES}/`]} /></Device> };
