/* Apple Settings — iOS / iPadOS Settings and macOS System Settings in one block.
   Desktop: System Settings (sidebar + toolbar detail). Tablet: iPad split (sidebar + pushed detail).
   Phone: a NavigationStack with a large-title root. Display & Brightness → Appearance switches light/dark live. */
import { useState } from 'react';
import { BLProvider, SplitView, useAppearance, useContainerWidth, type Appearance } from '@brett_lamy/ui';
import { SettingsDetail } from './detail';
import { PhoneSettings } from './phone';
import { SettingsSidebar } from './sidebar';
import { SettingsCtx, trailOf, useSettingsState, type Layout } from './state';

export interface AppleSettingsProps {
  /** Panes to open, top level first — e.g. ['general', 'about']. */
  initialPath?: string[];
}

export default function AppleSettings({ initialPath = [] }: AppleSettingsProps) {
  const ambient = useAppearance();
  const [appearance, setAppearance] = useState<Appearance | null>(null);
  const dark = (appearance ?? ambient) === 'dark';
  const [ref, width] = useContainerWidth<HTMLDivElement>(1200);
  const layout: Layout = width < 640 ? 'phone' : width < 1024 ? 'tablet' : 'desktop';
  const settings = useSettingsState(initialPath, layout, dark, setAppearance);

  return (
    <BLProvider dark={dark} tint={dark ? '#0A84FF' : '#007AFF'} className="**:box-border">
      <SettingsCtx.Provider value={settings}>
        <div ref={ref} className="relative h-full w-full">
          {layout === 'phone' ? <PhoneSettings /> : (
            <SplitView aria-label="Settings" widthClass={layout === 'desktop' ? 'regular' : 'medium'} sidebarBehavior="tile" sidebarVisible
              selection={{ sidebar: trailOf(settings.path)[0] }} onSelectionChange={(sel) => sel.sidebar && settings.openPath([sel.sidebar])}>
              <SettingsSidebar />
              <SettingsDetail />
            </SplitView>
          )}
        </div>
      </SettingsCtx.Provider>
    </BLProvider>
  );
}
