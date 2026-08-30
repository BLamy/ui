/* Beautiful UI layer — AI-native interface primitives in TouchKit Workbench's dark language.
   Ported from project/beautiful.jsx; visuals are pixel-identical to the prototype. */
import type { CSSProperties, ReactNode } from 'react';

export const BFONT =
  "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,'Helvetica Neue',sans-serif";
export const BMONO = "ui-monospace,'SF Mono',Menlo,Consolas,monospace";
export const BEASE = 'cubic-bezier(.32,.72,0,1)';

export const C = {
  blue: '#0A84FF',
  green: '#32D74B',
  red: '#FF453A',
  orange: '#FF9F0A',
  purple: '#BF5AF2',
  teal: '#64D2FF',
} as const;
export { C as beautifulColors };

/** Haptic tap helper (no-ops where navigator.vibrate is unavailable). */
export const vib = (p: number | number[]) => {
  try {
    navigator.vibrate && navigator.vibrate(p);
  } catch (e) {
    /* noop */
  }
};

/** The workbench dark palette the prototype `App` supplies — handy for stories/apps. */
export const beautifulDarkVars: CSSProperties = {
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
  '--wb-green': '#30D158',
  '--wb-red': '#FF453A',
  '--tk-tint': '#0A84FF',
} as CSSProperties;

export const card = (extra?: CSSProperties): CSSProperties => ({
  background: 'var(--wb-card, #1C1C23)',
  border: '1px solid var(--wb-sep, rgba(255,255,255,.08))',
  borderRadius: 14,
  fontFamily: BFONT,
  ...extra,
});
export const mut = 'var(--wb-label2, rgba(235,235,245,.6))';
export const mut3 = 'var(--wb-label3, rgba(235,235,245,.34))';

/** Tiny class joiner (inline-style system — no tailwind classes to merge). */
export const cn = (...xs: Array<string | false | null | undefined>) =>
  xs.filter(Boolean).join(' ');

export interface BIconProps {
  d: string;
  size?: number;
  sw?: number;
  style?: CSSProperties;
  className?: string;
}
export function BIcon({ d, size, sw, style, className }: BIconProps) {
  return (
    <svg
      data-slot="icon"
      className={className}
      width={size || 16}
      height={size || 16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw || 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <path d={d} />
    </svg>
  );
}
export { BIcon as BeautifulIcon };

/** Icon path map. */
export const P: Record<string, string> = {
  check: 'M5 12.5l4.5 4.5L19 7.5',
  x: 'M6 6l12 12M18 6L6 18',
  spark: 'M12 3l2.2 6.2L20 12l-5.8 2.8L12 21l-2.2-6.2L4 12l5.8-2.8z',
  search: 'M10.5 4a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM20 20l-4.2-4.2',
  chev: 'M9 6l6 6-6 6',
  chevD: 'M6 9l6 6 6-6',
  doc: 'M7 3h7l4 4v14H7zM14 3v4h4',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5',
  mic: 'M12 3a3 3 0 013 3v5a3 3 0 01-6 0V6a3 3 0 013-3zM6 11a6 6 0 0012 0M12 17v4',
  at: 'M12 16a4 4 0 110-8 4 4 0 014 4v1.2a2 2 0 004 0V12a8 8 0 10-3.2 6.4',
  send: 'M12 19V5M6 11l6-6 6 6',
  plus: 'M12 5v14M5 12h14',
  copy: 'M9 9h10v12H9zM5 15V3h10',
  term: 'M5 7l5 5-5 5M13 17h6',
  globe:
    'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c-2.5 2.6-2.5 15.4 0 18c2.5-2.6 2.5-15.4 0-18',
  bolt: 'M13 2L4 14h6l-1 8 9-12h-6z',
  home: 'M4 11l8-7 8 7v9h-5v-6h-6v6H4z',
  inbox: 'M4 13l3-8h10l3 8v6H4zM4 13h5l1.5 2h3L15 13h5',
  box: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12L4 7.5M12 12v9',
  pen: 'M14 4l6 6-10 10H4v-6zM12 6l6 6',
  bell: 'M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 004 0',
  cal: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14',
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6',
  brain:
    'M12 4a4 4 0 00-4 4c-2 .5-3 2-3 4a4 4 0 004 4h6a4 4 0 004-4c0-2-1-3.5-3-4a4 4 0 00-4-4zM12 16v4',
};
export { P as beautifulIconPaths };

export interface BChipProps {
  children?: ReactNode;
  tone?: string;
  onPress?: () => void;
  active?: boolean;
  style?: CSSProperties;
  className?: string;
}
export function BChip({ children, tone, onPress, active, style, className }: BChipProps) {
  return (
    <button
      data-slot="chip"
      className={cn('bui-hl', className)}
      onClick={onPress}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        border: '1px solid var(--wb-sep)',
        background: active ? 'var(--wb-fill2, rgba(255,255,255,.11))' : 'transparent',
        color: tone || 'var(--wb-label, #EDEDF2)',
        borderRadius: 999,
        padding: '4px 11px',
        fontSize: 12,
        fontWeight: 600,
        cursor: onPress ? 'pointer' : 'default',
        fontFamily: BFONT,
        ...style,
      }}
    >
      {children}
    </button>
  );
}
export { BChip as Chip };

export interface MeterProps {
  v: number;
  tone?: string;
  style?: CSSProperties;
  className?: string;
}
export function Meter({ v, tone, style, className }: MeterProps) {
  return (
    <div
      data-slot="meter"
      className={className}
      style={{
        width: 64,
        height: 4,
        borderRadius: 2,
        background: 'var(--wb-fill)',
        overflow: 'hidden',
        ...style,
      }}
    >
      <div
        style={{
          width: v * 100 + '%',
          height: '100%',
          borderRadius: 2,
          background: tone || C.blue,
          transition: 'width .5s ' + BEASE,
        }}
      />
    </div>
  );
}

/* 20 — Kbd: keyboard hint */
export interface KbdProps {
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}
export function Kbd({ children, style, className }: KbdProps) {
  return (
    <kbd
      data-slot="kbd"
      className={className}
      style={{
        fontFamily: BMONO,
        fontSize: 10.5,
        color: mut,
        background: 'var(--wb-fill)',
        border: '1px solid var(--wb-sep)',
        borderBottomWidth: 2,
        borderRadius: 5,
        padding: '1px 6px',
        ...style,
      }}
    >
      {children}
    </kbd>
  );
}
