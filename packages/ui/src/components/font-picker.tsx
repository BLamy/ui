'use client';
import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode, type Ref } from 'react';
import { useFieldControl } from '@ui-sdk/react/field';
import { createCommandController, type CommandValueChangeReason } from '@ui-sdk/react/command';
import { createParts } from '@ui-sdk/react/primitive';
import type { ChangeDetails } from '@ui-sdk/core';
import { cva, type VariantProps } from 'class-variance-authority';
import { Badge } from '@/components/ui/badge';
import { CommandMenu, CommandMenuEmpty, CommandMenuInput, CommandMenuItem, CommandMenuList } from '@/components/ui/command-menu';
import { fieldSurfaceVariants } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger, createPopoverController, type PopoverProps } from '@/components/ui/popover';
import { selectTriggerVariants } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle';
import { changeDetails, type ChangeGiven } from '@/lib/change-details';
import { fontStackList, type FontStackReason } from '@/lib/font-stack-primitive';
import {
  FONT_CATEGORIES, GOOGLE_FONTS, fontStack, useGoogleFontStatus, type FontCategory, type GoogleFont, type GoogleFontStatus,
} from '@/lib/google-fonts';
import { Icon } from '@/lib/icon';
import { valueChip } from '@/lib/primitives';
import { useVirtualRows } from '@/lib/use-virtual-rows';
import { cn, cx } from '@/lib/utils';

/* ══ FontPicker — Google Fonts family pickers. The list is the most popular families (lib/google-fonts), searchable
   and filtered by category, each drawn in itself (only the glyphs of its name are fetched, and only for the rows on
   screen). Hovering a family or arrowing to it previews it: `onPreview` hands you what to show for now and
   `undefined` when the preview ends, so the text it's for wears each font as you go down the list, the way
   Photoshop's font menu does. A family typed into the search that the list doesn't have can be used anyway: anything
   on Google Fonts loads.
   - FontPicker: one family (null: the system font), behind a trigger that shows it in its own face. It is compound
     like Select: the root holds the value and the popover's open state, FontPickerTrigger is the pop-up button and
     FontPickerContent the popup with the FontList; with no children it renders both.
   - FontStackPicker: a font stack (the first family that loads wins, the rest are its fallbacks), as chips you drag
     by their handle (or move with Space and the arrows) to reorder, or remove; a family you add goes in front, and
     the preview puts the hovered one in front of the rest.
   - FontList: the list alone, for a panel or a sheet.
   <FontPicker value={font} onValueChange={setFont} onPreview={setPreview} />
   <p style={{ fontFamily: fontStack(preview === undefined ? font : preview) }}>…</p>
   Built on UI SDK: the list is the kit's CommandMenu (the search keeps focus while the arrows move the highlight;
   Enter or a press picks), its rows CommandMenuItems virtualized with `createVirtualizer` (lib/use-virtual-rows), the
   category filter the kit's ToggleGroup, the pickers Popovers, and the stack's chips lib/font-stack-primitive
   (`createReorder`). ══ */

/** Why a family was chosen, or a stack changed. */
export type FontPickerReason = 'item-press' | 'enter-key' | FontStackReason;
/** What `onValueChange` receives after the value: UI SDK's change details (the reason, the event, who caused it, and
    `cancel()`, which keeps an uncontrolled picker as it was). */
export type FontPickerChangeDetails = ChangeDetails<FontPickerReason>;

/** The system font's key in the list (no family is called that). */
const SYSTEM = '\u0000system';
const CUSTOM = '\u0000use:';

interface Row {
  id: string;
  /** The family, or null for the system font. */
  family: string | null;
  font?: GoogleFont;
  /** Typed into the search, not in the list. */
  custom?: boolean;
}

/* A row: 40px (the virtualizer's ROW), inset by the list's padding, the mark's column first. */
const fontRow = 'absolute inset-x-1.5 h-10 min-h-0 scroll-my-1.5 gap-2.5 rounded-lg py-0 ps-2 pe-3 hover:bg-accent';

interface ListCoreProps {
  /** A row's mark (a check, a place in the stack), or null when it isn't in use. */
  mark: (family: string | null) => ReactNode;
  onPick: (family: string | null, given: ChangeGiven<FontPickerReason>) => void;
  /** The family under the pointer or the arrow keys (null: the system font); undefined when none is. */
  onActive: (family: string | null | undefined) => void;
  /** Rows that can't be picked right now (a full stack). */
  isRowDisabled?: (family: string | null) => boolean;
  fonts: readonly GoogleFont[];
  allowSystem: boolean;
  systemLabel: string;
  defaultCategory?: FontCategory | 'all';
  /** The family to open on (scrolled into the middle of the list). */
  current?: string | null;
  autoFocus?: boolean;
  className?: string;
  footer?: ReactNode;
}

