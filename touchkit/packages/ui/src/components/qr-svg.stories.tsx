import type { Meta, StoryObj } from '@storybook/react-vite';
import { QRSvg } from './qr-svg';
import { Pad } from '../stories/frame';

const meta: Meta<typeof QRSvg> = {
  title: 'Atoms/QRSvg',
  component: QRSvg,
  decorators: [(Story) => <Pad><Story /></Pad>],
};
export default meta;
type Story = StoryObj<typeof QRSvg>;

/** Deterministic decorative QR-look SVG (seed-stable, not scannable). */
export const Default: Story = {
  render: () => (
    <div style={{ display: 'inline-grid', placeItems: 'center', padding: 16, borderRadius: 20, background: '#fff', color: '#111', boxShadow: '0 0 0 1px var(--tk-sep)' }}>
      <QRSvg seed="weichen" />
    </div>
  ),
};

export const Seeds: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 16 }}>
      {['ameliaadler', 'hanasato', 'linyang'].map((s) => (
        <div key={s} style={{ padding: 10, borderRadius: 14, background: '#fff', color: '#111', boxShadow: '0 0 0 1px var(--tk-sep)' }}>
          <QRSvg seed={s} size={88} />
        </div>
      ))}
    </div>
  ),
};
