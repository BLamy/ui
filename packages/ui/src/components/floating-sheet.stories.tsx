import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  FloatingSheet,
  FloatingSheetBody,
  FloatingSheetFab,
  FloatingSheetFooter,
  type FloatingSheetAppearance,
  type FloatingSheetCollapse,
  type FloatingSheetFabAlign,
  type FloatingSheetFabSide,
  type FloatingSheetVariant,
} from '@/components/ui/floating-sheet';
import { Button } from '@/components/ui/button';
import { ProgressStepper } from '@/components/ui/progress-stepper';
import { SheetBack, SheetHeader, SheetTitle, SheetView } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { Phone } from '../stories/frame';
import { Icon } from '@/lib/icon';
import '../styles.css';

interface Args {
  variant: FloatingSheetVariant;
  appearance: FloatingSheetAppearance;
  gutter: number;
  peek: number;
  collapse: FloatingSheetCollapse;
  bodyAlign: 'start' | 'end';
  fabSide: FloatingSheetFabSide;
  fabAlign: FloatingSheetFabAlign;
  withFooter: boolean;
  defaultOpen: boolean;
  defaultMinimized: boolean;
  snapPoints?: number[];
}

/** The host page behind the sheet, in the page's tokens, with colour behind the glass so its blur reads. */
function Host() {
  return (
    <div className="absolute inset-0 box-border overflow-hidden bg-muted p-6 text-foreground">
      <div aria-hidden className="absolute -top-16 -left-10 size-72 rounded-full bg-primary/35 blur-3xl" />
      <div aria-hidden className="absolute top-1/2 -right-16 size-72 rounded-full bg-success/30 blur-3xl" />
      <div className="relative">
        <div className="text-caption font-bold tracking-wider text-muted-foreground uppercase">Host content</div>
        <h1 className="mt-2 mb-3 text-title font-bold">Anything positioned</h1>
        <p className="max-w-80 text-body text-muted-foreground">
          The sheet is a pointer-transparent layer over this box. Drag its cap up to grow it into the full page, or down to fold it away.
        </p>
      </div>
    </div>
  );
}

function Demo(args: Args) {
  return (
    // A phone-sized frame that shrinks with the viewport, so `--size 390x844` shows the sheet in a real phone box.
    <div className="relative h-[min(760px,100dvh)] w-full max-w-[430px] overflow-hidden font-sans">
      <Host />
      <FloatingSheet
        variant={args.variant}
        appearance={args.appearance}
        gutter={args.gutter}
        peek={args.peek}
        collapse={args.collapse}
        bodyAlign={args.bodyAlign}
        defaultOpen={args.defaultOpen}
        defaultMinimized={args.defaultMinimized}
        snapPoints={args.snapPoints}
        aria-label="Order"
      >
        <FloatingSheetBody>
          <div className="flex flex-col gap-3.5 px-5 pt-1 pb-6">
            <h2 className="m-0 text-title font-bold">Preparing your order</h2>
            <ProgressStepper
              current={1}
              steps={[
                { id: 'a', label: 'Placed' },
                { id: 'b', label: 'Preparing' },
                { id: 'c', label: 'Ready' },
                { id: 'd', label: 'Picked up' },
              ]}
              labels
            />
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-[72px] rounded-card bg-secondary" />
            ))}
          </div>
        </FloatingSheetBody>
        {args.withFooter ? (
          <FloatingSheetFooter>
            <div className="flex gap-2.5 px-4 pt-2.5 pb-4">
              <Button size="pill" className="flex-1">Continue</Button>
            </div>
          </FloatingSheetFooter>
        ) : null}
        <FloatingSheetFab side={args.fabSide} align={args.fabAlign} aria-label="Show order"><Icon name="cart" size={22} /></FloatingSheetFab>
      </FloatingSheet>
    </div>
  );
}

