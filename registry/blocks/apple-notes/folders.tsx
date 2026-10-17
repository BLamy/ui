import { SplitViewContent, SplitViewHeader, SplitViewItem, SplitViewSection, SplitViewSidebar, useSplitView } from '@/components/ui/split-view';
import { Icon } from '@/lib/icon';
import type { ReactNode } from 'react';
import type { Folder } from './data';
import { draggedPaths, hasComputerFiles, hasNotesFiles, useDropTarget } from './drag';
import { ItemMenu } from './item-menu';
import { FolderActions } from './master-actions';
import { BarButton, BottomBar } from './parts';
import type { NotesState } from './use-notes';

/** A location takes files dragged from another one (Move or Copy?) and files from your computer (copied in). */
function LocationDrop({ notes, f, children }: { notes: NotesState; f: Folder; children: ReactNode }) {
  const { dropProps } = useDropTarget({
    accepts: (data) => !!f.path && f.connected !== false && (hasNotesFiles(data) || hasComputerFiles(data)),
    onDrop(data) {
      if (!f.path) return;
      const path = f.path;
      if (hasNotesFiles(data)) {
        const paths = draggedPaths(data).filter((p) => notes.files.rootOf(p) !== path);
        if (paths.length) notes.setTransfer({ paths, to: f });
      } else {
        const list = [...data.files];
        void notes.files.run(() => notes.upload(path, list));
      }
    },
  });
  return <div {...dropProps} className="rounded-lg data-[drop-target]:ring-2 data-[drop-target]:ring-primary">{children}</div>;
}

/** The sidebar lists the places notes live. Each one is its own master list; + adds another. */
export function FoldersSidebar({ notes }: { notes: NotesState }) {
  const s = useSplitView();
  const local = notes.roots.filter((f) => f.source === 'local');
  const browser = notes.roots.find((f) => f.source === 'browser');
  const open = (f: Folder) => { notes.openFolder(f.id); if (s.collapsed) s.show('supplementary'); };
  return <SplitViewSidebar aria-label="Folders" width={240} minWidth={200}>
    <SplitViewHeader title="Folders" largeTitle={s.collapsed} trailing={<FolderActions notes={notes} onOpen={() => s.show('detail')} />} />
    <SplitViewContent>
      <div className="px-2.5 pb-16">
        <SplitViewSection title="On My Mac" collapsible>
          {local.map((f) => <LocationDrop key={f.id} notes={notes} f={f}><ItemMenu notes={notes} id={f.id} label={f.title}>
            <SplitViewItem id={f.id} title={f.title}
              subtitle={f.connected === false ? 'Reconnect folder' : undefined}
              icon={<Icon name="folder" size={21} />} badge={notes.count(f)} onPress={() => open(f)} />
          </ItemMenu></LocationDrop>)}
          {!local.length ? <p className="m-0 px-2.5 py-3 text-detail leading-relaxed text-muted-foreground">Add the folders where you keep your notes.</p> : null}
        </SplitViewSection>
        {browser ? <SplitViewSection title="In This Browser" collapsible>
          <LocationDrop notes={notes} f={browser}><ItemMenu notes={notes} id={browser.id} label="Notes">
            <SplitViewItem id={browser.id} title="Notes" icon={<Icon name="note" size={21} />} badge={notes.count(browser)} onPress={() => open(browser)} />
          </ItemMenu></LocationDrop>
        </SplitViewSection> : null}
        {!notes.files.canOpenFolder ? <p className="px-2.5 pt-4 text-caption leading-relaxed text-muted-foreground">Open in Chrome or Edge to add folders from your Mac.</p> : null}
      </div>
    </SplitViewContent>
    {s.collapsed ? <BottomBar className="justify-end px-3">
      <BarButton label="New note" onPress={() => notes.startCreating('file')}><Icon name="compose" size={24} /></BarButton>
    </BottomBar> : null}
  </SplitViewSidebar>;
}
