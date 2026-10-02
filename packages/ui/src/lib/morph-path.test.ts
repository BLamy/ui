import { describe, expect, it } from 'vitest';
import { MORPH_REACH, morphNeck, roundedRectPath, toDropShadow, type MorphBox } from '@/lib/morph-path';

const box = (top: number, bottom: number, r = 15): MorphBox => ({ left: 0, top, right: 200, bottom, r: [r, r, r, r] });

/** The x of the neck's right-hand waist: the end point of its first curve. */
const waist = (path: string) => Number(path.match(/C[^C]*?(-?[\d.]+) (-?[\d.]+)C/)?.[1]);

describe('roundedRectPath', () => {
  it('runs clockwise round the box, with an arc per rounded corner', () => {
    const d = roundedRectPath(box(10, 60, 8));
    expect(d.startsWith('M8 10H192A8 8 0 0 1 200 18')).toBe(true);
    expect(d.match(/A/g)).toHaveLength(4);
    expect(d.endsWith('Z')).toBe(true);
  });
  it('draws square corners without arcs', () => {
    expect(roundedRectPath({ left: 0, top: 0, right: 10, bottom: 10, r: [0, 0, 0, 0] })).toBe('M0 0H10V10H0V0Z');
  });
});

describe('morphNeck', () => {
  it('joins surfaces closer than the reach, and lets go at it', () => {
    expect(morphNeck(box(0, 50), box(50 + MORPH_REACH - 0.5, 120))).not.toBe('');
    expect(morphNeck(box(0, 50), box(50 + MORPH_REACH, 120))).toBe('');
  });
  it('necks in further the further apart the surfaces are', () => {
    const touching = waist(morphNeck(box(0, 50), box(50, 120)));
    const apart = waist(morphNeck(box(0, 50), box(54, 120)));
    // The right-hand waist moves left (inwards) from the right edge (200).
    expect(touching).toBeLessThan(200);
    expect(apart).toBeLessThan(touching);
  });
  it('is a straight band while the corners overlap deeply', () => {
    expect(waist(morphNeck(box(0, 50), box(30, 120)))).toBe(200);
  });
  it('spans only the overlap of two surfaces of different widths', () => {
    const d = morphNeck({ ...box(0, 50), left: 20, right: 180 }, box(52, 120));
    expect(d.startsWith('M20 35H180')).toBe(true);
  });
});

describe('toDropShadow', () => {
  it('turns a computed box-shadow into drop-shadows, skipping transparent and inset layers', () => {
    expect(toDropShadow('rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.08) 0px 6px 24px 0px')).toBe('drop-shadow(0px 6px 24px rgba(0, 0, 0, 0.08))');
    expect(toDropShadow('oklab(0 0 0 / 0.2) 0px 2px 8px 0px, rgb(0, 0, 0) 0px 1px 0px 0px inset')).toBe('drop-shadow(0px 2px 8px oklab(0 0 0 / 0.2))');
    expect(toDropShadow('none')).toBe('');
  });
});
