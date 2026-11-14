/* Header items shared by every page: the sidebar toggle, and on the trailing edge ⌘K, Share / Settings for a
   project, the primary "Run tests", and the Ask QA toggle. Narrow widths fold the secondary ones into a menu. */
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SplitViewToggle, useSplitView } from '@/components/ui/split-view';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { BarButton } from './parts';
import { useLoopQA } from './state';

export function Leading() {
  return <SplitViewToggle />;
}

export function PageActions({ run = true, extra }: { run?: boolean; extra?: ReactNode }) {
  const qa = useLoopQA();
  const s = useSplitView();
  const narrow = s.sizeClass !== 'regular';
  const running = qa.runs.some((r) => r.status === 'running' && r.projectId === qa.project?.id);
  return (
    <div className="flex items-center gap-1">
      {extra}
      {!narrow ? <BarButton label="Search (⌘K)" icon="magnifyingglass" onClick={() => qa.openPalette()} /> : null}
      {qa.project && !narrow ? (
        <>
          <BarButton label="Share" icon="share" onClick={() => qa.setDialog('share')} />
          <BarButton label="Project settings" icon="gear" onClick={() => qa.setDialog('settings')} />
        </>
      ) : null}
      {qa.project && narrow ? (
        <DropdownMenu onAction={(k) => {
          if (k === 'search') qa.openPalette();
          else if (k === 'share' || k === 'settings' || k === 'tracker') qa.setDialog(k);
          else if (k === 'copy' && qa.project) qa.copyBugReports(qa.project.id);
        }}>
          <BarButton label="More" icon="ellipsis-circle" render={<DropdownMenuTrigger />} />
          <DropdownMenuContent side="bottom" align="end">
            <DropdownMenuItem value="search" icon={<Icon name="magnifyingglass" size={16} />} shortcut="mod+k">Search</DropdownMenuItem>
            <DropdownMenuItem value="copy" icon={<Icon name="copy" size={16} />}>Copy open bug reports</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem value="share" icon={<Icon name="share" size={16} />}>Share…</DropdownMenuItem>
            <DropdownMenuItem value="tracker" icon={<Icon name="link" size={16} />}>Connect issue tracker…</DropdownMenuItem>
            <DropdownMenuItem value="settings" icon={<Icon name="gear" size={16} />}>Project settings…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {run && qa.project ? (
        <Button
          size="sm"
          className={cn('ml-1 h-8 gap-1.5 rounded-[9px] px-3', s.sizeClass === 'compact' && 'w-8 px-0')}
          disabled={running}
          aria-label={running ? 'Run in progress' : 'Run tests'}
          onClick={() => qa.project && qa.startRun(qa.project.id, 'Manual')}
        >
          <Icon name="play" size={12} />
          {s.sizeClass === 'compact' ? null : running ? 'Running…' : 'Run tests'}
        </Button>
      ) : null}
      <AskToggle />
    </div>
  );
}

export function AskToggle() {
  const qa = useLoopQA();
  return (
    <BarButton
      label={qa.askOpen ? 'Hide Ask QA (⌘J)' : 'Ask QA (⌘J)'}
      onClick={() => qa.setAskOpen(!qa.askOpen)}
      className={cn('ml-0.5', qa.askOpen && 'bg-primary/12 text-primary hover:bg-primary/16! hover:text-primary')}
    >
      <Icon name="sparkle" size={17} sw={1.9} />
    </BarButton>
  );
}
