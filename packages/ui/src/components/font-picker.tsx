'use client';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import {
  Command, CommandEmpty, CommandInput, CommandItem, CommandList, createCommandController,
  type CommandValueChangeReason,
} from '@ui-sdk/react/command';
import { createParts } from '@ui-sdk/react/primitive';
import { Toggle, ToggleGroup } from '@ui-sdk/react/toggle';
import type { ChangeDetails } from '@ui-sdk/core';
import { cva, type VariantProps } from 'class-variance-authority';
import { listboxItemVariants } from '@/components/ui/list-box';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger, createPopoverController } from '@/components/ui/popover';
import { changeDetails, type ChangeGiven } from '@/lib/change-details';
import { fontStackList, type FontStackReason } from '@/lib/font-stack-primitive';
import {
  FONT_CATEGORIES, GOOGLE_FONTS, fontStack, useGoogleFontStatus, type FontCategory, type GoogleFont, type GoogleFontStatus,
} from '@/lib/google-fonts';
import { Icon } from '@/lib/icon';
import { useVirtualRows } from '@/lib/use-virtual-rows';
import { cn, cx } from '@/lib/utils';

/* ══ FontPicker — Google Fonts family pickers. The list is the most popular families (lib/google-fonts), searchable
   and filtered by category, each drawn in itself (only the glyphs of its name are fetched, and only for the rows on
   screen). Hovering a family or arrowing to it previews it: `onPreview` hands you what to show for now and
   `undefined` when the preview ends, so the text it's for wears each font as you go down the list, the way
   Photoshop's font menu does. A family typed into the search that the list doesn't have can be used anyway: anything
   on Google Fonts loads.
   - FontPicker: one family (null: the system font), behind a trigger that shows it in its own face.
   - FontStackPicker: a font stack (the first family that loads wins, the rest are its fallbacks), as chips you drag
     by their handle (or move with Space and the arrows) to reorder, or remove; a family you add goes in front, and
     the preview puts the hovered one in front of the rest.
   - FontList: the list alone, for a panel or a sheet.
   <FontPicker value={font} onValueChange={setFont} onPreview={setPreview} />
   <p style={{ fontFamily: fontStack(preview === undefined ? font : preview) }}>…</p>
   Built on UI SDK: the list is a Command (the search keeps focus while the arrows move the highlight; Enter or a
   press picks) whose rows are virtualized with `createVirtualizer` (lib/use-virtual-rows), the category filter a
   ToggleGroup, the pickers Popovers, and the stack's chips lib/font-stack-primitive (`createReorder`). ══ */

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

export const fontListItemVariants = cva('h-10 min-h-0 scroll-my-1.5 py-0 hover:bg-accent');

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

