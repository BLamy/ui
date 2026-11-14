import type { Meta, StoryObj } from '@storybook/react-vite';
import { Popover, PopoverArrow, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { buttonVariants } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Screen } from '../stories/primitive-frame';

const meta: Meta<typeof PopoverContent> = {
  title: 'Molecules/Popover',
  component: PopoverContent,
};
export default meta;
type Story = StoryObj<typeof PopoverContent>;

function Dimensions({ open = true, arrow = false, presentation }: { open?: boolean; arrow?: boolean; presentation?: 'sheet' }) {
  return (
    <Popover defaultOpen={open} presentation={presentation}>
      <PopoverTrigger className={buttonVariants({ variant: 'secondary' })}>Dimensions</PopoverTrigger>
      <PopoverContent align="start">
        {arrow ? <PopoverArrow /> : null}
        <PopoverTitle>Dimensions</PopoverTitle>
        <PopoverDescription className="mt-1 mb-3">Set the size of the layer.</PopoverDescription>
        <div className="flex flex-col gap-3">
          <Field><FieldLabel variant="field">Width</FieldLabel><Input size="sm" defaultValue="320" /></Field>
          <Field><FieldLabel variant="field">Height</FieldLabel><Input size="sm" defaultValue="auto" /></Field>
          <Slider label="Opacity" showValue defaultValue={80} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const Open: Story = { render: () => <Screen h={520}><div><Dimensions /></div></Screen> };
export const OpenDark: Story = { render: () => <Screen dark h={520}><div><Dimensions /></div></Screen> };
export const Arrow: Story = { render: () => <Screen h={520}><div><Dimensions arrow /></div></Screen> };
/** `presentation="sheet"`: the same content as a bottom sheet (`"auto"` picks it in a compact container). */
export const AsSheet: Story = { render: () => <Screen h={520}><div><Dimensions presentation="sheet" /></div></Screen> };
export const Closed: Story = { render: () => <Screen h={260}><div><Dimensions open={false} /></div></Screen> };
