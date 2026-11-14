'use client';
/* ══ Sidebar system — one compositional API over every sidebar variant ══
   <SidebarProvider> owns open state and measures its own width (the sidebar primitive, `bindSizeClass`);
   <Sidebar variant="docked|rail|float|overlay"> renders the same children in any behavior, and ANY variant becomes
   an overlay drawer (UI SDK's Drawer, contained in the provider) while the provider is compact. The children stay
   mounted when it switches. The element holding them is `data-slot="sidebar-panel"` (the trigger's
   `aria-controls`); items and the search button carry `data-sidebar-item` / `data-sidebar-search`. Styled in the workbench language: put it in a `workbench` theme scope (WorkbenchTheme,
   or <ThemeScope scope="workbench">) for the Workbench palette; elsewhere it follows the surrounding theme. */
import { createContext, useContext, useMemo, useState } from 'react';
import type { ComponentProps, CSSProperties, ReactNode } from 'react';
import { Button as SdkButton } from '@ui-sdk/react/button';
import { createParts, usePart, usePrimitive, type PartProps } from '@ui-sdk/react/primitive';
import type { ChangeOptions } from '@ui-sdk/core';
import type { SizeClass } from '@/lib/size-class';
import { Sheet, SheetBackdrop, SheetContent } from '@/components/ui/sheet';
import { useKeptChildren } from '@/lib/kept-children';
import { sidebar, type SidebarApi, type SidebarOpenChangeReason, type SidebarOptions } from '@/lib/sidebar-primitive';
import { brandTile, cn, cx } from '@/lib/utils';
import { SizeClassProvider } from '@/lib/container';

export { createSidebarController } from '@/lib/sidebar-primitive';
export type { SidebarController, SidebarOpenChangeDetails, SidebarOpenChangeReason } from '@/lib/sidebar-primitive';

/* Rows highlight on hover over their resting fill. */
const hl = 'hover:bg-secondary!';

/** Sidebar item icons: 24×24 stroke paths, keyed by name. */
export const SIDEBAR_ICONS: Record<string, string> = {
  search: 'M10.5 4a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM20 20l-4.2-4.2',
  plus: 'M12 5v14M5 12h14',
  home: 'M4 11l8-7 8 7v9h-5v-6h-6v6H4z',
  inbox: 'M4 13l3-8h10l3 8v6H4zM4 13h5l1.5 2h3L15 13h5',
  box: 'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12L4 7.5M12 12v9',
  bolt: 'M13 2L4 14h6l-1 8 9-12h-6z',
  bell: 'M6 9a6 6 0 0112 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 004 0',
  cal: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
  doc: 'M7 3h7l4 4v14H7zM14 3v4h4',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6',
  code: 'M8 7l-5 5 5 5M16 7l5 5-5 5',
  globe: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c-2.5 2.6-2.5 15.4 0 18c2.5-2.6 2.5-15.4 0-18',
};
const P = SIDEBAR_ICONS;

