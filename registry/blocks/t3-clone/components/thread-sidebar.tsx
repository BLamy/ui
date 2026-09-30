import * as React from 'react';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from 'react-aria-components';
import { IconButton } from '@/components/ui/icon-button';
import { Icon, type IconName } from '@/lib/icon';
import { springs } from '@/lib/motion';
import { cn } from '@/lib/utils';
import { useOptionalWorkbenchShell } from './workbench/workbench-shell';

/* ══ Thread sidebar parts ══
   <ThreadSidebar>
     <ThreadSidebarHeader><ThreadSidebarBrand/><WorkbenchSidebarClose/></ThreadSidebarHeader>
     <ThreadSidebarToolbar><ThreadSearch/><ThreadNewButton/></ThreadSidebarToolbar>
     <ProjectSwitcher/>
     <ThreadList>
       <ThreadGroup label="Active"><ThreadItem/>…</ThreadGroup>
       <ThreadGroup label="Settled" collapsible>…<ThreadShowMore/></ThreadGroup>
     </ThreadList>
     <ThreadSidebarFooter><SidebarNotice/><SidebarFooterItem/> | <SidebarUser/></ThreadSidebarFooter>
   </ThreadSidebar>
   Inside a WorkbenchShell, picking a thread or starting a new one closes the compact drawer.
   (T3 Code's sidebar, kept with the block: the library's generic sidebar is `Sidebar*`.) */

type Div = { className?: string; style?: React.CSSProperties; children?: React.ReactNode };

/** Pressables: no tap flash, the host font, and a brightness nudge on hover (dimmer on light surfaces, brighter
    on dark ones). */
const press = '[-webkit-tap-highlight-color:transparent] [font-family:inherit] hover:brightness-[.97] dark:hover:brightness-[1.12]';

/** The brand tile: the accent into iOS indigo (a fixed brand color). */
const brandTile = 'bg-[linear-gradient(135deg,var(--primary),#5E5CE6)]';

/* Sidebar row chrome shared by threads, the project switcher, "Show more" and footer items. */
const rowBtn = cn(press, 'flex cursor-pointer items-center gap-2 rounded-lg border-0 text-left hover:bg-secondary!');

/** Closes the compact drawer after a navigation. */
function useCloseDrawer() {
  const shell = useOptionalWorkbenchShell();
  return () => {
    if (shell?.compact) shell.setSidebarOpen(false);
  };
}

export function ThreadSidebar({ className, style, children }: Div) {
  return (
    <nav data-slot="thread-sidebar" aria-label="Threads" className={cn('box-border flex h-full w-full flex-col bg-sidebar', className)} style={style}>
      {children}
    </nav>
  );
}

export function ThreadSidebarHeader({ className, style, children }: Div) {
  return (
    <div data-slot="thread-sidebar-header" className={cn('flex items-center gap-2 px-3 pt-3 pb-2', className)} style={style}>
      {children}
    </div>
  );
}

/** App mark + name. `icon` replaces the default tinted spark tile. */
export function ThreadSidebarBrand({ icon, children, className }: { icon?: React.ReactNode; children?: React.ReactNode; className?: string }) {
  return (
    <>
      {icon ?? (
        <span className={cn(brandTile, 'grid size-[22px] shrink-0 place-items-center rounded-md')}>
          <Icon name="asterisk" size={13} sw={2.2} className="text-white" />
        </span>
      )}
      <span data-slot="thread-sidebar-brand" className={cn('text-[13.5px] font-bold tracking-[-.1px]', className)}>
        {children}
      </span>
    </>
  );
}

export function ThreadSidebarToolbar({ className, style, children }: Div) {
  return (
    <div data-slot="thread-sidebar-toolbar" className={cn('flex gap-1.5 px-3 pb-1.5', className)} style={style}>
      {children}
    </div>
  );
}

export interface ThreadSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}
export function ThreadSearch({ value, onChange, placeholder = 'Search', className }: ThreadSearchProps) {
  return (
    <div data-slot="thread-search" className={cn('flex flex-1 items-center gap-1.5 rounded-lg bg-secondary px-2 py-[5px]', className)}>
      <Icon name="magnifier" size={14} sw={2} className="text-tertiary-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search threads"
        className="min-w-0 flex-1 border-0 bg-transparent text-[12.5px] [font-family:inherit] text-foreground outline-none"
      />
    </div>
  );
}

