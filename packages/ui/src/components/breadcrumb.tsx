'use client';
import {
  Children, createContext, isValidElement, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState,
  type ComponentProps, type ReactElement, type ReactNode,
} from 'react';
import {
  Breadcrumb as AriaBreadcrumb,
  Breadcrumbs as AriaBreadcrumbs,
  Button as AriaButton,
  Link as AriaLink,
  type Key,
} from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub,
} from '@/components/ui/dropdown-menu';

/* ══ Breadcrumb — the path to the current page, on react-aria's Breadcrumbs / Breadcrumb / Link ══
   Every item is pressable: give it an `href` (a real link) and/or `onPress`. The last item is the current page
   (`aria-current="page"`); it is plain text unless it has a handler. An item that carries `items` is a picker like
   VS Code's breadcrumb: pressing it opens a menu of its siblings (the `selectedId` one is checked) instead.

   <Breadcrumb items={[
     { id: 'home', label: 'Home', icon: 'house', href: '/' },
     { id: 'ui', label: 'Components', items: [{ id: 'ui', label: 'Components', href: '/ui' }, …], selectedId: 'ui' },
     { id: 'bc', label: 'Breadcrumb' },
   ]} />

   …or composed:

   <Breadcrumb size="sm">
     <BreadcrumbItem href="/" icon="house">Home</BreadcrumbItem>
     <BreadcrumbItem href="/ui">Components</BreadcrumbItem>
     <BreadcrumbItem>Breadcrumb</BreadcrumbItem>
   </Breadcrumb>

   Width-aware: when the items do not fit, the middle collapses into one `…` button that opens a menu of the hidden
   items (the first and the last always stay, and as many trailing items as fit). The widths come from an
   off-screen, inert copy of the full list that is re-measured whenever the content or the container changes
   (`fitBreadcrumbs` is the pure part). The first render, and the server's, is the full list. ══ */

/* ── The fit ── */

export interface BreadcrumbFit {
  /** How many leading items stay. */
  head: number;
  /** How many trailing items stay (0 when nothing is hidden). The hidden ones are `head … length - tail`. */
  tail: number;
}

export interface BreadcrumbFitOptions {
  /** Leading items that always stay. Default 1. */
  keepHead?: number;
  /** Trailing items that always stay. Default 1. */
  keepTail?: number;
}

/** How many items to keep so a trail fits `available` px. `widths` are each item's own width; `separatorWidth` is
 *  what sits between two neighbours (separator and its spacing); `ellipsisWidth` is the `…` item's own width.
 *  When everything fits (or there is nothing to hide, or no width is known: `available <= 0`) the result is
 *  `{ head: widths.length, tail: 0 }`. Otherwise the middle collapses into the ellipsis: the head stays and
 *  the most trailing items that fit stay — at least `keepTail`, even when that overflows. */
export function fitBreadcrumbs(
  widths: readonly number[],
  available: number,
  separatorWidth = 0,
  ellipsisWidth = 0,
  { keepHead = 1, keepTail = 1 }: BreadcrumbFitOptions = {},
): BreadcrumbFit {
  const n = widths.length;
  const all: BreadcrumbFit = { head: n, tail: 0 };
  const head = Math.max(0, Math.min(keepHead, n));
  const minTail = Math.max(0, keepTail);
  if (available <= 0 || n - head <= minTail) return all;
  const sum = (from: number, to: number) => {
    let w = 0;
    for (let i = from; i < to; i++) w += widths[i];
    return w;
  };
  if (sum(0, n) + (n - 1) * separatorWidth <= available) return all;
  // Trail = head items, the ellipsis, `tail` items: (head + 1 + tail) entries and as many gaps, less one.
  const widthWith = (tail: number) => sum(0, head) + ellipsisWidth + sum(n - tail, n) + (head + tail) * separatorWidth;
  for (let tail = n - head - 1; tail > minTail; tail--) if (widthWith(tail) <= available) return { head, tail };
  return { head, tail: minTail };
}

/* ── Variants ── */

