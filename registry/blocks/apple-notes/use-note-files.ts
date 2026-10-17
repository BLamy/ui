/* use-fs watches the named OPFS store and picked directories. Individual file handles use the same
   read/write contract, with a small polling loop because use-fs mounts directories, not individual files. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { commonFilters, ensurePermission, getDirectoryPicker, getOpfsRoot, isAbortError, useFs, type FilterFn } from 'use-fs';
import { ROOT_FOLDER, type Folder, type Note } from './data';
import { forgetFolder, loadFolders, rememberFolder, type SavedFolder } from './folder-storage';
import { useFileChanges } from './use-file-changes';

export const BROWSER_ROOT = 'browser-notes';
export const LINKED_FILES = 'linked-files';
const markdown = (name: string) => /\.mdx?$/i.test(name);
/** The file types Notes opens: Markdown in the editor, STL models in the 3D viewer, images in an image viewer, JSON and
    YAML in visual-json. Everything else is listed only. */
export type FileKind = 'markdown' | 'stl' | 'image' | 'json' | 'yaml' | 'other';
export const fileKind = (name: string): FileKind => markdown(name) ? 'markdown'
  : /\.stl$/i.test(name) ? 'stl'
  : /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)$/i.test(name) ? 'image'
  : /\.json$/i.test(name) ? 'json'
  : /\.ya?ml$/i.test(name) ? 'yaml' : 'other';
const parentPath = (path: string) => {
  const separator = path.lastIndexOf('/');
  return separator < 0 ? '' : path.slice(0, separator);
};
export const fileId = (path: string) => `file:${path}`;
export const folderId = (path: string) => `folder:${path}`;
const message = (error: unknown) => error instanceof Error ? error.message : String(error);
const badName = (name: string) => !name.trim() || /[\\/]/.test(name) || name === '.' || name === '..';

/** Whether a file or folder of this name is already in the directory. */
async function taken(directory: FileSystemDirectoryHandle, name: string) {
  for (const probe of [() => directory.getFileHandle(name), () => directory.getDirectoryHandle(name)]) {
    try { await probe(); return true; }
    catch (e) { if (e instanceof DOMException && e.name === 'TypeMismatchError') return true; if (!(e instanceof DOMException && e.name === 'NotFoundError')) throw e; }
  }
  return false;
}

/** `name`, or “name 2.ext”, “name 3.ext”, … — the first that isn't taken in the directory. */
async function freeName(directory: FileSystemDirectoryHandle, name: string) {
  const dot = name.lastIndexOf('.');
  const [stem, extension] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ''];
  let next = name;
  for (let index = 2; await taken(directory, next); index++) next = `${stem} ${index}${extension}`;
  return next;
}

/** `move()` renames in place where the browser has it (Chromium); otherwise the entry is copied and the original removed. */
type Movable = FileSystemHandle & { move?: (name: string) => Promise<void> };
type Listable = FileSystemDirectoryHandle & { values(): AsyncIterable<FileSystemFileHandle | FileSystemDirectoryHandle> };
async function copyInto(from: FileSystemDirectoryHandle, to: FileSystemDirectoryHandle) {
  for await (const entry of (from as Listable).values()) {
    if (entry.kind === 'file') {
      const stream = await (await to.getFileHandle(entry.name, { create: true })).createWritable();
      await stream.write(await entry.getFile()); await stream.close();
    } else await copyInto(entry, await to.getDirectoryHandle(entry.name, { create: true }));
  }
}

