'use client';
import {
  cloneElement, createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState,
  type ComponentProps, type CSSProperties, type RefObject, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent, type ReactElement, type ReactNode,
} from 'react';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList, type ListAnnouncement } from '@ui-sdk/react/command';
import { Listbox, ListboxItem, ListboxItemIndicator } from '@ui-sdk/react/listbox';
import { createParts } from '@ui-sdk/react/primitive';
import { useShortcut } from '@ui-sdk/react/shortcuts';
import { Toolbar, ToolbarButton } from '@ui-sdk/react/toolbar';
import { announce as announceText, createFocusRecovery, type ChangeDetails, type ChangeSource } from '@ui-sdk/core';
import { cva, type VariantProps } from 'class-variance-authority';
import { Button as SdkButton } from '@ui-sdk/react/button';
import { Button } from '@/components/ui/button';
import { checkboxVariants } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { listboxItemVariants, listboxVariants } from '@/components/ui/list-box';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger, createPopoverController, type PopoverProps } from '@/components/ui/popover';
import { Segmented, SegmentedItem } from '@/components/ui/segmented';
import {
  DATE_PRESETS, RELATIVE_UNITS, createFilter, describeFilter, describeValue, isDateValue, isFilterComplete,
  operatorLabel, operatorsFor, withOperator, withValue,
  type DatePreset, type DateValue, type Filter, type FilterField, type FilterOperator, type FilterOption, type FilterValue, type RelativeUnit,
} from '@/lib/filter-model';
import { Icon } from '@/lib/icon';
import { changeDetails, type ChangeGiven } from '@/lib/change-details';
import { useControllableChange } from '@/lib/controllable-state';
import { optionSearch } from '@/lib/option-search-primitive';
import { pressableFocusRing, selectableText } from '@/lib/primitives';
import { cn, cx } from '@/lib/utils';

/* ══ Filter — Linear-style filtering ══
   A "Filter" button (and an optional `F` shortcut) opens a searchable list of fields; pick one and a searchable
   multi-select (or a date, number or text editor) of its values; the filter lands as a chip you can edit in place —
   the operator and the value are each a button of their own — or remove (× · Backspace · Delete).

   <FilterBar fields={fields} defaultValue={[…]} onValueChange={setFilters} />   // Filter button, chips, Clear all

   or composed:

   <FilterBar fields={fields} value={filters} onValueChange={setFilters}>
     <FilterInput />                       // components/filter-input — a sentence → chips
     <FilterToolbar>
       <FilterMenu shortcut="f" />  <FilterList />  <FilterMatch />  <FilterClear />
     </FilterToolbar>
   </FilterBar>

   The data model — fields, operators, matching, serializing — is lib/filter-model (plain functions, no UI);
   `useFilters` is its state as a hook, for when you want the same behaviour without a FilterBar.

   Built on UI SDK: the row is a Toolbar (one tab stop; ←/→, Home and End across the Filter button, every chip's
   operator, value and ×, and Clear all), the field list is a Command (the search keeps focus while the arrows move,
   Enter picks), a select's values are an option search (lib/option-search-primitive: tick several behind a search),
   the operator and match pickers are Menus with radio items, and each editor sits in a Popover.
   Backspace or Delete on a chip removes it (focus moves to a neighbour). Additions, edits and removals are announced
   politely through UI SDK's `announce()`. Every change reaches `onValueChange(filters, details)` with UI SDK's
   `ChangeDetails` (the reason, the event and who caused it); `details.cancel()` keeps an uncontrolled bar as it was. ══ */

/* ── state ── */

/** Why the filters changed. */
export type FilterChangeReason = 'add' | 'update' | 'remove' | 'clear' | 'apply' | 'imperative';
/** What `onValueChange` receives after the filters: why, the event behind it, who caused it, and `cancel()`. */
export type FilterChangeDetails = ChangeDetails<FilterChangeReason>;
/** Why the match mode changed. */
export type FilterMatchChangeReason = 'item-press' | 'imperative';
/** What `onMatchChange` receives after the match mode. */
export type FilterMatchChangeDetails = ChangeDetails<FilterMatchChangeReason>;
/** What an edit knows about the interaction behind it, passed on to the change's details. */
export interface FilterChangeOptions {
  /** The event behind it: a press, a key, the pick in a value list. */
  event?: Event;
  /** Who caused it, when a UI SDK part already said (its details' `source`); else read from `event`. */
  source?: ChangeSource;
}

export interface UseFiltersOptions {
  /** Controlled filters. */
  value?: Filter[];
  defaultValue?: Filter[];
  onValueChange?: (filters: Filter[], details: FilterChangeDetails) => void;
  /** Controlled match mode: `all` (every filter) or `any`. */
  match?: 'all' | 'any';
  defaultMatch?: 'all' | 'any';
  onMatchChange?: (match: 'all' | 'any', details: FilterMatchChangeDetails) => void;
}

export interface FilterState {
  filters: Filter[];
  match: 'all' | 'any';
  /** Every write returns whether it was asked for (false: nothing changed, or `details.cancel()` refused it). A
      controlled consumer still decides by the value it passes back. */
  setFilters: (next: Filter[] | ((prev: Filter[]) => Filter[]), given?: ChangeGiven<FilterChangeReason>) => boolean;
  setMatch: (match: 'all' | 'any', given?: ChangeGiven<FilterMatchChangeReason>) => boolean;
  /** Append a filter. */
  add: (filter: Filter, options?: FilterChangeOptions) => boolean;
  /** Change a filter's operator and/or value. */
  update: (id: string, patch: Partial<Pick<Filter, 'operator' | 'value'>>, options?: FilterChangeOptions) => boolean;
  remove: (id: string, options?: FilterChangeOptions) => boolean;
  clear: (options?: FilterChangeOptions) => boolean;
}

