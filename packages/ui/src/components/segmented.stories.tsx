import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Segmented, SegmentedItem, type SegmentSize } from '@/components/ui/segmented';
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle';
import { Icon } from '@/lib/icon';
import { Pad } from '../stories/frame';

const meta: Meta<typeof Segmented> = {
  title: 'Atoms/Segmented',
  component: Segmented,
  args: { size: 'default', orientation: 'horizontal', disabled: false },
  argTypes: {
    size: { control: 'inline-radio', options: ['sm', 'default', 'lg'] },
    orientation: { control: 'inline-radio', options: ['horizontal', 'vertical'] },
  },
  decorators: [(Story, { parameters }) => <Pad dark={parameters.dark}><Story /></Pad>],
};
export default meta;
type Story = StoryObj<typeof Segmented>;

type Option = { value: string; label: ReactNode; disabled?: boolean; name?: string };

function Range({ options, label = 'Time range', ...props }: { options: Option[]; label?: string } & Partial<React.ComponentProps<typeof Segmented>>) {
  const [value, setValue] = useState<string | null>(options.find((o) => !o.disabled)?.value ?? null);
  return (
    <Segmented aria-label={label} value={value} onValueChange={setValue} {...props}>
      {options.map((option) => (
        <SegmentedItem key={option.value} value={option.value} disabled={option.disabled} aria-label={option.name}>{option.label}</SegmentedItem>
      ))}
    </Segmented>
  );
}

const days: Option[] = [{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }];

export const Default: Story = {
  render: (args) => <Range {...args} options={days} />,
};

export const TwoOptions: Story = {
  render: () => <Range label="List style" options={[{ value: 'plain', label: 'Plain' }, { value: 'grouped', label: 'Grouped' }]} />,
};

export const ThreeOptions: Story = { render: () => <Range options={days} /> };

/** `sm` 32px, `default` 36px, `lg` 44px: Button's heights. */
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {(['sm', 'default', 'lg'] as const).map((size) => <Range key={size} size={size} label={`Time range, ${size}`} options={days} />)}
    </div>
  ),
};

/** `w-fit` hugs the labels, so the card resizes as it slides between segments of different widths. */
export const UnequalLabels: Story = {
  render: () => (
    <Range
      className="w-fit"
      label="Repeat"
      options={[{ value: 'never', label: 'Never' }, { value: 'daily', label: 'Every day' }, { value: 'weekdays', label: 'Weekdays only' }]}
    />
  ),
};

/** Icon segments need a name of their own. */
export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Range
        className="w-fit"
        label="View as"
        options={[
          { value: 'list', name: 'List', label: <Icon name="list" size={16} /> },
          { value: 'grid', name: 'Grid', label: <Icon name="grid" size={16} /> },
          { value: 'columns', name: 'Columns', label: <Icon name="columns" size={16} /> },
        ]}
      />
      <Range
        label="Layout"
        options={[
          { value: 'list', label: <><Icon name="list" size={16} />List</> },
          { value: 'grid', label: <><Icon name="grid" size={16} />Grid</> },
        ]}
      />
    </div>
  ),
};

export const Vertical: Story = {
  render: () => <Range orientation="vertical" className="w-40" label="Sort by" options={[{ value: 'name', label: 'Name' }, { value: 'date', label: 'Date' }, { value: 'size', label: 'Size' }]} />,
};

/** A disabled segment is skipped by the arrow keys; a disabled control dims as a whole. */
export const Disabled: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <Range label="Billing" options={[{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }, { value: 'lifetime', label: 'Lifetime', disabled: true }]} />
      <Range label="Appearance" disabled options={[{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
    </div>
  ),
};

export const Dark: Story = {
  parameters: { dark: true },
  render: () => (
    <div className="flex flex-col gap-3">
      <Range options={days} />
      <Range label="Billing" options={[{ value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }, { value: 'lifetime', label: 'Lifetime', disabled: true }]} />
    </div>
  ),
};

/** In a phone frame the control keeps its look; on a touch screen each segment's hit area reaches 44px. */
export const Phone: Story = {
  render: () => <Range options={[...days, { value: 'year', label: 'Year' }]} />,
};

function LookAlikes({ size }: { size: SegmentSize }) {
  const [value, setValue] = useState('week');
  return (
    <div className="flex w-72 flex-col gap-2">
      <Segmented aria-label="Segmented" size={size} value={value} onValueChange={(v) => v && setValue(v)}>
        {days.map((d) => <SegmentedItem key={d.value} value={d.value}>{d.label}</SegmentedItem>)}
      </Segmented>
      {size === 'default' && (
        <Tabs value={value} onValueChange={(v) => v && setValue(v)}>
          <TabsList aria-label="Tabs">
            {days.map((d) => <TabsTab key={d.value} value={d.value}>{d.label}</TabsTab>)}
          </TabsList>
        </Tabs>
      )}
      <ToggleGroup
        variant="segmented" size={size} aria-label="ToggleGroup" className="w-full"
        value={[value]} deselectable={false} onValueChange={([v]) => v && setValue(v)}
      >
        {days.map((d) => <ToggleGroupItem key={d.value} value={d.value}>{d.label}</ToggleGroupItem>)}
      </ToggleGroup>
    </div>
  );
}

/** One track, three components: Segmented (radios), Tabs `variant="segmented"` (tabs; one size) and ToggleGroup
    `variant="segmented"` (pressed buttons) draw the same tray, segments and card at the same `size`. */
export const SharedTrack: Story = {
  render: () => (
    <div className="flex flex-col gap-5">
      {(['sm', 'default', 'lg'] as const).map((size) => <LookAlikes key={size} size={size} />)}
    </div>
  ),
};

export const SharedTrackDark: Story = {
  parameters: { dark: true },
  render: SharedTrack.render,
};
