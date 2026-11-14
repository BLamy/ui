'use client';
import type { ReactNode } from 'react';
import { cva } from 'class-variance-authority';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';

/* The preview kit of the model-backed time controls (NaturalTimeInput, CronEditor): the panel a preview sits on, the
   list of upcoming dates, the "Times in <zone>" line and a note with its icon. One look for both. Secondary text is
   the foreground at 70% (`text-muted-foreground` is below WCAG AA on the grouped grey surfaces), and an error or a
   warning always carries its icon, never color alone. */

/** The surface under a preview: `card` a filled panel, `plain` no surface (aligned with the field's caption). */
export const previewPanelVariants = cva('flex min-w-0 flex-col gap-2', {
  variants: {
    variant: {
      card: 'rounded-panel bg-secondary p-3',
      plain: 'px-1',
    },
  },
  defaultVariants: { variant: 'card' },
});

export const previewSubtle = 'text-foreground/70';

export interface PreviewOccurrence {
  key: string | number;
  label: ReactNode;
  /** The machine-readable instant, written on a <time>. */
  dateTime?: string;
}

/** Upcoming dates, one per row after a small icon, in tabular figures. `more` adds a last "and more" row. */
export function OccurrenceList({ items, icon, more, ordered, className, ...props }: {
  items: readonly PreviewOccurrence[];
  icon: string;
  more?: boolean;
  /** An <ol> (a schedule's runs, in order) instead of a <ul>. */
  ordered?: boolean;
  className?: string;
  'aria-label'?: string;
  'data-slot'?: string;
}) {
  const List = ordered ? 'ol' : 'ul';
  return (
    <List className={cn('m-0 flex list-none flex-col gap-1 p-0 text-foreground tabular-nums', className)} {...props}>
      {items.map((o) => (
        <li key={o.key} className="flex items-center gap-2">
          <Icon name={icon} size={14} className={cn('shrink-0', previewSubtle)} />
          {o.dateTime ? <time dateTime={o.dateTime}>{o.label}</time> : <span>{o.label}</span>}
        </li>
      ))}
      {more ? <li className={cn('pl-[22px]', previewSubtle)}>and more</li> : null}
    </List>
  );
}

/** The zone the dates are shown in, as a caption; `children` continue the line (a sentence, a backend badge). */
export function ZoneNote({ zone, children }: { zone: string; children?: ReactNode }) {
  return (
    <p className={cn('m-0 text-caption', previewSubtle)}>
      Times in {zone}
      {children}
    </p>
  );
}

const NOTE_ICON = { error: 'exclamation-circle', warning: 'warning', info: 'info' } as const;
const NOTE_TONE = { error: 'text-destructive', warning: 'text-warning', info: previewSubtle } as const;
const NOTE_WORD = { error: 'Error: ', warning: 'Warning: ', info: '' } as const;

/** A line with its icon: an error (red icon), a warning (amber icon) or an info note (secondary). The text stays in
    the foreground color; a screen reader hears "Error:" or "Warning:" first. */
export function PreviewNote({ severity, children, className, 'data-slot': slot }: {
  severity: 'error' | 'warning' | 'info';
  children: ReactNode;
  className?: string;
  'data-slot'?: string;
}) {
  return (
    <p data-slot={slot} data-severity={severity} className={cn('m-0 flex items-start gap-1.5', severity === 'info' ? previewSubtle : 'text-foreground', className)}>
      <Icon name={NOTE_ICON[severity]} size={14} className={cn('mt-[3px] shrink-0', NOTE_TONE[severity])} />
      <span className="min-w-0">
        {NOTE_WORD[severity] ? <span className="sr-only">{NOTE_WORD[severity]}</span> : null}
        {children}
      </span>
    </p>
  );
}
