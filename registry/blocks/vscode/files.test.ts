import { describe, expect, it } from 'vitest';
import { ancestors, basename, buildTree, detectEol, detectIndentation, dirname, isSearchable, isValidName, languageName, resolvePath, searchFiles } from './files';

describe('paths', () => {
  it('takes them apart', () => {
    expect(dirname('/a/b.js')).toBe('/a');
    expect(dirname('/b.js')).toBe('/');
    expect(basename('/a/b.js')).toBe('b.js');
    expect(ancestors('/a/b/c.js')).toEqual(['/a/b', '/a']);
  });

  it('resolves against a folder', () => {
    expect(resolvePath('/a/b', 'c')).toBe('/a/b/c');
    expect(resolvePath('/a/b', '../c')).toBe('/a/c');
    expect(resolvePath('/a/b', '/x/./y')).toBe('/x/y');
    expect(resolvePath('/a', '../..')).toBe('/');
  });

  it('knows what a name can be', () => {
    expect(isValidName('a.js')).toBe(true);
    for (const bad of ['', ' ', 'a/b', '.', '..']) expect(isValidName(bad)).toBe(false);
  });
});

describe('buildTree', () => {
  it('nests files and folders under the root, including empty folders', () => {
    const tree = buildTree('/p', ['/p/a.js', '/p/src/b.js', '/p/src/lib/c.js', '/other/x.js'], ['/p/src', '/p/src/lib', '/p/empty']);
    const names = tree.map((node) => node.name).sort();
    expect(names).toEqual(['a.js', 'empty', 'src']);
    const src = tree.find((node) => node.name === 'src');
    expect(src?.id).toBe('/p/src');
    expect(src?.children?.map((node) => node.name).sort()).toEqual(['b.js', 'lib']);
    expect(tree.find((node) => node.name === 'empty')?.children).toEqual([]);
  });

  it('makes the folder of a file it has not been told about', () => {
    const tree = buildTree('/p', ['/p/deep/er/x.js'], []);
    expect(tree[0].children?.[0].children?.[0].id).toBe('/p/deep/er/x.js');
  });

  it('fades node_modules and dotfiles', () => {
    const tree = buildTree('/p', ['/p/.env', '/p/a.js'], ['/p/node_modules']);
    expect(tree.find((node) => node.name === 'node_modules')?.dimmed).toBe(true);
    expect(tree.find((node) => node.name === '.env')?.dimmed).toBe(true);
    expect(tree.find((node) => node.name === 'a.js')?.dimmed).toBeUndefined();
  });
});

describe('facts about a file', () => {
  it('reads indentation from the lines', () => {
    expect(detectIndentation('a\n  b\n    c\n  d\n')).toEqual({ kind: 'spaces', size: 2 });
    expect(detectIndentation('a\n    b\n        c\n')).toEqual({ kind: 'spaces', size: 4 });
    expect(detectIndentation('a\n\tb\n\t\tc\n')).toEqual({ kind: 'tabs', size: 4 });
    expect(detectIndentation('no indent at all')).toEqual({ kind: 'spaces', size: 2 });
  });

  it('reads line endings', () => {
    expect(detectEol('a\nb')).toBe('LF');
    expect(detectEol('a\r\nb')).toBe('CRLF');
  });

  it('names a language', () => {
    expect(languageName('ts')).toBe('TypeScript');
    expect(languageName('bash')).toBe('Shell Script');
    expect(languageName('zig')).toBe('ZIG');
  });
});

describe('searchFiles', () => {
  const files: Array<readonly [string, string | Uint8Array]> = [
    ['/p/b.js', 'first line\n  const Target = 1;\nlast target\n'],
    ['/p/a.md', 'no match here\n'],
    ['/p/node_modules/x/index.js', 'target\n'],
    ['/p/.git/config', 'target\n'],
    ['/p/image.png', new Uint8Array([1, 2, 3])],
  ];

  it('finds matches with line and column, ignoring case by default', () => {
    const { files: found, count } = searchFiles(files, 'target');
    expect(count).toBe(2);
    expect(found).toHaveLength(1);
    expect(found[0].path).toBe('/p/b.js');
    expect(found[0].matches.map(({ line, column, length }) => [line, column, length])).toEqual([[2, 8, 6], [3, 5, 6]]);
  });

  it('can match case', () => {
    expect(searchFiles(files, 'target', { matchCase: true }).count).toBe(1);
  });

  it('can use a regular expression, and says when it is not one', () => {
    expect(searchFiles(files, 't\\w+t', { regex: true }).count).toBe(2);
    expect(searchFiles(files, '(', { regex: true }).error).toBeTruthy();
  });

  it('treats a plain query as plain', () => {
    expect(searchFiles([['/a', 'a.b axb']], 'a.b').count).toBe(1);
  });

  it('skips node_modules, .git and what is not text', () => {
    expect(isSearchable('/p/node_modules/x.js')).toBe(false);
    expect(isSearchable('/p/.git/HEAD')).toBe(false);
    expect(isSearchable('/p/src/x.js')).toBe(true);
    expect(searchFiles(files, 'target').files.map((file) => file.path)).toEqual(['/p/b.js']);
  });

  it('survives a pattern that matches nothing wide', () => {
    expect(searchFiles([['/a', 'abc']], 'x*', { regex: true }).count).toBe(0);
  });

  it('stops at the limit and says so', () => {
    const many: Array<readonly [string, string]> = [['/a', 'x '.repeat(50)]];
    const found = searchFiles(many, 'x', { limit: 10 });
    expect(found.count).toBe(10);
    expect(found.limited).toBe(true);
  });

  it('previews near the match, keeping it in the text and not starting mid-word', () => {
    const long = `${'word '.repeat(30)}needle tail`;
    const [match] = searchFiles([['/a', long]], 'needle').files[0].matches;
    expect(match.preview.slice(match.previewColumn, match.previewColumn + match.length)).toBe('needle');
    expect(match.previewColumn).toBeLessThanOrEqual(12);
    expect(match.preview.startsWith('word ') || match.preview.startsWith('needle')).toBe(true);
  });

  it('trims indentation off a preview', () => {
    const [match] = searchFiles([['/a', '        code']], 'code').files[0].matches;
    expect(match.preview).toBe('code');
    expect(match.previewColumn).toBe(0);
    expect(match.column).toBe(8);
  });
});
