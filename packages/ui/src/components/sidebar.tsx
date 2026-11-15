'use client';
/* ══ Sidebar — an app's navigation column, with a collapsed rail, that becomes a drawer when the room runs out ══
   <SidebarProvider> owns open state and measures its own width (the sidebar primitive, `bindSizeClass`): below
   `breakpoint` it is `compact`, and it is the size-class scope of everything it renders.
   <Sidebar variant presentation> shows its children in one look (`docked` column, `rail` that collapses to its
   icons, `float` inset card) and one presentation: a `column` beside the inset, or a `drawer` over it. `auto` (the
   default) is a drawer while the scope is compact and a column otherwise. Both presentations are AdaptivePane's
   (its column, and its drawer: a contained Sheet), and the children are rendered once and only move, so a filter
   keeps its text when the sidebar changes presentation.

     <SidebarProvider>
       <Sidebar variant="rail">
         <SidebarHeader><SidebarAccount title="Northwind" description="Sales" /></SidebarHeader>
         <SidebarContent aria-label="Pipeline">
           <SidebarSearch shortcut="/" onClick={openSearch} />
           <SidebarSection title="Pipeline">
             <SidebarItem icon="tray" title="Inbox" trailing={6} current />
           </SidebarSection>
         </SidebarContent>
       </Sidebar>
       <SidebarInset><SidebarTrigger shortcut="mod+b" />…</SidebarInset>
     </SidebarProvider>

   The rows, sections, search and account also work on their own, outside a Sidebar (a shell's own panel). It
   follows the surrounding theme; a `workbench` theme scope (`<ThemeScope scope="workbench">`) gives it the
   Workbench palette. ══ */
