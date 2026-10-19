/* A read-only Node-style `fs` over File System Access directory handles, for isomorphic-git. A linked worktree is
   three folders on disk: its checkout, the repository's shared `.git`, and its private `.git/worktrees/<name>`
   (HEAD and index). Mounting them as `/wt`, `/git` and two files over `/git/HEAD` and `/git/index` lets plain
   isomorphic-git read the worktree as if it were an ordinary checkout.
   The browser can't report inodes or ctimes, so every stat would miss the index's cache and every file would be
   hashed. Instead, a file whose size and mtime second match its index entry is reported with the entry's own
   stats, which is the same cache hit Git takes itself. Writes are ignored: nothing here changes the repository. */
import { Buffer } from 'buffer';

export interface Mount {
  /** Absolute virtual path: a folder (`/wt`) or, with `file`, a single file (`/git/HEAD`). */
  at: string;
  dir: FileSystemDirectoryHandle;
  /** Mount one file of `dir` (by name) at `at`. */
  file?: string;
}

/** The stats a Git index entry records. */
export interface IndexStat {
  ctimeSeconds: number; ctimeNanoseconds: number; mtimeSeconds: number; mtimeNanoseconds: number;
  dev: number; ino: number; mode: number; uid: number; gid: number; size: number;
}

class FsError extends Error {
  constructor(public code: string, path: string) { super(`${code}: ${path}`); }
}

const errorOf = (e: unknown, path: string) => {
  const name = e instanceof DOMException ? e.name : '';
  if (name === 'NotFoundError') return new FsError('ENOENT', path);
  if (name === 'TypeMismatchError') return new FsError('ENOTDIR', path);
  return e instanceof Error ? e : new Error(String(e));
};

function stats(kind: 'file' | 'directory', size: number, mtimeMs: number, mode?: number) {
  const dir = kind === 'directory';
  return {
    type: kind, mode: mode ?? (dir ? 0o40000 : 0o100644), size, ino: 0, dev: 0, uid: 0, gid: 0,
    mtimeMs, ctimeMs: mtimeMs, mtimeSeconds: Math.floor(mtimeMs / 1000), ctimeSeconds: Math.floor(mtimeMs / 1000),
    mtimeNanoseconds: 0, ctimeNanoseconds: 0,
    isFile: () => !dir, isDirectory: () => dir, isSymbolicLink: () => false,
  };
}

/** Parses a version 2 or 3 index into stats by path. Version 4 (prefix-compressed paths) returns nothing. */
export function parseIndex(bytes: Uint8Array): Map<string, IndexStat> {
  const out = new Map<string, IndexStat>();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 12 || view.getUint32(0) !== 0x44495243) return out;
  const version = view.getUint32(4);
  if (version !== 2 && version !== 3) return out;
  const count = view.getUint32(8);
  const decoder = new TextDecoder();
  let at = 12;
  for (let i = 0; i < count && at + 62 <= bytes.length; i++) {
    const u = (o: number) => view.getUint32(at + o);
    const flags = view.getUint16(at + 60);
    const extended = version === 3 && (flags & 0x4000) !== 0;
    const nameAt = at + 62 + (extended ? 2 : 0);
    let end = nameAt;
    while (end < bytes.length && bytes[end] !== 0) end++;
    out.set(decoder.decode(bytes.subarray(nameAt, end)), {
      ctimeSeconds: u(0), ctimeNanoseconds: u(4), mtimeSeconds: u(8), mtimeNanoseconds: u(12),
      dev: u(16), ino: u(20), mode: u(24), uid: u(28), gid: u(32), size: u(36),
    });
    // Entries are NUL-padded to a multiple of eight bytes (at least one NUL).
    const length = end - at;
    at += length + (8 - (length % 8));
  }
  return out;
}

export class HandleFs {
  private dirs = new Map<string, Promise<FileSystemDirectoryHandle>>();

  /** `hints`: index stats by the file's virtual path (`/wt/src/app.ts`). */
  constructor(private mounts: Mount[], private hints = new Map<string, IndexStat>()) {
    // Longest mount first, so `/git/HEAD` wins over `/git`.
    this.mounts = [...mounts].sort((a, b) => b.at.length - a.at.length);
  }

  private mountOf(path: string) {
    const m = this.mounts.find((x) => path === x.at || path.startsWith(`${x.at}/`));
    if (!m) throw new FsError('ENOENT', path);
    return { m, rest: path.slice(m.at.length).split('/').filter(Boolean) };
  }

  private dir(m: Mount, parts: string[]): Promise<FileSystemDirectoryHandle> {
    const key = `${m.at}/${parts.join('/')}`;
    let found = this.dirs.get(key);
    if (!found) {
      found = parts.length === 0 ? Promise.resolve(m.dir)
        : this.dir(m, parts.slice(0, -1)).then((parent) => parent.getDirectoryHandle(parts[parts.length - 1]));
      found.catch(() => this.dirs.delete(key));
      this.dirs.set(key, found);
    }
    return found;
  }

  private async entry(path: string): Promise<FileSystemDirectoryHandle | FileSystemFileHandle> {
    const { m, rest } = this.mountOf(path);
    try {
      if (m.file) {
        if (rest.length) throw new FsError('ENOTDIR', path);
        return await m.dir.getFileHandle(m.file);
      }
      if (!rest.length) return m.dir;
      const parent = await this.dir(m, rest.slice(0, -1));
      const name = rest[rest.length - 1];
      try { return await parent.getFileHandle(name); } catch (e) {
        if (e instanceof DOMException && e.name === 'TypeMismatchError') return await parent.getDirectoryHandle(name);
        throw e;
      }
    } catch (e) { throw errorOf(e, path); }
  }

  private async file(path: string) {
    const handle = await this.entry(path);
    if (handle.kind !== 'file') throw new FsError('EISDIR', path);
    return handle.getFile();
  }

  readonly promises = {
    readFile: async (path: string, options?: { encoding?: string } | string) => {
      const file = await this.file(path);
      const encoding = typeof options === 'string' ? options : options?.encoding;
      return encoding === 'utf8' ? file.text() : Buffer.from(await file.arrayBuffer());
    },
    readdir: async (path: string) => {
      const handle = await this.entry(path);
      if (handle.kind !== 'directory') throw new FsError('ENOTDIR', path);
      const names: string[] = [];
      for await (const name of (handle as FileSystemDirectoryHandle & { keys(): AsyncIterable<string> }).keys()) names.push(name);
      // Files mounted over this folder show up in it too.
      for (const m of this.mounts) {
        if (m.file && m.at.slice(0, m.at.lastIndexOf('/')) === path) {
          const name = m.at.slice(m.at.lastIndexOf('/') + 1);
          if (!names.includes(name)) names.push(name);
        }
      }
      return names;
    },
    stat: (path: string) => this.promises.lstat(path),
    lstat: async (path: string) => {
      const handle = await this.entry(path);
      if (handle.kind === 'directory') return stats('directory', 0, 0);
      const file = await handle.getFile();
      const hint = this.hints.get(path);
      if (hint && hint.size === file.size && hint.mtimeSeconds === Math.floor(file.lastModified / 1000)) {
        return { ...stats('file', file.size, file.lastModified, hint.mode), ...hint };
      }
      return stats('file', file.size, file.lastModified);
    },
    readlink: async (path: string) => { throw new FsError('EINVAL', path); },
    // Read-only: isomorphic-git may try to refresh its caches; nothing is written.
    writeFile: async () => {},
    mkdir: async () => {},
    rmdir: async () => {},
    unlink: async () => {},
    symlink: async () => {},
    chmod: async () => {},
  };
}
