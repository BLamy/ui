import type { Meta, StoryObj } from '@storybook/react-vite';
import { BLProvider } from '@/lib/theme';
import ReplayDebuggerPage from './page';

const meta: Meta<typeof ReplayDebuggerPage> = {
  title: 'Blocks/ReplayDebugger',
  component: ReplayDebuggerPage,
  parameters: { layout: 'fullscreen' },
  args: { startAt: 12, empty: false },
  decorators: [
    (Story) => (
      <BLProvider>
        <Story />
      </BLProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof ReplayDebuggerPage>;

export const Wide: Story = {
  render: (args) => (
    <div className="h-[720px] w-full">
      <ReplayDebuggerPage {...args} />
    </div>
  ),
};

export const NarrowWindow: Story = {
  render: (args) => (
    <div className="h-[720px] w-[390px] max-w-full">
      <ReplayDebuggerPage {...args} />
    </div>
  ),
};

export const Dark: Story = {
  decorators: [
    (Story) => (
      <BLProvider appearance="dark">
        <Story />
      </BLProvider>
    ),
  ],
  render: (args) => (
    <div className="h-[720px] w-full">
      <ReplayDebuggerPage {...args} />
    </div>
  ),
};

export const Empty: Story = {
  args: { empty: true },
  render: (args) => (
    <div className="h-[720px] w-full">
      <ReplayDebuggerPage {...args} />
    </div>
  ),
};
