'use client';
import { useEffect, useMemo, type ComponentProps } from 'react';
import { cn } from '@/lib/utils';
import { encodeQR, type QRLevel, type QRMatrix } from '@/lib/qr';

/* ══ QRCode — a real, scannable QR code drawn as SVG ══
   <QRCode value="https://example.com/albums/summer-2026" aria-label="Open shared album" />
   <QRCode value={wifi} level="Q" margin={2} background="white" className="text-black" />
   The dark modules are `currentColor`: colour them with a text class. Text too long for version 40 at the
   chosen level renders an empty, `aria-invalid` box and calls `onError` instead of throwing. */

export interface QRCodeProps extends Omit<ComponentProps<'svg'>, 'children' | 'onError' | 'viewBox'> {
  /** Text to encode (UTF-8, byte mode): a URL, a `WIFI:S:…;T:WPA;P:…;;` string, plain text… */
  value: string;
  /** Rendered width/height in px (default 168). */
  size?: number;
  /** Error-correction level (default 'M'). Use 'Q'/'H' if the code may be partially covered or worn. */
  level?: QRLevel;
  /**
   * Quiet zone around the code, in modules (default 0, so it sits flush inside a white card). Scanners want
   * 1–4 modules of light space around the code: either set `margin` (with a `background`) or put the code on a
   * light card with padding.
   */
  margin?: number;
  /** A fill painted behind the code inside the SVG, so a saved or copied image keeps its quiet zone. */
  background?: string;
  /**
   * iOS-style rounded module dots and rounded finder "eyes" (default true). Modules still fill ~85% of
   * their cell and finder rings stay solid, so the code remains scannable. `false` renders square modules.
   */
  rounded?: boolean;
  /** The value does not fit in a QR code (over version 40 at this `level`). */
  onError?: (error: Error) => void;
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

/** A real, scannable QR code (byte mode, auto version, ECC L/M/Q/H) rendered as two `<path>`s: one for the data
 *  modules and one (even-odd) for the three finder patterns. With an `aria-label` it is an image with that name
 *  (and a `<title>`); without one it is decorative. */
export function QRCode({
  value,
  size = 168,
  level = 'M',
  margin = 0,
  background,
  rounded = true,
  onError,
  className,
  'aria-label': label,
  ...props
}: QRCodeProps) {
  const drawn = useMemo(() => {
    let qr: QRMatrix;
    try {
      qr = encodeQR(value, { level });
    } catch (error) {
      return { error: error instanceof Error ? error : new Error(String(error)) };
    }
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
  }, [value, level, margin, rounded]);

  const error = 'error' in drawn ? drawn.error : undefined;
  useEffect(() => {
    if (error) onError?.(error);
  }, [error, onError]);

  const n = 'n' in drawn ? drawn.n : 21;
  return (
    <svg
      data-slot="qr-code"
      className={cn('block', className)}
      width={size}
      height={size}
      viewBox={`0 0 ${n} ${n}`}
      shapeRendering={rounded ? undefined : 'crispEdges'}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      {...(error ? { 'aria-invalid': true, 'data-invalid': '' } : null)}
      {...props}
    >
      {label ? <title>{label}</title> : null}
      {background ? <rect width={n} height={n} fill={background} /> : null}
      {'data' in drawn ? (
        <>
          <path data-part="modules" d={drawn.data} fill="currentColor" />
          <path data-part="finders" d={drawn.finders} fill="currentColor" fillRule="evenodd" />
        </>
      ) : null}
    </svg>
  );
}
