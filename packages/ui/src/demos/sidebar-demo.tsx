import { useState } from 'react';
import { Button as AriaButton } from 'react-aria-components';
import { cn } from '../lib/utils';
import { themeScopeProps } from '../lib/theme';
import { SidebarInset, SidebarNav, SidebarProvider, SidebarTrigger, type SidebarVariant } from '../components/sidebar';

const VARIANTS: SidebarVariant[] = ['docked', 'rail', 'float', 'overlay'];
function Chip({ active, onPress, children }: { active: boolean; onPress: () => void; children: string }) {
  return (
    <AriaButton
      onPress={onPress}
      className={cn(
        'cursor-pointer rounded-[999px] border-0 px-[11px] py-[5px] font-ios text-[12px] font-semibold',
        active ? 'bg-primary text-primary-foreground' : 'bg-secondary-strong text-foreground',
      )}
    >
      {children}
    </AriaButton>
  );
}

/** One Sidebar, four variants, plus a narrow container that turns any of them into the overlay. */
export function SidebarDemo({ variant: initial = 'docked' }: { variant?: SidebarVariant }) {
  const [variant, setVariant] = useState<SidebarVariant>(initial);
  const [narrow, setNarrow] = useState(false);
  const scope = themeScopeProps({ scope: 'workbench', appearance: 'dark' });
  return (
    // A plain element (not <ThemeScope>): the demo's own chrome keeps content-box sizing.
    <div {...scope} className={cn(scope.className, 'grid justify-items-center gap-3 bg-background p-4 font-ios')}>
      <div className="flex flex-wrap justify-center gap-1.5">
        {VARIANTS.map((v) => <Chip key={v} active={variant === v} onPress={() => setVariant(v)}>{v}</Chip>)}
        <Chip active={narrow} onPress={() => setNarrow((n) => !n)}>narrow container</Chip>
      </div>
      <div className={cn(
        'h-[330px] max-w-[640px] overflow-hidden rounded-[14px] border border-border transition-[width] duration-spring-smooth ease-spring-smooth',
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
