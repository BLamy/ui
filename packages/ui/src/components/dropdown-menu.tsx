'use client';
import {
  createContext, useContext, useId, useRef,
  type ComponentProps, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject,
} from 'react';
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuContextTrigger,
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
  createMenuController,
  type MenuController,
  type MenuDataItem,
  type MenuProps,
  type MenuSubProps,
} from '@ui-sdk/react/menu';
import { cva, type VariantProps } from 'class-variance-authority';
import { Icon } from '@/lib/icon';
import { popoverMotion, popoverSheet, popoverSurface, sectionLabelVariants } from '@/lib/primitives';
import { formatShortcutText, isGlyphShortcut, shortcutText } from '@/lib/shortcut-text';
import { scopeStyle, useLayerHost, useThemeScopeProps } from '@/lib/theme';
import { useTriggerPalette, type PopupPalette } from '@/lib/trigger-palette';
import { usePresentation } from '@/lib/container';
import { cn, cx } from '@/lib/utils';

/* ══ DropdownMenu — UI SDK's Menu, drawn as an iOS pull-down menu ══
   17px rows, trailing icons, thick bands between groups, a leading checkmark on checkbox and radio items; `size="sm"`
   on the content is the dense desktop menu (13px rows, hairlines). UI SDK owns the behavior: arrow keys, typeahead,
   Esc, focus return, submenus that open to the side, `presentation="auto"` for a sheet on small touch screens.
   <DropdownMenu onAction={(value) => run(value)}>
     <DropdownMenuTrigger render={<Button variant="secondary" />}>Actions</DropdownMenuTrigger>
     <DropdownMenuContent>
       <DropdownMenuItem value="share" icon={<Icon name="mail" />}>Share</DropdownMenuItem>
       <DropdownMenuSeparator />
       <DropdownMenuItem value="delete" destructive>Delete</DropdownMenuItem>
     </DropdownMenuContent>
   </DropdownMenu>
   The same menu opens where you right-click with a DropdownMenuContextTrigger in place of the trigger: the area opens
   it at the pointer on a right-click or a long press, and at the focused element on the menu key or Shift+F10.
   A menu can also be data: `<DropdownMenu items={[…]}>` with an empty `<DropdownMenuContent />` draws the same
   rows, and runs the items' shortcuts while it is closed. ══ */

/* ── Data ── */

/** What the kit's rows add to an entry of a data menu. */
interface DataRow {
  /** Trailing icon. */
  icon?: ReactNode;
  /** Secondary line under the label. */
  description?: ReactNode;
}

/** One entry of a data menu: UI SDK's `MenuDataItem`, whose items and checkbox items also take the kit's `icon` and
    `description`. */
export type DropdownMenuDataItem =
  | (Extract<MenuDataItem, { type?: 'item' }> & DataRow)
  | Extract<MenuDataItem, { type: 'separator' }>
  | { type: 'group'; label?: string; items: DropdownMenuData }
  | (Extract<MenuDataItem, { type: 'checkbox' }> & DataRow)
  | Extract<MenuDataItem, { type: 'radio-group' }>
  | { type: 'submenu'; label: string; items: DropdownMenuData; disabled?: boolean; description?: ReactNode };

/** A menu as data: entries, or plain strings (a string is an item whose value and label are that text). */
export type DropdownMenuData = (DropdownMenuDataItem | string)[];

/** The data of the menu around a content part, so an empty content can draw it. */
const ItemsContext = createContext<DropdownMenuData | undefined>(undefined);

/* ── Root ── */

/** What had focus when a context trigger opened the menu, and which area recorded it. */
interface Opener {
  area: Element;
  focus: HTMLElement | null;
}
const OpenerContext = createContext<RefObject<Opener | null> | null>(null);

export type DropdownMenuProps = Omit<MenuProps, 'items'> & {
  /** The menu as data, drawn by an empty `DropdownMenuContent`; its items' shortcuts run while it is closed. */
  items?: DropdownMenuData;
};

/** Never rendered. Its child tells UI SDK's root, which looks through its markup for a content part, that one is
    placed: ours, which draws the data. Otherwise a data menu that starts open mounts UI SDK's bare content beside
    ours for one commit, and the rows that mounted twice lose their keyboard wiring. */
