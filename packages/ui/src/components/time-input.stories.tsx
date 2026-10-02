import type { Meta, StoryObj } from '@storybook/react-vite';
import { TimeInput } from '@/components/ui/time-input';
import { Pad } from '../stories/frame';

/* "Now" (Wednesday 9 September 2026, 12:00 in Dhaka) and the zone are pinned so the previews are the same on every
   run; the parser runs on the CPU, so these stories look the same with or without WebGPU. */
const pinned = { reference: '2026-09-09T12:00:00+06:00', timeZone: 'Asia/Dhaka', locale: 'en-US' } as const;

const meta: Meta<typeof TimeInput> = {
  title: 'Molecules/TimeInput',
  component: TimeInput,
  args: { label: 'When', description: 'Try “tomorrow at 3pm” or “every other tuesday”.', variant: 'card', showBackend: false, maxOccurrences: 5, ...pinned },
  argTypes: {
    variant: { control: 'inline-radio', options: ['card', 'plain'] },
    dateOrder: { control: 'inline-radio', options: ['MDY', 'DMY'] },
    size: { control: 'inline-radio', options: ['sm', 'default', 'lg'] },
    maxOccurrences: { control: { type: 'number', min: 1, max: 10 } },
  },
  decorators: [(Story) => <Pad w={440}><Story /></Pad>],
};
export default meta;
type Story = StoryObj<typeof TimeInput>;

export const Default: Story = { args: { defaultValue: 'Sat Sun 1pm-8pm Mon 10pm-12am' } };

export const Empty: Story = {};

export const Recurrence: Story = { args: { label: 'Repeats', defaultValue: 'every weekday at 9am', showBackend: true, maxOccurrences: 4 } };

export const PositionInMonth: Story = { args: { label: 'Repeats', defaultValue: 'the first monday of every month at 10am', maxOccurrences: 3 } };

export const Highlighting: Story = { args: { defaultValue: 'lunch with Amelia thurs 12-1pm, bring the slides' } };

export const Diagnostics: Story = { args: { label: 'Range', defaultValue: '1-3pm' } };

export const NothingFound: Story = { args: { defaultValue: 'gibberish xyz' } };

export const WrongWithoutWarning: Story = {
  name: 'Wrong without a warning',
  args: { label: 'A time written as 1930', defaultValue: 'at 1930', description: 'Read as the year 1930 with no diagnostic: check the list.' },
};

export const DayFirst: Story = { args: { label: 'Day first', dateOrder: 'DMY', defaultValue: 'dinner on 3/4' } };

export const Invalid: Story = { args: { isInvalid: true, errorMessage: 'Pick a time in the future.', defaultValue: 'yesterday at noon' } };

export const BadTimeZone: Story = { args: { timeZone: 'Not/AZone', defaultValue: 'tomorrow', description: undefined } };

export const Plain: Story = { args: { variant: 'plain', defaultValue: 'every other tuesday' } };

export const Large: Story = { args: { size: 'lg', defaultValue: 'tomorrow at 3pm' } };

export const Disabled: Story = { args: { isDisabled: true, defaultValue: 'tomorrow at 3pm' } };

export const Dark: Story = {
  decorators: [(Story) => <Pad w={440} dark><Story /></Pad>],
  args: { defaultValue: 'every weekday at 9am', maxOccurrences: 3 },
};