const categoryToggle =
  'bl-btn h-7 shrink-0 cursor-pointer rounded-full border-0 bg-transparent px-2.5 [font-family:inherit] text-footnote font-medium whitespace-nowrap text-foreground/70 outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-secondary data-pressed:bg-foreground data-pressed:text-background';

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
    <Command
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
      className={cn('flex min-h-0 flex-col', className)}
    >
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
        <Icon name="search" size={16} sw={2.2} className="shrink-0 text-foreground/70" />
        <CommandInput
          aria-label="Search fonts"
          placeholder="Search fonts"
          autoFocus={autoFocus}
          className="min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 [font-family:inherit] text-subhead text-foreground outline-none select-text placeholder:text-tertiary-foreground [&::-webkit-search-cancel-button]:appearance-none"
        />
      </div>
      <ToggleGroup<string>
        aria-label="Category"
        value={[category]}
        deselectable={false}
        onValueChange={(value) => { if (value[0]) setCategory(value[0] as FontCategory | 'all'); }}
        className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {[{ id: 'all', label: 'All' }, ...FONT_CATEGORIES].map((c) => (
          <Toggle key={c.id} value={c.id} className={categoryToggle}>{c.label}</Toggle>
        ))}
      </ToggleGroup>
      <div
        ref={listRef}
        // A preview by the pointer ends when the pointer leaves; one by the arrow keys stays.
        onPointerLeave={() => { if (activeBy.current === 'item-hover') command.setValue(null); }}
        // The search field's arrow keys move through the fonts; the list is also a tab stop of its own, so the keys
        // can scroll it without a pointer (as Chrome already makes a scroller with nothing focusable in it).
        tabIndex={0}
        className="bl-scroll h-72 overflow-y-auto outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <CommandList className="relative outline-none" style={{ height: virtual.size + 2 * PAD }}>
          {() => virtual.items.map((v) => {
            const row = rows[v.index];
            if (!row) return null;
            return (
              <CommandItem
                key={row.id}
                value={row.id}
                label={row.family ?? systemLabel}
                disabled={disabled(row)}
                index={v.index}
                // The list's padding (PAD) on every side, as in a popup list.
                className={cn(listboxItemVariants({ variant: 'popup' }), fontListItemVariants(), 'absolute inset-x-1.5')}
                style={{ top: PAD + v.start }}
              >
                <FontRow
                  row={row}
                  mark={row.custom ? null : mark(row.family)}
                  systemLabel={systemLabel}
                  lookup={row.custom ? (row.family === typed ? typedStatus : 'loading') : undefined}
                />
              </CommandItem>
            );
          })}
        </CommandList>
        <CommandEmpty className="px-3 py-8 text-center text-footnote text-foreground/70 not-data-empty:hidden">No fonts</CommandEmpty>
      </div>
      {footer}
    </Command>
  );
}

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
    looked up by the list (`lookup`), not by the row. */
