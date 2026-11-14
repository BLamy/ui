import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import { TextMorph } from '@/components/ui/text-morph';
import { Pad } from '../stories/frame';

const meta: Meta<typeof TextMorph> = {
  title: 'Atoms/TextMorph',
  component: TextMorph,
  args: { children: 'Continue' },
  decorators: [(Story, { parameters }) => <Pad w={420} dark={!!parameters.dark}><Story /></Pad>],
};
export default meta;
type Story = StoryObj<typeof TextMorph>;

const WORDS = ['Continue', 'Confirm', 'Sending…', 'Sent', ''];

function Cycle({ className }: { className?: string }) {
  const [i, setI] = useState(0);
  return (
    <div className="flex flex-col items-start gap-4">
      <Button onClick={() => setI((i + 1) % 4)}>{WORDS[i]}</Button>
      <div className="text-title font-bold"><TextMorph className={className}>{WORDS[i]}</TextMorph></div>
      <Button variant="secondary" size="sm" onClick={() => setI((i + 1) % WORDS.length)}>Next (includes empty)</Button>
    </div>
  );
}

/** Press the button: shared letters slide, the rest blur out and in, the box springs to the new width. */
export const Default: Story = { render: () => <Cycle /> };
/** Box utilities apply at rest and while morphing alike (it is always an inline-block). */
export const Boxed: Story = { render: () => <Cycle className="rounded-ctl bg-secondary px-2" /> };
/** `truncate` works: the root is a box, not `display: contents`. */
export const Truncated: Story = {
  render: () => <div className="flex w-40 min-w-0"><TextMorph className="truncate">A label much too long for its row</TextMorph></div>,
};
export const Dark: Story = { parameters: { dark: true }, render: () => <Cycle /> };
