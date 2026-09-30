import { useState, type ReactNode } from 'react';
import { Segmented } from '@/components/ui/segmented';
import { BLProvider } from '@/lib/theme';
import {
  SplitViewGalleryDemo, SplitViewLibraryDemo, SplitViewMailDemo, SplitViewNotesDemo, SplitViewRemindersDemo, SplitViewSettingsDemo,
} from './demos';

const DEMOS: { id: string; label: string; render: () => ReactNode }[] = [
  { id: 'mail', label: 'Mail', render: () => <SplitViewMailDemo /> },
  { id: 'notes', label: 'Notes', render: () => <SplitViewNotesDemo /> },
  { id: 'settings', label: 'Settings', render: () => <SplitViewSettingsDemo /> },
  { id: 'reminders', label: 'Reminders', render: () => <SplitViewRemindersDemo /> },
  { id: 'library', label: 'Library', render: () => <SplitViewLibraryDemo /> },
  { id: 'gallery', label: 'Gallery', render: () => <SplitViewGalleryDemo /> },
];

/** The SplitView compositions behind a segmented switcher. */
export default function SplitViewDemos() {
  const [id, setId] = useState('mail');
  const demo = DEMOS.find((d) => d.id === id) ?? DEMOS[0];
  return (
    <BLProvider>
      <div className="flex h-full flex-col">
        <div className="flex justify-center p-2.5">
          <Segmented aria-label="Composition" options={DEMOS.map(({ id, label }) => ({ id, label }))} value={id} onChange={setId} />
        </div>
        <div key={demo.id} className="relative min-h-0 flex-1">{demo.render()}</div>
      </div>
    </BLProvider>
  );
}
