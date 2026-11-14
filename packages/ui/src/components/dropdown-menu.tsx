'use client';
import { createContext, useContext, type ComponentProps, type ReactNode } from 'react';
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuItemIcon,
  MenuItemIndicator,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuShortcut,
  MenuSub,
  MenuSubTrigger,
  MenuTrigger,
  type MenuData,
  type MenuDataItem,
  type MenuProps,
  type MenuSubProps,
} from '@ui-sdk/react/menu';
import { cva } from 'class-variance-authority';
import { Icon } from '@/lib/icon';
import { popoverMotion, popoverSurface } from '@/lib/primitives';
import { scopeStyle, useLayerHost, useThemeScopeProps } from '@/lib/theme';
import { usePresentation } from '@/lib/container';
import { cx } from '@/lib/utils';

/* ══ DropdownMenu — UI SDK's Menu, drawn as an iOS pull-down menu ══
   17px rows, trailing icons, thick bands between groups, a leading checkmark on checkbox and radio items. UI SDK owns
   the behavior: arrow keys, typeahead, Esc, focus return, submenus that open to the side, `presentation="auto"` for
   a sheet on small touch screens.
   <DropdownMenu onAction={(value) => run(value)}>
     <DropdownMenuTrigger className={buttonVariants({ variant: 'secondary' })}>Actions</DropdownMenuTrigger>
     <DropdownMenuContent>
       <DropdownMenuItem value="share" icon={<Icon name="mail" />}>Share</DropdownMenuItem>
       <DropdownMenuSeparator />
       <DropdownMenuItem value="delete" destructive>Delete</DropdownMenuItem>
     </DropdownMenuContent>
   </DropdownMenu>
   A menu can also be data: `<DropdownMenu items={[…]}>` with an empty `<DropdownMenuContent />` draws the same
   rows, and runs the items' shortcuts while it is closed. ══ */

/** The data of the menu around a content part, so an empty content can draw it. */
const ItemsContext = createContext<MenuData | undefined>(undefined);

export type DropdownMenuProps = MenuProps;

/** Never rendered. Its child tells UI SDK's root, which looks through its markup for a content part, that one is
    placed: ours, which draws the data. Otherwise a data menu that starts open mounts UI SDK's bare content beside
    ours for one commit, and the rows that mounted twice lose their keyboard wiring. */
const PlacedContent: (props: { children: ReactNode }) => null = () => null;

export function DropdownMenu({ items, container, presentation, children, ...props }: DropdownMenuProps) {
  const host = useLayerHost();
  // "auto" follows the nearest size class around (a sheet when compact), even when the content is portaled.
  const shown = usePresentation(presentation, 'popover');
  return (
    <ItemsContext.Provider value={items}>
      <Menu items={items} container={container === undefined ? host : container} presentation={shown} {...props}>
        {children}
        {items ? <PlacedContent><MenuContent /></PlacedContent> : null}
      </Menu>
    </ItemsContext.Provider>
  );
}

/** The button that opens the menu. It has no look of its own: `render` one of ours, `render={<Button … />}`. */
export const DropdownMenuTrigger = MenuTrigger;
export type DropdownMenuTriggerProps = ComponentProps<typeof MenuTrigger>;

/** The floating surface of a menu. As a sheet it is shaped like the kit's bottom Sheet: the full width of its host,
    square at the bottom edge. Its `--sheet-backdrop` only dims the page when the menu is in the top layer: in a layer
    host (BLProvider is one) a menu sheet has no scrim behind it, unlike the kit's Sheet. */
const content = [
  popoverSurface,
  popoverMotion,
  'bl-scroll box-border min-w-[230px] overflow-y-auto py-1',
  'data-[presentation=sheet]:max-h-[calc(100%-48px)] data-[presentation=sheet]:w-full data-[presentation=sheet]:min-w-0 data-[presentation=sheet]:rounded-t-card data-[presentation=sheet]:rounded-b-none data-[presentation=sheet]:pb-[max(16px,env(safe-area-inset-bottom))] data-[presentation=sheet]:[--sheet-backdrop:var(--overlay,color-mix(in_oklab,black_40%,transparent))]',
];

export type DropdownMenuContentProps = ComponentProps<typeof MenuContent>;

/** The menu. It hangs 8px under its trigger, as wide as its rows need (230px at least), and scrolls when it is taller
 *  than the room it has. It renders into BLProvider's root (see `useLayerHost`) and wears the ThemeScope it was opened
 *  from. Without children it draws the `items` of its `DropdownMenu`. */