const ROW = 40, PAD = 6;

/** The search, the category filter and the families: what both pickers open. */
function FontListCore({
  mark, onPick, onActive, isRowDisabled, fonts, allowSystem, systemLabel, defaultCategory = 'all', current, autoFocus, className, footer,
}: ListCoreProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FontCategory | 'all'>(defaultCategory);
  const [command] = useState(() => createCommandController());
  const [active, setActive] = useState<string | null>(null);
  const activeBy = useRef<CommandValueChangeReason | null>(null);

  const q = query.trim();
  const rows = useMemo<Row[]>(() => {
    const lower = q.toLowerCase();
    const shown = fonts.filter((f) => (category === 'all' || f.category === category) && (!lower || f.family.toLowerCase().includes(lower)));
    // A name nothing in the list matches may still be on Google Fonts.
    const unlisted = lower.length > 1 && !fonts.some((f) => f.family.toLowerCase().includes(lower));
    return [
      ...(allowSystem && !lower && category === 'all' ? [{ id: SYSTEM, family: null }] : []),
      ...(unlisted ? [{ id: CUSTOM + q, family: q, custom: true }] : []),
      ...shown.map((f) => ({ id: f.family, family: f.family, font: f })),
    ];
  }, [fonts, category, q, allowSystem]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);

  // A family that isn't listed can be chosen once Google Fonts turns out to have it (asked once the typing pauses).
  const typed = useSettled(rows.find((r) => r.custom)?.family ?? null, 450);
  const typedStatus = useGoogleFontStatus(typed, { text: typed ?? undefined });
  const disabled = (row: Row) => (row.custom && (row.family !== typed || typedStatus !== 'ready')) || !!isRowDisabled?.(row.family);

  // The whole collection, so the arrows and Enter reach rows that aren't rendered.
  const items = rows.map((r) => ({ value: r.id, label: r.family ?? systemLabel, disabled: disabled(r) }));

  const activeIndex = active == null ? -1 : rows.findIndex((r) => r.id === active);
  const virtual = useVirtualRows({ count: rows.length, rowHeight: ROW, keyOf: (i) => rows[i].id, rows, keep: () => (activeIndex >= 0 ? [activeIndex] : []) });

  const scroller = useRef<HTMLElement | null>(null);
  const { scrollerRef } = virtual;
  const listRef = useCallback((el: HTMLElement | null) => {
    scroller.current = el;
    return scrollerRef(el);
  }, [scrollerRef]);

  // Open on the family in use, centered in the list (rows start below its top padding), as a design tool's font menu
  // does.
  useLayoutEffect(() => {
    const at = current ? rows.findIndex((r) => r.family === current) : -1;
    if (at <= 0) return undefined;
    // After the popover has placed itself.
    const raf = requestAnimationFrame(() => {
      const el = scroller.current;
      if (el) el.scrollTop = Math.max(0, PAD + at * ROW - (el.clientHeight - ROW) / 2);
    });
    return () => cancelAnimationFrame(raf);
  }, []); // Only when it opens.

  // The preview: the highlighted family (under the pointer or the arrow keys); none when nothing is, or when the
  // row went away with a new search.
  const report = useRef(onActive);
  report.current = onActive;
  const activeFamily = active == null || !byId.has(active) ? undefined : byId.get(active)?.family;
  useEffect(() => { report.current(activeFamily); }, [activeFamily]);
  useEffect(() => () => report.current(undefined), []);

  return (
    <CommandMenu
      items={items}
      filter={false}
      autoHighlight={false}
      query={query}
      onQueryChange={(next) => setQuery(next)}
      controller={command}
      onValueChange={(value, details) => {
        activeBy.current = details.reason;
        setActive(value);
        if (details.index >= 0 && details.reason !== 'item-hover') virtual.scrollToIndex(details.index);
      }}
      onAction={(value, details) => {
        const row = byId.get(value);
        if (row) onPick(row.family, { reason: details.event instanceof KeyboardEvent ? 'enter-key' : 'item-press', event: details.event });
      }}
      // The popover (or the panel around a bare FontList) is the surface.
      className={cn('rounded-none bg-transparent shadow-none [--command-surface:transparent]', className)}
    >
      <CommandMenuInput aria-label="Search fonts" placeholder="Search fonts" autoFocus={!!autoFocus} className="text-subhead" />
      <ToggleGroup<string>
        aria-label="Category"
        size="sm"
        value={[category]}
        deselectable={false}
        onValueChange={(value) => { if (value[0]) setCategory(value[0] as FontCategory | 'all'); }}
        // Wraps rather than scrolling sideways, so every category shows in a 320px popover.
        className="flex w-full shrink-0 flex-wrap gap-1 border-y border-border px-2 py-1.5"
      >
        {[{ id: 'all', label: 'All' }, ...FONT_CATEGORIES].map((c) => (
          <ToggleGroupItem key={c.id} value={c.id} className="h-7 font-medium">{c.label}</ToggleGroupItem>
        ))}
      </ToggleGroup>
      <CommandMenuList
        ref={listRef}
        stickyHeadings={false}
        // A preview by the pointer ends when the pointer leaves; one by the arrow keys stays.
        onPointerLeave={() => { if (activeBy.current === 'item-hover') command.setValue(null); }}
        // The search field's arrow keys move through the fonts; the list is also a tab stop of its own, so the keys
        // can scroll it without a pointer (as Chrome already makes a scroller with nothing focusable in it).
        tabIndex={0}
        // 288px, or less when the popup has less room (its --available-height, less the search, the categories and a
        // footer), so the list gives way and nothing below it is cut off.
        className="max-h-none px-0 pb-0 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
        style={{ height: rows.length ? LIST_HEIGHT : 0 }}
      >
        {() => (
          <div className="relative" style={{ height: virtual.size + 2 * PAD }}>
            {virtual.items.map((v) => {
              const row = rows[v.index];
              if (!row) return null;
              return (
                <FontRow
                  key={row.id}
                  row={row}
                  index={v.index}
                  top={PAD + v.start}
                  disabled={disabled(row)}
                  mark={row.custom ? null : mark(row.family)}
                  systemLabel={systemLabel}
                  lookup={row.custom ? (row.family === typed ? typedStatus : 'loading') : undefined}
                />
              );
            })}
          </div>
        )}
      </CommandMenuList>
      <CommandMenuEmpty title="No fonts" />
      {footer}
    </CommandMenu>
  );
}

