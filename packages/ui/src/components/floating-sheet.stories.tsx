import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  FloatingSheet,
  FloatingSheetBody,
  FloatingSheetFab,
  FloatingSheetFoot,
  type FloatingSheetAppearance,
  type FloatingSheetCollapse,
  type FloatingSheetFabAlign,
  type FloatingSheetFabSide,
  type FloatingSheetVariant,
} from '@/components/ui/floating-sheet';
import { Button } from '@/components/ui/button';
import { ProgressStepper } from '@/components/ui/progress-stepper';
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
  withFoot: boolean;
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
        fabSide={args.fabSide}
        fabAlign={args.fabAlign}
        defaultOpen={args.defaultOpen}
        defaultMinimized={args.defaultMinimized}
        snapPoints={args.snapPoints}
        radius={args.gutter === 0 ? 20 : 28}
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
        {args.withFoot ? (
          <FloatingSheetFoot>
            <div className="flex gap-2.5 px-4 pt-2.5 pb-4">
              <Button size="pill" className="flex-1">Continue</Button>
            </div>
          </FloatingSheetFoot>
        ) : null}
        <FloatingSheetFab aria-label="Show order"><Icon name="cart" size={22} /></FloatingSheetFab>
      </FloatingSheet>
    </div>
  );
}

const meta: Meta<Args> = {
  title: 'Containers/FloatingSheet',
  render: (args) => <Demo {...args} />,
  args: {
    variant: 'glass',
    appearance: 'auto',
    gutter: 20,
    peek: 0,
    collapse: 'fab',
    bodyAlign: 'start',
    fabSide: 'bottom',
    fabAlign: 'center',
    withFoot: true,
    defaultOpen: false,
    defaultMinimized: false,
  },
  argTypes: {
    variant: { control: 'radio', options: ['glass', 'sheet'] },
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
          'A card that rests over a page and grows into it: UI SDK’s Drawer with snap points at the peek and full height, modal only above the peek. FloatingSheetBody grows, FloatingSheetFoot stays pinned, and a drag below rest folds it into its FloatingSheetFab. ArtifactChatContainer floats its chat on it.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

/** Glass at rest on its cap and foot, following the page's appearance (try the dark toolbar toggle). */
export const Glass: Story = {};
/** A peek keeps part of the body visible above the foot. */
export const GlassPeeking: Story = { args: { peek: 220 } };
/** The opaque card inside a gutter. */
export const Card: Story = { args: { variant: 'sheet', peek: 160 } };
/** Edge to edge, like a system sheet; no FAB. */
export const DockedSheet: Story = {
  args: { variant: 'sheet', gutter: 0, peek: 300, collapse: 'none', withFoot: false },
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
