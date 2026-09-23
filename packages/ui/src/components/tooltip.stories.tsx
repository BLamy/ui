import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tooltip, TooltipTrigger } from './tooltip';
import { Button } from './button';
import { Icon } from '../lib/icon';
import { Screen } from '../stories/primitive-frame';

const meta: Meta<typeof Tooltip> = {
  title: 'Molecules/Tooltip',
  component: Tooltip,
};
export default meta;
type Story = StoryObj<typeof Tooltip>;

function Demo({ placement = 'top', open = true }: { placement?: 'top' | 'bottom' | 'start' | 'end'; open?: boolean }) {
  return (
    <div className="grid h-40 place-items-center">
      <TooltipTrigger defaultOpen={open}>
        <Button variant="secondary" size="icon" aria-label="Share"><Icon name="layers" size={18} /></Button>
        <Tooltip placement={placement}>Share to Files</Tooltip>
      </TooltipTrigger>
    </div>
  );
}

export const Top: Story = { render: () => <Screen h={260}><Demo /></Screen> };
export const Bottom: Story = { render: () => <Screen h={260}><Demo placement="bottom" /></Screen> };
export const End: Story = { render: () => <Screen h={260}><Demo placement="end" /></Screen> };
export const Dark: Story = { render: () => <Screen dark h={260}><Demo /></Screen> };
export const HoverToOpen: Story = { render: () => <Screen h={260}><Demo open={false} /></Screen> };
