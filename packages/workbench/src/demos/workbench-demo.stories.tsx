import type { Meta, StoryObj } from '@storybook/react-vite';
import { WorkbenchDemo } from './workbench-demo';
import '../styles.css';

const meta: Meta<typeof WorkbenchDemo> = {
  title: 'Pages/Workbench',
  component: WorkbenchDemo,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof WorkbenchDemo>;

const frame = (w: number, h: number) => (args: React.ComponentProps<typeof WorkbenchDemo>) => (
  <div style={{ width: w, height: h, margin: '0 auto', overflow: 'hidden', border: '1px solid rgba(255,255,255,.1)' }}>
    <WorkbenchDemo {...args} />
  </div>
);

export const Desktop: Story = { render: frame(1280, 760) };
export const Medium: Story = { render: frame(900, 700) };
export const Phone: Story = { render: frame(390, 720) };
export const WithBrowserSurface: Story = { args: { surface: 'browser' }, render: frame(1280, 760) };
