'use client';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ComponentProps } from 'react';
import {
  DatePicker as SdkDatePicker,
  DatePickerClear as SdkDatePickerClear,
  DatePickerContent as SdkDatePickerContent,
  DatePickerHint as SdkDatePickerHint,
  DatePickerInput as SdkDatePickerInput,
  DatePickerPreset as SdkDatePickerPreset,
  DatePickerTrigger as SdkDatePickerTrigger,
  type DatePickerClearState,
  type DatePickerMode,
} from '@ui-sdk/react/date-picker';
import type { PartProps } from '@ui-sdk/react/primitive';
import { cva, type VariantProps } from 'class-variance-authority';
import { buttonVariants } from '@/components/ui/button';
import { CalendarGrid, CalendarHeader, type CalendarValue } from '@/components/ui/calendar';
import { popoverContentVariants } from '@/components/ui/popover';
import { Icon } from '@/lib/icon';
import { selectableText } from '@/lib/primitives';
import { scopeStyle, useLayerHost, useThemeScopeProps } from '@/lib/theme';
import { usePresentation } from '@/lib/container';
import { cn, cx } from '@/lib/utils';

/* ══ DatePicker — UI SDK's Date Picker: a text input that reads a date typed in the locale's order (on Enter or
   blur), and a calendar button that opens a Calendar in a popup. Typing and picking edit the same value, an ISO
   string ("2026-09-09"); `mode="range"` holds `[start, end]`, with an input for each end. The popup closes when a
   day (or a range's end) is chosen, Esc closes it and focus returns to the button.
   <Field>
     <FieldLabel variant="field">Date</FieldLabel>
     <DatePicker defaultValue="2026-09-09">
       <DatePickerField />
       <DatePickerContent />
     </DatePicker>
     <FieldError />
   </Field>
   Every Calendar part works inside DatePickerContent, so its children can be your own header, grids and presets. ══ */

/** What the layout parts share: the mode and months (which decide the default field and popup) and the field's
    element, which the popup anchors to. */
interface PickerLayout {
  mode: DatePickerMode;
  months: number;
  field: HTMLElement | null;
  setField: (element: HTMLElement | null) => void;
}
const PickerLayoutContext = createContext<PickerLayout | null>(null);

type SdkDatePickerProps = ComponentProps<typeof SdkDatePicker>;

/** UI SDK's Date Picker props, with `value`, `defaultValue` and `onValueChange` narrowed to the `mode`: a date or
    `null`, or a `[start, end]` pair or `null`. */
export type DatePickerProps<Mode extends DatePickerMode = 'single'> = Omit<SdkDatePickerProps, 'mode' | 'value' | 'defaultValue' | 'onValueChange'> & {
  /** `single` (default) picks one date; `range` picks a start and an end, with an input for each. */
  mode?: Mode;
  value?: CalendarValue<Mode>;
  defaultValue?: CalendarValue<Mode>;
  onValueChange?: (value: CalendarValue<Mode>, details: Parameters<NonNullable<SdkDatePickerProps['onValueChange']>>[1]) => void;
};

