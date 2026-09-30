import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import jsQR from 'jsqr';
import { QRSvg } from '@/components/ui/qr-svg';
import { encodeQR, numDataCodewords, type QRLevel } from '@/lib/qr';

type Pt = [number, number];

/** Flatten an SVG path (only the M/H/V/C/Z absolute commands QRSvg emits) into closed polygons. */
function pathToPolygons(d: string): Pt[][] {
  const tokens = d.match(/[MHVCZ]|-?\d*\.?\d+(?:e-?\d+)?/gi) ?? [];
  const polys: Pt[][] = [];
  let cur: Pt[] = [];
  let x = 0;
  let y = 0;
  let i = 0;
  const num = () => parseFloat(tokens[i++]);
  while (i < tokens.length) {
    const cmd = tokens[i++];
    switch (cmd) {
      case 'M':
        if (cur.length) polys.push(cur);
        x = num(); y = num();
        cur = [[x, y]];
        break;
      case 'H': x = num(); cur.push([x, y]); break;
      case 'V': y = num(); cur.push([x, y]); break;
      case 'C': {
        const [x1, y1, x2, y2, x3, y3] = [num(), num(), num(), num(), num(), num()];
        for (let s = 1; s <= 8; s++) {
          const t = s / 8, u = 1 - t;
          cur.push([
            u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
            u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
          ]);
        }
        x = x3; y = y3;
        break;
      }
      case 'Z': case 'z':
        if (cur.length) polys.push(cur);
        cur = [];
        break;
      default:
        throw new Error('unexpected path token ' + cmd);
    }
  }
  if (cur.length) polys.push(cur);
  return polys;
}

function inside(poly: Pt[], px: number, py: number): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}

/** Rasterize QRSvg markup (dark = any path, even-odd within a path) with a 4-module white quiet zone. */
function rasterize(svg: string, scale = 4, quiet = 4) {
  const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)"/.exec(svg);
  if (!vb) throw new Error('no viewBox');
  const n = parseFloat(vb[1]);
  const W = Math.ceil((n + 2 * quiet) * scale);
  const dark = new Uint8Array(W * W);
  for (const [, d] of svg.matchAll(/<path[^>]*\sd="([^"]*)"/g)) {
    const parity = new Uint8Array(W * W);
    for (const poly of pathToPolygons(d)) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const [px, py] of poly) {
        minX = Math.min(minX, px); maxX = Math.max(maxX, px);
        minY = Math.min(minY, py); maxY = Math.max(maxY, py);
      }
      const x0 = Math.max(0, Math.floor((minX + quiet) * scale));
      const x1 = Math.min(W - 1, Math.ceil((maxX + quiet) * scale));
      const y0 = Math.max(0, Math.floor((minY + quiet) * scale));
      const y1 = Math.min(W - 1, Math.ceil((maxY + quiet) * scale));
      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          if (inside(poly, (px + 0.5) / scale - quiet, (py + 0.5) / scale - quiet)) parity[py * W + px] ^= 1;
        }
      }
    }
    for (let k = 0; k < parity.length; k++) dark[k] |= parity[k];
  }
  const rgba = new Uint8ClampedArray(W * W * 4);
  for (let k = 0; k < dark.length; k++) {
    const v = dark[k] ? 0 : 255;
    rgba[k * 4] = rgba[k * 4 + 1] = rgba[k * 4 + 2] = v;
    rgba[k * 4 + 3] = 255;
  }
  return { rgba, width: W };
}

function decode(svg: string): string | undefined {
  const { rgba, width } = rasterize(svg);
  return jsQR(rgba, width, width, { inversionAttempts: 'dontInvert' })?.data;
}

function decodeMatrix(modules: boolean[][], scale = 3, quiet = 4): string | undefined {
  const n = modules.length;
  const W = (n + 2 * quiet) * scale;
  const rgba = new Uint8ClampedArray(W * W * 4).fill(255);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!modules[y][x]) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const k = (((y + quiet) * scale + dy) * W + (x + quiet) * scale + dx) * 4;
          rgba[k] = rgba[k + 1] = rgba[k + 2] = 0;
        }
      }
    }
  }
  return jsQR(rgba, W, W, { inversionAttempts: 'dontInvert' })?.data;
}

const LONG = 'The quick brown fox jumps over the lazy dog. '.repeat(7).slice(0, 300);
const SAMPLES: Record<string, string> = {
  short: 'hello',
  url: 'https://example.com/albums/summer-2026?ref=share&utm_source=qr',
  wifi: 'WIFI:S:Home Network;T:WPA;P:correct-horse-battery-staple;;',
  utf8: 'Crème brûlée à la café — 日本語 🎉👍',
  long: LONG,
};
const LEVELS: QRLevel[] = ['L', 'M', 'Q', 'H'];