/* 288px, less whatever the popup lacks: its room (--font-list-room, the popup's --available-height) minus the search,
   the categories and a footer (168px), never under 96px. Outside a popup the variable is unset and the list is 288px. */
const LIST_HEIGHT = 'clamp(6rem, calc(var(--font-list-room, 100rem) - 10.5rem), 18rem)';

/** A value once it has stopped changing for `ms`. */
function useSettled<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}

const CATEGORY_LABEL = Object.fromEntries(FONT_CATEGORIES.map((c) => [c.id, c.label])) as Record<FontCategory, string>;

/** A family drawn in itself (fetching only its name's glyphs), with its mark when it's in use. A typed family is
    looked up by the list (`lookup`), not by the row. The category after it describes the option rather than being
    part of its name. */
function FontRow({ row, index, top, disabled, mark, systemLabel, lookup }: {
  row: Row; index: number; top: number; disabled: boolean; mark: ReactNode; systemLabel: string; lookup?: GoogleFontStatus;
}) {
  const own = useGoogleFontStatus(row.custom ? null : row.family, { text: row.family ?? undefined });
  const status = lookup ?? own;
  const detailId = useId();
  const detail = row.custom ? (status === 'missing' ? 'Not on Google Fonts' : status === 'ready' ? 'Google Fonts' : 'Looking…') : row.font ? CATEGORY_LABEL[row.font.category] : row.family ? '' : 'Default';
  return (
    <CommandMenuItem
      value={row.id}
      label={row.family ?? systemLabel}
      disabled={disabled}
      index={index}
      aria-describedby={detail ? detailId : undefined}
      className={fontRow}
      style={{ top }}
      icon={<span className="grid w-[18px] place-items-center text-primary">{mark}</span>}
      title={(
        <>
          <span
            className={cn('text-body leading-6 transition-opacity duration-200', row.family && status !== 'ready' && 'opacity-45')}
            style={{ fontFamily: status === 'ready' ? fontStack(row.family, row.font?.category) : undefined }}
          >
            {row.custom ? `Use “${row.family}”` : row.family ?? systemLabel}
          </span>
          {mark ? <span className="sr-only"> (in use)</span> : null}
        </>
      )}
      trailing={detail ? <span id={detailId} aria-hidden="true" className="ms-auto shrink-0 text-caption text-muted-foreground">{detail}</span> : null}
    />
  );
}

