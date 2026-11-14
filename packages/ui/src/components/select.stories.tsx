import type { Meta, StoryObj } from '@storybook/react-vite';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectGroup, SelectGroupLabel } from '@/components/ui/select';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Card } from '@/components/ui/card';
import { Icon } from '@/lib/icon';
import { Screen } from '../stories/primitive-frame';

const meta: Meta<typeof Select> = {
  title: 'Molecules/Select',
  component: Select,
};
export default meta;
type Story = StoryObj<typeof Select>;

const repeat = ['Never', 'Every Day', 'Every Week', 'Every 2 Weeks', 'Every Month', 'Every Year'];

function Repeat({ open, presentation }: { open?: boolean; presentation?: 'popover' | 'auto' | 'sheet' }) {
  return (
    <Field>
      <FieldLabel>Repeat</FieldLabel>
      <Select defaultOpen={open} defaultValue="Every Week" placeholder="Choose…" presentation={presentation}>
        <SelectTrigger />
        <SelectContent>
          {repeat.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
        </SelectContent>
      </Select>
    </Field>
  );
}

export const Open: Story = { render: () => <Screen h={560}><Repeat open /></Screen> };
export const Closed: Story = { render: () => <Screen h={360}><Repeat /></Screen> };
export const OpenDark: Story = { render: () => <Screen dark h={560}><Repeat open /></Screen> };

export const Groups: Story = {
  render: () => (
    <Screen h={600}>
      <Field>
        <FieldLabel>Time zone</FieldLabel>
        <Select defaultOpen placeholder="Choose a timezone">
          <SelectTrigger />
          <SelectContent>
            <SelectGroup>
              <SelectGroupLabel>Americas</SelectGroupLabel>
              <SelectItem value="pt">Pacific Time</SelectItem>
              <SelectItem value="et">Eastern Time</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectGroupLabel>Europe</SelectGroupLabel>
              <SelectItem value="gmt">Greenwich Mean Time</SelectItem>
              <SelectItem value="cet">Central European Time</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </Field>
    </Screen>
  ),
};

/** Options as data: `items` on the Select and an empty content. The button can type-select before the list has opened. */
export const FromData: Story = {
  render: () => (
    <Screen h={560}>
      <Field>
        <FieldLabel>Plan</FieldLabel>
        <Select
          defaultOpen
          defaultValue="pro"
          items={[
            { value: 'free', label: 'Free' },
            { value: 'pro', label: 'Pro' },
            { value: 'edu', label: 'Education', disabled: true },
            { type: 'separator' },
            { type: 'group', label: 'Contact sales', items: [{ value: 'enterprise', label: 'Enterprise' }] },
          ]}
        >
          <SelectTrigger />
          <SelectContent />
        </Select>
      </Field>
    </Screen>
  ),
};

export const PlainInRow: Story = {
  render: () => (
    <Screen h={420}>
      <Card className="px-4">
        <div className="flex flex-row items-center justify-between gap-2 py-1.5">
          <span className="text-[17px] text-foreground">Repeat</span>
          <Select defaultValue="Every Week">
            <SelectTrigger aria-label="Repeat" variant="plain" className="w-auto" />
            <SelectContent align="end">
              {repeat.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>
    </Screen>
  ),
};

export const Invalid: Story = {
  render: () => (
    <Screen h={300}>
      <Field invalid>
        <FieldLabel>Priority</FieldLabel>
        <Select required placeholder="Choose…">
          <SelectTrigger />
          <SelectContent>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="high">High</SelectItem>
          </SelectContent>
        </Select>
        <FieldError>Pick a priority.</FieldError>
      </Field>
    </Screen>
  ),
};

/** `presentation="sheet"`: the options slide up from the bottom of their host. */
export const Sheet: Story = { render: () => <Screen h={560}><Repeat open presentation="sheet" /></Screen> };

/** The three field sizes, beside an Input's: 32, 44 and 50px. */
export const Sizes: Story = {
  render: () => (
    <Screen h={360}>
      {(['sm', 'default', 'lg'] as const).map((size) => (
        <Select key={size} defaultValue="Every Week">
          <SelectTrigger aria-label={`Repeat, ${size}`} size={size} />
          <SelectContent>
            {repeat.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
          </SelectContent>
        </Select>
      ))}
    </Screen>
  ),
};

export const Disabled: Story = {
  render: () => (
    <Screen h={300}>
      <Field disabled>
        <FieldLabel>Repeat</FieldLabel>
        <Select defaultValue="Every Week">
          <SelectTrigger />
          <SelectContent>{repeat.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
    </Screen>
  ),
};

/** Options with an icon and a second line (the description is read as the option's description, not its name). */
export const RichOptions: Story = {
  render: () => (
    <Screen h={520}>
      <Field>
        <FieldLabel>Share with</FieldLabel>
        <Select defaultOpen defaultValue="team">
          <SelectTrigger />
          <SelectContent>
            <SelectItem value="me" icon={<Icon name="lock" size={18} />} description="Only you can open it">Private</SelectItem>
            <SelectItem value="team" icon={<Icon name="person" size={18} />} description="Everyone in Design">Team</SelectItem>
            <SelectItem value="link" icon={<Icon name="link" size={18} />} description="Anyone with the link">Public link</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </Screen>
  ),
};

/** `size="sm"` on the content: dense 32px rows, for an inspector or a settings row. */
export const DenseOptions: Story = {
  render: () => (
    <Screen h={460}>
      <Select defaultOpen defaultValue="Every Week">
        <SelectTrigger aria-label="Repeat" size="sm" />
        <SelectContent size="sm">{repeat.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
      </Select>
    </Screen>
  ),
};
