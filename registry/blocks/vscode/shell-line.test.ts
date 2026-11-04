import { describe, expect, it } from 'vitest';
import {
  completeCommandLine, completePath, npmInstallOf, npmScriptCommand, npmScriptHeader, npmScriptOf, splitCommandLine, unstreamed,
} from './almostnode/shell-line';

const lines = (input: string) => splitCommandLine(input).map(({ line, when }) => `${when}:${line}`);

describe('splitCommandLine', () => {
  it('leaves a single command whole', () => {
    expect(lines('ls -la')).toEqual(['always:ls -la']);
  });

  it('splits a list, with how each part depends on the last', () => {
    expect(lines('a && b || c; d')).toEqual(['always:a', 'ok:b', 'fail:c', 'always:d']);
  });

  it('drops an empty end', () => {
    expect(lines('a;')).toEqual(['always:a']);
  });

  it('keeps pipes and redirects in their part', () => {
    expect(lines('ls | wc -l && echo hi > f 2>&1')).toEqual(['always:ls | wc -l', 'ok:echo hi > f 2>&1']);
  });

  it('is not fooled by what is quoted', () => {
    expect(lines(`echo "a && b"; echo 'c;d'`)).toEqual([`always:echo "a && b"`, `always:echo 'c;d'`]);
    expect(lines(String.raw`echo a\;b`)).toEqual([String.raw`always:echo a\;b`]);
  });

  it('leaves anything more than a plain list alone', () => {
    for (const line of ['(a; b)', 'a; $(b)', 'echo `a`; b', 'if a; then b; fi', 'for x in 1 2; do echo $x; done', 'a & b', 'false; echo $?', 'cat <<EOF', 'case x in a) b;; esac', '{ a; b; }']) {
      expect(splitCommandLine(line)).toEqual([{ line, when: 'always' }]);
    }
  });

  it('leaves an unclosed quote alone', () => {
    expect(lines('echo "a; b')).toEqual(['always:echo "a; b']);
  });
});

describe('npm', () => {
  it('finds the script a line runs', () => {
    expect(npmScriptOf('npm run build')).toBe('build');
    expect(npmScriptOf('npm run-script x:y')).toBe('x:y');
    expect(npmScriptOf('npm test')).toBe('test');
    expect(npmScriptOf('npm start')).toBe('start');
    expect(npmScriptOf('npm run')).toBeNull();
    expect(npmScriptOf('npm run build -- --flag')).toBeNull();
    expect(npmScriptOf('npm install')).toBeNull();
  });

  it('reads an install', () => {
    expect(npmInstallOf('npm install lodash')).toEqual({ packages: ['lodash'], dev: false });
    expect(npmInstallOf('npm i -D a b@1')).toEqual({ packages: ['a', 'b@1'], dev: true });
    expect(npmInstallOf('npm add a --save-dev')).toEqual({ packages: ['a'], dev: true });
    expect(npmInstallOf('npm install')).toEqual({ packages: [], dev: false });
    expect(npmInstallOf('npm run x')).toBeNull();
    expect(npmInstallOf('npm install a | tee log')).toBeNull();
  });

  it('writes the header npm does', () => {
    expect(npmScriptHeader({ name: 'hi', version: '1.0.0', scripts: { x: 'node y' } }, 'x')).toBe('\n> hi@1.0.0 x\n> node y\n\n');
    expect(npmScriptHeader({ scripts: {} }, 'x')).toBeNull();
  });

  it('writes the line that runs a script, quoting a name that needs it', () => {
    expect(npmScriptCommand('build:all')).toBe('npm run build:all');
    expect(npmScriptCommand('a b')).toBe('npm run "a b"');
  });
});

describe('unstreamed', () => {
  it('is what the result has that was not already shown', () => {
    expect(unstreamed('abc', '')).toBe('abc');
    expect(unstreamed('abc', 'abc')).toBe('');
    expect(unstreamed('a\nb\nc\n', 'b\n')).toBe('a\nc\n');
  });

  it('shows nothing rather than repeating what it cannot place', () => {
    expect(unstreamed('abc', 'xyz')).toBe('');
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
