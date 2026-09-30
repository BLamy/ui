import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@/components/ui/button';
import { TextMorph } from '@/components/ui/text-morph';
import { NumberMorph } from '@/components/ui/number-morph';
import { Chevron, IconSwap, type ChevronDirection } from '@/components/ui/icon-swap';
import { AnimatedHeight, ContentSwap } from '@/components/ui/animated-height';
import { Celebrate } from '@/components/ui/celebrate';
import { Icon } from '@/lib/icon';
import { useDirection } from '@/lib/motion';
import { Pad } from '../stories/frame';

/* Motion primitives — the pieces the kit's animated components are built from (see lib/motion.ts). */
const meta: Meta = {
  title: 'Atoms/Motion',
  decorators: [(Story) => <Pad w={420}><Story /></Pad>],
};
export default meta;
type Story = StoryObj;

const WORDS = ['Continue', 'Confirm', 'Sending…', 'Sent'];

/** Shared letters slide to their new places; the rest blur out and in; the button springs to the new width. */
export const TextMorphLabel: Story = {
  render: () => {
    const [i, setI] = useState(0);
    return (
      <div className="flex flex-col items-start gap-4">
        <Button onPress={() => setI((i + 1) % WORDS.length)}>{WORDS[i]}</Button>
        <div className="text-[28px] font-bold tracking-[-.4px]"><TextMorph>{WORDS[i]}</TextMorph></div>
      </div>
    );
  },
};

/** Digits roll by place (up when rising, down when falling); separators slide as digits arrive. */
export const NumberMorphRoll: Story = {
  render: () => {
    const [v, setV] = useState(1234.5);
    return (
      <div className="flex flex-col items-start gap-4">
        <div className="text-[40px] font-bold tracking-[-.6px]">
          <NumberMorph value={v} format={{ style: 'currency', currency: 'USD' }} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onPress={() => setV((x) => x * 10 + 7)}>×10 + 7</Button>
          <Button size="sm" variant="secondary" onPress={() => setV((x) => Math.floor(x / 10))}>÷10</Button>
          <Button size="sm" variant="secondary" onPress={() => setV((x) => x + 1)}>+1</Button>
          <Button size="sm" variant="secondary" onPress={() => setV((x) => x - 1)}>−1</Button>
        </div>
      </div>
    );
  },
};

/** Icons swap in place (copy → check); a chevron rotates to its new direction the short way round. */
export const IconsInPlace: Story = {
  render: () => {
    const [copied, setCopied] = useState(false);
    const dirs: ChevronDirection[] = ['right', 'down', 'left', 'up'];
    const [d, setD] = useState(0);
    return (
      <div className="flex items-center gap-4">
        <Button variant="secondary" onPress={() => setCopied((c) => !c)}>
          <IconSwap id={copied ? 'check' : 'copy'}>
            <Icon name={copied ? 'check' : 'layers'} size={18} sw={2.2} />
          </IconSwap>
          <TextMorph>{copied ? 'Copied' : 'Copy'}</TextMorph>
        </Button>
        <Button variant="secondary" aria-label="Turn" onPress={() => setD((x) => (x + 1) % 4)}>
          <Chevron direction={dirs[d]} />
        </Button>
      </div>
    );
  },
};

const STEPS = [
  { title: 'Send', body: 'Choose who to pay.' },
  { title: 'Amount', body: 'Enter an amount. Your balance is $2,480.00, and fees are shown before you confirm anything at all.' },
  { title: 'Review', body: 'To Wei Chen · $120.00. Network fee $0.12. Arrives in about a minute. Nothing leaves your wallet until you confirm on the next step.' },
];

/** A tray whose height morphs between steps while the content slides in the direction of travel. */
export const TrayHeight: Story = {
  render: () => {
    const [step, setStep] = useState(0);
    const dir = useDirection(step);
    const s = STEPS[step];
    return (
      <div className="rounded-[24px] bg-card p-1 shadow-[0_12px_40px_--alpha(black/14%),0_0_0_1px_var(--border)]">
        <AnimatedHeight>
          <ContentSwap id={step} direction={dir}>
            <div className="p-4">
              <div className="text-[18px] font-bold">{s.title}</div>
              <p className="mt-1 mb-3 text-[15px] text-muted-foreground">{s.body}</p>
            </div>
          </ContentSwap>
        </AnimatedHeight>
        <div className="flex gap-2 px-4 pb-4">
          <Button variant="secondary" isDisabled={step === 0} onPress={() => setStep(step - 1)}>Back</Button>
          <Button className="flex-1" onPress={() => setStep((step + 1) % STEPS.length)}>{step === STEPS.length - 1 ? 'Confirm' : 'Continue'}</Button>
        </div>
      </div>
    );
  },
};

/** A rare moment: confetti and a ring out of the button's centre. */
export const CelebrateBurst: Story = {
  render: () => {
    const [n, setN] = useState(0);
    return (
      <div className="grid place-items-center py-10">
        <span className="relative isolate">
          <Button size="lg" onPress={() => setN((x) => x + 1)}>Back up wallet</Button>
          <Celebrate fire={n} />
        </span>
      </div>
    );
  },
};
