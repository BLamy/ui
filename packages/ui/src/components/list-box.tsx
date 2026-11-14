'use client';
import { createContext, useContext, type ComponentProps, type ComponentType, type ReactNode } from 'react';
import {
  Listbox as SdkListbox,
  ListboxGroup as SdkListboxGroup,
  ListboxGroupLabel as SdkListboxGroupLabel,
  ListboxItem as SdkListboxItem,
  ListboxItemIcon,
  ListboxItemIndicator,
  ListboxSeparator as SdkListboxSeparator,
  type ListData,
  type ListboxProps as SdkListboxProps,
  type ListboxState,
} from '@ui-sdk/react/listbox';
import { cva, type VariantProps } from 'class-variance-authority';
import { Icon } from '@/lib/icon';
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
          'after:pointer-events-none after:absolute after:right-0 after:bottom-0 after:left-4 after:h-px after:bg-border last:after:hidden',
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

/* ── The row, shared with Select and Combobox ──
   Their options are other UI SDK primitives, so each passes its own indicator and icon parts. */

/** The parts a list draws its `items` data with. */
export interface ListDataParts {
  Item: ComponentType<{ value: never; label?: string; disabled?: boolean; keywords?: string[]; children?: ReactNode }>;
  Group: ComponentType<{ children?: ReactNode }>;
  GroupLabel: ComponentType<{ children?: ReactNode }>;
  Separator: ComponentType<object>;
}

const dataKey = (value: unknown, index: number) => {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  const id = value && typeof value === 'object' ? ((value as { id?: unknown }).id ?? (value as { value?: unknown }).value) : undefined;
  return typeof id === 'string' || typeof id === 'number' ? String(id) : String(index);
};

/** Draws UI SDK list data (strings, `{ value, label }`, groups, separators) with a list's own styled parts. */
export function ListDataItems({ items, parts }: { items: ListData<unknown>; parts: ListDataParts }): ReactNode {
  const { Item, Group, GroupLabel, Separator } = parts;
  return items.map((entry, index) => {
    if (typeof entry === 'string') return <Item key={entry} value={entry as never}>{entry}</Item>;
    if ('type' in entry && entry.type === 'separator') return <Separator key={`separator-${index}`} />;
    if ('type' in entry && entry.type === 'group') {
      return (
        <Group key={`group-${entry.label ?? index}`}>
          {entry.label ? <GroupLabel>{entry.label}</GroupLabel> : null}
          <ListDataItems items={entry.items} parts={parts} />
        </Group>
      );
    }
    const { value, label, disabled, keywords } = entry as { value: unknown; label: string; disabled?: boolean; keywords?: string[] };
    return (
      <Item key={dataKey(value, index)} value={value as never} label={label} disabled={disabled} {...(keywords ? { keywords } : null)}>
        {label}
      </Item>
    );
  });
}

/** What our rows add to a UI SDK option. */
export interface ListboxRowProps {
  /** Leading icon / avatar. Screen readers, typeahead and filtering skip it. */
  icon?: ReactNode;
  /** Secondary line under the label. */
  description?: ReactNode;
  children?: ReactNode;
}

/** An option's own text is its label: what a trigger shows and typing finds should not include the description. */
export const optionLabel = (label: string | undefined, children: ReactNode) => label ?? (typeof children === 'string' ? children : undefined);

/** The inside of an option: `popup` leads with the checkmark's column, `inset` trails with the checkmark. */
export function ListboxRow({
  variant, icon, description, children, Indicator, ItemIcon,
}: ListboxRowProps & {
  variant: ListboxVariant;
  Indicator: ComponentType<{ children?: ReactNode }>;
  ItemIcon: ComponentType<{ className?: string; children?: ReactNode }>;
}) {
  const check = <Indicator><Icon name="check" size={18} sw={2.4} className="shrink-0 text-primary" /></Indicator>;
  const label = (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate">{children}</span>
      {description ? <span className="truncate text-footnote leading-[18px] text-muted-foreground">{description}</span> : null}
    </span>
  );
  return variant === 'popup' ? (
    <>
      <span className="grid w-[18px] shrink-0 place-items-center">{check}</span>
      {icon ? <ItemIcon className="grid shrink-0 place-items-center text-muted-foreground">{icon}</ItemIcon> : null}
      {label}
    </>
  ) : (
    <>
      {icon ? <ItemIcon className="grid shrink-0 place-items-center text-primary">{icon}</ItemIcon> : null}
      {label}
      {check}
    </>
  );
}

export const listboxGroupClass = 'not-first:mt-1.5 not-first:pt-1.5 not-first:shadow-hairline-t';
export const listboxGroupLabelClass = 'px-2 pt-1 pb-1 text-footnote leading-[18px] font-semibold text-muted-foreground';
export const listboxSeparatorClass = 'my-1.5 h-px bg-border';
/** A list's popup presented as a sheet, shaped like the kit's bottom Sheet: the full width of its host, square at the
    bottom edge. It sets the sheet's `--sheet-backdrop`, which only dims the page when the popup is in the top layer: in
    a layer host (BLProvider is one) the sheet has no scrim behind it. */
export const listboxSheetClass =
  'data-[presentation=sheet]:max-h-[calc(100%-48px)] data-[presentation=sheet]:w-full data-[presentation=sheet]:min-w-0 data-[presentation=sheet]:rounded-t-card data-[presentation=sheet]:rounded-b-none data-[presentation=sheet]:pb-[max(16px,env(safe-area-inset-bottom))] data-[presentation=sheet]:[--sheet-backdrop:var(--overlay,color-mix(in_oklab,black_40%,transparent))]';

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

export type ListboxItemProps<T = string> = Omit<ComponentProps<typeof SdkListboxItem<T>>, 'children'> & ListboxRowProps & {
  variant?: ListboxVariant;
};

/** An option. `value` is what the list's value becomes; `label` is the text typing finds when the children are not
 *  plain text. */
export function ListboxItem<T = string>({ className, variant: variantProp, icon, description, label, children, ...props }: ListboxItemProps<T>) {
  const listVariant = useContext(ListboxVariantCtx);
  const variant = variantProp ?? listVariant;
  return (
    <SdkListboxItem<T> label={optionLabel(label, children)} className={cx(listboxItemVariants({ variant }), className)} {...props}>
      <ListboxRow variant={variant} icon={icon} description={description} Indicator={ListboxItemIndicator} ItemIcon={ListboxItemIcon}>
        {children}
      </ListboxRow>
    </SdkListboxItem>
  );
}

/** A group of options, named by its `ListboxGroupLabel`. */
export function ListboxGroup({ className, ...props }: ComponentProps<typeof SdkListboxGroup>) {
  return <SdkListboxGroup className={cx(listboxGroupClass, className)} {...props} />;
}

export function ListboxGroupLabel({ className, ...props }: ComponentProps<typeof SdkListboxGroupLabel>) {
  return <SdkListboxGroupLabel className={cx(listboxGroupLabelClass, className)} {...props} />;
}

/** A hairline between options or groups, hidden from screen readers. */
export function ListboxSeparator({ className, ...props }: ComponentProps<typeof SdkListboxSeparator>) {
  return <SdkListboxSeparator className={cx(listboxSeparatorClass, className)} {...props} />;
}

const listboxParts: ListDataParts = { Item: ListboxItem, Group: ListboxGroup, GroupLabel: ListboxGroupLabel, Separator: ListboxSeparator };

export { createListboxController } from '@ui-sdk/react/listbox';
export type { ListData, ListboxController } from '@ui-sdk/react/listbox';
