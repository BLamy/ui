import { useEffect, useRef } from 'react';
import { type Appearance } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { TINTS } from '../lib/data';
import { Button } from '@/components/ui/button';
import { Icon } from '@/lib/icon';

/** A small floating card ("Toggle theme editor" / ⌥⇧⌘T): appearance and accent, applied live. */
export function ThemeEditor({
  open,
  onClose,
  appearance,
  onAppearance,
  tint,
  onTint,
}: {
  open: boolean;
  onClose: () => void;
  appearance: Appearance;
  onAppearance: (a: Appearance) => void;
  tint: string;
  onTint: (t: string) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented && ref.current?.contains(document.activeElement)) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Theme editor"
      aria-hidden={!open}
      inert={!open}
      data-open={open || undefined}
      className={cn(
        'absolute right-4 bottom-4 z-40 w-[248px] origin-bottom-right rounded-card border border-border bg-popover p-3 text-footnote text-foreground shadow-[0_18px_50px_color-mix(in_srgb,black_30%,transparent)]',
        // Grows out of its corner on the smooth spring; leaves quicker than it arrives.
        'transition-[opacity,scale,translate] duration-spring-smooth ease-spring-smooth motion-reduce:transition-opacity',
        open ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none translate-y-2 scale-[.96] opacity-0 duration-exit ease-exit',
      )}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <span className="font-semibold">Theme</span>
        <Button
          variant="quiet"
          size="icon-sm"
          aria-label="Close theme editor"
          title="Close theme editor"
          onPress={onClose}
        >
          <Icon name="xmark-large" size={12} sw={1.7} />
        </Button>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-1 rounded-[9px] bg-secondary p-0.5">
        {(['light', 'dark'] as const).map((a) => (
          <button
            key={a}
            type="button"
            aria-pressed={appearance === a}
            onClick={() => onAppearance(a)}
            className={cn(
              'h-7 cursor-pointer rounded-[7px] border-0 bg-transparent font-[inherit] text-[12.5px] font-medium text-muted-foreground capitalize transition-colors',
              appearance === a && 'bg-card text-foreground shadow-[0_1px_2px_color-mix(in_srgb,black_18%,transparent)]',
            )}
          >
            {a}
          </button>
        ))}
      </div>
      <div className="mb-1.5 text-caption text-muted-foreground">Accent</div>
      <div className="flex gap-2">
        {TINTS.map((t) => (
          <button
            key={t}
            type="button"
            aria-label={`Accent ${t}`}
            aria-pressed={tint === t}
            onClick={() => onTint(t)}
            className={cn(
              'size-6 cursor-pointer rounded-full border-0 p-0 transition-[box-shadow,scale] duration-spring-snappy ease-spring-snappy active:scale-90',
              tint === t && 'shadow-[0_0_0_2px_var(--popover),0_0_0_4px_var(--foreground)]',
            )}
            style={{ background: t }}
          />
        ))}
      </div>
    </div>
  );
}