export function DatePicker<Mode extends DatePickerMode = 'single'>({
  className,
  mode,
  months = 1,
  // As in Calendar: each grid shows its own month only, unless asked.
  showOutsideDays = false,
  // As in Calendar: one letter per weekday.
  weekdayFormat = 'narrow',
  container,
  presentation,
  onValueChange,
  ref,
  children,
  ...props
}: DatePickerProps<Mode>) {
  const host = useLayerHost();
  // Gap (gaps/dates.md #1): a Field re-reads its control's validity only on an `input` or `change` event inside it,
  // and a day picked from the calendar, a preset, Clear or a controller write fires none. So after such a change
  // the picker fires `change` from its root, once the new value is written, and a required error clears at once.
  const root = useRef<HTMLDivElement | null>(null);
  const setRoot = useCallback((element: HTMLDivElement | null) => {
    root.current = element;
    if (typeof ref === 'function') return ref(element);
    if (ref) (ref as { current: HTMLDivElement | null }).current = element;
  }, [ref]);
  const valueChange: SdkDatePickerProps['onValueChange'] = (value, details) => {
    (onValueChange as SdkDatePickerProps['onValueChange'])?.(value, details);
    // Typing commits through the input's own events, which the Field already hears.
    if (details.reason === 'input-commit') return;
    queueMicrotask(() => root.current?.dispatchEvent(new Event('change', { bubbles: true })));
  };
  // "auto" follows the nearest size class around (a sheet when compact), even when the content is portaled.
  const shown = usePresentation(presentation, 'popover');
  const [field, setField] = useState<HTMLElement | null>(null);
  const layout = useMemo<PickerLayout>(() => ({ mode: mode ?? 'single', months, field, setField }), [mode, months, field]);
  return (
    <PickerLayoutContext.Provider value={layout}>
      <SdkDatePicker
        mode={mode}
        months={months}
        showOutsideDays={showOutsideDays}
        weekdayFormat={weekdayFormat}
        container={container === undefined ? host : container}
        presentation={shown}
        className={cx('group/date-picker flex min-w-0 flex-col gap-1.5', className)}
        {...(props as SdkDatePickerProps)}
        ref={setRoot}
        onValueChange={valueChange}
      >
        {children ?? (
          <>
            <DatePickerField />
            <DatePickerContent />
          </>
        )}
      </SdkDatePicker>
    </PickerLayoutContext.Provider>
  );
}

export const datePickerFieldVariants = cva(
  [
    'flex min-w-0 items-center gap-1 bg-input pl-3 pr-1.5 text-foreground outline-none transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy',
    'focus-within:bg-transparent focus-within:ring-[1.5px] focus-within:ring-primary focus-within:ring-inset',
    'group-data-open/date-picker:bg-transparent group-data-open/date-picker:ring-[1.5px] group-data-open/date-picker:ring-primary group-data-open/date-picker:ring-inset',
    'has-aria-invalid:ring-[1.5px] has-aria-invalid:ring-destructive has-aria-invalid:ring-inset group-data-disabled/date-picker:cursor-not-allowed group-data-disabled/date-picker:opacity-50',
  ],
  {
    variants: {
      size: {
        sm: 'h-8 rounded-lg text-subhead',
        default: 'h-11 rounded-ctl text-body',
        lg: 'h-[50px] rounded-xl text-body',
      },
    },
    defaultVariants: { size: 'default' },
  },
);

export interface DatePickerFieldProps extends Omit<ComponentProps<'div'>, 'ref'>, VariantProps<typeof datePickerFieldVariants> {}

/** The filled field: the input (a start and an end with a dash between, in range mode) and the calendar button.
    The popup opens under it. Pass children to lay out your own DatePickerInput, DatePickerClear and
    DatePickerTrigger, and to name the inputs (`aria-label`) when there is no FieldLabel. */
export function DatePickerField({ className, size, children, ...props }: DatePickerFieldProps) {
  const layout = useContext(PickerLayoutContext);
  return (
    <div ref={layout?.setField} data-slot="date-picker-field" className={cn(datePickerFieldVariants({ size }), className)} {...props}>
      {children ??
        (layout?.mode === 'range' ? (
          <>
            <DatePickerInput aria-label="Start date" />
            <span aria-hidden="true" className="px-1 text-muted-foreground">–</span>
            <DatePickerInput end aria-label="End date" />
            <DatePickerTrigger />
          </>
        ) : (
          <>
            <DatePickerInput aria-label="Date" />
            <DatePickerTrigger />
          </>
        ))}
    </div>
  );
}

/** The text input, bare: DatePickerField draws the box around it. `end` makes it a range's end. In a Field the
    label names it (a range's start); otherwise give it an `aria-label`. */