const Check = () => <Icon name="check" size={18} sw={2.4} />;

/**
 * Controlled when `value` is given, else its own state. Like UI SDK's `createChange`, a change reaches `onChange` first
 * and moves the state only when it wasn't canceled; it returns whether it went through.
 */
function useValue<T>(
  value: T | undefined,
  defaultValue: T,
  onChange: ((next: T, details: FontPickerChangeDetails) => void) | undefined,
): [T, (next: T, details: FontPickerChangeDetails) => boolean] {
  const [inner, setInner] = useState(defaultValue);
  const controlled = value !== undefined;
  const notify = useRef(onChange);
  notify.current = onChange;
  const set = useCallback((next: T, details: FontPickerChangeDetails) => {
    notify.current?.(next, details);
    if (details.canceled) return false;
    if (!controlled) setInner(next);
    return true;
  }, [controlled]);
  return [controlled ? value : inner, set];
}

/* ── One family ── */

export interface FontListProps {
  /** The family in use; null for the system font. Pass it to control it. */
  value?: string | null;
  /** The family in use at first, when uncontrolled. Default null (the system font). */
  defaultValue?: string | null;
  onValueChange?: (family: string | null, details: FontPickerChangeDetails) => void;
  /** The family being previewed as the list is hovered or arrowed through (null: the system font), and `undefined`
   *  when nothing is (the pointer left the list, or it closed). */
  onPreview?: (family: string | null | undefined) => void;
  /** The families offered (default: the most popular Google Fonts families). */
  fonts?: readonly GoogleFont[];
  /** Offer the system font (null) first. Default true. */
  allowSystem?: boolean;
  /** What the system font is called. Default “System”. */
  systemLabel?: string;
  /** The category the filter starts on. Default `all`. */
  defaultCategory?: FontCategory | 'all';
  autoFocus?: boolean;
  className?: string;
}

/** The list alone: search, category filter, and the families. */
export function FontList({
  value: valueProp, defaultValue = null, onValueChange, onPreview, fonts = GOOGLE_FONTS, allowSystem = true, systemLabel = 'System', ...rest
}: FontListProps) {
  const [value, setValue] = useValue(valueProp, defaultValue, onValueChange);
  return (
    <FontListCore
      {...rest}
      fonts={fonts}
      allowSystem={allowSystem}
      systemLabel={systemLabel}
      current={value}
      mark={(f) => (f === value ? <Check /> : null)}
      onPick={(family, given) => { setValue(family, changeDetails(given)); }}
      onActive={(f) => onPreview?.(f)}
    />
  );
}

/** A family's name, drawn in it once it has loaded. */
function FamilyName({ id, family, systemLabel, className }: { id?: string; family: string | null; systemLabel?: string; className?: string }) {
  const status = useGoogleFontStatus(family, { text: family ?? undefined });
  return (
    <span id={id} className={cn('min-w-0 truncate', className)} style={{ fontFamily: status === 'ready' ? fontStack(family) : undefined }}>
      {family ?? systemLabel}
    </span>
  );
}

/** What the root shares with its trigger and popup. */
interface FontPickerContextValue {
  value: string | null;
  /** Moves the value (unless the change was canceled) and closes the popup; false when canceled. */
  choose: (family: string | null, details: FontPickerChangeDetails) => boolean;
  label: string;
  systemLabel: string;
  disabled?: boolean;
  required?: boolean;
  list: Pick<FontListProps, 'fonts' | 'allowSystem' | 'defaultCategory' | 'onPreview'>;
  /** The trigger, which a failed `required` check focuses. */
  trigger: { current: HTMLButtonElement | null };
}
const FontPickerContext = createContext<FontPickerContextValue | null>(null);

function usePicker(part: string): FontPickerContextValue {
  const picker = useContext(FontPickerContext);
  if (!picker) throw new Error(`<${part}> must be used within <FontPicker>`);
  return picker;
}

/** What a picker submits with its form, and how it says it is required: a visually hidden text input holding the
    value (a hidden `<input type="hidden">` can't be `required`), which hands focus to the visible control when the
    browser points at it. Its `invalid` event reaches the Field around it, so a FieldError shows `valueMissing`. */
function FormValue({ name, form, required, disabled, value, focus }: {
  name?: string; form?: string; required?: boolean; disabled?: boolean; value: string; focus: () => void;
}) {
  if (!name && !required) return null;
  return (
    <input
      data-slot="font-picker-value"
      aria-hidden="true"
      tabIndex={-1}
      name={name}
      form={form}
      required={required}
      disabled={disabled}
      value={value}
      onChange={() => {}}
      onFocus={focus}
      className="pointer-events-none absolute size-px opacity-0"
    />
  );
}

