import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppearanceProvider } from '@/lib/theme';
import TimeMachine from './page';

const meta: Meta<typeof TimeMachine> = {
  title: 'Blocks/Time Machine',
  component: TimeMachine,
  parameters: { layout: 'fullscreen' },
  decorators: [(Story) => <div className="h-screen w-full"><Story /></div>],
};
export default meta;

type Story = StoryObj<typeof TimeMachine>;

/** Sessions recorded by the macOS block in this browser (open Blocks/macOS first, then come back); empty until then. */
export const Sessions: Story = {};

export const Dark: Story = {
  decorators: [(Story) => <AppearanceProvider value="dark"><Story /></AppearanceProvider>],
};
