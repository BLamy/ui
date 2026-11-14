'use client';
import {
  Children, createContext, isValidElement, useContext, useMemo,
  type ComponentProps, type ReactElement, type ReactNode,
} from 'react';
import { Button } from '@ui-sdk/react/button';
import { createParts } from '@ui-sdk/react/primitive';
import { cva, type VariantProps } from 'class-variance-authority';
import { Icon } from '@/lib/icon';
import { breadcrumb, type BreadcrumbTrailItem } from '@/lib/breadcrumb-primitive';
import { cn, cx } from '@/lib/utils';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSub,
  DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/* ══ Breadcrumb — the path to the current page: a `nav` with an ordered list of links ══
   Every item is pressable: give it an `href` (a link) and/or `onClick` (a button, when it has no `href`). The last
   item is the current page (`aria-current="page"`); it is plain text unless it has a handler. An item that carries
   `items` is a picker like VS Code's breadcrumb: pressing it opens a menu of its siblings (the `selectedId` one is
   checked) instead. The menus are DropdownMenus.

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
   items (the first and the last always stay, and as many trailing items as fit). The measuring and the fit are
   `lib/breadcrumb-primitive.ts`, which reads an off-screen, inert copy of the full list whenever the content or
   the container changes (`fitBreadcrumbs` is the pure part); this file only renders. The first render, and the
   server's, is the full list. ══ */

export { fitBreadcrumbs, type BreadcrumbFit, type BreadcrumbFitOptions } from '@/lib/breadcrumb-primitive';

const parts = createParts(breadcrumb, {
  root: 'nav',
  list: 'ol',
  item: 'li',
  ellipsis: 'li',
  measure: 'div',
});

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
    'bl-btn box-border inline-flex max-w-full min-w-0 items-center rounded-md border-0 bg-transparent py-0 text-foreground/70 no-underline [font:inherit] whitespace-nowrap outline-none transition-colors motion-reduce:transition-none',
    'aria-[current=page]:text-foreground',
    'focus-visible:ring-2 focus-visible:ring-ring',
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
        true: 'cursor-pointer hover:bg-secondary hover:text-foreground active:bg-secondary-strong aria-expanded:bg-secondary aria-expanded:text-foreground data-disabled:cursor-default',
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
  id: string | number;
  /** The plain-text name: what shows, unless `children` gives richer content, and what the menu's type-to-select
   *  and an agent read. */
  label: string;
  /** Content to show instead of `label`. */
  children?: ReactNode;
  /** An icon name (`'house'`) or a node. */
  icon?: ReactNode;
  /** Makes the item a link. */
  href?: string;
  /** Runs when the item is pressed, or chosen in a menu. Without an `href` the item is a button. */
  onClick?: () => void;
}

/** One item of the data-driven form: an entry that may carry its siblings. */
export interface BreadcrumbItemData extends BreadcrumbEntry {
  /** The entries of this item's parent. When given, pressing the item opens them as a menu (the item's own
   *  `href` / `onClick` are not used). */
  items?: BreadcrumbEntry[];
  /** The `items` entry that is the current one; it is checked in the menu. */
  selectedId?: string | number;
}

type SizeVariant = NonNullable<VariantProps<typeof breadcrumbVariants>['size']>;

interface BreadcrumbContextValue {
  size: SizeVariant;
  separator?: ReactNode;
}
const BreadcrumbContext = createContext<BreadcrumbContextValue>({ size: 'default' });
/** The item the root is rendering: its key, and whether it is the last one, the current page. */
const ItemContext = createContext<{ value: string; current: boolean }>({ value: '', current: false });
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

function MenuEntry({ entry, picker }: { entry: BreadcrumbItemData; picker: boolean }) {
  const { label } = entry;
  const content = entry.children ?? label;
  const icon = entry.icon ? renderIcon(entry.icon, 18) : undefined;
  // An entry that has siblings of its own (a hidden item that is a picker) opens them as a submenu.
  if (entry.items?.length) {
    return (
      <DropdownMenuSub>
        <DropdownMenuSubTrigger className={MENU_ITEM}>{content}</DropdownMenuSubTrigger>
        <BreadcrumbMenu sub entries={entry.items} selectedId={entry.selectedId} />
      </DropdownMenuSub>
    );
  }
  const link = entry.href ? <a href={entry.href} /> : undefined;
  // In a picker the rows are radio items, so the current sibling reads as checked; its group fires the chosen entry.
  return picker ? (
    <DropdownMenuRadioItem value={String(entry.id)} label={label} icon={icon} closeOnSelect render={link} className={MENU_ITEM}>
      {content}
    </DropdownMenuRadioItem>
  ) : (
    <DropdownMenuItem label={label} icon={icon} render={link} onSelect={entry.onClick} className={MENU_ITEM}>
      {content}
    </DropdownMenuItem>
  );
}

function BreadcrumbMenu({ entries, selectedId, sub }: { entries: readonly BreadcrumbItemData[]; selectedId?: string | number; sub?: boolean }) {
  const picker = selectedId != null;
  const rows = entries.map((entry) => <MenuEntry key={entry.id} entry={entry} picker={picker} />);
  const Content = sub ? DropdownMenuSubContent : DropdownMenuContent;
  return (
    <Content sideOffset={sub ? undefined : 4} className="min-w-44">
      {picker ? (
        <DropdownMenuRadioGroup
          value={String(selectedId)}
          onValueChange={(value) => entries.find((entry) => String(entry.id) === value)?.onClick?.()}
        >
          {rows}
        </DropdownMenuRadioGroup>
      ) : rows}
    </Content>
  );
}

/* ── Item ── */

