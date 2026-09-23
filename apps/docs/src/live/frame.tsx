/* Shared bits for live docs blocks — token var maps + tiny frame/button, from the prototype's DocsLive. */
import type { CSSProperties, ReactNode } from 'react';

export const BLL: Record<string, string> = {
  '--bl-bg': '#fff', '--bl-bg2': '#F2F2F7', '--bl-card': '#fff', '--bl-label': '#0B0B0F',
  '--bl-label2': 'rgba(60,60,67,.6)', '--bl-label3': 'rgba(60,60,67,.36)', '--bl-sep': 'rgba(60,60,67,.22)',
  '--bl-fill': 'rgba(120,120,128,.13)', '--bl-fill2': 'rgba(120,120,128,.24)', '--bl-press': 'rgba(120,120,128,.16)',
  '--bl-tint': '#0A84FF', '--bl-green': '#34C759', '--bl-red': '#FF3B30',
  '--bl-bar': 'rgba(250,250,252,.85)', '--bl-stick': 'rgba(244,244,248,.92)', '--bl-side': '#ECECF1',
  '--bl-scrim': 'rgba(0,0,0,.38)',
};

export const BLDK: Record<string, string> = {
  '--bl-bg': '#000', '--bl-bg2': '#0A0A0C', '--bl-card': '#1C1C1E', '--bl-label': '#F5F5F7',
  '--bl-label2': 'rgba(235,235,245,.62)', '--bl-label3': 'rgba(235,235,245,.3)', '--bl-sep': 'rgba(84,84,88,.48)',
  '--bl-fill': 'rgba(120,120,128,.22)', '--bl-fill2': 'rgba(120,120,128,.34)', '--bl-press': 'rgba(120,120,128,.22)',
  '--bl-tint': '#0A84FF', '--bl-green': '#30D158', '--bl-red': '#FF453A',
  '--bl-bar': 'rgba(16,16,18,.82)', '--bl-stick': 'rgba(18,18,20,.9)', '--bl-side': '#111114',
  '--bl-scrim': 'rgba(0,0,0,.5)',
};

export const WBD: Record<string, string> = {
  '--wb-bg': '#141419', '--wb-side': '#101015', '--wb-card': '#1C1C23',
  '--wb-fill': 'rgba(255,255,255,.06)', '--wb-fill2': 'rgba(255,255,255,.11)', '--wb-sep': 'rgba(255,255,255,.08)',
  '--wb-label': '#EDEDF2', '--wb-label2': '#9C9CA6', '--wb-label3': '#69696F',
  '--wb-tint': '#0A84FF', '--wb-green': '#30D158', '--wb-red': '#FF453A', '--bl-tint': '#0A84FF',
};

export function BLFrame({ h, bg, children }: { h: number; bg?: string; children?: ReactNode }) {
  return (
    <div style={{ position: 'relative', height: h, borderRadius: 12, overflow: 'hidden', background: bg || 'var(--bl-bg2)', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.05)' }}>
      {children}
    </div>
  );
}

export const DemoBtn = ({ label, onPress, style }: { label: string; onPress?: () => void; style?: CSSProperties }) => (
  <button onClick={onPress} style={{
    border: 0, borderRadius: 10, background: 'var(--bl-tint, #0A84FF)', color: '#fff', fontFamily: 'inherit',
    fontWeight: 600, fontSize: 13.5, padding: '9px 16px', cursor: 'pointer', ...style,
  }}>{label}</button>
);

export interface LiveVariant { id: string; label: string }

export interface LiveSpec {
  title: string;
  /** Token family the preview surface sets: BL UI (`--bl-*`) or Workbench (`--wb-*`). Both follow the docs' appearance. */
  theme: 'bl' | 'wb';
  /** Approximate preview height (informational; the card sizes to its content). */
  h: number;
  /** Copy-pasteable TSX shown in the code panel. */
  code: string;
  /** Per-variant code, when the header switch changes what the sample should show. */
  codeFor?: (variant: string) => string;
  /** Header switch between demo variants — rendered in the card header, handed to `Render` as `variant`. */
  variants?: LiveVariant[];
  /** Width of the header switch. */
  variantsWidth?: number;
  /** Small header label (e.g. "needs network"); defaults to "live". */
  status?: string | false;
  /** Drop the padded preview surface (for demos that bring their own full-bleed frame). */
  bleed?: boolean;
  Render: (props: { variant: string }) => ReactNode;
}
