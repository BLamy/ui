import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CronEditor, type CronEditorProps } from '@/components/ui/cron-editor';
import { Pad } from '../stories/frame';

/* "Now" (Friday 2 October 2026, 10:00 UTC) and the zone are pinned so the next runs are the same on every run.
   The plain-English box needs WebGPU: where the browser has none (a headless test run, Safari today) the stories show
   the note that replaces it. The raw editor, description, presets and next runs are local and always shown. */
const pinned = { from: '2026-10-02T10:00:00Z', timeZone: 'UTC', locale: 'en-US' } as const;

const meta: Meta<typeof CronEditor> = {
  title: 'Molecules/CronEditor',
  component: CronEditor,
  args: { variant: 'card', naturalLanguage: true, nextRunCount: 5, ...pinned },
  argTypes: {
    variant: { control: 'inline-radio', options: ['card', 'plain'] },
    nextRunCount: { control: { type: 'number', min: 1, max: 10 } },
  },
  decorators: [(Story) => <Pad w={440}><Story /></Pad>],
};
export default meta;
type Story = StoryObj<typeof CronEditor>;

export const Default: Story = { args: { defaultValue: '0 9 * * 1-5' } };

function ControlledEditor(args: CronEditorProps) {
  const [cron, setCron] = useState('*/15 9-17 * * mon-fri');
  return (
    <div className="grid gap-3">
      <CronEditor {...args} value={cron} onValueChange={setCron} />
      <p className="m-0 px-1 text-footnote text-foreground/70">Value: <code>{cron}</code></p>
    </div>
  );
}

/** A controlled editor: the value lives in the parent. */
export const Controlled: Story = { render: (args) => <ControlledEditor {...args} /> };

export const RawOnly: Story = { args: { naturalLanguage: false, defaultValue: '30 2 1,15 * *' } };

export const Empty: Story = { args: { naturalLanguage: false } };

export const InvalidFields: Story = {
  name: 'Invalid fields',
  args: { naturalLanguage: false, defaultValue: '60 24 * 13 funday' },
};

export const MissingFields: Story = { args: { naturalLanguage: false, defaultValue: '0 9' } };

export const NeverMatches: Story = {
  name: 'Never matches a date',
  args: { naturalLanguage: false, defaultValue: '0 0 30 2 *' },
};

export const DayOfMonthOrDayOfWeek: Story = {
  name: 'Day of month or day of week',
  args: { naturalLanguage: false, defaultValue: '0 0 13 * 5', description: 'Both day fields are set, so it runs on the 13th and on Fridays.' },
};

export const DaylightSaving: Story = {
  name: 'Daylight saving gap',
  args: { naturalLanguage: false, defaultValue: '30 2 * * *', from: '2026-03-06T12:00:00Z', timeZone: 'America/New_York', nextRunCount: 4 },
};

export const CustomPresets: Story = {
  args: {
    naturalLanguage: false,
    defaultValue: '0 2 * * *',
    presets: [
      { label: 'Nightly backup', value: '0 2 * * *' },
      { label: 'Every 15 minutes', value: '*/15 * * * *' },
      { label: 'Weekends at 10:00', value: '0 10 * * sat,sun' },
    ],
  },
};

export const NoPresets: Story = { args: { naturalLanguage: false, presets: false, defaultValue: '@daily' } };

export const Plain: Story = { args: { variant: 'plain', defaultValue: '0 9 * * 1-5' } };

export const Disabled: Story = { args: { isDisabled: true, defaultValue: '0 9 * * 1-5' } };

export const Dark: Story = {
  decorators: [(Story) => <Pad w={440} dark><Story /></Pad>],
  args: { defaultValue: '0 9 * * 1-5' },
};
