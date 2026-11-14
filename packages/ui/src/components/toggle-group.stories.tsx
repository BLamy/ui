import type { Meta, StoryObj } from '@storybook/react-vite';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof ToggleGroup> = {
  title: 'Molecules/ToggleGroup',
  component: ToggleGroup,
  decorators: [(Story) => <Panel><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof ToggleGroup>;

const B = () => <span className="font-bold">B</span>;
const I = () => <span className="font-serif italic">I</span>;
const U = () => <span className="underline">U</span>;
const S = () => <span className="line-through">S</span>;

function Format({ variant }: { variant: 'default' | 'filled' | 'outline' }) {
  return (
    <ToggleGroup variant={variant} multiple defaultValue={['bold', 'italic']} aria-label="Text formatting">
      <ToggleGroupItem value="bold" aria-label="Bold"><B /></ToggleGroupItem>
      <ToggleGroupItem value="italic" aria-label="Italic"><I /></ToggleGroupItem>
      <ToggleGroupItem value="underline" aria-label="Underline"><U /></ToggleGroupItem>
      <ToggleGroupItem value="strike" aria-label="Strikethrough"><S /></ToggleGroupItem>
    </ToggleGroup>
  );
}

function Align({ variant }: { variant: 'default' | 'filled' | 'outline' }) {
  return (
    <ToggleGroup variant={variant} deselectable={false} defaultValue={['left']} aria-label="Alignment">
      <ToggleGroupItem value="left">Left</ToggleGroupItem>
      <ToggleGroupItem value="center">Center</ToggleGroupItem>
      <ToggleGroupItem value="right">Right</ToggleGroupItem>
    </ToggleGroup>
  );
}

const all = (
  <div className="flex flex-col items-start gap-4">
    <Format variant="default" />
    <Format variant="filled" />
    <Format variant="outline" />
    <Align variant="filled" />
    <Align variant="outline" />
    <ToggleGroup size="sm" variant="outline" defaultValue={['day']} aria-label="Range">
      <ToggleGroupItem value="day">Day</ToggleGroupItem>
      <ToggleGroupItem value="week">Week</ToggleGroupItem>
      <ToggleGroupItem value="month">Month</ToggleGroupItem>
    </ToggleGroup>
  </div>
);

export const Multiple: Story = { render: () => <Format variant="default" /> };
export const Single: Story = { render: () => <Align variant="filled" /> };
export const Variants: Story = { render: () => all };
export const Dark: Story = { decorators: [(Story) => <Panel dark><Story /></Panel>], render: () => all };