const meta: Meta<Args> = {
  title: 'Organisms/FloatingSheet',
  render: (args) => <Demo {...args} />,
  args: {
    variant: 'glass',
    appearance: 'auto',
    gutter: 10,
    peek: 0,
    collapse: 'fab',
    bodyAlign: 'start',
    fabSide: 'bottom',
    fabAlign: 'center',
    withFooter: true,
    defaultOpen: false,
    defaultMinimized: false,
  },
  argTypes: {
    variant: { control: 'radio', options: ['glass', 'card'] },
    appearance: { control: 'radio', options: ['auto', 'light', 'dark'] },
    collapse: { control: 'radio', options: ['fab', 'hide', 'none'] },
    bodyAlign: { control: 'radio', options: ['start', 'end'] },
    fabSide: { control: 'radio', options: ['top', 'bottom', 'start', 'end'] },
    fabAlign: { control: 'radio', options: ['start', 'center', 'end'] },
  },
  parameters: {
    docs: {
      description: {
        component:
          'A card that rests over a page and grows into it: UI SDK’s Drawer with snap points at the peek and full height, modal only above the peek. FloatingSheetBody grows, FloatingSheetFooter stays pinned, and a drag below rest folds it into its FloatingSheetFab. ArtifactChatContainer floats its chat on it.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

/** Glass at rest on its cap and footer, following the page's appearance (try the dark toolbar toggle). */
export const Glass: Story = {};
/** A peek keeps part of the body visible above the footer. */
export const GlassPeeking: Story = { args: { peek: 220 } };
/** The opaque card at rest: the same 10px inset and sheet radius as Dialog's tray. */
export const Card: Story = { args: { variant: 'card', peek: 160 } };
/** Edge to edge, like a system sheet; no FAB. */
export const DockedSheet: Story = {
  args: { variant: 'card', gutter: 0, peek: 300, collapse: 'none', withFooter: false },
};
/** Grown to the top of its host over the scrim. */
export const Open: Story = { args: { defaultOpen: true } };
/** Folded into its FAB (drag below rest to get here). */
export const Minimized: Story = { args: { defaultMinimized: true } };
/** The FAB on the end edge, at the bottom. */
export const MinimizedAtEnd: Story = { args: { defaultMinimized: true, fabSide: 'end', fabAlign: 'end' } };
/** A half-height stop between the peek and full. */
export const WithSnapPoint: Story = { args: { peek: 120, snapPoints: [0.5] } };
/** A dark sheet over a light page: the appearance disagrees with the page. */
export const DarkOverLightPage: Story = { args: { appearance: 'dark', peek: 220 } };

/* ── Trays: a flow in one sheet (`view`), written with Sheet's flow parts straight in the body ── */

const traySteps = [
  { id: 'placed', label: 'Placed' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'ready', label: 'Ready' },
];

const trays: { id: string; title: string; peek: number; body: ReactNode }[] = [
  {
    id: 'review',
    title: 'Review order',
    peek: 120,
    body: (
      <div className="grid gap-2 text-subhead">
        <div className="flex justify-between"><span>2× Flat white</span><strong>$9.00</strong></div>
        <div className="flex justify-between"><span>1× Almond croissant</span><strong>$4.75</strong></div>
      </div>
    ),
  },
  {
    id: 'pay',
    title: 'Pay with',
    peek: 230,
    body: (
      <div className="grid gap-2">
        {['Apple Pay', 'Visa ···· 4242', 'Add a card'].map((m, i) => (
          <div key={m} className={cn('rounded-ctl bg-secondary px-3.5 py-3 text-subhead', i === 0 && 'font-semibold')}>{m}</div>
        ))}
      </div>
    ),
  },
  { id: 'done', title: 'Order placed', peek: 110, body: <ProgressStepper steps={traySteps} current={1} labels /> },
];

/** Each step sets its own `peek`, so the sheet springs between heights; the bar title and the view travel the way
    the flow moves, and SheetBack folds in once there is a step to go back to. */
function TraysDemo({ dark }: { dark?: boolean }) {
  const [step, setStep] = useState(0);
  const tray = trays[step];
  const last = step === trays.length - 1;
  return (
    <Phone h={640} appearance={dark ? 'dark' : 'light'}>
      <div className="absolute inset-0 overflow-hidden font-sans"><Host /></div>
      <FloatingSheet view={tray.id} peek={tray.peek} variant="card" collapse="none" aria-label="Checkout" hideOnScroll={false}>
        <FloatingSheetBody>
          <SheetHeader variant="bar" className="pt-1">
            <SheetBack hidden={step === 0} onClick={() => setStep(step - 1)} />
            <SheetTitle>{tray.title}</SheetTitle>
          </SheetHeader>
          <SheetView className="px-5 pb-5">{tray.body}</SheetView>
        </FloatingSheetBody>
        <FloatingSheetFooter>
          <div className="flex px-4 pt-2 pb-4">
            <Button size="pill" className="flex-1" onClick={() => setStep(last ? 0 : step + 1)}>{last ? 'Start over' : 'Continue'}</Button>
          </div>
        </FloatingSheetFooter>
      </FloatingSheet>
    </Phone>
  );
}

/** Presses Continue once, so the second step (taller, with its back button in the bar) shows. */
const continueOnce: Story['play'] = async ({ canvasElement }) => {
  const button = [...canvasElement.querySelectorAll('button')].find((b) => b.textContent === 'Continue');
  button?.click();
  await new Promise((resolve) => setTimeout(resolve, 600));
};

/** A flow (`view`): the first tray. */
export const TraysFirstStep: Story = { render: () => <TraysDemo /> };
/** The second tray, after one Continue: taller, with SheetBack in the bar. */
export const Trays: Story = { render: () => <TraysDemo />, play: continueOnce };
export const TraysDark: Story = { render: () => <TraysDemo dark />, play: continueOnce };
