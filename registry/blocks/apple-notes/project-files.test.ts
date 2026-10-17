import { describe, expect, it } from 'vitest';
import { relativePath, resolvePath } from './project-files';

describe('relativePath', () => {
  it('links down, across and up from the note', () => {
    expect(relativePath('ideas', 'ideas/case/stl/back.stl')).toBe('./case/stl/back.stl');
    expect(relativePath('ideas/archive', 'ideas/case/part.stl')).toBe('../case/part.stl');
    expect(relativePath('ideas/a/b', 'ideas/x.png')).toBe('../../x.png');
  });
  it('encodes what Markdown links cannot hold', () => {
    expect(relativePath('ideas', 'ideas/my shot (1).png')).toBe('./my%20shot%20%281%29.png');
  });
});

describe('resolvePath', () => {
  it('resolves links against the note, or the project root for /', () => {
    expect(resolvePath('ideas', 'ideas', './case/stl/back.stl')).toBe('ideas/case/stl/back.stl');
    expect(resolvePath('ideas/archive', 'ideas', '../case/part.stl')).toBe('ideas/case/part.stl');
    expect(resolvePath('ideas/archive', 'ideas', '/BOM.md')).toBe('ideas/BOM.md');
    expect(resolvePath('ideas', 'ideas', './my%20shot%20%281%29.png?x=1')).toBe('ideas/my shot (1).png');
  });
  it('leaves web URLs and paths outside the project alone', () => {
    expect(resolvePath('ideas', 'ideas', 'https://example.com/a.stl')).toBeNull();
    expect(resolvePath('ideas', 'ideas', 'blob:http://x/1')).toBeNull();
    expect(resolvePath('ideas', 'ideas', '../other/a.stl')).toBeNull();
  });
  it('round-trips relativePath', () => {
    expect(resolvePath('ideas/archive', 'ideas', relativePath('ideas/archive', 'ideas/case/my part.stl'))).toBe('ideas/case/my part.stl');
  });
});
