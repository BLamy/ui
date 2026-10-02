'use client';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type ComponentProps, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode,
} from 'react';
import {
  Autocomplete,
  Button as AriaButton,
  Dialog as AriaDialog,
  Input,
  ListBoxItem as AriaListBoxItem,
  SearchField as AriaSearchField,
  TextField as AriaTextField,
  Toolbar, type ToolbarProps,
  composeRenderProps,
} from 'react-aria-components';
import { useFilter } from 'react-aria';
import { cva, type VariantProps } from 'class-variance-authority';
import { checkboxVariants } from '@/components/ui/checkbox';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { ListBox, listBoxItemVariants } from '@/components/ui/list-box';
import { Popover, PopoverTrigger, type PopoverProps } from '@/components/ui/popover';
import { Segmented } from '@/components/ui/segmented';
import {
  DATE_PRESETS, RELATIVE_UNITS, createFilter, describeFilter, describeValue, isDateValue, isFilterComplete,
  operatorLabel, operatorsFor, withOperator, withValue,
  type DatePreset, type DateValue, type Filter, type FilterField, type FilterOperator, type FilterOption, type FilterValue, type RelativeUnit,
} from '@/lib/filter';
import { Icon } from '@/lib/icon';
import { selectableText } from '@/lib/primitives';
import { cn } from '@/lib/utils';

/* ══ Filter — Linear-style filtering ══
   A "Filter" button (and an optional `F` shortcut) opens a searchable list of fields; pick one and a searchable
   multi-select (or a date, number or text editor) of its values; the filter lands as a chip you can edit in place —
   the operator and the value are each a button of their own — or remove (× · Backspace · Delete).

   <FilterBar fields={fields} defaultValue={[…]} onValueChange={setFilters} hotkey="f" />

   or composed:

   <FilterBar fields={fields} value={filters} onValueChange={setFilters}>
     <FilterInput />                       // components/filter-input — a sentence → chips
     <FilterToolbar>
       <FilterMenu />  <FilterList />  <FilterMatch />  <FilterClear />
     </FilterToolbar>
   </FilterBar>

   The data model — fields, operators, matching, serializing — is lib/filter (plain functions, no UI); `useFilters`
   is its state as a hook, for when you want the same behaviour without a FilterBar.

   Keyboard: the toolbar is one tab stop; ←/→ move across the Filter button, every chip's operator, value and ×, Clear
   all. Enter/Space open the focused part. Backspace or Delete on a chip removes it (focus moves to a neighbour).
   Additions, edits and removals are announced politely. ══ */

/* ── state ── */

export interface UseFiltersOptions {
  /** Controlled filters. */
  value?: Filter[];
  defaultValue?: Filter[];
  onValueChange?: (filters: Filter[]) => void;
  /** Controlled match mode: `all` (every filter) or `any`. */
  match?: 'all' | 'any';
  defaultMatch?: 'all' | 'any';
  onMatchChange?: (match: 'all' | 'any') => void;
}

export interface FilterState {
  filters: Filter[];
  match: 'all' | 'any';
  setFilters: (next: Filter[] | ((prev: Filter[]) => Filter[])) => void;
  setMatch: (match: 'all' | 'any') => void;
  /** Append a filter. */
  add: (filter: Filter) => void;
  /** Change a filter's operator and/or value. */
  update: (id: string, patch: Partial<Pick<Filter, 'operator' | 'value'>>) => void;
  remove: (id: string) => void;
  clear: () => void;
}

/** Controlled when `value` is given, else internal state. Updaters see the latest value even within one tick. */
function useControllable<T>(value: T | undefined, defaultValue: T, onChange?: (next: T) => void): [T, (next: T | ((prev: T) => T)) => void] {
  const [inner, setInner] = useState(defaultValue);
  const current = value !== undefined ? value : inner;
  const latest = useRef(current);
  latest.current = current;
  const notify = useRef(onChange);
  notify.current = onChange;
  const controlled = value !== undefined;
  const set = useCallback((next: T | ((prev: T) => T)) => {
    const resolved = typeof next === 'function' ? (next as (prev: T) => T)(latest.current) : next;
    if (Object.is(resolved, latest.current)) return;
    latest.current = resolved;
    if (!controlled) setInner(resolved);
    notify.current?.(resolved);
  }, [controlled]);
  return [current, set];
}

