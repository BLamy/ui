'use client';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Autocomplete,
  Button as AriaButton, type ButtonProps as AriaButtonProps,
  Dialog as AriaDialog,
  DialogTrigger,
  DropIndicator,
  GridList,
  GridListItem,
  Input,
  ListBox as AriaListBox,
  ListBoxItem as AriaListBoxItem,
  ListLayout,
  SearchField as AriaSearchField,
  ToggleButton,
  ToggleButtonGroup,
  Virtualizer,
  composeRenderProps,
  useDragAndDrop,
} from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { listBoxItemVariants } from '@/components/ui/list-box';
import { Popover, type PopoverProps } from '@/components/ui/popover';
import {
  FONT_CATEGORIES, GOOGLE_FONTS, fontStack, useGoogleFontStatus, type FontCategory, type GoogleFont, type GoogleFontStatus,
} from '@/lib/google-fonts';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';

/* ══ FontPicker — Google Fonts family pickers. The list is the most popular families (lib/google-fonts), searchable
   and filtered by category, each drawn in itself (only the glyphs of its name are fetched, and only for the rows on
   screen). Hovering a family or arrowing to it previews it: `onPreview` hands you what to show for now and
   `undefined` when the preview ends, so the text it's for wears each font as you go down the list, the way
   Photoshop's font menu does. A family typed into the search that the list doesn't have can be used anyway: anything
   on Google Fonts loads.
   - FontPicker: one family (null: the system font), behind a trigger that shows it in its own face.
   - FontStackPicker: a font stack (the first family that loads wins, the rest are its fallbacks), as chips you drag
     to reorder or remove; a family you add goes in front, and the preview puts the hovered one in front of the rest.
   - FontList: the list alone, for a panel or a sheet.
   <FontPicker value={font} onChange={setFont} onPreview={setPreview} />
   <p style={{ fontFamily: fontStack(preview === undefined ? font : preview) }}>…</p> ══ */

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

export const fontListItemVariants = cva('h-10 min-h-0 scroll-my-1.5 py-0 data-hovered:bg-accent');