/** Form props a picker takes, as a native control would; a Field around it gives `name` and `disabled` too. */
export interface FontPickerFormProps {
  /** Submits the value with a form under this name (a stack as its families, comma-separated). */
  name?: string;
  /** The id of a form elsewhere on the page to submit with. */
  form?: string;
  /** A family must be chosen before the form submits; the Field's FieldError says so. */
  required?: boolean;
}

export interface FontPickerProps extends Omit<FontListProps, 'autoFocus' | 'className'>, FontPickerFormProps,
  Pick<PopoverProps, 'open' | 'defaultOpen' | 'onOpenChange' | 'presentation'> {
  /** What the font is for ("Headline font"): the trigger says it with the family, and it names the popup. In a Field,
   *  the FieldLabel names it instead. Default "Font". */
  'aria-label'?: string;
  disabled?: boolean;
  /** A FontPickerTrigger and a FontPickerContent, by default. */
  children?: ReactNode;
}

/** One family behind a pop-up button: the root holds the family (`value` / `defaultValue` / `onValueChange`), the
    preview (`onPreview`), the popup's open state (`open` / `defaultOpen` / `onOpenChange`, `presentation`) and the
    form value (`name`, `form`, `required`). In a Field, its label names the trigger and its error marks it invalid. */
export function FontPicker({
  value: valueProp, defaultValue = null, onValueChange, onPreview, disabled: disabledProp, fonts, allowSystem, defaultCategory,
  'aria-label': label = 'Font', systemLabel = 'System', open, defaultOpen, onOpenChange, presentation, children,
  name, form, required,
}: FontPickerProps) {
  const [popover] = useState(() => createPopoverController());
  const [value, setValue] = useValue(valueProp, defaultValue, onValueChange);
  const field = useFieldControl();
  const disabled = disabledProp ?? field?.disabled;
  const trigger = useRef<HTMLButtonElement | null>(null);
  const picker: FontPickerContextValue = {
    value,
    // A choice closes the list, unless the consumer canceled it.
    choose: (family, details) => {
      const done = setValue(family, details);
      if (done) popover.close();
      return done;
    },
    label,
    systemLabel,
    disabled,
    required,
    list: { fonts, allowSystem, defaultCategory, onPreview },
    trigger,
  };
  return (
    <FontPickerContext.Provider value={picker}>
      <Popover controller={popover} open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} presentation={presentation}>
        {children ?? (
          <>
            <FontPickerTrigger />
            <FontPickerContent />
          </>
        )}
      </Popover>
      <FormValue name={name ?? field?.name} form={form} required={required} disabled={disabled} value={value ?? ''} focus={() => trigger.current?.focus()} />
    </FontPickerContext.Provider>
  );
}

/** A part's `ref` together with one of the kit's own. */
function useMergedRef<T>(own: { current: T | null }, ref: Ref<T> | undefined) {
  return useCallback((node: T | null) => {
    own.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) (ref as { current: T | null }).current = node;
  }, [own, ref]);
}

export type FontPickerTriggerProps = Omit<ComponentProps<typeof PopoverTrigger>, 'children'> & {
  /** The field's size: `sm` 32px, `default` 44px, `lg` 50px. */
  size?: 'sm' | 'default' | 'lg';
};

/** The pop-up button, Select's trigger (the kit's filled field box) showing the family in its own face. It is named
    by what the font is for and the family ("Headline font: Inter"); in a Field, by the FieldLabel and the family. */
export function FontPickerTrigger({ className, size, ref, ...props }: FontPickerTriggerProps) {
  const picker = usePicker('FontPickerTrigger');
  const valueId = useId();
  // A Field's label points at the trigger (pressing it focuses the button), its description and error describe it.
  const field = useFieldControl({ id: props.id });
  const fieldProps = field?.props({ id: props.id, 'aria-describedby': props['aria-describedby'] }) as Record<string, unknown> | undefined;
  const labelledBy = fieldProps?.['aria-labelledby'] as string | undefined;
  const merged = useMergedRef(picker.trigger, ref);
  return (
    <PopoverTrigger
      data-font-picker=""
      id={fieldProps?.id as string | undefined}
      aria-describedby={fieldProps?.['aria-describedby'] as string | undefined}
      aria-invalid={fieldProps?.['aria-invalid'] as boolean | undefined}
      aria-required={picker.required || undefined}
      {...(labelledBy ? { 'aria-labelledby': `${labelledBy} ${valueId}` } : { 'aria-label': `${picker.label}: ${picker.value ?? picker.systemLabel}` })}
      disabled={picker.disabled}
      className={cx(
        [
          selectTriggerVariants({ size }), 'aria-expanded:bg-transparent aria-expanded:shadow-[inset_0_0_0_1.5px_var(--primary)]',
          'aria-invalid:shadow-[inset_0_0_0_1.5px_var(--destructive)]',
        ],
        className,
      )}
      {...props}
      ref={merged}
    >
      <FamilyName id={valueId} family={picker.value} systemLabel={picker.systemLabel} className="flex-1" />
      <Icon name="chevron-up-down" size={16} sw={2.2} className="shrink-0 opacity-70" />
    </PopoverTrigger>
  );
}