/** The filters and their edits as a hook: controlled or not, plus the match mode. `FilterBar` is built on it. */
export function useFilters({ value, defaultValue, onValueChange, match, defaultMatch = 'all', onMatchChange }: UseFiltersOptions = {}): FilterState {
  const [filters, setFilters] = useControllable<Filter[]>(value, defaultValue ?? [], onValueChange);
  const [matchMode, setMatch] = useControllable<'all' | 'any'>(match, defaultMatch, onMatchChange);
  return useMemo<FilterState>(() => ({
    filters,
    match: matchMode,
    setFilters,
    setMatch,
    add: (filter) => setFilters((prev) => [...prev, filter]),
    update: (id, patch) => setFilters((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f))),
    remove: (id) => setFilters((prev) => prev.filter((f) => f.id !== id)),
    clear: () => setFilters((prev) => (prev.length ? [] : prev)),
  }), [filters, matchMode, setFilters, setMatch]);
}

/* ── context ── */

export interface FilterBarContextValue extends FilterState {
  fields: readonly FilterField[];
  allowDuplicates: boolean;
  locale: string;
  /** Say something to screen readers, politely. */
  announce: (message: string) => void;
  /** Remove a filter and move focus to its neighbour (or the Filter button). */
  removeAndFocus: (id: string) => void;
  /** Add filters from outside the menu (the natural-language input): `merge` replaces a field's filter, `replace` swaps them all. */
  apply: (filters: Filter[], mode?: 'merge' | 'replace') => void;
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

/* ── variants ── */

export const filterBarVariants = cva('flex min-w-0 flex-col gap-2');

export const filterToolbarVariants = cva('flex min-w-0 flex-wrap items-center gap-1.5');

export const filterChipVariants = cva(
  'box-border inline-flex max-w-full min-w-0 items-stretch overflow-hidden rounded-lg text-foreground',
  {
    variants: {
      size: {
        default: 'h-7 text-footnote',
        sm: 'h-6 text-caption',
      },
      /** `preview` is a chip that is not a filter yet (what the natural-language input will apply). */
      tone: {
        default: 'bg-secondary shadow-hairline',
        preview: 'bg-primary/10 text-foreground shadow-hairline',
      },
    },
    defaultVariants: { size: 'default', tone: 'default' },
  },
);

/** One part of a chip (field, operator, value, remove): a hairline from its neighbour, its own hover, press and focus. */
const chipPart =
  'bl-btn flex min-w-0 items-center gap-1.5 border-0 border-l border-border bg-transparent px-2 [font-family:inherit] text-inherit outline-none first:border-l-0';
const chipButton =
  'cursor-pointer data-hovered:bg-accent data-pressed:bg-secondary-strong data-focus-visible:ring-2 data-focus-visible:ring-inset data-focus-visible:ring-ring';

const triggerButton =
  'bl-btn box-border inline-flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border-0 bg-transparent px-2 [font-family:inherit] text-footnote font-medium text-foreground/70 outline-none transition-[background-color] duration-spring-snappy ease-spring-snappy data-hovered:bg-accent data-pressed:bg-secondary-strong data-focus-visible:ring-2 data-focus-visible:ring-ring motion-reduce:transition-none';

/* ── small pieces ── */

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

function SearchBox({ label, placeholder, autoFocus, onBack }: { label: string; placeholder: string; autoFocus?: boolean; onBack?: () => void }) {
  return (
    <AriaSearchField
      data-slot="filter-search"
      aria-label={label}
      autoFocus={autoFocus}
      onKeyDown={(e) => { if (onBack && e.key === 'Backspace' && (e.target as HTMLInputElement).value === '') onBack(); }}
      className="flex h-10 items-center gap-2 border-b border-border px-3 focus-within:ring-2 focus-within:ring-inset focus-within:ring-ring/45"
    >
      <Icon name="search" size={16} sw={2.2} className="shrink-0 text-foreground/70" />
      <Input
        placeholder={placeholder}
        className={cn('min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 [font-family:inherit] text-subhead text-foreground outline-none placeholder:text-tertiary-foreground [&::-webkit-search-cancel-button]:appearance-none', selectableText)}
      />
    </AriaSearchField>
  );
}

const Empty = ({ children }: { children: ReactNode }) => <div className="px-3 py-6 text-center text-footnote text-foreground/70">{children}</div>;

/** A row that acts when pressed (a field, a preset, Yes / No), with an optional check for the current one. */
function Choice({ id, icon, checked, trailing, children, onAction, textValue }: {
  id: string; icon?: ReactNode; checked?: boolean; trailing?: ReactNode; children: ReactNode; onAction: () => void; textValue: string;
}) {
  return (
    <AriaListBoxItem id={id} textValue={textValue} onAction={onAction} className={listBoxItemVariants({ variant: 'popup' })}>
      {icon ? <span className="grid shrink-0 place-items-center text-foreground/70">{icon}</span> : null}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
      {checked ? <Icon name="check" size={16} sw={2.4} className="shrink-0 text-primary" /> : null}
    </AriaListBoxItem>
  );
}

/* ── value editors ── */

export interface FilterValueEditorProps {
  field: FilterField;
  /** The operator the value is for (a date's "in the last" asks for a span, the others for a day). */
  operator?: FilterOperator;
  /** The current value, if there is one. */
  value?: FilterValue;
  /** Called as the value changes: on every toggle of a select, on Enter or blur for typed values. */
  onChange: (value: FilterValue) => void;
  /** Called when the choice is complete (a preset picked, Enter pressed) so the host can close. */
  onDone?: () => void;
  /** Called by Backspace on an empty search: the host's way back. */
  onBack?: () => void;
  locale?: string;
}

/** The checkbox rows of a select / multiselect, behind a search field that keeps focus. */
function OptionEditor({ field, value, onChange, onBack }: { field: FilterField; value: string[]; onChange: (value: string[]) => void; onBack?: () => void }) {
  const { contains } = useFilter({ sensitivity: 'base' });
  const options = field.options ?? [];
  return (
    <Autocomplete filter={(text, input) => contains(text, input)}>
      <SearchBox label={`Search ${field.label.toLowerCase()}`} placeholder={`Search ${field.label.toLowerCase()}…`} autoFocus onBack={onBack} />
      <ListBox
        variant="popup"
        aria-label={field.label}
        selectionMode="multiple"
        escapeKeyBehavior="none"
        selectedKeys={new Set(value)}
        onSelectionChange={(keys) => {
          // Values keep the field's option order, so a chip reads the same however the boxes were ticked.
          const picked = new Set(keys === 'all' ? options.map((o) => o.value) : [...keys].map(String));
          onChange([...options.map((o) => o.value).filter((v) => picked.has(v)), ...[...picked].filter((v) => !options.some((o) => o.value === v))]);
        }}
        items={options.map((o) => ({ ...o, id: o.value }))}
        className="max-h-64"
        renderEmptyState={() => <Empty>No matches</Empty>}
      >
        {(o) => (
          <AriaListBoxItem
            id={o.value}
            textValue={[o.label, ...(o.keywords ?? [])].join(' ')}
            className={cn('group', listBoxItemVariants({ variant: 'popup' }))}
          >
            <span aria-hidden="true" className={cn(checkboxVariants({ shape: 'square' }), 'size-4.5')}>
              <Icon name="check" size={12} sw={3.2} className="opacity-0 group-data-selected:opacity-100" />
            </span>
            <Mark icon={o.icon} color={o.color} />
            <span className="min-w-0 flex-1 truncate">{o.label}</span>
            {o.count !== undefined ? <span className="shrink-0 text-caption text-foreground/70 tabular-nums">{o.count}</span> : null}
          </AriaListBoxItem>
        )}
      </ListBox>
    </Autocomplete>
  );
}

function BooleanEditor({ value, onChange, onDone }: { value?: FilterValue; onChange: (value: boolean) => void; onDone?: () => void }) {
  const pick = (v: boolean) => () => { onChange(v); onDone?.(); };
  return (
    <ListBox variant="popup" aria-label="Value" selectionMode="none">
      <Choice id="yes" textValue="Yes" checked={value === true} onAction={pick(true)}>Yes</Choice>
      <Choice id="no" textValue="No" checked={value === false} onAction={pick(false)}>No</Choice>
    </ListBox>
  );
}

/** Text or a number, applied on Enter, on the button, or when the field loses focus. */
function TypedEditor({ field, value, onChange, onDone, onBack }: { field: FilterField; value?: FilterValue; onChange: (value: FilterValue) => void; onDone?: () => void; onBack?: () => void }) {
  const numeric = field.kind === 'number';
  const initial = typeof value === 'number' || typeof value === 'string' ? String(value) : '';
  const [draft, setDraft] = useState(initial);
  const lastApplied = useRef(initial);
  const commit = (done: boolean) => {
    const text = draft.trim();
    if (text === '' || (numeric && !Number.isFinite(Number(text)))) return;
    if (text !== lastApplied.current) { lastApplied.current = text; onChange(numeric ? Number(text) : text); }
    if (done) onDone?.();
  };
  return (
    <div className="flex flex-col gap-2 p-2.5">
      <AriaTextField aria-label={`${field.label} ${numeric ? 'number' : 'text'}`} value={draft} onChange={setDraft} type={numeric ? 'number' : 'text'} inputMode={numeric ? 'decimal' : undefined}>
        <Input
          autoFocus
          placeholder={numeric ? 'Enter a number…' : `${field.label} contains…`}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit(true); }
            else if (e.key === 'Backspace' && draft === '' && onBack) onBack();
          }}
          onBlur={() => commit(false)}
          className={cn('box-border h-9 w-full rounded-lg border-0 bg-input px-3 [font-family:inherit] text-subhead text-foreground outline-none placeholder:text-tertiary-foreground data-focused:ring-2 data-focused:ring-ring/45', selectableText)}
        />
      </AriaTextField>
      <div className="flex items-center justify-between gap-2 text-caption text-foreground/70">
        <span>Press Enter to apply</span>
        <AriaButton onPress={() => commit(true)} isDisabled={draft.trim() === ''} className="bl-btn h-7 cursor-pointer rounded-lg border-0 bg-primary px-3 [font-family:inherit] text-footnote font-semibold text-primary-foreground outline-none data-disabled:cursor-default data-disabled:opacity-40 data-focus-visible:ring-2 data-focus-visible:ring-ring data-focus-visible:ring-offset-2">
          Apply
        </AriaButton>
      </div>
    </div>
  );
}