const PlacedContent: (props: { children: ReactNode }) => null = () => null;

export function DropdownMenu({ items, container, presentation, onOpenChange, children, ...props }: DropdownMenuProps) {
  const host = useLayerHost();
  const opener = useRef<Opener | null>(null);
  // "auto" follows the nearest size class around (a sheet when compact), even when the content is portaled.
  const shown = usePresentation(presentation, 'popover');
  return (
    <OpenerContext.Provider value={opener}>
      <ItemsContext.Provider value={items}>
        <Menu
          items={items as MenuProps['items']}
          container={container === undefined ? host : container}
          presentation={shown}
          onOpenChange={(open, details) => {
            // Only a context trigger's own gesture keeps its opener: a menu opened by a button or a controller
            // gives focus back the way UI SDK does (to its trigger).
            const target = details.event?.target;
            if (open && !(target instanceof Node && opener.current?.area.contains(target))) opener.current = null;
            onOpenChange?.(open, details);
          }}
          {...props}
        >
          {children}
          {items ? <PlacedContent><MenuContent /></PlacedContent> : null}
        </Menu>
      </ItemsContext.Provider>
    </OpenerContext.Provider>
  );
}

/** The button that opens the menu. It has no look of its own: `render` one of ours, `render={<Button … />}`. */
export const DropdownMenuTrigger = MenuTrigger;
export type DropdownMenuTriggerProps = ComponentProps<typeof MenuTrigger>;

export type DropdownMenuContextTriggerProps = ComponentProps<typeof MenuContextTrigger>;

/** An area that opens the menu where you right-click it (or long-press it on touch), and at the focused element on
    the menu key or Shift+F10: UI SDK's context trigger, a `div`. A right-click elsewhere in it moves the open menu
    there. `disabled` leaves the browser's own menu; `payload` reaches the content's state, for one menu shared by
    several areas. Give it `tabIndex={0}` when nothing inside it takes focus, so the keyboard can reach the menu.
    Closing a menu it opened gives focus back to what had it (the button the menu key was pressed on), else to the
    area. The menu has no trigger to take a name from: give its content an `aria-label`. */
export function DropdownMenuContextTrigger({ onKeyDown, onContextMenuCapture, onPointerDownCapture, ...props }: DropdownMenuContextTriggerProps) {
  const opener = useContext(OpenerContext);
  const record = (area: Element) => {
    if (!opener || props.disabled) return;
    const active = area.ownerDocument.activeElement;
    opener.current = { area, focus: active instanceof HTMLElement && active !== area.ownerDocument.body ? active : null };
  };
  return (
    <MenuContextTrigger
      onContextMenuCapture={(event: ReactMouseEvent<HTMLDivElement>) => {
        record(event.currentTarget);
        onContextMenuCapture?.(event);
      }}
      onPointerDownCapture={(event: ReactPointerEvent<HTMLDivElement>) => {
        // A long press opens the menu without a `contextmenu` event (iOS never fires one).
        if (event.pointerType === 'touch') record(event.currentTarget);
        onPointerDownCapture?.(event);
      }}
      onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(event);
        // UI SDK opens on the `contextmenu` event, which Windows and Linux fire for Shift+F10 but macOS doesn't: send
        // the same keyboard `contextmenu` (no pointer) to what has focus, so the key works everywhere.
        if (props.disabled || event.defaultPrevented || !event.shiftKey || event.key !== 'F10') return;
        event.preventDefault();
        event.target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true }));
      }}
      {...props}
    />
  );
}

/* ── Content ── */

/** Row density, set on the content and read by every row, label and separator inside it (submenus included). */
type MenuSize = 'sm' | 'default';
const SizeContext = createContext<MenuSize>('default');

/** The floating surface of a menu. As a sheet it is shaped like the kit's bottom Sheet, grabber included. */
export const dropdownMenuContentVariants = cva([popoverSurface, popoverMotion, popoverSheet, 'bl-scroll box-border overflow-y-auto py-1'], {
  variants: {
    size: {
      /** The iOS pull-down menu: 44px rows of body text, at least 230px wide. */
      default: 'min-w-[230px]',
      /** The dense desktop menu: 32px rounded rows of footnote text, at least 190px wide (a composer's option pills). */
      sm: 'min-w-[190px] px-1',
    },
  },
  defaultVariants: { size: 'default' },
});

