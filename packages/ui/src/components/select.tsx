'use client';
import { useContext, type ComponentProps, type ReactNode } from 'react';
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
import { fieldSurfaceVariants } from '@/components/ui/input';
import { labelVariants } from '@/components/ui/label';
import { listboxItemVariants, listboxVariants } from '@/components/ui/listbox';
import { Icon } from '@/lib/icon';
import {
  ListDataItems, OptionRow, OptionRowSizeContext, PickerFieldSizeContext, optionGroupClass, optionGroupLabelClass, optionLabel, optionRowSizes,
  optionSeparatorClass, useOptionDescription, useOptionRowSize, usePickerFieldSize, useReportFieldSize,
  type ListDataParts, type OptionRowProps, type OptionRowSize,
} from '@/lib/option-row';
import { popoverMotion, popoverSheet, popoverSurface } from '@/lib/primitives';
import { scopeStyle, useLayerHost, useThemeScopeProps } from '@/lib/theme';
import { useTriggerPalette, type PopupPalette } from '@/lib/trigger-palette';
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
  const fieldSize = usePickerFieldSize();
  return (
    <PickerFieldSizeContext.Provider value={fieldSize}>
      <SdkSelect<T, Multiple> container={container === undefined ? host : container} presentation={shown} {...(props as SelectProps<T, Multiple>)}>
        {children}
        {props.items ? <PlacedContent><SdkSelectContent /></PlacedContent> : null}
      </SdkSelect>
    </PickerFieldSizeContext.Provider>
  );
}

export type SelectLabelProps = ComponentProps<typeof SdkSelectLabel> & VariantProps<typeof labelVariants>;

/** A label for a select that is not in a Field, in Label's variants. Pressing it focuses the button. */
export function SelectLabel({ className, variant, ...props }: SelectLabelProps) {
  return <SdkSelectLabel className={cx(labelVariants({ variant }), className)} {...props} />;
}

const fieldSizes = ['sm', 'default', 'lg'] as const;

/** The pop-up button. `default` is the kit's filled field (`fieldSurfaceVariants`: the same box, heights and focus edge
    as an Input), which keeps the edge while its list is open; `plain` is the iOS pop-up button at the end of a row. */