const dayRe = /^\d{4}-\d{2}-\d{2}$/;

function DateEditor({ operator, value, onChange, onDone }: { operator?: FilterOperator; value?: FilterValue; onChange: (value: DateValue) => void; onDone?: () => void }) {
  const current = isDateValue(value) ? value : undefined;
  const relative: Extract<DateValue, { type: 'relative' }> = current?.type === 'relative' ? current : { type: 'relative', amount: 7, unit: 'day' };
  const [amount, setAmount] = useState(String(relative.amount));
  const [day, setDay] = useState(current?.type === 'date' ? current.date : '');
  const field = 'rounded-lg border-0 bg-input px-3 [font-family:inherit] text-subhead text-foreground outline-none data-focused:ring-2 data-focused:ring-ring/45';

  if (operator === 'in_the_last') {
    const send = (text: string, unit: RelativeUnit) => {
      const n = Math.floor(Number(text));
      if (Number.isFinite(n) && n > 0) onChange({ type: 'relative', amount: n, unit });
    };
    return (
      <div className="flex flex-col gap-2.5 p-2.5">
        <AriaTextField aria-label="How many" value={amount} onChange={(t) => { setAmount(t); send(t, relative.unit); }} type="number" inputMode="numeric">
          <Input autoFocus min={1} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(amount, relative.unit); onDone?.(); } }} className={cn('box-border h-9 w-full tabular-nums', field, selectableText)} />
        </AriaTextField>
        <Segmented
          aria-label="Unit"
          value={relative.unit}
          onChange={(unit) => send(amount, unit as RelativeUnit)}
          options={RELATIVE_UNITS.map((u) => ({ id: u, label: `${u}s` }))}
        />
      </div>
    );
  }

  const commitDay = (done: boolean) => {
    if (dayRe.test(day) && !(current?.type === 'date' && current.date === day)) onChange({ type: 'date', date: day });
    if (done && dayRe.test(day)) onDone?.();
  };
  return (
    <div>
      <ListBox variant="popup" aria-label="Date" selectionMode="none" className="max-h-56">
        {DATE_PRESETS.map((p) => (
          <Choice key={p.id} id={p.id} textValue={p.label} checked={current?.type === 'preset' && current.preset === p.id} onAction={() => { onChange({ type: 'preset', preset: p.id as DatePreset }); onDone?.(); }}>
            {p.label}
          </Choice>
        ))}
      </ListBox>
      <div className="border-t border-border p-2.5">
        <AriaTextField aria-label="Pick a date" value={day} onChange={setDay} type="date">
          <Input
            onBlur={() => commitDay(false)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commitDay(true); } }}
            className={cn('box-border h-9 w-full', field, selectableText)}
          />
        </AriaTextField>
      </div>
    </div>
  );
}