export type DropdownMenuContentProps = ComponentProps<typeof MenuContent> & VariantProps<typeof dropdownMenuContentVariants> & {
  /** Where the colors come from: the ThemeScope it was opened from (`scope`, the default), or the trigger's
      element (`trigger`), for a trigger on a surface that CSS paints rather than a ThemeScope (see `useTriggerPalette`). */
  palette?: PopupPalette;
};

/** The menu. It hangs 8px under its trigger, as wide as its rows need, and scrolls when it is taller than the room
 *  it has. It renders into BLProvider's root (see `useLayerHost`) and wears the ThemeScope it was opened from (or its
 *  trigger's palette). Without children it draws the `items` of its `DropdownMenu`. Opened by a context trigger, it
 *  gives focus back to what had it when it opened, unless you pass `finalFocus`. */
export function DropdownMenuContent({
  className, style, size, palette = 'scope', sideOffset = 8, finalFocus, ref, children, ...props
}: DropdownMenuContentProps) {
  const items = useContext(ItemsContext);
  const opener = useContext(OpenerContext);
  const inherited = useContext(SizeContext);
  const density: MenuSize = size ?? inherited;
  const scope = useThemeScopeProps();
  const trigger = useTriggerPalette(palette === 'trigger', ref);
  const colors = trigger.props ?? scope;
  return (
    <SizeContext.Provider value={density}>
      <MenuContent
        ref={trigger.ref}
        data-theme-scope={colors['data-theme-scope']}
        data-size={density}
        sideOffset={sideOffset}
        finalFocus={finalFocus ?? (() => {
          const focus = opener?.current?.focus;
          return focus?.isConnected ? focus : null;
        })}
        className={cx([dropdownMenuContentVariants({ size: density }), colors.className], className)}
        style={scopeStyle(colors.style, style)}
        {...props}
      >
        {children ?? (items ? <DropdownMenuItems items={items} /> : null)}
      </MenuContent>
    </SizeContext.Provider>
  );
}

/* ── Rows ── */

export const dropdownMenuItemVariants = cva(
  [
    'bl-btn relative box-border flex cursor-pointer items-center text-foreground outline-none',
    'data-highlighted:bg-accent data-highlighted:not-data-disabled:active:bg-secondary-strong data-open:bg-accent data-disabled:cursor-default data-disabled:opacity-40 data-destructive:text-destructive data-pending:cursor-progress',
  ],
  {
    variants: {
      size: {
        default: [
          'min-h-11 gap-3 py-[11px] pr-4 pl-4 text-body leading-[22px]',
          // Hairline between rows — not under the last row, nor above a group band.
          'after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-border last:after:hidden [&:has(+[data-slot=menu-separator])]:after:hidden',
        ],
        sm: 'min-h-8 gap-2 rounded-lg px-2.5 py-1.5 text-footnote leading-[18px]',
      },
    },
    defaultVariants: { size: 'default' },
  },
);

/** What our rows add to a UI SDK menu item. */
interface RowProps {
  /** Trailing SF-style icon. Screen readers and typeahead skip it. */
  icon?: ReactNode;
  /** Secondary line under the label. Screen readers hear it as the row's description, not as part of its name. */
  description?: ReactNode;
  children?: ReactNode;
}

/** A row's own text is its label: typeahead should not read the description after it. */
const labelOf = (label: string | undefined, children: ReactNode) => label ?? (typeof children === 'string' ? children : undefined);

/** Ids that keep a row's description out of its accessible name: the row is labelled by its text and described by
    the second line. Nothing changes for a row without a description. */
function useRowText(description: ReactNode): { label?: string; description?: string; describe: { 'aria-labelledby'?: string; 'aria-describedby'?: string } } {
  const id = useId();
  if (description == null || description === false) return { describe: {} };
  return {
    label: `${id}-label`,
    description: `${id}-description`,
    describe: { 'aria-labelledby': `${id}-label`, 'aria-describedby': `${id}-description` },
  };
}

