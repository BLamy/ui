'use client';
import { createContext, useContext, type ComponentProps, type ReactNode } from 'react';
import {
  Collection,
  Header,
  ListBox as AriaListBox, type ListBoxProps as AriaListBoxProps,
  ListBoxItem as AriaListBoxItem, type ListBoxItemProps as AriaListBoxItemProps,
  ListBoxSection as AriaListBoxSection, type ListBoxSectionProps as AriaListBoxSectionProps,
  composeRenderProps,
} from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';

/* ══ ListBox — react-aria's ListBox: arrow-key navigation, typeahead, single/multiple selection.
   `inset` is an iOS inset-grouped list with trailing checkmarks; `popup` is the compact list used inside
   Select / ComboBox popovers (leading checkmarks, rounded highlight). ══ */
export const listBoxVariants = cva('outline-none', {
  variants: {
    variant: {
      inset: 'overflow-hidden rounded-panel bg-card data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45',
      popup: 'bl-scroll box-border max-h-[min(320px,var(--visual-viewport-height,320px))] overflow-y-auto p-1.5',
    },
  },
  defaultVariants: { variant: 'inset' },
});

export const listBoxItemVariants = cva(
  'bl-btn group/item relative box-border flex cursor-pointer items-center gap-2.5 text-foreground outline-none data-disabled:cursor-default data-disabled:opacity-40',
  {
    variants: {
      variant: {
        inset: [
          'min-h-11 px-4 py-[11px] text-body leading-[22px]',
          'after:pointer-events-none after:absolute after:right-0 after:bottom-0 after:left-4 after:h-px after:bg-border last:after:hidden',
          'data-hovered:bg-accent data-pressed:bg-accent data-focus-visible:bg-accent',
        ],
        popup: [
          'min-h-9 rounded-lg py-[7px] pr-3 pl-2 text-subhead leading-5',
          'data-focused:bg-accent data-pressed:bg-secondary-strong',
        ],
      },
    },
    defaultVariants: { variant: 'inset' },
  },
);

type ListBoxVariant = NonNullable<VariantProps<typeof listBoxVariants>['variant']>;
/** Items follow their list's variant. */
const ListBoxVariantCtx = createContext<ListBoxVariant>('inset');

export interface ListBoxProps<T> extends AriaListBoxProps<T>, VariantProps<typeof listBoxVariants> {}

export function ListBox<T extends object>({ className, variant = 'inset', ...props }: ListBoxProps<T>) {
  const v = variant ?? 'inset';
  return (
    <ListBoxVariantCtx.Provider value={v}>
      <AriaListBox
        data-slot="list-box"
        data-variant={v}
        className={composeRenderProps(className, (cls) => cn(listBoxVariants({ variant: v }), cls))}
        {...props}
      />
    </ListBoxVariantCtx.Provider>
  );
}

export interface ListBoxItemProps<T> extends AriaListBoxItemProps<T> {
  variant?: ListBoxVariant;
  /** Leading icon / avatar. */
  icon?: ReactNode;
  /** Secondary line under the label. */
  description?: ReactNode;
}

function Check({ className }: { className?: string }) {
  return <Icon name="check" size={18} sw={2.4} className={cn('shrink-0 text-primary', className)} />;
}

export function ListBoxItem<T extends object>({ className, variant: variantProp, icon, description, children, textValue, ...props }: ListBoxItemProps<T>) {
  const listVariant = useContext(ListBoxVariantCtx);
  const variant = variantProp ?? listVariant;
  return (
    <AriaListBoxItem
      data-slot="list-box-item"
      textValue={textValue ?? (typeof children === 'string' ? children : undefined)}
      className={composeRenderProps(className, (cls) => cn(listBoxItemVariants({ variant }), cls))}
      {...props}
    >
      {composeRenderProps(children, (kids, { isSelected, selectionMode }) => {
        const selectable = selectionMode !== 'none';
        const label = (
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate">{kids}</span>
            {description ? <span className="truncate text-footnote leading-[18px] text-muted-foreground">{description}</span> : null}
          </span>
        );
        return variant === 'popup' ? (
          <>
            {selectable ? <span className="grid w-[18px] shrink-0 place-items-center">{isSelected ? <Check /> : null}</span> : null}
            {icon ? <span className="grid shrink-0 place-items-center text-muted-foreground">{icon}</span> : null}
            {label}
          </>
        ) : (
          <>
            {icon ? <span className="grid shrink-0 place-items-center text-primary">{icon}</span> : null}
            {label}
            {selectable && isSelected ? <Check /> : null}
          </>
        );
      })}
    </AriaListBoxItem>
  );
}

export interface ListBoxSectionProps<T> extends AriaListBoxSectionProps<T> {
  title?: ReactNode;
}

export function ListBoxSection<T extends object>({ className, title, children, items, ...props }: ListBoxSectionProps<T>) {
  return (
    <AriaListBoxSection data-slot="list-box-section" className={cn('not-first:mt-1.5 not-first:pt-1.5 not-first:shadow-hairline-t', className)} {...props}>
      {title ? <ListBoxHeader>{title}</ListBoxHeader> : null}
      <Collection items={items}>{children}</Collection>
    </AriaListBoxSection>
  );
}

export function ListBoxHeader({ className, ...props }: ComponentProps<typeof Header>) {
  return (
    <Header
      data-slot="list-box-header"
      className={cn('px-2 pt-1 pb-1 text-footnote leading-[18px] font-semibold text-muted-foreground', className)}
      {...props}
    />
  );
}
