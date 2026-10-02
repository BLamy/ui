import type { Meta, StoryObj } from '@storybook/react-vite';
import { Spinner, spinnerAnimations, type SpinnerAnimation, type SpinnerVariant } from '@/components/ui/spinner';
import { Pad } from '../stories/frame';

const meta: Meta<typeof Spinner> = {
  title: 'Atoms/Spinner',
  component: Spinner,
  decorators: [(Story) => <Pad><div style={{ color: 'var(--muted-foreground)' }}><Story /></div></Pad>],
};
export default meta;
type Story = StoryObj<typeof Spinner>;

export const Spinning: Story = { args: { spin: true } };
export const Idle: Story = { args: { spin: false } };
export const Large: Story = { args: { spin: true, size: 36 } };

/** Every animation with every variant, in the text color. Reduced motion (as in the screenshots) holds a still frame. */
export const Gallery: Story = {
  decorators: [(Story) => <Pad w={440}><div style={{ color: 'var(--foreground)' }}><Story /></div></Pad>],
  render: () => (
    <div className="grid gap-3 p-3">
      {spinnerAnimations.map((a) => (
        <div key={a.id} className="grid grid-cols-[72px_1fr] items-center gap-2">
          <span className="text-footnote font-semibold">{a.label}</span>
          <div className="flex flex-wrap gap-5">
            {a.variants.length === 0
              ? <Spinner spin size={28} />
              : a.variants.map((v) => <Spinner key={v} animation={a.id as SpinnerAnimation} variant={v as SpinnerVariant} size={28} />)}
          </div>
        </div>
      ))}
    </div>
  ),
};

/** BL UI's own loaders at a larger size, first variant of each. */
export const Originals: Story = {
  decorators: [(Story) => <Pad w={520}><div style={{ color: 'var(--foreground)' }}><Story /></div></Pad>],
  render: () => (
    <div className="grid grid-cols-4 gap-4 p-3">
      {spinnerAnimations.slice(8).map((a) => (
        <div key={a.id} className="grid justify-items-center gap-1.5">
          <Spinner animation={a.id} size={56} />
          <span className="text-caption2">{a.label}</span>
        </div>
      ))}
    </div>
  ),
};

export const Orbit: Story = { args: { animation: 'orbit', size: 64 } };
export const Sizes: Story = {
  render: () => (
    <div className="flex items-end gap-4 p-3">
      {[12, 20, 32, 64, 96].map((size) => <Spinner key={size} animation="beacon" size={size} />)}
    </div>
  ),
};
export const Tinted: Story = {
  render: () => (
    <div className="flex items-center gap-5 p-3">
      <span className="text-primary"><Spinner animation="matrix" size={40} /></span>
      <span className="text-destructive"><Spinner animation="lift" size={40} /></span>
      <span className="text-success"><Spinner animation="cells" size={40} /></span>
    </div>
  ),
};