export const breadcrumbVariants = cva('relative block w-full min-w-0 overflow-clip whitespace-nowrap text-foreground [overflow-clip-margin:4px]', {
  variants: {
    size: {
      sm: 'text-caption',
      default: 'text-footnote',
      lg: 'text-subhead',
    },
  },
  defaultVariants: { size: 'default' },
});

/** The pressable face of an item (a link, a sibling picker, the `…` button). Width must not depend on the item
 *  being the current one — the measuring copy does not know — so the current page differs by colour only. */
export const breadcrumbItemVariants = cva(
  [
    'bl-btn box-border inline-flex max-w-full min-w-0 items-center rounded-md border-0 bg-transparent text-foreground/70 no-underline [font-family:inherit] whitespace-nowrap outline-none transition-colors motion-reduce:transition-none',
    'data-current:text-foreground',
    'data-focus-visible:ring-2 data-focus-visible:ring-ring',
  ],
  {
    variants: {
      size: {
        sm: 'h-5 gap-1 px-1',
        default: 'h-6 gap-1.5 px-1.5',
        lg: 'h-7 gap-1.5 px-2',
      },
      /** Pressable faces highlight on hover and press; the current page and plain text do not. */
      interactive: {
        true: 'cursor-pointer data-hovered:bg-secondary data-hovered:text-foreground data-pressed:bg-secondary-strong aria-expanded:bg-secondary aria-expanded:text-foreground data-disabled:cursor-default',
        false: 'cursor-default',
      },
    },
    defaultVariants: { size: 'default', interactive: true },
  },
);

const ICON_SIZE = { sm: 13, default: 14, lg: 16 } as const;
const SEPARATOR_SIZE = { sm: 12, default: 13, lg: 15 } as const;

/* ── Types ── */

/** A sibling, or an entry of the `…` menu. */
export interface BreadcrumbEntry {
  id: Key;
  label: ReactNode;
  /** The plain-text label, for the menu's type-to-select when `label` is not a string. */
  textValue?: string;
  /** An icon name (`'house'`) or a node. */
  icon?: ReactNode;
  href?: string;
  onPress?: () => void;
}

/** One item of the data-driven form: an entry that may carry its siblings. */
export interface BreadcrumbItemData extends BreadcrumbEntry {
  /** The entries of this item's parent. When given, pressing the item opens them as a menu (the item's own
   *  `href` / `onPress` are not used). */
  items?: BreadcrumbEntry[];
  /** The `items` entry that is the current one; it is checked in the menu. */
  selectedId?: Key;
}

type SizeVariant = NonNullable<VariantProps<typeof breadcrumbVariants>['size']>;

interface BreadcrumbContextValue {
  size: SizeVariant;
  separator?: ReactNode;
}
const BreadcrumbContext = createContext<BreadcrumbContextValue>({ size: 'default' });
/** True inside the off-screen copy the root measures: items render as plain, inert boxes. */
const MeasureContext = createContext(false);

const renderIcon = (icon: ReactNode, size: number) => (typeof icon === 'string' ? <Icon name={icon} size={size} /> : icon);

/* ── Separator ── */

export function BreadcrumbSeparator({ className, children, ...props }: ComponentProps<'span'>) {
  const { size } = useContext(BreadcrumbContext);
  return (
    <span
      data-slot="breadcrumb-separator"
      aria-hidden
      className={cn('grid shrink-0 place-items-center px-0.5 text-tertiary-foreground', className)}
      {...props}
    >
      {children ?? <Icon name="chevron-right" size={SEPARATOR_SIZE[size]} sw={2.2} />}
    </span>
  );
}

/** The separator after an item: the root's `separator` (`null` for none) inside `BreadcrumbSeparator`. */
function TrailingSeparator() {
  const { separator } = useContext(BreadcrumbContext);
  return separator === null ? null : <BreadcrumbSeparator>{separator}</BreadcrumbSeparator>;
}

/* ── Menus ── */

const MENU_ITEM = 'min-h-9 py-1.5 text-subhead leading-5';

