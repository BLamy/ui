import type { CSSProperties, ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { QRCode } from '@/components/ui/qr-code';
import { Pad } from '../stories/frame';

const meta: Meta<typeof QRCode> = {
  title: 'Atoms/QRCode',
  component: QRCode,
  decorators: [(Story) => <Pad><Story /></Pad>],
};
export default meta;
type Story = StoryObj<typeof QRCode>;

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
      <QRCode value="https://example.com/albums/summer-2026" aria-label="Open shared album" />
    </Card>
  ),
};

/** Error-correction levels: higher levels survive more damage but need more modules. */
export const Levels: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
      {(['L', 'M', 'Q', 'H'] as const).map((level) => (
        <Card key={level} label={level}>
          <QRCode value="https://example.com/albums/summer-2026" level={level} size={132} />
        </Card>
      ))}
    </div>
  ),
};

/** iOS-style rounded dots and eyes (default) vs classic square modules. */
export const RoundedVsSquare: Story = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      <Card label="rounded"><QRCode value="WIFI:S:Home Network;T:WPA;P:correct-horse-battery-staple;;" size={116} /></Card>
      <Card label="square"><QRCode value="WIFI:S:Home Network;T:WPA;P:correct-horse-battery-staple;;" size={116} rounded={false} /></Card>
    </div>
  ),
};

/** Tinted modules on white, and light modules on a dark card (keep strong contrast either way). */
export const Colors: Story = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      <Card label="text-primary"><QRCode value="https://example.com" size={96} className="text-primary" /></Card>
      <Card label="white on dark" style={{ background: '#1c1c1e' }}><QRCode value="https://example.com" size={96} className="text-white" /></Card>
      <Card label="margin + background" style={{ padding: 0, overflow: 'hidden' }}>
        <QRCode value="https://example.com" size={96} background="white" margin={2} />
      </Card>
    </div>
  ),
};

/** Small codes for different values (e.g. contact IDs). */
export const Seeds: Story = {
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16 }}>
      {['ameliaadler', 'hanasato', 'linyang'].map((s) => (
        <Card key={s} style={{ padding: 10, borderRadius: 14 }}>
          <QRCode value={s} size={88} />
        </Card>
      ))}
    </div>
  ),
};

/** Text too long for a QR code at this level: an empty, `aria-invalid` box, and `onError`, instead of a crash. */
export const TooLong: Story = {
  render: () => (
    <Card label="3,000 characters at level H">
      <QRCode value={'z'.repeat(3000)} level="H" size={128} className="rounded-ctl bg-secondary" />
    </Card>
  ),
};
