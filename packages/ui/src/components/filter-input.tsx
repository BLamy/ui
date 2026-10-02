'use client';
import { useId, useState, type ComponentProps } from 'react';
import { Input, TextField as AriaTextField } from 'react-aria-components';
import { cva } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { FilterChip, useOptionalFilterBar } from '@/components/ui/filter';
import { describeFilter, type Filter, type FilterField } from '@/lib/filter';
import { useFilterQuery, warmFilterQuery, type UseFilterQueryOptions } from '@/lib/filter-query';
import { Icon, type IconShape } from '@/lib/icon';
import { selectableText } from '@/lib/primitives';
import { cn } from '@/lib/utils';

/* ══ FilterInput — describe the filters in a sentence ══
   <FilterBar fields={fields}>
     <FilterInput />
     <FilterToolbar />
   </FilterBar>

   Type "urgent bugs assigned to bob" and a live preview shows the chips it would create — plus anything it dropped and
   any assumption it made. Nothing is applied until you press Enter (or Apply); the chips then land in the bar, where
   they are ordinary, editable filters.

   Under the hood this is `useFilterQuery` (lib/filter-query) over gpu-query, a 29,597-parameter tagger that runs in the
   browser, on the CPU, and downloads ~40 KB the first time the box is focused. It is a feasibility-spike model: it
   reads simple "and" filters and misses plenty of ordinary phrasing, so the preview is the point — read it. ══ */

const SPARKLE: readonly IconShape[] = [
  { d: 'M10.5 4.2l1.5 4.2 4.2 1.5-4.2 1.5-1.5 4.2-1.5-4.2-4.2-1.5 4.2-1.5z', f: 2 },
  { d: 'M18 14.6l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z', f: 2 },
];

export const filterInputVariants = cva('flex min-w-0 flex-col gap-1.5');

export interface FilterInputProps extends Omit<ComponentProps<'div'>, 'onChange' | 'defaultValue' | 'children'> {
  /** What can be filtered. Default: the enclosing FilterBar's fields. */
  fields?: readonly FilterField[];
  /** Called with the understood filters when the user applies them. Default: the enclosing FilterBar's `apply`. */
  onApply?: (filters: Filter[]) => void;
  /** With a FilterBar: `merge` (default) replaces the filter of a field it names and adds the rest; `replace` swaps them all. */
  mode?: 'merge' | 'replace';
  /** The phrase, controlled. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (text: string) => void;
  placeholder?: string;
  /** Debounce, "now" for relative dates, … — see `useFilterQuery`. */
  query?: UseFilterQueryOptions;
  'aria-label'?: string;
}

const EXAMPLE = 'urgent bugs assigned to bob';

