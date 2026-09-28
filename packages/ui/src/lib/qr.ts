/*
 * Minimal QR Code encoder (byte mode only).
 *
 * Ported and trimmed from Project Nayuki's "QR Code generator library" (TypeScript version):
 *   https://www.nayuki.io/page/qr-code-generator-library
 *   Copyright (c) Project Nayuki. (MIT License)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of this software and
 * associated documentation files (the "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the
 * following conditions:
 * - The above copyright notice and this permission notice shall be included in all copies or substantial
 *   portions of the Software.
 * - The Software is provided "as is", without warranty of any kind, express or implied, including but not
 *   limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. In
 *   no event shall the authors or copyright holders be liable for any claim, damages or other liability,
 *   whether in an action of contract, tort or otherwise, arising from, out of or in connection with the
 *   Software or the use or other dealings in the Software.
 *
 * Changes: byte mode (UTF-8) only, no ECI, functional API returning a boolean module matrix.
 */

export type QRLevel = 'L' | 'M' | 'Q' | 'H';

export interface QROptions {
  /** Error-correction level (default 'M'). L ~7%, M ~15%, Q ~25%, H ~30% recoverable. */
  level?: QRLevel;
  /** Smallest version (1–40) to consider (default 1). */
  minVersion?: number;
  /** Largest version (1–40) to consider (default 40). */
  maxVersion?: number;
  /** Force a mask pattern 0–7 instead of choosing the lowest penalty (default: auto). */
  mask?: number;
}

export interface QRCode {
  /** Modules per side (17 + 4 * version). */
  size: number;
  version: number;
  level: QRLevel;
  mask: number;
  /** `modules[y][x]` is true for a dark module. */
  modules: boolean[][];
}

const LEVEL_INDEX: Record<QRLevel, number> = { L: 0, M: 1, Q: 2, H: 3 };
const LEVEL_FORMAT_BITS: Record<QRLevel, number> = { L: 1, M: 0, Q: 3, H: 2 };

// prettier-ignore
const ECC_CODEWORDS_PER_BLOCK: number[][] = [
  // Version: (index 0 is padding)
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // L
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28], // M
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // Q
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30], // H
];

// prettier-ignore
const NUM_ERROR_CORRECTION_BLOCKS: number[][] = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25], // L
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49], // M
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68], // Q
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81], // H
];

const PENALTY_N1 = 3;
const PENALTY_N2 = 3;
const PENALTY_N3 = 40;
const PENALTY_N4 = 10;

const getBit = (x: number, i: number): boolean => ((x >>> i) & 1) !== 0;

/** Number of data bits available in a symbol of this version, after function patterns. */
function numRawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

/** Number of 8-bit data codewords (excluding ECC) for this version and level. */
export function numDataCodewords(ver: number, level: QRLevel): number {
  const e = LEVEL_INDEX[level];
  return Math.floor(numRawDataModules(ver) / 8) - ECC_CODEWORDS_PER_BLOCK[e][ver] * NUM_ERROR_CORRECTION_BLOCKS[e][ver];
}

function utf8(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

// ---- Reed–Solomon over GF(2^8 / 0x11D) ----

function rsMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree: number): number[] {
  const result: number[] = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = rsMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = rsMultiply(root, 0x02);
  }
  return result;
}

function rsRemainder(data: readonly number[], divisor: readonly number[]): number[] {
  const result: number[] = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ (result.shift() as number);
    result.push(0);
    divisor.forEach((coef, i) => (result[i] ^= rsMultiply(coef, factor)));
  }
  return result;
}

function addEccAndInterleave(data: number[], ver: number, level: QRLevel): number[] {
  const e = LEVEL_INDEX[level];
  const numBlocks = NUM_ERROR_CORRECTION_BLOCKS[e][ver];
  const blockEccLen = ECC_CODEWORDS_PER_BLOCK[e][ver];
  const rawCodewords = Math.floor(numRawDataModules(ver) / 8);
  const numShortBlocks = numBlocks - (rawCodewords % numBlocks);
  const shortBlockLen = Math.floor(rawCodewords / numBlocks);

  const blocks: number[][] = [];
  const div = rsDivisor(blockEccLen);
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortBlockLen - blockEccLen + (i < numShortBlocks ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, div);
    if (i < numShortBlocks) dat.push(0);
    blocks.push(dat.concat(ecc));
  }

  const result: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortBlockLen - blockEccLen || j >= numShortBlocks) result.push(block[i]);
    });
  }
  return result;
}

