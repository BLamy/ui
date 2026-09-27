import * as React from 'react';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button } from '../../lib/workbench/press';
import { cn } from '../../lib/workbench/util';
import { vib, tick } from '../../lib/workbench/haptics';
import { WIcon, IconBtn, type WIconName } from '../../lib/workbench/icons';
import { springs } from '../../lib/workbench/motion';
import { useOptionalWorkbenchShell } from '../../templates/workbench-shell';

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
   Inside a WorkbenchShell, picking a thread or starting a new one closes the compact drawer. */

type Div = { className?: string; style?: React.CSSProperties; children?: React.ReactNode };

/* Sidebar row chrome shared by threads, the project switcher, "Show more" and footer items. */
const rowBtn = 'wb-btn wb-hl flex cursor-pointer items-center gap-2 rounded-lg border-0 text-left';

/** Closes the compact drawer after a navigation. */
function useCloseDrawer() {
  const shell = useOptionalWorkbenchShell();
  return () => {
    if (shell?.compact) shell.setSidebarOpen(false);
  };
}

export function ThreadSidebar({ className, style, children }: Div) {
  return (
    <nav data-slot="thread-sidebar" aria-label="Threads" className={cn('box-border flex h-full w-full flex-col bg-wb-side', className)} style={style}>
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
        <span className="grid size-[22px] shrink-0 place-items-center rounded-md bg-[linear-gradient(135deg,var(--wb-tint),#5E5CE6)]">
          <WIcon name="spark" size={13} sw={2.2} className="text-white" />
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
    <div data-slot="thread-search" className={cn('flex flex-1 items-center gap-1.5 rounded-lg bg-wb-fill px-2 py-[5px]', className)}>
      <WIcon name="search" size={14} sw={2} className="text-wb-label3" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label="Search threads"
        className="min-w-0 flex-1 border-0 bg-transparent text-[12.5px] [font-family:inherit] text-wb-label outline-none"
      />
    </div>
  );
}