export function FilterInput({
  fields: fieldsProp, onApply, mode = 'merge', value, defaultValue = '', onValueChange, placeholder = 'Describe what you want…', query: queryOptions,
  'aria-label': ariaLabel = 'Describe the filters you want', className, ...props
}: FilterInputProps) {
  const bar = useOptionalFilterBar();
  const fields = fieldsProp ?? bar?.fields ?? [];
  const [inner, setInner] = useState(defaultValue);
  const text = value ?? inner;
  const setText = (next: string) => { if (value === undefined) setInner(next); onValueChange?.(next); };
  const [note, setNote] = useState('');
  const hintId = useId();
  const previewId = useId();
  const result = useFilterQuery(text, fields, queryOptions);
  const { filters, unresolved, notes, status, pending } = result;
  const trimmed = text.trim();
  const settled = trimmed !== '' && !pending && status === 'ready';
  const canApply = settled && filters.length > 0 && !!(onApply ?? bar);

  const apply = () => {
    if (!canApply) return;
    if (onApply) onApply(filters);
    else bar?.apply(filters, mode);
    setText('');
    setNote('');
  };

  const submit = () => {
    if (!trimmed) return;
    if (pending || status === 'loading') {
      // Show what was understood before anything is applied: a second Enter applies it.
      result.refresh();
      setNote('Reading your sentence… press Enter again to apply what it shows.');
    } else if (status === 'ready' && !filters.length) setNote('Nothing to apply: no filter was understood.');
    else if (settled) apply();
  };

  const sentence = (list: Filter[]) => list.map((f) => describeFilter(f, fields, bar?.locale)).join('; ');
  // What a screen reader hears once the debounced result is in (the chips below are a visual copy of it).
  const ignored = unresolved.length ? ` Ignored: ${unresolved.map((u) => u.text).join(', ')}.` : '';
  const heard = !trimmed ? ''
    : status === 'error' ? 'The language model could not be loaded. Use the Filter menu instead.'
    : !settled ? ''
    : filters.length
      ? `${filters.length === 1 ? '1 filter' : `${filters.length} filters`} understood: ${sentence(filters)}.${ignored}${notes.length ? ` ${notes.join('. ')}.` : ''} Press Enter to apply.`
      : `No filter understood.${ignored}`;
  const summary = [heard, note].filter(Boolean).join(' ');

  return (
    <div data-slot="filter-input" className={cn(filterInputVariants(), className)} {...props}>
      <div className="flex items-center gap-2">
        <AriaTextField
          value={text}
          onChange={(next) => { setText(next); if (note) setNote(''); }}
          aria-label={ariaLabel}
          className="flex min-w-0 flex-1 items-center"
        >
          <div className="box-border flex h-9 w-full min-w-0 items-center gap-2 rounded-ctl bg-secondary px-2.5 focus-within:ring-2 focus-within:ring-ring/45">
            <Icon shapes={SPARKLE} size={16} sw={1.6} className="shrink-0 text-foreground/70" />
            <Input
              placeholder={placeholder}
              aria-describedby={`${hintId} ${previewId}`}
              autoComplete="off"
              spellCheck={false}
              maxLength={400}
              onFocus={() => { void warmFilterQuery(); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); submit(); }
                else if (e.key === 'Escape' && text) { e.preventDefault(); e.stopPropagation(); setText(''); setNote(''); }
              }}
              className={cn('min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 [font-family:inherit] text-body text-foreground outline-none placeholder:text-tertiary-foreground', selectableText)}
            />
          </div>
        </AriaTextField>
        <Button variant="secondary" size="sm" isDisabled={!canApply} onPress={apply}>Apply</Button>
      </div>

      {trimmed ? (
        <div
          data-slot="filter-input-preview"
          aria-hidden="true"
          className={cn('flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 text-caption text-foreground/70 transition-opacity duration-spring-snappy motion-reduce:transition-none', pending && 'opacity-60')}
        >
          {status === 'error' ? (
            <span className="text-destructive">The language model could not be loaded (offline?). The Filter menu still works.</span>
          ) : status === 'loading' && !filters.length ? (
            <span>Loading the language model…</span>
          ) : filters.length ? (
            <>
              <span className="font-semibold">Will apply</span>
              {filters.map((f) => <FilterChip key={f.id} filter={f} field={fields.find((x) => x.id === f.field)} readOnly size="sm" tone="preview" locale={bar?.locale} />)}
            </>
          ) : (
            <span>Nothing understood yet. Try “{EXAMPLE}”.</span>
          )}
          {!pending && unresolved.length ? (
            <span>
              Ignored: {unresolved.map((u, i) => <span key={`${u.text}-${i}`} title={u.reason} className="text-foreground">“{u.text}”{i < unresolved.length - 1 ? ', ' : ''}</span>)}
            </span>
          ) : null}
          {!pending && notes.map((n) => <span key={n}>{n}</span>)}
        </div>
      ) : null}

      <p id={hintId} className="m-0 text-caption text-foreground/70">
        Experimental: a small model that runs in your browser and reads simple filters joined by “and”. It misses plenty. Check the preview, then press Enter.
      </p>
      <div id={previewId} role="status" aria-live="polite" aria-atomic="true" className="sr-only">{summary}</div>
    </div>
  );
}
