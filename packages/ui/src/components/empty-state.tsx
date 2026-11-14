import type { ReactNode } from 'react';
import { renderElement, type PartProps } from '@ui-sdk/react/primitive';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn, cx } from '@/lib/utils';

/* ══ EmptyState — what a collection, pane or search shows when it has nothing to show ══
   iOS's "content unavailable" view: an optional glyph, a title, a line of explanation and an optional action, centred.
   `sm` sits inside a list, table, tree or popup; `default` fills a pane (a SplitView column with nothing selected);
   `lg` fills a page. The data components' `emptyState` prop defaults to `<EmptyState size="sm" title="…" />`. */
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
      sm: 'mb-1 [&_svg]:size-5',
      default: 'mb-1.5 [&_svg]:size-7',
      lg: 'mb-2 [&_svg]:size-11',
    },
  },
});

const titleVariants = cva('m-0', {
  variants: {
    size: {
      sm: 'text-footnote font-medium text-muted-foreground',
      default: 'text-callout font-semibold text-foreground',
      lg: 'text-title font-semibold text-foreground',
    },
  },
});

const descriptionVariants = cva('m-0 max-w-sm', {
  variants: {
    size: {
      sm: 'text-caption text-tertiary-foreground',
      default: 'text-footnote text-muted-foreground',
      lg: 'text-subhead text-muted-foreground',
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