/** The filters and their edits as a hook: controlled or not, plus the match mode. `FilterBar` is built on it. */
export function useFilters({ value, defaultValue, onValueChange, match, defaultMatch = 'all', onMatchChange }: UseFiltersOptions = {}): FilterState {
  const [filters, setFilters] = useControllableChange<Filter[], FilterChangeReason>(value, defaultValue ?? [], onValueChange);
  const [matchMode, setMatch] = useControllableChange<'all' | 'any', FilterMatchChangeReason>(match, defaultMatch, onMatchChange);
  return useMemo<FilterState>(() => ({
    filters,
    match: matchMode,
    setFilters,
    setMatch,
    add: (filter, options) => setFilters((prev) => [...prev, filter], { reason: 'add', ...options }),
    update: (id, patch, options) => setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)), { reason: 'update', ...options }),
    remove: (id, options) => setFilters((prev) => prev.filter((f) => f.id !== id), { reason: 'remove', ...options }),
    clear: (options) => setFilters((prev) => (prev.length ? [] : prev), { reason: 'clear', ...options }),
  }), [filters, matchMode, setFilters, setMatch]);
}

/* ── context ── */

export interface FilterBarContextValue extends FilterState {
  fields: readonly FilterField[];
  allowDuplicates: boolean;
  locale: string;
  /** Say something to screen readers, politely (UI SDK's `announce()`, in the bar's document). */
  announce: (message: string) => void;
  /** Keeps focus in the bar when a chip that holds it leaves (UI SDK's `createFocusRecovery`): call it with the
      chip's element and filter id, and call what it returns when the chip goes. FilterChip does this itself. */
  bindChip: (el: HTMLElement, id: string) => () => void;
  /** Add filters from outside the menu (the natural-language input): `merge` replaces a field's filter, `replace` swaps them all. */
  apply: (filters: Filter[], mode?: 'merge' | 'replace', options?: FilterChangeOptions) => boolean;
}

const FilterBarContext = createContext<FilterBarContextValue | null>(null);

/** The enclosing FilterBar's fields, filters and edits, or `null` outside one. */
export function useOptionalFilterBar(): FilterBarContextValue | null {
  return useContext(FilterBarContext);
}

/** The enclosing FilterBar's fields, filters and edits. Throws outside a FilterBar. */
export function useFilterBar(): FilterBarContextValue {
  const ctx = useContext(FilterBarContext);
  if (!ctx) throw new Error('useFilterBar must be used inside <FilterBar>');
  return ctx;
}

/** Whether the buttons are inside a FilterToolbar, so they join its arrow-key order. */
const InToolbar = createContext(false);

/* ── variants ── */

const barClass = 'flex min-w-0 flex-col gap-2';
const toolbarClass = 'flex min-w-0 flex-wrap items-center gap-1.5';

export const filterChipVariants = cva(
  'box-border inline-flex max-w-full min-w-0 items-stretch rounded-lg text-foreground',
  {
    variants: {
      size: {
        default: 'h-7 text-footnote',
        sm: 'h-6 text-caption',
      },
      /** `preview` is a chip that is not a filter yet (what the natural-language input will apply). */
      variant: {
        default: 'bg-secondary shadow-hairline',
        preview: 'bg-primary/10 text-foreground shadow-hairline',
      },
    },
    defaultVariants: { size: 'default', variant: 'default' },
  },
);

/* Focus: a button of the row draws the kit's pressable ring (2px, offset); a part of a chip draws the same ring inset,
   since its neighbours touch it. The search row of a popup list underlines in the tint (its field keeps focus while
   the popup is open). Typed values are the kit's Input, with its own ring. */

/** One part of a chip (field, operator, value, remove): a hairline from its neighbour, its own hover, press and focus.
    The outer parts round with the chip, so their hover fill follows its corners. */
const chipPart =
  'bl-btn flex min-w-0 items-center gap-1.5 border-0 border-l border-border bg-transparent px-2 [font-family:inherit] text-inherit outline-none first:rounded-s-lg first:border-l-0 last:rounded-e-lg';
const chipButton =
  'cursor-pointer hover:bg-accent active:bg-secondary-strong focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring';

const triggerButton = cn(
  'bl-btn box-border inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-transparent px-2 [font-family:inherit] text-footnote font-medium text-foreground/70 transition-[background-color] duration-spring-snappy ease-spring-snappy hover:bg-accent active:bg-secondary-strong motion-reduce:transition-none',
  pressableFocusRing,
);

const popupList = cn(listboxVariants({ variant: 'popup' }));
const popupRow = listboxItemVariants({ variant: 'popup' });

/* ── small pieces ── */

type BarButtonProps = Omit<ComponentProps<'button'>, 'className' | 'onClick'> & {
  className?: string;
  onClick?: (event: ReactMouseEvent<HTMLElement>) => void;
  /** The element to render instead of a plain button: a popover or menu trigger. */
  render?: ReactElement<Record<string, unknown>>;
  'data-part'?: string;
  'data-filter-trigger'?: string;
};

/** A button of the row: a Toolbar button inside a FilterToolbar (so the arrows reach it), else the element itself. */
function BarButton({ render, ...props }: BarButtonProps) {
  const inBar = useContext(InToolbar);
  if (inBar) return <ToolbarButton render={render} {...props} />;
  return render ? cloneElement(render, props) : <SdkButton {...props} />;
}

const dotStyle = (color: string) => ({ '--c': color }) as CSSProperties;

function Mark({ icon, color, size = 14 }: { icon?: ReactNode; color?: string; size?: number }) {
  if (icon) return <span className="grid shrink-0 place-items-center text-foreground/70">{typeof icon === 'string' ? <Icon name={icon} size={size} sw={2} /> : icon}</span>;
  if (color) return <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-(--c)" style={dotStyle(color)} />;
  return null;
}

function FieldMark({ field, size }: { field: FilterField; size?: number }) {
  return <Mark icon={field.icon} size={size} />;
}

function optionsOf(filter: Filter, field: FilterField): FilterOption[] {
  return Array.isArray(filter.value) ? filter.value.map((v) => field.options?.find((o) => o.value === v) ?? { value: v, label: v }) : [];
}

