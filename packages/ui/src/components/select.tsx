'use client';
import type { ComponentProps, ReactNode } from 'react';
import {
  Select as SdkSelect,
  SelectContent as SdkSelectContent,
  SelectGroup as SdkSelectGroup,
  SelectGroupLabel as SdkSelectGroupLabel,
  SelectItem as SdkSelectItem,
  SelectItemIcon,
  SelectItemIndicator,
  SelectLabel as SdkSelectLabel,
  SelectSeparator as SdkSelectSeparator,
  SelectTrigger as SdkSelectTrigger,
  SelectValue as SdkSelectValue,
  type SelectContentState,
  type SelectProps as SdkSelectProps,
  type SelectTriggerState,
} from '@ui-sdk/react/select';
import { cva, type VariantProps } from 'class-variance-authority';
import { labelVariants } from '@/components/ui/label';
import {
  ListboxRow, ListDataItems, listboxGroupClass, listboxGroupLabelClass, listboxItemVariants, listboxSeparatorClass, listboxSheetClass,
  listboxVariants, optionLabel, type ListboxRowProps, type ListDataParts,
} from '@/components/ui/list-box';
import { popoverMotion, popoverSurface } from '@/lib/primitives';
import { scopeStyle, useLayerHost, useThemeScopeProps } from '@/lib/theme';
import { usePresentation } from '@/lib/container';
import { cx } from '@/lib/utils';

/* ══ Select — UI SDK's Select: a pop-up button that opens a list of options ══
   `value` / `defaultValue` / `onValueChange` hold the choice (`multiple` makes it a list). Typing on the closed button
   selects the option that matches; arrow keys and typeahead move in the open list, Esc closes, focus returns. The
   root renders no element: lay the label and the button out with a Field, which also gives the select its name and
   its error.
   <Field>
     <FieldLabel>Repeat</FieldLabel>
     <Select placeholder="Choose…">
       <SelectTrigger />
       <SelectContent><SelectItem value="never">Never</SelectItem>…</SelectContent>
     </Select>
   </Field>
   Options can be data too: `<Select items={[{ value: 'never', label: 'Never' }]}>` with an empty `<SelectContent />`. ══ */

export type SelectProps<T = string, Multiple extends boolean | undefined = false> = SdkSelectProps<T, Multiple>;

/** Never rendered. Its child tells UI SDK's root, which looks through its markup for a content part, that one is
    placed: ours, which draws the data. Otherwise a data select that starts open mounts UI SDK's bare content beside
    ours for one commit, and the options that mounted twice lose their keyboard wiring. */
const PlacedContent: (props: { children: ReactNode }) => null = () => null;

export function Select<T = string, Multiple extends boolean | undefined = false>({ container, presentation, children, ...props }: SelectProps<T, Multiple>) {
  const host = useLayerHost();
  // "auto" follows the nearest size class around (a sheet when compact), even when the content is portaled.
  const shown = usePresentation(presentation, 'popover');
  return (
    <SdkSelect<T, Multiple> container={container === undefined ? host : container} presentation={shown} {...(props as SelectProps<T, Multiple>)}>
      {children}
      {props.items ? <PlacedContent><SdkSelectContent /></PlacedContent> : null}
    </SdkSelect>
  );
}

export type SelectLabelProps = ComponentProps<typeof SdkSelectLabel> & VariantProps<typeof labelVariants>;

/** A label for a select that is not in a Field, in Label's variants. Pressing it focuses the button. */
export function SelectLabel({ className, variant, ...props }: SelectLabelProps) {
  return <SdkSelectLabel className={cx(labelVariants({ variant }), className)} {...props} />;
}

