'use client';
import { useEffect, useId, useState, type ComponentProps, type ReactNode } from 'react';
import { announce } from '@ui-sdk/core';
import { createInputController, type InputOptions } from '@ui-sdk/react/input';
import { Button } from '@/components/ui/button';
import { FilterChip, useOptionalFilterBar, type FilterChangeDetails, type FilterChangeReason } from '@/components/ui/filter';
import { changeDetails } from '@/lib/change-details';
import { SearchInput } from '@/components/ui/search-input';
import { describeFilter, type Filter, type FilterField } from '@/lib/filter-model';
import { FILTER_QUERY_MAX_LENGTH, useFilterQuery, warmFilterQuery, type UseFilterQueryOptions } from '@/lib/filter-query';
import { Icon, type IconShape } from '@/lib/icon';
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

   The box is a small SearchInput with a sparkle for its glyph and no Clear button: Enter submits the phrase and
   Escape clears it, claiming the key only when there is text to clear. It sits beside a small Apply button, at the
   same 32px. What was understood is read out with UI SDK's `announce()` once the debounced result settles. ══ */

const SPARKLE: readonly IconShape[] = [
  { d: 'M10.5 4.2l1.5 4.2 4.2 1.5-4.2 1.5-1.5 4.2-1.5-4.2-4.2-1.5 4.2-1.5z', f: 2 },
  { d: 'M18 14.6l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8z', f: 2 },
];

const DESCRIPTION = 'Experimental: a small model that runs in your browser and reads simple filters joined by “and”. It misses plenty. Check the preview, then press Enter.';

export interface FilterInputProps extends Omit<ComponentProps<'div'>, 'onChange' | 'defaultValue' | 'children'> {
  /** What can be filtered. Default: the enclosing FilterBar's fields. */
  fields?: readonly FilterField[];
  /** Called with the understood filters when the user applies them, and `details` (`reason: 'apply'`, the Enter key
   *  or the Apply press as `event`, `cancel()` to keep the phrase in the box). Default: the enclosing FilterBar's
   *  `apply`. */
  onApply?: (filters: Filter[], details: FilterChangeDetails) => void;
  /** With a FilterBar: `merge` (default) replaces the filter of a field it names and adds the rest; `replace` swaps them all. */
  mode?: 'merge' | 'replace';
  /** The phrase, controlled. */
  value?: string;
  defaultValue?: string;
  /** Every change to the phrase, with the Input's `details`: typing is `input-change`, Escape `clear-press`, and
      the box emptying after an apply `imperative`. */
  onValueChange?: InputOptions['onValueChange'];
  placeholder?: string;
  /** The line under the box, which also describes it to a screen reader. Default: a note that the model is
      experimental and the preview is to be checked. `false` hides it. */
  description?: ReactNode | false;
  /** How the phrase is read: `debounceMs`, `reference` (the moment relative dates count from), `maxLength`,
      `enabled`. See `useFilterQuery`. */
  parse?: UseFilterQueryOptions;
  'aria-label'?: string;
}

const EXAMPLE = 'urgent bugs assigned to bob';

export function FilterInput({
  fields: fieldsProp, onApply, mode = 'merge', value, defaultValue = '', onValueChange, placeholder = 'Describe what you want…', description = DESCRIPTION, parse,
  'aria-label': ariaLabel = 'Describe the filters you want', className, ...props
}: FilterInputProps) {
  const bar = useOptionalFilterBar();
  const fields = fieldsProp ?? bar?.fields ?? [];
  const [inner, setInner] = useState(defaultValue);
  const text = value ?? inner;
  const [input] = useState(createInputController);
  const [note, setNote] = useState('');
  const hintId = useId();
  const result = useFilterQuery(text, fields, parse);
  const { filters, unresolved, notes, status, pending } = result;
  const trimmed = text.trim();
  const settled = trimmed !== '' && !pending && status === 'ready';
  const canApply = settled && filters.length > 0 && !!(onApply ?? bar);

  const apply = (event?: Event) => {
    if (!canApply) return;
    if (onApply) {
      const details = changeDetails<FilterChangeReason>({ reason: 'apply', event });
      onApply(filters, details);
      if (details.canceled) return;
    } else if (!bar?.apply(filters, mode, { event })) return;
    // Applied: the sentence has become chips. A canceled apply (either route) keeps it to edit.
    input.clear();
    setNote('');
  };

  const submit = (_value: string, details?: { event?: Event }) => {
    if (!trimmed) return;
    if (pending || status === 'loading') {
      // Show what was understood before anything is applied: a second Enter applies it.
      result.refresh();
      setNote('Reading your sentence… press Enter again to apply what it shows.');
    } else if (status === 'ready' && !filters.length) setNote('Nothing to apply: no filter was understood.');
    else if (settled) apply(details?.event);
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
    <div data-slot="filter-input" className={cn('flex min-w-0 flex-col gap-1.5', className)} {...props}>
      <div className="flex items-center gap-2">
        <SearchInput
          size="sm"
          icon={<Icon shapes={SPARKLE} size={15} sw={1.6} className="shrink-0 text-foreground/70" />}
          clearable={false}
          controller={input}
          onSubmit={submit}
          value={text}
          onValueChange={(next, details) => {
            onValueChange?.(next, details);
            if (details.canceled) return;
            if (value === undefined) setInner(next);
            if (note) setNote('');
          }}
          aria-label={ariaLabel}
          placeholder={placeholder}
          aria-describedby={description === false ? undefined : hintId}
          autoComplete="off"
          spellCheck={false}
          maxLength={parse?.maxLength ?? FILTER_QUERY_MAX_LENGTH}
          onFocus={() => { void warmFilterQuery(); }}
          className="flex-1"
        />
        <Button variant="secondary" size="sm" disabled={!canApply} onClick={(event) => apply(event.nativeEvent)}>Apply</Button>
      </div>

      {trimmed ? (
        <div
          data-slot="filter-input-preview"
          aria-hidden="true"
          className={cn('flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1.5 text-caption text-foreground/70 transition-opacity duration-spring-snappy motion-reduce:transition-none', pending && 'opacity-60')}
        >
          {status === 'error' ? (
            <span className="flex items-center gap-1.5 text-foreground">
              <Icon name="exclamation-circle" size={14} className="shrink-0 text-destructive" />
              The language model could not be loaded (offline?). The Filter menu still works.
            </span>
          ) : status === 'loading' && !filters.length ? (
            <span>Loading the language model…</span>
          ) : filters.length ? (
            <>
              <span className="font-semibold">Will apply</span>
              {filters.map((f) => <FilterChip key={f.id} filter={f} field={fields.find((x) => x.id === f.field)} readOnly size="sm" variant="preview" locale={bar?.locale} />)}
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

      {description === false ? null : <p id={hintId} className="m-0 text-caption text-foreground/70">{description}</p>}
    </div>
  );
}
