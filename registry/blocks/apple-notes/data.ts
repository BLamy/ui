/** Only real files and folders belong to Notes. There is no seeded demo content. */
import { parseMarkdown, plainText } from '@brett_lamy/docstream/gitbook';
export interface Note {
  id: string;
  folder: string;
  body: string;
  updated: Date;
  file: { path: string; name: string; source: 'browser' | 'local'; standalone?: boolean };
}

export interface Folder {
  id: string;
  title: string;
  parent?: string;
  path?: string;
  source?: 'browser' | 'local';
  connected?: boolean;
}

export const ROOT_FOLDER: Folder = { id: 'folders', title: 'Folders' };
export const title = (note: Note) => note.file.name;

export function shortDate(date: Date) {
  const today = new Date();
  return date.toDateString() === today.toDateString()
    ? date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function snippet(note: Note) {
  const block = parseMarkdown(note.body).children.find((item) => item.type === 'paragraph' || item.type === 'heading');
  return block && (block.type === 'paragraph' || block.type === 'heading') ? plainText(block.children) : 'Empty note';
}
