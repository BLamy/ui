import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof Textarea> = {
  title: 'Atoms/Textarea',
  component: Textarea,
  args: { placeholder: 'Message', size: 'default', 'aria-label': 'Message' },
  argTypes: { size: { control: 'inline-radio', options: ['sm', 'default', 'lg'] } },
  decorators: [(Story) => <Panel><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof Textarea>;

export const Default: Story = {};

/** The minimum heights: `sm` 64px, `default` 96px, `lg` 144px. */
export const Sizes: Story = {
  render: () => (
    <>
      <Textarea size="sm" aria-label="Small" placeholder="Small" />
      <Textarea aria-label="Default" placeholder="Default" />
      <Textarea size="lg" aria-label="Large" placeholder="Large" />
    </>
  ),
};

/** Grows with its text from its minimum up to `max-h-48`, then scrolls. */
export const AutoResize: Story = {
  args: {
    autoResize: true,
    className: 'max-h-48',
    defaultValue: 'Hey! Are we still on for Friday?\nI can bring the slides.\nAnd the projector, if the room has none.\nLet me know by Thursday.',
  },
};

function Shortcut() {
  const [sent, setSent] = useState<string[]>([]);
  return (
    <>
      <Textarea aria-label="Reply" size="sm" placeholder="⌘ Enter sends" submitShortcut="mod+enter" onSubmit={(value) => setSent((list) => [...list, value])} />
      <p className="m-0 px-1 text-footnote text-foreground/70">{sent.length ? `Sent: ${sent.at(-1)}` : 'Nothing sent yet.'}</p>
    </>
  );
}

/** `submitShortcut="mod+enter"`: ⌘ Enter (Ctrl Enter elsewhere) calls `onSubmit(value)`. */
export const SubmitShortcut: Story = { render: () => <Shortcut /> };

function Counted() {
  const [bio, setBio] = useState('Designer in Lisbon.');
  return (
    <Field name="bio" invalid={bio.length > 80 || undefined}>
      <FieldLabel>Bio</FieldLabel>
      <Textarea size="sm" value={bio} onValueChange={setBio} />
      <FieldDescription>{bio.length} / 80</FieldDescription>
      <FieldError match>Keep it under 80 characters.</FieldError>
    </Field>
  );
}

/** In a Field with a live counter: over 80 characters the Field is invalid and the FieldError shows. */
export const InField: Story = { render: () => <Counted /> };

export const States: Story = {
  render: () => (
    <>
      <Textarea aria-label="Invalid" aria-invalid defaultValue="Too short" size="sm" />
      <Textarea aria-label="Read-only" readOnly defaultValue="Signed by the reviewer." size="sm" />
      <Textarea aria-label="Disabled" disabled defaultValue="Disabled" size="sm" />
    </>
  ),
};

export const Dark: Story = { decorators: [(Story) => <Panel dark><Story /></Panel>], render: () => <Counted /> };