function MenuEntry({ entry }: { entry: BreadcrumbItemData }) {
  const common = {
    id: entry.id,
    textValue: entry.textValue ?? (typeof entry.label === 'string' ? entry.label : undefined),
    icon: entry.icon ? renderIcon(entry.icon, 18) : undefined,
    className: MENU_ITEM,
  };
  // An entry that has siblings of its own (a hidden item that is a picker) opens them as a submenu.
  if (entry.items?.length) {
    return (
      <DropdownMenuSub>
        <DropdownMenuItem {...common}>{entry.label}</DropdownMenuItem>
        <BreadcrumbMenu entries={entry.items} selectedId={entry.selectedId} />
      </DropdownMenuSub>
    );
  }
  return <DropdownMenuItem {...common} href={entry.href} onAction={entry.onPress}>{entry.label}</DropdownMenuItem>;
}

function BreadcrumbMenu({ entries, selectedId }: { entries: readonly BreadcrumbItemData[]; selectedId?: Key }) {
  const picker = selectedId != null;
  return (
    <DropdownMenuContent
      placement="bottom start"
      offset={4}
      popoverClassName="min-w-44"
      selectionMode={picker ? 'single' : 'none'}
      selectedKeys={picker ? [selectedId] : undefined}
      disallowEmptySelection={picker}
    >
      {entries.map((entry) => <MenuEntry key={entry.id} entry={entry} />)}
    </DropdownMenuContent>
  );
}

/* ── Item ── */

export interface BreadcrumbItemProps extends Omit<BreadcrumbItemData, 'id' | 'label'> {
  id?: Key;
  /** The label — the children, or this (so a `BreadcrumbItemData` spreads straight in). */
  label?: ReactNode;
  children?: ReactNode;
  /** Merged onto the item's `<li>`. */
  className?: string;
}

function ItemFace({ icon, children }: { icon?: ReactNode; children?: ReactNode }) {
  const { size } = useContext(BreadcrumbContext);
  return (
    <>
      {icon ? <span className="grid shrink-0 place-items-center">{renderIcon(icon, ICON_SIZE[size])}</span> : null}
      {children != null && children !== false ? <span className="min-w-0 truncate">{children}</span> : null}
    </>
  );
}

const itemClass = (isCurrent: boolean, className?: string) => cn('flex min-w-0 items-center', isCurrent ? 'shrink' : 'shrink-0', className);

function BreadcrumbItemContent({ isCurrent, icon, href, onPress, items, selectedId, children }: BreadcrumbItemProps & { isCurrent: boolean }) {
  const { size } = useContext(BreadcrumbContext);
  const face = <ItemFace icon={icon}>{children}</ItemFace>;
  const actionable = !!(href || onPress);
  let control: ReactNode;
  if (items?.length) {
    control = (
      <DropdownMenu>
        <AriaButton
          data-slot="breadcrumb-link"
          data-current={isCurrent || undefined}
          aria-current={isCurrent ? 'page' : undefined}
          className={breadcrumbItemVariants({ size })}
        >
          {face}
        </AriaButton>
        <BreadcrumbMenu entries={items} selectedId={selectedId} />
      </DropdownMenu>
    );
  } else if (actionable || isCurrent) {
    // react-aria disables the current item's link; a handler or href opts it back in.
    control = (
      <AriaLink
        data-slot="breadcrumb-link"
        href={href}
        onPress={onPress}
        {...(actionable ? { isDisabled: false } : null)}
        className={breadcrumbItemVariants({ size, interactive: actionable })}
      >
        {face}
      </AriaLink>
    );
  } else {
    control = <span data-slot="breadcrumb-link" className={breadcrumbItemVariants({ size, interactive: false })}>{face}</span>;
  }
  return <>{control}{isCurrent ? null : <TrailingSeparator />}</>;
}

/** An item inside the measuring copy: the same box and spacing, none of the behavior. */
function MeasuredItem({ icon, className, children }: Pick<BreadcrumbItemProps, 'icon' | 'className' | 'children'>) {
  const { size } = useContext(BreadcrumbContext);
  return (
    <li className={itemClass(false, className)}>
      <span className={breadcrumbItemVariants({ size, interactive: false })}>
        <ItemFace icon={icon}>{children}</ItemFace>
      </span>
      <TrailingSeparator />
    </li>
  );
}

