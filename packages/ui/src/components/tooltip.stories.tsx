import type { Meta, StoryObj } from '@storybook/react-vite';
import { Tooltip, TooltipContent, TooltipShortcut, TooltipTrigger } from '@/components/ui/tooltip';
import { buttonVariants } from '@/components/ui/button';
import { Icon } from '@/lib/icon';
import { Screen } from '../stories/primitive-frame';

const meta: Meta<typeof TooltipContent> = {
  title: 'Molecules/Tooltip',
  component: TooltipContent,
};
export default meta;
type Story = StoryObj<typeof TooltipContent>;

function Demo({ side = 'top', open = true, shortcut }: { side?: 'top' | 'bottom' | 'start' | 'end'; open?: boolean; shortcut?: string }) {
  return (
    <div className="grid h-40 place-items-center">
      <Tooltip defaultOpen={open} shortcut={shortcut}>
        <TooltipTrigger className={buttonVariants({ variant: 'secondary', size: 'icon' })}><Icon name="layers" size={18} /></TooltipTrigger>
        <TooltipContent side={side}>Share to Files{shortcut ? <TooltipShortcut /> : null}</TooltipContent>
      </Tooltip>
    </div>
  );
}

export const Top: Story = { render: () => <Screen h={260}><Demo /></Screen> };
export const Bottom: Story = { render: () => <Screen h={260}><Demo side="bottom" /></Screen> };
export const End: Story = { render: () => <Screen h={260}><Demo side="end" /></Screen> };
export const Shortcut: Story = { render: () => <Screen h={260}><Demo shortcut="mod+shift+s" /></Screen> };
export const Dark: Story = { render: () => <Screen dark h={260}><Demo /></Screen> };
export const HoverToOpen: Story = { render: () => <Screen h={260}><Demo open={false} /></Screen> };