export const selectTriggerVariants = cva(
  [
    'bl-btn box-border flex w-full cursor-pointer items-center justify-between gap-2 border-0 px-3 text-left [font-family:inherit] text-foreground outline-none',
    'transition-[background-color,box-shadow] duration-spring-snappy ease-spring-snappy active:not-data-disabled:bg-secondary-strong',
    'focus-visible:ring-[3px] focus-visible:ring-ring/45 data-open:shadow-[inset_0_0_0_1.5px_var(--primary)]',
    'data-invalid:shadow-[inset_0_0_0_1.5px_var(--destructive)] data-disabled:cursor-default data-disabled:opacity-50',
  ],
  {
    variants: {
      variant: {
        default: 'bg-input',
        /** iOS pop-up button: tinted value, no fill, e.g. at the trailing edge of a list row. */
        plain: 'w-auto justify-end bg-transparent px-1 text-muted-foreground active:not-data-disabled:bg-transparent active:not-data-disabled:opacity-60 data-open:shadow-none',
      },
      size: {
        sm: 'h-8 rounded-lg text-subhead',
        default: 'h-11 rounded-ctl text-body',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export type SelectTriggerProps = ComponentProps<typeof SdkSelectTrigger> & VariantProps<typeof selectTriggerVariants>;

function UpDown() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true" className="shrink-0 opacity-70">
      <path d="M8 9.5l4-4 4 4M8 14.5l4 4 4-4" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** The button: its children (a `SelectValue` when it has none), then the up-down chevrons. */
export function SelectTrigger({ className, variant, size, children, ...props }: SelectTriggerProps) {
  const face = (kids: ReactNode) => <>{kids ?? <SelectValue />}<UpDown /></>;
  return (
    <SdkSelectTrigger className={cx(selectTriggerVariants({ variant, size }), className)} {...props}>
      {typeof children === 'function' ? (state: SelectTriggerState) => face(children(state)) : face(children)}
    </SdkSelectTrigger>
  );
}

/** The selected option's label, or the placeholder (dimmed). */
export function SelectValue({ className, ...props }: ComponentProps<typeof SdkSelectValue>) {
  return <SdkSelectValue className={cx('min-w-0 flex-1 truncate data-placeholder:text-tertiary-foreground', className)} {...props} />;
}

export type SelectContentProps = ComponentProps<typeof SdkSelectContent>;

/** The popup and its list: 8px under the button, at least as wide as it (and 200px), scrolling past 320px. It renders
 *  into BLProvider's root (see `useLayerHost`) and wears the ThemeScope it was opened from. Without children it draws
 *  the select's `items`. */
export function SelectContent({ className, style, sideOffset = 8, children, ...props }: SelectContentProps) {
  const scope = useThemeScopeProps();
  return (
    <SdkSelectContent
      data-theme-scope={scope['data-theme-scope']}
      sideOffset={sideOffset}
      className={cx(
        [
          popoverSurface, popoverMotion, listboxVariants({ variant: 'popup' }), 'min-w-[max(var(--anchor-width),200px)]',
          listboxSheetClass, scope.className,
        ],
        className,
      )}
      style={scopeStyle(scope.style, style)}
      {...props}
    >
      {children ?? ((state: SelectContentState) => <ListDataItems items={state.items} parts={selectParts} />)}
    </SdkSelectContent>
  );
}

export type SelectItemProps<T = string> = Omit<ComponentProps<typeof SdkSelectItem<T>>, 'children'> & ListboxRowProps;

/** An option. `value` is what the select's value becomes; `label` is the text the button shows and typing finds when
 *  the children are not plain text. */
export function SelectItem<T = string>({ className, icon, description, label, children, ...props }: SelectItemProps<T>) {
  return (
    <SdkSelectItem<T> label={optionLabel(label, children)} className={cx(listboxItemVariants({ variant: 'popup' }), className)} {...props}>
      <ListboxRow variant="popup" icon={icon} description={description} Indicator={SelectItemIndicator} ItemIcon={SelectItemIcon}>
        {children}
      </ListboxRow>
    </SdkSelectItem>
  );
}

/** A group of options, named by its `SelectGroupLabel`. */
export function SelectGroup({ className, ...props }: ComponentProps<typeof SdkSelectGroup>) {
  return <SdkSelectGroup className={cx(listboxGroupClass, className)} {...props} />;
}

export function SelectGroupLabel({ className, ...props }: ComponentProps<typeof SdkSelectGroupLabel>) {
  return <SdkSelectGroupLabel className={cx(listboxGroupLabelClass, className)} {...props} />;
}

/** A hairline between options or groups, hidden from screen readers. */
export function SelectSeparator({ className, ...props }: ComponentProps<typeof SdkSelectSeparator>) {
  return <SdkSelectSeparator className={cx(listboxSeparatorClass, className)} {...props} />;
}

const selectParts: ListDataParts = { Item: SelectItem, Group: SelectGroup, GroupLabel: SelectGroupLabel, Separator: SelectSeparator };

export { createSelectController } from '@ui-sdk/react/select';
export type { ListData, SelectController } from '@ui-sdk/react/select';
