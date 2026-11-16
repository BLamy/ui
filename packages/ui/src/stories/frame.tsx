import { createContext, useContext, type ReactNode } from 'react';
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

const PAD = 20;
/** Set inside a Pad: a story's own Pad (a Dark story's) inside its meta's Pad takes over that frame instead of nesting. */
const InPad = createContext(false);

export function Pad({ children, w = 360, appearance, tint }: { children?: ReactNode; w?: number; appearance?: AppearancePreference; tint?: string }) {
  const nested = useContext(InPad);
  // Nested, the frame covers its parent exactly (its padding pulled back, its corners clipped by the parent's), so a
  // Dark story shows one dark frame, not a dark card clipped inside a light one. A frame never overflows the canvas.
  const style = nested ? { margin: -PAD } : { ...frameStyle, width: w, maxWidth: '100%' };
  return (
    <div style={style}>
      <BLProvider appearance={appearance} tint={tint}>
        <InPad.Provider value>
          <div style={{ padding: PAD }}>{children}</div>
        </InPad.Provider>
      </BLProvider>
    </div>
  );
}
