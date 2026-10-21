import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { Segmented } from '@/components/ui/segmented';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import type { Note } from './data';
import { itemMenuItems, useItemMenuAction } from './item-menu';
import type { FileFilter, NotesState, NotesView } from './use-notes';

export function UnreadDot() {
  return <span role="img" aria-label="Changed outside Notes" title="Changed outside Notes" className="size-1.5 shrink-0 rounded-full bg-primary" />;
}

export function BarButton({ label, children, onPress, isDisabled, className }: {
  label: string; children?: ReactNode; onPress?: () => void; isDisabled?: boolean; className?: string;
}) {
  return <Button variant="ghost" aria-label={label} onPress={onPress} isDisabled={isDisabled}
    className={cn('h-9 w-10 rounded-ctl px-0 text-primary data-hovered:bg-secondary', className)}>{children ?? label}</Button>;
}

export function ViewToggle({ view, onChange }: { view: NotesView; onChange: (v: NotesView) => void }) {
  return <Segmented aria-label="View as" value={view} onChange={(v) => onChange(v as NotesView)} className="w-[92px]"
    options={[
      { id: 'list', label: <span aria-label="List" className="text-foreground"><Icon name="list" size={17} weight="medium" /></span> },
      { id: 'tree', label: <span aria-label="Tree view" className="text-foreground"><svg aria-hidden="true" width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 3v11h4M4 7h4M11 4h5v5h-5zM11 12h5v5h-5z" /></svg></span> },
    ]} />;
}

/** Beside the search field: All Files, then one file type at a time (Markdown, the default, models, images, data,
    spreadsheets and code). The
    icon fills while the list isn't Markdown only. */
export function FilterMenu({ filter, onChange }: { filter: FileFilter; onChange: (f: FileFilter) => void }) {
  return <DropdownMenu>
    <BarButton label="Filter files" className="h-[34px] w-9 shrink-0">
      <Icon name={filter === 'markdown' ? 'filter-circle' : 'filter-circle-fill'} size={24} />
    </BarButton>
    <DropdownMenuContent aria-label="Show" placement="bottom end" selectionMode="single" selectedKeys={[filter]}
      onSelectionChange={(keys) => { const key = [...keys][0]; if (key) onChange(key as FileFilter); }}>
      <DropdownMenuItem id="all" icon={<Icon name="folder" size={20} />}>All Files</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem id="markdown" icon={<Icon name="note" size={20} />}>Markdown</DropdownMenuItem>
      <DropdownMenuItem id="stl" icon={<Icon name="cube" size={20} />}>3D Models (STL)</DropdownMenuItem>
      <DropdownMenuItem id="image" icon={<Icon name="photo" size={20} />}>Images</DropdownMenuItem>
      <DropdownMenuItem id="data" icon={<Icon name="list" size={20} />}>JSON &amp; YAML</DropdownMenuItem>
      <DropdownMenuItem id="sheet" icon={<Icon name="table" size={20} />}>Spreadsheets (CSV)</DropdownMenuItem>
      <DropdownMenuItem id="code" icon={<Icon name="doc" size={20} />}>Code &amp; Text</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}

/** Share the note's file: copy it or save a copy. */
export function ShareMenu({ n }: { n: Note }) {
  return <DropdownMenu>
    <BarButton label="Share"><Icon name="share" /></BarButton>
    <DropdownMenuContent aria-label="Share" placement="bottom end" onAction={(key) => {
      if (key === 'copy') void navigator.clipboard?.writeText(n.body);
      if (key === 'path') void navigator.clipboard?.writeText(n.file.path);
      if (key === 'download') {
        const url = URL.createObjectURL(new Blob([n.body], { type: 'text/markdown' }));
        const a = Object.assign(document.createElement('a'), { href: url, download: n.file.name });
        a.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
      }
    }}>
      <DropdownMenuItem id="copy" icon={<Icon name="copy" size={20} />}>Copy Markdown</DropdownMenuItem>
      <DropdownMenuItem id="path" icon={<Icon name="link" size={20} />}>Copy Path</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem id="download" icon={<Icon name="download" size={20} />}>Download a Copy</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}

/** The note's … menu: the same actions as right-clicking it in the list. */
export function NoteMenu({ notes, n }: { notes: NotesState; n: Note }) {
  const act = useItemMenuAction(notes, n.id, 'title');
  return <DropdownMenu>
    <BarButton label="More"><Icon name="ellipsis-circle" /></BarButton>
    <DropdownMenuContent aria-label="Note actions" placement="bottom end" onAction={act}>{itemMenuItems(notes, n.id)}</DropdownMenuContent>
  </DropdownMenu>;
}

export function BottomBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('absolute inset-x-0 bottom-0 z-30 flex h-[50px] items-center gap-1 bg-bar px-2 shadow-hairline-t backdrop-blur-[20px] backdrop-saturate-[1.8]', className)}>{children}</div>;
}
