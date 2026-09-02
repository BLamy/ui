import type { Meta, StoryObj } from '@storybook/react-vite';
import { FloatingSheet, type FloatingSheetAppearance, type FloatingSheetTone } from './floating-sheet';
import { ProgressStepper } from './progress-stepper';
import { KFONT } from './chat-tokens';
import '../styles.css';

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

function Host({ tone }: { tone: FloatingSheetTone }) {
  const dark = tone !== 'light';
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        padding: 24,
        boxSizing: 'border-box',
        background: dark
          ? 'radial-gradient(circle at 30% 20%, #2b2f4a, #0f1017 60%)'
          : 'radial-gradient(circle at 30% 20%, #fff4e6, #e8ecf3 60%)',
        color: dark ? '#f5f5f7' : '#1c1c1e',
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', opacity: 0.6 }}>HOST CONTENT</div>
      <h1 style={{ margin: '8px 0 12px', fontSize: 26 }}>Anything positioned</h1>
      <p style={{ maxWidth: 320, lineHeight: 1.5, opacity: 0.75 }}>
        The sheet is a pointer-transparent layer over this box. Drag its cap up to grow it into the full page, or down to fold it away.
      </p>
    </div>
  );
}

function Demo(args: Args) {
  return (
    <div style={{ position: 'relative', width: args.width, height: args.height, overflow: 'hidden', fontFamily: KFONT }}>
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
          <div style={{ padding: '4px 20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h2 style={{ margin: 0, fontSize: 22 }}>Preparing your order</h2>
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
              <div key={i} style={{ height: 72, borderRadius: 14, background: 'rgba(120,120,128,.14)' }} />
            ))}
          </div>
        </FloatingSheet.Body>
        {args.withFoot && (
          <FloatingSheet.Foot>
            <div style={{ padding: '10px 16px 16px', display: 'flex', gap: 10 }}>
              <button type="button" style={{ flex: 1, height: 44, border: 0, borderRadius: 999, background: 'var(--tk-tint,#0a84ff)', color: '#fff', fontWeight: 700, font: 'inherit' }}>
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