export function DropdownMenuContent({ className, style, sideOffset = 8, children, ...props }: DropdownMenuContentProps) {
  const items = useContext(ItemsContext);
  const scope = useThemeScopeProps();
  return (
    <MenuContent
      data-theme-scope={scope['data-theme-scope']}
      sideOffset={sideOffset}
      className={cx([content, scope.className], className)}
      style={scopeStyle(scope.style, style)}
      {...props}
    >
      {children ?? (items ? <DropdownMenuItems items={items} /> : null)}
    </MenuContent>
  );
}

export const dropdownMenuItemVariants = cva([
  'bl-btn relative box-border flex min-h-11 cursor-pointer items-center gap-3 py-[11px] pr-4 pl-4 text-body leading-[22px] text-foreground outline-none',
  'data-highlighted:bg-accent data-highlighted:not-data-disabled:active:bg-secondary-strong data-open:bg-accent data-disabled:cursor-default data-disabled:opacity-40 data-destructive:text-destructive data-pending:cursor-progress',
  // The shortcut UI SDK draws from `shortcut`: before the trailing icon, in the look of DropdownMenuShortcut.
  '*:data-[slot=menu-shortcut]:shrink-0 *:data-[slot=menu-shortcut]:text-subhead *:data-[slot=menu-shortcut]:tracking-[.08em] *:data-[slot=menu-shortcut]:text-muted-foreground',
  // Hairline between rows — not under the last row, nor above a group band.
  'after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border last:after:hidden [&:has(+[data-slot=menu-separator])]:after:hidden',
]);

/** What our rows add to a UI SDK menu item. */
interface RowProps {
  /** Trailing SF-style icon. Screen readers and typeahead skip it. */
  icon?: ReactNode;
  /** Secondary line under the label. */
  description?: ReactNode;
  children?: ReactNode;
}

/** A row's own text is its label: typeahead should not read the description after it. */
const labelOf = (label: string | undefined, children: ReactNode) => label ?? (typeof children === 'string' ? children : undefined);

function RowText({ description, children }: Pick<RowProps, 'description' | 'children'>) {
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate">{children}</span>
      {description ? <span className="truncate text-footnote leading-[18px] text-muted-foreground">{description}</span> : null}
    </span>
  );
}

/** The trailing icon: after the shortcut, which UI SDK appends to the row. */
function RowIcon({ children }: { children: ReactNode }) {
  return <MenuItemIcon className="order-1 grid size-[22px] shrink-0 place-items-center">{children}</MenuItemIcon>;
}

/** The leading checkmark of a checkbox or radio item. Its column is kept while the item is off, so labels line up. */
function RowCheck() {
  return (
    <span className="-mr-1 grid w-[18px] shrink-0 place-items-center">
      <MenuItemIndicator><Icon name="check" size={18} sw={2.4} /></MenuItemIndicator>
    </span>
  );
}

export type DropdownMenuItemProps = Omit<ComponentProps<typeof MenuItem>, 'children'> & RowProps;

/** An action. `value` goes to the menu's `onAction`, `onSelect` runs on the item itself; `shortcut="mod+r"` shows the
 *  keys for the platform, `destructive` tints the row, and `render={<a href="…" />}` makes it a link. */
export function DropdownMenuItem({ className, icon, description, label, children, ...props }: DropdownMenuItemProps) {
  return (
    <MenuItem label={labelOf(label, children)} className={cx(dropdownMenuItemVariants(), className)} {...props}>
      <RowText description={description}>{children}</RowText>
      {icon ? <RowIcon>{icon}</RowIcon> : null}
    </MenuItem>
  );
}

export type DropdownMenuCheckboxItemProps = Omit<ComponentProps<typeof MenuCheckboxItem>, 'children'> & RowProps;

/** An item that turns an option on and off: `checked` / `defaultChecked` / `onCheckedChange`. The menu stays open. */
export function DropdownMenuCheckboxItem({ className, icon, description, label, children, ...props }: DropdownMenuCheckboxItemProps) {
  return (
    <MenuCheckboxItem label={labelOf(label, children)} className={cx(dropdownMenuItemVariants(), className)} {...props}>
      <RowCheck />
      <RowText description={description}>{children}</RowText>
      {icon ? <RowIcon>{icon}</RowIcon> : null}
    </MenuCheckboxItem>
  );
}

/** Radio items that share one `value` / `defaultValue` / `onValueChange`. A `DropdownMenuGroupLabel` inside names it. */
export const DropdownMenuRadioGroup = MenuRadioGroup;
export type DropdownMenuRadioGroupProps = ComponentProps<typeof MenuRadioGroup>;

export type DropdownMenuRadioItemProps = Omit<ComponentProps<typeof MenuRadioItem>, 'children'> & RowProps;