/** Compose button; closes the compact drawer. */
export function ThreadNewButton({ onPress, label = 'New thread', className }: { onPress?: () => void; label?: string; className?: string }) {
  const close = useCloseDrawer();
  return (
    <IconButton
      name="square-pencil"
      label={label}
      size={17}
      className={className}
      onPress={() => {
        onPress?.();
        close();
      }}
    />
  );
}

export interface ProjectSwitcherProps {
  /** the current project, or "All projects" */
  children?: React.ReactNode;
  onPress?: () => void;
  className?: string;
}
/** The project row under the search field: current project, a chevron, and the folder-plus affordance. */
export function ProjectSwitcher({ children = 'All projects', onPress, className }: ProjectSwitcherProps) {
  return (
    <Button
      data-slot="project-switcher"
      className={cn(rowBtn, 'mx-2 bg-transparent px-2 py-1.5 text-[12.5px] font-semibold text-muted-foreground', className)}
      onPress={() => onPress?.()}
    >
      <Icon name="folder-closed" size={15} sw={1.8} />
      <span className="flex-1 truncate">{children}</span>
      <Icon name="chevron-down-wide" size={13} sw={2.2} />
      <Icon name="folder-plus" size={15} sw={1.8} className="text-tertiary-foreground" />
    </Button>
  );
}

/** The scrolling region that holds the groups. */
export function ThreadList({ className, style, children }: Div) {
  return (
    <div data-slot="thread-list" className={cn('wb-scroll min-h-0 flex-1 overflow-y-auto px-2 pt-1 pb-2', className)} style={style}>
      {children}
    </div>
  );
}