import { createContext, useContext, useId, useMemo, useRef, useState } from 'react';
import type { ComponentProps, CSSProperties, ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { Button as SdkButton } from '@ui-sdk/react/button';
import { createParts, usePart, usePrimitive, type PartProps } from '@ui-sdk/react/primitive';
import { useShortcut, useShortcutHint } from '@ui-sdk/react/shortcuts';
import type { ChangeOptions } from '@ui-sdk/core';
import { AdaptivePane } from '@/components/ui/adaptive-pane';
import { Badge } from '@/components/ui/badge';
import { Kbd } from '@/components/ui/kbd';
import { Tooltip, TooltipContent, TooltipTrigger, createTooltipController, type TooltipController } from '@/components/ui/tooltip';
import { SizeClassProvider, useSizeClassScope } from '@/lib/container';
import { Icon, type IconName } from '@/lib/icon';
import { sectionLabelVariants } from '@/lib/primitives';
import type { SizeClass } from '@/lib/size-class';
import { sidebar, type SidebarApi, type SidebarOpenChangeReason, type SidebarOptions } from '@/lib/sidebar-primitive';
import { brandTile, cn, cx } from '@/lib/utils';

export { createSidebarController } from '@/lib/sidebar-primitive';
export type { SidebarController, SidebarOpenChangeDetails, SidebarOpenChangeReason } from '@/lib/sidebar-primitive';

const { Trigger: SidebarTriggerPart, Panel: SidebarPanelPart } = createParts(sidebar, { trigger: 'button', panel: 'div' });

/* ── Provider ── */

/** What `useSidebar()` returns: the provider's open state and size class, and ways to change them. */
export interface SidebarContextValue {
  open: boolean;
  setOpen: (open: boolean, options?: ChangeOptions<SidebarOpenChangeReason>) => boolean;
  toggle: (options?: ChangeOptions<SidebarOpenChangeReason>) => boolean;
  /** The provider's size class, measured from its own width against `breakpoint`. */
  sizeClass: SizeClass;
  /** `sizeClass === 'compact'`: a Sidebar with `presentation="auto"` is a drawer. */
  compact: boolean;
}
const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const c = useContext(SidebarContext);
  if (!c) throw new Error('Sidebar components must be rendered inside <SidebarProvider>');
  return c;
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

/** The provider's state as context, and its size class as the scope of what it holds, popups included. */
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

/* ── Sidebar ── */

/** The look: a `docked` column on a hairline, a `rail` that collapses to its icons when closed, or a `float` card
 *  inset from the edges. */
export type SidebarVariant = 'docked' | 'rail' | 'float';
/** Where it shows: a `column` beside the inset, a `drawer` over it, or `auto`: a drawer while the size-class scope
 *  (the provider) is compact, a column otherwise. */
export type SidebarPresentation = 'auto' | 'column' | 'drawer';

/** What `className` and `style` are given when they are functions. */
export type SidebarState = { variant: SidebarVariant; presentation: Exclude<SidebarPresentation, 'auto'>; open: boolean; collapsed: boolean };

/* What the parts inside a Sidebar read. Outside one they are plain rows. */
type SidebarPanel = {
  collapsed: boolean;
  compact: boolean;
  tooltip: TooltipController<ReactNode>;
  /** Closes a drawer after one of its rows was pressed. */
  dismiss: (event: Event) => void;
};
const SidebarPanelContext = createContext<SidebarPanel | null>(null);

/** Whether the sidebar around is a collapsed rail (icons only): for custom parts that hide their text. `false`
 *  outside a Sidebar. */
export function useSidebarCollapsed() {
  return useContext(SidebarPanelContext)?.collapsed ?? false;
}

export interface SidebarProps extends Omit<ComponentProps<'div'>, 'className' | 'style' | 'children' | 'aria-label'> {
  /** The look. Default `docked`. */
  variant?: SidebarVariant;
  /** Where it shows. Default `auto`: a drawer while the provider is compact, a column otherwise. */
  presentation?: SidebarPresentation;
  /** Width open, px: the column's and the drawer's (a drawer takes at most 85% of the provider). Default 228. */
  width?: number;
  /** Width of a collapsed `rail`, px. Default 52. */
  railWidth?: number;
  /** The drawer's accessible name. Default "Sidebar". */
  'aria-label'?: string;
  /** Classes of the sidebar's box: the column, or the drawer's panel. A function gets the sidebar's state. `ref`,
   *  `id` and the other props go on the panel inside it (`data-slot="sidebar-panel"`), the same element in both
   *  presentations. */
  className?: string | ((state: SidebarState) => string | undefined);
  style?: CSSProperties | ((state: SidebarState) => CSSProperties | undefined);
  children?: ReactNode;
}

export function Sidebar({
  variant = 'docked', presentation = 'auto', width = 228, railWidth = 52, 'aria-label': label = 'Sidebar', className, style, children, ...props
}: SidebarProps) {
  const c = useSidebar();
  const scope = useSizeClassScope() ?? c.sizeClass;
  const shown = presentation === 'auto' ? (scope === 'compact' ? 'drawer' : 'column') : presentation;
  const column = shown === 'column';
  const collapsed = column && variant === 'rail' && !c.open;
  const float = column && variant === 'float';
  // The column's width: open, collapsed to the rail, or 0 (closed, it slides away toward the start).
  const boxWidth = collapsed ? railWidth : c.open ? width : 0;
  const hidden = column && boxWidth === 0;
  const [tooltip] = useState(() => createTooltipController<ReactNode>());
  const { setOpen, compact } = c;
  const panel = useMemo<SidebarPanel>(() => ({
    collapsed, compact, tooltip,
    dismiss: (event) => { if (shown === 'drawer') setOpen(false, { reason: 'action', event }); },
  }), [shown, collapsed, compact, tooltip, setOpen]);
  const state: SidebarState = { variant, presentation: shown, open: c.open, collapsed };
  const own = <T,>(value: T | ((state: SidebarState) => T) | undefined) =>
    typeof value === 'function' ? (value as (state: SidebarState) => T)(state) : value;

  return (
    <SidebarPanelContext.Provider value={panel}>
      <AdaptivePane
        side="start"
        presentation={shown}
        // A column is always open to the pane: the sidebar narrows it itself, so a rail stays and a closing column
        // slides. A drawer opens and closes with the provider, and its dismissals come back to it.
        open={column ? true : c.open}
        onOpenChange={(next, details) => { if (!c.setOpen(next, details)) details.cancel(); }}
        drawerWidth={width}
        aria-label={label}
        className={column
          ? cn(
            'box-border w-(--sidebar-w) overflow-hidden transition-[width] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none',
            !float && 'border-e border-border bg-sidebar',
            // An Avatar's ring is cut in the surface it sits on.
            '[--avatar-ring:var(--sidebar)]',
            own(className),
          )
          : cn('bg-sidebar [--avatar-ring:var(--sidebar)]', own(className))}
        style={{ ...(column ? { '--sidebar-w': boxWidth + 'px' } : null), ...own(style) } as CSSProperties}
      >
        {/* Closing slides the panel out toward the start: the box narrows while the panel, at full width, moves by
            its own width on the same spring, so its inner edge stays on the content's edge. A rail only narrows,
            uncovering its labels from the start. Closed, its rows leave the tab order and the a11y tree. */}
        <SidebarPanelPart
          {...props}
          data-variant={variant}
          data-presentation={shown}
          data-collapsed={collapsed ? '' : undefined}
          inert={hidden || undefined}
          className={column
            ? cn(
              'box-border h-full w-(--sidebar-panel-w) transition-transform duration-spring-smooth ease-spring-smooth motion-reduce:transition-none',
              float && 'p-2.5',
              hidden && '-translate-x-full rtl:translate-x-full',
            )
            : 'h-full'}
          style={column ? { '--sidebar-panel-w': (collapsed ? railWidth : width) + 'px' } as CSSProperties : undefined}
        >
          <div className={cn('box-border flex h-full flex-col overflow-hidden', float && 'rounded-card border border-border bg-sidebar')}>
            {children}
          </div>
        </SidebarPanelPart>
      </AdaptivePane>
      {/* One tooltip for every row: it names a collapsed rail's icons, and stays quiet while the titles show. */}
      <Tooltip controller={tooltip} disabled={!collapsed}>
        <TooltipContent<ReactNode> side="end">{(tip) => tip.payload}</TooltipContent>
      </Tooltip>
    </SidebarPanelContext.Provider>
  );
}

/* ── Layout parts ── */

/** The top of the sidebar: a workspace, a search, actions. It doesn't scroll. */
export function SidebarHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="sidebar-header" className={cn('flex shrink-0 flex-col gap-1 px-2 pt-3 pb-1.5', className)} {...props} />;
}

