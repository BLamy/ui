import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { IconButton } from '@/components/ui/icon-button';
import { Spinner } from '@/components/ui/spinner';
import { SplitViewContent, SplitViewHeader, SplitViewItem, SplitViewSection, SplitViewSidebar, useSplitView } from '@/components/ui/split-view';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { PROJECTS, type Chat } from '../lib/data';
import type { CodexState } from '../lib/use-codex';
import { DotOrb } from './dot-orb';
import { Rail } from './rail';

const WORKSPACES = ['Codex', 'Loop QA', 'Personal'];

/* A selected chat is a soft wash, not the tint. */
const ROW = 'min-h-9 py-1 text-[14px] data-[selected]:bg-secondary data-[selected]:text-foreground';

/** What a thread is doing, at the end of its row: still working, or a branch / pull request open. */
function Status({ status }: { status: Chat['status'] }) {
  if (status === 'running') return <Spinner spin size={14} className="text-muted-foreground" />;
  if (status) return <Icon name="branch" size={14} className={status === 'pr' ? 'text-destructive' : 'text-link'} />;
  return null;
}

const Label = ({ children }: { children: ReactNode }) => <div className="px-2.5 pt-4 pb-1 text-[13px] text-tertiary-foreground">{children}</div>;

/** The icon rail beside the chat list. With `inbox`: New chat, dot's own chat, Priority (chats with replies waiting) and
    the rest. Without: Projects — folders of threads — and Recents. */
export function ChatSidebar({ codex, inbox }: { codex: CodexState; inbox: boolean }) {
  const s = useSplitView();
  const [workspace, setWorkspace] = useState(WORKSPACES[0]);
  const [open, setOpen] = useState<Set<string>>(() => new Set(['loop-qa', 'github-clone']));
  const [all, setAll] = useState<Set<string>>(new Set());
  const { chats, priority } = codex;
  const dot = chats.find((c) => c.id === 'dot');

  const pick = (c: Chat) => () => codex.select(c.id);
  const row = (c: Chat, nested = false) => (
    <SplitViewItem key={c.id} id={c.id} variant="pill" className={cn(ROW, nested && 'pl-8!')} onPress={pick(c)}>
      {c.kind === 'dot' && !nested && <DotOrb size={16} />}
      <span className="min-w-0 flex-1 truncate">{c.title}</span>
      {c.unread > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">{c.unread}</span>}
      <Status status={c.status} />
    </SplitViewItem>
  );

  const waiting = new Set(priority.map((c) => c.id));
  const dots = chats.filter((c) => c.kind === 'dot' && c.id !== 'dot');
  const threads = chats.filter((c) => c.kind === 'thread');

  const withInbox = (
    <>
      <SplitViewSection title="Priority" collapsible defaultExpanded>
        {priority.length ? priority.map((c) => row(c)) : <div className="px-2.5 py-1.5 text-[13px] text-tertiary-foreground">Nothing needs attention</div>}
      </SplitViewSection>
      <SplitViewSection title="Chats" collapsible defaultExpanded>
        {[...dots, ...threads].filter((c) => !waiting.has(c.id)).map((c) => row(c))}
      </SplitViewSection>
    </>
  );

  const toggle = (set: Set<string>, id: string) => new Set(set.has(id) ? [...set].filter((x) => x !== id) : [...set, id]);
  const withoutInbox = (
    <>
      <Label>Projects</Label>
      {PROJECTS.map((p) => {
        const list = threads.filter((c) => c.project === p);
        const expanded = open.has(p);
        const shown = all.has(p) ? list : list.slice(0, 5);
        return (
          <div key={p}>
            <Button variant="ghost" aria-expanded={expanded} onPress={() => setOpen((o) => toggle(o, p))} className="h-9 w-full justify-start gap-2.5 rounded-[10px] px-2.5 text-[14px] font-normal">
              <Icon name={expanded ? 'folder-fill' : 'folder'} size={16} className="text-muted-foreground" />
              {p}
            </Button>
            {expanded && shown.map((c) => row(c, true))}
            {expanded && list.length > shown.length && (
              <Button variant="ghost" onPress={() => setAll((a) => toggle(a, p))} className="h-8 w-full justify-start rounded-[10px] pl-8! text-[14px] font-normal text-tertiary-foreground">
                Show more
              </Button>
            )}
          </div>
        );
      })}
      <Label>Recents</Label>
      {[...dots, ...threads]
        .filter((c) => c.recent != null || c.kind === 'dot')
        .sort((a, b) => (a.recent ?? 99) - (b.recent ?? 99))
        .map((c) => row(c))}
    </>
  );

  return (
    <SplitViewSidebar aria-label="Chats" width={300} minWidth={260} maxWidth={380}>
      <div className="flex min-h-0 flex-1">
        {!s.collapsed && <Rail />}
        <div className="flex min-w-0 flex-1 flex-col">
          <SplitViewHeader
            largeTitle={s.collapsed}
            title={s.collapsed ? 'Chats' : undefined}
            leading={
              <DropdownMenu>
                <Button variant="ghost" aria-label="Workspace" className="h-8 gap-1 rounded-lg px-2 text-[16px] font-semibold data-hovered:bg-secondary">
                  {workspace}
                  <Icon name="chevron-down" size={12} sw={2.4} className="text-muted-foreground" />
                </Button>
                <DropdownMenuContent aria-label="Workspaces" placement="bottom start" selectionMode="single" selectedKeys={[workspace]} onAction={(k) => setWorkspace(String(k))}>
                  {WORKSPACES.map((w) => (
                    <DropdownMenuItem key={w} id={w}>
                      {w}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            }
            trailing={
              <>
                <IconButton name="bell" label="Notifications" size={17} />
                <IconButton name="magnifyingglass" label="Search" size={17} />
              </>
            }
          />
          <SplitViewContent>
            <div className="px-2 pb-6">
              <Button variant="ghost" onPress={() => { codex.newChat(); s.show('supplementary'); }} className="h-9 w-full justify-start gap-2.5 rounded-[10px] px-2.5 text-[14px] font-normal">
                <Icon name="compose" size={16} className="text-muted-foreground" />
                New chat
              </Button>
              {dot && row(dot)}
              {inbox ? withInbox : withoutInbox}
            </div>
          </SplitViewContent>
        </div>
      </div>
    </SplitViewSidebar>
  );
}
