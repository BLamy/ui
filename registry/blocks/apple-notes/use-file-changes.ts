import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import type { Note } from './data';

const STORAGE = 'apple-notes-file-observations';
interface Observations { versions: Record<string, string>; unseen: string[] }
const fingerprint = (body: string) => {
  let hash = 2166136261;
  for (let index = 0; index < body.length; index++) hash = Math.imul(hash ^ body.charCodeAt(index), 16777619);
  return `${body.length}:${hash >>> 0}`;
};
function load(): Observations {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE) ?? 'null') as Observations | null;
    if (saved?.versions && Array.isArray(saved.unseen)) return saved;
  } catch { /* The watcher still works when browser storage is unavailable. */ }
  return { versions: {}, unseen: [] };
}

/** Changes from the filesystem watcher, with our own writes excluded and unread state retained across reloads. */
export function useFileChanges(notes: Note[], ownWrites: RefObject<Map<string, string>>) {
  const [initial] = useState(load);
  const versions = useRef(initial.versions);
  const unseenRef = useRef(new Set(initial.unseen));
  const [unseen, setUnseen] = useState(unseenRef.current);
  const persist = useCallback(() => {
    try { localStorage.setItem(STORAGE, JSON.stringify({ versions: versions.current, unseen: [...unseenRef.current] })); } catch { /* Optional persistence. */ }
  }, []);
  useEffect(() => {
    let changed = false;
    let unreadChanged = false;
    for (const note of notes) {
      const version = fingerprint(note.body);
      const previous = versions.current[note.id];
      const own = ownWrites.current.get(note.file.path) === note.body;
      if (own) ownWrites.current.delete(note.file.path);
      if (previous === version) continue;
      versions.current[note.id] = version; changed = true;
      if (previous && !own && !unseenRef.current.has(note.id)) { unseenRef.current.add(note.id); unreadChanged = true; }
    }
    if (unreadChanged) setUnseen(new Set(unseenRef.current));
    if (changed) persist();
  }, [notes, ownWrites, persist]);
  const markSeen = useCallback((id: string) => {
    if (!unseenRef.current.delete(id)) return;
    setUnseen(new Set(unseenRef.current)); persist();
  }, [persist]);
  return { unseen, markSeen };
}