function FontRow({ row, mark, systemLabel, lookup }: { row: Row; mark: ReactNode; systemLabel: string; lookup?: GoogleFontStatus }) {
  const own = useGoogleFontStatus(row.custom ? null : row.family, { text: row.family ?? undefined });
  const status = lookup ?? own;
  return (
    <>
      <span className="grid w-[18px] shrink-0 place-items-center text-primary">{mark}</span>
      <span className="flex min-w-0 flex-1 items-baseline gap-2">
        <span
          className={cn('truncate text-body leading-6 transition-opacity duration-200', row.family && status !== 'ready' && 'opacity-45')}
          style={{ fontFamily: status === 'ready' ? fontStack(row.family, row.font?.category) : undefined }}
        >
          {row.custom ? `Use “${row.family}”` : row.family ?? systemLabel}
        </span>
        {mark ? <span className="sr-only">(in use)</span> : null}
      </span>
      <span className="shrink-0 text-caption text-foreground/70">
        {row.custom ? (status === 'missing' ? 'Not on Google Fonts' : status === 'ready' ? 'Google Fonts' : 'Looking…') : row.font ? CATEGORY_LABEL[row.font.category] : row.family ? '' : 'Default'}
      </span>
    </>
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

export const fontPickerTriggerVariants = cva(
  [
    'bl-btn box-border flex w-full cursor-pointer items-center justify-between gap-2 border-0 bg-input px-3 text-left text-foreground outline-none',
    'transition-[background-color,box-shadow] duration-spring-snappy ease-spring-snappy active:bg-secondary-strong',
    'focus-visible:ring-[3px] focus-visible:ring-ring/45 aria-expanded:shadow-[inset_0_0_0_1.5px_var(--primary)]',
    'data-disabled:cursor-default data-disabled:opacity-50',
  ],
  {
    variants: {
      size: {
        sm: 'h-8 rounded-lg text-subhead',
        default: 'h-11 rounded-ctl text-body',
      },
    },
    defaultVariants: { size: 'default' },
  },
);

/** A family's name, drawn in it once it has loaded. */
function FamilyName({ family, systemLabel, className }: { family: string | null; systemLabel?: string; className?: string }) {
  const status = useGoogleFontStatus(family, { text: family ?? undefined });
  return (
    <span className={cn('min-w-0 truncate', className)} style={{ fontFamily: status === 'ready' ? fontStack(family) : undefined }}>
      {family ?? systemLabel}
    </span>
  );
}

type PopoverPlacement = Pick<ComponentProps<typeof PopoverContent>, 'side' | 'align'>;

export interface FontPickerProps extends Omit<FontListProps, 'autoFocus' | 'className'>, VariantProps<typeof fontPickerTriggerVariants>, PopoverPlacement {
  'aria-label'?: string;
  disabled?: boolean;
  className?: string;
  /** More props for the trigger button. */
  triggerProps?: Omit<ComponentProps<typeof PopoverTrigger>, 'children' | 'className' | 'disabled'>;
}

/** A trigger showing the family in its own face, opening the FontList in a popover. */
export function FontPicker({
  value: valueProp, defaultValue = null, onValueChange, onPreview, size, disabled, side = 'bottom', align = 'start', className, triggerProps,
  'aria-label': ariaLabel = 'Font', systemLabel = 'System', ...list
}: FontPickerProps) {
  const [popover] = useState(() => createPopoverController());
  const [value, setValue] = useValue(valueProp, defaultValue, onValueChange);
  return (
    <Popover controller={popover}>
      <PopoverTrigger
        data-font-picker=""
        aria-label={`${ariaLabel}: ${value ?? systemLabel}`}
        disabled={disabled}
        className={cx(fontPickerTriggerVariants({ size }), className)}
        {...triggerProps}
      >
        <FamilyName family={value} systemLabel={systemLabel} className="flex-1" />
        <Icon name="chevron-up-down" size={14} sw={2.2} className="shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent variant="surface" side={side} align={align} className="w-80 overflow-hidden outline-none">
        <PopoverTitle className="sr-only">{ariaLabel}</PopoverTitle>
        <FontList
          {...list}
          value={value}
          systemLabel={systemLabel}
          autoFocus
          onPreview={onPreview}
          // A choice closes the list, unless the consumer canceled it.
          onValueChange={(family, details) => { if (setValue(family, details)) popover.close(); }}
        />
      </PopoverContent>
    </Popover>
  );
}

/* ── A font stack ── */

export const fontStackPickerVariants = cva(
  'flex w-full flex-wrap items-center gap-1.5 rounded-ctl bg-input p-1.5 data-disabled:opacity-50',
  {
    variants: {
      size: {
        sm: 'min-h-8 rounded-lg p-1 text-footnote',
        default: 'min-h-11 text-subhead',
      },
    },
    defaultVariants: { size: 'default' },
  },
);

const { Root: StackChips, Item: StackChip, Handle: StackChipHandle, Remove: StackChipRemove } = createParts(fontStackList, {
  root: 'div', item: 'div', handle: 'button', remove: 'button',
});

export interface FontStackPickerProps extends VariantProps<typeof fontStackPickerVariants>, PopoverPlacement {
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
  'aria-label'?: string;
  disabled?: boolean;
  className?: string;
}

const noFamilies: readonly string[] = [];

/** A font stack as chips (drag one by its handle, or focus the handle, press Space and use the arrow keys, to
    reorder; × or Delete removes it), and a button that opens the list to add or remove families. */
export function FontStackPicker({
  value: valueProp, defaultValue = noFamilies, onValueChange, onPreview, maxCount = 3, fonts = GOOGLE_FONTS, defaultCategory,
  placeholder = 'Add a font', 'aria-label': ariaLabel = 'Font stack', disabled, side = 'bottom', align = 'start', size, className,
}: FontStackPickerProps) {
  const [value, setValue] = useValue<readonly string[]>(valueProp, defaultValue, (next, details) => onValueChange?.([...next], details));
  const [field, setField] = useState<HTMLDivElement | null>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const full = value.length >= maxCount;
  // The chips' own details (UI SDK's, from the primitive) or the list's pick go to the consumer as they are.
  const set = (next: string[], details: FontPickerChangeDetails) => setValue([...new Set(next)].slice(0, maxCount), details);
  // A family added goes in front: it's the one you're choosing; the rest become its fallbacks.
  const toggle = (family: string | null, given: ChangeGiven<FontPickerReason>) => {
    if (!family) return;
    if (value.includes(family)) set(value.filter((f) => f !== family), changeDetails(given));
    else if (!full) set([family, ...value], changeDetails(given));
  };

  return (
    <div ref={setField} data-slot="font-stack-picker" role="group" aria-label={ariaLabel} data-disabled={disabled || undefined} className={cn(fontStackPickerVariants({ size }), className)}>
      {value.length ? (
        <StackChips
          aria-label={ariaLabel}
          value={[...value]}
          disabled={disabled}
          emptyFocus={() => addRef.current}
          onValueChange={(next, details) => set(next, details)}
          className="flex min-w-0 flex-wrap items-center gap-1.5 outline-none"
        >
          {({ order }) => order.map((family) => (
            <StackChip
              key={family}
              value={family}
              className="bl-btn relative flex h-7 max-w-full items-center gap-0.5 rounded-lg bg-card pr-0.5 pl-0.5 text-foreground shadow-hairline outline-none data-dragging:z-1 data-dragging:translate-x-(--drag-x) data-dragging:translate-y-(--drag-y) data-dragging:opacity-50 data-grabbed:ring-2 data-grabbed:ring-ring"
            >
              <StackChipHandle
                value={family}
                aria-label={`Move ${family}`}
                className="grid h-6 w-4 shrink-0 cursor-grab place-items-center rounded border-0 bg-transparent p-0 text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon name="grip-dots" size={12} sw={2.2} />
              </StackChipHandle>
              <FamilyName family={family} className="max-w-32 px-0.5 text-footnote" />
              <StackChipRemove
                value={family}
                aria-label={`Remove ${family}`}
                className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-muted-foreground outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Icon name="xmark" size={10} sw={2.6} />
              </StackChipRemove>
            </StackChip>
          ))}
        </StackChips>
      ) : null}
      <Popover>
        <PopoverTrigger
          ref={addRef}
          aria-label={value.length ? `Add a font to ${ariaLabel}` : placeholder}
          disabled={disabled}
          className={cn(
            'bl-btn flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-lg border-0 bg-transparent px-2 [font-family:inherit] text-footnote text-foreground/70 outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-secondary',
            !value.length && 'flex-1 justify-start',
          )}
        >
          <Icon name="plus" size={12} sw={2.4} />
          {value.length ? null : placeholder}
        </PopoverTrigger>
        <PopoverContent variant="surface" anchor={field} side={side} align={align} className="w-80 overflow-hidden outline-none">
          <PopoverTitle className="sr-only">{ariaLabel}</PopoverTitle>
          <FontListCore
            fonts={fonts}
            allowSystem={false}
            systemLabel="System"
            defaultCategory={defaultCategory}
            current={value[0] ?? null}
            autoFocus
            mark={(f) => {
              const at = f ? value.indexOf(f) : -1;
              return at < 0 ? null : <span className="grid size-[18px] place-items-center rounded-full bg-primary text-caption2 font-semibold text-primary-foreground tabular-nums">{at + 1}</span>;
            }}
            isRowDisabled={(f) => full && !!f && !value.includes(f)}
            onPick={toggle}
            onActive={(f) => onPreview?.(f == null ? undefined : [f, ...value.filter((x) => x !== f)])}
            footer={(
              <p className="m-0 border-t border-border px-3 py-2 text-caption text-foreground/70">
                {full ? `${maxCount} of ${maxCount}: remove one to add another.` : `Up to ${maxCount}: the first that loads is used.`}
              </p>
            )}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
