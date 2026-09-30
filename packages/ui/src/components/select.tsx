import {
  Button as AriaButton, type ButtonProps as AriaButtonProps,
  Select as AriaSelect, type SelectProps as AriaSelectProps,
  SelectValue as AriaSelectValue, type SelectValueProps,
  composeRenderProps,
} from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/utils';
import { ListBox, ListBoxItem, ListBoxSection, type ListBoxItemProps, type ListBoxProps } from './list-box';
import { Popover, type PopoverProps } from './popover';

/* ══ Select — react-aria's Select: a button that opens a ListBox in a Popover (arrow keys / typeahead on the
   closed button too, Esc closes, focus returns).
   <Select placeholder="Choose…">
     <Label variant="field">Repeat</Label>
     <SelectTrigger />
     <SelectContent><SelectItem id="never">Never</SelectItem>…</SelectContent>
   </Select> ══ */

export interface SelectProps<T extends object, M extends 'single' | 'multiple' = 'single'> extends AriaSelectProps<T, M> {}

export function Select<T extends object, M extends 'single' | 'multiple' = 'single'>({ className, ...props }: SelectProps<T, M>) {
  return (
    <AriaSelect<T, M>
      data-slot="select"
      className={composeRenderProps(className, (cls) => cn('group flex flex-col gap-1.5', cls))}
      {...props}
    />
  );
}

export const selectTriggerVariants = cva(
  [
    'bl-btn box-border flex w-full cursor-pointer items-center justify-between gap-2 border-0 px-3 text-left [font-family:inherit] text-foreground outline-none',
    'transition-[background-color,box-shadow] duration-spring-snappy ease-spring-snappy data-pressed:bg-secondary-strong',
    'data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45 group-data-open:shadow-[inset_0_0_0_1.5px_var(--primary)]',
    'group-data-invalid:shadow-[inset_0_0_0_1.5px_var(--destructive)] data-disabled:cursor-default data-disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        default: 'bg-input',
        /** iOS pop-up button: tinted value, no fill, e.g. at the trailing edge of a list row. */
        plain: 'w-auto justify-end bg-transparent px-1 text-muted-foreground data-pressed:bg-transparent data-pressed:opacity-60 group-data-open:shadow-none',
      },
      size: {
        sm: 'h-8 rounded-lg text-[15px]',
        default: 'h-11 rounded-[10px] text-[17px]',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface SelectTriggerProps extends Omit<AriaButtonProps, 'children'>, VariantProps<typeof selectTriggerVariants> {
  /** Custom value rendering; defaults to <SelectValue />. */
  children?: AriaButtonProps['children'];
}

function UpDown() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true" className="shrink-0 opacity-70">
      <path d="M8 9.5l4-4 4 4M8 14.5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SelectTrigger({ className, variant, size, children, ...props }: SelectTriggerProps) {
  return (
    <AriaButton
      data-slot="select-trigger"
      className={composeRenderProps(className, (cls) => cn(selectTriggerVariants({ variant, size }), cls))}
      {...props}
    >
      {composeRenderProps(children, (kids) => (
        <>
          {kids ?? <SelectValue />}
          <UpDown />
        </>
      ))}
    </AriaButton>
  );
}

export function SelectValue<T extends object>({ className, ...props }: SelectValueProps<T>) {
  return (
    <AriaSelectValue<T>
      data-slot="select-value"
      className={composeRenderProps(className, (cls) => cn('min-w-0 flex-1 truncate data-placeholder:text-tertiary-foreground', cls))}
      {...props}
    />
  );
}

export interface SelectContentProps<T> extends Omit<ListBoxProps<T>, 'variant'> {
  placement?: PopoverProps['placement'];
  popoverClassName?: string;
}

/** Popover + ListBox (popup variant). */
export function SelectContent<T extends object>({ placement = 'bottom start', popoverClassName, className, ...props }: SelectContentProps<T>) {
  return (
    <Popover data-slot="select-content" placement={placement} className={cn('min-w-[max(var(--trigger-width),200px)]', popoverClassName)}>
      <ListBox<T> variant="popup" className={className} {...props} />
    </Popover>
  );
}

export function SelectItem<T extends object>(props: ListBoxItemProps<T>) {
  return <ListBoxItem<T> data-slot="select-item" variant="popup" {...props} />;
}

export const SelectSection = ListBoxSection;
