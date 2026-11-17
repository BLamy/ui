/* Apple Reminders — smart lists and your lists in a SplitView. Wide: sidebar + list side by side (the sidebar
   toggles away). Phone: the lists screen pushes the open list. Everything tints with the open list's color. */
import { useState } from 'react';
import { SplitView, type SplitViewValue } from '@/components/ui/split-view';
import { BLProvider, useAppearance } from '@/lib/theme';
import { SMART, SYSTEM } from './data';
import { DetailsSheet } from './details';
import { ListView } from './list-view';
import { ListsSidebar } from './sidebar';
import { RemindersCtx, useRemindersState } from './store';

export interface AppleRemindersProps {
  /** List or smart list to open: 'today', 'scheduled', 'all', 'flagged', 'completed', or a list id ('groceries'). */
  defaultList?: string;
  /** Phone only: open on the list instead of the lists screen. */
  openList?: boolean;
}

export default function AppleReminders({ defaultList = 'today', openList = false }: AppleRemindersProps) {
  const dark = useAppearance() === 'dark';
  const reminders = useRemindersState();
  const [selection, setSelection] = useState<SplitViewValue>({ sidebar: defaultList });
  const id = selection.sidebar ?? 'today';
  const tint = SMART.find((s) => s.id === id)?.color ?? reminders.lists.find((l) => l.id === id)?.color ?? SYSTEM.blue;

  return (
    <BLProvider appearance={dark ? 'dark' : 'light'} tint={tint}>
      <RemindersCtx.Provider value={reminders}>
        <SplitView aria-label="Reminders" value={selection} onValueChange={setSelection} sidebarBehavior="tile"
          defaultSidebarOpen={{ regular: true, medium: true }} defaultCompactColumn={openList ? 'detail' : 'sidebar'}>
          <ListsSidebar />
          <ListView />
          <DetailsSheet />
        </SplitView>
      </RemindersCtx.Provider>
    </BLProvider>
  );
}
