'use client';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';

export interface SettledBannerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Un-settle pressed: the thread goes back to Active. */
  onUnsettle: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
}

/** Above the composer of a settled thread (T3 Code): sending a message, or Un-settle, moves it back to Active. */
export function SettledBanner({
  onUnsettle,
  title = 'This thread is settled',
  description = 'Sending a message moves it back to Active in the sidebar.',
  className,
  ...props
}: SettledBannerProps) {
  return (
    <div data-slot="settled-banner" className={cn('mb-2.5 flex items-center gap-[11px] rounded-xl border border-border bg-card px-3 py-2.5', className)} {...props}>
      <Icon name="checkmark-circle" size={20} sw={1.8} className="text-success" />
      <div className="min-w-0 flex-1">
        <div className="text-footnote font-semibold">{title}</div>
        <div className="mt-px text-caption text-muted-foreground">{description}</div>
      </div>
      <Button variant="outline" size="sm" className="shrink-0" onClick={() => onUnsettle()}>
        Un-settle
      </Button>
    </div>
  );
}