/** What a chip's value button shows: option marks and labels (or "3 selected"), a date, a number… */
function ValueSummary({ filter, field, locale }: { filter: Filter; field: FilterField; locale: string }) {
  if (!isFilterComplete(filter)) return <span className="text-foreground/70">Select…</span>;
  if (Array.isArray(filter.value)) {
    const opts = optionsOf(filter, field);
    const marks = opts.filter((o) => o.icon || o.color).slice(0, 3);
    return (
      <>
        {marks.length ? <span className="flex shrink-0 items-center -space-x-1">{marks.map((o) => <Mark key={o.value} icon={o.icon} color={o.color} />)}</span> : null}
        <span className="truncate">{opts.length <= 2 ? opts.map((o) => o.label).join(', ') : `${opts.length} selected`}</span>
      </>
    );
  }
  return <span className="truncate">{describeValue(filter, field, locale)}</span>;
}

/** A filter on a field the schema does not (or no longer) have: shown as is, with the editor its value shape suggests. */
function fallbackField(filter: Filter): FilterField {
  const v = filter.value;
  const kind = Array.isArray(v) ? 'select' : typeof v === 'boolean' ? 'boolean' : typeof v === 'number' ? 'number' : typeof v === 'string' ? 'text' : 'date';
  return { id: filter.field, label: filter.field, kind };
}

/** The search row above a list: an icon and the field, which keeps focus while the arrows move through the list. */
const searchRow = 'flex h-10 items-center gap-2 border-b border-border px-3 transition-[border-color] duration-spring-snappy ease-spring-snappy focus-within:border-primary motion-reduce:transition-none';
const searchInput = cn(
  'min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 [font-family:inherit] text-subhead text-foreground outline-none placeholder:text-tertiary-foreground [&::-webkit-search-cancel-button]:appearance-none',
  selectableText,
);
const SearchIcon = () => <Icon name="search" size={16} sw={2.2} className="shrink-0 text-foreground/70" />;

/** Backspace in an empty search: the host's way back. */
const backOnEmpty = (onBack?: () => void) => (e: ReactKeyboardEvent<HTMLInputElement>) => {
  if (onBack && e.key === 'Backspace' && e.currentTarget.value === '') onBack();
};

const emptyClass = 'px-3 py-6 text-center text-footnote text-foreground/70';

/** A row of a one-choice list (a preset, Yes / No), with a check for the current one. */
function Choice({ value, children }: { value: string; children: ReactNode }) {
  return (
    <ListboxItem value={value} className={popupRow}>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      <ListboxItemIndicator><Icon name="check" size={16} sw={2.4} className="shrink-0 text-primary" /></ListboxItemIndicator>
    </ListboxItem>
  );
}

/** A list of choices that act when picked (Enter, Space or a press), the current one selected. */
function ChoiceList({ label, value, onPick, className, children }: {
  label: string; value: string | null; onPick: (value: string, options: FilterChangeOptions) => void; className?: string; children: ReactNode;
}) {
  return (
    <Listbox<string>
      aria-label={label}
      value={value}
      activation="manual"
      onValueChange={(next, details) => { if (next !== null) onPick(next, via(details)); }}
      className={cn(popupList, className)}
    >
      {children}
    </Listbox>
  );
}

/* ── value editors ── */

/** The event and source a UI SDK part's details carry, for the filter change it leads to. */
const via = (details: { event?: Event; source?: ChangeSource } | undefined): FilterChangeOptions => ({ event: details?.event, source: details?.source });
/** The native event of a React one, for a change it leads to. */
const from = (event: { nativeEvent: Event }): FilterChangeOptions => ({ event: event.nativeEvent });

/** Whether the bar shows the filters it asked for (a controlled consumer may pass back a copy). */
const sameFilters = (a: Filter[], b: Filter[]) => a === b || JSON.stringify(a) === JSON.stringify(b);

export interface FilterValueEditorProps {
  field: FilterField;
  /** The operator the value is for (a date's "in the last" asks for a span, the others for a day). */
  operator?: FilterOperator;
  /** The current value, if there is one. */
  value?: FilterValue;
  /** Called as the value changes: on every toggle of a select, on Enter or blur for typed values, with UI SDK's change
   *  details (reason `update`, the event and source behind it). */
  onValueChange: (value: FilterValue, details: FilterChangeDetails) => void;
  /** Called when the choice is complete (a preset picked, Enter pressed) so the host can close. */
  onDone?: () => void;
  /** Called by Backspace on an empty search: the host's way back. */
  onBack?: () => void;
  locale?: string;
}

const {
  Root: OptionSearch, Input: OptionSearchInput, List: OptionSearchList, Option: OptionSearchOption, Empty: OptionSearchEmpty,
} = createParts(optionSearch, { root: 'div', input: 'input', list: 'div', option: 'div', empty: 'div' });

/** The checkbox rows of a select / multiselect, behind a search field that keeps focus. */
function OptionEditor({ field, value, onChange, onBack }: { field: FilterField; value: string[]; onChange: (value: string[], options: FilterChangeOptions) => void; onBack?: () => void }) {
  const options = field.options ?? [];
  const name = field.label.toLowerCase();
  return (
    <OptionSearch
      value={value}
      onValueChange={(next, details) => {
        // Values keep the field's option order, so a chip reads the same however the boxes were ticked.
        const picked = new Set(next);
        onChange([...options.map((o) => o.value).filter((v) => picked.has(v)), ...next.filter((v) => !options.some((o) => o.value === v))], via(details));
      }}
    >
      <div data-slot="filter-search" className={searchRow}>
        <SearchIcon />
        <OptionSearchInput aria-label={`Search ${name}`} placeholder={`Search ${name}…`} autoFocus onKeyDown={backOnEmpty(onBack)} className={searchInput} />
      </div>
      <OptionSearchList aria-label={field.label} className={cn(popupList, 'max-h-64')}>
        {options.map((o) => (
          <OptionSearchOption key={o.value} value={o.value} label={o.label} keywords={o.keywords} className={cn('group', popupRow)}>
            <span aria-hidden="true" className={cn(checkboxVariants({ shape: 'square' }), 'size-4.5 group-data-selected:border-primary group-data-selected:bg-primary')}>
              <Icon name="check" size={12} sw={3.2} className="opacity-0 group-data-selected:opacity-100" />
            </span>
            <Mark icon={o.icon} color={o.color} />
            <span className="min-w-0 flex-1 truncate">{o.label}</span>
            {o.count !== undefined ? <span className="shrink-0 text-caption text-foreground/70 tabular-nums">{o.count}</span> : null}
          </OptionSearchOption>
        ))}
      </OptionSearchList>
      <OptionSearchEmpty className={emptyClass}>No matches</OptionSearchEmpty>
    </OptionSearch>
  );
}