export const selectTriggerVariants = cva(
  'bl-btn box-border flex cursor-pointer items-center gap-2 border-0 text-left [font-family:inherit] text-foreground outline-none data-disabled:cursor-default',
  {
    variants: {
      variant: {
        default: 'w-full justify-between active:not-data-disabled:bg-secondary-strong data-open:bg-transparent data-open:shadow-[inset_0_0_0_1.5px_var(--primary)]',
        /** iOS pop-up button: tinted value, no fill, e.g. at the trailing edge of a list row. */
        plain: [
          'w-auto justify-end rounded-lg bg-transparent px-1 text-muted-foreground transition-opacity duration-spring-snappy ease-spring-snappy',
          'focus-visible:ring-2 focus-visible:ring-ring active:not-data-disabled:opacity-60 data-disabled:opacity-50',
        ],
      },
      size: {
        sm: 'h-8 text-subhead',
        default: 'h-11 text-body',
        lg: 'h-[50px] text-body',
      },
    },
    compoundVariants: fieldSizes.map((size) => ({ variant: 'default' as const, size, class: fieldSurfaceVariants({ size }) })),
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export type SelectTriggerProps = ComponentProps<typeof SdkSelectTrigger> & VariantProps<typeof selectTriggerVariants>;

/** The button: its children (a `SelectValue` when it has none), then the up-down chevrons. */
export function SelectTrigger({ className, variant, size, children, ...props }: SelectTriggerProps) {
  useReportFieldSize(size);
  const face = (kids: ReactNode) => <>{kids ?? <SelectValue />}<Icon name="chevron-up-down" size={16} sw={2.2} className="shrink-0 opacity-70" /></>;
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

export type SelectContentProps = ComponentProps<typeof SdkSelectContent> & {
  /** `sm`: 32px rows in footnote text, for a select in a dense panel. Default: the trigger's (a `sm` trigger opens
      `sm` rows). */
  size?: OptionRowSize;
  /** Where the colors come from: the ThemeScope it was opened from (`scope`, the default), or the trigger's
      element (`trigger`), for a trigger on a surface that CSS paints rather than a ThemeScope (see `useTriggerPalette`). */
  palette?: PopupPalette;
};

/** The popup and its list: 8px under the button, at least as wide as it (and 200px), scrolling past 320px. It renders
 *  into BLProvider's root (see `useLayerHost`) and wears the ThemeScope it was opened from. Without children it draws
 *  the select's `items`. */
export function SelectContent({ className, style, sideOffset = 8, size: sizeProp, palette = 'scope', ref, children, ...props }: SelectContentProps) {
  const size = useOptionRowSize(sizeProp);
  const scope = useThemeScopeProps();
  const trigger = useTriggerPalette(palette === 'trigger', ref);
  const colors = trigger.props ?? scope;
  return (
    <OptionRowSizeContext.Provider value={size}>
      <SdkSelectContent
        ref={trigger.ref}
        data-theme-scope={colors['data-theme-scope']}
        data-size={size === 'field-sm' ? 'sm' : size}
        sideOffset={sideOffset}
        className={cx(
          [
            popoverSurface, popoverMotion, listboxVariants({ variant: 'popup' }), 'min-w-[max(var(--anchor-width),200px)]',
            popoverSheet, colors.className,
          ],
          className,
        )}
        style={scopeStyle(colors.style, style)}
        {...props}
      >
        {children ?? ((state: SelectContentState) => <ListDataItems items={state.items} parts={selectParts} />)}
      </SdkSelectContent>
    </OptionRowSizeContext.Provider>
  );
}

export type SelectItemProps<T = string> = Omit<ComponentProps<typeof SdkSelectItem<T>>, 'children'> & OptionRowProps;

/** An option. `value` is what the select's value becomes; `label` is the text the button shows and typing finds when
 *  the children are not plain text. */
export function SelectItem<T = string>({ className, icon, description, label, children, ...props }: SelectItemProps<T>) {
  const size = useContext(OptionRowSizeContext);
  const described = useOptionDescription(description);
  return (
    <SdkSelectItem<T>
      label={optionLabel(label, children)}
      aria-describedby={described.describedBy}
      className={cx([listboxItemVariants({ variant: 'popup' }), optionRowSizes[size]], className)}
      {...props}
    >
      <OptionRow variant="popup" icon={icon} description={description} descriptionId={described.id} Indicator={SelectItemIndicator} ItemIcon={SelectItemIcon}>
        {children}
      </OptionRow>
    </SdkSelectItem>
  );
}

/** A group of options, named by its `SelectGroupLabel`. */
export function SelectGroup({ className, ...props }: ComponentProps<typeof SdkSelectGroup>) {
  return <SdkSelectGroup className={cx(optionGroupClass, className)} {...props} />;
}

export function SelectGroupLabel({ className, ...props }: ComponentProps<typeof SdkSelectGroupLabel>) {
  return <SdkSelectGroupLabel className={cx(optionGroupLabelClass, className)} {...props} />;
}

/** A hairline between options or groups, hidden from screen readers. */
export function SelectSeparator({ className, ...props }: ComponentProps<typeof SdkSelectSeparator>) {
  return <SdkSelectSeparator className={cx(optionSeparatorClass, className)} {...props} />;
}

const selectParts: ListDataParts = { Item: SelectItem, Group: SelectGroup, GroupLabel: SelectGroupLabel, Separator: SelectSeparator };

export { createSelectController } from '@ui-sdk/react/select';
export type { SelectController } from '@ui-sdk/react/select';
