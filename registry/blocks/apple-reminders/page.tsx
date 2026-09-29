/* Apple Reminders — smart lists and your lists in a SplitView. Wide: sidebar + list side by side (the sidebar
   toggles away). Phone: the lists screen pushes the open list. Everything tints with the open list's color. */
import { useState } from 'react';
import { BLProvider, SplitView, useAppearance, type SplitViewSelection } from '@brett_lamy/ui';
import { SMART } from './data';
import { DetailsSheet } from './details';
import { ListView } from './list-view';
import { ListsSidebar } from './sidebar';
import { RemindersCtx, useRemindersState } from './store';

export interface AppleRemindersProps {
  /** List or smart list to open: 'today', 'scheduled', 'all', 'flagged', 'completed', or a list id ('groceries'). */
  initialList?: string;
  /** Phone only: open on the list instead of the lists screen. */
  openList?: boolean;
}

export default function AppleReminders({ initialList = 'today', openList = false }: AppleRemindersProps) {
  const dark = useAppearance() === 'dark';
  const reminders = useRemindersState();
  const [selection, setSelection] = useState<SplitViewSelection>({ sidebar: initialList });
  const [sidebar, setSidebar] = useState(true);
  const id = selection.sidebar ?? 'today';
  const tint = SMART.find((s) => s.id === id)?.color ?? reminders.lists.find((l) => l.id === id)?.color ?? '#007AFF';

  return (
    <BLProvider dark={dark} tint={tint}>
      <RemindersCtx.Provider value={reminders}>
        <SplitView aria-label="Reminders" selection={selection} onSelectionChange={setSelection} sidebarBehavior="tile" sidebarVisibility={{ medium: true }}
          sidebarVisible={sidebar} onSidebarVisibleChange={setSidebar} defaultCompactColumn={openList ? 'detail' : 'sidebar'}>
          <ListsSidebar />
          <ListView />
          <DetailsSheet />
        </SplitView>
      </RemindersCtx.Provider>
    </BLProvider>
  );
}