function BooleanEditor({ value, onChange, onDone }: { value?: FilterValue; onChange: (value: boolean, options: FilterChangeOptions) => void; onDone?: () => void }) {
  return (
    <ChoiceList label="Value" value={value === true ? 'yes' : value === false ? 'no' : null} onPick={(v, options) => { onChange(v === 'yes', options); onDone?.(); }}>
      <Choice value="yes">Yes</Choice>
      <Choice value="no">No</Choice>
    </ChoiceList>
  );
}

/** Text or a number, applied on Enter, on the button, or when the field loses focus. */
function TypedEditor({ field, value, onChange, onDone, onBack }: { field: FilterField; value?: FilterValue; onChange: (value: FilterValue, options: FilterChangeOptions) => void; onDone?: () => void; onBack?: () => void }) {
  const numeric = field.kind === 'number';
  const initial = typeof value === 'number' || typeof value === 'string' ? String(value) : '';
  const [draft, setDraft] = useState(initial);
  const lastApplied = useRef(initial);
  const commit = (done: boolean, options: FilterChangeOptions) => {
    const text = draft.trim();
    if (text === '' || (numeric && !Number.isFinite(Number(text)))) return;
    if (text !== lastApplied.current) { lastApplied.current = text; onChange(numeric ? Number(text) : text, options); }
    if (done) onDone?.();
  };
  return (
    <div className="flex flex-col gap-2 p-2.5">
      <Input
        aria-label={`${field.label} ${numeric ? 'number' : 'text'}`}
        value={draft}
        onValueChange={(text) => setDraft(text)}
        type={numeric ? 'number' : 'text'}
        inputMode={numeric ? 'decimal' : undefined}
        autoFocus
        placeholder={numeric ? 'Enter a number…' : `${field.label} contains…`}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(true, from(e)); }
          else if (e.key === 'Backspace' && draft === '' && onBack) onBack();
        }}
        onBlur={(e) => commit(false, from(e))}
        size="sm"
      />
      <div className="flex items-center justify-between gap-2 text-caption text-foreground/70">
        <span>Press Enter to apply</span>
        <Button size="sm" onClick={(e) => commit(true, from(e))} disabled={draft.trim() === ''}>Apply</Button>
      </div>
    </div>
  );
}

const dayRe = /^\d{4}-\d{2}-\d{2}$/;

function DateEditor({ operator, value, onChange, onDone }: { operator?: FilterOperator; value?: FilterValue; onChange: (value: DateValue, options: FilterChangeOptions) => void; onDone?: () => void }) {
  const current = isDateValue(value) ? value : undefined;
  const relative: Extract<DateValue, { type: 'relative' }> = current?.type === 'relative' ? current : { type: 'relative', amount: 7, unit: 'day' };
  const [amount, setAmount] = useState(String(relative.amount));
  const [day, setDay] = useState(current?.type === 'date' ? current.date : '');

  if (operator === 'in_the_last') {
    const send = (text: string, unit: RelativeUnit, options: FilterChangeOptions) => {
      const n = Math.floor(Number(text));
      if (Number.isFinite(n) && n > 0) onChange({ type: 'relative', amount: n, unit }, options);
    };
    return (
      <div className="flex flex-col gap-2.5 p-2.5">
        <Input
          aria-label="How many"
          value={amount}
          onValueChange={(t, details) => { setAmount(t); send(t, relative.unit, via(details)); }}
          type="number"
          inputMode="numeric"
          autoFocus
          min={1}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(amount, relative.unit, from(e)); onDone?.(); } }}
          size="sm"
          className="tabular-nums"
        />
        <Segmented<RelativeUnit> aria-label="Unit" value={relative.unit} onValueChange={(unit, details) => { if (unit) send(amount, unit, via(details)); }}>
          {RELATIVE_UNITS.map((u) => <SegmentedItem key={u} value={u} className="px-1.5">{`${u}s`}</SegmentedItem>)}
        </Segmented>
      </div>
    );
  }

  const commitDay = (done: boolean, options: FilterChangeOptions) => {
    if (dayRe.test(day) && !(current?.type === 'date' && current.date === day)) onChange({ type: 'date', date: day }, options);
    if (done && dayRe.test(day)) onDone?.();
  };
  return (
    <div>
      <ChoiceList
        label="Date"
        value={current?.type === 'preset' ? current.preset : null}
        onPick={(preset, options) => { onChange({ type: 'preset', preset: preset as DatePreset }, options); onDone?.(); }}
        className="max-h-56"
      >
        {DATE_PRESETS.map((p) => <Choice key={p.id} value={p.id}>{p.label}</Choice>)}
      </ChoiceList>
      <div className="border-t border-border p-2.5">
        <Input
          aria-label="Pick a date"
          type="date"
          value={day}
          onValueChange={(d) => setDay(d)}
          onBlur={(e) => commitDay(false, from(e))}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitDay(true, from(e)); } }}
          size="sm"
        />
      </div>
    </div>
  );
}

/** The editor for a field's value: searchable checkbox rows, Yes / No, date presets and a date input, a number or text box. */
export function FilterValueEditor({ field, operator, value, onValueChange, onDone, onBack }: FilterValueEditorProps) {
  const onChange = (next: FilterValue, options?: FilterChangeOptions) => onValueChange(next, changeDetails({ reason: 'update', ...options }));
  switch (field.kind) {
    case 'select':
    case 'multiselect':
      return <OptionEditor field={field} value={Array.isArray(value) ? value : []} onChange={onChange} onBack={onBack} />;
    case 'boolean':
      return <BooleanEditor value={value} onChange={onChange} onDone={onDone} />;
    case 'date':
      return <DateEditor operator={operator} value={value} onChange={onChange} onDone={onDone} />;
    default:
      return <TypedEditor field={field} value={value} onChange={onChange} onDone={onDone} onBack={onBack} />;
  }
}

