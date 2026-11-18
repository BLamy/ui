import { describe, expect, it } from 'vitest';
import { npmInstallOf, npmScriptHeader, npmScriptOf, splitCommandLine, unstreamed } from './command-line';

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