export type FontPickerContentProps = Omit<ComponentProps<typeof PopoverContent>, 'children' | 'variant'> & {
  /** The list, by default a FontList of the root's family. */
  children?: ReactNode;
};

/* The popup is capped at the room under (or beside) its trigger; the list's 288px gives way first (see FontListCore),
   so in a short space the search, the categories and a footer stay whole. */
// UI SDK's --available-height does not reach the popup's descendants, so it is passed on under a name that does.
const fontPopup = 'w-80 overflow-hidden outline-none [--font-list-room:var(--available-height)]';

/** The popup: 320px wide, under the trigger by default (`side`, `align`), holding the FontList. */
export function FontPickerContent({ className, side = 'bottom', align = 'start', children, ...props }: FontPickerContentProps) {
  const picker = usePicker('FontPickerContent');
  return (
    <PopoverContent variant="plain" side={side} align={align} className={cx(fontPopup, className)} {...props}>
      <PopoverTitle className="sr-only">{picker.label}</PopoverTitle>
      {children ?? (
        <FontList
          {...picker.list}
          value={picker.value}
          systemLabel={picker.systemLabel}
          autoFocus
          onValueChange={(family, details) => { picker.choose(family, details); }}
        />
      )}
    </PopoverContent>
  );
}

/* ── A font stack ── */

/** The stack's field: the kit's filled field box, growing a line at a time as chips wrap. */
export const fontStackPickerInputGroupVariants = cva('h-auto w-full flex-wrap gap-1.5 aria-invalid:shadow-[inset_0_0_0_1.5px_var(--destructive)]', {
  variants: {
    size: {
      sm: [fieldSurfaceVariants({ size: 'sm' }), 'min-h-8 p-1 text-footnote'],
      default: [fieldSurfaceVariants({ size: 'default' }), 'min-h-11 p-1.5 text-subhead'],
      lg: [fieldSurfaceVariants({ size: 'lg' }), 'min-h-[50px] p-2 text-subhead'],
    },
  },
  defaultVariants: { size: 'default' },
});

const { Root: StackChips, Item: StackChip, Handle: StackChipHandle, Remove: StackChipRemove } = createParts(fontStackList, {
  root: 'div', item: 'div', handle: 'button', remove: 'button',
});

/** What the stack's root shares with its parts. */
interface FontStackContextValue {
  value: readonly string[];
  set: (next: string[], details: FontPickerChangeDetails) => void;
  toggle: (family: string | null, given: ChangeGiven<FontPickerReason>) => void;
  full: boolean;
  maxCount: number;
  label: string;
  placeholder: string;
  disabled?: boolean;
  required?: boolean;
  fonts: readonly GoogleFont[];
  defaultCategory?: FontCategory | 'all';
  onPreview?: (families: string[] | undefined) => void;
  field: HTMLDivElement | null;
  setField: (element: HTMLDivElement | null) => void;
  add: { current: HTMLButtonElement | null };
}
const FontStackContext = createContext<FontStackContextValue | null>(null);

function useStack(part: string): FontStackContextValue {
  const stack = useContext(FontStackContext);
  if (!stack) throw new Error(`<${part}> must be used within <FontStackPicker>`);
  return stack;
}

