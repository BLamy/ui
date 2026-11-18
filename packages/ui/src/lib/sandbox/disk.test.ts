import { describe, expect, it } from 'vitest';
import { createSandboxDisk, normalizePath } from './disk';
import type { SandboxFileEvent } from './model';

const setup = () => {
  const disk = createSandboxDisk('/project', { 'index.js': 'one', 'src/a.js': 'a', '/etc/motd': 'hi' });
  const events: SandboxFileEvent[][] = [];
  disk.watch('/', (batch) => events.push(batch));
  return { disk, events };
};

describe('normalizePath', () => {
  it('resolves dots and doubled slashes, and never leaves the root', () => {
    expect(normalizePath('/a/b/../c//d/')).toBe('/a/c/d');
    expect(normalizePath('/../..')).toBe('/');
    expect(normalizePath('/a/./b')).toBe('/a/b');
  });
});

describe('the page\'s copy of the disk', () => {
  it('starts with the files it is given, under the root or at their own path, and the folders above them', () => {
    const { disk } = setup();
    expect([...disk.files.keys()].sort()).toEqual(['/etc/motd', '/project/index.js', '/project/src/a.js']);
    expect([...disk.directories].sort()).toEqual(['/', '/etc', '/project', '/project/src']);
    expect(disk.resolve('src/../index.js')).toBe('/project/index.js');
    expect(disk.resolve('/tmp/x')).toBe('/tmp/x');
    // A Worker is started from this: the root needs no making.
    expect(disk.snapshot().dirs.sort()).toEqual(['/etc', '/project', '/project/src']);
  });

  it('lists what is directly in a folder, by name', () => {
    const { disk } = setup();
    expect(disk.list('/project')).toEqual([{ name: 'index.js', kind: 'file' }, { name: 'src', kind: 'directory' }]);
    expect(disk.list('/')).toEqual([{ name: 'etc', kind: 'directory' }, { name: 'project', kind: 'directory' }]);
    expect(() => disk.list('/project/index.js')).toThrow('Not a directory');
    expect(() => disk.list('/nowhere')).toThrow('No such directory');
  });

  it('writes a file and the folders above it, and says so', () => {
    const { disk, events } = setup();
    disk.write('/project/lib/deep/x.js', 'x');
    expect(disk.files.get('/project/lib/deep/x.js')).toBe('x');
    expect(events).toEqual([[
      { type: 'change', path: '/project/lib', kind: 'directory' },
      { type: 'change', path: '/project/lib/deep', kind: 'directory' },
      { type: 'change', path: '/project/lib/deep/x.js', kind: 'file' },
    ]]);
  });

  it('refuses what a disk can\'t hold', () => {
    const { disk, events } = setup();
    expect(() => disk.write('/project/src', 'x')).toThrow('Is a directory');
    expect(() => disk.write('/project/index.js/x', 'x')).toThrow('Not a directory: /project/index.js');
    expect(() => disk.mkdir('/project/index.js')).toThrow('File exists');
    expect(() => disk.remove('/', true)).toThrow('root');
    expect(() => disk.remove('/project/nope', false)).toThrow('No such file or directory');
    expect(() => disk.remove('/project/src', false)).toThrow('Directory not empty');
    expect(() => disk.rename('/project/src', '/project/src/inner')).toThrow('into itself');
    expect(() => disk.rename('/project/nope', '/project/x')).toThrow('No such file or directory');
    expect(events).toEqual([]);
    expect(() => disk.write('/project/x', 'x')).not.toThrow();
  });

  it('moves a folder with all that is in it', () => {
    const { disk, events } = setup();
    disk.write('/project/src/deep/b.js', 'b');
    events.length = 0;
    disk.rename('/project/src', '/project/lib/code');
    expect([...disk.files.keys()].sort()).toEqual(['/etc/motd', '/project/index.js', '/project/lib/code/a.js', '/project/lib/code/deep/b.js']);
    expect(disk.directories.has('/project/src')).toBe(false);
    expect(disk.directories.has('/project/lib/code/deep')).toBe(true);
    expect(events).toEqual([[{ type: 'change', path: '/project/lib', kind: 'directory' }, { type: 'rename', from: '/project/src', to: '/project/lib/code' }]]);
  });

  it('removes a folder and all that is in it when asked to', () => {
    const { disk, events } = setup();
    disk.remove('/project/src', true);
    expect(disk.files.has('/project/src/a.js')).toBe(false);
    expect(disk.directories.has('/project/src')).toBe(false);
    expect(events).toEqual([[{ type: 'delete', path: '/project/src' }]]);
  });

  it('takes what commands did, and tells a move from a delete and a new file', () => {
    const { disk, events } = setup();
    const bytes = new Uint8Array([0xff, 0xfe]);
    disk.apply({
      changed: [{ path: '/project/renamed.js', data: 'one' }, { path: '/project/src/a.js', data: 'a2' }, { path: '/project/out/bin', data: bytes }],
      removed: ['/project/index.js', '/etc/motd'],
      dirs: ['/project/out'],
      removedDirs: ['/etc'],
    });
    expect(events).toEqual([[
      { type: 'rename', from: '/project/index.js', to: '/project/renamed.js' },
      { type: 'change', path: '/project/out', kind: 'directory' },
      { type: 'change', path: '/project/src/a.js', kind: 'file' },
      { type: 'change', path: '/project/out/bin', kind: 'file' },
      { type: 'delete', path: '/etc/motd' },
      { type: 'delete', path: '/etc' },
    ]]);
    expect(disk.files.get('/project/renamed.js')).toBe('one');
    expect(disk.files.get('/project/out/bin')).toBe(bytes);
  });

  it('says nothing when a report changes nothing', () => {
    const { disk, events } = setup();
    disk.apply({ changed: [{ path: '/project/index.js', data: 'one' }], removed: ['/project/never'], dirs: ['/project/src'], removedDirs: ['/nope'] });
    expect(events).toEqual([]);
  });

  it('tells a watcher only what is at its path or under it', () => {
    const { disk } = setup();
    const seen: SandboxFileEvent[][] = [];
    const stop = disk.watch('/project/src', (batch) => seen.push(batch));
    disk.write('/project/index.js', 'two');
    disk.write('/project/src/b.js', 'b');
    disk.rename('/project/src/b.js', '/project/b.js');
    disk.remove('/project/src', true);
    stop();
    disk.write('/project/src/c.js', 'c');
    expect(seen).toEqual([
      [{ type: 'change', path: '/project/src/b.js', kind: 'file' }],
      [{ type: 'rename', from: '/project/src/b.js', to: '/project/b.js' }],
      [{ type: 'delete', path: '/project/src' }],
    ]);
  });
});