// ---- Matrix construction ----

function alignmentPositions(ver: number, size: number): number[] {
  if (ver === 1) return [];
  const numAlign = Math.floor(ver / 7) + 2;
  const step = Math.floor((ver * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

class Matrix {
  readonly modules: boolean[][];
  readonly isFunction: boolean[][];
  constructor(readonly size: number) {
    this.modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
    this.isFunction = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  }
  setFunction(x: number, y: number, dark: boolean) {
    this.modules[y][x] = dark;
    this.isFunction[y][x] = true;
  }
}

function drawFormatBits(m: Matrix, level: QRLevel, mask: number) {
  const data = (LEVEL_FORMAT_BITS[level] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  const size = m.size;

  for (let i = 0; i <= 5; i++) m.setFunction(8, i, getBit(bits, i));
  m.setFunction(8, 7, getBit(bits, 6));
  m.setFunction(8, 8, getBit(bits, 7));
  m.setFunction(7, 8, getBit(bits, 8));
  for (let i = 9; i < 15; i++) m.setFunction(14 - i, 8, getBit(bits, i));

  for (let i = 0; i < 8; i++) m.setFunction(size - 1 - i, 8, getBit(bits, i));
  for (let i = 8; i < 15; i++) m.setFunction(8, size - 15 + i, getBit(bits, i));
  m.setFunction(8, size - 8, true); // always-dark module
}

function drawVersion(m: Matrix, ver: number) {
  if (ver < 7) return;
  let rem = ver;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
  const bits = (ver << 12) | rem;
  for (let i = 0; i < 18; i++) {
    const bit = getBit(bits, i);
    const a = m.size - 11 + (i % 3);
    const b = Math.floor(i / 3);
    m.setFunction(a, b, bit);
    m.setFunction(b, a, bit);
  }
}

function drawFunctionPatterns(m: Matrix, ver: number, level: QRLevel) {
  const size = m.size;
  for (let i = 0; i < size; i++) {
    m.setFunction(6, i, i % 2 === 0);
    m.setFunction(i, 6, i % 2 === 0);
  }
  const finder = (x: number, y: number) => {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) m.setFunction(xx, yy, dist !== 2 && dist !== 4);
      }
    }
  };
  finder(3, 3);
  finder(size - 4, 3);
  finder(3, size - 4);

  const pos = alignmentPositions(ver, size);
  const n = pos.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          m.setFunction(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
        }
      }
    }
  }
  drawFormatBits(m, level, 0); // placeholder, overwritten once the mask is chosen
  drawVersion(m, ver);
}

function drawCodewords(m: Matrix, data: readonly number[]) {
  const size = m.size;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!m.isFunction[y][x] && i < data.length * 8) {
          m.modules[y][x] = getBit(data[i >>> 3], 7 - (i & 7));
          i++;
        }
      }
    }
  }
}

function maskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
    case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
    case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
    default: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
  }
}

function applyMask(m: Matrix, mask: number) {
  for (let y = 0; y < m.size; y++) {
    for (let x = 0; x < m.size; x++) {
      if (!m.isFunction[y][x] && maskBit(mask, x, y)) m.modules[y][x] = !m.modules[y][x];
    }
  }
}