interface LinkedFile { handle: FileSystemFileHandle; body: string; updated: Date }
interface FolderSource extends SavedFolder { connected: boolean }
type PermissionHandle = FileSystemDirectoryHandle & { queryPermission?: (options: { mode: 'readwrite' }) => Promise<PermissionState> };
type FilePickerWindow = Window & {
  showOpenFilePicker?: (options: { multiple: boolean; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<FileSystemFileHandle[]>;
};

/** A save only replaces the version the user actually edited. */
export class FileConflict extends Error {
  constructor(public disk: string | null) { super(disk === null ? 'The file was removed.' : 'The file changed outside Notes.'); }
}

export function useNoteFiles() {
  const ownWrites = useRef(new Map<string, string>());
  const [directories, setDirectories] = useState<string[]>([]);
  const [otherPaths, setOtherPaths] = useState<string[]>([]);
  const directoryHandles = useRef(new Map<string, FileSystemDirectoryHandle>());
  const publishTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [linked, setLinked] = useState(new Map<string, LinkedFile>());
  const linkedRef = useRef(linked); linkedRef.current = linked;
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sources, setSources] = useState<FolderSource[]>([]);
  // A new filter instance is made for each scan. Recording its directories includes empty folders, and recording
  // the files it skips lists everything else by name, without a second traversal or reading their bodies.
  const trackFolders = useMemo<FilterFn>(() => () => {
    const seen = new Map<string, FileSystemDirectoryHandle>();
    const others = new Set<string>();
    const publish = () => {
      clearTimeout(publishTimer.current);
      publishTimer.current = setTimeout(() => {
        directoryHandles.current = seen;
        const paths = [...seen.keys()].sort();
        setDirectories((prev) => prev.join('\n') === paths.join('\n') ? prev : paths);
        const files = [...others].sort();
        setOtherPaths((prev) => prev.join('\n') === files.join('\n') ? prev : files);
      }, 80);
    };
    return {
      shouldIncludeFile: ({ path, name }) => {
        if (markdown(name)) return true;
        others.add(path); publish();
        return false;
      },
      shouldProcessDirectory: () => true,
      onDirectoryEnter({ path }, handle) {
        seen.set(path, handle);
        directoryHandles.current.set(path, handle);
        publish();
      },
    };
  }, []);
  const fs = useFs({ filters: [...commonFilters, trackFolders], mode: 'readwrite', pollInterval: 600, debounceInterval: 0 });
  const { addOpfsDirectory, addDirectory, isOpfsSupported } = fs;
  const mounting = useRef<Promise<string> | null>(null);
  const restoring = useRef<Promise<SavedFolder[]> | null>(null);

  useEffect(() => {
    let active = true;
    restoring.current ??= loadFolders();
    void restoring.current.then(async (saved) => {
      if (!active) return;
      setSources((prev) => [...prev, ...saved.filter((s) => !prev.some((p) => p.path === s.path)).map((s) => ({ ...s, connected: false }))]);
      for (const source of saved) {
        const handle = source.handle as PermissionHandle;
        const granted = !handle.queryPermission || await handle.queryPermission({ mode: 'readwrite' }) === 'granted';
        if (!active) return;
        if (granted) {
          await addDirectory(handle, { path: source.path });
          if (active) setSources((prev) => prev.map((s) => s.path === source.path ? { ...s, connected: true } : s));
        }
      }
    }).catch((e) => { if (active) setError(message(e)); });
    return () => { active = false; };
  }, [addDirectory]);

  useEffect(() => {
    if (!isOpfsSupported) return;
    let active = true;
    mounting.current ??= addOpfsDirectory({ name: 'apple-notes', path: BROWSER_ROOT });
    void mounting.current.then(() => { if (active) setReady(true); }).catch((e) => { if (active) setError(message(e)); });
    return () => { active = false; };
  }, [isOpfsSupported, addOpfsDirectory]);

  useEffect(() => () => clearTimeout(publishTimer.current), []);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      for (const [path, entry] of linkedRef.current) {
        try {
          const file = await entry.handle.getFile();
          const body = await file.text();
          if (stopped) return;
          if (body !== entry.body) setLinked((prev) => {
            if (!prev.has(path)) return prev;
            return new Map(prev).set(path, { ...entry, body, updated: new Date(file.lastModified) });
          });
        } catch (e) {
          if (stopped) return;
          if (e instanceof DOMException && e.name === 'NotFoundError') {
            setLinked((prev) => { const next = new Map(prev); next.delete(path); return next; });
          } else setError(message(e));
        }
      }
      if (!stopped) timer = setTimeout(() => { void poll(); }, 600);
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, []);

  const timestamps = useRef(new Map<string, { body: string; updated: Date }>());
  const notes = useMemo(() => {
    const result: Note[] = [];
    for (const [path, body] of fs.files) {
      const previous = timestamps.current.get(path);
      const updated = previous?.body === body ? previous.updated : new Date();
      timestamps.current.set(path, { body, updated });
      result.push({ id: fileId(path), folder: folderId(parentPath(path)), body, updated,
        file: { path, name: path.split('/').pop() ?? path, source: path.startsWith(`${BROWSER_ROOT}/`) ? 'browser' : 'local' } });
    }
    for (const [path, entry] of linked) result.push({ id: fileId(path), folder: LINKED_FILES, body: entry.body, updated: entry.updated,
      file: { path, name: entry.handle.name, source: 'local', standalone: true } });
    return result;
  }, [fs.files, linked]);
  const changes = useFileChanges(notes, ownWrites);

  const folders = useMemo(() => {
    const paths = new Set([...fs.directories, ...sources.map((s) => s.path),
      ...directories.filter((path) => fs.directories.some((root) => path === root || path.startsWith(`${root}/`)))]);
    for (const path of fs.files.keys()) {
      let parent = parentPath(path);
      while (parent) { paths.add(parent); parent = parentPath(parent); }
    }
    const result: Folder[] = [...paths].sort().map((path) => {
      const source = sources.find((s) => s.path === path);
      return { id: folderId(path), path, title: path === BROWSER_ROOT ? 'Notes' : source?.name ?? path.split('/').pop() ?? path,
        parent: path.includes('/') ? folderId(parentPath(path)) : ROOT_FOLDER.id,
        source: path === BROWSER_ROOT || path.startsWith(`${BROWSER_ROOT}/`) ? 'browser' : 'local',
        connected: source?.connected,
      };
    });
    if (linked.size) result.push({ id: LINKED_FILES, title: 'Open Files', parent: ROOT_FOLDER.id, source: 'local' });
    return result;
  }, [fs.directories, directories, fs.files, linked.size, sources]);

  /** Everything else in the watched folders, by path: listed (“All Files”), never opened. */
  const others = useMemo(() => otherPaths.filter((path) => fs.directories.some((root) => path.startsWith(`${root}/`))), [otherPaths, fs.directories]);

  // Blob URLs of files shown in notes and the 3D viewer, made again only when the file changes.
  const blobs = useRef(new Map<string, { url: string; modified: number; size: number }>());
  useEffect(() => () => { for (const blob of blobs.current.values()) URL.revokeObjectURL(blob.url); }, []);

  const directoryAt = async (path: string) => directoryHandles.current.get(path) ?? (path === BROWSER_ROOT && ready ? await getOpfsRoot({ name: 'apple-notes' }) : null);

  async function run<T>(action: () => Promise<T>): Promise<T | undefined> {
    setError(null); setBusy(true);
    try { return await action(); }
    catch (e) { if (!isAbortError(e)) setError(message(e)); return undefined; }
    finally { setBusy(false); }
  }

  /** Any file in a watched folder, Markdown or not. */
  async function readFile(path: string): Promise<File> {
    const handle = fs.handles.get(path);
    if (handle) return handle.getFile();
    const directory = await directoryAt(parentPath(path));
    if (!directory) throw new Error('The folder is not available.');
    return (await directory.getFileHandle(path.slice(path.lastIndexOf('/') + 1))).getFile();
  }

  /** Writes `data` into a watched folder under `name`, or the first free “name 2.ext”. Returns the new path. */
  async function writeFile(folder: string, name: string, data: Blob | string) {
    if (badName(name)) throw new Error('Use a filename without slashes.');
    const directory = await directoryAt(folder);
    if (!directory) throw new Error('The folder is not available.');
    if (!await ensurePermission(directory, 'readwrite')) throw new Error('Write access was not granted.');
    const free = await freeName(directory, name);
    const stream = await (await directory.getFileHandle(free, { create: true })).createWritable();
    try { await stream.write(data); await stream.close(); }
    catch (e) { await stream.abort().catch(() => {}); throw e; }
    await fs.refresh();
    return `${folder}/${free}`;
  }

  /** Overwrites the file at `path` in place (a data file edited in its viewer). */
  async function replaceFile(path: string, data: Blob | string) {
    const directory = await directoryAt(parentPath(path));
    if (!directory) throw new Error('The folder is not available.');
    if (!await ensurePermission(directory, 'readwrite')) throw new Error('Write access was not granted.');
    const stream = await (await directory.getFileHandle(path.slice(path.lastIndexOf('/') + 1))).createWritable();
    try { await stream.write(data); await stream.close(); }
    catch (e) { await stream.abort().catch(() => {}); throw e; }
  }

  async function removeFile(path: string) {
    if (fs.handles.has(path)) return fs.deleteFile(path);
    const directory = await directoryAt(parentPath(path));
    if (!directory) throw new Error('The folder is not available.');
    await directory.removeEntry(path.slice(path.lastIndexOf('/') + 1));
    await fs.refresh();
  }

  return {
    readFile, writeFile, replaceFile, removeFile,
    /** A `blob:` URL of the file, kept until it changes on disk. */
    async fileUrl(path: string) {
      const file = await readFile(path);
      const cached = blobs.current.get(path);
      if (cached && cached.modified === file.lastModified && cached.size === file.size) return cached.url;
      if (cached) URL.revokeObjectURL(cached.url);
      const url = URL.createObjectURL(file);
      blobs.current.set(path, { url, modified: file.lastModified, size: file.size });
      return url;
    },
    /** The watched folder (a sidebar location) a path is in. */
    rootOf: (path: string) => fs.directories.find((root) => path === root || path.startsWith(`${root}/`)) ?? null,
    notes, folders, others, ready, busy, ...changes, error: error ?? fs.error?.message ?? null,
    directoryRoots: sources.filter((source) => source.connected).map(({ path, handle }) => ({ path, handle })),
    isOpfsSupported: fs.isOpfsSupported, isOpfsWritable: fs.isOpfsWritable,
    canOpenFolder: fs.isBrowserSupported,
    canOpenFile: typeof window !== 'undefined' && typeof (window as FilePickerWindow).showOpenFilePicker === 'function',
    refresh: fs.refresh,
    clearError() { setError(null); },
    openFolder: () => run(async () => {
      const picker = getDirectoryPicker();
      if (!picker) throw new Error('Adding folders from your computer requires Chrome or Edge.');
      const handle = await picker({ mode: 'readwrite' });
      if (!await ensurePermission(handle, 'readwrite')) throw new Error('Write access was not granted.');
      const path = await fs.addDirectory(handle);
      const source = { path, name: path, handle, connected: true };
      setSources((prev) => prev.some((s) => s.path === path) ? prev.map((s) => s.path === path ? source : s) : [...prev, source]);
      try { await rememberFolder({ path, name: source.name, handle }); }
      catch { setError('The folder is open, but this browser could not remember it for next time.'); }
      return folderId(path);
    }),
    async reconnect(id: string) {
      const source = sources.find((s) => folderId(s.path) === id);
      if (!source) return;
      if (!await ensurePermission(source.handle, 'readwrite')) throw new Error('Folder access was not granted. Select the folder again to reconnect.');
      await fs.addDirectory(source.handle, { path: source.path });
      setSources((prev) => prev.map((s) => s.path === source.path ? { ...s, connected: true } : s));
    },
    async removeFolder(path: string) {
      await forgetFolder(path);
      fs.removeDirectory(path);
      setSources((prev) => prev.filter((s) => s.path !== path));
    },
    openFiles: () => run(async () => {
      const picker = (window as FilePickerWindow).showOpenFilePicker;
      if (!picker) throw new Error('Opening files from your computer requires Chrome or Edge.');
      const handles = await picker.call(window, { multiple: true, types: [{ description: 'Markdown and MDX', accept: { 'text/markdown': ['.md', '.mdx'] } }] });
      const entries = new Map(linkedRef.current);
      let selected: string | undefined;
      for (const handle of handles) {
        if (!markdown(handle.name)) throw new Error('Choose a .md or .mdx file.');
        if (!await ensurePermission(handle, 'readwrite')) throw new Error(`Write access was not granted for ${handle.name}.`);
        // Reopening the same file selects its existing tab instead of making a second writer.
        let path: string | undefined;
        for (const [key, existing] of entries) if (await existing.handle.isSameEntry(handle)) { path = key; break; }
        path ??= `linked/${crypto.randomUUID()}/${handle.name}`;
        const file = await handle.getFile();
        entries.set(path, { handle, body: await file.text(), updated: new Date(file.lastModified) });
        selected ??= fileId(path);
      }
      linkedRef.current = entries; setLinked(entries);
      return selected;
    }),
    /** Refuse creation when a file with this name already exists. */
    async create(path: string, name: string, body = '') {
      if (!markdown(name) || badName(name)) throw new Error('Use a filename ending in .md or .mdx, without slashes.');
      const directory = await directoryAt(path);
      if (!directory) throw new Error('The folder is not available.');
      if (await taken(directory, name)) throw new Error(`“${name}” already exists. Choose another name.`);
      await fs.createFile(`${path}/${name}`, body);
      return fileId(`${path}/${name}`);
    },
    async createFolder(path: string, name: string) {
      if (badName(name)) throw new Error('Use a folder name without slashes.');
      const directory = directoryHandles.current.get(path);
      if (!directory) throw new Error('The folder is not available.');
      if (!await ensurePermission(directory, 'readwrite')) throw new Error('Write access was not granted.');
      await directory.getDirectoryHandle(name, { create: true });
      await fs.refresh();
      return folderId(`${path}/${name}`);
    },
    async write(n: Note, body: string, expected: string) {
      const info = n.file;
      if (!info) throw new Error('This note is not a file.');
      const handle = info.standalone ? linkedRef.current.get(info.path)?.handle : fs.handles.get(info.path);
      if (!handle) throw new FileConflict(null);
      let disk: string;
      try { disk = await (await handle.getFile()).text(); }
      catch (e) { if (e instanceof DOMException && e.name === 'NotFoundError') throw new FileConflict(null); throw e; }
      if (disk !== expected) throw new FileConflict(disk);
      ownWrites.current.set(info.path, body);
      try {
      if (info.standalone) {
        if (!await ensurePermission(handle, 'readwrite')) throw new Error('Write access was not granted. Reopen the file to reconnect.');
        const stream = await handle.createWritable();
        try { await stream.write(body); await stream.close(); }
        catch (e) { await stream.abort().catch(() => {}); throw e; }
        const entry = { handle, body, updated: new Date() };
        linkedRef.current = new Map(linkedRef.current).set(info.path, entry);
        setLinked((prev) => new Map(prev).set(info.path, entry));
      } else await fs.writeFile(info.path, body, { create: false });
      } catch (error) { ownWrites.current.delete(info.path); throw error; }
    },
    /** Renames a file in a watched folder. Returns the note's new id. */
    async renameFile(path: string, name: string) {
      const parent = parentPath(path);
      const old = path.slice(parent.length + 1);
      if (name === old) return fileId(path);
      if (!markdown(name) || badName(name)) throw new Error('Use a filename ending in .md or .mdx, without slashes.');
      const directory = await directoryAt(parent);
      const handle = fs.handles.get(path) as Movable | undefined;
      if (!directory || !handle) throw new Error('The file is not available.');
      // A case-only rename finds the file itself on a case-insensitive disk.
      if (name.toLowerCase() !== old.toLowerCase() && await taken(directory, name)) throw new Error(`“${name}” already exists. Choose another name.`);
      if (!await ensurePermission(directory, 'readwrite')) throw new Error('Write access was not granted.');
      if (handle.move) await handle.move(name);
      else {
        if (name.toLowerCase() === old.toLowerCase()) throw new Error('This browser cannot change only the capitalization of a filename.');
        await fs.createFile(`${parent}/${name}`, fs.files.get(path) ?? '');
        await fs.deleteFile(path);
      }
      await fs.refresh();
      return fileId(`${parent}/${name}`);
    },
    /** Renames a folder inside a watched folder. Returns the folder's new id. */
    async renameFolder(path: string, name: string) {
      const parent = parentPath(path);
      const old = path.slice(parent.length + 1);
      if (name === old) return folderId(path);
      if (badName(name)) throw new Error('Use a folder name without slashes.');
      const directory = parent ? await directoryAt(parent) : null;
      const handle = directoryHandles.current.get(path) as (FileSystemDirectoryHandle & Movable) | undefined;
      if (!directory || !handle) throw new Error('Only folders inside an added folder can be renamed.');
      if (name.toLowerCase() !== old.toLowerCase() && await taken(directory, name)) throw new Error(`“${name}” already exists. Choose another name.`);
      if (!await ensurePermission(directory, 'readwrite')) throw new Error('Write access was not granted.');
      let moved = false;
      if (handle.move) {
        try { await handle.move(name); moved = true; }
        catch (e) { if (!(e instanceof DOMException && (e.name === 'NotSupportedError' || e.name === 'InvalidModificationError'))) throw e; }
      }
      if (!moved) {
        if (name.toLowerCase() === old.toLowerCase()) throw new Error('This browser cannot change only the capitalization of a folder name.');
        await copyInto(handle, await directory.getDirectoryHandle(name, { create: true }));
        await directory.removeEntry(old, { recursive: true });
      }
      await fs.refresh();
      return folderId(`${parent}/${name}`);
    },
    /** Copies a file next to itself as “name copy.md”, “name copy 2.md”, … */
    async duplicate(path: string) {
      const parent = parentPath(path);
      const directory = await directoryAt(parent);
      if (!directory) throw new Error('The folder is not available.');
      const [, stem, extension] = /^(.*?)(\.mdx?)$/i.exec(path.slice(parent.length + 1)) ?? [];
      let name = `${stem} copy${extension}`;
      for (let index = 2; await taken(directory, name); index++) name = `${stem} copy ${index}${extension}`;
      await fs.createFile(`${parent}/${name}`, fs.files.get(path) ?? '');
      return fileId(`${parent}/${name}`);
    },
    deleteFile: (path: string) => fs.deleteFile(path),
    deleteFolder: (path: string) => fs.deleteDirectory(path),
    close(n: Note) {
      if (!n.file?.standalone) return;
      const next = new Map(linkedRef.current); next.delete(n.file.path); linkedRef.current = next; setLinked(next);
    },
    run,
  };
}
