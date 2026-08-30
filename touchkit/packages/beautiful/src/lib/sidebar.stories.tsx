import type { Meta, StoryObj } from '@storybook/react-vite';
import { Sidebar, SidebarInset, SidebarNav, SidebarProvider, SidebarTrigger } from './sidebar';
import { SidebarDemo } from '../demos/catalog';
import { BFONT, mut } from './base';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof Sidebar> = {
  title: 'Organisms/Beautiful Sidebar',
  component: Sidebar,
  decorators: [darkDecorator],
};
export default meta;
type Story = StoryObj<typeof Sidebar>;

const Frame = ({ variant, width = 640 }: { variant: 'docked' | 'rail' | 'float' | 'overlay'; width?: number }) => (
  <div style={{ width, height: 360, border: '1px solid var(--wb-sep)', borderRadius: 14, overflow: 'hidden' }}>
    <SidebarProvider defaultOpen={variant !== 'overlay'} breakpoint={430}>
      <SidebarNav variant={variant} />
      <SidebarInset>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderBottom: '1px solid var(--wb-sep)' }}>
          <SidebarTrigger />
          <span style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--wb-label)', fontFamily: BFONT }}>Home</span>
        </div>
        <div style={{ padding: 16, fontSize: 12.5, color: mut, lineHeight: 1.6, fontFamily: BFONT }}>
          The trigger toggles whichever variant is mounted.
        </div>
      </SidebarInset>
    </SidebarProvider>
  </div>
);

export const Docked: Story = { render: () => <Frame variant="docked" /> };
export const Rail: Story = { render: () => <Frame variant="rail" /> };
export const Float: Story = { render: () => <Frame variant="float" /> };
export const Overlay: Story = { render: () => <Frame variant="overlay" /> };
export const NarrowContainer: Story = { render: () => <Frame variant="docked" width={380} /> };
export const VariantSwitcher: Story = { render: () => <SidebarDemo /> };
