import type { DemoFile, DemoMeta } from '@brett_lamy/docstream/demo';

export interface DemoDirectory { path: string; handle: FileSystemDirectoryHandle }
const extensions = ['.tsx', '.ts', '.jsx', '.js', '.mjs', '.json', '.css', '.svg'];
const sourceFile = /\.(?:[cm]?[jt]sx?|css|json|html|svg|md)$/i;
const skip = new Set(['node_modules', '.git', '.nx', 'dist', 'build', 'coverage', 'target']);
const dirname = (path: string) => path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
function normalize(path: string): string {
  const parts: string[] = [];
  for (const part of path.replaceAll('\\', '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') { if (!parts.length) throw new Error('Example path leaves the added folder.'); parts.pop(); }
    else parts.push(part);
  }
  return parts.join('/');
}
const join = (...paths: string[]) => normalize(paths.join('/'));
function relative(from: string, to: string) {
  const a = dirname(from).split('/').filter(Boolean); const b = to.split('/');
  while (a.length && a[0] === b[0]) { a.shift(); b.shift(); }
  return `${a.map(() => '../').join('') || './'}${b.join('/')}`;
}
async function directory(root: FileSystemDirectoryHandle, path: string) {
  let current = root;
  for (const part of normalize(path).split('/').filter(Boolean)) current = await current.getDirectoryHandle(part);
  return current;
}

