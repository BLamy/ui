/* The detail column. Desktop: a macOS toolbar (back / forward, pane title) over a scrolling pane that slides in
   the direction you went. Tablet and phone: an iOS navigation stack — drill-downs push inside the column; on a
   phone its first page goes back to the Settings list (the stack's root back, from the collapsed SplitView). */
import { useLayoutEffect, useRef } from 'react';
import { ContentSwap } from '@/components/ui/animated-height';
import { Button } from '@/components/ui/button';
import {
  NavigationStack, NavigationStackBar, NavigationStackContent, NavigationStackPage, NavigationStackTitle,
} from '@/components/ui/navigation-stack';
import { SplitViewDetail } from '@/components/ui/split-view';
import { TextMorph } from '@/components/ui/text-morph';
import { Icon } from '@/lib/icon';
import { getPane } from './data';
import { PaneView } from './rows';
import { trailOf, useSettings } from './state';

function ToolButton({ label, icon, disabled, onClick }: { label: string; icon: 'chevron-left' | 'chevron-right'; disabled: boolean; onClick: () => void }) {
  return (
    <Button variant="ghost" size="icon" aria-label={label} disabled={disabled} onClick={onClick}
      className="size-7 rounded-md text-muted-foreground data-disabled:opacity-35">
      <Icon name={icon} size={16} weight="bold" />
    </Button>
  );
}

/** One pane as a stack page: an inline title that stays put, over the grouped pane. */
function PanePage({ value, pane }: { value: string; pane: string }) {
  return (
    <NavigationStackPage value={value} grouped>
      <NavigationStackBar hideOnScroll={false}>
        <NavigationStackTitle>{getPane(pane)?.title}</NavigationStackTitle>
      </NavigationStackBar>
      <NavigationStackContent><PaneView id={pane} /></NavigationStackContent>
    </NavigationStackPage>
  );
}

export function SettingsDetail() {
  const s = useSettings();
  const trail = trailOf(s.path);
  const key = trail.join('/');
  const id = trail[trail.length - 1];
  const scroller = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [key]);

  if (s.layout === 'desktop') {
    const title = getPane(id)?.title ?? '';
    return (
      <SplitViewDetail aria-label={title} className="bg-card">
        <div className="flex h-toolbar shrink-0 items-center gap-0.5 px-3 shadow-hairline-b">
          <ToolButton label="Back" icon="chevron-left" disabled={trail.length < 2} onClick={s.back} />
          <ToolButton label="Forward" icon="chevron-right" disabled={!s.canForward} onClick={s.forward} />
          <div className="ml-2 min-w-0 truncate text-subhead font-semibold"><TextMorph>{title}</TextMorph></div>
        </div>
        <div ref={scroller} className="bl-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          <ContentSwap id={key} direction={s.dir}><PaneView id={id} /></ContentSwap>
        </div>
      </SplitViewDetail>
    );
  }

  // Page keys are the path so far, so a pane opened twice on one path is still two pages.
  const pages = trail.map((_, i) => trail.slice(0, i + 1).join('/'));
  return (
    <SplitViewDetail aria-label={getPane(id)?.title} className="bg-muted">
      <div className="relative min-h-0 flex-1">
        <NavigationStack pages={pages}
          onPagesChange={(next) => { for (let i = next.length; i < pages.length; i++) s.back(); }}>
          {trail.map((pid, i) => <PanePage key={pages[i]} value={pages[i]} pane={pid} />)}
        </NavigationStack>
      </div>
    </SplitViewDetail>
  );
}
