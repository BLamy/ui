import { describe, expect, it } from 'vitest';
import { sourcePath, sourceTree } from './source-tree';

describe('recorded source identities in the browser', () => {
  it('keeps equal basenames, equal URLs and origins separately selectable', () => {
    const own = [
      { id: 'one', url: 'src/cart.js' },
      { id: 'two', url: 'other/cart.js' },
      { id: 'three', url: 'src/cart.js' },
      { id: 'four', url: 'https://one.test/cart.js' },
      { id: 'five', url: 'https://two.test/cart.js' },
      { id: 'six', url: 'src' },
    ];
    const tree = sourceTree(own, []);
    expect(tree.sources.size).toBe(6);
    expect([...tree.sources.values()]).toEqual(own);
    expect(tree.paths.get('one')?.at(-1)?.id).not.toBe(tree.paths.get('three')?.at(-1)?.id);
    expect(tree.paths.get('four')?.[0]?.id).not.toBe(tree.paths.get('five')?.[0]?.id);
    expect(tree.items.filter((node) => node.name === 'src')).toHaveLength(2);
  });

  it('keeps framework code in a collapsed group with a path back to the active source', () => {
    const rest = [{ id: 'runtime', url: 'src/runtime.js', framework: true }];
    const tree = sourceTree([{ id: 'app', url: 'src/app.tsx' }], rest);
    const group = tree.items.find((node) => node.id === 'framework')!;
    expect(group.children?.[0].children?.[0].id).toBe('source:runtime');
    expect(tree.paths.get('runtime')?.[0]?.id).toBe('framework');
    expect(tree.sources.get('source:runtime')).toBe(rest[0]);
  });

  it('retains URL suffixes, Windows paths, synthetic sources and empty data', () => {
    expect(sourcePath({ id: 'url', url: 'https://example.test/src/a.js?v=2#code' })).toEqual(['https://example.test', 'src', 'a.js?v=2#code']);
    expect(sourcePath({ id: 'query', url: 'https://example.test/a.js?path=/x/y' })).toEqual(['https://example.test', 'a.js?path=/x/y']);
    expect(sourcePath({ id: 'win', url: 'C:\\project\\src\\app.ts' })).toEqual(['C:', 'project', 'src', 'app.ts']);
    expect(sourcePath({ id: '<eval>' })).toEqual(['<eval>']);
    expect(sourceTree([], []).items).toEqual([]);
  });
});