/** Lazy, read-only local source loading. Only referenced demo folders and their imports are read. */
export function createLocalDemoReader(roots: DemoDirectory[], documentPath: string) {
  const cache = new Map<string, { stamp: string; text: string }>();
  return async (src: string, includeImports = true): Promise<{ files: DemoFile[]; meta: DemoMeta } | undefined> => {
    if (!src || src.startsWith('/') || src.split('/').includes('..')) return undefined;
    const ordered = [...roots].sort((a, b) => Number(documentPath.startsWith(`${b.path}/`)) - Number(documentPath.startsWith(`${a.path}/`)));
    for (const mount of ordered) {
      const read = async (path: string): Promise<string | undefined> => {
        try {
          const normalized = normalize(path);
          const name = normalized.split('/').pop(); if (!name) return undefined;
          const file = await (await (await directory(mount.handle, dirname(normalized))).getFileHandle(name)).getFile();
          const key = `${mount.path}/${normalized}`; const stamp = `${file.lastModified}:${file.size}`;
          const hit = cache.get(key); if (hit?.stamp === stamp) return hit.text;
          const text = await file.text(); cache.set(key, { stamp, text }); return text;
        } catch (error) { if (error instanceof DOMException && (error.name === 'NotFoundError' || error.name === 'TypeMismatchError')) return undefined; throw error; }
      };
      const json = async (path: string): Promise<Record<string, unknown>> => {
        const text = await read(path); if (!text) return {};
        try { return JSON.parse(text) as Record<string, unknown>; } catch { return {}; }
      };
      const notePath = documentPath.startsWith(`${mount.path}/`) ? documentPath.slice(mount.path.length + 1) : '';
      const ancestors: string[] = []; let ancestor = dirname(notePath);
      while (ancestor) { ancestors.push(ancestor); ancestor = dirname(ancestor); }
      ancestors.push('');
      const candidates = new Set([...ancestors.flatMap((path) => [join(path, 'examples', src), join(path, src)]),
        join('examples', src), join('docs/examples', src), join('apps/docs/examples', src), join('demo/examples', src), join('registry', src)]);
      for (const folder of candidates) {
        let handle: FileSystemDirectoryHandle;
        try { handle = await directory(mount.handle, folder); } catch { continue; }
        const meta = await json(join(folder, 'meta.json')) as DemoMeta;
        let entry = meta.entry;
        if (!entry) for (const name of ['index.tsx', 'index.jsx', 'index.ts', 'index.js', 'page.tsx', 'App.tsx']) {
          if (await read(join(folder, name)) !== undefined) { entry = name; break; }
        }
        if (!entry) continue;
        const aliases: Array<[string, string]> = [];
        for (const name of ['tsconfig.base.json', 'tsconfig.json', 'jsconfig.json']) {
          const config = await json(name); const options = config.compilerOptions as { baseUrl?: string; paths?: Record<string, string[]> } | undefined;
          for (const [pattern, paths] of Object.entries(options?.paths ?? {})) for (const target of paths) aliases.push([pattern, join(options?.baseUrl ?? '', target)]);
        }
        if (!aliases.length) aliases.push(['@/*', 'src/*']);
        const files = new Map<string, { virtual: string; content: string }>();
        const packages = new Map<string, string>();
        const imports = new Set<string>();
        const manifests = new Set<string>();
        const manifest = async (path: string) => {
          if (manifests.has(path)) return; manifests.add(path);
          const config = await json(join(path, 'package.json'));
          for (const group of ['devDependencies', 'peerDependencies', 'dependencies']) for (const [name, version] of Object.entries(config[group] as Record<string, string> ?? {})) {
            if (typeof version === 'string' && !/^(workspace:|file:|link:)/.test(version)) packages.set(name, version);
          }
        };
        const resolve = async (path: string) => {
          for (const candidate of [path, ...extensions.map((ext) => path + ext), ...extensions.map((ext) => join(path, `index${ext}`))]) if (await read(candidate) !== undefined) return candidate;
          return undefined;
        };
        const visit = async (path: string): Promise<string> => {
          const hit = files.get(path); if (hit) return hit.virtual;
          const virtual = path.startsWith(`${folder}/`) ? path.slice(folder.length + 1) : `__project/${path}`;
          const file = { virtual, content: await read(path) ?? '' }; files.set(path, file);
          if (includeImports) { let parent = dirname(path); while (parent) { await manifest(parent); parent = dirname(parent); } await manifest(''); }
          if (includeImports && /\.(?:[cm]?[jt]sx?|css)$/i.test(path)) {
            const matches = [...file.content.matchAll(/(\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*)(["'])([^"']+)\2/g)];
            for (const match of matches.reverse()) {
              const specifier = match[3]; const choices: string[] = [];
              if (specifier.startsWith('.')) choices.push(join(dirname(path), specifier));
              else for (const [pattern, target] of aliases) {
                const star = pattern.indexOf('*');
                if (star >= 0 && specifier.startsWith(pattern.slice(0, star)) && specifier.endsWith(pattern.slice(star + 1))) choices.push(target.replace('*', specifier.slice(star, pattern.length - star > 1 ? -(pattern.length - star - 1) : undefined)));
                else if (specifier === pattern) choices.push(target);
              }
              let replacement: string | undefined;
              for (const choice of choices) { const target = await resolve(choice); if (target) { replacement = relative(virtual, await visit(target)); break; } }
              if (replacement) {
                const index = match.index ?? 0; const start = index + match[1].length;
                file.content = file.content.slice(0, start) + JSON.stringify(replacement) + file.content.slice(index + match[0].length);
              } else if (!specifier.startsWith('.') && !specifier.startsWith('/') && !specifier.includes(':')) imports.add(specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0]);
            }
          }
          return virtual;
        };
        const walk = async (dir: FileSystemDirectoryHandle, path: string) => {
          for await (const child of dir.values()) {
            if (child.name.startsWith('.') || skip.has(child.name)) continue;
            if (child.kind === 'directory') await walk(child as FileSystemDirectoryHandle, join(path, child.name));
            else if (sourceFile.test(child.name) && child.name !== 'meta.json') await visit(join(path, child.name));
          }
        };
        await walk(handle, folder);
        const result = [...files.values()].filter((file) => file.virtual !== 'package.json').map(({ virtual: path, content }) => ({ path, content }));
        const dependencies = Object.fromEntries([...imports].flatMap((name) => { const version = packages.get(name); return version ? [[name, version]] : []; }));
        if (Object.keys(dependencies).length) result.push({ path: 'package.json', content: JSON.stringify({ dependencies }) });
        result.sort((a, b) => Number(b.path === entry) - Number(a.path === entry) || a.path.localeCompare(b.path));
        return { files: result, meta: { ...meta, entry } };
      }
    }
    return undefined;
  };
}
