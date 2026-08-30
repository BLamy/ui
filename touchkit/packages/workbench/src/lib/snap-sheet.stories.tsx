import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SnapSheet } from './snap-sheet';
import { TermHeader, TermBody } from './terminal';
import { WorkbenchTheme } from './theme';
import { TERM_SEED } from '../demos/workbench-demo';
import '../styles.css';

const meta: Meta<typeof SnapSheet> = {
  title: 'Organisms/SnapSheet',
  component: SnapSheet,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof SnapSheet>;

/* vaul-style bottom drawer in a phone frame — drag the handle between the 52% and 93%
   snap points; a fast downward flick (or dragging past the low snap) closes it. */
function SheetDemo({ open: initialOpen }: { open: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <WorkbenchTheme style={{ minHeight: 760, padding: 20, display: 'grid', placeItems: 'center' }}>
      <div style={{ position: 'relative', width: 390, height: 720, borderRadius: 12, overflow: 'hidden', border: '1px solid var(--wb-sep)', background: 'var(--wb-bg)' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--wb-label3)', fontSize: 13, padding: 24, textAlign: 'center' }}>
          <div>
            <div style={{ marginBottom: 14 }}>compact-width terminal presentation</div>
            <button
              className="wb-btn"
              onClick={() => setOpen(true)}
              style={{ border: 0, borderRadius: 9, background: 'var(--wb-tint)', color: '#fff', fontFamily: 'inherit', fontWeight: 600, fontSize: 13, padding: '9px 16px', cursor: 'pointer' }}
            >
              Open terminal drawer
            </button>
          </div>
        </div>
        <SnapSheet open={open} onClose={() => setOpen(false)} snaps={[0.52, 0.93]} bg="#0C0C10">
          <TermHeader onClose={() => setOpen(false)} />
          <TermBody seed={TERM_SEED} />
        </SnapSheet>
      </div>
    </WorkbenchTheme>
  );
}

export const Open: Story = { render: () => <SheetDemo open /> };
export const Closed: Story = { render: () => <SheetDemo open={false} /> };
