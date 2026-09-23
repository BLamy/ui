import {
  Dialog as AriaDialog, type DialogProps as AriaDialogProps,
  DialogTrigger,
  Popover as AriaPopover, type PopoverProps as AriaPopoverProps,
  composeRenderProps,
} from 'react-aria-components';
import { overlayZ, popoverMotion, popoverSurface } from '../lib/primitives';
import { cn } from '../lib/utils';

/* ══ Popover — react-aria's Popover (positioning, flipping, Esc / outside-press dismissal, focus return).
   Portals into BLProvider's root (see BLProvider) so it keeps the theme tokens.
   <PopoverTrigger>
     <Button>Open</Button>
     <PopoverContent>…</PopoverContent>
   </PopoverTrigger> ══ */

/** Opens the Popover/Dialog it wraps from its first pressable child. */
export const PopoverTrigger = DialogTrigger;

export interface PopoverProps extends AriaPopoverProps {}

/** The styled floating surface. Select, ComboBox and DropdownMenu render their lists inside it. */
export function Popover({ className, offset = 8, ...props }: PopoverProps) {
  return (
    <AriaPopover
      data-slot="popover"
      offset={offset}
      className={composeRenderProps(className, (cls) => cn(popoverSurface, popoverMotion, overlayZ, 'min-w-(--trigger-width)', cls))}
      {...props}
    />
  );
}

export interface PopoverContentProps extends Omit<PopoverProps, 'children'> {
  children?: AriaDialogProps['children'];
  /** Accessible name when the content has no heading. */
  'aria-label'?: string;
}

/** Popover + Dialog: a padded, focus-contained panel for arbitrary content. */
export function PopoverContent({ className, children, 'aria-label': ariaLabel, ...props }: PopoverContentProps) {
  return (
    <Popover className={composeRenderProps(className, (cls) => cn('w-72 min-w-0', cls))} {...props}>
      <AriaDialog data-slot="popover-content" aria-label={ariaLabel} className="p-4 outline-none">
        {children}
      </AriaDialog>
    </Popover>
  );
}