/** Compose button; closes the compact drawer. */
export function ThreadNewButton({ onPress, label = 'New thread', className }: { onPress?: () => void; label?: string; className?: string }) {
  const close = useCloseDrawer();
  return (
    <IconBtn
      name="compose"
      label={label}
      size={17}
      className={className}
      onPress={() => {
        vib([8]);
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
      className={cn(rowBtn, 'mx-2 bg-transparent px-2 py-1.5 text-[12.5px] font-semibold text-wb-label2', className)}
      onPress={() => {
        tick();
        onPress?.();
      }}
    >
      <WIcon name="folder" size={15} sw={1.8} />
      <span className="flex-1 truncate">{children}</span>
      <WIcon name="chevD" size={13} sw={2.2} />
      <WIcon name="folderP" size={15} sw={1.8} className="text-wb-label3" />
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
  const labelEl = <span className="text-[11px] font-semibold tracking-[.4px] text-wb-label3">{label}</span>;
  const line = <span className="h-px flex-1 bg-wb-sep" />;
  return (
    <div data-slot="thread-group" role="group" className={className}>
      {collapsible ? (
        <Button
          aria-expanded={open}
          className="wb-btn box-border flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-2 pt-2.5 pb-1"
          onPress={() => {
            tick();
            setOwnOpen(!open);
            onOpenChange?.(!open);
          }}
        >
          {labelEl}
          {line}
          <WIcon name={open ? 'chevU' : 'chevD'} size={12} sw={2.2} className="text-wb-label3" />
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
  icon?: WIconName;
  onPress?: () => void;
  className?: string;
  children?: React.ReactNode;
}
export function ThreadItem({ active, status = 'idle', meta, icon = 'msg', onPress, className, children }: ThreadItemProps) {
  const close = useCloseDrawer();
  return (
    <Button
      data-slot="thread-item"
      data-status={status}
      aria-current={active ? 'page' : undefined}
      className={cn(rowBtn, 'box-border w-full px-2 py-1.5 text-[13px] text-wb-label', active ? 'bg-wb-fill2' : 'bg-transparent', className)}
      onPress={() => {
        tick();
        onPress?.();
        close();
      }}
    >
      {status === 'running' ? (
        <span className="grid size-[15px] shrink-0 place-items-center" aria-label="Running">
          <span className="size-[7px] animate-[wbPulse_1.2s_infinite] rounded-full bg-wb-tint motion-reduce:animate-none" />
        </span>
      ) : (
        <span className="contents" aria-label={status === 'error' ? 'Failed' : undefined}>
          <WIcon name={icon} size={15} sw={1.8} className={status === 'error' ? 'text-wb-red' : 'text-wb-label3'} />
        </span>
      )}
      <span className={cn('min-w-0 flex-1 truncate', status === 'unread' && 'font-semibold')}>{children}</span>
      {status === 'unread' ? <span aria-label="Unread" className="size-1.5 shrink-0 rounded-full bg-wb-tint" /> : null}
      {meta != null ? <span className="shrink-0 text-[11.5px] text-wb-label3">{meta}</span> : null}
    </Button>
  );
}

/** "Show N more" at the end of a truncated group. */
export function ThreadShowMore({ count, onPress, className }: { count: number; onPress?: () => void; className?: string }) {
  return (
    <Button
      data-slot="thread-show-more"
      className={cn(rowBtn, 'w-full bg-transparent px-2 py-1.5 text-[12.5px] text-wb-label3', className)}
      onPress={() => {
        tick();
        onPress?.();
      }}
    >
      <WIcon name="plus" size={13} sw={2} />
      <span>Show {count} more</span>
    </Button>
  );
}

export function ThreadSidebarFooter({ className, style, children }: Div) {
  return (
    <div data-slot="thread-sidebar-footer" className={cn('border-t border-wb-sep px-2.5 pt-2 pb-2.5', className)} style={style}>
      {children}
    </div>
  );
}

/** A tinted callout in the footer ("Update available"). `onDismiss` adds the ×. */
export function SidebarNotice({ icon = 'dl', onPress, onDismiss, className, children }: { icon?: WIconName; onPress?: () => void; onDismiss?: () => void; className?: string; children?: React.ReactNode }) {
  return (
    <div data-slot="sidebar-notice" className={cn('mb-1.5 flex items-center gap-2 rounded-[9px] bg-[rgba(10,132,255,.12)] px-2.5 py-[7px]', className)}>
      <WIcon name={icon} size={14} sw={2} className="text-wb-tint" />
      {onPress ? (
        <Button className="wb-btn flex-1 cursor-pointer border-0 bg-transparent p-0 text-left text-[12.5px] font-semibold text-wb-tint" onPress={onPress}>
          {children}
        </Button>
      ) : (
        <span className="flex-1 text-[12.5px] font-semibold text-wb-tint">{children}</span>
      )}
      {onDismiss !== undefined ? (
        <Button aria-label="Dismiss" className="wb-btn grid cursor-pointer place-items-center border-0 bg-transparent p-0 text-wb-label3" onPress={onDismiss}>
          <WIcon name="x" size={13} sw={2} />
        </Button>
      ) : null}
    </div>
  );
}

/** A footer row: Settings, Help, Sign out. */
export function SidebarFooterItem({ icon, onPress, className, children }: { icon: WIconName; onPress?: () => void; className?: string; children?: React.ReactNode }) {
  return (
    <Button
      data-slot="sidebar-footer-item"
      className={cn(rowBtn, 'w-full bg-transparent px-2 py-[7px] text-[13px] text-wb-label2', className)}
      onPress={() => {
        tick();
        onPress?.();
      }}
    >
      <WIcon name={icon} size={16} sw={1.7} />
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
      onPress={() => {
        tick();
        onPress?.();
      }}
    >
      {avatar ? (
        <img src={avatar} alt="" className="size-7 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[linear-gradient(135deg,var(--wb-tint),#5E5CE6)] text-[11px] font-bold text-white">
          {initials}
        </span>
      )}
      <span className="grid min-w-0 flex-1 leading-tight">
        <span className="truncate text-[13px] font-semibold text-wb-label">{name}</span>
        {detail != null ? <span className="truncate text-[11.5px] text-wb-label3">{detail}</span> : null}
      </span>
      <WIcon name="chevD" size={13} sw={2.2} className="text-wb-label3" />
    </Button>
  );
}
