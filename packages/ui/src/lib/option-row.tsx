'use client';
import { createContext, useContext, useId, useLayoutEffect, useState, type ComponentType, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import type { ListData } from '@ui-sdk/react/listbox';
import { Icon } from '@/lib/icon';
import { sectionLabelVariants } from '@/lib/primitives';
import { cn } from '@/lib/utils';

/* ══ Option rows — what Listbox, Select and Combobox draw their options, groups and data with ══
   Their options are three UI SDK primitives (listbox, select, combobox), so each passes its own indicator and icon
   parts in; the row, the group classes and the data walker are shared, so the three lists look and read the same. */

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

/** What the kit's rows add to a UI SDK option. */
export interface OptionRowProps {
  /** Leading icon or avatar. Screen readers, typeahead and filtering skip it. */
  icon?: ReactNode;
  /** A second line under the label. Screen readers hear it as the option's description, not as part of its name. */
  description?: ReactNode;
  children?: ReactNode;
}

/** An option's own text is its label: what a trigger shows and typing finds should not include the description. */
export const optionLabel = (label: string | undefined, children: ReactNode) => label ?? (typeof children === 'string' ? children : undefined);

/** The id an option's description gets, and the `aria-describedby` the option points at it with: the description
    then stays out of the option's name (which comes from its content) and is read after it. */
export function useOptionDescription(description: ReactNode) {
  const id = useId();
  return { id, describedBy: description == null || description === false ? undefined : id };
}

/** The inside of an option: `popup` leads with the checkmark's column, `inset` trails with the checkmark. */
export function OptionRow({
  variant, icon, description, descriptionId, children, Indicator, ItemIcon,
}: OptionRowProps & {
  variant: 'inset' | 'popup';
  /** From `useOptionDescription`. */
  descriptionId?: string;
  Indicator: ComponentType<{ children?: ReactNode }>;
  ItemIcon: ComponentType<{ className?: string; children?: ReactNode }>;
}) {
  const check = <Indicator><Icon name="check" size={18} sw={2.4} className="shrink-0 text-primary" /></Indicator>;
  const label = (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className="truncate">{children}</span>
      {description ? (
        <span id={descriptionId} aria-hidden="true" className="truncate text-footnote leading-[18px] text-muted-foreground">{description}</span>
      ) : null}
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

/** A group after the first one starts under a hairline. */
export const optionGroupClass = 'not-first:mt-1.5 not-first:pt-1.5 not-first:shadow-hairline-t';
/** A group's name: the kit's menu section label. */
export const optionGroupLabelClass = cn(sectionLabelVariants({ variant: 'menu' }), 'px-2 pt-1 pb-1');
export const optionSeparatorClass = 'my-1.5 h-px bg-border';

/* ── Row density in a popup list (Select, Combobox) ──
   A picker's field and its popup's rows share one size: the box part (SelectTrigger, ComboboxInputGroup) reports
   its `size` to the root, and the popup's rows default to dense (32px, footnote) when the field is `sm`. An explicit
   `size` on the content still wins. */

export type OptionRowSize = 'sm' | 'default';
/** The rows' density as the content resolved it: `sm` asked for on the content (dense in a sheet too), `field-sm`
 *  (dense under a small field in a popup; a sheet keeps its 44px touch rows) or `default`. */
export type OptionRowDensity = OptionRowSize | 'field-sm';
const SHEET = 'in-data-[presentation=sheet]:';
const dense = ['min-h-8', 'py-1.5', 'text-footnote', 'leading-[18px]'];
export const optionRowSizes: Record<OptionRowDensity, string> = {
  sm: [...dense, ...dense.map((c) => SHEET + c), `${SHEET}pr-3 ${SHEET}pl-2`].join(' '),
  'field-sm': dense.map((c) => `not-${SHEET}${c}`).join(' '),
  default: '',
};
/** The rows' density, provided by the popup content and read by each item. */
export const OptionRowSizeContext = createContext<OptionRowDensity>('default');

type FieldSize = 'sm' | 'default' | 'lg';
/** The field's size, held by a picker's root. */
export const PickerFieldSizeContext = createContext<[FieldSize, Dispatch<SetStateAction<FieldSize>>] | null>(null);

/** The root's state for its field's size. */
export function usePickerFieldSize() {
  return useState<FieldSize>('default');
}

/** Called by the box part: tells the root what size the field is. */
export function useReportFieldSize(size: FieldSize | null | undefined) {
  const set = useContext(PickerFieldSizeContext)?.[1];
  const shown = size ?? 'default';
  useLayoutEffect(() => { set?.(shown); }, [set, shown]);
}

/** The popup's row density: its own `size`, else dense under a small field (but not in a sheet). */
export function useOptionRowSize(size: OptionRowSize | undefined): OptionRowDensity {
  const field = useContext(PickerFieldSizeContext)?.[0];
  return size ?? (field === 'sm' ? 'field-sm' : 'default');
}
