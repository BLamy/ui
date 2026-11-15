'use client';
import { createContext, useContext, useState, type ComponentProps, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import {
  Combobox as SdkCombobox,
  ComboboxChip as SdkComboboxChip,
  ComboboxChipRemove as SdkComboboxChipRemove,
  ComboboxChips as SdkComboboxChips,
  ComboboxClear as SdkComboboxClear,
  ComboboxContent as SdkComboboxContent,
  ComboboxEmpty as SdkComboboxEmpty,
  ComboboxGroup as SdkComboboxGroup,
  ComboboxGroupLabel as SdkComboboxGroupLabel,
  ComboboxInput as SdkComboboxInput,
  ComboboxItem as SdkComboboxItem,
  ComboboxItemIcon,
  ComboboxItemIndicator,
  ComboboxLabel as SdkComboboxLabel,
  ComboboxList as SdkComboboxList,
  ComboboxSeparator as SdkComboboxSeparator,
  ComboboxStatus as SdkComboboxStatus,
  ComboboxTrigger as SdkComboboxTrigger,
  ComboboxValue,
  type ComboboxContentState,
  type ComboboxProps as SdkComboboxProps,
  type ComboboxValueState,
} from '@ui-sdk/react/combobox';
import type { VariantProps } from 'class-variance-authority';
import { EmptyState, type EmptyStateProps } from '@/components/ui/empty-state';
import { fieldSurfaceVariants } from '@/components/ui/input';
import { labelVariants } from '@/components/ui/label';
import { listboxItemVariants, listboxVariants } from '@/components/ui/listbox';
import { Icon } from '@/lib/icon';
import {
  ListDataItems, OptionRow, OptionRowSizeContext, PickerFieldSizeContext, optionGroupClass, optionGroupLabelClass, optionLabel, optionRowSizes,
  optionSeparatorClass, optionSheetClass, useOptionDescription, useOptionRowSize, usePickerFieldSize, useReportFieldSize,
  type ListDataParts, type OptionRowProps, type OptionRowSize,
} from '@/lib/option-row';
import { useTriggerPalette, type PopupPalette } from '@/lib/trigger-palette';
import { popoverMotion, popoverSurface, selectableText, valueChip } from '@/lib/primitives';
import { scopeStyle, useLayerHost, useThemeScopeProps } from '@/lib/theme';
import { usePresentation } from '@/lib/container';
import { cn, cx } from '@/lib/utils';

/* ══ Combobox — UI SDK's Combobox: a text field that filters a list as you type ══
   The value is an option (`value` / `defaultValue` / `onValueChange`, a list with `multiple`); the text is only a
   query (`query` / `onQueryChange`). Arrow keys open the list and move, Enter chooses, Esc closes and brings the
   chosen label back. The root renders no element: lay the label and the field out with a Field.
   <Field>
     <FieldLabel>City</FieldLabel>
     <Combobox>
       <ComboboxInputGroup>
         <ComboboxInput placeholder="Search cities" />
         <ComboboxTrigger />
       </ComboboxInputGroup>
       <ComboboxContent>
         <ComboboxEmpty>No cities found.</ComboboxEmpty>
         <ComboboxList>{cities.map((c) => <ComboboxItem key={c} value={c}>{c}</ComboboxItem>)}</ComboboxList>
       </ComboboxContent>
     </Combobox>
   </Field>
   Options can be data too: `<Combobox items={cities}>` with an empty `<ComboboxContent />`, and an empty
   `<ComboboxInputGroup />` is an input and its disclosure button. With `multiple`, put the input in a `ComboboxChips` to
   show the chosen options as removable chips before the text; a `ComboboxClear` empties the choice and the text.
   `ComboboxStatus` is the loading or error line of an async list. ══ */

/** The field around the input: what the popup hangs from and matches in width. */
const AnchorContext = createContext<[HTMLElement | null, Dispatch<SetStateAction<HTMLElement | null>>] | null>(null);

export type ComboboxProps<T = string, Multiple extends boolean | undefined = false> = SdkComboboxProps<T, Multiple>;

/** Never rendered. Its child tells UI SDK's root, which looks through its markup for a content part, that one is
    placed: ours, which draws the data. Otherwise a data combobox that starts open mounts UI SDK's bare content beside
    ours for one commit, and the options that mounted twice lose their keyboard wiring. */
const PlacedContent: (props: { children: ReactNode }) => null = () => null;

export function Combobox<T = string, Multiple extends boolean | undefined = false>({ container, presentation, children, ...props }: ComboboxProps<T, Multiple>) {
  const host = useLayerHost();
  // "auto" follows the nearest size class around (a sheet when compact), even when the content is portaled.
  const shown = usePresentation(presentation, 'popover');
  const field = useState<HTMLElement | null>(null);
  const fieldSize = usePickerFieldSize();
  return (
    <AnchorContext.Provider value={field}>
      <PickerFieldSizeContext.Provider value={fieldSize}>
        <SdkCombobox<T, Multiple> container={container === undefined ? host : container} presentation={shown} {...(props as ComboboxProps<T, Multiple>)}>
          {children}
          {props.items ? <PlacedContent><SdkComboboxContent /></PlacedContent> : null}
        </SdkCombobox>
      </PickerFieldSizeContext.Provider>
    </AnchorContext.Provider>
  );
}

export type ComboboxLabelProps = ComponentProps<typeof SdkComboboxLabel> & VariantProps<typeof labelVariants>;

/** A label for a combobox that is not in a Field, in Label's variants. */
export function ComboboxLabel({ className, variant, ...props }: ComboboxLabelProps) {
  return <SdkComboboxLabel className={cx(labelVariants({ variant }), className)} {...props} />;
}

/* With chips in it the field grows a line at a time, from its height as the least. */
const chipsHeight = {
  sm: 'has-data-[slot=combobox-chips]:min-h-8',
  default: 'has-data-[slot=combobox-chips]:min-h-11',
  lg: 'has-data-[slot=combobox-chips]:min-h-[50px]',
} as const;

/* The kit's field surface, keeping its edge while the list is open (the input's `aria-expanded`). */
const comboboxField = [
  'w-full gap-0 pe-1',
  'has-[[data-slot=combobox-input][aria-expanded=true]]:bg-transparent has-[[data-slot=combobox-input][aria-expanded=true]]:shadow-[inset_0_0_0_1.5px_var(--primary)]',
  'has-[[data-slot=combobox-input][aria-invalid=true]]:shadow-[inset_0_0_0_1.5px_var(--destructive)]',
  'has-data-[slot=combobox-chips]:h-auto has-data-[slot=combobox-chips]:ps-1.5',
];

export interface ComboboxInputGroupProps extends ComponentProps<'div'>, VariantProps<typeof fieldSurfaceVariants> {}

/** The field: the kit's filled field box (`fieldSurfaceVariants`, `size` sm / default / lg), which the popup hangs
 *  from and matches in width, and which keeps its edge while the list is open. Without children it is a `ComboboxInput` and a
 *  `ComboboxTrigger`; pass children to lay out your own (`ComboboxChips`, `ComboboxInput`, `ComboboxClear`,
 *  `ComboboxTrigger`). */
export function ComboboxInputGroup({ className, size, children, ref, ...props }: ComboboxInputGroupProps) {
  const field = useContext(AnchorContext);
  useReportFieldSize(size);
  return (
    <div
      ref={(el) => {
        field?.[1](el);
        if (typeof ref === 'function') return ref(el);
        if (ref) ref.current = el;
      }}
      data-slot="combobox-input-group"
      data-size={size ?? 'default'}
      className={cn(fieldSurfaceVariants({ size }), comboboxField, chipsHeight[size ?? 'default'], className)}
      {...props}
    >
      {children ?? (
        <>
          <ComboboxInput />
          <ComboboxTrigger />
        </>
      )}
    </div>
  );
}

/** The text input, bare: the ComboboxInputGroup draws the box around it. In a Field the label names it. */
export function ComboboxInput({ className, ...props }: ComponentProps<typeof SdkComboboxInput>) {
  return (
    <SdkComboboxInput
      className={cx(
        [
          'h-full min-w-0 flex-1 border-0 bg-transparent p-0 [font:inherit] text-foreground outline-none placeholder:text-tertiary-foreground',
          'in-data-[slot=combobox-chips]:h-8 in-data-[slot=combobox-chips]:min-w-20 in-data-[slot=combobox-chips]:ps-1',
          selectableText,
        ],
        className,
      )}
      {...props}
    />
  );
}

/* The small buttons inside the field: no ring of their own beside the field's edge, a fill under the keyboard. */
const fieldButton =
  'bl-btn grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg border-0 bg-transparent p-0 text-muted-foreground outline-none focus-visible:bg-secondary focus-visible:text-foreground active:bg-accent in-data-[size=sm]:size-7';

/** The disclosure button, for the pointer: it opens and closes the list and stays out of the tab order (the arrow keys
 *  open the list from the input). Named "Show options"; pass `aria-label` in another language. */
export function ComboboxTrigger({ className, children, 'aria-label': ariaLabel = 'Show options', ...props }: ComponentProps<typeof SdkComboboxTrigger>) {
  return (
    <SdkComboboxTrigger aria-label={ariaLabel} className={cx(['group/trigger', fieldButton], className)} {...props}>
      {children ?? (
        <Icon name="chevron-down" size={16} sw={2.2} className="transition-transform duration-spring-snappy ease-spring-snappy group-data-open/trigger:rotate-180 motion-reduce:transition-none" />
      )}
    </SdkComboboxTrigger>
  );
}

/** UI SDK's Clear button: shown while there is a choice or a query, it empties both and keeps focus in the input.
 *  Named "Clear"; pass `aria-label` in another language. */
export function ComboboxClear({ className, children, 'aria-label': ariaLabel = 'Clear', ...props }: ComponentProps<typeof SdkComboboxClear>) {
  return (
    <SdkComboboxClear aria-label={ariaLabel} className={cx(fieldButton, className)} {...props}>
      {children ?? <Icon name="xmark-circle-fill" size={18} />}
    </SdkComboboxClear>
  );
}

/** The default chip row: a chip per chosen option, in the order they were chosen. */
const defaultChips = (state: ComboboxValueState) =>
  (Array.isArray(state.value) ? state.value : []).map((value, i) => (
    <ComboboxChip key={String(value)} value={value}>{state.labels[i]}</ComboboxChip>
  ));

export type ComboboxChipsProps = Omit<ComponentProps<typeof SdkComboboxChips>, 'children'> & {
  /** What follows the chips: the `ComboboxInput`. */
  children?: ReactNode;
  /** Draws the chips from the value's state; default a `ComboboxChip` for each chosen option. */
  renderChips?: (state: ComboboxValueState) => ReactNode;
};

/** With `multiple`: the chosen options as chips, then the input (its children). The arrow keys move between chips,
 *  and Backspace in the empty input removes the last. Put it in a ComboboxInputGroup. */
export function ComboboxChips({ className, children, renderChips = defaultChips, ...props }: ComboboxChipsProps) {
  return (
    <SdkComboboxChips className={cx('flex min-w-0 flex-1 flex-wrap items-center gap-1 py-1.5', className)} {...props}>
      <ComboboxValue>{renderChips}</ComboboxValue>
      {children ?? <ComboboxInput />}
    </SdkComboboxChips>
  );
}

export type ComboboxContentProps = ComponentProps<typeof SdkComboboxContent> & {
  /** `sm`: 32px rows in footnote text. Default: the field's (a `sm` ComboboxInputGroup opens `sm` rows), as in Select. */
  size?: OptionRowSize;
  /** Where the colors come from: the ThemeScope it was opened from (`scope`, the default), or the field's element
      (`trigger`), for a field on a surface that CSS paints rather than a ThemeScope (see `useTriggerPalette`). */
  palette?: PopupPalette;
};

/** The popup: 8px under the field and as wide as it. Put a `ComboboxList` in it, and a `ComboboxEmpty` beside the
 *  list; without children it is a `ComboboxList` of the combobox's `items`. As a sheet (`presentation` on the
 *  Combobox) it is full width, with the input in its header. */
export function ComboboxContent({ className, style, sideOffset = 8, anchor, size: sizeProp, palette = 'scope', ref, children, ...props }: ComboboxContentProps) {
  const size = useOptionRowSize(sizeProp);
  const scope = useThemeScopeProps();
  const field = useContext(AnchorContext);
  // The field box is the "trigger" a combobox's popup takes its palette from.
  const trigger = useTriggerPalette(palette === 'trigger', ref, field?.[0]);
  const colors = trigger.props ?? scope;
  return (
    <OptionRowSizeContext.Provider value={size}>
      <SdkComboboxContent
        ref={trigger.ref}
        data-theme-scope={colors['data-theme-scope']}
        data-size={size}
        sideOffset={sideOffset}
        anchor={anchor ?? field?.[0]}
        className={cx(
          [
            popoverSurface, popoverMotion, 'box-border flex w-(--anchor-width) flex-col',
            // Nothing to show (no option matches and no empty or status message): no empty bubble.
            '[&:not(:has([data-slot=combobox-item]:not([hidden]),[data-empty],[data-slot=combobox-status]:not(:empty)))]:hidden',
            optionSheetClass, colors.className,
          ],
          className,
        )}
        style={scopeStyle(colors.style, style)}
        {...props}
      >
        {children ?? <ComboboxList />}
      </SdkComboboxContent>
    </OptionRowSizeContext.Provider>
  );
}

/** The options. Without children it draws the combobox's `items` that match. */
export function ComboboxList({ className, children, ...props }: ComponentProps<typeof SdkComboboxList>) {
  return (
    <SdkComboboxList className={cx([listboxVariants({ variant: 'popup' }), 'min-h-0 [&:not(:has([data-slot=combobox-item]:not([hidden])))]:hidden'], className)} {...props}>
      {children ?? ((state: ComboboxContentState) => <ListDataItems items={state.items} parts={comboboxParts} />)}
    </SdkComboboxList>
  );
}

export type ComboboxChipProps<T = string> = Omit<ComponentProps<typeof SdkComboboxChip<T>>, 'children'> & {
  /** What the chip says. Default: the option's label. */
  children?: ReactNode;
  /** The remove button's accessible name. Default "Remove <label>". */
  removeLabel?: string;
};

/** One chosen option of a `multiple` combobox, as a pill with its remove button. `ComboboxChips` draws one per option. */
export function ComboboxChip<T = string>({ className, removeLabel, children, ...props }: ComboboxChipProps<T>) {
  return (
    <SdkComboboxChip<T>
      className={cx(
        [valueChip, 'ps-2.5'],
        className,
      )}
      {...props}
    >
      {(state) => (
        <>
          <span className="truncate">{children ?? state.label}</span>
          <ComboboxChipRemove aria-label={removeLabel ?? `Remove ${state.label}`} />
        </>
      )}
    </SdkComboboxChip>
  );
}

/** A chip's remove button: a small cross, out of the tab order (Backspace and the arrow keys reach the chips). */
export function ComboboxChipRemove({ className, children, ...props }: ComponentProps<typeof SdkComboboxChipRemove>) {
  return (
    <SdkComboboxChipRemove
      className={cx('grid size-6 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-muted-foreground outline-none hover:bg-accent disabled:hidden', className)}
      {...props}
    >
      {children ?? <Icon name="xmark" size={10} sw={2.6} />}
    </SdkComboboxChipRemove>
  );
}

/** The list's loading or error line, announced as it changes (UI SDK's ComboboxStatus). Empty, it takes no room. */
export function ComboboxStatus({ className, ...props }: ComponentProps<typeof SdkComboboxStatus>) {
  return <SdkComboboxStatus className={cx('px-3 py-2 text-subhead text-muted-foreground empty:hidden', className)} {...props} />;
}

export type ComboboxEmptyProps = Omit<ComponentProps<typeof SdkComboboxEmpty>, 'title'> & Pick<EmptyStateProps, 'icon' | 'description' | 'action'> & {
  /** What is missing (default "No results"). Text children say the same thing. */
  title?: ReactNode;
};

/** Shown, and announced, while no option matches: the kit's `EmptyState` (`icon`, `title`, `description`,
    `action`), the same props as `CommandMenuEmpty`. It goes beside the list, not in it. */
export function ComboboxEmpty({ className, icon, title, description, action, children, ...props }: ComboboxEmptyProps) {
  return (
    <SdkComboboxEmpty className={cx('empty:hidden', className)} {...props}>
      <EmptyState
        size="sm"
        icon={icon}
        title={title ?? (typeof children === 'function' ? undefined : children) ?? 'No results'}
        description={description}
        action={action}
      />
    </SdkComboboxEmpty>
  );
}

export type ComboboxItemProps<T = string> = Omit<ComponentProps<typeof SdkComboboxItem<T>>, 'children'> & OptionRowProps;

/** An option. `value` is what the combobox's value becomes; `label` is the text the input shows and filtering matches
 *  when the children are not plain text, and `keywords` are more words that match. */
export function ComboboxItem<T = string>({ className, icon, description, label, children, ...props }: ComboboxItemProps<T>) {
  const size = useContext(OptionRowSizeContext);
  const described = useOptionDescription(description);
  return (
    <SdkComboboxItem<T>
      label={optionLabel(label, children)}
      aria-describedby={described.describedBy}
      className={cx([listboxItemVariants({ variant: 'popup' }), optionRowSizes[size]], className)}
      {...props}
    >
      <OptionRow variant="popup" icon={icon} description={description} descriptionId={described.id} Indicator={ComboboxItemIndicator} ItemIcon={ComboboxItemIcon}>
        {children}
      </OptionRow>
    </SdkComboboxItem>
  );
}

/** A group of options, named by its `ComboboxGroupLabel`, hidden while none of them matches. */
export function ComboboxGroup({ className, ...props }: ComponentProps<typeof SdkComboboxGroup>) {
  return <SdkComboboxGroup className={cx(optionGroupClass, className)} {...props} />;
}

export function ComboboxGroupLabel({ className, ...props }: ComponentProps<typeof SdkComboboxGroupLabel>) {
  return <SdkComboboxGroupLabel className={cx(optionGroupLabelClass, className)} {...props} />;
}

/** A hairline between options or groups, hidden from screen readers. */
export function ComboboxSeparator({ className, ...props }: ComponentProps<typeof SdkComboboxSeparator>) {
  return <SdkComboboxSeparator className={cx(optionSeparatorClass, className)} {...props} />;
}

const comboboxParts: ListDataParts = { Item: ComboboxItem, Group: ComboboxGroup, GroupLabel: ComboboxGroupLabel, Separator: ComboboxSeparator };

export { createComboboxController } from '@ui-sdk/react/combobox';
export type { ComboboxController } from '@ui-sdk/react/combobox';
