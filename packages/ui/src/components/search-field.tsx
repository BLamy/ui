'use client';
import { useState, type ComponentProps, type CSSProperties } from 'react';
import { Input, InputClear, InputGroup, createInputController } from '@ui-sdk/react/input';
import { createParts } from '@ui-sdk/react/primitive';
import { Icon } from '@/lib/icon';
import { searchField, type SearchFieldSubmitDetails } from '@/lib/search-field-primitive';
import { cn } from '@/lib/utils';

export type { SearchFieldSubmitDetails };

const { Root, Input: SearchInput } = createParts(searchField, { root: 'div', input: 'input' });

export interface SearchFieldProps extends Omit<ComponentProps<typeof Input>, 'type' | 'render' | 'children' | 'onSubmit' | 'className' | 'style'> {
  /** Enter pressed. With it, Enter no longer submits the form around the field. */
  onSubmit?: (value: string, details: SearchFieldSubmitDetails) => void;
  /** Styles the pill around the input. */
  className?: string;
  style?: CSSProperties;
}

/** iOS search field: UI SDK's Input in an InputGroup with a magnifier and a Clear button, plus the search-field
 *  keys (Escape clears a query, Enter submits; `onSubmit(value, details)` gets `reason`, `source` and `cancel()`). Its props are the Input's: `value` / `defaultValue` /
 *  `onValueChange(value, details)`, where a clear reports `clear-press`, a `controller`, `disabled`, `name`…
 *  The Clear button stays out of the Tab order: Escape is its keyboard route, so Tab goes straight to the results. */
export function SearchField({
  controller, onSubmit, placeholder = 'Search', className, style, 'aria-label': ariaLabel = 'Search', ...props
}: SearchFieldProps) {
  const [own] = useState(createInputController);
  const input = controller ?? own;
  return (
    <Root input={input} onSubmit={onSubmit} style={style}
      className={cn('flex items-center gap-[7px] rounded-[11px] bg-secondary px-[9px] py-[7px] has-[input:disabled]:opacity-50', className)}>
      <InputGroup className="contents">
        <Icon name="search" size={17} sw={2.2} className="text-muted-foreground" />
        <SearchInput render={
          <Input type="search" controller={input} placeholder={placeholder} aria-label={ariaLabel}
            className="min-w-0 flex-1 appearance-none border-none bg-transparent p-0 [font-family:inherit] text-body text-foreground outline-none select-text [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none"
            {...props} />
        } />
        <InputClear aria-label="Clear search" tabIndex={-1} className="bl-btn grid cursor-pointer border-0 bg-transparent p-0 text-tertiary-foreground">
          <Icon name="xcirc" size={18} />
        </InputClear>
      </InputGroup>
    </Root>
  );
}
