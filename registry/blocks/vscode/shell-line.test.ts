import { describe, expect, it } from 'vitest';
import { completeCommandLine, completePath, npmScriptCommand } from './almostnode/shell-line';

describe('npm', () => {
  it('writes the line that runs a script, quoting a name that needs it', () => {
    expect(npmScriptCommand('build:all')).toBe('npm run build:all');
    expect(npmScriptCommand('a b')).toBe('npm run "a b"');
  });
});

describe('Tab', () => {
  const files = ['/p/index.js', '/p/src/greet.js', '/p/src/count.js', '/p/.env', '/p/node_modules/.bin/vitest'];
  const dirs = ['/p/src', '/p/node_modules'];

  it('completes a path from the folder it is in', () => {
    expect(completePath('in', '/p', files, dirs)).toEqual(['index.js']);
    expect(completePath('src/g', '/p', files, dirs)).toEqual(['src/greet.js']);
    expect(completePath('s', '/p', files, dirs)).toEqual(['src/']);
    expect(completePath('../in', '/p/src', files, dirs)).toEqual(['../index.js']);
  });

  it('hides dotfiles until asked', () => {
    expect(completePath('', '/p', files, dirs)).not.toContain('.env');
    expect(completePath('.', '/p', files, dirs)).toContain('.env');
  });

  const complete = (line: string) => completeCommandLine({
    word: line.split(/\s/).pop() ?? '', line, cursor: line.length, cwd: '/p', files, dirs, bin: '/p/node_modules/.bin/', scripts: () => ['build', 'test'],
  });

  it('offers scripts after npm run', () => {
    expect(complete('npm run b')).toEqual(['build']);
  });

  it('offers commands first, including what is installed', () => {
    expect(complete('nod')).toEqual(['node']);
    expect(complete('vit')).toEqual(['vitest']);
  });

  it('offers paths after that', () => {
    expect(complete('cat src/c')).toEqual(['src/count.js']);
  });
});
