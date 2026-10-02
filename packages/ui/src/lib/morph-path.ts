/* ══ morph-path — the outline of surfaces that merge like liquid (ComposerCards) ══
   Two rounded rectangles closer than MORPH_REACH are drawn as one shape: their rectangles plus a neck between them
   whose sides curve in to a waist, deeper the further apart they are, until it snaps. All paths run clockwise so a
   nonzero fill unions them without holes. Coordinates are px in any common frame. */

/** Below this distance (px) two surfaces are drawn as one shape. */
export const MORPH_REACH = 6;

export interface MorphBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
  /** Corner radii: top-left, top-right, bottom-right, bottom-left. */
  r: [number, number, number, number];
}

const f = (n: number) => Math.round(n * 100) / 100;

/** A rounded rectangle, clockwise from the top-left corner's end. */
export function roundedRectPath({ left: x0, top: y0, right: x1, bottom: y1, r: [tl, tr, br, bl] }: MorphBox): string {
  return [
    `M${f(x0 + tl)} ${f(y0)}`,
    `H${f(x1 - tr)}`,
    tr ? `A${f(tr)} ${f(tr)} 0 0 1 ${f(x1)} ${f(y0 + tr)}` : '',
    `V${f(y1 - br)}`,
    br ? `A${f(br)} ${f(br)} 0 0 1 ${f(x1 - br)} ${f(y1)}` : '',
    `H${f(x0 + bl)}`,
    bl ? `A${f(bl)} ${f(bl)} 0 0 1 ${f(x0)} ${f(y1 - bl)}` : '',
    `V${f(y0 + tl)}`,
    tl ? `A${f(tl)} ${f(tl)} 0 0 1 ${f(x0 + tl)} ${f(y0)}` : '',
    'Z',
  ].join('');
}

/**
 * The neck between an upper and a lower surface that are less than MORPH_REACH apart (or overlapping): a band from just
 * above the upper's bottom corners to just below the lower's top corners whose sides curve in towards a waist. The
 * further apart the two are, the deeper the waist, until the neck snaps at MORPH_REACH. Clockwise, like the rectangles, so
 * the union fills without holes.
 */
export function morphNeck(upper: MorphBox, lower: MorphBox): string {
  const gap = lower.top - upper.bottom;
  if (gap >= MORPH_REACH) return '';
  const x0 = Math.max(upper.left, lower.left);
  const x1 = Math.min(upper.right, lower.right);
  const width = x1 - x0;
  if (width <= 0) return '';
  const ru = Math.max(upper.r[2], upper.r[3]);
  const rl = Math.max(lower.r[0], lower.r[1]);
  const y1 = upper.bottom - ru;
  const y2 = lower.top + rl;
  if (y2 <= y1) return '';
  const r = Math.max(4, Math.min(ru, rl));
  // 0 while the corners overlap; 1 at the moment the neck would snap.
  const p = Math.min(1, Math.max(0, (gap + r) / (MORPH_REACH + r)));
  const d = Math.min(width / 2, r * 1.15 * p);
  const ym = (upper.bottom + lower.top) / 2;
  const a = (ym - y1) * 0.55;
  const b = (y2 - ym) * 0.55;
  return [
    `M${f(x0)} ${f(y1)}`,
    `H${f(x1)}`,
    // Right side, down: out of the upper's side, in to the waist, out to the lower's side.
    `C${f(x1)} ${f(y1 + a)} ${f(x1 - d)} ${f(ym - a * 0.8)} ${f(x1 - d)} ${f(ym)}`,
    `C${f(x1 - d)} ${f(ym + b * 0.8)} ${f(x1)} ${f(y2 - b)} ${f(x1)} ${f(y2)}`,
    `H${f(x0)}`,
    `C${f(x0)} ${f(y2 - b)} ${f(x0 + d)} ${f(ym + b * 0.8)} ${f(x0 + d)} ${f(ym)}`,
    `C${f(x0 + d)} ${f(ym - a * 0.8)} ${f(x0)} ${f(y1 + a)} ${f(x0)} ${f(y1)}`,
    'Z',
  ].join('');
}

/** `rgba(0, 0, 0, 0.08) 0px 6px 24px 0px, …` → `drop-shadow(0px 6px 24px rgba(0, 0, 0, 0.08)) …` (insets and spread dropped). */
export function toDropShadow(boxShadow: string): string {
  if (!boxShadow || boxShadow === 'none') return '';
  return boxShadow
    .split(/,(?![^(]*\))/)
    .filter((s) => !/\binset\b/.test(s))
    .map((s) => {
      const color = s.match(/(rgba?|hsla?|oklch|oklab|color|lab|lch)\([^)]*\)|#[0-9a-f]{3,8}\b/i)?.[0] ?? 'transparent';
      const lengths = s.replace(color, '').trim().split(/\s+/).filter(Boolean).slice(0, 3);
      // Tailwind's unused ring and shadow layers are transparent and zero-sized.
      const invisible = /(rgba?\([^)]*,\s*0\)|\/\s*0\)|transparent)$/.test(color) || lengths.every((l) => parseFloat(l) === 0);
      return lengths.length >= 2 && !invisible ? `drop-shadow(${lengths.join(' ')} ${color})` : '';
    })
    .filter(Boolean)
    .join(' ');
}
