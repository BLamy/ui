import type { ReactNode } from 'react';
import { Button, type ButtonProps } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroupLabel, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Segmented, SegmentedItem } from '@/components/ui/segmented';
import { Icon } from '@/lib/icon';
import { cn, cx } from '@/lib/utils';
import type { Note } from './data';
import { ItemMenuItems, renameFieldOf } from './item-menu';
import type { FileFilter, NotesState, NotesView } from './use-notes';

export function UnreadDot() {
  return <span role="img" aria-label="Changed outside Notes" title="Changed outside Notes" className="size-1.5 shrink-0 rounded-full bg-primary" />;
}

/** A toolbar icon button. It also renders menu triggers: `<DropdownMenuTrigger render={<BarButton label="Share" />}>`. */
export function BarButton({ label, children, className, ...props }: Omit<ButtonProps, 'aria-label'> & { label: string }) {
  return <Button variant="ghost" aria-label={label} {...props}
    className={cx('h-9 w-10 rounded-ctl px-0 text-primary hover:bg-secondary', className)}>{children ?? label}</Button>;
}

export function ViewToggle({ view, onChange }: { view: NotesView; onChange: (v: NotesView) => void }) {
  return <Segmented<NotesView> aria-label="View as" value={view} onValueChange={(v) => { if (v) onChange(v); }} className="w-[92px]">
    <SegmentedItem value="list" aria-label="List" className="text-foreground"><Icon name="list" size={17} weight="medium" /></SegmentedItem>
    <SegmentedItem value="tree" aria-label="Tree view" className="text-foreground">
      <svg aria-hidden="true" width="17" height="17" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M4 3v11h4M4 7h4M11 4h5v5h-5zM11 12h5v5h-5z" /></svg>
    </SegmentedItem>
  </Segmented>;
}

/** Beside the search field: All Files, then one file type at a time (Markdown, the default, models, images, data,
    spreadsheets and code). The
    icon fills while the list isn't Markdown only. */
export function FilterMenu({ filter, onChange }: { filter: FileFilter; onChange: (f: FileFilter) => void }) {
  return <DropdownMenu>
    <DropdownMenuTrigger render={<BarButton label="Filter files" className="h-[34px] w-9 shrink-0" />}>
      <Icon name={filter === 'markdown' ? 'filter-circle' : 'filter-circle-fill'} size={24} />
    </DropdownMenuTrigger>
    <DropdownMenuContent side="bottom" align="end">
      <DropdownMenuRadioGroup value={filter} onValueChange={(value) => onChange(value as FileFilter)}>
        <DropdownMenuGroupLabel className="sr-only">Show</DropdownMenuGroupLabel>
        <DropdownMenuRadioItem closeOnSelect value="all" icon={<Icon name="folder" size={20} />}>All Files</DropdownMenuRadioItem>
        <DropdownMenuSeparator />
        <DropdownMenuRadioItem closeOnSelect value="markdown" icon={<Icon name="note" size={20} />}>Markdown</DropdownMenuRadioItem>
        <DropdownMenuRadioItem closeOnSelect value="stl" icon={<Icon name="cube" size={20} />}>3D Models (STL)</DropdownMenuRadioItem>
        <DropdownMenuRadioItem closeOnSelect value="image" icon={<Icon name="photo" size={20} />}>Images</DropdownMenuRadioItem>
        <DropdownMenuRadioItem closeOnSelect value="data" icon={<Icon name="list" size={20} />}>JSON &amp; YAML</DropdownMenuRadioItem>
        <DropdownMenuRadioItem closeOnSelect value="sheet" icon={<Icon name="table" size={20} />}>Spreadsheets (CSV)</DropdownMenuRadioItem>
        <DropdownMenuRadioItem closeOnSelect value="code" icon={<Icon name="doc" size={20} />}>Code &amp; Text</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>;
}

/** Share the note's file: copy it or save a copy. */
export function ShareMenu({ n }: { n: Note }) {
  return <DropdownMenu onAction={(value) => {
    if (value === 'copy') void navigator.clipboard?.writeText(n.body);
    if (value === 'path') void navigator.clipboard?.writeText(n.file.path);
    if (value === 'download') {
      const url = URL.createObjectURL(new Blob([n.body], { type: 'text/markdown' }));
      const a = Object.assign(document.createElement('a'), { href: url, download: n.file.name });
      a.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
    }
  }}>
    <DropdownMenuTrigger render={<BarButton label="Share" />}><Icon name="share" /></DropdownMenuTrigger>
    <DropdownMenuContent side="bottom" align="end">
      <DropdownMenuItem value="copy" icon={<Icon name="copy" size={20} />}>Copy Markdown</DropdownMenuItem>
      <DropdownMenuItem value="path" icon={<Icon name="link" size={20} />}>Copy Path</DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem value="download" icon={<Icon name="download" size={20} />}>Download a Copy</DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>;
}

/** The note's … menu: the same actions as right-clicking it in the list. */
export function NoteMenu({ notes, n }: { notes: NotesState; n: Note }) {
  return <DropdownMenu>
    <DropdownMenuTrigger render={<BarButton label="More" />}><Icon name="ellipsis-circle" /></DropdownMenuTrigger>
    <DropdownMenuContent side="bottom" align="end" finalFocus={() => renameFieldOf(n.id)}>
      <ItemMenuItems notes={notes} id={n.id} place="title" />
    </DropdownMenuContent>
  </DropdownMenu>;
}

export function BottomBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('absolute inset-x-0 bottom-0 z-30 flex h-[50px] items-center gap-1 bg-bar px-2 shadow-hairline-t backdrop-blur-[20px] backdrop-saturate-[1.8]', className)}>{children}</div>;
}