/** One choice of a `DropdownMenuRadioGroup`. The menu stays open unless `closeOnSelect`. */
export function DropdownMenuRadioItem({ className, icon, description, label, children, ...props }: DropdownMenuRadioItemProps) {
  return (
    <MenuRadioItem label={labelOf(label, children)} className={cx(dropdownMenuItemVariants(), className)} {...props}>
      <RowCheck />
      <RowText description={description}>{children}</RowText>
      {icon ? <RowIcon>{icon}</RowIcon> : null}
    </MenuRadioItem>
  );
}

/** A group of rows, named by its `DropdownMenuGroupLabel`. */
export const DropdownMenuGroup = MenuGroup;
export type DropdownMenuGroupProps = ComponentProps<typeof MenuGroup>;

/** The small header of a group or a radio group. */
export function DropdownMenuGroupLabel({ className, ...props }: ComponentProps<typeof MenuGroupLabel>) {
  return <MenuGroupLabel className={cx('px-4 pt-2 pb-1.5 text-footnote leading-[18px] text-muted-foreground', className)} {...props} />;
}

/** iOS menu group break: a thick band, not a hairline. */
export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof MenuSeparator>) {
  return <MenuSeparator className={cx('m-0 h-2 border-0 bg-secondary', className)} {...props} />;
}

/** A shortcut hint placed by hand. An item's `shortcut` prop draws the same thing from keys like `mod+r`. */
export function DropdownMenuShortcut({ className, ...props }: ComponentProps<typeof MenuShortcut>) {
  return <MenuShortcut className={cx('shrink-0 text-subhead tracking-[.08em] text-muted-foreground', className)} {...props} />;
}

/** A submenu: a `DropdownMenuSubTrigger` and a `DropdownMenuSubContent`, inside a menu's content. */
export const DropdownMenuSub = MenuSub;
export type DropdownMenuSubProps = MenuSubProps;

export type DropdownMenuSubTriggerProps = Omit<ComponentProps<typeof MenuSubTrigger>, 'children'> & Omit<RowProps, 'icon'>;

/** The row that opens its submenu: a chevron where an item has its icon. */
export function DropdownMenuSubTrigger({ className, description, children, ...props }: DropdownMenuSubTriggerProps) {
  return (
    <MenuSubTrigger className={cx(dropdownMenuItemVariants(), className)} {...props}>
      <RowText description={description}>{children}</RowText>
      <Icon name="chev" size={17} sw={2.2} className="shrink-0 text-muted-foreground rtl:-scale-x-100" />
    </MenuSubTrigger>
  );
}

/** A submenu's popup: beside its row, overlapping it by 6px. */
export function DropdownMenuSubContent({ sideOffset = -6, ...props }: DropdownMenuContentProps) {
  return <DropdownMenuContent sideOffset={sideOffset} {...props} />;
}

/** Draws a data menu's entries with the rows above: what an empty `DropdownMenuContent` renders. */
export function DropdownMenuItems({ items }: { items: MenuData }) {
  return items.map((entry, index) => {
    const item: MenuDataItem = typeof entry === 'string' ? { value: entry, label: entry } : entry;
    switch (item.type) {
      case 'separator':
        return <DropdownMenuSeparator key={`separator-${index}`} />;
      case 'group':
        return (
          <DropdownMenuGroup key={`group-${index}`}>
            {item.label ? <DropdownMenuGroupLabel>{item.label}</DropdownMenuGroupLabel> : null}
            <DropdownMenuItems items={item.items} />
          </DropdownMenuGroup>
        );
      case 'checkbox':
        return (
          <DropdownMenuCheckboxItem
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            checked={item.checked}
            defaultChecked={item.defaultChecked}
            closeOnSelect={item.closeOnSelect}
          >
            {item.label}
          </DropdownMenuCheckboxItem>
        );
      case 'radio-group':
        return (
          <DropdownMenuRadioGroup key={item.name} name={item.name} value={item.value} defaultValue={item.defaultValue}>
            {item.label ? <DropdownMenuGroupLabel>{item.label}</DropdownMenuGroupLabel> : null}
            {item.items.map((radio) => (
              <DropdownMenuRadioItem key={radio.value} value={radio.value} disabled={radio.disabled}>{radio.label}</DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        );
      case 'submenu':
        return (
          <DropdownMenuSub key={`submenu-${index}`}>
            <DropdownMenuSubTrigger disabled={item.disabled}>{item.label}</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItems items={item.items} />
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        );
      default:
        return (
          <DropdownMenuItem
            key={item.value}
            value={item.value}
            disabled={item.disabled}
            shortcut={item.shortcut}
            closeOnSelect={item.closeOnSelect}
            destructive={item.destructive}
          >
            {item.label}
          </DropdownMenuItem>
        );
    }
  });
}

export { createMenuController } from '@ui-sdk/react/menu';
export type { MenuController, MenuData, MenuDataItem } from '@ui-sdk/react/menu';
