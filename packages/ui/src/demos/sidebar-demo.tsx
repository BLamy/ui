import { useState, type CSSProperties } from 'react';
import { EASE } from '../lib/utils';
import { SidebarInset, SidebarNav, SidebarProvider, SidebarTrigger, type SidebarVariant } from '../components/sidebar';

/** The workbench dark palette the Sidebar's --wb-* tokens read. */
export const sidebarDarkVars = {
  '--wb-bg': '#141419',
  '--wb-side': '#101015',
  '--wb-card': '#1C1C23',
  '--wb-fill': 'rgba(255,255,255,.06)',
  '--wb-fill2': 'rgba(255,255,255,.11)',
  '--wb-sep': 'rgba(255,255,255,.08)',
  '--wb-label': '#EDEDF2',
  '--wb-label2': '#9C9CA6',
  '--wb-label3': '#69696F',
  '--wb-tint': '#0A84FF',
} as CSSProperties;

const VARIANTS: SidebarVariant[] = ['docked', 'rail', 'float', 'overlay'];
const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,'Helvetica Neue',sans-serif";

function Chip({ active, onPress, children }: { active: boolean; onPress: () => void; children: string }) {
  return (
    <button
      onClick={onPress}
      style={{
        border: 0, borderRadius: 999, padding: '5px 11px', fontSize: 12, fontWeight: 600, fontFamily: FONT, cursor: 'pointer',
        background: active ? 'var(--wb-tint)' : 'var(--wb-fill2)', color: active ? '#fff' : 'var(--wb-label)',
      }}
    >
      {children}
    </button>
  );
}

/** One Sidebar, four variants, plus a narrow container that turns any of them into the overlay. */
export function SidebarDemo({ variant: initial = 'docked' }: { variant?: SidebarVariant }) {
  const [variant, setVariant] = useState<SidebarVariant>(initial);
  const [narrow, setNarrow] = useState(false);
  return (
    <div style={{ ...sidebarDarkVars, display: 'grid', gap: 12, justifyItems: 'center', padding: 16, background: 'var(--wb-bg)', fontFamily: FONT }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        {VARIANTS.map((v) => <Chip key={v} active={variant === v} onPress={() => setVariant(v)}>{v}</Chip>)}
        <Chip active={narrow} onPress={() => setNarrow((n) => !n)}>narrow container</Chip>
      </div>
      <div style={{ width: narrow ? 380 : '100%', maxWidth: 640, height: 330, border: '1px solid var(--wb-sep)', borderRadius: 14, overflow: 'hidden', transition: 'width .35s ' + EASE }}>
        <SidebarProvider key={variant + narrow} defaultOpen={variant !== 'overlay'} breakpoint={430}>
          <SidebarNav variant={variant} />
          <SidebarInset>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderBottom: '1px solid var(--wb-sep)' }}>
              <SidebarTrigger />
              <span style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--wb-label)' }}>Home</span>
            </div>
            <div style={{ padding: 16, fontSize: 12.5, color: 'var(--wb-label2)', lineHeight: 1.6 }}>
              One API, four behaviors — the trigger toggles whichever variant is mounted, and every variant becomes a hamburger
              overlay when the container is narrower than the breakpoint. Try “narrow container”.
            </div>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </div>
  );
}
