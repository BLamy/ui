/* The detail column. Desktop: a macOS toolbar (back / forward, pane title) over a scrolling pane that slides in
   the direction you went. Tablet and phone: an iOS navigation stack — drill-downs push inside the column; on a
   phone its root screen goes back to the Settings list. */
import { useLayoutEffect, useRef } from 'react';
import {
  Button, ContentSwap, Icon, NavigationStack, SplitViewDetail, TextMorph, useSplitView, type Screen,
} from '@brett_lamy/ui';
import { getPane } from './data';
import { PaneView } from './rows';
import { trailOf, useSettings } from './state';

function ToolButton({ label, icon, disabled, onPress }: { label: string; icon: 'chevron-left' | 'chevron-right'; disabled: boolean; onPress: () => void }) {
  return (
    <Button variant="ghost" size="icon" aria-label={label} isDisabled={disabled} onPress={onPress}
      className="size-7 rounded-[6px] text-muted-foreground data-disabled:opacity-35">
      <Icon name={icon} size={16} weight="bold" />
    </Button>
  );
}

/** Collapsed, the stack's root screen pops the SplitView back to the Settings list (NavigationStack only draws
 *  a back button above its root). Styled like the stack's own back button. */
function BackToList() {
  const split = useSplitView();
  return (
    <button type="button" onClick={split.back} aria-label="Back to Settings"
      className="bl-btn flex cursor-pointer items-center border-0 bg-transparent py-1.5 pr-2 pl-0 [font-family:inherit] text-[17px] text-primary">
      <Icon name="chevL" size={24} sw={2.4} />Settings
    </button>
  );
}

export function SettingsDetail() {
  const s = useSettings();
  const split = useSplitView();
  const trail = trailOf(s.path);
  const key = trail.join('/');
  const id = trail[trail.length - 1];
  const scroller = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [key]);

  if (s.layout === 'desktop') {
    const title = getPane(id)?.title ?? '';
    return (
      <SplitViewDetail aria-label={title} className="bg-card">
        <div className="flex h-[52px] shrink-0 items-center gap-0.5 px-3 shadow-[inset_0_-1px_0_var(--bl-sep)]">
          <ToolButton label="Back" icon="chevron-left" disabled={trail.length < 2} onPress={s.back} />
          <ToolButton label="Forward" icon="chevron-right" disabled={!s.canForward} onPress={s.forward} />
          <div className="ml-2 min-w-0 truncate text-[15px] font-semibold"><TextMorph>{title}</TextMorph></div>
        </div>
        <div ref={scroller} className="bl-scroll min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
          <ContentSwap id={key} direction={s.dir}><PaneView id={id} /></ContentSwap>
        </div>
      </SplitViewDetail>
    );
  }

  const screens: Screen[] = trail.map((pid, i) => ({
    key: trail.slice(0, i + 1).join('/'), title: getPane(pid)?.title, grouped: true, hideChromeOnScroll: false, content: <PaneView id={pid} />,
    leading: i === 0 && split.collapsed ? <BackToList /> : undefined,
  }));
  return (
    <SplitViewDetail aria-label={getPane(id)?.title} className="bg-muted">
      <div className="relative min-h-0 flex-1">
        <NavigationStack screens={screens} onPop={s.back} />
      </div>
    </SplitViewDetail>
  );
}
