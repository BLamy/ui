import type { ReactNode } from 'react';
import { BLProvider } from '../lib/theme';

/** Story-only helpers: sized frames wrapping BLProvider (BL UI containers are absolutely positioned). */

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
      <BLProvider dark={dark} tint={tint} safeTop={safeTop}>{children}</BLProvider>
    </div>
  );
}

export function Pad({ children, w = 360, dark, tint }: { children?: ReactNode; w?: number; dark?: boolean; tint?: string }) {
  return (
    <div style={{ ...frameStyle, width: w }}>
      <BLProvider dark={dark} tint={tint}>
        <div style={{ padding: 20 }}>{children}</div>
      </BLProvider>
    </div>
  );
}
