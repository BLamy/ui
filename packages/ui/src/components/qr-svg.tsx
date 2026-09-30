'use client';
import { useMemo, type CSSProperties } from 'react';
import { cn } from '@/lib/utils';
import { encodeQR, type QRLevel } from '@/lib/qr';

export interface QRSvgProps {
  /** Text to encode (UTF-8, byte mode): a URL, a `WIFI:S:…;T:WPA;P:…;;` string, plain text… */
  value?: string;
  /** @deprecated Use `value`. Kept as an alias so existing callers keep working. */
  seed?: string;
  /** Rendered width/height in px (default 168). */
  size?: number;
  /** Error-correction level (default 'M'). Use 'Q'/'H' if the code may be partially covered or worn. */
  level?: QRLevel;
  /**
   * Quiet zone around the code, in modules (default 0, so it sits flush inside a white card like the old
   * decorative look). Scanners want 1–4 modules of light space around the code: either set `margin` or
   * put the SVG on a light card with padding.
   */
  margin?: number;
  /** Colour of dark modules (default `currentColor`). Keep strong contrast against the background. */
  color?: string;
  /** Background fill (default none / transparent). */
  background?: string;
  /**
   * iOS-style rounded module dots and rounded finder "eyes" (default true). Modules still fill ~85% of
   * their cell and finder rings stay solid, so the code remains scannable. `false` renders square modules.
   */
  rounded?: boolean;
  /** Accessible label. When given the SVG is `role="img"` with a `<title>`; otherwise it is `aria-hidden`. */
  title?: string;
  className?: string;
  style?: CSSProperties;
}

const f = (n: number) => String(Math.round(n * 1000) / 1000);
const K = 0.5523; // cubic Bézier circle constant

/** Rounded-rect subpath (clockwise) in module units; square corners when r = 0. */
function rrect(x: number, y: number, w: number, h: number, r: number): string {
  if (r <= 0) return `M${f(x)} ${f(y)}H${f(x + w)}V${f(y + h)}H${f(x)}Z`;
  const c = r * (1 - K);
  const x2 = x + w;
  const y2 = y + h;
  return (
    `M${f(x + r)} ${f(y)}H${f(x2 - r)}` +
    `C${f(x2 - c)} ${f(y)} ${f(x2)} ${f(y + c)} ${f(x2)} ${f(y + r)}V${f(y2 - r)}` +
    `C${f(x2)} ${f(y2 - c)} ${f(x2 - c)} ${f(y2)} ${f(x2 - r)} ${f(y2)}H${f(x + r)}` +
    `C${f(x + c)} ${f(y2)} ${f(x)} ${f(y2 - c)} ${f(x)} ${f(y2 - r)}V${f(y + r)}` +
    `C${f(x)} ${f(y + c)} ${f(x + c)} ${f(y)} ${f(x + r)} ${f(y)}Z`
  );
}

// Rounded data modules: 0.94-module squares with 0.2 corner radius (~85% of the cell is dark).
const DOT_INSET = 0.03;
const DOT_RADIUS = 0.2;

/**
 * A real, scannable QR code (byte mode, auto version, ECC L/M/Q/H) rendered as two `<path>`s: one for the
 * data modules and one (even-odd) for the three finder patterns.
 */
export function QRSvg({
  value,
  seed,
  size = 168,
  level = 'M',
  margin = 0,
  color = 'currentColor',
  background,
  rounded = true,
  title,
  className,
  style,
}: QRSvgProps) {
  const text = value ?? seed ?? '';
  const { n, data, finders } = useMemo(() => {
    const qr = encodeQR(text, { level });
    const n = qr.size;
    const m = Math.max(0, margin);
    const inFinder = (x: number, y: number) => (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7);

    let data = '';
    for (let y = 0; y < n; y++) {
      if (rounded) {
        for (let x = 0; x < n; x++) {
          if (qr.modules[y][x] && !inFinder(x, y)) {
            data += rrect(x + m + DOT_INSET, y + m + DOT_INSET, 1 - 2 * DOT_INSET, 1 - 2 * DOT_INSET, DOT_RADIUS);
          }
        }
      } else {
        // Merge horizontal runs into one rectangle each (fewer nodes, no hairline seams).
        for (let x = 0; x < n; ) {
          if (qr.modules[y][x] && !inFinder(x, y)) {
            let end = x + 1;
            while (end < n && qr.modules[y][end] && !inFinder(end, y)) end++;
            data += rrect(x + m, y + m, end - x, 1, 0);
            x = end;
          } else x++;
        }
      }
    }

    let finders = '';
    for (const [fx, fy] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
      const x = fx + m;
      const y = fy + m;
      finders +=
        rrect(x, y, 7, 7, rounded ? 1.9 : 0) +
        rrect(x + 1, y + 1, 5, 5, rounded ? 1.1 : 0) +
        rrect(x + 2, y + 2, 3, 3, rounded ? 0.8 : 0);
    }
    return { n: n + 2 * m, data, finders };
  }, [text, level, margin, rounded]);

  return (
    <svg
      data-slot="qr-svg"
      className={cn('block', className)}
      width={size}
      height={size}
      viewBox={`0 0 ${n} ${n}`}
      shapeRendering={rounded ? undefined : 'crispEdges'}
      style={style}
      {...(title ? { role: 'img' } : { 'aria-hidden': true })}
    >
      {title ? <title>{title}</title> : null}
      {background ? <rect width={n} height={n} fill={background} /> : null}
      <path data-part="modules" d={data} fill={color} />
      <path data-part="finders" d={finders} fill={color} fillRule="evenodd" />
    </svg>
  );
}