export interface FontStackPickerProps extends FontPickerFormProps, Pick<PopoverProps, 'open' | 'defaultOpen' | 'onOpenChange' | 'presentation'> {
  /** The families, the one to use first: fontStack(value) is the CSS font-family. Pass it to control them. */
  value?: readonly string[];
  /** The families at first, when uncontrolled. */
  defaultValue?: readonly string[];
  onValueChange?: (families: string[], details: FontPickerChangeDetails) => void;
  /** As the list is hovered or arrowed through: the stack with that family in front (how it would look added), and
   *  `undefined` when the preview ends. */
  onPreview?: (families: string[] | undefined) => void;
  /** At most this many families. Default 3. */
  maxCount?: number;
  /** The families offered (default: the most popular Google Fonts families). */
  fonts?: readonly GoogleFont[];
  /** The category the list's filter starts on (a monospace stack: `monospace`). Default `all`. */
  defaultCategory?: FontCategory | 'all';
  /** What the field says while the stack is empty. Default “Add a font”. */
  placeholder?: string;
  /** What the stack is for ("Text fonts"); in a Field, the FieldLabel names it instead. Default "Font stack". */
  'aria-label'?: string;
  disabled?: boolean;
  /** A FontStackPickerInputGroup and a FontStackPickerContent, by default. */
  children?: ReactNode;
}

const noFamilies: readonly string[] = [];

/** A font stack as chips (drag one by its handle, or focus the handle, press Space and use the arrow keys, to
    reorder; × or Delete removes it), and a button that opens the list to add or remove families. Compound like
    FontPicker: the root holds the families and the popup's open state; FontStackPickerInputGroup is the field of chips
    (`size`), FontStackPickerContent the popup (`side`, `align`). With no children it renders both. */
export function FontStackPicker({
  value: valueProp, defaultValue = noFamilies, onValueChange, onPreview, maxCount = 3, fonts = GOOGLE_FONTS, defaultCategory,
  placeholder = 'Add a font', 'aria-label': label = 'Font stack', disabled: disabledProp, open, defaultOpen, onOpenChange, presentation,
  name, form, required, children,
}: FontStackPickerProps) {
  const [value, setValue] = useValue<readonly string[]>(valueProp, defaultValue, (next, details) => onValueChange?.([...next], details));
  const [field, setField] = useState<HTMLDivElement | null>(null);
  const add = useRef<HTMLButtonElement | null>(null);
  const fieldContext = useFieldControl();
  const disabled = disabledProp ?? fieldContext?.disabled;
  const full = value.length >= maxCount;
  // The chips' own details (UI SDK's, from the primitive) or the list's pick go to the consumer as they are.
  const set = (next: string[], details: FontPickerChangeDetails) => setValue([...new Set(next)].slice(0, maxCount), details);
  // A family added goes in front: it's the one you're choosing; the rest become its fallbacks.
  const toggle = (family: string | null, given: ChangeGiven<FontPickerReason>) => {
    if (!family) return;
    if (value.includes(family)) set(value.filter((f) => f !== family), changeDetails(given));
    else if (!full) set([family, ...value], changeDetails(given));
  };
  const stack: FontStackContextValue = {
    value, set, toggle, full, maxCount, label, placeholder, disabled, required, fonts, defaultCategory, onPreview, field, setField, add,
  };
  return (
    <FontStackContext.Provider value={stack}>
      <Popover open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange} presentation={presentation}>
        {children ?? (
          <>
            <FontStackPickerInputGroup />
            <FontStackPickerContent />
          </>
        )}
      </Popover>
      <FormValue name={name ?? fieldContext?.name} form={form} required={required} disabled={disabled} value={value.join(', ')} focus={() => add.current?.focus()} />
    </FontStackContext.Provider>
  );
}

export interface FontStackPickerInputGroupProps extends ComponentProps<'div'>, VariantProps<typeof fontStackPickerInputGroupVariants> {}

/** The stack's field: the chips and the add button in the kit's filled field box (`size` sm / default / lg). It is a
    group named by the stack's `aria-label`, or by its Field's label. */
