import type { Meta, StoryObj } from '@storybook/react-vite';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectSection } from './select';
import { Label } from './label';
import { FieldError } from './text-field';
import { Card } from './card';
import { Screen } from '../stories/primitive-frame';

const meta: Meta<typeof Select> = {
  title: 'Molecules/Select',
  component: Select,
};
export default meta;
type Story = StoryObj<typeof Select>;

const repeat = ['Never', 'Every Day', 'Every Week', 'Every 2 Weeks', 'Every Month', 'Every Year'];

function Repeat({ open }: { open?: boolean }) {
  return (
    <Select defaultOpen={open} defaultValue="Every Week" placeholder="Choose…">
      <Label variant="field">Repeat</Label>
      <SelectTrigger />
      <SelectContent>
        {repeat.map((r) => <SelectItem key={r} id={r}>{r}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

export const Open: Story = { render: () => <Screen h={560}><Repeat open /></Screen> };
export const Closed: Story = { render: () => <Screen h={360}><Repeat /></Screen> };
export const OpenDark: Story = { render: () => <Screen dark h={560}><Repeat open /></Screen> };

export const Sections: Story = {
  render: () => (
    <Screen h={600}>
      <Select defaultOpen placeholder="Choose a timezone">
        <Label variant="field">Time zone</Label>
        <SelectTrigger />
        <SelectContent>
          <SelectSection title="Americas">
            <SelectItem id="pt">Pacific Time</SelectItem>
            <SelectItem id="et">Eastern Time</SelectItem>
          </SelectSection>
          <SelectSection title="Europe">
            <SelectItem id="gmt">Greenwich Mean Time</SelectItem>
            <SelectItem id="cet">Central European Time</SelectItem>
          </SelectSection>
        </SelectContent>
      </Select>
    </Screen>
  ),
};

export const PlainInRow: Story = {
  render: () => (
    <Screen h={420}>
      <Card className="px-4">
        <Select defaultValue="Every Week" aria-label="Repeat" className="flex-row items-center justify-between gap-2 py-1.5">
          <span className="text-[17px] text-foreground">Repeat</span>
          <SelectTrigger variant="plain" className="w-auto" />
          <SelectContent placement="bottom end">
            {repeat.map((r) => <SelectItem key={r} id={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      </Card>
    </Screen>
  ),
};

export const Invalid: Story = {
  render: () => (
    <Screen h={300}>
      <Select isRequired isInvalid placeholder="Choose…">
        <Label variant="field">Priority</Label>
        <SelectTrigger />
        <SelectContent>
          <SelectItem id="low">Low</SelectItem>
          <SelectItem id="high">High</SelectItem>
        </SelectContent>
        <FieldError>Pick a priority.</FieldError>
      </Select>
    </Screen>
  ),
};
