import { useState, type CSSProperties } from 'react';
import { Button as AriaButton, Input, SearchField as AriaSearchField } from 'react-aria-components';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';

export interface SearchFieldProps {
  /** Controlled query. */
  value?: string;
  /** Initial query when uncontrolled. */
  defaultValue?: string;
  /** Called with the new query on every keystroke, and with '' when cleared (button or Esc). */
  onChange?: (value: string) => void;
  /** Enter pressed. */
  onSubmit?: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
}

/** iOS search field on react-aria's SearchField (Esc clears a non-empty query). Controlled with
 *  `value` + `onChange`, or uncontrolled with `defaultValue`. */
export function SearchField({
  value, defaultValue = '', onChange, onSubmit, placeholder = 'Search', autoFocus, className, style, ...rest
}: SearchFieldProps) {
  const [inner, setInner] = useState(defaultValue);
  const q = value ?? inner;
  const set = (v: string) => { if (value === undefined) setInner(v); onChange?.(v); };
  return (
    <AriaSearchField data-slot="search-field" value={q} onChange={set} onSubmit={onSubmit} autoFocus={autoFocus}
      aria-label={rest['aria-label'] || 'Search'}
      className={cn('flex items-center gap-[7px] rounded-[11px] bg-secondary px-[9px] py-[7px]', className)} style={style}>
      <Icon name="search" size={17} sw={2.2} className="text-muted-foreground" />
      <Input placeholder={placeholder}
        className="min-w-0 flex-1 appearance-none border-none bg-transparent p-0 [font-family:inherit] text-[17px] text-foreground outline-none select-text [&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none" />
      {q ? (
        <AriaButton aria-label="Clear search" className="bl-btn grid cursor-pointer border-0 bg-transparent p-0 text-tertiary-foreground">
          <Icon name="xcirc" size={18} />
        </AriaButton>
      ) : null}
    </AriaSearchField>
  );
}
