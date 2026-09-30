/* The sidebar: the mark, a search field that opens ⌘K, All projects, every project with its open-bug count (a
   spinner while a run is live on it), and a footer with the credit meter, notifications and the account. Tiled at
   regular width, floating over the page on a tablet, the root of the stack on a phone. */
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { NumberMorph } from '@/components/ui/number-morph';
import { PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { SplitViewContent, SplitViewHeader, SplitViewItem, SplitViewSection, SplitViewSidebar, useSplitView } from '@/components/ui/split-view';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import type { CSSProperties } from 'react';
import { isOpen } from './agent';
import { CREDITS, ME, NOTIFICATIONS, PROJECTS, relativeTime } from './data';
import { Avatar, BarButton, LoopMark, Pressable } from './parts';
import { useLoopQA } from './state';

/** Selection is a quiet wash with the label in full ink, not a solid tint: the page, not the nav, carries color. */
const SELECTED = { background: 'color-mix(in oklab, var(--foreground) 8%, transparent)', foreground: 'var(--foreground)' };

export function AppSidebar() {
  const qa = useLoopQA();
  const s = useSplitView();
  const openCount = (id: string) => qa.bugs.filter((b) => b.projectId === id && isOpen(b)).length;
  const total = qa.bugs.filter(isOpen).length;
  const live = new Set(qa.runs.filter((r) => r.status === 'running').map((r) => r.projectId));
  return (
    <SplitViewSidebar aria-label="Projects" width={264} minWidth={220} maxWidth={340}>
      <SplitViewHeader
        title={s.collapsed ? 'Loop QA' : undefined}
        largeTitle={s.collapsed}
        leading={s.collapsed ? null : (
          <span className="flex items-center gap-2 pl-1.5 text-subhead font-semibold tracking-[-.02em]">
            <LoopMark size={24} />Loop QA
          </span>
        )}
        trailing={<BarButton label="New project" icon="plus" onPress={() => qa.setDialog('new-project')} />}
      />
      <SplitViewContent>
        <div className="flex flex-col gap-3 px-2.5 pb-4">
          <Pressable
            onPress={() => qa.openPalette()}
            className="flex h-9 cursor-pointer items-center justify-start gap-2 rounded-ctl border-0 bg-secondary px-2.5 text-left text-[13.5px] text-tertiary-foreground outline-none transition-[background-color]  data-focus-visible:ring-2 data-focus-visible:ring-ring"
          >
            <Icon name="magnifyingglass" size={15} sw={2} />
            <span className="flex-1">Search or jump to…</span>
            <KbdGroup><Kbd>⌘</Kbd><Kbd>K</Kbd></KbdGroup>
          </Pressable>
          <div className="flex flex-col gap-px">
            <SplitViewItem id="projects" tint={SELECTED} title="All projects" icon={<span className="grid text-muted-foreground"><Icon name="grid" size={18} /></span>} badge={<NumberMorph value={total} />} />
          </div>
          <SplitViewSection title="Projects" collapsible>
            {PROJECTS.map((p) => (
              <SplitViewItem
                key={p.id}
                id={p.id}
                tint={SELECTED}
                title={<span className={cn(p.status === 'paused' && 'text-muted-foreground')}>{p.name}</span>}
                icon={<span className="grid size-[18px] place-items-center"><span className="size-2.5 rounded-sm bg-(--brand)" style={{ '--brand': p.brand } as CSSProperties} /></span>}
                badge={live.has(p.id) ? <Spinner size={13} /> : openCount(p.id) ? <NumberMorph value={openCount(p.id)} /> : null}
              />
            ))}
          </SplitViewSection>
        </div>
      </SplitViewContent>
      <SidebarFooter />
    </SplitViewSidebar>
  );
}

function SidebarFooter() {
  const pct = CREDITS.used / CREDITS.total;
  return (
    <div className="flex shrink-0 flex-col gap-2 border-t border-border px-2.5 pt-2.5 pb-3">
      <PopoverTrigger>
        <Pressable className="flex cursor-pointer flex-col items-stretch gap-1.5 rounded-ctl border-0 bg-transparent px-2 py-1.5 text-left outline-none  data-focus-visible:ring-2 data-focus-visible:ring-ring">
          <span className="flex w-full items-center justify-between text-caption">
            <span className="font-medium">Credits</span>
            <span className="text-muted-foreground tabular-nums">{Math.round(CREDITS.total - CREDITS.used).toLocaleString('en-US')} left</span>
          </span>
          <span className="h-1 w-full overflow-hidden rounded-full bg-secondary">
            <span className="block h-full w-(--w) rounded-full bg-primary" style={{ '--w': `${pct * 100}%` } as CSSProperties} />
          </span>
        </Pressable>
        <PopoverContent placement="top start" aria-label="Credits" className="w-64">
          <div className="text-footnote font-semibold">{ME.plan} plan</div>
          <div className="mt-1 text-[24px] font-semibold tracking-[-.02em] tabular-nums">{CREDITS.used.toLocaleString('en-US')}<span className="text-footnote font-normal text-muted-foreground"> / {CREDITS.total.toLocaleString('en-US')}</span></div>
          <div className="mt-0.5 text-caption text-muted-foreground">credits used · renews {CREDITS.renews}</div>
          <div className="mt-3 grid gap-1.5 text-[12.5px]">
            {[['Test runs', 2_410], ['Explorations', 702.5], ['Ask QA', 306]].map(([k, v]) => (
              <div key={k} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="tabular-nums">{Number(v).toLocaleString('en-US')}</span></div>
            ))}
          </div>
        </PopoverContent>
      </PopoverTrigger>
      <div className="flex items-center gap-2 px-1">
        <Avatar initials={ME.initials} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-footnote font-medium">{ME.name}</div>
          <div className="truncate text-[11.5px] text-muted-foreground">{ME.email}</div>
        </div>
        <Notifications />
      </div>
    </div>
  );
}

function Notifications() {
  return (
    <PopoverTrigger>
      <BarButton label="Notifications">
        <span className="relative inline-grid">
          <Icon name="bell" size={17} sw={1.9} />
          <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary ring-2 ring-sidebar" />
        </span>
      </BarButton>
      <PopoverContent placement="top end" aria-label="Notifications" className="w-80 p-0 [&>[data-slot=popover-content]]:p-0">
        <div className="border-b border-border px-4 py-3 text-footnote font-semibold">Notifications</div>
        <ul className="m-0 list-none p-1.5">
          {NOTIFICATIONS.map((n) => (
            <li key={n.id} className="flex gap-3 rounded-ctl px-2.5 py-2">
              <span className={cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-full', n.kind === 'bug' ? 'bg-destructive/12 text-destructive' : n.kind === 'run' ? 'bg-success/13 text-success' : 'bg-(--lq-info)/13 text-(--lq-info)')}>
                <Icon name={n.kind === 'bug' ? 'exclamation-circle' : n.kind === 'run' ? 'check' : 'person'} size={14} sw={2.2} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-footnote font-medium">{n.title}</span>
                <span className="block truncate text-caption text-muted-foreground">{n.detail}</span>
              </span>
              <span className="shrink-0 text-caption2 text-tertiary-foreground">{relativeTime(n.when)}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </PopoverTrigger>
  );
}
