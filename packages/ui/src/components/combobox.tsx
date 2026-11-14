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
  ComboboxTrigger,
  ComboboxValue,
  type ComboboxContentState,
  type ComboboxProps as SdkComboboxProps,
  type ComboboxValueState,
} from '@ui-sdk/react/combobox';
import type { VariantProps } from 'class-variance-authority';
import { labelVariants } from '@/components/ui/label';
import {
  ListboxRow, ListDataItems, listboxGroupClass, listboxGroupLabelClass, listboxItemVariants, listboxSeparatorClass, listboxSheetClass,
  listboxVariants, optionLabel, type ListboxRowProps, type ListDataParts,
} from '@/components/ui/list-box';
import { popoverMotion, popoverSurface, selectableText } from '@/lib/primitives';
import { scopeStyle, useLayerHost, useThemeScopeProps } from '@/lib/theme';
import { usePresentation } from '@/lib/container';
import { cn, cx } from '@/lib/utils';

/* ══ Combobox — UI SDK's Combobox: a text field that filters a list as you type ══
   The value is an option (`value` / `defaultValue` / `onValueChange`, a list with `multiple`); the text is only a
   query (`query` / `onQueryChange`). Arrow keys open the list and move, Enter chooses, Esc closes and brings the
   chosen label back. The root renders no element: lay the label and the field out with a Field.
   <Field>
     <FieldLabel variant="field">City</FieldLabel>
     <Combobox>
       <ComboboxInput placeholder="Search cities" />
       <ComboboxContent>
         <ComboboxEmpty>No cities found.</ComboboxEmpty>
         <ComboboxList>{cities.map((c) => <ComboboxItem key={c} value={c}>{c}</ComboboxItem>)}</ComboboxList>
       </ComboboxContent>
     </Combobox>
   </Field>
   Options can be data too: `<Combobox items={cities}>` with an empty `<ComboboxContent />`.
   With `multiple`, `<ComboboxInput chips />` shows the chosen options as removable chips before the text;
   `clearable` adds UI SDK's Clear button. `ComboboxStatus` is the loading or error line of an async list. ══ */

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
  return (
    <AnchorContext.Provider value={field}>
      <SdkCombobox<T, Multiple> container={container === undefined ? host : container} presentation={shown} {...(props as ComboboxProps<T, Multiple>)}>
        {children}
        {props.items ? <PlacedContent><SdkComboboxContent /></PlacedContent> : null}
      </SdkCombobox>
    </AnchorContext.Provider>
  );
}

export type ComboboxLabelProps = ComponentProps<typeof SdkComboboxLabel> & VariantProps<typeof labelVariants>;

/** A label for a combobox that is not in a Field, in Label's variants. */
export function ComboboxLabel({ className, variant, ...props }: ComboboxLabelProps) {
  return <SdkComboboxLabel className={cx(labelVariants({ variant }), className)} {...props} />;
}

export type ComboboxInputProps = ComponentProps<typeof SdkComboboxInput> & {
  /** Classes for the field around the input and its button. */
  groupClassName?: string;
  /** The disclosure button's accessible name. Default "Show options". */
  triggerLabel?: string;
  /** With `multiple`: the chosen options as chips before the text (UI SDK's ComboboxChips). `true` draws a
   *  `ComboboxChip` for each; a function draws your own from the value's state. Arrow keys move between chips, and
   *  Backspace in the empty input removes the last. */
  chips?: boolean | ((state: ComboboxValueState) => ReactNode);
  /** Adds UI SDK's Clear button, shown while there is a selection or a query; it clears both and keeps focus. */
  clearable?: boolean;
  /** The Clear button's accessible name. Default "Clear". */
  clearLabel?: string;
};

/** The default chip row: a chip per chosen option, in the order they were chosen. */
const defaultChips = (state: ComboboxValueState) =>
  (Array.isArray(state.value) ? state.value : []).map((value, i) => (
    <ComboboxChip key={String(value)} value={value}>{state.labels[i]}</ComboboxChip>
  ));

/** The input and its disclosure button, drawn as one iOS filled field. The button is for the pointer: it stays out of
 *  the tab order. */
export function ComboboxInput({ className, groupClassName, triggerLabel = 'Show options', chips, clearable, clearLabel = 'Clear', ...props }: ComboboxInputProps) {
  const field = useContext(AnchorContext);
  const input = (
    <SdkComboboxInput
      className={cx(
        [
          'h-full min-w-0 flex-1 border-0 bg-transparent pr-1 pl-3 [font-family:inherit] text-body text-foreground outline-none placeholder:text-tertiary-foreground',
          chips && 'h-8 min-w-20 pl-1.5',
          selectableText,
        ],
        className,
      )}
      {...props}
    />
  );
  return (
    <div
      ref={field?.[1]}
      className={cn(
        'box-border flex w-full items-center rounded-ctl bg-input transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy',
        chips ? 'min-h-11' : 'h-11',
        'focus-within:bg-transparent focus-within:shadow-[inset_0_0_0_1.5px_var(--primary)]',
        'has-[input[data-invalid]]:shadow-[inset_0_0_0_1.5px_var(--destructive)] has-[input:disabled]:opacity-50',
        groupClassName,
      )}
    >
      {chips ? (
        <SdkComboboxChips className="flex min-w-0 flex-1 flex-wrap items-center gap-1 py-1.5 pl-1.5">
          <ComboboxValue>{chips === true ? defaultChips : chips}</ComboboxValue>
          {input}
        </SdkComboboxChips>
      ) : input}
      {clearable ? (
        <SdkComboboxClear
          aria-label={clearLabel}
          className="bl-btn grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg border-0 bg-transparent p-0 text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45 active:bg-accent"
        >
          <CrossGlyph size={14} />
        </SdkComboboxClear>
      ) : null}
      <ComboboxTrigger
        aria-label={triggerLabel}
        className="bl-btn group/trigger mr-1 grid size-9 shrink-0 cursor-pointer place-items-center rounded-lg border-0 bg-transparent p-0 text-muted-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45 active:bg-accent"
      >
        <svg viewBox="0 0 24 24" width={16} height={16} aria-hidden="true" className="transition-transform duration-spring-snappy ease-spring-snappy group-data-open/trigger:rotate-180 motion-reduce:transition-none">
          <path d="M6.5 9.5l5.5 5.5 5.5-5.5" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </ComboboxTrigger>
    </div>
  );
}

