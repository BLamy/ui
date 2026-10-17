/* A note's project is the location it lives in. Its embeds load from there (./case/part.stl → a blob: URL of that
   file), "Choose file…" lists every file in it, and files dropped on the note are copied next to it and embedded. */
import { useCallback, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Credenza } from '@/components/ui/credenza';
import { ListBox, ListBoxItem } from '@/components/ui/list-box';
import { SearchField } from '@/components/ui/search-field';
import { useSplitView } from '@/components/ui/split-view';
import { TreeFileIcon } from '@/components/ui/tree';
import type { Note } from './data';
import { draggedPaths, hasComputerFiles, hasNotesFiles } from './drag';
import type { NotesState } from './use-notes';

const IMAGE = /\.(?:png|jpe?g|gif|webp|avif|svg|bmp|ico)$/i;
const parent = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf('/')));

/** `to` as a link from inside `fromDir`: "./case/part.stl", "../shared/logo.png". Encoded for Markdown. */
export function relativePath(fromDir: string, to: string) {
  const from = fromDir.split('/');
  const target = to.split('/');
  let same = 0;
  while (same < from.length && same < target.length - 1 && from[same] === target[same]) same++;
  const rest = target.slice(same).join('/');
  const link = from.length > same ? `${'../'.repeat(from.length - same)}${rest}` : `./${rest}`;
  return encodeURI(link).replace(/\(/g, '%28').replace(/\)/g, '%29');
}

/** The project path a link in a note at `dir` points to, or null for a web URL or a path outside the project. */
export function resolvePath(dir: string, root: string, url: string) {
  if (!url || /^[a-z][a-z0-9+.-]*:|^\/\/|^#/i.test(url)) return null;
  let path = url.split(/[?#]/)[0]!;
  try { path = decodeURI(path); } catch { /* not encoded */ }
  const parts = (path.startsWith('/') ? root : dir).split('/');
  for (const part of path.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') { if (parts.length <= root.split('/').length) return null; parts.pop(); }
    else parts.push(part);
  }
  return parts.join('/');
}

type Pick = { kind: 'embed' | 'image'; resolve: (url: string | null) => void };

/** The editor's project hooks for a note: asset URLs, the file chooser, and drops. Null hooks for a linked file. */
export function useProjectFiles(notes: NotesState, n: Note) {
  const filesRef = useRef(notes.files); filesRef.current = notes.files;
  const dir = parent(n.file.path);
  const root = n.file.standalone ? null : notes.files.rootOf(n.file.path);
  const [picking, setPicking] = useState<Pick | null>(null);

  const resolveAsset = useCallback((url: string) => {
    const path = root ? resolvePath(dir, root, url) : null;
    return path ? filesRef.current.fileUrl(path).catch(() => null) : null;
  }, [dir, root]);

  const pickFile = useCallback(({ kind }: { kind: 'embed' | 'image' }) =>
    new Promise<string | null>((resolve) => setPicking({ kind, resolve })), []);

  const onDropEmbeds = useCallback((data: DataTransfer) => {
    if (!root) return null;
    // A row from the file list or tree: link to that file where it is.
    if (hasNotesFiles(data)) return draggedPaths(data).filter((path) => path !== n.file.path).map((path) => relativePath(dir, path));
    // Files from your computer: copied next to the note first. `files` is readable only during the drop.
    if (hasComputerFiles(data)) {
      const list = [...data.files];
      return (async () => {
        const urls: string[] = [];
        for (const file of list) urls.push(relativePath(dir, await filesRef.current.writeFile(dir, file.name, file)));
        return urls;
      })();
    }
    return null;
  }, [dir, root, n.file.path]);

  const picker = root ? <FilePicker notes={notes} root={root} dir={dir} self={n.file.path} picking={picking}
    onDone={(url) => { picking?.resolve(url); setPicking(null); }} /> : null;
  return root ? { resolveAsset, pickFile, onDropEmbeds, picker } : { picker: null };
}

/** Every file in the project, filtered by a search; Choose writes a link relative to the note. */
function FilePicker({ notes, root, dir, self, picking, onDone }: {
  notes: NotesState; root: string; dir: string; self: string; picking: Pick | null; onDone: (url: string | null) => void;
}) {
  const s = useSplitView();
  const [query, setQuery] = useState('');
  const [chosen, setChosen] = useState<string | null>(null);
  const images = picking?.kind === 'image';
  const all = useMemo(() => [...notes.notes.map((n) => n.file.path), ...notes.others.map((o) => o.path)]
    .filter((path) => path.startsWith(`${root}/`) && path !== self && (!images || IMAGE.test(path)))
    .sort((a, b) => a.localeCompare(b)), [notes.notes, notes.others, root, self, images]);
  const q = query.trim().toLowerCase();
  const items = all.filter((path) => !q || path.toLowerCase().includes(q)).slice(0, 300).map((path) => ({ id: path, path }));
  const choose = (path: string | null) => { setQuery(''); setChosen(null); onDone(path ? relativePath(dir, path) : null); };
  return <Credenza compact={s.collapsed} open={!!picking} onClose={() => choose(null)} title={images ? 'Choose an Image' : 'Choose a File'}>
    <div className="flex flex-col gap-3 px-4 pt-0.5 pb-4">
      <SearchField aria-label="Search files" value={query} onChange={setQuery} autoFocus />
      <div className="max-h-[50vh] min-h-40 overflow-auto rounded-lg border border-border">
        {items.length ? <ListBox aria-label="Files" items={items} selectionMode="single"
          selectedKeys={chosen ? [chosen] : []}
          onSelectionChange={(keys) => setChosen((String([...keys][0] ?? '') || null))}
          onAction={(key) => choose(String(key))}>
          {(item) => <ListBoxItem id={item.id} textValue={item.path} icon={<TreeFileIcon name={item.path} />}
            description={parent(item.path.slice(root.length + 1)) || undefined}>
            {item.path.slice(item.path.lastIndexOf('/') + 1)}
          </ListBoxItem>}
        </ListBox> : <p className="m-0 px-4 py-10 text-center text-detail text-muted-foreground">{q ? 'No files match.' : images ? 'No images in this folder.' : 'No other files in this folder.'}</p>}
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" className="flex-1" onPress={() => choose(null)}>Cancel</Button>
        <Button className="flex-1" isDisabled={!chosen} onPress={() => choose(chosen)}>Choose</Button>
      </div>
    </div>
  </Credenza>;
}
