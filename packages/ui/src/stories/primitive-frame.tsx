import type { ReactNode } from 'react';
import { cn } from '../lib/utils';
import { Pad, Phone } from './frame';

/** Story-only: the shadcn primitives shown on an iOS grouped screen (Phone) or a padded card (Pad). */

export function Screen({ children, dark, h = 640, className, title }: {
  children?: ReactNode; dark?: boolean; h?: number; className?: string; title?: ReactNode;
}) {
  return (
    <Phone dark={dark} h={h}>
      <div className={cn('bl-scroll absolute inset-0 flex flex-col gap-4 overflow-y-auto p-5', className)}>
        {title ? <div className="px-1 pt-2 text-[28px] leading-[34px] font-bold tracking-[-.4px] text-foreground">{title}</div> : null}
        {children}
      </div>
    </Phone>
  );
}

export function Panel({ children, dark, w, className }: { children?: ReactNode; dark?: boolean; w?: number; className?: string }) {
  return (
    <Pad dark={dark} w={w}>
      <div className={cn('flex flex-col gap-4', className)}>{children}</div>
    </Pad>
  );
}

/** Small uppercase caption above a group, like an iOS section header. */
export function Caption({ children }: { children?: ReactNode }) {
  return <div className="px-1 text-[13px] leading-[18px] tracking-[.02em] text-muted-foreground uppercase">{children}</div>;
}