export function BreadcrumbItem({ id, label, children, className, ...props }: BreadcrumbItemProps) {
  const measuring = useContext(MeasureContext);
  const content = children ?? label;
  if (measuring) return <MeasuredItem icon={props.icon} className={className}>{content}</MeasuredItem>;
  return (
    <AriaBreadcrumb
      id={id}
      data-slot="breadcrumb-item"
      className={({ isCurrent }) => itemClass(isCurrent, className)}
    >
      {({ isCurrent }) => <BreadcrumbItemContent {...props} isCurrent={isCurrent}>{content}</BreadcrumbItemContent>}
    </AriaBreadcrumb>
  );
}

/* ── Ellipsis ── */

export interface BreadcrumbEllipsisProps {
  /** The hidden items, in order; each fires its own `href` / `onPress` (one with its own `items` opens them as a submenu). */
  items: readonly BreadcrumbItemData[];
  /** The button's accessible name. Default "More". */
  label?: string;
  className?: string;
}

/** The `…` item: a button that opens a menu of the items the trail had no room for. The root renders it when it
 *  collapses; use it yourself for a trail you shorten by hand. */
export function BreadcrumbEllipsis({ items, label = 'More', className }: BreadcrumbEllipsisProps) {
  const measuring = useContext(MeasureContext);
  const { size } = useContext(BreadcrumbContext);
  const face = <span className="grid shrink-0 place-items-center"><Icon name="ellipsis" size={ICON_SIZE[size] + 2} /></span>;
  if (measuring) {
    return (
      <li data-ellipsis="" className={itemClass(false, className)}>
        <span className={breadcrumbItemVariants({ size, interactive: false })}>{face}</span>
        <TrailingSeparator />
      </li>
    );
  }
  return (
    <AriaBreadcrumb data-slot="breadcrumb-ellipsis" className={({ isCurrent }) => itemClass(isCurrent, className)}>
      {({ isCurrent }) => (
        <>
          <DropdownMenu>
            <AriaButton data-slot="breadcrumb-link" aria-label={label} className={breadcrumbItemVariants({ size })}>
              {face}
            </AriaButton>
            <BreadcrumbMenu entries={items} />
          </DropdownMenu>
          {isCurrent ? null : <TrailingSeparator />}
        </>
      )}
    </AriaBreadcrumb>
  );
}

/* ── Root ── */

interface Metrics {
  /** Each item's own width (without its separator). */
  widths: number[];
  separator: number;
  ellipsis: number;
  available: number;
}
const sameMetrics = (a: Metrics | null, b: Metrics) =>
  !!a && a.available === b.available && a.separator === b.separator && a.ellipsis === b.ellipsis
  && a.widths.length === b.widths.length && a.widths.every((w, i) => w === b.widths[i]);

/** An element's inner width: what its children can fill. */
function contentWidth(el: HTMLElement) {
  const cs = getComputedStyle(el);
  return el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
}

type ItemElement = ReactElement<BreadcrumbItemProps>;

const entryOf = (el: ItemElement): BreadcrumbItemData => {
  const { id, label, children, icon, href, onPress, items, selectedId } = el.props;
  return { id: id ?? el.key ?? '', label: children ?? label, icon, href, onPress, items, selectedId };
};

export interface BreadcrumbProps extends Omit<ComponentProps<'nav'>, 'children'>, VariantProps<typeof breadcrumbVariants> {
  /** The data-driven form: one item per entry (instead of `children`). */
  items?: readonly BreadcrumbItemData[];
  /** Composed form: `BreadcrumbItem`s. */
  children?: ReactNode;
  /** Replaces the chevron between items (`null` for none). Rendered inside `BreadcrumbSeparator`. */
  separator?: ReactNode;
  /** Collapse the middle into a `…` menu when the items do not fit. Default true. */
  collapse?: boolean;
  /** The `…` button's accessible name. Default "More". */
  ellipsisLabel?: string;
  /** Leading items that never collapse. Default 1. */
  keepHead?: number;
  /** Trailing items that never collapse. Default 1. */
  keepTail?: number;
}

