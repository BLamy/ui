import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import { AnimatedHeight } from '@/components/ui/animated-height';
import { Swap } from '@/components/ui/swap';
import { Icon } from '@/lib/icon';
import { useDirection } from '@/lib/motion';
import { Pad } from '../stories/frame';

const meta: Meta<typeof Swap> = {
  title: 'Atoms/Swap',
  component: Swap,
  decorators: [(Story, { parameters }) => <Pad w={400} appearance={parameters.dark ? 'dark' : 'light'}><Story /></Pad>],
};
export default meta;
type Story = StoryObj<typeof Swap>;

function PopDemo() {
  const [on, setOn] = useState(false);
  return (
    <div className="flex items-center gap-3">
      <Button variant="secondary" onClick={() => setOn((x) => !x)}>
        <Swap effect="pop" value={on ? 'check' : 'copy'}>
          <Icon name={on ? 'check' : 'copy'} size={18} sw={2.2} />
        </Swap>
        {on ? 'Copied' : 'Copy'}
      </Button>
      <Button size="icon" variant="secondary" aria-label={on ? 'Pause' : 'Play'} onClick={() => setOn((x) => !x)}>
        <Swap effect="pop" value={on ? 'pause' : 'play'}><Icon name={on ? 'pause' : 'play'} size={18} /></Swap>
      </Button>
    </div>
  );
}

/** `effect="pop"`: a glyph shrinks and blurs out as the next grows in, in one inline cell. Press to swap. */
export const Pop: Story = { render: () => <PopDemo /> };

const STEPS = ['Choose who to pay.', 'Enter an amount. Fees are shown before you confirm anything.', 'To Wei Chen · $120.00. Arrives in about a minute; nothing leaves your wallet until you confirm.'];

function SlideDemo({ distance, blur }: { distance?: number; blur?: number }) {
  const [step, setStep] = useState(0);
  const dir = useDirection(step);
  return (
    <div className="grid gap-3">
      <div className="rounded-card bg-card p-4 shadow-hairline">
        <AnimatedHeight>
          <Swap value={step} direction={dir} distance={distance} blur={blur}>
            <div className="text-title font-semibold">Step {step + 1}</div>
            <p className="m-0 mt-1 text-subhead text-muted-foreground">{STEPS[step]}</p>
          </Swap>
        </AnimatedHeight>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
        <Button disabled={step === STEPS.length - 1} onClick={() => setStep(step + 1)}>Next</Button>
      </div>
    </div>
  );
}

/** `effect="slide"` (the default) inside AnimatedHeight: the view travels in the direction of the change. */
export const Slide: Story = { render: () => <SlideDemo /> };

/** A short travel and a stronger blur: the dialog title morph between views. */
export const TitleMorph: Story = {
  render: () => {
    const [i, setI] = useState(0);
    const titles = ['Sign in', 'Check your email', 'Choose a password'];
    return (
      <div className="grid gap-3">
        <Swap value={i} direction={1} distance={18} blur={6} className="text-title font-semibold">{titles[i]}</Swap>
        <Button variant="secondary" onClick={() => setI((i + 1) % titles.length)}>Next title</Button>
      </div>
    );
  },
};

/** `direction={0}`: a cross-fade with a small scale, for content that has no order (loading → loaded). */
export const CrossFade: Story = {
  render: () => {
    const [loaded, setLoaded] = useState(false);
    return (
      <div className="grid gap-3">
        <Swap value={loaded ? 'loaded' : 'loading'} className="rounded-card bg-card p-4 shadow-hairline">
          {loaded ? <p className="m-0 text-body">Three new messages.</p> : <div className="h-6 w-40 rounded-ctl bg-secondary" />}
        </Swap>
        <Button variant="secondary" onClick={() => setLoaded((x) => !x)}>Toggle</Button>
      </div>
    );
  },
};

export const Dark: Story = { parameters: { dark: true }, render: () => <div className="grid gap-6"><PopDemo /><SlideDemo /></div> };
