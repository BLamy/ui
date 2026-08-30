import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Credenza } from './credenza';
import { Icon } from '../lib/icon';
import { PillButton } from './pill-button';
import { QRSvg } from './qr-svg';
import { Phone } from '../stories/frame';

const meta: Meta<typeof Credenza> = {
  title: 'Organisms/Credenza',
  component: Credenza,
};
export default meta;
type Story = StoryObj<typeof Credenza>;

const TITLES: Record<string, string> = { menu: 'Share Contact', qr: 'QR Code', done: 'Shared' };

function Views({ view, go, onClose }: { view: string; go: (v: string) => void; onClose: () => void }) {
  if (view === 'qr') return (
    <div style={{ padding: '12px 20px 20px', textAlign: 'center' }}>
      <div style={{ display: 'inline-grid', placeItems: 'center', padding: 16, borderRadius: 20, background: '#fff', color: '#111', boxShadow: '0 0 0 1px var(--tk-sep)' }}>
        <QRSvg seed="weichen" /></div>
      <div style={{ fontSize: 13, color: 'var(--tk-label2)', margin: '12px 0 14px', lineHeight: 1.45 }}>Scanning adds Wei Chen — name, phone, and email.</div>
      <PillButton label="Save to Photos" onPress={() => go('done')} />
    </div>
  );
  if (view === 'done') return (
    <div style={{ padding: '18px 20px 22px', textAlign: 'center' }}>
      <span style={{ display: 'inline-grid', placeItems: 'center', width: 54, height: 54, borderRadius: '50%', background: 'var(--tk-green)', color: '#fff', marginBottom: 10 }}><Icon name="check" size={26} sw={3} /></span>
      <div style={{ fontSize: 17, fontWeight: 700 }}>Card shared</div>
      <div style={{ fontSize: 13, color: 'var(--tk-label2)', margin: '4px 0 16px' }}>Wei Chen is on the way.</div>
      <PillButton label="Done" onPress={onClose} />
    </div>
  );
  return (
    <div style={{ padding: '10px 16px 14px' }}>
      <div style={{ fontSize: 13, color: 'var(--tk-label2)', margin: '0 2px 10px' }}>Pick how to share Wei's card.</div>
      {[['pulse', 'QR Code', 'Scan in person', 'qr'], ['mail', 'Export vCard', 'Send the .vcf anywhere', 'done']].map(([icon, t, d, target]) => (
        <button key={t} className="tk-btn tk-hl" onClick={() => go(target)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12, width: '100%', border: 0, textAlign: 'left', background: 'var(--tk-fill)',
            borderRadius: 14, padding: '11px 12px', marginBottom: 8, cursor: 'pointer', fontFamily: 'inherit', color: 'var(--tk-label)', boxSizing: 'border-box',
          }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--tk-card)', display: 'grid', placeItems: 'center', color: 'var(--tk-tint)', boxShadow: '0 0 0 1px var(--tk-sep)', flexShrink: 0 }}><Icon name={icon} size={18} sw={2} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 15.5, fontWeight: 600 }}>{t}</span>
            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--tk-label2)', marginTop: 1 }}>{d}</span></span>
          <Icon name="chev" size={14} sw={2.6} style={{ color: 'var(--tk-label3)' }} />
        </button>
      ))}
    </div>
  );
}

function Demo({ compact }: { compact?: boolean }) {
  const [open, setOpen] = useState(true);
  const [view, setView] = useState('menu');
  return (
    <>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <PillButton label="Open Credenza" onPress={() => { setView('menu'); setOpen(true); }} style={{ width: 200 }} />
      </div>
      <Credenza open={open} onClose={() => setOpen(false)} compact={compact} view={view}
        title={TITLES[view]} canBack={view !== 'menu'} onBack={() => setView('menu')}>
        <Views view={view} go={setView} onClose={() => setOpen(false)} />
      </Credenza>
    </>
  );
}

export const Dialog: Story = {
  render: () => <Phone w={720} h={560}><Demo /></Phone>,
};

export const CompactTray: Story = {
  render: () => <Phone w={390} h={720}><Demo compact /></Phone>,
};
