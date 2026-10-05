import { describe, expect, it } from 'vitest';
import { frameTimes, wavPeaks } from '@/lib/ffmpeg/media';

interface WavOptions {
  sampleRate?: number;
  channels?: number;
  /** What the data chunk's header says its size is (default: the samples' size). */
  dataSize?: number;
  /** Chunks to put between `fmt ` and `data`, as [id, size] (their bodies are zeros). */
  extra?: Array<[string, number]>;
}

/** A 16-bit PCM WAV: RIFF/WAVE, a `fmt ` chunk, any extra chunks (padded to even sizes), then the interleaved samples. */
function wav(samples: number[], { sampleRate = 8000, channels = 1, dataSize, extra = [] }: WavOptions = {}): Uint8Array {
  const extraSize = extra.reduce((sum, [, size]) => sum + 8 + size + (size & 1), 0);
  const bytes = new Uint8Array(12 + 24 + extraSize + 8 + samples.length * 2);
  const view = new DataView(bytes.buffer);
  const tag = (at: number, id: string) => [...id].forEach((ch, i) => { bytes[at + i] = ch.charCodeAt(0); });
  tag(0, 'RIFF');
  view.setUint32(4, bytes.length - 8, true);
  tag(8, 'WAVE');
  tag(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels * 2, true);
  view.setUint16(32, channels * 2, true);
  view.setUint16(34, 16, true);
  let at = 36;
  for (const [id, size] of extra) {
    tag(at, id);
    view.setUint32(at + 4, size, true);
    at += 8 + size + (size & 1);
  }
  tag(at, 'data');
  view.setUint32(at + 4, dataSize ?? samples.length * 2, true);
  samples.forEach((s, i) => view.setInt16(at + 8 + i * 2, s, true));
  return bytes;
}

describe('frameTimes', () => {
  it('is one frame at 0 for a still, or anything without a duration', () => {
    expect(frameTimes(0, 5)).toEqual([0]);
    expect(frameTimes(NaN, 5)).toEqual([0]);
  });
  it('takes the middle of each of `count` equal slices', () => {
    expect(frameTimes(10, 5)).toEqual([1, 3, 5, 7, 9]);
    expect(frameTimes(10, 1)).toEqual([5]);
  });
  it('makes the count a whole number, at least one', () => {
    expect(frameTimes(10, 2.4)).toEqual([2.5, 7.5]);
    expect(frameTimes(10, 0)).toEqual([5]);
  });
  it('never asks for a time past duration - 0.1: a seek to the very end finds no frame', () => {
    const times = frameTimes(1, 10);
    expect(times).toHaveLength(10);
    expect(times[0]).toBeCloseTo(0.05);
    expect(times.at(-1)).toBeCloseTo(0.9); // the middle of the last slice would be 0.95
    expect(times.every((t) => t <= 0.9)).toBe(true);
    expect(frameTimes(0.05, 3)).toEqual([0, 0, 0]);
  });
});

describe('wavPeaks', () => {
  it('keeps the loudest sample of each slice, with the rate and the duration', () => {
    // 100 samples a second in slices of a tenth: 25 samples are two full slices and half of a third
    const samples = Array<number>(25).fill(0);
    samples[3] = 16384;
    samples[7] = -8000;
    samples[12] = -32768;
    samples[19] = 1000;
    samples[22] = 8192;
    samples[24] = -4096;
    const { peaks, rate, duration } = wavPeaks(wav(samples, { sampleRate: 100 }), 10);
    expect([...peaks]).toEqual([0.5, 1, 0.25]);
    expect(rate).toBe(10);
    expect(duration).toBe(0.25);
  });
  it('makes 50 slices a second by default', () => {
    const { peaks, rate, duration } = wavPeaks(wav(Array<number>(8000).fill(0)));
    expect(rate).toBe(50);
    expect(peaks).toHaveLength(50);
    expect(duration).toBe(1);
  });
  it('reads the first channel of a stereo file', () => {
    // left, right, left, right…: the loud right channel doesn't count
    const { peaks, duration } = wavPeaks(wav([0, 32767, 16384, 32767, 0, 32767, 0, 32767], { sampleRate: 100, channels: 2 }), 50);
    expect([...peaks]).toEqual([0.5, 0]);
    expect(duration).toBe(0.04);
  });
  it('reads to the end when the data size is unset, as in a streamed WAV', () => {
    const samples = [0, 0, 16384, 0, 0, 0, 0, 0, 0, -16384];
    for (const dataSize of [0xffffffff, 0]) {
      const { peaks, duration } = wavPeaks(wav(samples, { sampleRate: 10, dataSize }), 5);
      expect([...peaks]).toEqual([0, 0.5, 0, 0, 0.5]);
      expect(duration).toBe(1);
    }
  });
  it('skips other chunks, including the pad byte after an odd-sized one', () => {
    const { peaks } = wavPeaks(wav([16384, 0], { sampleRate: 2, extra: [['LIST', 5], ['fact', 4]] }), 1);
    expect([...peaks]).toEqual([0.5]);
  });
  it('reads a WAV that is a view into a larger buffer', () => {
    const inner = wav([0, 8192], { sampleRate: 2 });
    const outer = new Uint8Array(inner.length + 7);
    outer.set(inner, 3);
    expect([...wavPeaks(outer.subarray(3, 3 + inner.length), 1).peaks]).toEqual([0.25]);
  });
  it('throws a TypeError for anything but a 16-bit PCM WAV', () => {
    expect(() => wavPeaks(new TextEncoder().encode('ID3\u0004 this is an MP3, not a WAV'))).toThrow(TypeError);
    expect(() => wavPeaks(new Uint8Array(4))).toThrow(/Not a WAV/);
    const eightBit = wav([0, 0]);
    new DataView(eightBit.buffer).setUint16(34, 8, true);
    expect(() => wavPeaks(eightBit)).toThrow(/16-bit/);
  });
});
