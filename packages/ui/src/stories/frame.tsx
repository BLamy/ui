import type { ReactNode } from 'react';
import { TouchKitProvider } from '../lib/theme';

/** Story-only helpers: sized frames wrapping TouchKitProvider (TouchKit containers are absolutely positioned). */

const frameStyle = {
  position: 'relative' as const,
  overflow: 'hidden' as const,
  borderRadius: 20,
  boxShadow: '0 12px 40px rgba(0,0,0,.18)',
};

export function Phone({ children, w = 390, h = 720, dark, tint, safeTop }: {
  children?: ReactNode; w?: number; h?: number; dark?: boolean; tint?: string; safeTop?: boolean | number;
}) {
  return (
    <div style={{ ...frameStyle, width: w, height: h }}>
      <TouchKitProvider dark={dark} tint={tint} safeTop={safeTop}>{children}</TouchKitProvider>
    </div>
  );
}

export function Pad({ children, w = 360, dark, tint }: { children?: ReactNode; w?: number; dark?: boolean; tint?: string }) {
  return (
    <div style={{ ...frameStyle, width: w }}>
      <TouchKitProvider dark={dark} tint={tint}>
        <div style={{ padding: 20 }}>{children}</div>
      </TouchKitProvider>
    </div>
  );
}
