import type { Meta, StoryObj } from '@storybook/react-vite';
import { FloatingSheet, type FloatingSheetAppearance, type FloatingSheetTone } from './floating-sheet';
import { ProgressStepper } from './progress-stepper';
import '../../styles.css';

interface Args {
  width: number;
  height: number;
  appearance: FloatingSheetAppearance;
  tone: FloatingSheetTone;
  gutter: number;
  peek: number;
  minimizable: boolean;
  bodyAlign: 'start' | 'end';
  withFoot: boolean;
  defaultOpen: boolean;
}

/** The host page behind the sheet (artwork: a dark or light wash with its own ink). */
const HOST_ART = {
  dark: { background: 'radial-gradient(circle at 30% 20%, #2b2f4a, #0f1017 60%)', color: '#f5f5f7' },
  light: { background: 'radial-gradient(circle at 30% 20%, #fff4e6, #e8ecf3 60%)', color: '#1c1c1e' },
} as const;
/** Placeholder rows in the body (content). */
const ROW_FILL = 'rgba(120,120,128,.14)';

function Host({ tone }: { tone: FloatingSheetTone }) {
  return (
    <div className="absolute inset-0 box-border p-6" style={HOST_ART[tone === 'light' ? 'light' : 'dark']}>
      <div className="text-[12px] font-bold tracking-[.08em] opacity-60">HOST CONTENT</div>
      <h1 className="mt-2 mb-3 text-[26px]">Anything positioned</h1>
      <p className="max-w-[320px] leading-[1.5] opacity-75">
        The sheet is a pointer-transparent layer over this box. Drag its cap up to grow it into the full page, or down to fold it away.
      </p>
    </div>
  );
}

function Demo(args: Args) {
  return (
    <div className="relative overflow-hidden font-ios" style={{ width: args.width, height: args.height }}>
      <Host tone={args.tone} />
      <FloatingSheet
        appearance={args.appearance}
        tone={args.tone}
        gutter={args.gutter}
        peek={args.peek}
        minimizable={args.minimizable}
        bodyAlign={args.bodyAlign}
        defaultOpen={args.defaultOpen}
        radius={args.gutter === 0 ? 20 : 28}
        label="Details"
      >
        <FloatingSheet.Body>
          <div className="flex flex-col gap-3.5 px-5 pt-1 pb-6">
            <h2 className="m-0 text-[22px]">Preparing your order</h2>
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
              <div key={i} className="h-[72px] rounded-[14px]" style={{ background: ROW_FILL }} />
            ))}
          </div>
        </FloatingSheet.Body>
        {args.withFoot && (
          <FloatingSheet.Foot>
            <div className="flex gap-2.5 px-4 pt-2.5 pb-4">
              <button type="button" className="h-11 flex-1 rounded-full border-0 bg-primary [font:inherit] text-white">
                Continue
              </button>
            </div>
          </FloatingSheet.Foot>
        )}
      </FloatingSheet>
    </div>
  );
}

const meta: Meta<Args> = {
  title: 'Containers/FloatingSheet',
  render: (args) => <Demo {...args} />,
  args: {
    width: 430,
    height: 760,
    appearance: 'glass',
    tone: 'dark',
    gutter: 20,
    peek: 0,
    minimizable: true,
    bodyAlign: 'start',
    withFoot: true,
    defaultOpen: false,
  },
  argTypes: {
    appearance: { control: 'radio', options: ['glass', 'sheet'] },
    tone: { control: 'radio', options: ['auto', 'dark', 'light'] },
    bodyAlign: { control: 'radio', options: ['start', 'end'] },
  },
  parameters: {
    docs: {
      description: {
        component:
          'The generic floating surface FloatingChat is built on. Body and Foot are slots; appearance, tone, gutter, peek, and minimizable are the knobs that turn the same component into glass over a map or a docked system sheet.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<Args>;

export const Glass: Story = {};
export const GlassPeeking: Story = { args: { peek: 220 } };
export const DockedSheet: Story = {
  args: { appearance: 'sheet', tone: 'light', gutter: 0, peek: 300, minimizable: false, withFoot: false },
};
export const Open: Story = { args: { defaultOpen: true } };
