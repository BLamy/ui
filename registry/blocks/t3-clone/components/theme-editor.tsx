import { DialogClose, DialogContent } from '@ui-sdk/react/dialog';
import { Toggle as SdkToggle, ToggleGroup } from '@ui-sdk/react/toggle';
import { Dialog } from '@/components/ui/dialog';
import { type Appearance } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { TINTS } from '../lib/data';
import { Button } from '@/components/ui/button';
import { Icon } from '@/lib/icon';

/** A small floating card ("Toggle theme editor" / ⌥⇧⌘T): appearance and accent, applied live. A non-modal UI SDK
    Dialog: Escape closes it, the page around it stays usable. */
export function ThemeEditor({
  open,
  onClose,
  appearance,
  onAppearance,
  tint,
  onTint,
  container,
}: {
  open: boolean;
  onClose: () => void;
  appearance: Appearance;
  onAppearance: (a: Appearance) => void;
  tint: string;
  onTint: (t: string) => void;
  /** Where the card renders (it sits in that box's bottom-right corner). */
  container?: Element | null;
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()} modal={false} container={container} presentation="dialog">
      <DialogContent
        aria-label="Theme editor"
        className={cn(
          'absolute right-4 bottom-4 z-40 w-[248px] origin-bottom-right rounded-card border border-border bg-popover p-3 text-footnote text-foreground shadow-[0_18px_50px_color-mix(in_srgb,black_30%,transparent)] outline-none',
          // Grows out of its corner on the smooth spring; leaves quicker than it arrives.
          'transition-[opacity,scale,translate] duration-spring-smooth ease-spring-smooth motion-reduce:transition-opacity',
          'data-starting-style:translate-y-2 data-starting-style:scale-[.96] data-starting-style:opacity-0',
          'data-ending-style:translate-y-2 data-ending-style:scale-[.96] data-ending-style:opacity-0 data-ending-style:duration-exit data-ending-style:ease-exit',
        )}
      >
        <div className="mb-2.5 flex items-center justify-between">
          <span className="font-semibold">Theme</span>
          <DialogClose render={<Button variant="quiet" size="icon-sm" aria-label="Close theme editor" title="Close theme editor" />}>
            <Icon name="xmark-large" size={12} sw={1.7} />
          </DialogClose>
        </div>
        <ToggleGroup
          aria-label="Appearance"
          value={[appearance]}
          deselectable={false}
          onValueChange={([a]) => a && onAppearance(a as Appearance)}
          className="mb-3 grid grid-cols-2 gap-1 rounded-[9px] bg-secondary p-0.5"
        >
          {(['light', 'dark'] as const).map((a) => (
            <SdkToggle
              key={a}
              value={a}
              className="h-7 cursor-pointer rounded-[7px] border-0 bg-transparent font-[inherit] text-[12.5px] font-medium text-muted-foreground capitalize transition-colors data-pressed:bg-card data-pressed:text-foreground data-pressed:shadow-[0_1px_2px_color-mix(in_srgb,black_18%,transparent)]"
            >
              {a}
            </SdkToggle>
          ))}
        </ToggleGroup>
        <div className="mb-1.5 text-caption text-muted-foreground">Accent</div>
        <ToggleGroup aria-label="Accent" value={[tint]} deselectable={false} onValueChange={([t]) => t && onTint(t)} className="flex gap-2">
          {TINTS.map((t) => (
            <SdkToggle
              key={t}
              value={t}
              aria-label={`Accent ${t}`}
              className="size-6 cursor-pointer rounded-full border-0 p-0 transition-[box-shadow,scale] duration-spring-snappy ease-spring-snappy active:scale-90 data-pressed:shadow-[0_0_0_2px_var(--popover),0_0_0_4px_var(--foreground)]"
              style={{ background: t }}
            />
          ))}
        </ToggleGroup>
      </DialogContent>
    </Dialog>
  );
}