function BIcon({ d, size = 16, sw = 1.9 }: { d: string; size?: number; sw?: number }) {
  return (
    <svg data-slot="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const { Trigger: SidebarTriggerPart, Panel: SidebarPanel } = createParts(sidebar, { trigger: 'button', panel: 'div' });

/** What `useSidebar()` returns: the provider's open state and size class, and ways to change them. */
export interface SidebarContextValue {
  open: boolean;
  setOpen: (open: boolean, options?: ChangeOptions<SidebarOpenChangeReason>) => boolean;
  toggle: (options?: ChangeOptions<SidebarOpenChangeReason>) => boolean;
  /** The provider's size class, measured from its own width against `breakpoint`. */
  sizeClass: SizeClass;
  /** `sizeClass === 'compact'`: every variant is an overlay drawer. */
  compact: boolean;
}
const SidebarContext = createContext<SidebarContextValue | null>(null);
const SidebarCollapsedContext = createContext(false);

export function useSidebar() {
  const c = useContext(SidebarContext);
  if (!c) throw new Error('Sidebar components must be rendered inside <SidebarProvider>');
  return c;
}
/** Whether the sidebar around is a collapsed rail (icons only): for custom parts that hide their labels. */
export function useSidebarCollapsed() {
  return useContext(SidebarCollapsedContext);
}

export interface SidebarProviderProps extends SidebarOptions, Omit<PartProps<'div'>, 'children'> {
  children?: ReactNode;
}
export function SidebarProvider({ open, defaultOpen, onOpenChange, breakpoint, controller, children, className, ...props }: SidebarProviderProps) {
  const handle = usePrimitive(sidebar, { open, defaultOpen, onOpenChange, breakpoint, controller } as SidebarOptions);
  const { api } = handle;
  return usePart(handle, 'provider', {}, {
    ...props,
    className: cx('relative flex h-full overflow-hidden bg-background font-sans', className),
    children: (state: { open: boolean; sizeClass: SizeClass }) => (
      <SidebarScope open={state.open} sizeClass={state.sizeClass} api={api}>{children}</SidebarScope>
    ),
  }, 'div');
}

/** The provider's state as context, and its size class as the scope of what it holds, popups included
 *  (`presentation="auto"`). */
function SidebarScope({ open, sizeClass, api, children }: { open: boolean; sizeClass: SizeClass; api: SidebarApi; children?: ReactNode }) {
  const value = useMemo<SidebarContextValue>(
    () => ({ open, sizeClass, compact: sizeClass === 'compact', setOpen: api.setOpen, toggle: api.toggle }),
    [open, sizeClass, api],
  );
  return (
    <SidebarContext.Provider value={value}>
      <SizeClassProvider value={sizeClass}>{children}</SizeClassProvider>
    </SidebarContext.Provider>
  );
}

export type SidebarVariant = 'docked' | 'rail' | 'float' | 'overlay';
export interface SidebarProps {
  variant?: SidebarVariant;
  width?: number;
  railWidth?: number;
  /** The overlay drawer's accessible name. Default "Sidebar". */
  'aria-label'?: string;
  children?: ReactNode;
}
export function Sidebar({ variant = 'docked', width = 228, railWidth = 52, 'aria-label': label = 'Sidebar', children }: SidebarProps) {
  const c = useSidebar();
  const overlay = variant === 'overlay' || c.compact;
  const collapsed = !overlay && variant === 'rail' && !c.open;
  const kept = useKeptChildren(
    <SidebarCollapsedContext.Provider value={collapsed}>
      <div className="flex h-full flex-col overflow-hidden">{children}</div>
    </SidebarCollapsedContext.Provider>,
  );
  const w = collapsed ? railWidth : c.open ? width : 0;
  const float = variant === 'float';
  return (
    <>
      {kept.portal}
      {overlay ? (
        <Sheet contained side="start" open={c.open} onOpenChange={(next, details) => { if (!c.setOpen(next, details)) details.cancel(); }}>
          <SheetBackdrop />
          <SheetContent variant="panel" keepMounted initialFocus="content" aria-label={label}
            className="w-(--sidebar-drawer-w) bg-sidebar" style={{ '--sidebar-drawer-w': width + 'px' } as CSSProperties}>
            <SidebarPanel ref={kept.dock} className="h-full">{kept.inline}</SidebarPanel>
          </SheetContent>
        </Sheet>
      ) : (
        // Closing slides the panel out toward the start: the box narrows while the panel, at full width, moves by its
        // own width on the same spring, so its inner edge stays on the content's edge and the content closes the gap
        // as fast as the panel leaves (opening runs it back). A rail only narrows, uncovering its labels from the start.
        <SidebarPanel
          data-variant={variant}
          // Closed, its items are out of sight: keep them out of the tab order and the accessibility tree too.
          inert={w === 0 || undefined}
          className={cn(
            'box-border w-(--sidebar-w) shrink-0 overflow-hidden transition-[width] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none',
            !float && 'border-e border-border bg-sidebar p-0',
          )}
          // Width follows open/collapsed state and the width props.
          style={{ '--sidebar-w': w + 'px', '--sidebar-panel-w': (collapsed ? railWidth : width) + 'px' } as CSSProperties}
        >
          <div
            className={cn(
              'box-border h-full w-(--sidebar-panel-w) transition-transform duration-spring-smooth ease-spring-smooth motion-reduce:transition-none',
              float && 'p-2.5',
              w === 0 && '-translate-x-full rtl:translate-x-full',
            )}
          >
            {float ? (
              <div ref={kept.dock} className="box-border h-full overflow-hidden rounded-card border border-border bg-sidebar font-sans">{kept.inline}</div>
            ) : (
              <div ref={kept.dock} className="contents">{kept.inline}</div>
            )}
          </div>
        </SidebarPanel>
      )}
    </>
  );
}

export function SidebarHeader({ children }: { children?: ReactNode }) {
  return (
    <div data-slot="sidebar-header" className="shrink-0 px-2.5 pt-3 pb-1.5">
      {children}
    </div>
  );
}
export function SidebarContent({ children }: { children?: ReactNode }) {
  return (
    <div
      data-slot="sidebar-content"
      className="bl-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 py-0"
    >
      {children}
    </div>
  );
}
export function SidebarFooter({ children }: { children?: ReactNode }) {
  return (
    <div data-slot="sidebar-footer" className="shrink-0 border-t border-border p-2">
      {children}
    </div>
  );
}

export interface SidebarWorkspaceProps {
  name?: string;
  detail?: ReactNode;
  initial?: ReactNode;
}
export function SidebarWorkspace({ name, detail, initial }: SidebarWorkspaceProps) {
  const collapsed = useSidebarCollapsed();
  return (
    <div
      data-slot="sidebar-workspace"
      className={cn('flex items-center gap-2 px-0.5 pt-0 pb-1', collapsed ? 'justify-center' : 'justify-start')}
    >
      <span className={cn(brandTile, 'grid size-[26px] shrink-0 place-items-center rounded-lg text-caption font-extrabold text-white')}>
        {initial || (name || 'W')[0]}
      </span>
      {!collapsed && (
        <div className="min-w-0 leading-[1.15]">
          <div className="text-[12.5px] font-bold whitespace-nowrap text-foreground">{name}</div>
          {detail && <div className="text-[10.5px] whitespace-nowrap text-tertiary-foreground">{detail}</div>}
        </div>
      )}
    </div>
  );
}

export interface SidebarSearchProps {
  placeholder?: string;
  /** UI SDK Button's `onClick(event, details)`. */
  onClick?: ComponentProps<typeof SdkButton>['onClick'];
}
export function SidebarSearch({ placeholder = 'Quick search', onClick }: SidebarSearchProps) {
  const collapsed = useSidebarCollapsed();
  if (collapsed)
    return (
      <SdkButton
        data-sidebar-search=""
        title={placeholder}
        aria-label={placeholder}
        className={cn(hl, 'grid w-full cursor-pointer place-items-center rounded-lg border-0 bg-transparent px-0 py-2 text-tertiary-foreground')}
        onClick={onClick}
      >
        <BIcon d={P['search']} size={14} />
      </SdkButton>
    );
  return (
    <SdkButton
      data-sidebar-search=""
      className={cn(hl, 'mx-0 mt-0.5 mb-1 flex w-full cursor-pointer items-center gap-[7px] rounded-lg border-0 bg-secondary px-[9px] py-1.5 font-sans')}
      onClick={onClick}
    >
      <span className="grid text-tertiary-foreground">
        <BIcon d={P['search']} size={13} />
      </span>
      <span className="flex-1 text-left text-caption text-tertiary-foreground">{placeholder}</span>
      <span className="rounded-sm border border-border px-1 py-0 font-mono text-[10px] text-tertiary-foreground">
        /
      </span>
    </SdkButton>
  );
}

export interface SidebarSectionProps {
  title?: ReactNode;
  children?: ReactNode;
}
export function SidebarSection({ title, children }: SidebarSectionProps) {
  const collapsed = useSidebarCollapsed();
  return (
    <div data-slot="sidebar-section">
      {title ? (
        collapsed ? (
          <div className="mx-1.5 my-2 h-px bg-border" />
        ) : (
          <div className="px-[9px] pt-2.5 pb-1 text-[10px] font-bold tracking-[.6px] whitespace-nowrap text-tertiary-foreground uppercase">
            {title}
          </div>
        )
      ) : null}
      {children}
    </div>
  );
}

export interface SidebarItemProps {
  icon?: string | ReactNode;
  label?: string;
  badge?: ReactNode;
  active?: boolean;
  tone?: string;
  /** UI SDK Button's `onClick(event, details)`. */
  onClick?: ComponentProps<typeof SdkButton>['onClick'];
}
export function SidebarItem({ icon, label, badge, active, tone, onClick }: SidebarItemProps) {
  const collapsed = useSidebarCollapsed();
  const ic = typeof icon === 'string' ? <BIcon d={P[icon] || P['box']} size={15} sw={1.8} /> : icon;
  return (
    <SdkButton
      data-sidebar-item=""
      title={label}
      aria-label={collapsed ? label : undefined}
      aria-current={active ? 'page' : undefined}
      className={cn(
        hl,
        'mx-0 my-px flex w-full cursor-pointer items-center gap-[9px] rounded-lg border-0 text-left font-sans text-footnote',
        collapsed ? 'justify-center px-0 py-2' : 'justify-start px-[9px] py-1.5',
        active ? 'bg-secondary-strong' : 'bg-transparent',
        !tone && (active ? 'text-foreground' : 'text-muted-foreground'),
        tone ? 'font-semibold' : 'font-normal',
      )}
      onClick={onClick}
      // A caller-chosen tone colour.
      style={tone ? { color: tone } : undefined}
    >
      <span className="grid shrink-0">{ic}</span>
      {!collapsed && (
        <span className="flex-1 truncate">{label}</span>
      )}
      {!collapsed && badge != null && (
        <span className="rounded-md bg-primary/13 px-1.5 py-px font-mono text-[10.5px] text-primary">
          {badge}
        </span>
      )}
    </SdkButton>
  );
}

Sidebar.Header = SidebarHeader;
Sidebar.Content = SidebarContent;
Sidebar.Footer = SidebarFooter;
Sidebar.Workspace = SidebarWorkspace;
Sidebar.Search = SidebarSearch;
Sidebar.Section = SidebarSection;
Sidebar.Item = SidebarItem;

/** The hamburger: toggles the sidebar in whichever presentation is mounted. */
export function SidebarTrigger({ className, 'aria-label': label = 'Toggle sidebar', ...props }: PartProps<'button'>) {
  return (
    <SidebarTriggerPart
      type="button"
      aria-label={label}
      className={cx('grid cursor-pointer place-items-center rounded-lg border-0 bg-transparent p-1.5 text-muted-foreground', className)}
      {...props}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        <path d="M4 6.5h16M4 12h16M4 17.5h16" />
      </svg>
    </SidebarTriggerPart>
  );
}

export function SidebarInset({ children, style, className }: { children?: ReactNode; style?: CSSProperties; className?: string }) {
  return (
    <div
      data-slot="sidebar-inset"
      className={cn('flex min-w-0 flex-1 flex-col overflow-hidden', className)}
      style={style}
    >
      {children}
    </div>
  );
}

/* SidebarNav — the pre-composed example, built from the primitives */
export interface SidebarNavProps {
  variant?: SidebarVariant;
}
export function SidebarNav({ variant = 'docked' }: SidebarNavProps) {
  const [cur, setCur] = useState('Home');
  const it = (icon: string, label: string, badge?: ReactNode) => (
    <SidebarItem key={label} icon={icon} label={label} badge={badge} active={cur === label} onClick={() => setCur(label)} />
  );
  return (
    <Sidebar variant={variant}>
      <SidebarHeader>
        <SidebarWorkspace name="Creamery Ops" detail="Production Workspace" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarSearch />
        <SidebarItem icon="plus" label="New task" tone="var(--primary)" />
        <SidebarSection title="Workspace">{[it('home', 'Home'), it('bolt', 'Agent tasks', 4), it('inbox', 'Inbox')]}</SidebarSection>
        <SidebarSection title="Objects">{[it('box', 'Suppliers'), it('box', 'Inventory')]}</SidebarSection>
      </SidebarContent>
    </Sidebar>
  );
}

