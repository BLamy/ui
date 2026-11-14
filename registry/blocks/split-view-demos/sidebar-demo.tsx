import { useState } from 'react';
import { PlainToggleButton } from '@/components/ui/plain-button';
import { SidebarInset, SidebarNav, SidebarProvider, SidebarTrigger, type SidebarVariant } from '@/components/ui/sidebar';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { themeScopeProps } from '@/lib/theme';
import { cn } from '@/lib/utils';

const VARIANTS: SidebarVariant[] = ['docked', 'rail', 'float', 'overlay'];
const chip = cn(
  'h-auto cursor-pointer rounded-[999px] border-0 bg-secondary-strong px-[11px] py-[5px] font-sans text-caption font-semibold text-foreground outline-none',
  'focus-visible:ring-2 focus-visible:ring-ring data-pressed:bg-primary data-pressed:text-primary-foreground',
);

/** One Sidebar, four variants, plus a narrow container that turns any of them into the overlay. */
export function SidebarDemo({ variant: initial = 'docked' }: { variant?: SidebarVariant }) {
  const [variant, setVariant] = useState<SidebarVariant>(initial);
  const [narrow, setNarrow] = useState(false);
  const scope = themeScopeProps({ scope: 'workbench', appearance: 'dark' });
  return (
    // A plain element (not <ThemeScope>): the demo's own chrome keeps content-box sizing.
    <div {...scope} className={cn(scope.className, 'grid justify-items-center gap-3 bg-background p-4 font-sans')}>
      <div className="flex flex-wrap justify-center gap-1.5">
        <ToggleGroup<SidebarVariant> aria-label="Variant" value={[variant]} deselectable={false} onValueChange={([next]) => next && setVariant(next)} className="gap-1.5">
          {VARIANTS.map((v) => <PlainToggleButton key={v} value={v} className={chip}>{v}</PlainToggleButton>)}
        </ToggleGroup>
        <PlainToggleButton pressed={narrow} onPressedChange={setNarrow} className={chip}>narrow container</PlainToggleButton>
      </div>
      <div className={cn(
        'h-[330px] max-w-[640px] overflow-hidden rounded-card border border-border transition-[width] duration-spring-smooth ease-spring-smooth',
        narrow ? 'w-[380px]' : 'w-full',
      )}>
        <SidebarProvider key={variant + narrow} defaultOpen={variant !== 'overlay'} breakpoint={430}>
          <SidebarNav variant={variant} />
          <SidebarInset>
            <div className="flex items-center gap-2 border-b border-border px-3 py-[9px]">
              <SidebarTrigger />
              <span className="text-[12.5px] font-[650] text-foreground">Home</span>
            </div>
            <div className="p-4 text-[12.5px] leading-[1.6] text-muted-foreground">
              One API, four behaviors — the trigger toggles whichever variant is mounted, and every variant becomes a hamburger
              overlay when the container is narrower than the breakpoint. Try “narrow container”.
            </div>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </div>
  );
}
