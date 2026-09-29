import { describe, expect, it } from 'vitest';
import { commandMatch, matchesHotkey } from './command-menu';

const ev = (p: Partial<{ key: string; code: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }>) => ({
  key: '', code: '', metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...p,
});

describe('commandMatch', () => {
  it('matches everything on an empty query', () => {
    expect(commandMatch('', 'Anything')).toEqual({ score: 1, indices: [] });
  });
  it('ranks a prefix over a word start over a mid-word substring', () => {
    const prefix = commandMatch('thr', 'Thread list')!.score;
    const word = commandMatch('thr', 'New thread')!.score;
    const mid = commandMatch('hre', 'New thread')!.score;
    expect(prefix).toBeGreaterThan(word);
    expect(word).toBeGreaterThan(mid);
  });
  it('matches a fuzzy subsequence below any substring, with indices', () => {
    const m = commandMatch('ntf', 'New thread in folder')!;
    expect(m.indices).toEqual([0, 4, 14]);
    expect(m.score).toBeLessThan(commandMatch('new', 'New thread in folder')!.score);
  });
  it('needs every word to match', () => {
    expect(commandMatch('copy id', 'Copy thread ID')).not.toBeNull();
    expect(commandMatch('copy url', 'Copy thread ID')).toBeNull();
  });
});

describe('matchesHotkey', () => {
  it('matches letters by physical key, whatever Alt types', () => {
    expect(matchesHotkey(ev({ key: '†', code: 'KeyT', altKey: true, shiftKey: true, ctrlKey: true }), 'ctrl+alt+shift+t')).toBe(true);
  });
  it('matches alt+space by code (macOS types a non-breaking space)', () => {
    expect(matchesHotkey(ev({ key: ' ', code: 'Space', altKey: true }), 'alt+space')).toBe(true);
    expect(matchesHotkey(ev({ key: ' ', altKey: true }), 'alt+space')).toBe(true);
    expect(matchesHotkey(ev({ key: ' ', code: 'Space' }), 'alt+space')).toBe(false);
  });
  it('matches named keys', () => {
    expect(matchesHotkey(ev({ key: 'Enter', code: 'NumpadEnter' }), 'enter')).toBe(true);
    expect(matchesHotkey(ev({ key: 'Escape', code: 'Escape' }), 'esc')).toBe(true);
  });
});