describe('encodeQR', () => {
  it('produces a square matrix sized 17 + 4v with finder patterns and timing', () => {
    const qr = encodeQR('hello', { level: 'M' });
    expect(qr.version).toBe(1);
    expect(qr.size).toBe(21);
    expect(qr.modules).toHaveLength(21);
    for (const row of qr.modules) expect(row).toHaveLength(21);
    // Finder: 7x7 ring, light ring, 3x3 core (top-left corner).
    const ring = [0, 6].flatMap((a) => [0, 1, 2, 3, 4, 5, 6].map((b) => [a, b]));
    for (const [a, b] of ring) {
      expect(qr.modules[a][b]).toBe(true);
      expect(qr.modules[b][a]).toBe(true);
    }
    for (let i = 1; i < 6; i++) expect(qr.modules[1][i]).toBe(false);
    for (let y = 2; y < 5; y++) for (let x = 2; x < 5; x++) expect(qr.modules[y][x]).toBe(true);
    // Separator is light, timing pattern alternates, dark module is set.
    for (let i = 0; i < 8; i++) expect(qr.modules[7][i]).toBe(false);
    for (let i = 8; i < qr.size - 8; i++) expect(qr.modules[6][i]).toBe(i % 2 === 0);
    expect(qr.modules[qr.size - 8][8]).toBe(true);
  });

  it('matches known byte-mode capacities (data codewords)', () => {
    // ISO 18004 table 7: total data codewords.
    expect(numDataCodewords(1, 'L')).toBe(19);
    expect(numDataCodewords(1, 'H')).toBe(9);
    expect(numDataCodewords(10, 'M')).toBe(216);
    expect(numDataCodewords(40, 'L')).toBe(2956);
    expect(numDataCodewords(40, 'H')).toBe(1276);
  });

  it('picks larger versions for longer input and higher levels, and honours minVersion', () => {
    expect(encodeQR('x'.repeat(17), { level: 'L' }).version).toBe(1); // v1-L holds 17 bytes
    expect(encodeQR('x'.repeat(18), { level: 'L' }).version).toBe(2);
    expect(encodeQR(LONG, { level: 'H' }).version).toBeGreaterThan(encodeQR(LONG, { level: 'L' }).version);
    expect(encodeQR('hi', { minVersion: 5 }).size).toBe(37);
    expect(() => encodeQR('x'.repeat(3000), { level: 'L' })).toThrow(RangeError);
  });

  it('every version 1–40 decodes at L and H (raw matrix)', () => {
    for (let v = 1; v <= 40; v++) {
      // jsQR's version table has a typo for v23 (alignment centre 74 instead of ISO's 78), so it can't read
      // full-capacity v23 codes; every other decoder (and the spec) agrees with this encoder.
      if (v === 23) continue;
      for (const level of ['L', 'H'] as const) {
        const text = 'a'.repeat(numDataCodewords(v, level) - 3);
        const qr = encodeQR(text, { level });
        expect(qr.version).toBe(v);
        expect(decodeMatrix(qr.modules)).toBe(text);
      }
    }
  });

  it('is deterministic', () => {
    expect(encodeQR(SAMPLES.url)).toEqual(encodeQR(SAMPLES.url));
  });
});

describe('QRSvg', () => {
  for (const [name, text] of Object.entries(SAMPLES)) {
    for (const level of LEVELS) {
      for (const rounded of [true, false]) {
        it(`decodes ${name} @ ${level} (${rounded ? 'rounded' : 'square'})`, () => {
          const svg = renderToStaticMarkup(<QRSvg value={text} level={level} rounded={rounded} />);
          expect(decode(svg)).toBe(text);
        });
      }
    }
  }

  it('decodes large versions (v25, v40)', () => {
    const big = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.repeat(34); // 1224 bytes
    expect(encodeQR(big, { level: 'L' }).version).toBe(25);
    expect(decode(renderToStaticMarkup(<QRSvg value={big} level="L" />))).toBe(big);
    const max = 'z'.repeat(2900);
    expect(encodeQR(max, { level: 'L' }).version).toBe(40);
    expect(decode(renderToStaticMarkup(<QRSvg value={max} level="L" rounded={false} />))).toBe(max);
  });

  it('keeps the deprecated seed prop working and honours margin', () => {
    const seed = 'https://example.com/albums/summer-2026';
    const svg = renderToStaticMarkup(<QRSvg seed={seed} margin={2} />);
    expect(svg).toContain('data-slot="qr-svg"');
    expect(svg).toContain(`viewBox="0 0 ${encodeQR(seed).size + 4} ${encodeQR(seed).size + 4}"`);
    expect(decode(svg)).toBe(seed);
  });

  it('is aria-hidden by default and labelled when titled', () => {
    expect(renderToStaticMarkup(<QRSvg value="x" />)).toContain('aria-hidden="true"');
    const titled = renderToStaticMarkup(<QRSvg value="x" title="Join Wi-Fi" />);
    expect(titled).toContain('role="img"');
    expect(titled).toContain('<title>Join Wi-Fi</title>');
    expect(titled).not.toContain('aria-hidden');
  });

  it('renders two paths (no per-module elements)', () => {
    const svg = renderToStaticMarkup(<QRSvg value={SAMPLES.long} background="#fff" />);
    expect(svg.match(/<path/g)).toHaveLength(2);
    expect(svg.match(/<rect/g)).toHaveLength(1);
  });
});
