'use client';
import { createContext, useContext, useRef, type ComponentProps, type RefObject } from 'react';
import { MenuContextTrigger } from '@ui-sdk/react/menu';
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuGroupLabel, DropdownMenuItem,
  DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger, type DropdownMenuContentProps, type DropdownMenuProps,
} from '@/components/ui/dropdown-menu';

/* ══ ContextMenu — the DropdownMenu, opened where you right-click instead of from a button ══
   UI SDK's Menu with its context trigger: the area opens the menu at the pointer on a right-click or a long press
   (half a second, still: iOS never fires `contextmenu`), and at the focused element on the menu key or Shift+F10. A
   right-click elsewhere in the area moves the open menu there. The area is a `div`; the menu is beside it:
   <ContextMenu onAction={(value) => run(value)}>
     <ContextMenuTrigger className="…">…anything, buttons included…</ContextMenuTrigger>
     <ContextMenuContent aria-label="Dock">
       <ContextMenuItem value="hide">Turn Hiding On</ContextMenuItem>
     </ContextMenuContent>
   </ContextMenu> ══ */

/** What had focus when the menu opened: where it goes back to. */
const OpenerContext = createContext<RefObject<HTMLElement | null> | null>(null);

export type ContextMenuProps = DropdownMenuProps;

export function ContextMenu({ onOpenChange, ...props }: ContextMenuProps) {
  const opener = useRef<HTMLElement | null>(null);
  return (
    <OpenerContext.Provider value={opener}>
      <DropdownMenu
        onOpenChange={(open, details) => {
          if (open) {
            const active = document.activeElement;
            opener.current = active instanceof HTMLElement && active !== document.body ? active : null;
          }
          onOpenChange?.(open, details);
        }}
        {...props}
      />
    </OpenerContext.Provider>
  );
}

/** The area. `disabled` leaves the browser's own menu; `payload` reaches the content's state, for one menu shared by
 *  several areas. Give it `tabIndex={0}` when nothing inside it takes focus, so the keyboard can reach the menu. */
export function ContextMenuTrigger({ onKeyDown, ...props }: ContextMenuTriggerProps) {
  return (
    <MenuContextTrigger
      onKeyDown={(event) => {
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
export type ContextMenuTriggerProps = ComponentProps<typeof MenuContextTrigger>;

export type ContextMenuContentProps = DropdownMenuContentProps;

/** The menu: `DropdownMenuContent`, below and to the right of the pointer, flipping to stay on screen. Closing it
 *  gives focus back to what had it (the button the menu key was pressed on), else to the area. It has no trigger to
 *  take a name from, so give it an `aria-label`. */
export function ContextMenuContent({ finalFocus, ...props }: ContextMenuContentProps) {
  const opener = useContext(OpenerContext);
  return <DropdownMenuContent finalFocus={finalFocus ?? (() => (opener?.current?.isConnected ? opener.current : null))} {...props} />;
}

export const ContextMenuItem = DropdownMenuItem;
export const ContextMenuCheckboxItem = DropdownMenuCheckboxItem;
export const ContextMenuRadioGroup = DropdownMenuRadioGroup;
export const ContextMenuRadioItem = DropdownMenuRadioItem;
export const ContextMenuGroup = DropdownMenuGroup;
export const ContextMenuGroupLabel = DropdownMenuGroupLabel;
export const ContextMenuSeparator = DropdownMenuSeparator;
export const ContextMenuShortcut = DropdownMenuShortcut;
export const ContextMenuSub = DropdownMenuSub;
export const ContextMenuSubTrigger = DropdownMenuSubTrigger;
export const ContextMenuSubContent = DropdownMenuSubContent;
