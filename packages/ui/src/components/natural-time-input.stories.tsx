import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { NaturalTimeInput, type NaturalTimeInputProps } from '@/components/ui/natural-time-input';
import { Pad } from '../stories/frame';

/* "Now" (Wednesday 9 September 2026, 12:00 in Dhaka) and the zone are pinned so the previews are the same on every
   run; the parser runs on the CPU, so these stories look the same with or without WebGPU. Each story is the control
   in a Field, the way an app writes it. */
const pinned = { reference: '2026-09-09T12:00:00+06:00', timeZone: 'Asia/Dhaka', locale: 'en-US' } as const;

type Args = NaturalTimeInputProps & { label?: ReactNode; description?: ReactNode; invalid?: boolean; error?: ReactNode };

function InField({ label = 'When', description, invalid, error, ...props }: Args) {
  return (
    <Field name="when" invalid={invalid} disabled={props.disabled}>
      <FieldLabel>{label}</FieldLabel>
      <NaturalTimeInput {...props} />
      {description ? <FieldDescription>{description}</FieldDescription> : null}
      <FieldError>{error}</FieldError>
    </Field>
  );
}

/** The control's own props, without the Field's. */
function withoutField(args: Args): NaturalTimeInputProps {
  const props: Args = { ...args };
  delete props.label;
  delete props.description;
  delete props.invalid;
  delete props.error;
  return props;
}

const meta: Meta<Args> = {
  title: 'Molecules/NaturalTimeInput',
  component: NaturalTimeInput,
  render: (args) => <InField {...args} />,
  args: { description: 'Try “tomorrow at 3pm” or “every other tuesday”.', variant: 'card', showBackend: false, maxOccurrences: 5, ...pinned },
  argTypes: {
    variant: { control: 'inline-radio', options: ['card', 'plain'] },
    size: { control: 'inline-radio', options: ['sm', 'default', 'lg'] },
    maxOccurrences: { control: { type: 'number', min: 1, max: 10 } },
  },
  decorators: [(Story) => <Pad w={440}><Story /></Pad>],
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = { args: { defaultValue: 'Sat Sun 1pm-8pm Mon 10pm-12am' } };

export const Empty: Story = {};

/** The whole text is recognised, so the preview skips the highlighted copy of it and goes straight to the chip. */
export const Recurrence: Story = { args: { label: 'Repeats', defaultValue: 'every weekday at 9am', showBackend: true, maxOccurrences: 4 } };

export const PositionInMonth: Story = { args: { label: 'Repeats', defaultValue: 'the first monday of every month at 10am', maxOccurrences: 3 } };

/** Only part of the text is a time: the recognised words are highlighted. */
export const Highlighting: Story = { args: { defaultValue: 'lunch with Amelia thurs 12-1pm, bring the slides' } };

export const Diagnostics: Story = { args: { label: 'Range', defaultValue: '1-3pm' } };

export const NothingFound: Story = { args: { defaultValue: 'gibberish xyz' } };

export const WrongWithoutWarning: Story = {
  name: 'Wrong without a warning',
  args: { label: 'A time written as 1930', defaultValue: 'at 1930', description: 'Read as the year 1930 with no diagnostic: check the list.' },
};

export const DayFirst: Story = { args: { label: 'Day first', parse: { dateOrder: 'DMY' }, defaultValue: 'dinner on 3/4' } };

/** The app's own rule, through the Field: `invalid` and a FieldError. */
export const Invalid: Story = { args: { invalid: true, error: 'Pick a time in the future.', defaultValue: 'yesterday at noon' } };

/** A parser failure marks the control invalid and says why under it. */
export const BadTimeZone: Story = { args: { timeZone: 'Not/AZone', defaultValue: 'tomorrow', description: undefined } };

export const Plain: Story = { args: { variant: 'plain', defaultValue: 'every other tuesday' } };

export const Small: Story = { args: { size: 'sm', defaultValue: 'tomorrow at 3pm' } };

export const Large: Story = { args: { size: 'lg', defaultValue: 'tomorrow at 3pm' } };

export const Disabled: Story = { args: { disabled: true, defaultValue: 'tomorrow at 3pm' } };

/** Without a Field: the box names itself "Date or time". */
export const Standalone: Story = { render: (args) => <NaturalTimeInput {...withoutField(args)} />, args: { defaultValue: 'next friday at 6pm' } };

export const Dark: Story = {
  decorators: [(Story) => <Pad w={440} dark><Story /></Pad>],
  args: { defaultValue: 'every weekday at 9am', maxOccurrences: 3 },
};