export interface BreadcrumbItemProps extends Omit<BreadcrumbItemData, 'id' | 'label'> {
  id?: string | number;
  /** The plain-text name (so a `BreadcrumbItemData` spreads straight in). Shown when there are no children; given
   *  children that are not a string, it is what the trail's menus and an agent read. */
  label?: string;
  /** What shows. Default `label`. */
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

function BreadcrumbItemContent({ isCurrent, icon, href, onClick, items, selectedId, children }: BreadcrumbItemProps & { isCurrent: boolean }) {
  const { size } = useContext(BreadcrumbContext);
  const face = <ItemFace icon={icon}>{children}</ItemFace>;
  const current = isCurrent ? 'page' as const : undefined;
  let control: ReactNode;
  if (items?.length) {
    control = (
      <DropdownMenu>
        <DropdownMenuTrigger aria-current={current} className={breadcrumbItemVariants({ size })}>{face}</DropdownMenuTrigger>
        <BreadcrumbMenu entries={items} selectedId={selectedId} />
      </DropdownMenu>
    );
  } else if (href) {
    control = <a data-slot="breadcrumb-link" href={href} onClick={onClick} aria-current={current} className={breadcrumbItemVariants({ size })}>{face}</a>;
  } else if (onClick) {
    control = <Button onClick={onClick} aria-current={current} className={breadcrumbItemVariants({ size })}>{face}</Button>;
  } else {
    // Plain text: the current page, or an item with nothing to do.
    control = <span data-slot="breadcrumb-link" aria-current={current} className={breadcrumbItemVariants({ size, interactive: false })}>{face}</span>;
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

export function BreadcrumbItem({ label, children, className, ...props }: BreadcrumbItemProps) {
  const measuring = useContext(MeasureContext);
  const { value, current } = useContext(ItemContext);
  const content = children ?? label;
  if (measuring) return <MeasuredItem icon={props.icon} className={className}>{content}</MeasuredItem>;
  return (
    <parts.Item value={value} current={current} className={itemClass(current, className)}>
      <BreadcrumbItemContent {...props} isCurrent={current}>{content}</BreadcrumbItemContent>
    </parts.Item>
  );
}

/* ── Ellipsis ── */

export interface BreadcrumbEllipsisProps {
  /** The hidden items, in order; each fires its own `href` / `onClick` (one with its own `items` opens them as a submenu). */
  items: readonly BreadcrumbItemData[];
  /** The button's accessible name. Default "More". */
  label?: string;
  className?: string;
}

/** The `…` item: a button that opens a menu of the items the trail had no room for. The root renders it when it
 *  collapses; use it yourself for a trail you shorten by hand. */
export function BreadcrumbEllipsis({ items, label = 'More', className }: BreadcrumbEllipsisProps) {
  const measuring = useContext(MeasureContext);
  const { current: isCurrent } = useContext(ItemContext);
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
    <parts.Ellipsis className={itemClass(isCurrent, className)}>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={label} className={breadcrumbItemVariants({ size })}>{face}</DropdownMenuTrigger>
        <BreadcrumbMenu entries={items} />
      </DropdownMenu>
      {isCurrent ? null : <TrailingSeparator />}
    </parts.Ellipsis>
  );
}

/* ── Root ── */

type ItemElement = ReactElement<BreadcrumbItemProps>;

const entryOf = (el: ItemElement): BreadcrumbItemData => {
  const { id, label, children, icon, href, onClick, items, selectedId } = el.props;
  return { id: id ?? el.key ?? '', label: label ?? (typeof children === 'string' ? children : ''), children, icon, href, onClick, items, selectedId };
};

/** The key an item goes by: its `id`, else the key React gave it. */
const valueOf = (el: ItemElement) => String(el.props.id ?? el.key ?? '');

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
  /** Trailing items that never collapse: at least 1 (the current page), default 1. */
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
  const trail = useMemo<BreadcrumbTrailItem[]>(
    () => nodes.map((node) => ({ value: valueOf(node), label: entryOf(node).label })),
    [nodes],
  );

  const context = useMemo<BreadcrumbContextValue>(() => ({ size: sizeKey, separator }), [sizeKey, separator]);
  return (
    <BreadcrumbContext.Provider value={context}>
      <parts.Root
        items={trail}
        collapse={collapse}
        keepHead={keepHead}
        keepTail={keepTail}
        aria-label={ariaLabel}
        className={cx(breadcrumbVariants({ size }), className)}
        {...props}
      >
        {({ head, tail, count }) => {
          const shown = tail > 0 && count === nodes.length && count - head - tail > 0
            ? [
              ...nodes.slice(0, head),
              <BreadcrumbEllipsis key="breadcrumb-ellipsis" label={ellipsisLabel} items={nodes.slice(head, count - tail).map(entryOf)} />,
              ...nodes.slice(count - tail),
            ]
            : nodes;
          return (
            <>
              <parts.List className="m-0 flex min-w-0 list-none items-center p-0">
                {shown.map((node, index) => (
                  <ItemContext.Provider key={node.key} value={{ value: valueOf(node), current: index === shown.length - 1 }}>
                    {node}
                  </ItemContext.Provider>
                ))}
              </parts.List>
              {collapse ? (
                <parts.Measure className="pointer-events-none invisible absolute top-0 left-0 size-0 overflow-hidden">
                  <MeasureContext.Provider value>
                    <ol className="m-0 flex w-max list-none p-0">
                      {nodes}
                      <BreadcrumbEllipsis items={[]} />
                    </ol>
                  </MeasureContext.Provider>
                </parts.Measure>
              ) : null}
            </>
          );
        }}
      </parts.Root>
    </BreadcrumbContext.Provider>
  );
}