export function FontStackPickerInputGroup({ className, size, ref, ...props }: FontStackPickerInputGroupProps) {
  const stack = useStack('FontStackPickerInputGroup');
  const { value, label, disabled } = stack;
  const field = useFieldControl({ id: props.id });
  const fieldProps = field?.props({ id: props.id, 'aria-describedby': props['aria-describedby'] }) as Record<string, unknown> | undefined;
  const labelledBy = fieldProps?.['aria-labelledby'] as string | undefined;
  const { setField } = stack;
  const merged = useCallback((node: HTMLDivElement | null) => {
    setField(node);
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  }, [setField, ref]);
  return (
    <div
      data-slot="font-stack-picker"
      role="group"
      data-disabled={disabled || undefined}
      id={fieldProps?.id as string | undefined}
      aria-describedby={fieldProps?.['aria-describedby'] as string | undefined}
      aria-invalid={fieldProps?.['aria-invalid'] as boolean | undefined}
      {...(labelledBy ? { 'aria-labelledby': labelledBy } : { 'aria-label': label })}
      {...props}
      ref={merged}
      className={cn(fontStackPickerInputGroupVariants({ size }), className)}
    >
      {value.length ? (
        <StackChips
          {...(labelledBy ? { 'aria-labelledby': labelledBy } : { 'aria-label': label })}
          value={[...value]}
          disabled={disabled}
          emptyFocus={() => stack.add.current}
          onValueChange={(next, details) => stack.set(next, details)}
          className="flex min-w-0 flex-wrap items-center gap-1.5 outline-none"
        >
          {({ order }) => order.map((family) => (
            <StackChip
              key={family}
              value={family}
              className={cn(
                valueChip,
                'bl-btn relative ps-0.5 data-dragging:z-1 data-dragging:translate-x-(--drag-x) data-dragging:translate-y-(--drag-y) data-dragging:opacity-50 data-grabbed:ring-2 data-grabbed:ring-ring',
              )}
            >
              {/* 24px targets at least (the handle's hit area reaches past its glyph); 44px in a compact container. */}
              <StackChipHandle
                value={family}
                aria-label={`Move ${family}`}
                className="relative grid h-6 w-5 shrink-0 cursor-grab place-items-center rounded-full border-0 bg-transparent p-0 text-muted-foreground outline-none before:absolute before:-inset-x-0.5 before:-inset-y-1 before:content-[''] focus-visible:ring-2 focus-visible:ring-ring in-data-[size-class=compact]:before:-inset-2.5"
              >
                <Icon name="grip-dots" size={12} sw={2.2} />
              </StackChipHandle>
              <FamilyName family={family} className="max-w-32 px-0.5 text-footnote" />
              <StackChipRemove
                value={family}
                aria-label={`Remove ${family}`}
                className="relative grid size-6 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-muted-foreground outline-none before:absolute before:content-[''] hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring in-data-[size-class=compact]:before:-inset-2.5"
              >
                <Icon name="xmark" size={10} sw={2.6} />
              </StackChipRemove>
            </StackChip>
          ))}
        </StackChips>
      ) : null}
      <PopoverTrigger
        ref={stack.add}
        aria-label={value.length ? `Add a font to ${label}` : stack.placeholder}
        aria-required={stack.required || undefined}
        disabled={disabled}
        className={cn(
          'bl-btn flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-lg border-0 bg-transparent px-2 [font-family:inherit] text-footnote text-foreground/70 outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-secondary',
          !value.length && 'flex-1 justify-start',
        )}
      >
        <Icon name="plus" size={12} sw={2.4} />
        {value.length ? null : stack.placeholder}
      </PopoverTrigger>
    </div>
  );
}

export type FontStackPickerContentProps = Omit<ComponentProps<typeof PopoverContent>, 'children' | 'variant'> & {
  /** The popup's content, by default the font list with the stack's marks and a footer saying how many fit. */
  children?: ReactNode;
};

/** The stack's popup: 320px wide, hung from the field (`side`, `align`), holding the list. A family picked goes to the
    front of the stack, or leaves it if it was in it. */
export function FontStackPickerContent({ className, side = 'bottom', align = 'start', anchor, children, ...props }: FontStackPickerContentProps) {
  const stack = useStack('FontStackPickerContent');
  const { value, full, maxCount } = stack;
  return (
    <PopoverContent variant="plain" anchor={anchor ?? stack.field} side={side} align={align} className={cx(fontPopup, className)} {...props}>
      <PopoverTitle className="sr-only">{stack.label}</PopoverTitle>
      {children ?? (
        <FontListCore
          fonts={stack.fonts}
          allowSystem={false}
          systemLabel="System"
          defaultCategory={stack.defaultCategory}
          current={value[0] ?? null}
          autoFocus
          mark={(f) => {
            const at = f ? value.indexOf(f) : -1;
            return at < 0 ? null : <Badge size="sm">{at + 1}</Badge>;
          }}
          isRowDisabled={(f) => full && !!f && !value.includes(f)}
          onPick={stack.toggle}
          onActive={(f) => stack.onPreview?.(f == null ? undefined : [f, ...value.filter((x) => x !== f)])}
          footer={(
            <p className="m-0 border-t border-border px-3 py-2 text-caption text-foreground/70">
              {full ? `${maxCount} of ${maxCount}: remove one to add another.` : `Up to ${maxCount}: the first that loads is used.`}
            </p>
          )}
        />
      )}
    </PopoverContent>
  );
}
