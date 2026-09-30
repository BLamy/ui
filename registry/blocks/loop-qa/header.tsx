/* Header items shared by every page: the sidebar toggle, and on the trailing edge ⌘K, Share / Settings for a
   project, the primary "Run tests", and the Ask QA toggle. Narrow widths fold the secondary ones into a menu. */
import type { ReactNode } from 'react';
import {
  Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, Icon, SplitViewToggle, cn, useSplitView,
} from '@brett_lamy/ui';
import { BarButton } from './parts';
import { useLoopQA } from './state';

export function Leading() {
  return <SplitViewToggle />;
}

export function PageActions({ run = true, extra }: { run?: boolean; extra?: ReactNode }) {
  const qa = useLoopQA();
  const s = useSplitView();
  const narrow = s.widthClass !== 'regular';
  const running = qa.runs.some((r) => r.status === 'running' && r.projectId === qa.project?.id);
  return (
    <div className="flex items-center gap-1">
      {extra}
      {!narrow ? <BarButton label="Search (⌘K)" icon="magnifyingglass" onPress={() => qa.openPalette()} /> : null}
      {qa.project && !narrow ? (
        <>
          <BarButton label="Share" icon="share" onPress={() => qa.setDialog('share')} />
          <BarButton label="Project settings" icon="gear" onPress={() => qa.setDialog('settings')} />
        </>
      ) : null}
      {qa.project && narrow ? (
        <DropdownMenu>
          <BarButton label="More" icon="ellipsis-circle" />
          <DropdownMenuContent placement="bottom end" onAction={(k) => {
            if (k === 'search') qa.openPalette();
            else if (k === 'share' || k === 'settings' || k === 'tracker') qa.setDialog(k);
            else if (k === 'copy' && qa.project) qa.copyBugReports(qa.project.id);
          }}>
            <DropdownMenuItem id="search" icon={<Icon name="magnifyingglass" size={16} />} shortcut="⌘K">Search</DropdownMenuItem>
            <DropdownMenuItem id="copy" icon={<Icon name="copy" size={16} />}>Copy open bug reports</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem id="share" icon={<Icon name="share" size={16} />}>Share…</DropdownMenuItem>
            <DropdownMenuItem id="tracker" icon={<Icon name="link" size={16} />}>Connect issue tracker…</DropdownMenuItem>
            <DropdownMenuItem id="settings" icon={<Icon name="gear" size={16} />}>Project settings…</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
      {run && qa.project ? (
        <Button
          size="sm"
          className={cn('ml-1 h-8 gap-1.5 rounded-[9px] px-3', s.widthClass === 'compact' && 'w-8 px-0')}
          isDisabled={running}
          aria-label={running ? 'Run in progress' : 'Run tests'}
          onPress={() => qa.project && qa.startRun(qa.project.id, 'Manual')}
        >
          <Icon name="play" size={12} />
          {s.widthClass === 'compact' ? null : running ? 'Running…' : 'Run tests'}
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
      onPress={() => qa.setAskOpen(!qa.askOpen)}
      className={cn('ml-0.5', qa.askOpen && 'bg-primary/12 text-primary data-hovered:bg-primary/16! data-hovered:text-primary')}
    >
      <Icon name="sparkle" size={17} sw={1.9} />
    </BarButton>
  );
}
