import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppearanceProvider } from '@brett_lamy/ui';
import AppleSettings from './page';

const meta: Meta<typeof AppleSettings> = {
  title: 'Blocks/Apple Settings',
  component: AppleSettings,
  parameters: { layout: 'fullscreen' },
};
export default meta;
/** The desk behind the device frames: a fixed backdrop, not a theme color. */
const DESK = '#e6e8eb';

type Story = StoryObj<typeof AppleSettings>;

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

/** macOS System Settings: sidebar and toolbar detail. */
export const Desktop: Story = { args: { initialPath: ['wifi'] }, render: (args) => <Full><AppleSettings {...args} /></Full> };
export const DesktopDark: Story = { args: { initialPath: ['display'] }, render: (args) => dark(<Full><AppleSettings {...args} /></Full>) };

/** iPad: sidebar and a navigation stack in the detail column. */
export const Tablet: Story = { args: { initialPath: ['notifications'] }, render: (args) => <Device width={834} height={760}><AppleSettings {...args} /></Device> };
export const TabletDark: Story = { args: { initialPath: ['screentime'] }, render: (args) => dark(<Device width={834} height={760}><AppleSettings {...args} /></Device>) };

/** iPhone: the large-title root list. */
export const Phone: Story = { render: (args) => <Device width={390} height={844}><AppleSettings {...args} /></Device> };
export const PhoneDark: Story = { render: (args) => dark(<Device width={390} height={844}><AppleSettings {...args} /></Device>) };

/** iPhone, drilled into General › About. */
export const PhoneDrillDown: Story = { args: { initialPath: ['general', 'about'] }, render: (args) => <Device width={390} height={844}><AppleSettings {...args} /></Device> };