/* ── the add-filter menu ── */

/** The part of a filter state the menu needs; `useFilters()` and a FilterBar both provide it. */
export type FilterActions = Pick<FilterState, 'filters' | 'add' | 'update' | 'remove'>;

type OpenChange = NonNullable<PopoverProps['onOpenChange']>;

export interface FilterMenuProps {
  /** Needed outside a FilterBar. */
  fields?: readonly FilterField[];
  /** Needed outside a FilterBar: `useFilters()`. */
  state?: FilterActions;
  /** The first press of this key (no modifier, nothing editable focused) opens the menu: `'f'` is Linear's. Off by default. */
  shortcut?: string | null;
  /** The trigger's element, such as `<Button variant="secondary" />`. Default: the kit's quiet "Filter" button. */
  render?: ReactElement<Record<string, unknown>>;
  /** The trigger's content. Default: a filter icon and "Filter". */
  children?: ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: OpenChange;
  /** Where the popover opens. Default below, start-aligned. */
  side?: ComponentProps<typeof PopoverContent>['side'];
  align?: ComponentProps<typeof PopoverContent>['align'];
  /** The trigger's classes. */
  className?: string;
  /** Props for the popover's content (its `className`, `sideOffset`…). */
  contentProps?: Omit<ComponentProps<typeof PopoverContent>, 'children' | 'side' | 'align'>;
  /** Fields already filtered stay in the list when true (default: a field is offered once). */
  allowDuplicates?: boolean;
}

/**
 * The "Filter" button and its popover: a searchable list of fields; picking one swaps the same popover to that field's
 * value editor, and the filter appears (and keeps updating) as values are chosen. Backspace on an empty search steps
 * back; Escape empties the search, then closes. Closing without choosing a value adds nothing.
 */
/* UI SDK's Command says the field list's result count once typing pauses. By then the list may be gone (a field was
   picked, or the menu closed), and a gone list counts no results: say nothing unless the search is still on screen. */
const countWhileShown = (search: RefObject<HTMLInputElement | null>) => (change: ListAnnouncement): string | null => {
  const input = search.current;
  if (!input?.isConnected || input.checkVisibility?.() === false) return null;
  if (change.type === 'removed') return `${change.label} removed`;
  if (change.loading) return 'Loading';
  if (!change.count) return 'No results';
  return change.count === 1 ? '1 result' : `${change.count} results`;
};

