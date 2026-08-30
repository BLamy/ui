/* Shared bits for live docs blocks — token var maps + tiny frame/button, from the prototype's DocsLive. */
import type { CSSProperties, ReactNode } from 'react';

export const TKL: Record<string, string> = {
  '--tk-bg': '#fff', '--tk-bg2': '#F2F2F7', '--tk-card': '#fff', '--tk-label': '#0B0B0F',
  '--tk-label2': 'rgba(60,60,67,.6)', '--tk-label3': 'rgba(60,60,67,.36)', '--tk-sep': 'rgba(60,60,67,.22)',
  '--tk-fill': 'rgba(120,120,128,.13)', '--tk-fill2': 'rgba(120,120,128,.24)', '--tk-press': 'rgba(120,120,128,.16)',
  '--tk-tint': '#0A84FF', '--tk-green': '#34C759', '--tk-red': '#FF3B30',
  '--tk-bar': 'rgba(250,250,252,.85)', '--tk-stick': 'rgba(244,244,248,.92)', '--tk-side': '#ECECF1',
  '--tk-scrim': 'rgba(0,0,0,.38)',
};

export const TKDK: Record<string, string> = {
  '--tk-bg': '#000', '--tk-bg2': '#0A0A0C', '--tk-card': '#1C1C1E', '--tk-label': '#F5F5F7',
  '--tk-label2': 'rgba(235,235,245,.62)', '--tk-label3': 'rgba(235,235,245,.3)', '--tk-sep': 'rgba(84,84,88,.48)',
  '--tk-fill': 'rgba(120,120,128,.22)', '--tk-fill2': 'rgba(120,120,128,.34)', '--tk-press': 'rgba(120,120,128,.22)',
  '--tk-tint': '#0A84FF', '--tk-green': '#30D158', '--tk-red': '#FF453A',
  '--tk-bar': 'rgba(16,16,18,.82)', '--tk-stick': 'rgba(18,18,20,.9)', '--tk-side': '#111114',
  '--tk-scrim': 'rgba(0,0,0,.5)',
};

export const WBD: Record<string, string> = {
  '--wb-bg': '#141419', '--wb-side': '#101015', '--wb-card': '#1C1C23',
  '--wb-fill': 'rgba(255,255,255,.06)', '--wb-fill2': 'rgba(255,255,255,.11)', '--wb-sep': 'rgba(255,255,255,.08)',
  '--wb-label': '#EDEDF2', '--wb-label2': '#9C9CA6', '--wb-label3': '#69696F',
  '--wb-tint': '#0A84FF', '--wb-green': '#30D158', '--wb-red': '#FF453A', '--tk-tint': '#0A84FF',
};

export function TKFrame({ h, bg, children }: { h: number; bg?: string; children?: ReactNode }) {
  return (
    <div style={{ position: 'relative', height: h, borderRadius: 12, overflow: 'hidden', background: bg || 'var(--tk-bg2)', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.05)' }}>
      {children}
    </div>
  );
}

export const DemoBtn = ({ label, onPress, style }: { label: string; onPress?: () => void; style?: CSSProperties }) => (
  <button onClick={onPress} style={{
    border: 0, borderRadius: 10, background: 'var(--tk-tint, #0A84FF)', color: '#fff', fontFamily: 'inherit',
    fontWeight: 600, fontSize: 13.5, padding: '9px 16px', cursor: 'pointer', ...style,
  }}>{label}</button>
);

export interface LiveSpec {
  title: string;
  theme: 'tk' | 'wb';
  h: number;
  code: string;
  Render: () => ReactNode;
}
