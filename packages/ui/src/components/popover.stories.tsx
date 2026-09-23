import type { Meta, StoryObj } from '@storybook/react-vite';
import { PopoverTrigger, PopoverContent } from './popover';
import { Button } from './button';
import { Heading } from 'react-aria-components';
import { TextField } from './text-field';
import { Label } from './label';
import { Input } from './input';
import { Slider } from './slider';
import { Screen } from '../stories/primitive-frame';

const meta: Meta<typeof PopoverContent> = {
  title: 'Molecules/Popover',
  component: PopoverContent,
};
export default meta;
type Story = StoryObj<typeof PopoverContent>;

function Dimensions({ open = true }: { open?: boolean }) {
  return (
    <PopoverTrigger defaultOpen={open}>
      <Button variant="secondary">Dimensions</Button>
      <PopoverContent placement="bottom start">
        <Heading slot="title" className="m-0 text-[17px] font-semibold text-foreground">Dimensions</Heading>
        <p className="mt-1 mb-3 text-[13px] text-muted-foreground">Set the size of the layer.</p>
        <div className="flex flex-col gap-3">
          <TextField defaultValue="320"><Label variant="field">Width</Label><Input size="sm" /></TextField>
          <TextField defaultValue="auto"><Label variant="field">Height</Label><Input size="sm" /></TextField>
          <Slider label="Opacity" showValue defaultValue={80} />
        </div>
      </PopoverContent>
    </PopoverTrigger>
  );
}

export const Open: Story = { render: () => <Screen h={520}><div><Dimensions /></div></Screen> };
export const OpenDark: Story = { render: () => <Screen dark h={520}><div><Dimensions /></div></Screen> };
export const Closed: Story = { render: () => <Screen h={260}><div><Dimensions open={false} /></div></Screen> };
