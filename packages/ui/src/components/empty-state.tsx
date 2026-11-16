'use client';
import { cloneElement, isValidElement, useEffect, useState, type ReactNode } from 'react';
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

/** False on the first render, true from the next: a live region must be in the page before its words are, or NVDA and
 *  JAWS miss them (a region inserted with its content already in it is announced by VoiceOver alone). */
function useArrived(live: boolean): boolean {
  const [arrived, setArrived] = useState(!live);
  useEffect(() => { if (live) setArrived(true); }, [live]);
  return arrived;
}

const LIVE_ROLES = new Set(['status', 'alert', 'log']);

export function EmptyState({ icon, title, description, action, size, className, render, ...props }: EmptyStateProps) {
  const s = size ?? 'default';
  // As a live region (`renderEmptyState` makes it one), the box mounts empty and its words follow, so they're announced.
  const arrived = useArrived(LIVE_ROLES.has(props.role ?? '') || (props['aria-live'] != null && props['aria-live'] !== 'off'));
  return renderElement(
    'div',
    {
      'data-slot': 'empty-state',
      'data-size': s,
      ...props,
      className: cx(emptyStateVariants({ size: s }), className),
      children: arrived ? (
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
      ) : null,
    },
    render,
  );
}

/** How every data component reads its `emptyState` prop, so one value means one thing kit-wide:
 *  - `undefined`: the component's default, `<EmptyState size="sm" {...defaults} />`;
 *  - a string or number: the title of a small `EmptyState` (with the default's icon, not its description);
 *  - `null`, `false` or `''`: nothing;
 *  - any other node: drawn as it is.
 *  The result is a polite `status` region (an `EmptyState` gets `role="status"`, any other node is wrapped in one) that
 *  mounts empty and gets its words on the next render, so a filter that empties the collection is announced by every
 *  screen reader, not only by those that read a region inserted with its content. */
export function renderEmptyState(value: ReactNode, defaults: EmptyStateProps = {}): ReactNode {
  if (value === undefined) return <EmptyState size="sm" role="status" {...defaults} />;
  if (value === null || value === false || value === '') return null;
  if (typeof value === 'string' || typeof value === 'number')
    return <EmptyState size={defaults.size ?? 'sm'} role="status" icon={defaults.icon} title={value} />;
  if (isValidElement<EmptyStateProps>(value) && value.type === EmptyState)
    return value.props.role ? value : cloneElement(value, { role: 'status' });
  return <EmptyRegion>{value}</EmptyRegion>;
}

/** A polite region around a node of the caller's, which mounts empty and is filled on the next render (see `useArrived`). */
function EmptyRegion({ children }: { children: ReactNode }) {
  const arrived = useArrived(true);
  return <div role="status" data-slot="empty-state-region" className="contents">{arrived ? children : null}</div>;
}
