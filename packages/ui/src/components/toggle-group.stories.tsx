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
    <ToggleGroup variant={variant} selectionMode="multiple" defaultSelectedKeys={['bold', 'italic']} aria-label="Text formatting">
      <ToggleGroupItem id="bold" aria-label="Bold"><B /></ToggleGroupItem>
      <ToggleGroupItem id="italic" aria-label="Italic"><I /></ToggleGroupItem>
      <ToggleGroupItem id="underline" aria-label="Underline"><U /></ToggleGroupItem>
      <ToggleGroupItem id="strike" aria-label="Strikethrough"><S /></ToggleGroupItem>
    </ToggleGroup>
  );
}

function Align({ variant }: { variant: 'default' | 'filled' | 'outline' }) {
  return (
    <ToggleGroup variant={variant} selectionMode="single" disallowEmptySelection defaultSelectedKeys={['left']} aria-label="Alignment">
      <ToggleGroupItem id="left">Left</ToggleGroupItem>
      <ToggleGroupItem id="center">Center</ToggleGroupItem>
      <ToggleGroupItem id="right">Right</ToggleGroupItem>
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
    <ToggleGroup size="sm" variant="outline" selectionMode="single" defaultSelectedKeys={['day']} aria-label="Range">
      <ToggleGroupItem id="day">Day</ToggleGroupItem>
      <ToggleGroupItem id="week">Week</ToggleGroupItem>
      <ToggleGroupItem id="month">Month</ToggleGroupItem>
    </ToggleGroup>
  </div>
);

export const Multiple: Story = { render: () => <Format variant="default" /> };
export const Single: Story = { render: () => <Align variant="filled" /> };
export const Variants: Story = { render: () => all };
export const Dark: Story = { decorators: [(Story) => <Panel dark><Story /></Panel>], render: () => all };
