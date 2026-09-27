import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppearanceProvider } from '@brett_lamy/ui';
import ApplePasswords from './page';

const meta: Meta<typeof ApplePasswords> = {
  title: 'Blocks/Apple Passwords',
  component: ApplePasswords,
  parameters: { layout: 'fullscreen' },
  // The code clock stands still so frames are repeatable; pass `live: true` to watch codes roll over.
  args: { live: false },
};
export default meta;
type Story = StoryObj<typeof ApplePasswords>;

/** The block fills whatever box it's given; these stories give it the viewport or a device-sized frame. */
function Full({ children }: { children: ReactNode }) {
  return <div style={{ height: '100vh', width: '100%' }}>{children}</div>;
}
function Frame({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: '#e6e8eb', padding: 16, boxSizing: 'border-box' }}>
      <div style={{ width, height, borderRadius: 28, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,.18)' }}>{children}</div>
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