export function FilterMenu({
  fields: fieldsProp, state, shortcut = null, render, children, open, defaultOpen, onOpenChange, side = 'bottom', align = 'start',
  className, contentProps, allowDuplicates: duplicatesProp,
}: FilterMenuProps) {
  const bar = useOptionalFilterBar();
  const fields = fieldsProp ?? bar?.fields ?? [];
  const api: FilterActions | undefined = bar ?? state;
  const allowDuplicates = duplicatesProp ?? bar?.allowDuplicates ?? false;
  const [popover] = useState(() => createPopoverController());
  const [field, setField] = useState<FilterField | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const fieldSearch = useRef<HTMLInputElement>(null);
  const [fieldCount] = useState(() => countWhileShown(fieldSearch));

  // The open state is kept here, not in the controller: UI SDK drops a controller's `defaultOpen` when React
  // remounts the popover (StrictMode), so the Popover is always controlled and the controller only drives it.
  const [innerOpen, setInnerOpen] = useState(defaultOpen ?? false);
  const changeOpen: OpenChange = (next, details) => {
    // Start from the field list each time it opens (not on close: the exit animation would flash it).
    if (next) { setField(null); setDraftId(null); }
    onOpenChange?.(next, details);
    if (open === undefined && !details.canceled) setInnerOpen(next);
  };

  // A page shortcut: UI SDK pauses it while a modal layer is open, and skips text fields.
  useShortcut(shortcut ? shortcut.toLowerCase() : null, (event) => { popover.setOpen(true, { reason: 'shortcut', event }); });

  if (!api) return null;
  const draft = draftId ? api.filters.find((f) => f.id === draftId) : undefined;
  const taken = new Set(api.filters.map((f) => f.field));
  const available = fields.filter((f) => allowDuplicates || !taken.has(f.id));

  // The first value picked creates the filter; later ones edit it (and an emptied select removes it again).
  const change = (value: FilterValue, details: FilterChangeDetails) => {
    if (!field) return;
    const options = via(details);
    if (draft) {
      if (Array.isArray(value) && value.length === 0) { if (api.remove(draft.id, options)) setDraftId(null); return; }
      const next = withValue(field, draft, value);
      api.update(draft.id, { operator: next.operator, value: next.value }, options);
    } else if (!(Array.isArray(value) && value.length === 0)) {
      const created = createFilter(field, value);
      if (api.add(created, options)) setDraftId(created.id);
    }
  };

  return (
    <Popover controller={popover} open={open ?? innerOpen} onOpenChange={changeOpen}>
      <BarButton
        render={<PopoverTrigger render={render} />}
        data-filter-trigger=""
        aria-keyshortcuts={shortcut ? shortcut.toUpperCase() : undefined}
        className={render ? className : cn(triggerButton, className)}
      >
        {children ?? (
          <>
            <Icon name="filter-circle" size={16} sw={2} />
            Filter
          </>
        )}
      </BarButton>
      <PopoverContent
        variant="surface"
        {...contentProps}
        side={side}
        align={align}
        className={cx('w-64 min-w-0 overflow-hidden outline-none', contentProps?.className)}
      >
        <PopoverTitle className="sr-only">{field ? `${field.label} filter` : 'Add filter'}</PopoverTitle>
        {field ? (
          <div data-slot="filter-menu-value">
            <div className="flex items-center gap-1 border-b border-border px-1.5 py-1">
              <Button variant="quiet" size="icon-sm" aria-label="Back to fields" onClick={() => { setField(null); }}>
                <Icon name="chevron-left" size={16} sw={2.4} />
              </Button>
              <FieldMark field={field} />
              <span className="truncate text-subhead font-semibold">{field.label}</span>
            </div>
            <FilterValueEditor
              field={field}
              operator={draft?.operator}
              value={draft?.value}
              onValueChange={change}
              onDone={() => popover.close()}
              onBack={() => setField(null)}
            />
          </div>
        ) : (
          <Command filter="contains" announcement={fieldCount} onAction={(id) => { const f = fields.find((x) => x.id === id); if (f) setField(f); }}>
            <div data-slot="filter-search" className={searchRow}>
              <SearchIcon />
              <CommandInput ref={fieldSearch} aria-label="Filter by" placeholder="Filter by…" autoFocus className={searchInput} />
            </div>
            <CommandList className={cn(popupList, 'max-h-72')}>
              {available.map((f) => (
                <CommandItem key={f.id} value={f.id} label={f.label} className={popupRow}>
                  <Mark icon={f.icon} />
                  <span className="min-w-0 flex-1 truncate">{f.label}</span>
                </CommandItem>
              ))}
            </CommandList>
            <CommandEmpty className={cn(emptyClass, 'not-data-empty:hidden')}>{fields.length && !available.length ? 'Every field is already filtered' : 'No matching fields'}</CommandEmpty>
          </Command>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ── the chip ── */

export interface FilterChipProps extends Omit<ComponentProps<'div'>, 'onChange' | 'children' | 'role'>, VariantProps<typeof filterChipVariants> {
  filter: Filter;
  /** Default: the enclosing FilterBar's field of that id. */
  field?: FilterField;
  /** An edit of the operator or value, with UI SDK's change details (reason `update`). In a FilterBar the bar then
      applies it, unless `details.cancel()` was called; outside one, apply it yourself. */
  onValueChange?: (filter: Filter, details: FilterChangeDetails) => void;
  /** Default: the enclosing FilterBar's remove (focus moves to a neighbour). `options`: the press or key behind it. */
  onRemove?: (options?: FilterChangeOptions) => void;
  /** Plain text: no buttons, no editing (a preview of what a phrase will apply). */
  readOnly?: boolean;
  locale?: string;
}

function OperatorButton({ filter, field, onChange }: { filter: Filter; field: FilterField; onChange: (filter: Filter, options?: FilterChangeOptions) => void }) {
  const count = Array.isArray(filter.value) ? filter.value.length : 2;
  const text = operatorLabel(filter.operator, count);
  const offered = operatorsFor(field.kind);
  if (offered.length < 2) return <span data-slot="filter-chip-operator" className={cn(chipPart, 'text-foreground/70')}>{text}</span>;
  return (
    <DropdownMenu>
      <BarButton render={<DropdownMenuTrigger />} data-part="operator" aria-label={`${field.label} operator: ${text}`} className={cn(chipPart, chipButton, 'text-foreground/70')}>
        {text}
      </BarButton>
      <DropdownMenuContent side="bottom" align="start" className="min-w-44">
        <DropdownMenuRadioGroup
          value={filter.operator}
          onValueChange={(next, details) => { if (next && next !== filter.operator) onChange(withOperator(field, filter, next as FilterOperator), via(details)); }}
        >
          {offered.map((op) => (
            <DropdownMenuRadioItem key={op} value={op} closeOnSelect className="min-h-9 py-1.5 text-subhead">{operatorLabel(op, 2)}</DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ValueButton({ filter, field, locale, onChange }: { filter: Filter; field: FilterField; locale: string; onChange: (filter: Filter, options?: FilterChangeOptions) => void }) {
  const [popover] = useState(() => createPopoverController());
  const summary = describeValue(filter, field, locale);
  return (
    <Popover controller={popover}>
      <BarButton render={<PopoverTrigger />} data-part="value" aria-label={`${field.label} value: ${isFilterComplete(filter) ? summary : 'none selected'}`} className={cn(chipPart, chipButton, 'max-w-56 font-medium')}>
        <ValueSummary filter={filter} field={field} locale={locale} />
      </BarButton>
      <PopoverContent variant="surface" side="bottom" align="start" className="w-64 min-w-0 overflow-hidden outline-none">
        <PopoverTitle className="sr-only">{`Edit ${field.label}`}</PopoverTitle>
        <FilterValueEditor
          field={field}
          operator={filter.operator}
          value={filter.value}
          onValueChange={(value, details) => onChange(withValue(field, filter, value), via(details))}
          onDone={() => popover.close()}
        />
      </PopoverContent>
    </Popover>
  );
}

/**
 * One filter as `[field] [operator ▾] [value ▾] [×]`: the operator and value are buttons of their own (the value opens
 * the same searchable picker the menu used), × removes. It is a labelled group — "Status is any of Open, Confirmed" —
 * and Backspace / Delete on any part removes it.
 */
export function FilterChip({ filter, field: fieldProp, onValueChange, onRemove, readOnly, size, variant, locale: localeProp, className, onKeyDown, ref, ...props }: FilterChipProps) {
  const bar = useOptionalFilterBar();
  // While in a bar, a chip that leaves with focus hands it to a neighbour (the bar's focus recovery).
  const bindChip = readOnly ? undefined : bar?.bindChip;
  const forward = useRef(ref);
  forward.current = ref;
  const chipRef = useCallback((el: HTMLDivElement | null) => {
    const outer = forward.current;
    if (typeof outer === 'function') outer(el);
    else if (outer) outer.current = el;
    const unbind = el && bindChip ? bindChip(el, filter.id) : undefined;
    return () => {
      unbind?.();
      if (typeof outer === 'function') outer(null);
      else if (outer) outer.current = null;
    };
  }, [bindChip, filter.id]);
  const field = fieldProp ?? bar?.fields.find((f) => f.id === filter.field) ?? fallbackField(filter);
  const locale = localeProp ?? bar?.locale ?? 'en-US';
  const sentence = describeFilter(filter, [field], locale);
  const change = (next: Filter, options?: FilterChangeOptions) => {
    const details = changeDetails<FilterChangeReason>({ reason: 'update', ...options });
    onValueChange?.(next, details);
    if (!details.canceled) bar?.update(filter.id, { operator: next.operator, value: next.value }, { event: details.event, source: details.source });
  };
  const remove = onRemove ?? ((options?: FilterChangeOptions) => { bar?.remove(filter.id, options); });
  const count = Array.isArray(filter.value) ? filter.value.length : 2;

  return (
    <div
      ref={chipRef}
      data-slot="filter-chip"
      data-filter-id={filter.id}
      role="group"
      aria-label={sentence}
      onKeyDown={(e: ReactKeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(e);
        // The popovers portal out of the chip but their events still bubble through React: only keys from the chip itself count.
        if (!readOnly && !e.defaultPrevented && (e.key === 'Backspace' || e.key === 'Delete') && e.currentTarget.contains(e.target as Node)) {
          e.preventDefault();
          remove(from(e));
        }
      }}
      className={cn(filterChipVariants({ size, variant }), className)}
      {...props}
    >
      <span data-slot="filter-chip-field" className={cn(chipPart, 'font-medium')}>
        <FieldMark field={field} />
        <span className="truncate">{field.label}</span>
      </span>
      {readOnly ? (
        <>
          <span data-slot="filter-chip-operator" className={cn(chipPart, 'text-foreground/70')}>{operatorLabel(filter.operator, count)}</span>
          <span data-slot="filter-chip-value" className={cn(chipPart, 'max-w-56 font-medium')}><ValueSummary filter={filter} field={field} locale={locale} /></span>
        </>
      ) : (
        <>
          <OperatorButton filter={filter} field={field} onChange={change} />
          <ValueButton filter={filter} field={field} locale={locale} onChange={change} />
          {/* A 12px glyph: the hit area reaches past the chip's top and bottom, and widens on touch. */}
          <BarButton data-part="remove" aria-label={`Remove filter: ${sentence}`} onClick={(e) => remove(from(e))} className={cn(chipPart, chipButton, "relative px-1.5 text-foreground/70 after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] pointer-coarse:px-3")}>
            <Icon name="xmark" size={12} sw={2.6} />
          </BarButton>
        </>
      )}
    </div>
  );
}

/* ── list, clear, match, toolbar, bar ── */

export interface FilterListProps extends Omit<ComponentProps<'ul'>, 'children'> {
  /** Render each filter yourself (default: a `FilterChip`). */
  children?: (filter: Filter) => ReactNode;
}

/** The filters as a list of chips. Renders nothing while there are none. */
export function FilterList({ className, children, ...props }: FilterListProps) {
  const { filters } = useFilterBar();
  if (!filters.length) return null;
  return (
    <ul data-slot="filter-list" aria-label="Active filters" className={cn('m-0 flex min-w-0 list-none flex-wrap items-center gap-1.5 p-0', className)} {...props}>
      {filters.map((filter) => (
        <li key={filter.id} data-slot="filter-list-item" className="m-0 flex min-w-0 max-w-full p-0">
          {children ? children(filter) : <FilterChip filter={filter} />}
        </li>
      ))}
    </ul>
  );
}

export interface FilterClearProps extends Omit<ComponentProps<'button'>, 'children' | 'onClick'> {
  children?: ReactNode;
}

/** "Clear all". Renders nothing while there are no filters. */
export function FilterClear({ className, children = 'Clear all', ...props }: FilterClearProps) {
  const { filters, clear } = useFilterBar();
  if (!filters.length) return null;
  return (
    <BarButton onClick={(e) => { clear(from(e)); }} className={cn(triggerButton, className)} {...props}>
      {children}
    </BarButton>
  );
}

export type FilterMatchProps = Omit<BarButtonProps, 'onClick' | 'render' | 'children'>;

/** "Match all ▾" — whether every filter must hold or any one. Shown from two filters on. */
export function FilterMatch({ className, ...props }: FilterMatchProps) {
  const { filters, match, setMatch } = useFilterBar();
  if (filters.length < 2) return null;
  return (
    <DropdownMenu>
      <BarButton render={<DropdownMenuTrigger />} aria-label={`Match mode: ${match === 'all' ? 'all filters' : 'any filter'}`} {...props} className={cn(triggerButton, className)}>
        Match {match}
        <Icon name="chevron-down" size={11} sw={2.4} className="opacity-60" />
      </BarButton>
      <DropdownMenuContent side="bottom" align="start" className="min-w-48">
        <DropdownMenuRadioGroup
          value={match}
          onValueChange={(next, details) => {
            if (next === 'all' || next === 'any') setMatch(next, { reason: 'item-press', event: details.event, source: details.source });
          }}
        >
          <DropdownMenuRadioItem value="all" closeOnSelect className="min-h-9 py-1.5 text-subhead">Match all filters</DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="any" closeOnSelect className="min-h-9 py-1.5 text-subhead">Match any filter</DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export type FilterToolbarProps = Omit<ComponentProps<typeof Toolbar>, 'children'> & {
  /** Default: `<FilterMenu /> <FilterList /> <FilterClear />`. Compose your own to add `<FilterMatch />` or a
      `shortcut` on the menu. */
  children?: ReactNode;
};

/** The row: one tab stop, ←/→ across the Filter button, every chip's parts and Clear all (UI SDK's Toolbar). */
export function FilterToolbar({ className, children, ...props }: FilterToolbarProps) {
  return (
    <InToolbar value>
      <Toolbar aria-label="Filters" className={cx(toolbarClass, className)} {...props}>
        {children ?? (
          <>
            <FilterMenu />
            <FilterList />
            <FilterClear />
          </>
        )}
      </Toolbar>
    </InToolbar>
  );
}

export interface FilterBarProps extends Omit<ComponentProps<'div'>, 'defaultValue' | 'onChange' | 'children'>, UseFiltersOptions {
  /** What can be filtered. */
  fields: readonly FilterField[];
  /** Offer a field again once it is filtered (default: each field once; edit its chip instead). */
  allowDuplicates?: boolean;
  /** Locale for dates in chips (default `en-US`). */
  locale?: string;
  /** Default: a `FilterToolbar`. Add a `FilterInput` for the natural-language box. */
  children?: ReactNode;
}

/**
 * The state and layout of a set of filters: provides `fields`, the filters and their edits to its parts, and announces
 * what changes (UI SDK's `announce()`). With no children it renders the Filter button, the chips and Clear all.
 */
export function FilterBar({
  fields, value, defaultValue, onValueChange, match, defaultMatch, onMatchChange, allowDuplicates = false,
  locale = 'en-US', className, children, ...props
}: FilterBarProps) {
  // What the bar last asked for, so it announces a change only once it is rendered: a controlled consumer that
  // refuses (by not passing it back) hears nothing said and keeps its focus.
  const asked = useRef<Filter[] | null>(null);
  const pending = useRef<{ filters: Filter[]; message: string } | null>(null);
  const pendingMatch = useRef<'all' | 'any' | null>(null);
  const report = useRef(onValueChange);
  report.current = onValueChange;
  const hear = useCallback((next: Filter[], details: FilterChangeDetails) => {
    asked.current = next;
    report.current?.(next, details);
  }, []);
  const state = useFilters({ value, defaultValue, onValueChange: hear, match, defaultMatch, onMatchChange });
  const rootRef = useRef<HTMLDivElement>(null);
  // One page-wide polite region (UI SDK's), in the document the bar is in: a repeat is read again.
  const announce = useCallback((text: string) => announceText(text, { doc: rootRef.current?.ownerDocument }), []);
  const { filters, match: matchMode, setFilters } = state;

  // Focus that leaves with a chip goes to the next chip's same part (else the previous chip's, else the Filter
  // button). `order.before` is the order the leaving chip was in; `lastPart` is the part that held focus.
  const order = useRef<{ before: string[]; now: string[] }>({ before: [], now: [] });
  const lastPart = useRef<string | undefined>(undefined);
  const [recovery] = useState(() => createFocusRecovery({
    fallback: (lost) => {
      const root = rootRef.current;
      if (!root) return undefined;
      const chips = new Map([...root.querySelectorAll<HTMLElement>('[data-filter-id]')].map((el) => [el.dataset.filterId, el]));
      const ids = order.current.before.includes(lost.key) ? order.current.before : order.current.now;
      const at = ids.indexOf(lost.key);
      const neighbour = [...ids.slice(at + 1), ...ids.slice(0, Math.max(at, 0)).reverse()].find((id) => id !== lost.key && chips.has(id));
      const chip = neighbour === undefined ? undefined : chips.get(neighbour);
      if (chip) return chip.querySelector<HTMLElement>(`[data-part="${lastPart.current}"]`) ?? chip.querySelector<HTMLElement>('button');
      return root.querySelector<HTMLElement>('[data-filter-trigger]');
    },
  }));
  const bindChip = useCallback((el: HTMLElement, id: string) => {
    const note = (event: FocusEvent) => { lastPart.current = (event.target as HTMLElement).closest<HTMLElement>('[data-part]')?.dataset.part; };
    el.addEventListener('focusin', note);
    const unbind = recovery.bind(el, { key: id, props: {} });
    return () => {
      el.removeEventListener('focusin', note);
      unbind();
    };
  }, [recovery]);
  useLayoutEffect(() => {
    const ids = filters.map((f) => f.id);
    if (ids.join('\0') !== order.current.now.join('\0')) order.current = { before: order.current.now, now: ids };
  }, [filters]);

  // Say what changed once the bar shows it.
  useEffect(() => {
    const said = pending.current;
    if (said && sameFilters(said.filters, filters)) {
      pending.current = null;
      announce(said.message);
    }
  }, [filters, announce]);
  useEffect(() => {
    if (pendingMatch.current !== matchMode) return;
    pendingMatch.current = null;
    announce(matchMode === 'all' ? 'Matching all filters' : 'Matching any filter');
  }, [matchMode, announce]);

  const ctx = useMemo<FilterBarContextValue>(() => {
    const sentence = (f: Filter) => describeFilter(f, fields, locale);
    /** After a write the consumer heard: remember what to say once that list is rendered. */
    const expect = (ok: boolean, message: string | undefined) => {
      if (ok && message && asked.current) pending.current = { filters: asked.current, message };
      return ok;
    };
    return {
      ...state,
      fields,
      allowDuplicates,
      locale,
      announce,
      bindChip,
      setMatch: (next, given) => {
        const ok = state.setMatch(next, given);
        if (ok) pendingMatch.current = next;
        return ok;
      },
      add: (filter, options) => expect(state.add(filter, options), `Filter added: ${sentence(filter)}`),
      update: (id, patch, options) => {
        const before = filters.find((f) => f.id === id);
        return expect(state.update(id, patch, options), before && `Filter changed: ${sentence({ ...before, ...patch })}`);
      },
      remove: (id, options) => {
        const before = filters.find((f) => f.id === id);
        return expect(state.remove(id, options), before && `Filter removed: ${sentence(before)}`);
      },
      clear: (options) => expect(state.clear(options), filters.length === 1 ? 'Filter cleared' : `All ${filters.length} filters cleared`),
      apply: (incoming, mode = 'merge', options) => {
        if (!incoming.length) return false;
        const applied = setFilters((prev) => {
          if (mode === 'replace') return incoming;
          const next = [...prev];
          for (const filter of incoming) {
            const at = allowDuplicates ? -1 : next.findIndex((f) => f.field === filter.field);
            if (at >= 0) next[at] = { ...filter, id: next[at].id };
            else next.push(filter);
          }
          return next;
        }, { reason: 'apply', ...options });
        return expect(applied, `${incoming.length === 1 ? 'Filter' : `${incoming.length} filters`} applied: ${incoming.map(sentence).join('; ')}`);
      },
    };
  }, [state, fields, allowDuplicates, locale, announce, bindChip, filters, setFilters]);

  return (
    <FilterBarContext.Provider value={ctx}>
      <div ref={rootRef} data-slot="filter-bar" className={cn(barClass, className)} {...props}>
        {children ?? <FilterToolbar />}
      </div>
    </FilterBarContext.Provider>
  );
}
