import { describe, expect, it } from 'vitest';
import { formatFileSize } from '@/lib/file-size';

describe('formatFileSize', () => {
  it('writes decimal units in the locale, with "B" under a kilobyte', () => {
    expect(formatFileSize(0, 'en')).toBe('0 B');
    expect(formatFileSize(280, 'en')).toBe('280 B');
    expect(formatFileSize(999.6, 'en')).toBe('1 kB');
    expect(formatFileSize(1536, 'en')).toBe('1.5 kB');
    expect(formatFileSize(86_016, 'en')).toBe('86 kB');
    expect(formatFileSize(5_000_000, 'en')).toBe('5 MB');
    expect(formatFileSize(1_300_000, 'de')).toBe('1,3 MB');
  });
  it('is empty for a size it does not know', () => {
    expect(formatFileSize(undefined)).toBe('');
    expect(formatFileSize(-1)).toBe('');
    expect(formatFileSize(Number.NaN)).toBe('');
  });
});
