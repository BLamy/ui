import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppearanceProvider } from '@/lib/theme';
import { createDemoDeviceAuth, createDeviceAuth, corsProxy } from './device-auth';
import ApplePasswords from './page';

const meta: Meta<typeof ApplePasswords> = {
  title: 'Blocks/Apple Passwords',
  component: ApplePasswords,
  parameters: { layout: 'fullscreen' },
  // The code clock stands still so frames are repeatable; pass `live: true` to watch codes roll over.
  args: { live: false },
};
export default meta;
/** The desk behind the device frames: a fixed backdrop, not a theme color. */
const DESK = '#e6e8eb';

type Story = StoryObj<typeof ApplePasswords>;

/** The block fills whatever box it's given; these stories give it the viewport or a device-sized frame. */
function Full({ children }: { children: ReactNode }) {
  return <div className="h-screen w-full">{children}</div>;
}
function Frame({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  return (
    <div className="box-border grid min-h-screen place-items-center p-4" style={{ background: DESK }}>
      <div className="overflow-hidden rounded-[28px] shadow-[0_12px_40px_black] shadow-black/18" style={{ width, height }}>{children}</div>
    </div>
  );
}
const dark = (node: ReactNode) => <AppearanceProvider value="dark">{node}</AppearanceProvider>;

export const Light: Story = { render: (args) => <Full><ApplePasswords {...args} /></Full> };

export const Dark: Story = { render: (args) => dark(<Full><ApplePasswords {...args} /></Full>) };

/** A verification code beside its countdown ring. */
export const Codes: Story = {
  args: { initialCategory: 'codes', initialItem: 'aurora' },
  render: (args) => <Full><ApplePasswords {...args} /></Full>,
};

/** Security recommendations, highest severity first. */
export const Security: Story = {
  args: { initialCategory: 'security' },
  render: (args) => dark(<Full><ApplePasswords {...args} /></Full>),
};

export const WiFi: Story = {
  args: { initialCategory: 'wifi' },
  render: (args) => <Full><ApplePasswords {...args} /></Full>,
};

/** Tablet: list and detail tiled, the sidebar floats over them from the toggle. */
export const Tablet: Story = { render: (args) => <Frame width={834} height={800}><ApplePasswords {...args} /></Frame> };

export const Phone: Story = { render: (args) => <Frame width={390} height={844}><ApplePasswords {...args} /></Frame> };

export const PhoneDark: Story = { render: (args) => dark(<Frame width={390} height={844}><ApplePasswords {...args} /></Frame>) };

/** Developer Sign-In: GitHub's device code in the sheet. The demo flow approves when you press the button. */
export const SignIn: Story = {
  args: { initialSignIn: 'github', auth: createDemoDeviceAuth({ promptDelay: 0 }) },
  render: (args) => <Full><ApplePasswords {...args} /></Full>,
};

export const SignInPhone: Story = {
  args: { initialSignIn: 'github', auth: createDemoDeviceAuth({ promptDelay: 0 }) },
  render: (args) => <Frame width={390} height={844}><ApplePasswords {...args} /></Frame>,
};

/** The real flows through almostnode's CORS proxy: the buttons sign in to your own accounts. */
export const LiveSignIn: Story = {
  args: { auth: createDeviceAuth({ fetch: corsProxy('https://almostnode-cors-proxy.langtail.workers.dev/?url=') }) },
  render: (args) => <Full><ApplePasswords {...args} /></Full>,
};
