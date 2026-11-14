'use client';
import { useEffect, useId, useState, type ComponentProps } from 'react';
import { announce } from '@ui-sdk/core';
import { Input, InputGroup, createInputController, type InputOptions } from '@ui-sdk/react/input';
import { createParts } from '@ui-sdk/react/primitive';
import { cva } from 'class-variance-authority';
import { Button } from '@/components/ui/button';
import { FilterChip, useOptionalFilterBar } from '@/components/ui/filter';
import { describeFilter, type Filter, type FilterField } from '@/lib/filter-model';
import { useFilterQuery, warmFilterQuery, type UseFilterQueryOptions } from '@/lib/filter-query';
import { Icon, type IconShape } from '@/lib/icon';
import { selectableText } from '@/lib/primitives';
import { searchField } from '@/lib/search-field-primitive';
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
   reads simple "and" filters and misses plenty of ordinary phrasing, so the preview is the point — read it.

   The box is UI SDK's Input in an InputGroup, inside the search-field keys (lib/search-field-primitive): Enter
   submits the phrase and Escape clears it, claiming the key only when there is text to clear. What was understood
   is read out with UI SDK's `announce()` once the debounced result settles. ══ */

// The search-field keys around the phrase box: its `input` part renders the Input.
const { Root: PhraseField, Input: PhraseInput } = createParts(searchField, { root: 'div', input: 'input' });

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
  /** Every change to the phrase, with the Input's `details`: typing is `input-change`, Escape `clear-press`, and
      the box emptying after an apply `imperative`. */
  onValueChange?: InputOptions['onValueChange'];
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
  const [input] = useState(createInputController);
  const [note, setNote] = useState('');
  const hintId = useId();
  const result = useFilterQuery(text, fields, queryOptions);
  const { filters, unresolved, notes, status, pending } = result;
  const trimmed = text.trim();
  const settled = trimmed !== '' && !pending && status === 'ready';
  const canApply = settled && filters.length > 0 && !!(onApply ?? bar);

  const apply = () => {
    if (!canApply) return;
    if (onApply) onApply(filters);
    else bar?.apply(filters, mode);
    input.clear();
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
  useEffect(() => {
    if (summary) announce(summary);
  }, [summary]);

  return (
    <div data-slot="filter-input" className={cn(filterInputVariants(), className)} {...props}>
      <div className="flex items-center gap-2">
        <PhraseField input={input} onSubmit={submit} className="flex min-w-0 flex-1 items-center">
          <InputGroup className="box-border flex h-9 w-full min-w-0 items-center gap-2 rounded-ctl bg-secondary px-2.5 focus-within:ring-2 focus-within:ring-ring/45">
            <Icon shapes={SPARKLE} size={16} sw={1.6} className="shrink-0 text-foreground/70" />
            <PhraseInput render={<Input
              controller={input}
              value={text}
              onValueChange={(next, details) => {
                onValueChange?.(next, details);
                if (details.canceled) return;
                if (value === undefined) setInner(next);
                if (note) setNote('');
              }}
              aria-label={ariaLabel}
              placeholder={placeholder}
              aria-describedby={hintId}
              autoComplete="off"
              spellCheck={false}
              maxLength={400}
              onFocus={() => { void warmFilterQuery(); }}
              className={cn('min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 [font-family:inherit] text-body text-foreground outline-none placeholder:text-tertiary-foreground', selectableText)}
            />} />
          </InputGroup>
        </PhraseField>
        <Button variant="secondary" size="sm" disabled={!canApply} onClick={apply}>Apply</Button>
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
    </div>
  );
}
