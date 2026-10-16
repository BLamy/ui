import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Segmented } from '@/components/ui/segmented';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import type { Note } from './data';
import type { NotesState, NotesView } from './use-notes';

export function UnreadDot() {
  return <span role="img" aria-label="Changed outside Notes" title="Changed outside Notes" className="size-1.5 shrink-0 rounded-full bg-[#007aff] dark:bg-[#0a84ff]" />;
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

export function NoteMenu({ notes, n }: { notes: NotesState; n: Note }) {
  return <DropdownMenu>
    <BarButton label="Note actions"><Icon name="ellipsis-circle" /></BarButton>
    <DropdownMenuContent aria-label="File actions" placement="bottom end" onAction={(key) => {
      if (key === 'revert') notes.revert(n.id);
      if (key === 'close') { notes.files.close(n); notes.select(null); }
    }}>
      <DropdownMenuItem id="revert" isDisabled={!notes.drafts[n.id] || !!notes.drafts[n.id]?.saving}>Discard my edits</DropdownMenuItem>
      {n.file.standalone ? <DropdownMenuItem id="close" isDisabled={!!notes.drafts[n.id]}>Close file</DropdownMenuItem> : null}
    </DropdownMenuContent>
  </DropdownMenu>;
}

export function BottomBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('absolute inset-x-0 bottom-0 z-30 flex h-[50px] items-center gap-1 bg-bar px-2 shadow-hairline-t backdrop-blur-[20px] backdrop-saturate-[1.8]', className)}>{children}</div>;
}
