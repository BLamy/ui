import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppearanceProvider } from '@/lib/theme';
import AppleReminders from './page';

const meta: Meta<typeof AppleReminders> = {
  title: 'Blocks/Apple Reminders',
  component: AppleReminders,
  parameters: { layout: 'fullscreen' },
};
export default meta;
/** The desk behind the device frames: a fixed backdrop, not a theme color. */
const DESK = '#e6e8eb';

type Story = StoryObj<typeof AppleReminders>;

/** The block fills whatever box it's given; these stories give it the viewport, a tablet or a phone-sized frame. */
function Full({ children }: { children: ReactNode }) {
  return <div className="h-screen w-full">{children}</div>;
}
function Device({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  return (
    <div className="box-border grid min-h-screen place-items-center p-4" style={{ background: DESK }}>
      <div className="overflow-hidden rounded-[28px] shadow-[0_12px_40px_black] shadow-black/18" style={{ width, height }}>{children}</div>
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
