/* The detail column. Desktop: a macOS toolbar (back / forward, pane title) over a scrolling pane that slides in
   the direction you went. Tablet: an iPadOS navigation stack — drill-downs push inside the column. */
import { useLayoutEffect, useRef } from 'react';
import { Button, ContentSwap, NavigationStack, SplitViewDetail, TextMorph, type Screen } from '@brett_lamy/ui';
import { getPane } from './data';
import { Glyph } from './glyphs';
import { PaneView } from './rows';
import { trailOf, useSettings } from './state';

function ToolButton({ label, glyph, disabled, onPress }: { label: string; glyph: 'chevronLeft' | 'chevron'; disabled: boolean; onPress: () => void }) {
  return (
    <Button variant="ghost" size="icon" aria-label={label} isDisabled={disabled} onPress={onPress}
      className="size-7 rounded-[6px] text-muted-foreground data-disabled:opacity-35">
      <Glyph name={glyph} size={16} sw={2.4} />
    </Button>
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
        <div className="flex h-[52px] shrink-0 items-center gap-0.5 px-3 shadow-[inset_0_-1px_0_var(--bl-sep)]">
          <ToolButton label="Back" glyph="chevronLeft" disabled={trail.length < 2} onPress={s.back} />
          <ToolButton label="Forward" glyph="chevron" disabled={!s.canForward} onPress={s.forward} />
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
  }));
  return (
    <SplitViewDetail aria-label={getPane(id)?.title} className="bg-muted">
      <div className="relative min-h-0 flex-1">
        <NavigationStack screens={screens} onPop={s.back} />
      </div>
    </SplitViewDetail>
  );
}
