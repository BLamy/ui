import { useState } from 'react';
import { Toggle as SdkToggle } from '@ui-sdk/react/toggle';
import {
  Sidebar, SidebarContent, SidebarHeader, SidebarInset, SidebarItem, SidebarProvider, SidebarSearch, SidebarSection,
  SidebarTrigger, SidebarAccount, useSidebar, type SidebarPresentation, type SidebarVariant,
} from '@/components/ui/sidebar';
import { ToggleGroup } from '@/components/ui/toggle';
import { themeScopeProps } from '@/lib/theme';
import { cn } from '@/lib/utils';

const PAGES = [
  { section: 'Workspace', icon: 'house', title: 'Home' },
  { section: 'Workspace', icon: 'bolt', title: 'Agent tasks', trailing: 4 },
  { section: 'Workspace', icon: 'tray', title: 'Inbox', trailing: 12 },
  { section: 'Objects', icon: 'cube', title: 'Suppliers' },
  { section: 'Objects', icon: 'cube', title: 'Inventory' },
] as const;

/** "Creamery Ops": a workspace, a search, an action row and two sections, in any look and presentation. */
export function SidebarNav({ variant = 'docked', presentation, page, onPageChange }: {
  variant?: SidebarVariant;
  presentation?: SidebarPresentation;
  page: string;
  onPageChange: (page: string) => void;
}) {
  return (
    <Sidebar variant={variant} presentation={presentation}>
      <SidebarHeader>
        <SidebarAccount title="Creamery Ops" description="Production workspace" />
      </SidebarHeader>
      <SidebarContent aria-label="Creamery Ops">
        <SidebarSearch shortcut="/" />
        <SidebarItem icon="plus" title="New task" tint="var(--primary)" />
        {(['Workspace', 'Objects'] as const).map((section) => (
          <SidebarSection key={section} title={section}>
            {PAGES.filter((p) => p.section === section).map((p) => (
              <SidebarItem key={p.title} icon={p.icon} title={p.title} trailing={'trailing' in p ? p.trailing : undefined}
                current={page === p.title} onClick={() => onPageChange(p.title)} />
            ))}
          </SidebarSection>
        ))}
      </SidebarContent>
    </Sidebar>
  );
}

const VARIANTS: SidebarVariant[] = ['docked', 'rail', 'float'];
const PRESENTATIONS: SidebarPresentation[] = ['auto', 'column', 'drawer'];
const chip = cn(
  'h-auto cursor-pointer rounded-full border-0 bg-secondary-strong px-3 py-1 font-sans text-caption font-semibold text-foreground outline-none',
  'focus-visible:ring-2 focus-visible:ring-ring data-pressed:bg-primary data-pressed:text-primary-foreground',
);

function Page({ page }: { page: string }) {
  const { compact } = useSidebar();
  return (
    <SidebarInset>
      <div className="flex items-center gap-2 border-b border-border px-2 py-1.5">
        {/* The sidebar button toggles every look and presentation. */}
        <SidebarTrigger shortcut="mod+b" />
        <span className="text-footnote font-semibold text-foreground">{page}</span>
      </div>
      <p className="m-0 p-4 text-footnote leading-relaxed text-muted-foreground">
        One sidebar, three looks and two presentations: the trigger toggles whichever shows, and with
        presentation “auto” it becomes a drawer while its provider is compact{compact ? ' (as now)' : ''}. Try “narrow container”.
      </p>
    </SidebarInset>
  );
}

/** One Sidebar, three looks, two presentations, plus a narrow container that turns `auto` into the drawer. */
export function SidebarDemo({ variant: initialVariant = 'docked', presentation: initialPresentation = 'auto', dark = true }: {
  variant?: SidebarVariant;
  presentation?: SidebarPresentation;
  dark?: boolean;
}) {
  const [variant, setVariant] = useState<SidebarVariant>(initialVariant);
  const [presentation, setPresentation] = useState<SidebarPresentation>(initialPresentation);
  const [narrow, setNarrow] = useState(false);
  const [page, setPage] = useState('Home');
  const scope = themeScopeProps({ scope: 'workbench', appearance: dark ? 'dark' : 'light' });
  return (
    // A plain element (not <ThemeScope>): the demo's own chrome keeps content-box sizing.
    <div {...scope} className={cn(scope.className, 'grid justify-items-center gap-3 bg-background p-4 font-sans')}>
      <div className="flex flex-wrap justify-center gap-1.5">
        <ToggleGroup<SidebarVariant> aria-label="Variant" value={[variant]} deselectable={false} onValueChange={([next]) => next && setVariant(next)} className="gap-1.5">
          {VARIANTS.map((v) => <SdkToggle key={v} value={v} className={chip}>{v}</SdkToggle>)}
        </ToggleGroup>
        <ToggleGroup<SidebarPresentation> aria-label="Presentation" value={[presentation]} deselectable={false} onValueChange={([next]) => next && setPresentation(next)} className="gap-1.5">
          {PRESENTATIONS.map((p) => <SdkToggle key={p} value={p} className={chip}>{p}</SdkToggle>)}
        </ToggleGroup>
        <SdkToggle pressed={narrow} onPressedChange={setNarrow} className={chip}>narrow container</SdkToggle>
      </div>
      <div className={cn(
        'h-[360px] max-w-[680px] overflow-hidden rounded-card border border-border transition-[width] duration-spring-smooth ease-spring-smooth',
        narrow ? 'w-[380px]' : 'w-full',
      )}>
        {/* Remounted per look and presentation, so each starts in its default state. */}
        <SidebarProvider key={variant + presentation} defaultOpen={presentation !== 'drawer'} breakpoint={430}>
          <SidebarNav variant={variant} presentation={presentation} page={page} onPageChange={setPage} />
          <Page page={page} />
        </SidebarProvider>
      </div>
    </div>
  );
}
