import { cn } from '@/lib/utils';

/** dot's mark: a soft ring around a dark centre. */
export function DotOrb({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <span
      data-slot="dot-orb"
      aria-hidden="true"
      className={cn('grid shrink-0 place-items-center rounded-full bg-secondary-strong shadow-[inset_0_0_0_1.5px_var(--tertiary-foreground)]', className)}
      // sized per use: the sidebar row, the chat header
      style={{ width: size, height: size }}
    >
      <span className="rounded-full bg-background" style={{ width: size * 0.42, height: size * 0.42 }} />
    </span>
  );
}
