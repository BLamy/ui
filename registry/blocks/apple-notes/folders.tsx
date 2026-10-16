import { SplitViewContent, SplitViewHeader, SplitViewItem, SplitViewSection, SplitViewSidebar, useSplitView } from '@/components/ui/split-view';
import { Icon } from '@/lib/icon';
import { ROOT_FOLDER } from './data';
import { BarButton, BottomBar } from './parts';
import type { NotesState } from './use-notes';

/** The sidebar contains the user's folder locations. Add Folder opens the Mac directory picker. */
export function FoldersSidebar({ notes }: { notes: NotesState }) {
  const s = useSplitView();
  const roots = notes.files.folders.filter((f) => f.parent === ROOT_FOLDER.id);
  const local = roots.filter((f) => f.source === 'local');
  const browser = roots.find((f) => f.source === 'browser');
  return <SplitViewSidebar aria-label="Folders" width={240} minWidth={200}>
    <SplitViewHeader title="Folders" largeTitle={s.collapsed} />
    <SplitViewContent>
      <div className="px-2.5 pb-16">
        <SplitViewItem id={ROOT_FOLDER.id} title="All Folders" icon={<Icon name="folder" size={21} />} onPress={() => notes.openFolder(ROOT_FOLDER.id)} />
        <SplitViewSection title="On My Mac" collapsible>
          {local.map((f) => <SplitViewItem key={f.id} id={f.id} title={f.title}
            subtitle={f.connected === false ? 'Reconnect folder' : undefined}
            icon={<Icon name="folder" size={21} />} badge={notes.count(f)} onPress={() => notes.openFolder(f.id)} />)}
          {!local.length ? <p className="m-0 px-2.5 py-3 text-detail leading-relaxed text-muted-foreground">Add the folders where you keep your notes.</p> : null}
        </SplitViewSection>
        {browser ? <SplitViewSection title="In This Browser" collapsible>
          <SplitViewItem id={browser.id} title="Notes" icon={<Icon name="note" size={21} />} badge={notes.count(browser)} onPress={() => notes.openFolder(browser.id)} />
        </SplitViewSection> : null}
        {!notes.files.canOpenFolder ? <p className="px-2.5 pt-4 text-caption leading-relaxed text-muted-foreground">Open in Chrome or Edge to add folders from your Mac.</p> : null}
      </div>
    </SplitViewContent>
    <BottomBar>
      <BarButton label="Add Folder…" isDisabled={!notes.files.canOpenFolder || notes.files.busy} className="w-auto gap-2 px-2"
        onPress={() => { void notes.addFolder().then((id) => { if (id && s.collapsed) s.show('supplementary'); }); }}>
        <Icon name="folder-badge-plus" size={21} /><span className="text-detail">Add Folder…</span>
      </BarButton>
    </BottomBar>
  </SplitViewSidebar>;
}