interface ListCoreProps {
  /** A row's mark (a check, a place in the stack), or null when it isn't in use. */
  mark: (family: string | null) => ReactNode;
  onPick: (family: string | null) => void;
  /** The family under the pointer or the arrow keys (null: the system font); undefined when none is. */
  onActive: (family: string | null | undefined) => void;
  /** Rows that can't be picked right now (a full stack). */
  isDisabled?: (family: string | null) => boolean;
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
  mark, onPick, onActive, isDisabled, fonts, allowSystem, systemLabel, defaultCategory = 'all', current, autoFocus, className, footer,
}: ListCoreProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<FontCategory | 'all'>(defaultCategory);
  const [hovered, setHovered] = useState<string | null>(null);
  const [focused, setFocused] = useState<string | null>(null);

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
  // Open on the family in use, as a design tool's font menu does.
  const list = useRef<HTMLDivElement>(null);
  // The arrow keys move through the list from the search field; the list itself also takes focus (Tab), so it can
  // be scrolled from the keyboard on its own.
  useLayoutEffect(() => { if (list.current && !list.current.hasAttribute('tabindex')) list.current.tabIndex = 0; });
  useLayoutEffect(() => {
    const at = current ? rows.findIndex((r) => r.family === current) : -1;
    if (at <= 0) return undefined;
    // After the virtualizer has sized its content (and the popover has placed itself).
    const raf = requestAnimationFrame(() => {
      const el = list.current;
      if (el) el.scrollTop = Math.max(0, PAD + at * ROW - ((el.clientHeight || 288) - ROW) / 2);
    });
    return () => cancelAnimationFrame(raf);
    // Only when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // A family that isn't listed can be chosen once Google Fonts turns out to have it (asked once the typing pauses).
  const typed = useSettled(rows.find((r) => r.custom)?.family ?? null, 450);
  const typedStatus = useGoogleFontStatus(typed, { text: typed ?? undefined });

  // The preview: the family under the pointer, else the one the arrow keys are on; none when neither (or when the
  // row went away with a new search).
  const active = (hovered != null && byId.has(hovered) ? hovered : null) ?? (focused != null && byId.has(focused) ? focused : null);
  const report = useRef(onActive);
  report.current = onActive;
  const activeFamily = active == null ? undefined : byId.get(active)?.family;
  useEffect(() => { report.current(activeFamily); }, [activeFamily]);
  useEffect(() => () => report.current(undefined), []);

  return (
    <div data-slot="font-list" className={cn('flex min-h-0 flex-col', className)}>
      <Autocomplete inputValue={query} onInputChange={setQuery}>
        <AriaSearchField aria-label="Search fonts" autoFocus={autoFocus} className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3">
          <Icon name="search" size={16} sw={2.2} className="shrink-0 text-foreground/70" />
          <Input
            placeholder="Search fonts"
            className="min-w-0 flex-1 appearance-none border-0 bg-transparent p-0 [font-family:inherit] text-subhead text-foreground outline-none select-text placeholder:text-tertiary-foreground [&::-webkit-search-cancel-button]:appearance-none"
          />
        </AriaSearchField>
        <ToggleButtonGroup
          aria-label="Category"
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[category]}
          onSelectionChange={(keys) => { const k = [...keys][0]; if (k != null) setCategory(String(k) as FontCategory | 'all'); }}
          className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-2 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {[{ id: 'all', label: 'All' }, ...FONT_CATEGORIES].map((c) => (
            <ToggleButton
              key={c.id}
              id={c.id}
              className="bl-btn h-7 shrink-0 cursor-pointer rounded-full border-0 bg-transparent px-2.5 [font-family:inherit] text-footnote font-medium whitespace-nowrap text-foreground/70 outline-none data-focus-visible:ring-2 data-focus-visible:ring-ring data-hovered:bg-secondary data-selected:bg-foreground data-selected:text-background"
            >
              {c.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        <Virtualizer layout={ListLayout} layoutOptions={{ rowSize: ROW, padding: PAD }}>
          <AriaListBox<Row>
            ref={list}
            data-slot="font-list-items"
            aria-label="Fonts"
            items={rows}
            // Rows read the marks and what can be picked, which change with the value while the list is open.
            dependencies={[mark, isDisabled, typed, typedStatus]}
            selectionMode="none"
            onAction={(key) => { const row = byId.get(String(key)); if (row) onPick(row.family); }}
            className="bl-scroll h-72 overflow-y-auto outline-none"
            renderEmptyState={() => <div className="px-3 py-8 text-center text-footnote text-foreground/70">No fonts</div>}
          >
            {(row) => (
              <AriaListBoxItem
                id={row.id}
                textValue={row.family ?? systemLabel}
                onHoverStart={() => setHovered(row.id)}
                onHoverEnd={() => setHovered((h) => (h === row.id ? null : h))}
                isDisabled={(row.custom && (row.family !== typed || typedStatus !== 'ready')) || !!isDisabled?.(row.family)}
                className={cn(listBoxItemVariants({ variant: 'popup' }), fontListItemVariants())}
              >
                {({ isFocused }) => (
                  <FontRow
                    row={row}
                    mark={row.custom ? null : mark(row.family)}
                    focused={isFocused}
                    systemLabel={systemLabel}
                    lookup={row.custom ? (row.family === typed ? typedStatus : 'loading') : undefined}
                    onFocus={(on) => setFocused((f) => (on ? row.id : f === row.id ? null : f))}
                  />
                )}
              </AriaListBoxItem>
            )}
          </AriaListBox>
        </Virtualizer>
      </Autocomplete>
      {footer}
    </div>
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
function FontRow({ row, mark, focused, systemLabel, lookup, onFocus }: {
  row: Row; mark: ReactNode; focused: boolean; systemLabel: string; lookup?: GoogleFontStatus; onFocus: (on: boolean) => void;
}) {
  const own = useGoogleFontStatus(row.custom ? null : row.family, { text: row.family ?? undefined });
  const status = lookup ?? own;
  const report = useRef(onFocus);
  report.current = onFocus;
  useEffect(() => {
    report.current(focused);
    return () => { if (focused) report.current(false); };
  }, [focused]);
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

/* ── One family ── */

export interface FontListProps {
  /** The family in use; null for the system font. */
  value: string | null;
  onChange: (family: string | null) => void;
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
export function FontList({ value, onChange, onPreview, fonts = GOOGLE_FONTS, allowSystem = true, systemLabel = 'System', ...rest }: FontListProps) {
  return (
    <FontListCore
      {...rest}
      fonts={fonts}
      allowSystem={allowSystem}
      systemLabel={systemLabel}
      current={value}
      mark={(f) => (f === value ? <Check /> : null)}
      onPick={onChange}
      onActive={(f) => onPreview?.(f)}
    />
  );
}

export const fontPickerTriggerVariants = cva(
  [
    'bl-btn box-border flex w-full cursor-pointer items-center justify-between gap-2 border-0 bg-input px-3 text-left text-foreground outline-none',
    'transition-[background-color,box-shadow] duration-spring-snappy ease-spring-snappy data-pressed:bg-secondary-strong',
    'data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45 aria-expanded:shadow-[inset_0_0_0_1.5px_var(--primary)]',
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

export interface FontPickerProps extends Omit<FontListProps, 'autoFocus' | 'className'>, VariantProps<typeof fontPickerTriggerVariants> {
  'aria-label'?: string;
  isDisabled?: boolean;
  /** Where the list opens. Default below, start-aligned. */
  placement?: PopoverProps['placement'];
  className?: string;
  /** More props for the trigger button. */
  triggerProps?: Omit<AriaButtonProps, 'children' | 'className' | 'isDisabled'>;
}

/** A trigger showing the family in its own face, opening the FontList in a popover. */
export function FontPicker({
  value, onChange, onPreview, size, isDisabled, placement = 'bottom start', className, triggerProps,
  'aria-label': ariaLabel = 'Font', systemLabel = 'System', ...list
}: FontPickerProps) {
  const [open, setOpen] = useState(false);
  return (
    <DialogTrigger isOpen={open} onOpenChange={setOpen}>
      <AriaButton
        data-slot="font-picker"
        aria-label={`${ariaLabel}: ${value ?? systemLabel}`}
        isDisabled={isDisabled}
        className={composeRenderProps(className, (cls) => cn(fontPickerTriggerVariants({ size }), cls))}
        {...triggerProps}
      >
        <FamilyName family={value} systemLabel={systemLabel} className="flex-1" />
        <Icon name="chevron-up-down" size={14} sw={2.2} className="shrink-0 text-muted-foreground" />
      </AriaButton>
      <Popover placement={placement} className="w-80 overflow-hidden">
        <AriaDialog aria-label={ariaLabel} className="outline-none">
          <FontList
            {...list}
            value={value}
            systemLabel={systemLabel}
            autoFocus
            onPreview={onPreview}
            onChange={(family) => { onChange(family); setOpen(false); }}
          />
        </AriaDialog>
      </Popover>
    </DialogTrigger>
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

export interface FontStackPickerProps extends VariantProps<typeof fontStackPickerVariants> {
  /** The families, the one to use first: fontStack(value) is the CSS font-family. */
  value: readonly string[];
  onChange: (families: string[]) => void;
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
  isDisabled?: boolean;
  /** Where the list opens. Default below, start-aligned. */
  placement?: PopoverProps['placement'];
  className?: string;
}

/** A font stack as chips (drag one, or press its handle and use the arrow keys, to reorder; × removes it), and a
    button that opens the list to add or remove families. */
export function FontStackPicker({
  value, onChange, onPreview, maxCount = 3, fonts = GOOGLE_FONTS, defaultCategory, placeholder = 'Add a font',
  'aria-label': ariaLabel = 'Font stack', isDisabled, placement = 'bottom start', size, className,
}: FontStackPickerProps) {
  const [open, setOpen] = useState(false);
  const field = useRef<HTMLDivElement>(null);
  const full = value.length >= maxCount;
  const set = (next: string[]) => onChange([...new Set(next)].slice(0, maxCount));
  // A family added goes in front: it's the one you're choosing; the rest become its fallbacks.
  const toggle = (family: string | null) => {
    if (!family) return;
    if (value.includes(family)) set(value.filter((f) => f !== family));
    else if (!full) set([family, ...value]);
  };
  const { dragAndDropHooks } = useDragAndDrop({
    getItems: (keys) => [...keys].map((k) => ({ 'text/plain': String(k) })),
    onReorder: (e) => {
      const moving = value.filter((f) => e.keys.has(f));
      const rest = value.filter((f) => !e.keys.has(f));
      const at = rest.indexOf(String(e.target.key)) + (e.target.dropPosition === 'after' ? 1 : 0);
      set([...rest.slice(0, at), ...moving, ...rest.slice(at)]);
    },
    renderDropIndicator: (target) => <DropIndicator target={target} className="w-0.5 self-stretch rounded-full bg-primary data-drop-target:bg-primary" />,
    isDisabled,
  });

  return (
    <div ref={field} data-slot="font-stack-picker" role="group" aria-label={ariaLabel} data-disabled={isDisabled || undefined} className={cn(fontStackPickerVariants({ size }), className)}>
      {value.length ? (
        <GridList
          aria-label={ariaLabel}
          layout="grid"
          items={value.map((f) => ({ id: f }))}
          dragAndDropHooks={dragAndDropHooks}
          className="flex min-w-0 flex-wrap items-center gap-1.5 outline-none"
        >
          {(item) => (
            <GridListItem
              id={item.id}
              textValue={item.id}
              className="bl-btn flex h-7 max-w-full items-center gap-0.5 rounded-lg bg-card pr-0.5 pl-0.5 text-foreground shadow-hairline outline-none data-dragging:opacity-50 data-focus-visible:ring-2 data-focus-visible:ring-ring"
            >
              <AriaButton slot="drag" aria-label={`Move ${item.id}`} className="grid h-6 w-4 shrink-0 cursor-grab place-items-center rounded border-0 bg-transparent p-0 text-muted-foreground outline-none data-focus-visible:ring-2 data-focus-visible:ring-ring">
                <Icon name="grip-dots" size={12} sw={2.2} />
              </AriaButton>
              <FamilyName family={item.id} className="max-w-32 px-0.5 text-footnote" />
              <AriaButton
                aria-label={`Remove ${item.id}`}
                isDisabled={isDisabled}
                onPress={() => set(value.filter((f) => f !== item.id))}
                className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-muted-foreground outline-none data-hovered:bg-secondary data-hovered:text-foreground data-focus-visible:ring-2 data-focus-visible:ring-ring"
              >
                <Icon name="xmark" size={10} sw={2.6} />
              </AriaButton>
            </GridListItem>
          )}
        </GridList>
      ) : null}
      <DialogTrigger isOpen={open} onOpenChange={setOpen}>
        <AriaButton
          aria-label={value.length ? `Add a font to ${ariaLabel}` : placeholder}
          isDisabled={isDisabled}
          className={cn(
            'bl-btn flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-lg border-0 bg-transparent px-2 [font-family:inherit] text-footnote text-foreground/70 outline-none data-hovered:bg-secondary data-hovered:text-foreground data-focus-visible:ring-2 data-focus-visible:ring-ring aria-expanded:bg-secondary',
            !value.length && 'flex-1 justify-start',
          )}
        >
          <Icon name="plus" size={12} sw={2.4} />
          {value.length ? null : placeholder}
        </AriaButton>
        <Popover triggerRef={field} placement={placement} className="w-80 overflow-hidden">
          <AriaDialog aria-label={ariaLabel} className="outline-none">
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
              isDisabled={(f) => full && !!f && !value.includes(f)}
              onPick={toggle}
              onActive={(f) => onPreview?.(f == null ? undefined : [f, ...value.filter((x) => x !== f)])}
              footer={(
                <p className="m-0 border-t border-border px-3 py-2 text-caption text-foreground/70">
                  {full ? `${maxCount} of ${maxCount}: remove one to add another.` : `Up to ${maxCount}: the first that loads is used.`}
                </p>
              )}
            />
          </AriaDialog>
        </Popover>
      </DialogTrigger>
    </div>
  );
}