export interface ThreadGroupProps {
  label: React.ReactNode;
  /** header becomes a toggle that folds the group */
  collapsible?: boolean;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  children?: React.ReactNode;
}
/** A labelled run of threads ("Active", "Settled", "Today"…). Collapsible groups fold on a spring. */
export function ThreadGroup({ label, collapsible, defaultOpen = true, open: openProp, onOpenChange, className, children }: ThreadGroupProps) {
  const [ownOpen, setOwnOpen] = useState(defaultOpen);
  const open = openProp ?? ownOpen;
  const labelEl = <span className="text-caption2 font-semibold tracking-[.4px] text-tertiary-foreground">{label}</span>;
  const line = <span className="h-px flex-1 bg-border" />;
  return (
    <div data-slot="thread-group" role="group" className={className}>
      {collapsible ? (
        <Button
          aria-expanded={open}
          className={cn(press, 'box-border flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-2 pt-2.5 pb-1')}
          onPress={() => {
            setOwnOpen(!open);
            onOpenChange?.(!open);
          }}
        >
          {labelEl}
          {line}
          <Icon name={open ? 'chevron-up-wide' : 'chevron-down-wide'} size={12} sw={2.2} className="text-tertiary-foreground" />
        </Button>
      ) : (
        <div className="flex items-center gap-2 px-2 pt-2.5 pb-1">
          {labelEl}
          {line}
        </div>
      )}
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="rows"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={springs.smooth}
            className={collapsible ? 'overflow-hidden' : undefined}
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export type ThreadStatus = 'idle' | 'running' | 'unread' | 'error';
export interface ThreadItemProps {
  /** highlighted as the open thread */
  active?: boolean;
  /** running: a pulsing dot replaces the icon · unread: bold title + dot · error: red dot */
  status?: ThreadStatus;
  /** trailing text, e.g. the thread's age */
  meta?: React.ReactNode;
  icon?: IconName | (string & {});
  onPress?: () => void;
  className?: string;
  children?: React.ReactNode;
}
export function ThreadItem({ active, status = 'idle', meta, icon = 'bubble-left', onPress, className, children }: ThreadItemProps) {
  const close = useCloseDrawer();
  return (
    <Button
      data-slot="thread-item"
      data-status={status}
      aria-current={active ? 'page' : undefined}
      className={cn(rowBtn, 'box-border w-full px-2 py-1.5 text-footnote text-foreground', active ? 'bg-secondary-strong' : 'bg-transparent', className)}
      onPress={() => {
        onPress?.();
        close();
      }}
    >
      {status === 'running' ? (
        <span className="grid size-[15px] shrink-0 place-items-center" aria-label="Running">
          <span className="size-[7px] animate-[wbPulse_1.2s_infinite] rounded-full bg-primary motion-reduce:animate-none" />
        </span>
      ) : (
        <span className="contents" aria-label={status === 'error' ? 'Failed' : undefined}>
          <Icon name={icon} size={15} sw={1.8} className={status === 'error' ? 'text-destructive' : 'text-tertiary-foreground'} />
        </span>
      )}
      <span className={cn('min-w-0 flex-1 truncate', status === 'unread' && 'font-semibold')}>{children}</span>
      {status === 'unread' ? <span aria-label="Unread" className="size-1.5 shrink-0 rounded-full bg-primary" /> : null}
      {meta != null ? <span className="shrink-0 text-[11.5px] text-tertiary-foreground">{meta}</span> : null}
    </Button>
  );
}

/** "Show N more" at the end of a truncated group. */
export function ThreadShowMore({ count, onPress, className }: { count: number; onPress?: () => void; className?: string }) {
  return (
    <Button
      data-slot="thread-show-more"
      className={cn(rowBtn, 'w-full bg-transparent px-2 py-1.5 text-[12.5px] text-tertiary-foreground', className)}
      onPress={() => onPress?.()}
    >
      <Icon name="plus" size={13} sw={2} />
      <span>Show {count} more</span>
    </Button>
  );
}

export function ThreadSidebarFooter({ className, style, children }: Div) {
  return (
    <div data-slot="thread-sidebar-footer" className={cn('border-t border-border px-2.5 pt-2 pb-2.5', className)} style={style}>
      {children}
    </div>
  );
}

/** A tinted callout in the footer ("Update available"). `onDismiss` adds the ×. */
export function SidebarNotice({ icon = 'arrow-down-to-line', onPress, onDismiss, className, children }: { icon?: IconName | (string & {}); onPress?: () => void; onDismiss?: () => void; className?: string; children?: React.ReactNode }) {
  return (
    <div data-slot="sidebar-notice" className={cn('mb-1.5 flex items-center gap-2 rounded-[9px] bg-primary/12 px-2.5 py-[7px]', className)}>
      <Icon name={icon} size={14} sw={2} className="text-primary" />
      {onPress ? (
        <Button className={cn(press, 'flex-1 cursor-pointer border-0 bg-transparent p-0 text-left text-[12.5px] font-semibold text-primary')} onPress={onPress}>
          {children}
        </Button>
      ) : (
        <span className="flex-1 text-[12.5px] font-semibold text-primary">{children}</span>
      )}
      {onDismiss !== undefined ? (
        <Button aria-label="Dismiss" className={cn(press, 'grid cursor-pointer place-items-center border-0 bg-transparent p-0 text-tertiary-foreground')} onPress={onDismiss}>
          <Icon name="xmark-large" size={13} sw={2} />
        </Button>
      ) : null}
    </div>
  );
}

/** A footer row: Settings, Help, Sign out. */
export function SidebarFooterItem({ icon, onPress, className, children }: { icon: IconName | (string & {}); onPress?: () => void; className?: string; children?: React.ReactNode }) {
  return (
    <Button
      data-slot="sidebar-footer-item"
      className={cn(rowBtn, 'w-full bg-transparent px-2 py-[7px] text-footnote text-muted-foreground', className)}
      onPress={() => onPress?.()}
    >
      <Icon name={icon} size={16} sw={1.7} />
      <span>{children}</span>
    </Button>
  );
}

export interface SidebarUserProps {
  name: string;
  /** second line: plan, email, workspace */
  detail?: React.ReactNode;
  /** image URL; initials otherwise */
  avatar?: string;
  onPress?: () => void;
  className?: string;
}
/** The signed-in user: avatar, name, detail, and a chevron that suggests a menu. */
export function SidebarUser({ name, detail, avatar, onPress, className }: SidebarUserProps) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <Button
      data-slot="sidebar-user"
      className={cn(rowBtn, 'w-full bg-transparent px-2 py-1.5', className)}
      onPress={() => onPress?.()}
    >
      {avatar ? (
        <img src={avatar} alt="" className="size-7 shrink-0 rounded-full object-cover" />
      ) : (
        <span className={cn(brandTile, 'grid size-7 shrink-0 place-items-center rounded-full text-caption2 font-bold text-white')}>
          {initials}
        </span>
      )}
      <span className="grid min-w-0 flex-1 leading-tight">
        <span className="truncate text-footnote font-semibold text-foreground">{name}</span>
        {detail != null ? <span className="truncate text-[11.5px] text-tertiary-foreground">{detail}</span> : null}
      </span>
      <Icon name="chevron-down-wide" size={13} sw={2.2} className="text-tertiary-foreground" />
    </Button>
  );
}