export function Breadcrumb({
  items, children, size, separator, collapse = true, ellipsisLabel, keepHead, keepTail,
  className, 'aria-label': ariaLabel = 'Breadcrumb', ...props
}: BreadcrumbProps) {
  const sizeKey: SizeVariant = size ?? 'default';
  const nodes = useMemo<ItemElement[]>(
    () => (items
      ? items.map((item) => <BreadcrumbItem key={item.id} {...item} />)
      : (Children.toArray(children).filter(isValidElement) as ItemElement[])),
    [items, children],
  );

  const rootRef = useRef<HTMLElement>(null);
  const measureRef = useRef<HTMLOListElement>(null);
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  // Reads layout only; state changes only when a number did, so a re-render can never feed back into a re-measure.
  const measure = useCallback(() => {
    const root = rootRef.current;
    const copy = measureRef.current;
    if (!root || !copy) return;
    const rows = Array.from(copy.children) as HTMLElement[];
    const separator = copy.querySelector<HTMLElement>('[data-slot=breadcrumb-separator]')?.offsetWidth ?? 0;
    const own = rows.map((row) => Math.max(0, row.offsetWidth - separator));
    const next: Metrics = { widths: own.slice(0, -1), separator, ellipsis: own[own.length - 1] ?? 0, available: contentWidth(root) };
    setMetrics((prev) => (sameMetrics(prev, next) ? prev : next));
  }, []);

  // After every render (the items may have changed), and whenever the container or the measured copy resizes.
  useLayoutEffect(() => { if (collapse) measure(); });
  useLayoutEffect(() => {
    if (!collapse) return;
    let live = true;
    const run = () => { if (live) measure(); };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(run);
    if (observer) {
      if (rootRef.current) observer.observe(rootRef.current);
      if (measureRef.current) observer.observe(measureRef.current);
    }
    // Web fonts change every width.
    void document.fonts?.ready.then(run);
    return () => { live = false; observer?.disconnect(); };
  }, [collapse, measure]);

  const fit = collapse && metrics && metrics.widths.length === nodes.length
    ? fitBreadcrumbs(metrics.widths, metrics.available, metrics.separator, metrics.ellipsis, { keepHead, keepTail })
    : null;
  const hiddenCount = fit ? nodes.length - fit.head - fit.tail : 0;
  const visible = fit && hiddenCount > 0
    ? [
      ...nodes.slice(0, fit.head),
      <BreadcrumbEllipsis key="breadcrumb-ellipsis" label={ellipsisLabel} items={nodes.slice(fit.head, nodes.length - fit.tail).map(entryOf)} />,
      ...nodes.slice(nodes.length - fit.tail),
    ]
    : nodes;

  const context = useMemo<BreadcrumbContextValue>(() => ({ size: sizeKey, separator }), [sizeKey, separator]);
  return (
    <BreadcrumbContext.Provider value={context}>
      <nav
        ref={rootRef}
        data-slot="breadcrumb"
        aria-label={ariaLabel}
        className={cn(breadcrumbVariants({ size }), className)}
        {...props}
      >
        <AriaBreadcrumbs data-slot="breadcrumb-list" className="m-0 flex min-w-0 list-none items-center p-0">
          {visible}
        </AriaBreadcrumbs>
        {collapse ? (
          <div
            data-slot="breadcrumb-measure"
            aria-hidden
            inert
            className="pointer-events-none invisible absolute top-0 left-0 size-0 overflow-hidden"
          >
            <MeasureContext.Provider value>
              <ol ref={measureRef} className="m-0 flex w-max list-none p-0">
                {nodes}
                <BreadcrumbEllipsis items={[]} />
              </ol>
            </MeasureContext.Provider>
          </div>
        ) : null}
      </nav>
    </BreadcrumbContext.Provider>
  );
}