/** ISO 18004 penalty score (N1 runs, N2 2x2 blocks, N3 finder-like patterns, N4 dark balance). */
function penaltyScore(mod: boolean[][]): number {
  const size = mod.length;
  let result = 0;
  const get = (x: number, y: number, horizontal: boolean) => (horizontal ? mod[y][x] : mod[x][y]);

  for (const horizontal of [true, false]) {
    for (let a = 0; a < size; a++) {
      // N1: runs of >= 5 same-colour modules.
      let runColor = false;
      let run = 0;
      for (let b = 0; b < size; b++) {
        const c = get(b, a, horizontal);
        if (b > 0 && c === runColor) {
          run++;
        } else {
          if (run >= 5) result += PENALTY_N1 + (run - 5);
          runColor = c;
          run = 1;
        }
      }
      if (run >= 5) result += PENALTY_N1 + (run - 5);

      // N3: 1:1:3:1:1 finder-like pattern with 4 light modules on either side (outside counts as light).
      const at = (b: number) => b >= 0 && b < size && get(b, a, horizontal);
      for (let b = -4; b < size; b++) {
        if (at(b) && !at(b + 1) && at(b + 2) && at(b + 3) && at(b + 4) && !at(b + 5) && at(b + 6)) {
          const before = !at(b - 1) && !at(b - 2) && !at(b - 3) && !at(b - 4);
          const after = !at(b + 7) && !at(b + 8) && !at(b + 9) && !at(b + 10);
          if (before || after) result += PENALTY_N3;
        }
      }
    }
  }

  // N2: 2x2 blocks of one colour.
  for (let y = 0; y < size - 1; y++) {
    for (let x = 0; x < size - 1; x++) {
      const c = mod[y][x];
      if (c === mod[y][x + 1] && c === mod[y + 1][x] && c === mod[y + 1][x + 1]) result += PENALTY_N2;
    }
  }

  // N4: deviation of dark proportion from 50% in 5% steps.
  let dark = 0;
  for (const row of mod) for (const c of row) if (c) dark++;
  const total = size * size;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  result += Math.max(0, k) * PENALTY_N4;
  return result;
}

/**
 * Encode `text` (UTF-8, byte mode) as a QR Code, picking the smallest version that fits at the
 * requested error-correction level and the mask with the lowest penalty score.
 */
export function encodeQR(text: string, opts: QROptions = {}): QRCode {
  const level = opts.level ?? 'M';
  const minVersion = Math.max(1, Math.min(40, Math.floor(opts.minVersion ?? 1)));
  const maxVersion = Math.max(minVersion, Math.min(40, Math.floor(opts.maxVersion ?? 40)));
  const bytes = utf8(text);

  let version = -1;
  for (let v = minVersion; v <= maxVersion; v++) {
    const ccBits = v <= 9 ? 8 : 16;
    if (bytes.length >= 1 << ccBits) continue;
    if (4 + ccBits + bytes.length * 8 <= numDataCodewords(v, level) * 8) {
      version = v;
      break;
    }
  }
  if (version < 0) throw new RangeError(`QR: data too long (${bytes.length} bytes) for level ${level}`);

  // Bit stream: mode indicator (byte = 0100), character count, data, terminator, padding.
  const bits: number[] = [];
  const append = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  append(0x4, 4);
  append(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) append(b, 8);
  const capacityBits = numDataCodewords(version, level) * 8;
  append(0, Math.min(4, capacityBits - bits.length));
  append(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacityBits; pad ^= 0xec ^ 0x11) append(pad, 8);

  const data: number[] = new Array(bits.length / 8).fill(0);
  bits.forEach((b, i) => (data[i >>> 3] |= b << (7 - (i & 7))));

  const size = version * 4 + 17;
  const m = new Matrix(size);
  drawFunctionPatterns(m, version, level);
  drawCodewords(m, addEccAndInterleave(data, version, level));

  let mask = opts.mask ?? -1;
  if (mask < 0 || mask > 7) {
    let best = Infinity;
    for (let i = 0; i < 8; i++) {
      applyMask(m, i);
      drawFormatBits(m, level, i);
      const p = penaltyScore(m.modules);
      if (p < best) {
        best = p;
        mask = i;
      }
      applyMask(m, i); // XOR again to undo
    }
  }
  applyMask(m, mask);
  drawFormatBits(m, level, mask);

  return { size, version, level, mask, modules: m.modules };
}
