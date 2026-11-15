'use client';
import { useState, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import { Input, InputClear, InputGroup, createInputController } from '@ui-sdk/react/input';
import { createParts } from '@ui-sdk/react/primitive';
import { cva, type VariantProps } from 'class-variance-authority';
import { Icon } from '@/lib/icon';
import { selectableText } from '@/lib/primitives';
import { fieldFocusRing } from '@/components/ui/input';
import { searchInput, type SearchInputSubmitDetails } from '@/lib/search-input-primitive';
import { cn } from '@/lib/utils';

export type { SearchInputSubmitDetails };

const { Root, Input: QueryInput } = createParts(searchInput, { root: 'div', input: 'input' });

/** The iOS search pill: a filled, rounded box with the glyph, the query and the Clear button in a row. Focus draws
 *  the same 1.5px inset primary ring as Input. `sm` (32px) is the compact sidebar and toolbar search; `default`
 *  (36px) the bar under a large title. */
export const searchInputVariants = cva(
  [
    'box-border flex min-w-0 items-center bg-secondary text-foreground transition-[box-shadow] duration-spring-snappy ease-spring-snappy',
    // The fill stays on focus, as on iOS; the focus line is the field's.
    fieldFocusRing, 'has-[input:disabled]:opacity-50',
  ],
  {
    variants: {
      size: {
        sm: 'h-8 gap-1.5 rounded-lg px-2 text-footnote',
        default: 'h-9 gap-[7px] rounded-[11px] px-[9px] text-body',
      },
    },
    defaultVariants: { size: 'default' },
  },
);

const ICON_SIZE = { sm: 14, default: 17 } as const;
const CLEAR_SIZE = { sm: 15, default: 18 } as const;

export interface SearchInputProps
  extends Omit<ComponentProps<typeof Input>, 'type' | 'render' | 'children' | 'onSubmit' | 'className' | 'style' | 'size'>,
    VariantProps<typeof searchInputVariants> {
  /** Enter pressed. With it, Enter no longer submits the form around the field. */
  onSubmit?: (value: string, details: SearchInputSubmitDetails) => void;
  /** The leading glyph. Default: the magnifier, sized for `size`; `null` shows none. */
  icon?: ReactNode;
  /** Show the Clear (×) button while there is a query. Escape clears either way. Default: true. */
  clearable?: boolean;
  /** Styles the pill around the input. */
  className?: string;
  style?: CSSProperties;
}

/** iOS search field: UI SDK's Input in an InputGroup with a magnifier and a Clear button, plus the search keys
 *  (Escape clears a query, Enter submits; `onSubmit(value, details)` gets `reason`, `source` and `cancel()`). Its props
 *  are the Input's: `value` / `defaultValue` / `onValueChange(value, details)`, where a clear reports `clear-press`, a
 *  `controller`, `disabled`, `name`… The Clear button stays out of the Tab order: Escape is its keyboard route, so Tab
 *  goes straight to the results. */
export function SearchInput({
  controller, onSubmit, placeholder = 'Search', size, icon, clearable = true, className, style,
  'aria-label': ariaLabel = 'Search', ...props
}: SearchInputProps) {
  const [own] = useState(createInputController);
  const input = controller ?? own;
  const step = size ?? 'default';
  return (
    <Root input={input} onSubmit={onSubmit} style={style} className={cn(searchInputVariants({ size }), className)}>
      <InputGroup className="contents">
        {icon === undefined ? <Icon name="search" size={ICON_SIZE[step]} sw={2.2} className="shrink-0 text-muted-foreground" /> : icon}
        <QueryInput render={
          <Input type="search" controller={input} placeholder={placeholder} aria-label={ariaLabel}
            className={cn(
              'min-w-0 flex-1 appearance-none border-none bg-transparent p-0 [font-family:inherit] text-[length:inherit] text-foreground outline-none placeholder:text-muted-foreground',
              '[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none',
              selectableText,
            )}
            {...props} />
        } />
        {clearable ? (
          <InputClear aria-label="Clear search" tabIndex={-1} className="bl-btn relative grid shrink-0 cursor-pointer border-0 bg-transparent p-0 text-tertiary-foreground after:absolute after:-inset-2 after:content-[''] pointer-coarse:after:-inset-3">
            <Icon name="xcirc" size={CLEAR_SIZE[step]} />
          </InputClear>
        ) : null}
      </InputGroup>
    </Root>
  );
}
