/* Apple Settings — iOS / iPadOS Settings and macOS System Settings in one block, on one SplitView.
   Regular: System Settings (sidebar + toolbar detail). Medium: iPad split (sidebar + pushed detail).
   Compact: the sidebar is the large-title root list and panes push over it. Display & Brightness → Appearance
   switches light/dark live. */
import { useState } from 'react';
import { SplitView } from '@/components/ui/split-view';
import { BLProvider, useAppearance, type Appearance } from '@/lib/theme';
import { SettingsDetail } from './detail';
import { SettingsSidebar } from './sidebar';
import { SettingsCtx, trailOf, useSettingsState } from './state';

export interface AppleSettingsProps {
  /** Panes to open, top level first — e.g. ['general', 'about']. */
  initialPath?: string[];
  /** Draw the macOS close / minimize / zoom dots in the sidebar (default true). Off when the app sits in a window that has its own. */
  windowControls?: boolean;
}

/** Settings' accent: iOS system blue (light #007AFF, dark #0A84FF). */
const SETTINGS_TINT = { light: '#007AFF', dark: '#0A84FF' } as const;

export default function AppleSettings({ initialPath = [], windowControls = true }: AppleSettingsProps) {
  const ambient = useAppearance();
  const [appearance, setAppearance] = useState<Appearance | null>(null);
  const dark = (appearance ?? ambient) === 'dark';
  const settings = useSettingsState(initialPath, dark, setAppearance, windowControls);

  return (
    <BLProvider dark={dark} tint={SETTINGS_TINT[dark ? 'dark' : 'light']}>
      <SettingsCtx.Provider value={settings}>
        <SplitView aria-label="Settings" sidebarBehavior="tile" sidebarVisibility={{ medium: true }}
          defaultCompactColumn={initialPath.length ? 'detail' : 'sidebar'}
          selection={{ sidebar: trailOf(settings.path)[0] }} onSelectionChange={(sel) => sel.sidebar && settings.openPath([sel.sidebar])}>
          <SettingsSidebar />
          <SettingsDetail />
        </SplitView>
      </SettingsCtx.Provider>
    </BLProvider>
  );
}
