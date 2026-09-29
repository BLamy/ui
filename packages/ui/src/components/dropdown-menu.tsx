import type { ComponentProps, ReactNode } from 'react';
import {
  Collection,
  Header,
  Menu, type MenuProps,
  MenuItem, type MenuItemProps,
  MenuSection, type MenuSectionProps,
  MenuTrigger, type MenuTriggerProps,
  PopoverContext,
  Separator, type SeparatorProps,
  SubmenuTrigger, type SubmenuTriggerProps,
  composeRenderProps,
  useSlottedContext,
} from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { Haptics } from '../lib/haptics';
import { Icon } from '../lib/icon';
import { cn } from '../lib/utils';
import { Popover, type PopoverProps } from './popover';

/* ══ DropdownMenu — react-aria's MenuTrigger / Menu / MenuItem / MenuSection / SubmenuTrigger, drawn as an
   iOS pull-down menu: 17px rows, trailing icons, thick gaps between sections, checkmarks on the leading edge
   for selectable items. Arrow keys / typeahead / Esc / focus return from react-aria.
   <DropdownMenu>
     <Button>…</Button>
     <DropdownMenuContent>
       <DropdownMenuItem icon={<Icon name="mail" />}>Share</DropdownMenuItem>
       <DropdownMenuSeparator />
       <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
     </DropdownMenuContent>
   </DropdownMenu> ══ */

export function DropdownMenu(props: MenuTriggerProps) {
  return <MenuTrigger {...props} />;
}

export interface DropdownMenuContentProps<T> extends MenuProps<T> {
  placement?: PopoverProps['placement'];
  popoverClassName?: string;
}

export function DropdownMenuContent<T extends object>({
  className, placement, popoverClassName, onAction, onSelectionChange, ...props
}: DropdownMenuContentProps<T>) {
  // Placement comes from react-aria (bottom start for a menu, end top for a submenu); submenus overlap their row.
  const isSubmenu = useSlottedContext(PopoverContext)?.trigger === 'SubmenuTrigger';
  const selects = props.selectionMode != null && props.selectionMode !== 'none';
  return (
    <Popover data-slot="dropdown-menu" placement={placement} offset={isSubmenu ? -6 : 8} className={cn('min-w-[230px]', popoverClassName)}>
      <Menu<T>
        data-slot="dropdown-menu-content"
        // A selectable item is a selection (tick), anything else a confirmation (light impact) — never both.
        onAction={(...args) => { if (!selects) Haptics.impact('light'); onAction?.(...args); }}
        onSelectionChange={(keys) => { Haptics.selection(); onSelectionChange?.(keys); }}
        className={cn('bl-scroll box-border max-h-[inherit] overflow-y-auto py-1 outline-none', className)}
        {...props}
      />
    </Popover>
  );
}

export const dropdownMenuItemVariants = cva(
  [
    'bl-btn relative box-border flex min-h-11 cursor-pointer items-center gap-3 py-[11px] pr-4 pl-4 text-[17px] leading-[22px] outline-none',
    'data-focused:bg-accent data-pressed:bg-secondary-strong data-open:bg-accent data-disabled:cursor-default data-disabled:opacity-40',
    // Hairline between rows — not under the last row, nor above a section band.
    'after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border last:after:hidden [&:has(+[role=separator])]:after:hidden',
  ],
  {
    variants: {
      variant: {
        default: 'text-foreground',
        destructive: 'text-destructive',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface DropdownMenuItemProps<T> extends MenuItemProps<T>, VariantProps<typeof dropdownMenuItemVariants> {
  /** Trailing SF-style icon. */
  icon?: ReactNode;
  /** Secondary line under the label. */
  description?: ReactNode;
  /** Trailing keyboard shortcut (use <Kbd> or <DropdownMenuShortcut>). */
  shortcut?: ReactNode;
}

export function DropdownMenuItem<T extends object>({
  className, variant, icon, description, shortcut, children, textValue, ...props
}: DropdownMenuItemProps<T>) {
  return (
    <MenuItem<T>
      data-slot="dropdown-menu-item"
      textValue={textValue ?? (typeof children === 'string' ? children : undefined)}
      className={composeRenderProps(className, (cls) => cn(dropdownMenuItemVariants({ variant }), cls))}
      {...props}
    >
      {composeRenderProps(children, (kids, { selectionMode, isSelected, hasSubmenu }) => (
        <>
          {selectionMode !== 'none' ? (
            <span className="-mr-1 grid w-[18px] shrink-0 place-items-center">
              {isSelected ? <Icon name="check" size={18} sw={2.4} /> : null}
            </span>
          ) : null}
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate">{kids}</span>
            {description ? <span className="truncate text-[13px] leading-[18px] text-muted-foreground">{description}</span> : null}
          </span>
          {shortcut ? <span className="shrink-0">{shortcut}</span> : null}
          {hasSubmenu ? (
            <Icon name="chev" size={17} sw={2.2} className="shrink-0 text-muted-foreground" />
          ) : icon ? (
            <span className="grid size-[22px] shrink-0 place-items-center">{icon}</span>
          ) : null}
        </>
      ))}
    </MenuItem>
  );
}

export interface DropdownMenuSectionProps<T> extends MenuSectionProps<T> {
  title?: ReactNode;
}

export function DropdownMenuSection<T extends object>({ className, title, children, items, ...props }: DropdownMenuSectionProps<T>) {
  return (
    <MenuSection<T> data-slot="dropdown-menu-section" className={cn('group/section', className)} {...props}>
      {title ? <DropdownMenuLabel>{title}</DropdownMenuLabel> : null}
      <Collection items={items}>{children}</Collection>
    </MenuSection>
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof Header>) {
  return (
    <Header
      data-slot="dropdown-menu-label"
      className={cn('px-4 pt-2 pb-1.5 text-[13px] leading-[18px] text-muted-foreground', className)}
      {...props}
    />
  );
}

/** iOS menu group break: a thick band, not a hairline. */
export function DropdownMenuSeparator({ className, ...props }: SeparatorProps) {
  return <Separator data-slot="dropdown-menu-separator" className={cn('m-0 h-2 border-0 bg-secondary', className)} {...props} />;
}

export function DropdownMenuShortcut({ className, ...props }: ComponentProps<'span'>) {
  return <span data-slot="dropdown-menu-shortcut" className={cn('text-[15px] tracking-[.08em] text-muted-foreground', className)} {...props} />;
}

/** Wrap a DropdownMenuItem and a nested DropdownMenuContent to make a submenu. */
export function DropdownMenuSub(props: SubmenuTriggerProps) {
  return <SubmenuTrigger {...props} />;
}