export function DatePickerInput({ className, ...props }: ComponentProps<typeof SdkDatePickerInput>) {
  return (
    <SdkDatePickerInput
      className={cx(
        ['h-full min-w-0 flex-1 border-0 bg-transparent p-0 [font:inherit] text-inherit tabular-nums outline-none placeholder:text-tertiary-foreground data-disabled:cursor-not-allowed', selectableText],
        className,
      )}
      {...props}
    />
  );
}

const fieldButton = cn(buttonVariants({ variant: 'quiet', size: 'icon' }), 'size-8 shrink-0');

/** The calendar button: opens the popup. Named "Choose date" and the date chosen; pass `aria-label` in another
    language. */
export function DatePickerTrigger({ className, children, ...props }: ComponentProps<typeof SdkDatePickerTrigger>) {
  return (
    <SdkDatePickerTrigger className={cx(fieldButton, className)} {...props}>
      {children ?? <Icon name="calendar" size={18} />}
    </SdkDatePickerTrigger>
  );
}

/** Clears the value and focuses the input. Hidden while there is nothing to clear. */
export function DatePickerClear({ className, children, 'aria-label': ariaLabel = 'Clear', ...props }: PartProps<'button', DatePickerClearState>) {
  return (
    <SdkDatePickerClear aria-label={ariaLabel} className={cx([fieldButton, 'data-empty:invisible'], className)} {...props}>
      {children ?? <Icon name="xmark-circle-fill" size={18} />}
    </SdkDatePickerClear>
  );
}

/** The format to type, like "MM/DD/YYYY", in the locale. The inputs are described by it. */
export function DatePickerHint({ className, ...props }: ComponentProps<typeof SdkDatePickerHint>) {
  return <SdkDatePickerHint className={cx('px-1 text-footnote leading-[18px] text-muted-foreground tabular-nums', className)} {...props} />;
}

/** A shortcut inside the popup ("Last 7 days"): selects the value it holds and closes the popup. */
export function DatePickerPreset({ className, ...props }: ComponentProps<typeof SdkDatePickerPreset>) {
  return (
    <SdkDatePickerPreset
      className={cx([buttonVariants({ variant: 'quiet', size: 'sm' }), 'data-selected:bg-secondary data-selected:text-foreground'], className)}
      {...props}
    />
  );
}

export type DatePickerContentProps = ComponentProps<typeof SdkDatePickerContent>;

/** The popup with the calendar, on the Popover's surface (a bottom sheet with `presentation="sheet"`, or `"auto"`
    in a compact container). Place it anywhere inside the DatePicker; it opens under the DatePickerField. Without
    children it holds a header and a grid per month; give it children to compose your own from the Calendar parts,
    with presets beside them. */
export function DatePickerContent({ className, style, anchor, sideOffset = 8, children, ...props }: DatePickerContentProps) {
  const layout = useContext(PickerLayoutContext);
  const scope = useThemeScopeProps();
  const months = Math.max(1, Math.floor(layout?.months ?? 1));
  return (
    <SdkDatePickerContent
      data-theme-scope={scope['data-theme-scope']}
      anchor={anchor ?? layout?.field ?? undefined}
      sideOffset={sideOffset}
      className={cx([popoverContentVariants({ variant: 'surface' }), 'max-w-(--available-width) min-w-0 overflow-auto p-3', scope.className], className)}
      style={scopeStyle(scope.style, style)}
      {...props}
    >
      {children ?? (
        <>
          <CalendarHeader />
          <div className="flex gap-6">
            {Array.from({ length: months }, (_, offset) => <CalendarGrid key={offset} offset={offset} />)}
          </div>
        </>
      )}
    </SdkDatePickerContent>
  );
}

export { createDatePickerController } from '@ui-sdk/react/date-picker';
export type { DatePickerController, DatePickerMode, DatePickerValue } from '@ui-sdk/react/date-picker';
