import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Segmented } from '@touchkit/ui';
import { ContactsApp } from './app/app';
import './styles.css';

const FRAMES: Record<string, { w: number | string; h: number | string; island?: boolean }> = {
  phone: { w: 390, h: 720, island: true },
  tablet: { w: 834, h: 700 },
  fluid: { w: '100%', h: '100%' },
};

function DemoPage() {
  const [frame, setFrame] = useState('fluid');
  const [dark, setDark] = useState(false);
  const f = FRAMES[frame];
  return (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#EEEEF1', fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,sans-serif" }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 20px', flexShrink: 0 }}>
        <strong style={{ fontSize: 16, letterSpacing: '-.2px' }}>TouchKit · Contacts</strong>
        <span style={{ fontSize: 12.5, color: 'rgba(60,60,67,.6)' }}>Cocoa Touch containers, composed from @touchkit/ui</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
          <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={dark} onChange={e => setDark(e.target.checked)} /> Dark
          </label>
          <div style={{ width: 260 }}>
            <Segmented value={frame} onChange={setFrame} options={[
              { id: 'phone', label: 'Phone 390' }, { id: 'tablet', label: 'Tablet 834' }, { id: 'fluid', label: 'Fluid' },
            ]} />
          </div>
        </div>
      </header>
      <main style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center', padding: frame === 'fluid' ? 0 : 20 }}>
        <div style={{
          width: f.w, height: f.h, maxWidth: '100%', maxHeight: '100%', position: 'relative', overflow: 'hidden',
          borderRadius: frame === 'fluid' ? 0 : 34, boxShadow: frame === 'fluid' ? 'none' : '0 24px 80px rgba(0,0,0,.28), 0 0 0 10px #1c1c1e',
        }}>
          <ContactsApp dark={dark} indicator safeTop={f.island ? true : 0} />
        </div>
      </main>
    </div>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode><DemoPage /></StrictMode>
);