/** The scrolling middle: a `nav` landmark, named by `aria-label` (default "Sidebar"). */
export function SidebarContent({ className, 'aria-label': label = 'Sidebar', ...props }: ComponentProps<'nav'>) {
  return (
    <nav data-slot="sidebar-content" aria-label={label}
      className={cn('bl-scroll flex min-h-0 flex-1 flex-col gap-px overflow-x-hidden overflow-y-auto px-2 pb-2', className)} {...props} />
  );
}

/** The bottom of the sidebar, over a hairline: an account, settings. It doesn't scroll. */
export function SidebarFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="sidebar-footer" className={cn('flex shrink-0 flex-col gap-px border-t border-border p-2', className)} {...props} />;
}

/** The main column beside the sidebar. */
export function SidebarInset({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="sidebar-inset" className={cn('flex min-w-0 flex-1 flex-col overflow-hidden', className)} {...props} />;
}

/* ── Rows ── */

/** A leading glyph: an `Icon` name, or any node. */
type RowIcon = IconName | (string & {}) | ReactNode;
function RowGlyph({ icon }: { icon: RowIcon }) {
  return (
    <span data-slot="sidebar-icon" aria-hidden="true" className="grid size-4 shrink-0 place-items-center">
      {typeof icon === 'string' ? <Icon name={icon} size={16} /> : icon}
    </span>
  );
}

/** A sidebar row, the shape items and the search share: 32px (44px in a compact provider), its 16px icon on the same
 *  line as a collapsed rail's, so the rail is the same rows cut short. */
export const sidebarItemVariants = cva(
  [
    'relative flex w-full min-w-0 shrink-0 cursor-pointer items-center gap-2.5 overflow-hidden rounded-lg border-0 bg-transparent px-2.5 py-1.5 text-start font-sans select-none',
    'outline-none transition-colors duration-150 hover:bg-secondary active:bg-secondary-strong',
    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
    'data-disabled:cursor-default data-disabled:opacity-40 data-disabled:hover:bg-transparent',
  ],
  {
    variants: {
      /** The row for the page that shows: a filled row, its icon in the accent colour. */
      current: { true: 'bg-secondary-strong font-medium [&_[data-slot=sidebar-icon]]:text-primary', false: '' },
      /** Phone-sized rows in a compact provider. */
      compact: { true: 'min-h-11 text-subhead', false: 'min-h-8 text-footnote' },
      /** A caller's colour (`tint`) on the title and the icon. */
      tinted: { true: 'font-semibold text-(color:--sidebar-tint) [&_[data-slot=sidebar-icon]]:text-(color:--sidebar-tint)', false: '' },
    },
    compoundVariants: [
      { tinted: false, current: false, className: 'text-muted-foreground hover:text-foreground' },
      { tinted: false, current: true, className: 'text-foreground' },
    ],
    defaultVariants: { current: false, compact: false, tinted: false },
  },
);

/** A row's press target: UI SDK's Button, and inside a Sidebar a trigger of its shared tooltip. */
function RowButton({ tip, ...props }: ComponentProps<typeof SdkButton> & { tip: ReactNode }) {
  const panel = useContext(SidebarPanelContext);
  if (!panel) return <SdkButton {...props} />;
  return <TooltipTrigger controller={panel.tooltip} payload={tip} render={<SdkButton {...props} />} />;
}

export interface SidebarItemProps extends Omit<ComponentProps<typeof SdkButton>, 'title' | 'children' | 'style'> {
  style?: CSSProperties;
  /** The leading glyph: an `Icon` name (`"house"`, `"tray"`) or any node (an Avatar). */
  icon?: RowIcon;
  /** The row's text, which names it. In a collapsed rail it shows in a tooltip. */
  title: ReactNode;
  /** A second, smaller line under the title. */
  description?: ReactNode;
  /** After the title: a number or a string is drawn as a count badge, anything else as it is. */
  trailing?: ReactNode;
  /** The row for the page that shows (`aria-current="page"`). */
  current?: boolean;
  /** A CSS colour for the title and the icon (an action row such as "New task"). */
  tint?: string;
}

/** A navigation row. `onClick(event, details)` is UI SDK Button's; `render={<a href="…" />}` makes it a link. In a
 *  drawer a press also closes the drawer, unless `onClick` calls `event.preventDefault()`. */
export function SidebarItem({ icon, title, description, trailing, current = false, tint, onClick, className, style, ...props }: SidebarItemProps) {
  const panel = useContext(SidebarPanelContext);
  return (
    <RowButton
      tip={title}
      data-sidebar-item=""
      aria-current={current ? 'page' : undefined}
      className={cx(sidebarItemVariants({ current, compact: panel?.compact ?? false, tinted: !!tint }), className)}
      // The caller's tint colour, read by the `tinted` classes.
      style={tint ? { ...style, '--sidebar-tint': tint } as CSSProperties : style}
      onClick={(event, details) => {
        const result = onClick?.(event, details);
        if (!event.defaultPrevented) panel?.dismiss(event.nativeEvent);
        return result;
      }}
      {...props}
    >
      {icon != null ? <RowGlyph icon={icon} /> : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate">{title}</span>
        {description != null ? <span className="block truncate text-caption font-normal text-muted-foreground">{description}</span> : null}
      </span>
      {trailing == null ? null : typeof trailing === 'number' || typeof trailing === 'string'
        ? <Badge size="sm" variant="tinted" className="shrink-0 tabular-nums">{trailing}</Badge>
        : <span className="flex shrink-0 items-center">{trailing}</span>}
    </RowButton>
  );
}

export interface SidebarSearchProps extends Omit<ComponentProps<typeof SdkButton>, 'children'> {
  /** The button's text, which names it. Default "Search". */
  placeholder?: string;
  /** A key that presses it from anywhere (UI SDK's shortcut syntax: `"/"`, `"mod+k"`), shown as a keycap. */
  shortcut?: string;
}

/** A button shaped like a search field that opens your search (a CommandMenu, a Dialog), with its shortcut. In a
 *  collapsed rail, the magnifier alone. */
export function SidebarSearch({ placeholder = 'Search', shortcut, className, ...props }: SidebarSearchProps) {
  const panel = useContext(SidebarPanelContext);
  const ref = useRef<HTMLButtonElement>(null);
  const keyshortcuts = useKeyshortcuts(shortcut);
  useShortcut(shortcut, () => { ref.current?.click(); });
  return (
    <RowButton
      tip={placeholder}
      ref={ref}
      data-sidebar-search=""
      aria-keyshortcuts={keyshortcuts}
      className={cx(
        cn(sidebarItemVariants({ compact: panel?.compact ?? false }), 'mb-1 bg-secondary hover:bg-secondary-strong'),
        className,
      )}
      {...props}
    >
      <RowGlyph icon="magnifyingglass" />
      <span className="min-w-0 flex-1 truncate">{placeholder}</span>
      {/* The keys are the button's `aria-keyshortcuts`: the keycap is for the eye. */}
      {shortcut ? <Kbd keys={shortcut} aria-hidden="true" className="shrink-0 bg-background" /> : null}
    </RowButton>
  );
}

export interface SidebarSectionProps extends Omit<ComponentProps<'div'>, 'title'> {
  /** The group's label, which names it. In a collapsed rail it turns into a hairline. */
  title?: ReactNode;
}

/** A labelled group of rows (`role="group"`). */
export function SidebarSection({ title, className, children, ...props }: SidebarSectionProps) {
  const collapsed = useSidebarCollapsed();
  const titleId = useId();
  return (
    <div data-slot="sidebar-section" role="group" aria-labelledby={title != null ? titleId : undefined}
      className={cn('flex flex-col gap-px', className)} {...props}>
      {title != null ? (
        <div id={titleId} data-slot="sidebar-section-title"
          className={cn(
            sectionLabelVariants({ variant: 'sidebar' }),
            'relative truncate px-2.5 pt-3 pb-1 transition-colors duration-200',
            // Collapsed, the label stays (it names the group) but shows as a short hairline.
            collapsed && "text-transparent after:absolute after:inset-x-2 after:bottom-2.5 after:h-px after:bg-border after:content-['']",
          )}>
          {title}
        </div>
      ) : null}
      {children}
    </div>
  );
}

export interface SidebarAccountProps extends Omit<ComponentProps<'div'>, 'title'> {
  /** The account's, team's or app's name. */
  title: ReactNode;
  /** A second line: a plan, a branch. */
  description?: ReactNode;
  /** The tile (28px, 32px in a compact provider): a logo, an Avatar. Default the title's first letter on the brand
   *  gradient. */
  icon?: ReactNode;
}

/** Who or where this is (the account, team or app the sidebar belongs to): a tile, a name and a second line. In a
 *  collapsed rail, the tile alone. In a compact provider it grows with the rows under it, so the drawer's heading is
 *  never smaller than its rows. */
export function SidebarAccount({ title, description, icon, className, ...props }: SidebarAccountProps) {
  const compact = useContext(SidebarPanelContext)?.compact ?? false;
  return (
    <div data-slot="sidebar-account" className={cn('flex min-w-0 shrink-0 items-center overflow-hidden px-1 py-0.5', compact ? 'gap-2.5' : 'gap-2', className)} {...props}>
      {icon ?? (
        <span aria-hidden="true" className={cn(brandTile, 'grid shrink-0 place-items-center rounded-lg font-bold text-primary-foreground', compact ? 'size-8 text-subhead' : 'size-7 text-footnote')}>
          {typeof title === 'string' ? title.slice(0, 1).toUpperCase() : null}
        </span>
      )}
      <div className="min-w-0 flex-1 leading-tight whitespace-nowrap">
        <div className={cn('truncate font-semibold text-foreground', compact ? 'text-subhead' : 'text-footnote')}>{title}</div>
        {description != null ? <div className={cn('truncate text-muted-foreground', compact ? 'text-footnote' : 'text-caption')}>{description}</div> : null}
      </div>
    </div>
  );
}

/* ── Trigger ── */

export interface SidebarTriggerProps extends PartProps<'button'> {
  /** A key that toggles the sidebar from anywhere (UI SDK's shortcut syntax, such as `"mod+b"`). */
  shortcut?: string;
}

/** The sidebar button: toggles the sidebar in whichever presentation shows (opens the drawer, collapses the rail). */
export function SidebarTrigger({ className, shortcut, 'aria-label': label = 'Toggle sidebar', children, ...props }: SidebarTriggerProps) {
  const { toggle, compact } = useSidebar();
  const keyshortcuts = useKeyshortcuts(shortcut);
  useShortcut(shortcut, (event) => { toggle({ reason: 'shortcut', event }); });
  return (
    <SidebarTriggerPart
      type="button"
      aria-label={label}
      aria-keyshortcuts={keyshortcuts}
      className={cx(
        cn(
          'grid shrink-0 cursor-pointer place-items-center rounded-lg border-0 bg-transparent p-0 text-muted-foreground transition-colors duration-150',
          'outline-none hover:bg-secondary hover:text-foreground active:bg-secondary-strong focus-visible:ring-2 focus-visible:ring-ring',
          compact ? 'size-11' : 'size-8',
        ),
        className,
      )}
      {...props}
    >
      {children ?? <Icon name="sidebar-left" size={18} />}
    </SidebarTriggerPart>
  );
}

/** `aria-keyshortcuts` for a UI SDK shortcut, formatted for the platform after hydration (undefined without one). */
function useKeyshortcuts(shortcut: string | undefined) {
  const hint = useShortcutHint(shortcut || 'a');
  return shortcut ? hint.ariaKeyshortcuts : undefined;
}