/** The editor for a field's value: searchable checkbox rows, Yes / No, date presets and a date input, a number or text box. */
export function FilterValueEditor({ field, operator, value, onChange, onDone, onBack }: FilterValueEditorProps) {
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

export interface FilterMenuProps {
  /** Needed outside a FilterBar. */
  fields?: readonly FilterField[];
  /** Needed outside a FilterBar: `useFilters()`. */
  state?: FilterActions;
  /** The first press of this key (no modifier, nothing editable focused) opens the menu: `'f'` is Linear's. Off by default. */
  hotkey?: string | null;
  /** A custom trigger — any react-aria pressable. Default: a "Filter" button. */
  children?: ReactNode;
  /** The default trigger's label. */
  label?: ReactNode;
  isOpen?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: PopoverProps['placement'];
  className?: string;
  popoverClassName?: string;
  /** Fields already filtered stay in the list when true (default: a field is offered once). */
  allowDuplicates?: boolean;
}

function isEditable(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"], [role="textbox"], [role="searchbox"], [role="combobox"]');
}

/**
 * The "Filter" button and its popover: a searchable list of fields; picking one swaps the same popover to that field's
 * value editor, and the filter appears (and keeps updating) as values are chosen. Esc or Backspace on an empty search
 * steps back. Closing without choosing a value adds nothing.
 */
export function FilterMenu({
  fields: fieldsProp, state, hotkey = null, children, label = 'Filter', isOpen, defaultOpen = false, onOpenChange, placement = 'bottom start',
  className, popoverClassName, allowDuplicates: duplicatesProp,
}: FilterMenuProps) {
  const bar = useOptionalFilterBar();
  const fields = fieldsProp ?? bar?.fields ?? [];
  const api: FilterActions | undefined = bar ?? state;
  const allowDuplicates = duplicatesProp ?? bar?.allowDuplicates ?? false;
  const [innerOpen, setInnerOpen] = useState(defaultOpen);
  const open = isOpen ?? innerOpen;
  const [field, setField] = useState<FilterField | null>(null);
  const [draftId, setDraftId] = useState<string | null>(null);
  const { contains } = useFilter({ sensitivity: 'base' });

  const setOpen = useCallback((next: boolean) => {
    // Start from the field list each time it opens (not on close: the exit animation would flash it).
    if (next) { setField(null); setDraftId(null); }
    setInnerOpen(next);
    onOpenChange?.(next);
  }, [onOpenChange]);

  useEffect(() => {
    if (!hotkey) return undefined;
    const key = hotkey.toLowerCase();
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.key.toLowerCase() !== key) return;
      if (isEditable(e.target) || (e.target instanceof Element && e.target.closest('[role="dialog"], [role="alertdialog"], [role="menu"]'))) return;
      e.preventDefault();
      setOpen(true);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [hotkey, setOpen]);

  if (!api) return null;
  const draft = draftId ? api.filters.find((f) => f.id === draftId) : undefined;
  const taken = new Set(api.filters.map((f) => f.field));
  const available = fields.filter((f) => allowDuplicates || !taken.has(f.id));

  // The first value picked creates the filter; later ones edit it (and an emptied select removes it again).
  const change = (value: FilterValue) => {
    if (!field) return;
    if (draft) {
      if (Array.isArray(value) && value.length === 0) { api.remove(draft.id); setDraftId(null); return; }
      const next = withValue(field, draft, value);
      api.update(draft.id, { operator: next.operator, value: next.value });
    } else if (!(Array.isArray(value) && value.length === 0)) {
      const created = createFilter(field, value);
      api.add(created);
      setDraftId(created.id);
    }
  };

  return (
    <PopoverTrigger isOpen={open} onOpenChange={setOpen}>
      {children ?? (
        <AriaButton data-slot="filter-menu-trigger" aria-keyshortcuts={hotkey ? hotkey.toUpperCase() : undefined} className={cn(triggerButton, className)}>
          <Icon name="filter-circle" size={16} sw={2} />
          {label}
        </AriaButton>
      )}
      <Popover data-slot="filter-menu" placement={placement} className={cn('w-64 min-w-0 overflow-hidden', popoverClassName)}>
        <AriaDialog aria-label={field ? `${field.label} filter` : 'Add filter'} className="outline-none">
          {field ? (
            <div data-slot="filter-menu-value">
              <div className="flex items-center gap-1 border-b border-border px-1.5 py-1">
                <AriaButton aria-label="Back to fields" onPress={() => { setField(null); }} className="bl-btn grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg border-0 bg-transparent p-0 text-foreground/70 outline-none data-hovered:bg-accent data-pressed:bg-secondary-strong data-focus-visible:ring-2 data-focus-visible:ring-ring">
                  <Icon name="chevron-left" size={16} sw={2.4} />
                </AriaButton>
                <FieldMark field={field} />
                <span className="truncate text-subhead font-semibold">{field.label}</span>
              </div>
              <FilterValueEditor
                field={field}
                operator={draft?.operator}
                value={draft?.value}
                onChange={change}
                onDone={() => setOpen(false)}
                onBack={() => setField(null)}
              />
            </div>
          ) : (
            <Autocomplete filter={(text, input) => contains(text, input)}>
              <SearchBox label="Filter by" placeholder="Filter by…" autoFocus />
              <ListBox
                variant="popup"
                aria-label="Fields"
                className="max-h-72"
                items={available}
                renderEmptyState={() => <Empty>{fields.length && !available.length ? 'Every field is already filtered' : 'No matching fields'}</Empty>}
              >
                {(f) => (
                  <AriaListBoxItem
                    id={f.id}
                    textValue={f.label}
                    onAction={() => setField(f)}
                    className={listBoxItemVariants({ variant: 'popup' })}
                  >
                    <Mark icon={f.icon} />
                    <span className="min-w-0 flex-1 truncate">{f.label}</span>
                  </AriaListBoxItem>
                )}
              </ListBox>
            </Autocomplete>
          )}
        </AriaDialog>
      </Popover>
    </PopoverTrigger>
  );
}

/* ── the chip ── */

export interface FilterChipProps extends Omit<ComponentProps<'div'>, 'onChange' | 'children' | 'role'>, VariantProps<typeof filterChipVariants> {
  filter: Filter;
  /** Default: the enclosing FilterBar's field of that id. */
  field?: FilterField;
  /** Default: the enclosing FilterBar's update. */
  onChange?: (filter: Filter) => void;
  /** Default: the enclosing FilterBar's remove (focus moves to a neighbour). */
  onRemove?: () => void;
  /** Plain text: no buttons, no editing (a preview of what a phrase will apply). */
  readOnly?: boolean;
  locale?: string;
}

function OperatorButton({ filter, field, onChange }: { filter: Filter; field: FilterField; onChange: (filter: Filter) => void }) {
  const count = Array.isArray(filter.value) ? filter.value.length : 2;
  const text = operatorLabel(filter.operator, count);
  const offered = operatorsFor(field.kind);
  if (offered.length < 2) return <span data-slot="filter-chip-operator" className={cn(chipPart, 'text-foreground/70')}>{text}</span>;
  return (
    <DropdownMenu>
      <AriaButton data-slot="filter-chip-operator" data-part="operator" aria-label={`${field.label} operator: ${text}`} className={cn(chipPart, chipButton, 'text-foreground/70')}>
        {text}
      </AriaButton>
      <DropdownMenuContent
        placement="bottom start"
        aria-label={`${field.label} operator`}
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[filter.operator]}
        onSelectionChange={(keys) => {
          const next = [...keys][0] as FilterOperator | undefined;
          if (next && next !== filter.operator) onChange(withOperator(field, filter, next));
        }}
        popoverClassName="min-w-44"
      >
        {offered.map((op) => (
          <DropdownMenuItem key={op} id={op} textValue={operatorLabel(op, 2)} className="min-h-9 py-1.5 text-subhead">{operatorLabel(op, 2)}</DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ValueButton({ filter, field, locale, onChange }: { filter: Filter; field: FilterField; locale: string; onChange: (filter: Filter) => void }) {
  const [open, setOpen] = useState(false);
  const summary = describeValue(filter, field, locale);
  return (
    <PopoverTrigger isOpen={open} onOpenChange={setOpen}>
      <AriaButton data-slot="filter-chip-value" data-part="value" aria-label={`${field.label} value: ${isFilterComplete(filter) ? summary : 'none selected'}`} className={cn(chipPart, chipButton, 'max-w-56 font-medium')}>
        <ValueSummary filter={filter} field={field} locale={locale} />
      </AriaButton>
      <Popover placement="bottom start" className="w-64 min-w-0 overflow-hidden">
        <AriaDialog aria-label={`Edit ${field.label}`} className="outline-none">
          <FilterValueEditor
            field={field}
            operator={filter.operator}
            value={filter.value}
            onChange={(value) => onChange(withValue(field, filter, value))}
            onDone={() => setOpen(false)}
          />
        </AriaDialog>
      </Popover>
    </PopoverTrigger>
  );
}

/**
 * One filter as `[field] [operator ▾] [value ▾] [×]`: the operator and value are buttons of their own (the value opens
 * the same searchable picker the menu used), × removes. It is a labelled group — "Status is any of Open, Confirmed" —
 * and Backspace / Delete on any part removes it.
 */
export function FilterChip({ filter, field: fieldProp, onChange, onRemove, readOnly, size, tone, locale: localeProp, className, onKeyDown, ...props }: FilterChipProps) {
  const bar = useOptionalFilterBar();
  const field = fieldProp ?? bar?.fields.find((f) => f.id === filter.field) ?? fallbackField(filter);
  const locale = localeProp ?? bar?.locale ?? 'en-US';
  const sentence = describeFilter(filter, [field], locale);
  const change = onChange ?? ((next: Filter) => bar?.update(filter.id, { operator: next.operator, value: next.value }));
  const remove = onRemove ?? (() => bar?.removeAndFocus(filter.id));
  const count = Array.isArray(filter.value) ? filter.value.length : 2;

  return (
    <div
      data-slot="filter-chip"
      data-filter-id={filter.id}
      role="group"
      aria-label={sentence}
      onKeyDown={(e: ReactKeyboardEvent<HTMLDivElement>) => {
        onKeyDown?.(e);
        // The popovers portal out of the chip but their events still bubble through React: only keys from the chip itself count.
        if (!readOnly && !e.defaultPrevented && (e.key === 'Backspace' || e.key === 'Delete') && e.currentTarget.contains(e.target as Node)) {
          e.preventDefault();
          remove();
        }
      }}
      className={cn(filterChipVariants({ size, tone }), className)}
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
          <AriaButton data-slot="filter-chip-remove" data-part="remove" aria-label={`Remove filter: ${sentence}`} onPress={remove} className={cn(chipPart, chipButton, 'px-1.5 text-foreground/70')}>
            <Icon name="xmark" size={12} sw={2.6} />
          </AriaButton>
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

export interface FilterClearProps extends Omit<ComponentProps<typeof AriaButton>, 'children' | 'onPress'> {
  children?: ReactNode;
}

/** "Clear all". Renders nothing while there are no filters. */
export function FilterClear({ className, children = 'Clear all', ...props }: FilterClearProps) {
  const { filters, clear } = useFilterBar();
  if (!filters.length) return null;
  return (
    <AriaButton data-slot="filter-clear" onPress={clear} className={composeRenderProps(className, (cls) => cn(triggerButton, cls))} {...props}>
      {children}
    </AriaButton>
  );
}

/** "Match all ▾" — whether every filter must hold or any one. Shown from two filters on. */
export function FilterMatch({ className }: { className?: string }) {
  const { filters, match, setMatch, announce } = useFilterBar();
  if (filters.length < 2) return null;
  return (
    <DropdownMenu>
      <AriaButton data-slot="filter-match" aria-label={`Match mode: ${match === 'all' ? 'all filters' : 'any filter'}`} className={cn(triggerButton, className)}>
        Match {match}
        <Icon name="chevron-down" size={11} sw={2.4} className="opacity-60" />
      </AriaButton>
      <DropdownMenuContent
        placement="bottom start"
        aria-label="Match mode"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[match]}
        onSelectionChange={(keys) => {
          const next = [...keys][0] as 'all' | 'any' | undefined;
          if (next && next !== match) { setMatch(next); announce(next === 'all' ? 'Matching all filters' : 'Matching any filter'); }
        }}
        popoverClassName="min-w-48"
      >
        <DropdownMenuItem id="all" textValue="Match all filters" className="min-h-9 py-1.5 text-subhead">Match all filters</DropdownMenuItem>
        <DropdownMenuItem id="any" textValue="Match any filter" className="min-h-9 py-1.5 text-subhead">Match any filter</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export interface FilterToolbarProps extends Omit<ToolbarProps, 'children'> {
  hotkey?: string | null;
  showMatch?: boolean;
  children?: ReactNode;
}

/** The row: one tab stop, ←/→ across the Filter button, every chip's parts and Clear all (react-aria's Toolbar). */
export function FilterToolbar({ className, children, hotkey, showMatch = false, ...props }: FilterToolbarProps) {
  return (
    <Toolbar data-slot="filter-toolbar" aria-label="Filters" className={composeRenderProps(className, (cls) => cn(filterToolbarVariants(), cls))} {...props}>
      {children ?? (
        <>
          <FilterMenu hotkey={hotkey} />
          <FilterList />
          {showMatch ? <FilterMatch /> : null}
          <FilterClear />
        </>
      )}
    </Toolbar>
  );
}

export interface FilterBarProps extends Omit<ComponentProps<'div'>, 'defaultValue' | 'onChange' | 'children'>, UseFiltersOptions {
  /** What can be filtered. */
  fields: readonly FilterField[];
  /** Offer a field again once it is filtered (default: each field once; edit its chip instead). */
  allowDuplicates?: boolean;
  /** The Filter button's shortcut when no children are given: `'f'`. */
  hotkey?: string | null;
  /** Show the "Match all / any" menu when no children are given. */
  showMatch?: boolean;
  /** Locale for dates in chips (default `en-US`). */
  locale?: string;
  /** Default: a `FilterToolbar`. Add a `FilterInput` for the natural-language box. */
  children?: ReactNode;
}

/**
 * The state and layout of a set of filters: provides `fields`, the filters and their edits to its parts, and a polite
 * live region for what changes. With no children it renders the Filter button, the chips and Clear all.
 */
export function FilterBar({
  fields, value, defaultValue, onValueChange, match, defaultMatch, onMatchChange, allowDuplicates = false, hotkey = null, showMatch = false,
  locale = 'en-US', className, children, ...props
}: FilterBarProps) {
  const state = useFilters({ value, defaultValue, onValueChange, match, defaultMatch, onMatchChange });
  const rootRef = useRef<HTMLDivElement>(null);
  const [message, setMessage] = useState('');
  const tick = useRef(false);
  const announce = useCallback((text: string) => {
    tick.current = !tick.current;
    setMessage(tick.current ? text : `${text}${String.fromCharCode(0x200b)}`); // a repeat must still be read
  }, []);
  const refocus = useRef<string | null>(null);
  const { filters, setFilters } = state;

  const ctx = useMemo<FilterBarContextValue>(() => {
    const sentence = (f: Filter) => describeFilter(f, fields, locale);
    return {
      ...state,
      fields,
      allowDuplicates,
      locale,
      announce,
      add: (filter) => { state.add(filter); announce(`Filter added: ${sentence(filter)}`); },
      update: (id, patch) => {
        const before = filters.find((f) => f.id === id);
        state.update(id, patch);
        if (before) announce(`Filter changed: ${sentence({ ...before, ...patch })}`);
      },
      remove: (id) => {
        const before = filters.find((f) => f.id === id);
        state.remove(id);
        if (before) announce(`Filter removed: ${sentence(before)}`);
      },
      clear: () => { if (filters.length) { state.clear(); announce(filters.length === 1 ? 'Filter cleared' : `All ${filters.length} filters cleared`); } },
      removeAndFocus: (id) => {
        const at = filters.findIndex((f) => f.id === id);
        const neighbour = filters[at + 1] ?? filters[at - 1];
        refocus.current = neighbour?.id ?? '';
        const removed = filters[at];
        state.remove(id);
        if (removed) announce(`Filter removed: ${sentence(removed)}`);
      },
      apply: (incoming, mode = 'merge') => {
        if (!incoming.length) return;
        setFilters((prev) => {
          if (mode === 'replace') return incoming;
          const next = [...prev];
          for (const filter of incoming) {
            const at = allowDuplicates ? -1 : next.findIndex((f) => f.field === filter.field);
            if (at >= 0) next[at] = { ...filter, id: next[at].id };
            else next.push(filter);
          }
          return next;
        });
        announce(`${incoming.length === 1 ? 'Filter' : `${incoming.length} filters`} applied: ${incoming.map(sentence).join('; ')}`);
      },
    };
  }, [state, fields, allowDuplicates, locale, announce, filters, setFilters]);

  // After a removal, focus lands on the next chip (else the previous, else the Filter button) so the keyboard is not lost.
  useEffect(() => {
    const target = refocus.current;
    if (target === null) return;
    refocus.current = null;
    const root = rootRef.current;
    if (!root) return;
    const chip = [...root.querySelectorAll<HTMLElement>('[data-filter-id]')].find((el) => el.dataset.filterId === target);
    (chip?.querySelector<HTMLElement>('button') ?? root.querySelector<HTMLElement>('[data-slot="filter-menu-trigger"]'))?.focus();
  }, [filters]);

  return (
    <FilterBarContext.Provider value={ctx}>
      <div ref={rootRef} data-slot="filter-bar" className={cn(filterBarVariants(), className)} {...props}>
        {children ?? <FilterToolbar hotkey={hotkey} showMatch={showMatch} />}
        <div role="status" aria-live="polite" aria-atomic="true" data-slot="filter-announcer" className="sr-only">{message}</div>
      </div>
    </FilterBarContext.Provider>
  );
}
