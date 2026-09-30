/* Toolbar pieces shared by the columns at every width: tinted bar buttons, the list/gallery toggle,
   and the Share and note (…) pull-down menus. */
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSection, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { IconSwap } from '@/components/ui/icon-swap';
import { Segmented } from '@/components/ui/segmented';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { MOVE_TARGETS, type Note } from './data';
import type { NotesState, NotesView } from './use-notes';

/** A tinted, borderless toolbar button: a glyph, or a text label like "Done". */
export function BarButton({ label, children, onPress, isDisabled, className }: {
  label: string; children?: ReactNode; onPress?: () => void; isDisabled?: boolean; className?: string;
}) {
  const text = children == null;
  return (
    <Button variant="ghost" aria-label={label} onPress={onPress} isDisabled={isDisabled}
      className={cn('h-9 rounded-[10px] text-primary data-hovered:bg-secondary', text ? 'px-2.5 text-[17px] font-normal' : 'w-10 px-0', className)}>
      {children ?? label}
    </Button>
  );
}

export function ViewToggle({ view, onChange }: { view: NotesView; onChange: (v: NotesView) => void }) {
  return (
    <Segmented aria-label="View as" value={view} onChange={(v) => onChange(v as NotesView)} className="w-[92px]"
      options={[
        { id: 'list', label: <span aria-label="List" className="text-foreground"><Icon name="list" size={17} weight="medium" /></span> },
        { id: 'gallery', label: <span aria-label="Gallery" className="text-foreground"><Icon name="grid" size={16} weight="medium" /></span> },
      ]} />
  );
}

export function ShareMenu({ n }: { n: Note }) {
  return (
    <DropdownMenu>
      <BarButton label="Share" isDisabled={!n}><Icon name="share" /></BarButton>
      <DropdownMenuContent aria-label="Share" placement="bottom end">
        <DropdownMenuItem id="collaborate" icon={<Icon name="people" size={20} />} description="Invite people to edit">Collaborate</DropdownMenuItem>
        <DropdownMenuItem id="copy" icon={<Icon name="link" size={20} />}>Copy Link</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem id="mail" icon={<Icon name="envelope" size={20} />}>Send via Mail</DropdownMenuItem>
        <DropdownMenuItem id="duplicate" icon={<Icon name="copy" size={20} />}>Send a Copy</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function NoteMenu({ notes, n, onDeleted }: { notes: NotesState; n: Note; onDeleted?: () => void }) {
  const locked = !!n.locked;
  return (
    <DropdownMenu>
      <BarButton label="More"><Icon name="ellipsis-circle" /></BarButton>
      <DropdownMenuContent aria-label="Note actions" placement="bottom end"
        onAction={(key) => {
          const k = String(key);
          if (k === 'pin') notes.togglePin(n.id);
          else if (k === 'lock') notes.toggleLock(n.id);
          else if (k === 'delete') { notes.remove(n.id); onDeleted?.(); }
          else if (k.startsWith('move:')) notes.moveTo(n.id, k.slice(5));
        }}>
        <DropdownMenuItem id="pin" icon={<Icon name={n.pinned ? 'pushpin-slash' : 'pushpin'} size={20} />}>{n.pinned ? 'Unpin Note' : 'Pin Note'}</DropdownMenuItem>
        <DropdownMenuItem id="lock" icon={<Icon name={locked ? 'lock-open' : 'lock'} size={20} />}>{locked ? 'Remove Lock' : 'Lock Note'}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSection title="Move to">
          {MOVE_TARGETS.filter((f) => f.id !== n.folder).slice(0, 5).map((f) => (
            <DropdownMenuItem key={f.id} id={`move:${f.id}`} icon={<Icon name="folder" size={20} />}>{f.title}</DropdownMenuItem>
          ))}
        </DropdownMenuSection>
        <DropdownMenuSeparator />
        <DropdownMenuItem id="delete" variant="destructive" icon={<Icon name="trash" size={20} />}>Delete</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function LockButton({ notes, n }: { notes: NotesState; n: Note }) {
  const open = !!n.locked && !notes.isLocked(n);
  return (
    <BarButton label={n.locked ? (open ? 'Lock now' : 'Locked') : 'Lock note'} onPress={() => (!n.locked ? notes.toggleLock(n.id) : open ? notes.relock(n.id) : notes.unlock(n.id))}>
      <IconSwap id={n.locked ? (open ? 'open' : 'locked') : 'none'}><Icon name={n.locked ? (open ? 'lock-open' : 'lock-fill') : 'lock'} /></IconSwap>
    </BarButton>
  );
}

/** Translucent bar pinned to the bottom of a column or screen. */
export function BottomBar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn(
      'absolute inset-x-0 bottom-0 z-30 flex h-[50px] items-center gap-1 bg-bar px-2 shadow-[inset_0_1px_0_var(--border)] backdrop-blur-[20px] backdrop-saturate-[1.8]',
      className,
    )}>{children}</div>
  );
}
