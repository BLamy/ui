import { cloneElement, isValidElement, type ReactNode } from 'react';
import { renderElement, type PartProps } from '@ui-sdk/react/primitive';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn, cx } from '@/lib/utils';

/* ══ EmptyState — what a collection, pane or search shows when it has nothing to show ══
   iOS's "content unavailable" view: an optional glyph, a title, a line of explanation and an optional action, centred.
   `sm` sits inside a list, table, tree or popup; `default` fills a pane (a SplitView column with nothing selected);
   `lg` fills a page. Every data component reads its `emptyState` prop through `renderEmptyState` (below), so a string,
   a node, `null` and the default mean the same thing everywhere. The text is AA on every surface: titles are
   `foreground`, descriptions `foreground/70`; only the decorative glyph is the faint tertiary label. */
export const emptyStateVariants = cva('flex flex-col items-center justify-center text-center text-balance', {
  variants: {
    size: {
      sm: 'gap-0.5 px-3 py-6',
      default: 'h-full gap-1 p-6',
      lg: 'h-full gap-1.5 p-8',
    },
  },
  defaultVariants: { size: 'default' },
});

const iconVariants = cva('grid place-items-center text-tertiary-foreground', {
  variants: {
    size: {
      sm: 'mb-1 [&_svg]:size-6',
      default: 'mb-2 [&_svg]:size-11',
      lg: 'mb-2.5 [&_svg]:size-14',
    },
  },
});

const titleVariants = cva('m-0', {
  variants: {
    size: {
      sm: 'text-footnote font-semibold text-foreground',
      default: 'text-callout font-semibold text-foreground',
      lg: 'text-title font-semibold text-foreground',
    },
  },
});

const descriptionVariants = cva('m-0 max-w-sm', {
  variants: {
    size: {
      sm: 'text-footnote text-foreground/70',
      default: 'text-footnote text-foreground/70',
      lg: 'text-subhead text-foreground/70',
    },
  },
});

export interface EmptyStateProps
  extends Omit<PartProps<'div'>, 'title' | 'children'>,
    VariantProps<typeof emptyStateVariants> {
  /** A glyph above the title, usually an `<Icon>`; it is decorative (`aria-hidden`). */
  icon?: ReactNode;
  /** What is missing, in a few words: "No messages", "No matches". */
  title?: ReactNode;
  /** Why it is empty, or what to do about it. */
  description?: ReactNode;
  /** A button (or a row of them) under the text: "New message", "Clear filters". */
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action, size, className, render, ...props }: EmptyStateProps) {
  const s = size ?? 'default';
  return renderElement(
    'div',
    {
      'data-slot': 'empty-state',
      'data-size': s,
      ...props,
      className: cx(emptyStateVariants({ size: s }), className),
      children: (
        <>
          {icon ? <div data-slot="empty-state-icon" aria-hidden className={iconVariants({ size: s })}>{icon}</div> : null}
          {title ? <div data-slot="empty-state-title" className={titleVariants({ size: s })}>{title}</div> : null}
          {description ? <div data-slot="empty-state-description" className={descriptionVariants({ size: s })}>{description}</div> : null}
          {action ? (
            <div data-slot="empty-state-action" className={cn('flex flex-wrap items-center justify-center gap-2', s === 'sm' ? 'mt-2' : 'mt-3')}>
              {action}
            </div>
          ) : null}
        </>
      ),
    },
    render,
  );
}

/** How every data component reads its `emptyState` prop, so one value means one thing kit-wide:
 *  - `undefined`: the component's default, `<EmptyState size="sm" {...defaults} />`;
 *  - a string or number: the title of a small `EmptyState` (with the default's icon, not its description);
 *  - `null`, `false` or `''`: nothing;
 *  - any other node: drawn as it is.
 *  The result is a polite `status` region (an `EmptyState` gets `role="status"`, any other node is wrapped in one), so
 *  a filter that empties the collection is announced. */
export function renderEmptyState(value: ReactNode, defaults: EmptyStateProps = {}): ReactNode {
  if (value === undefined) return <EmptyState size="sm" role="status" {...defaults} />;
  if (value === null || value === false || value === '') return null;
  if (typeof value === 'string' || typeof value === 'number')
    return <EmptyState size={defaults.size ?? 'sm'} role="status" icon={defaults.icon} title={value} />;
  if (isValidElement<EmptyStateProps>(value) && value.type === EmptyState)
    return value.props.role ? value : cloneElement(value, { role: 'status' });
  return <div role="status" data-slot="empty-state-region" className="contents">{value}</div>;
}
