'use client';
import {
  Button as AriaButton,
  ComboBox as AriaComboBox, type ComboBoxProps as AriaComboBoxProps,
  Group,
  Input as AriaInput, type InputProps as AriaInputProps,
  composeRenderProps,
} from 'react-aria-components';
import { selectableText } from '@/lib/primitives';
import { cn } from '@/lib/utils';
import { ListBox, ListBoxItem, ListBoxSection, type ListBoxItemProps, type ListBoxProps } from '@/components/ui/list-box';
import { Popover, type PopoverProps } from '@/components/ui/popover';

/* ══ ComboBox — react-aria's ComboBox: a filterable text field with a ListBox popover (arrow keys open and move,
   Enter commits, Esc reverts/closes).
   <ComboBox>
     <Label variant="field">City</Label>
     <ComboBoxInput placeholder="Search cities" />
     <ComboBoxContent>{cities.map(c => <ComboBoxItem id={c}>{c}</ComboBoxItem>)}</ComboBoxContent>
   </ComboBox> ══ */

export interface ComboBoxProps<T extends object> extends AriaComboBoxProps<T> {}

export function ComboBox<T extends object>({ className, ...props }: ComboBoxProps<T>) {
  return (
    <AriaComboBox<T>
      data-slot="combobox"
      className={composeRenderProps(className, (cls) => cn('group flex flex-col gap-1.5', cls))}
      {...props}
    />
  );
}

export interface ComboBoxInputProps extends AriaInputProps {
  groupClassName?: string;
}

/** Field + disclosure button, drawn as one iOS filled field. */
export function ComboBoxInput({ className, groupClassName, ...props }: ComboBoxInputProps) {
  return (
    <Group
      data-slot="combobox-input"
      className={cn(
        'box-border flex h-11 w-full items-center rounded-ctl bg-input transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy',
        'data-focus-within:bg-transparent data-focus-within:shadow-[inset_0_0_0_1.5px_var(--primary)]',
        'group-data-invalid:shadow-[inset_0_0_0_1.5px_var(--destructive)] data-disabled:opacity-50',
        groupClassName,
      )}
    >
      <AriaInput
        className={composeRenderProps(className, (cls) => cn(
          'h-full min-w-0 flex-1 border-0 bg-transparent pr-1 pl-3 [font-family:inherit] text-body text-foreground outline-none placeholder:text-tertiary-foreground',
          selectableText, cls,
        ))}
        {...props}
      />
      <AriaButton
        data-slot="combobox-button"
        className="bl-btn mr-1 grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg border-0 bg-transparent p-0 text-muted-foreground outline-none data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45 data-pressed:bg-accent"
      >
        <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true" className="transition-transform duration-spring-snappy ease-spring-snappy group-data-open:rotate-180 motion-reduce:transition-none">
          <path d="M6.5 9.5l5.5 5.5 5.5-5.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </AriaButton>
    </Group>
  );
}

export interface ComboBoxContentProps<T> extends Omit<ListBoxProps<T>, 'variant'> {
  placement?: PopoverProps['placement'];
  popoverClassName?: string;
}

/** Popover + ListBox (popup variant), as wide as the field. */
export function ComboBoxContent<T extends object>({ placement = 'bottom start', popoverClassName, className, ...props }: ComboBoxContentProps<T>) {
  return (
    <Popover data-slot="combobox-content" placement={placement} className={cn('w-(--trigger-width)', popoverClassName)}>
      <ListBox<T> variant="popup" className={className} {...props} />
    </Popover>
  );
}

export function ComboBoxItem<T extends object>(props: ListBoxItemProps<T>) {
  return <ListBoxItem<T> data-slot="combobox-item" variant="popup" {...props} />;
}

export const ComboBoxSection = ListBoxSection;