export type ComboboxContentProps = ComponentProps<typeof SdkComboboxContent>;

/** The popup: 8px under the field and as wide as it. Put a `ComboboxList` in it, and a `ComboboxEmpty` beside the
 *  list; without children it is a `ComboboxList` of the combobox's `items`. As a sheet (`presentation` on the
 *  Combobox) it is full width, with the input in its header. */
export function ComboboxContent({ className, style, sideOffset = 8, anchor, children, ...props }: ComboboxContentProps) {
  const scope = useThemeScopeProps();
  const field = useContext(AnchorContext);
  return (
    <SdkComboboxContent
      data-theme-scope={scope['data-theme-scope']}
      sideOffset={sideOffset}
      anchor={anchor ?? field?.[0]}
      className={cx(
        [
          popoverSurface, popoverMotion, 'box-border flex w-(--anchor-width) flex-col',
          // Nothing to show (no option matches and no empty or status message): no empty bubble.
          '[&:not(:has([data-slot=combobox-item]:not([hidden]),[data-empty],[data-slot=combobox-status]:not(:empty)))]:hidden',
          listboxSheetClass, scope.className,
        ],
        className,
      )}
      style={scopeStyle(scope.style, style)}
      {...props}
    >
      {children ?? <ComboboxList />}
    </SdkComboboxContent>
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

function CrossGlyph({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" />
    </svg>
  );
}

export type ComboboxChipProps<T = string> = Omit<ComponentProps<typeof SdkComboboxChip<T>>, 'children'> & {
  /** What the chip says. Default: the option's label. */
  children?: ReactNode;
  /** The remove button's accessible name. Default "Remove <label>". */
  removeLabel?: string;
};

/** One chosen option of a `multiple` combobox, as a pill with its remove button. Put it in `ComboboxInput`'s `chips`. */
export function ComboboxChip<T = string>({ className, removeLabel, children, ...props }: ComboboxChipProps<T>) {
  return (
    <SdkComboboxChip<T>
      className={cx(
        'inline-flex h-7 max-w-full items-center gap-0.5 rounded-full bg-secondary pr-0.5 pl-2.5 text-subhead text-secondary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring',
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
      {children ?? <CrossGlyph size={12} />}
    </SdkComboboxChipRemove>
  );
}

/** The list's loading or error line, announced as it changes (UI SDK's ComboboxStatus). Empty, it takes no room. */
export function ComboboxStatus({ className, ...props }: ComponentProps<typeof SdkComboboxStatus>) {
  return <SdkComboboxStatus className={cx('px-3 py-2 text-subhead text-muted-foreground empty:hidden', className)} {...props} />;
}

/** Shown, and announced, while no option matches. */
export function ComboboxEmpty({ className, ...props }: ComponentProps<typeof SdkComboboxEmpty>) {
  return <SdkComboboxEmpty className={cx('px-3 py-2 text-subhead text-muted-foreground empty:hidden', className)} {...props} />;
}

export type ComboboxItemProps<T = string> = Omit<ComponentProps<typeof SdkComboboxItem<T>>, 'children'> & ListboxRowProps;

/** An option. `value` is what the combobox's value becomes; `label` is the text the input shows and filtering matches
 *  when the children are not plain text, and `keywords` are more words that match. */
export function ComboboxItem<T = string>({ className, icon, description, label, children, ...props }: ComboboxItemProps<T>) {
  return (
    <SdkComboboxItem<T> label={optionLabel(label, children)} className={cx(listboxItemVariants({ variant: 'popup' }), className)} {...props}>
      <ListboxRow variant="popup" icon={icon} description={description} Indicator={ComboboxItemIndicator} ItemIcon={ComboboxItemIcon}>
        {children}
      </ListboxRow>
    </SdkComboboxItem>
  );
}

/** A group of options, named by its `ComboboxGroupLabel`, hidden while none of them matches. */
export function ComboboxGroup({ className, ...props }: ComponentProps<typeof SdkComboboxGroup>) {
  return <SdkComboboxGroup className={cx(listboxGroupClass, className)} {...props} />;
}

export function ComboboxGroupLabel({ className, ...props }: ComponentProps<typeof SdkComboboxGroupLabel>) {
  return <SdkComboboxGroupLabel className={cx(listboxGroupLabelClass, className)} {...props} />;
}

/** A hairline between options or groups, hidden from screen readers. */
export function ComboboxSeparator({ className, ...props }: ComponentProps<typeof SdkComboboxSeparator>) {
  return <SdkComboboxSeparator className={cx(listboxSeparatorClass, className)} {...props} />;
}

const comboboxParts: ListDataParts = { Item: ComboboxItem, Group: ComboboxGroup, GroupLabel: ComboboxGroupLabel, Separator: ComboboxSeparator };

export { createComboboxController } from '@ui-sdk/react/combobox';
export type { ComboboxController } from '@ui-sdk/react/combobox';