function RowText({ ids, description, children }: { ids: ReturnType<typeof useRowText> } & Pick<RowProps, 'description' | 'children'>) {
  const size = useContext(SizeContext);
  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span id={ids.label} className="truncate">{children}</span>
      {description ? (
        <span id={ids.description} className={cn('truncate text-muted-foreground', size === 'sm' ? 'text-caption leading-4' : 'text-footnote leading-[18px]')}>
          {description}
        </span>
      ) : null}
    </span>
  );
}

/** The trailing icon: after the shortcut. */
function RowIcon({ children }: { children: ReactNode }) {
  const size = useContext(SizeContext);
  return <MenuItemIcon className={cx('order-1 grid shrink-0 place-items-center', size === 'sm' ? 'size-4' : 'size-[22px]')}>{children}</MenuItemIcon>;
}

/** The leading checkmark of a checkbox or radio item. Its column is kept while the item is off, so labels line up. */
function RowCheck() {
  const size = useContext(SizeContext);
  return (
    <span className={cn('grid shrink-0 place-items-center', size === 'sm' ? 'w-3.5 text-primary' : '-mr-1 w-[18px]')}>
      <MenuItemIndicator>{size === 'sm' ? <Icon name="check" size={13} sw={2.6} /> : <Icon name="check" size={18} sw={2.4} />}</MenuItemIndicator>
    </span>
  );
}

/** An item's `shortcut`, in the kit's rendering. UI SDK draws its own from the same prop (and binds the keys); the
    row hides that one, so menus, tooltips and the command menu read the same (`⇧⌘S`, see `lib/shortcut-text`). */
function RowShortcut({ shortcut }: { shortcut?: string }) {
  return shortcut ? <DropdownMenuShortcut data-kit="">{formatShortcutText(shortcut)}</DropdownMenuShortcut> : null;
}
const hideSdkShortcut = '*:data-[slot=menu-shortcut]:not-data-kit:hidden';

export type DropdownMenuItemProps = Omit<ComponentProps<typeof MenuItem>, 'children'> & RowProps;

/** An action. `value` goes to the menu's `onAction`, `onSelect` runs on the item itself; `shortcut="mod+r"` shows the
 *  keys for the platform, `destructive` tints the row, and `render={<a href="…" />}` makes it a link. */
export function DropdownMenuItem({ className, icon, description, label, shortcut, children, ...props }: DropdownMenuItemProps) {
  const size = useContext(SizeContext);
  const ids = useRowText(description);
  return (
    <MenuItem
      label={labelOf(label, children)}
      shortcut={shortcut}
      className={cx([dropdownMenuItemVariants({ size }), hideSdkShortcut], className)}
      {...ids.describe}
      {...props}
    >
      <RowText ids={ids} description={description}>{children}</RowText>
      <RowShortcut shortcut={shortcut} />
      {icon ? <RowIcon>{icon}</RowIcon> : null}
    </MenuItem>
  );
}

export type DropdownMenuCheckboxItemProps = Omit<ComponentProps<typeof MenuCheckboxItem>, 'children'> & RowProps;

/** An item that turns an option on and off: `checked` / `defaultChecked` / `onCheckedChange`. The menu stays open. */
export function DropdownMenuCheckboxItem({ className, icon, description, label, children, ...props }: DropdownMenuCheckboxItemProps) {
  const size = useContext(SizeContext);
  const ids = useRowText(description);
  return (
    <MenuCheckboxItem label={labelOf(label, children)} className={cx(dropdownMenuItemVariants({ size }), className)} {...ids.describe} {...props}>
      <RowCheck />
      <RowText ids={ids} description={description}>{children}</RowText>
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
  const size = useContext(SizeContext);
  const ids = useRowText(description);
  return (
    <MenuRadioItem label={labelOf(label, children)} className={cx(dropdownMenuItemVariants({ size }), className)} {...ids.describe} {...props}>
      <RowCheck />
      <RowText ids={ids} description={description}>{children}</RowText>
      {icon ? <RowIcon>{icon}</RowIcon> : null}
    </MenuRadioItem>
  );
}

/** A group of rows, named by its `DropdownMenuGroupLabel`. */
export const DropdownMenuGroup = MenuGroup;
export type DropdownMenuGroupProps = ComponentProps<typeof MenuGroup>;

/** The small header of a group or a radio group: the kit's `menu` section label. */
export function DropdownMenuGroupLabel({ className, ...props }: ComponentProps<typeof MenuGroupLabel>) {
  const size = useContext(SizeContext);
  return <MenuGroupLabel className={cx([sectionLabelVariants({ variant: 'menu' }), size === 'sm' ? 'px-2.5 pt-1.5 pb-1' : 'px-4 pt-2 pb-1.5'], className)} {...props} />;
}

/** A group break: the iOS menu's thick band, or a hairline in a `size="sm"` menu. */
export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof MenuSeparator>) {
  const size = useContext(SizeContext);
  return <MenuSeparator className={cx(size === 'sm' ? 'mx-2.5 my-1 h-px border-0 bg-border' : 'm-0 h-2 border-0 bg-secondary', className)} {...props} />;
}

