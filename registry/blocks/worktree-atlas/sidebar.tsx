/* Projects: every repository found, with its worktree count, under an "All Worktrees" item; then the opened
   folders (for the browser source), each one reconnectable after a restart and removable. Rescan and Add Folder
   sit in the bar; the footer says where the data comes from and what a scan is reading. */
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { SplitViewContent, SplitViewHeader, SplitViewItem, SplitViewSection, SplitViewSidebar, useSplitView } from '@/components/ui/split-view';
import { Icon } from '@/lib/icon';
import { BarButton } from './parts';
import { ALL, type AtlasState } from './use-atlas';

const Count = ({ n }: { n: number }) => <span className="tabular-nums">{n}</span>;

/** `footer`: shown at the bottom right, beside the source's name (the block puts "Open My Folders" there in sample mode). */
export function ProjectsSidebar({ atlas, footer }: { atlas: AtlasState; footer?: ReactNode }) {
  const s = useSplitView();
  const canAdd = !!atlas.source.addLocation;
  return (
    <SplitViewSidebar aria-label="Projects" width={260} minWidth={220}>
      <SplitViewHeader title="Projects" largeTitle={s.collapsed} trailing={<>
        <BarButton label="Scan again" isDisabled={atlas.scanning} onPress={() => void atlas.scan()}><Icon name="arrow-clockwise" size={20} /></BarButton>
        {canAdd ? <BarButton label="Add folder" onPress={() => void atlas.addLocation()}><Icon name="folder-badge-plus" size={22} /></BarButton> : null}
      </>} />
      <SplitViewContent>
        <div className="px-2.5 pb-20">
          <SplitViewSection title="Worktrees">
            <SplitViewItem id={ALL} title="All Worktrees" icon={<Icon name="layers" size={20} />} badge={<Count n={atlas.all.length} />} />
          </SplitViewSection>
          {atlas.projects.length ? (
            <SplitViewSection title="Repositories" collapsible>
              {atlas.projects.map((p) => (
                <SplitViewItem key={p.id} id={p.id} title={p.name} icon={<Icon name="folder" size={20} />}
                  badge={<Count n={p.worktrees.length} />} />
              ))}
            </SplitViewSection>
          ) : null}
          {atlas.locations.length ? (
            <SplitViewSection title="Folders" collapsible>
              {atlas.locations.map((l) => (
                <div key={l.id} className="flex h-10 items-center gap-2.5 rounded-ctl pr-1 pl-2.5 text-subhead">
                  <Icon name={l.connected ? 'internaldrive' : 'lock'} size={18} className="text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate">{l.name}</span>
                  {l.connected ? null : (
                    <Button size="sm" variant="secondary" onPress={() => void atlas.reconnect(l.id)}>Allow</Button>
                  )}
                  <Button variant="quiet" size="icon-sm" aria-label={`Remove ${l.name}`} onPress={() => void atlas.removeLocation(l.id)}>
                    <Icon name="xmark" size={13} sw={2.4} />
                  </Button>
                </div>
              ))}
            </SplitViewSection>
          ) : null}
        </div>
      </SplitViewContent>
      <div className="absolute inset-x-0 bottom-0 flex h-[50px] items-center gap-2 px-4 text-caption text-muted-foreground" aria-live="polite">
        {atlas.scanning ? <>
          <Spinner size={14} label="Scanning" />
          <span className="min-w-0 flex-1 truncate">{atlas.progress?.at ? `Reading ${atlas.progress.at}` : 'Scanning…'}</span>
        </> : <span className="min-w-0 flex-1 truncate">{atlas.source.label}</span>}
        {footer}
      </div>
    </SplitViewSidebar>
  );
}
