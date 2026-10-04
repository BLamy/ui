import { useEffect, useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { createTailscale } from '@/lib/tailscale';
import { AppearanceProvider } from '@/lib/theme';
import { createDemoTailnet, HOME, NOTES, PUBLIC_SITE, type DemoTailnetOptions } from './data';
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
function Connected({ exitNode, ...props }: SafariProps & { exitNode?: DemoTailnetOptions['exitNode'] }) {
  const [controller] = useState(() => createTailscale({ ...createDemoTailnet({ exitNode }).options, auth: { mode: 'auth-key', authKey: 'demo' } }));
  useEffect(() => {
    const off = controller.activate();
    void controller.signIn();
    return () => { off(); void controller.dispose(); };
  }, [controller]);
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

/** A public address with no exit node set: Safari picks the online one itself, then loads the page through it. */
export const ThroughAnExitNode: Story = { render: (args) => <Full><Connected {...args} initialUrls={[`http://${PUBLIC_SITE}/`]} /></Full> };

/** A tailnet that offers no exit node: the public address fails, and the page says why. Nothing is requested from the public internet. */
export const NotOnTheTailnet: Story = { render: (args) => <Full><Connected {...args} exitNode="none" initialUrls={[`http://${PUBLIC_SITE}/`]} /></Full> };

/** The only exit node is offline: nothing is picked, and the page says so. */
export const ExitNodeOffline: Story = { render: (args) => <Full><Connected {...args} exitNode="offline" initialUrls={[`http://${PUBLIC_SITE}/`]} /></Full> };

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
