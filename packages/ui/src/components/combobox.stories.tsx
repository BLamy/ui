import { useEffect, useRef, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ComboBox, ComboBoxInput, ComboBoxContent, ComboBoxItem } from './combobox';
import { Label } from './label';
import { FieldDescription } from './text-field';
import { Screen } from '../stories/primitive-frame';

const meta: Meta<typeof ComboBox> = {
  title: 'Molecules/ComboBox',
  component: ComboBox,
};
export default meta;
type Story = StoryObj<typeof ComboBox>;

const cities = ['Amsterdam', 'Barcelona', 'Berlin', 'Copenhagen', 'Lisbon', 'London', 'Madrid', 'Paris', 'Prague', 'San Francisco', 'Seoul', 'Tokyo'];

/** ComboBox has no defaultOpen; focus the field once (menuTrigger="focus") so the story shows the list. */
function OpenOnMount({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const t = setTimeout(() => ref.current?.querySelector<HTMLInputElement>('input')?.focus(), 150);
    return () => clearTimeout(t);
  }, []);
  return <div ref={ref}>{children}</div>;
}

function City({ input, list = cities }: { input?: string; list?: string[] }) {
  return (
    <ComboBox defaultInputValue={input} menuTrigger="focus">
      <Label variant="field">City</Label>
      <ComboBoxInput placeholder="Search cities" />
      <FieldDescription>Type to filter; arrow keys to move.</FieldDescription>
      <ComboBoxContent>
        {list.map((c) => <ComboBoxItem key={c} id={c}>{c}</ComboBoxItem>)}
      </ComboBoxContent>
    </ComboBox>
  );
}

export const Open: Story = { render: () => <Screen h={560}><OpenOnMount><City /></OpenOnMount></Screen> };
export const Filtered: Story = { render: () => <Screen h={420}><OpenOnMount><City input="B" list={cities.filter((c) => c.startsWith('B'))} /></OpenOnMount></Screen> };
export const Closed: Story = { render: () => <Screen h={300}><City /></Screen> };
export const OpenDark: Story = { render: () => <Screen dark h={560}><OpenOnMount><City /></OpenOnMount></Screen> };
