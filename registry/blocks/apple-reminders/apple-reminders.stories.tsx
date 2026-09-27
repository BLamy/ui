import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppearanceProvider } from '@brett_lamy/ui';
import AppleReminders from './page';

const meta: Meta<typeof AppleReminders> = {
  title: 'Blocks/Apple Reminders',
  component: AppleReminders,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof AppleReminders>;

/** The block fills whatever box it's given; these stories give it the viewport, a tablet or a phone-sized frame. */
function Full({ children }: { children: ReactNode }) {
  return <div style={{ height: '100vh', width: '100%' }}>{children}</div>;
}
function Device({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: '#e6e8eb', padding: 16, boxSizing: 'border-box' }}>
      <div style={{ width, height, borderRadius: 28, overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,.18)' }}>{children}</div>
    </div>
  );
}
const dark = (node: ReactNode) => <AppearanceProvider value="dark">{node}</AppearanceProvider>;

/** Sidebar with smart lists and My Lists, Today open. */
export const Desktop: Story = { render: (args) => <Full><AppleReminders {...args} /></Full> };
/** A list with sections, tinted green. */
export const DesktopDark: Story = { args: { initialList: 'groceries' }, render: (args) => dark(<Full><AppleReminders {...args} /></Full>) };

export const Tablet: Story = { args: { initialList: 'work' }, render: (args) => <Device width={834} height={760}><AppleReminders {...args} /></Device> };
export const TabletDark: Story = { args: { initialList: 'scheduled' }, render: (args) => dark(<Device width={834} height={760}><AppleReminders {...args} /></Device>) };

/** iPhone: the lists screen. */
export const Phone: Story = { render: (args) => <Device width={390} height={844}><AppleReminders {...args} /></Device> };
export const PhoneDark: Story = { render: (args) => dark(<Device width={390} height={844}><AppleReminders {...args} /></Device>) };

/** iPhone, pushed into a list. */
export const PhoneList: Story = { args: { initialList: 'family', openList: true }, render: (args) => <Device width={390} height={844}><AppleReminders {...args} /></Device> };
