'use client';
import { createContext, useContext, type ComponentProps } from 'react';
import {
  Listbox as SdkListbox,
  ListboxGroup as SdkListboxGroup,
  ListboxGroupLabel as SdkListboxGroupLabel,
  ListboxItem as SdkListboxItem,
  ListboxItemIcon,
  ListboxItemIndicator,
  ListboxSeparator as SdkListboxSeparator,
  type ListboxProps as SdkListboxProps,
  type ListboxState,
} from '@ui-sdk/react/listbox';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  ListDataItems, OptionRow, optionGroupClass, optionGroupLabelClass, optionLabel, optionSeparatorClass, useOptionDescription,
  type ListDataParts, type OptionRowProps,
} from '@/lib/option-row';
import { cx } from '@/lib/utils';

/* ══ Listbox — UI SDK's Listbox: an always-visible list to choose one option from, or several ══
   `value` / `defaultValue` / `onValueChange` hold the choice (`multiple` makes it a list); arrow keys, Home / End and
   typeahead move, Shift selects a range. `inset` is an iOS inset-grouped list with trailing checkmarks; `popup` is the
   compact list Select and Combobox draw in their popups (leading checkmarks, rounded highlight).
   <Listbox aria-label="Ringtone" defaultValue="Reflection">
     <ListboxItem value="Reflection">Reflection</ListboxItem>
     <ListboxItem value="Apex">Apex</ListboxItem>
   </Listbox>
   Options can be data too: `<Listbox items={['Reflection', 'Apex']} />` draws the same rows. ══ */
export const listboxVariants = cva('outline-none', {
  variants: {
    variant: {
      inset: 'overflow-hidden rounded-panel bg-card focus-visible:ring-[3px] focus-visible:ring-ring/45',
      popup: 'bl-scroll box-border max-h-[min(320px,var(--available-height,320px))] overflow-y-auto p-1.5',
    },
  },
  defaultVariants: { variant: 'inset' },
});

export const listboxItemVariants = cva(
  'bl-btn group/item relative box-border flex cursor-pointer items-center gap-2.5 text-foreground outline-none data-disabled:cursor-default data-disabled:opacity-40',
  {
    variants: {
      variant: {
        inset: [
          'min-h-11 px-4 py-[11px] text-body leading-[22px]',
          // The hairline starts under the text: past the icon when the row has one (`--listbox-icon`, 24px by default).
          'after:pointer-events-none after:absolute after:right-0 after:bottom-0 after:left-(--row-inset) after:h-px after:bg-border last:after:hidden',
          '[--row-inset:16px] has-data-[slot=listbox-item-icon]:[--row-inset:calc(26px+var(--listbox-icon,24px))]',
          'hover:not-data-disabled:bg-accent active:not-data-disabled:bg-accent focus-visible:bg-accent',
        ],
        popup: [
          'min-h-9 rounded-lg py-[7px] pr-3 pl-2 text-subhead leading-5',
          'data-highlighted:bg-accent active:not-data-disabled:bg-secondary-strong data-highlighted:active:bg-secondary-strong',
        ],
      },
    },
    defaultVariants: { variant: 'inset' },
  },
);

type ListboxVariant = NonNullable<VariantProps<typeof listboxVariants>['variant']>;
/** Items follow their list's variant. */
const ListboxVariantCtx = createContext<ListboxVariant>('inset');

/* ── Listbox ── */

export type ListboxProps<T = string, Multiple extends boolean | undefined = false> =
  SdkListboxProps<T, Multiple> & VariantProps<typeof listboxVariants>;

export function Listbox<T = string, Multiple extends boolean | undefined = false>({
  className, variant, children, ...props
}: ListboxProps<T, Multiple>) {
  const v = variant ?? 'inset';
  const list = props as SdkListboxProps<unknown, boolean>;
  return (
    <ListboxVariantCtx.Provider value={v}>
      <SdkListbox<unknown, boolean> data-variant={v} {...list} className={cx(listboxVariants({ variant: v }), className)}>
        {children ?? ((state: ListboxState) => <ListDataItems items={state.items} parts={listboxParts} />)}
      </SdkListbox>
    </ListboxVariantCtx.Provider>
  );
}

export type ListboxItemProps<T = string> = Omit<ComponentProps<typeof SdkListboxItem<T>>, 'children'> & OptionRowProps;

/** An option. `value` is what the list's value becomes; `label` is the text typing finds when the children are not
 *  plain text. */
export function ListboxItem<T = string>({ className, icon, description, label, children, ...props }: ListboxItemProps<T>) {
  const variant = useContext(ListboxVariantCtx);
  const described = useOptionDescription(description);
  return (
    <SdkListboxItem<T>
      label={optionLabel(label, children)}
      aria-describedby={described.describedBy}
      className={cx(listboxItemVariants({ variant }), className)}
      {...props}
    >
      <OptionRow variant={variant} icon={icon} description={description} descriptionId={described.id} Indicator={ListboxItemIndicator} ItemIcon={ListboxItemIcon}>
        {children}
      </OptionRow>
    </SdkListboxItem>
  );
}

/** A group of options, named by its `ListboxGroupLabel`. */
export function ListboxGroup({ className, ...props }: ComponentProps<typeof SdkListboxGroup>) {
  return <SdkListboxGroup className={cx(optionGroupClass, className)} {...props} />;
}

export function ListboxGroupLabel({ className, ...props }: ComponentProps<typeof SdkListboxGroupLabel>) {
  return <SdkListboxGroupLabel className={cx(optionGroupLabelClass, className)} {...props} />;
}

/** A hairline between options or groups, hidden from screen readers. */
export function ListboxSeparator({ className, ...props }: ComponentProps<typeof SdkListboxSeparator>) {
  return <SdkListboxSeparator className={cx(optionSeparatorClass, className)} {...props} />;
}

const listboxParts: ListDataParts = { Item: ListboxItem, Group: ListboxGroup, GroupLabel: ListboxGroupLabel, Separator: ListboxSeparator };

export { createListboxController } from '@ui-sdk/react/listbox';
export type { ListData, ListboxController } from '@ui-sdk/react/listbox';