/** A shortcut hint placed by hand, before a row's trailing icon. Text children (UI SDK's formatted keys) are put in
    the kit's order; an item's `shortcut` prop draws the same thing from keys like `mod+r`. */
export function DropdownMenuShortcut({ className, children, ...props }: ComponentProps<typeof MenuShortcut>) {
  const size = useContext(SizeContext);
  // The letter-spacing suits a glyph run (⇧⌘N); `Ctrl+Shift+N` reads as words and keeps its own.
  const glyphs = typeof children === 'string' && isGlyphShortcut(children);
  return (
    <MenuShortcut
      dir="ltr"
      className={cx(['shrink-0 text-muted-foreground', size === 'sm' ? undefined : 'text-subhead', glyphs ? 'tracking-[.08em]' : undefined], className)}
      {...props}
    >
      {typeof children === 'string' ? shortcutText(children) : children}
    </MenuShortcut>
  );
}

/** A submenu: a `DropdownMenuSubTrigger` and a `DropdownMenuSubContent`, inside a menu's content. */
export const DropdownMenuSub = MenuSub;
export type DropdownMenuSubProps = MenuSubProps;

export type DropdownMenuSubTriggerProps = Omit<ComponentProps<typeof MenuSubTrigger>, 'children'> & Omit<RowProps, 'icon'>;

/** The row that opens its submenu: a chevron where an item has its icon. */
export function DropdownMenuSubTrigger({ className, description, children, ...props }: DropdownMenuSubTriggerProps) {
  const size = useContext(SizeContext);
  const ids = useRowText(description);
  return (
    <MenuSubTrigger className={cx(dropdownMenuItemVariants({ size }), className)} {...ids.describe} {...props}>
      <RowText ids={ids} description={description}>{children}</RowText>
      <Icon name="chev" size={size === 'sm' ? 14 : 17} sw={2.2} className="shrink-0 text-muted-foreground rtl:-scale-x-100" />
    </MenuSubTrigger>
  );
}

/** A submenu's popup: beside its row, overlapping it by 6px, at its parent's `size`. */
export function DropdownMenuSubContent({ sideOffset = -6, ...props }: DropdownMenuContentProps) {
  return <DropdownMenuContent sideOffset={sideOffset} {...props} />;
}

/** Draws a data menu's entries with the rows above: what an empty `DropdownMenuContent` renders. */
export function DropdownMenuItems({ items }: { items: DropdownMenuData }) {
  return items.map((entry, index) => {
    const item: DropdownMenuDataItem = typeof entry === 'string' ? { value: entry, label: entry } : entry;
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
            icon={item.icon}
            description={item.description}
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
            <DropdownMenuSubTrigger disabled={item.disabled} description={item.description}>{item.label}</DropdownMenuSubTrigger>
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
            icon={item.icon}
            description={item.description}
          >
            {item.label}
          </DropdownMenuItem>
        );
    }
  });
}

/** A controller for a menu opened from elsewhere (one menu for many triggers, or a context menu opened at a point). */
export const createDropdownMenuController = createMenuController;
export type DropdownMenuController<Payload = unknown> = MenuController<Payload>;
