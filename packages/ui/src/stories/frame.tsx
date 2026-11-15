import type { ReactNode } from 'react';
import { BLProvider, type AppearancePreference } from '@/lib/theme';

/** Story-only helpers: sized frames wrapping BLProvider (BL UI containers are absolutely positioned). */

const frameStyle = {
  position: 'relative' as const,
  overflow: 'hidden' as const,
  borderRadius: 20,
  boxShadow: '0 12px 40px color-mix(in srgb, black 18%, transparent)',
};

export function Phone({ children, w = 390, h = 720, appearance, tint, safeTop }: {
  children?: ReactNode; w?: number; h?: number; appearance?: AppearancePreference; tint?: string; safeTop?: boolean | number;
}) {
  return (
    <div style={{ ...frameStyle, width: w, height: h }}>
      <BLProvider appearance={appearance} tint={tint} safeTop={safeTop}>{children}</BLProvider>
    </div>
  );
}

export function Pad({ children, w = 360, appearance, tint }: { children?: ReactNode; w?: number; appearance?: AppearancePreference; tint?: string }) {
  return (
    <div style={{ ...frameStyle, width: w }}>
      <BLProvider appearance={appearance} tint={tint}>
        <div style={{ padding: 20 }}>{children}</div>
      </BLProvider>
    </div>
  );
}
