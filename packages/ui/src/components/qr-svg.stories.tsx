import type { CSSProperties, ReactNode } from 'react';
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

const Card = ({ children, style, label }: { children: ReactNode; style?: CSSProperties; label?: string }) => (
  <div style={{ display: 'inline-grid', justifyItems: 'center', gap: 8 }}>
    <div style={{ display: 'inline-grid', placeItems: 'center', padding: 16, borderRadius: 20, background: '#fff', color: '#111', boxShadow: '0 0 0 1px var(--border)', ...style }}>
      {children}
    </div>
    {label ? <span className="text-[12px] text-muted-foreground">{label}</span> : null}
  </div>
);

/** A real, scannable QR code (point a phone camera at it). The white card provides the quiet zone. */
export const Default: Story = {
  render: () => (
    <Card>
      <QRSvg value="https://example.com/albums/summer-2026" title="Open shared album" />
    </Card>
  ),
};

/** Error-correction levels: higher levels survive more damage but need more modules. */
export const Levels: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      {(['L', 'M', 'Q', 'H'] as const).map((level) => (
        <Card key={level} label={level}>
          <QRSvg value="https://example.com/albums/summer-2026" level={level} size={132} />
        </Card>
      ))}
    </div>
  ),
};

/** iOS-style rounded dots and eyes (default) vs classic square modules. */
export const RoundedVsSquare: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 16 }}>
      <Card label="rounded"><QRSvg value="WIFI:S:Home Network;T:WPA;P:correct-horse-battery-staple;;" /></Card>
      <Card label="square"><QRSvg value="WIFI:S:Home Network;T:WPA;P:correct-horse-battery-staple;;" rounded={false} /></Card>
    </div>
  ),
};

/** Tinted modules on white, and light modules on a dark card (keep strong contrast either way). */
export const Colors: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 16 }}>
      <Card label="tint"><QRSvg value="https://example.com" color="var(--primary)" /></Card>
      <Card label="white on dark" style={{ background: '#1c1c1e' }}><QRSvg value="https://example.com" color="#fff" /></Card>
      <Card label="margin + background" style={{ padding: 0, overflow: 'hidden' }}>
        <QRSvg value="https://example.com" background="#fff" margin={2} />
      </Card>
    </div>
  ),
};

/** Small codes for different values (e.g. contact IDs). */
export const Seeds: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 16 }}>
      {['ameliaadler', 'hanasato', 'linyang'].map((s) => (
        <Card key={s} style={{ padding: 10, borderRadius: 14 }}>
          <QRSvg value={s} size={88} />
        </Card>
      ))}
    </div>
  ),
};
