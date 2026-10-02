/* Bugs: Linear-style filters (a FilterBar: severity, status, kind, environment as chips with their own operator and
   value; a sentence in the FilterInput becomes chips), a search, and the bulk actions (copy every report as Markdown, download them, connect an issue tracker). The
   table's rows open the bug; the status column is a menu of its own. Narrow containers stack each row. */
import { useMemo, useState, type CSSProperties, type Key } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { FilterBar, FilterToolbar } from '@/components/ui/filter';
import { FilterInput } from '@/components/ui/filter-input';
import { SearchField } from '@/components/ui/search-field';
import { matchFilters, serializeFilters, type Filter, type FilterField } from '@/lib/filter';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import {
  ENVIRONMENTS, KINDS, SEVERITIES, SEVERITY_LABEL, STATUSES, STATUS_LABEL, bugReport, relativeTime, severityRank,
  type Bug, type BugStatus, type Project,
} from './data';
import { EnvBadge, Empty, KindLabel, SEVERITY_COLOR, STATUS_TONE, SeverityBadge, pillVariants, Pressable } from './parts';
import { useLoopQA } from './state';

const FIELDS: FilterField[] = [
  { id: 'severity', label: 'Severity', icon: 'flag', kind: 'select', options: SEVERITIES.map((s) => ({ value: s, label: SEVERITY_LABEL[s], color: SEVERITY_COLOR[s] })) },
  { id: 'status', label: 'Status', icon: 'circle', kind: 'select', options: STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] })) },
  { id: 'kind', label: 'Kind', icon: 'tag', kind: 'select', options: KINDS.map((k) => ({ value: k, label: k })) },
  { id: 'environment', label: 'Environment', icon: 'globe', kind: 'select', options: ENVIRONMENTS.map((e) => ({ value: e, label: e })) },
];
/** Open work by default: the same three statuses the old Status menu started with. */
const defaultFilters = (): Filter[] => [{ id: 'default-status', field: 'status', operator: 'is_any_of', value: ['open', 'confirmed', 'unconfirmed'] }];

export function BugsTab({ project }: { project: Project }) {
  const qa = useLoopQA();
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filter[]>(defaultFilters);
  const all = qa.bugs.filter((b) => b.projectId === project.id);
  const shown = useMemo(() => matchFilters(all, filters, FIELDS, (b, field) => b[field as 'severity' | 'status' | 'kind' | 'environment'])
    .filter((b) => !query || `${b.id} ${b.title} ${b.journey}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || b.discovered.localeCompare(a.discovered) || b.id.localeCompare(a.id)),
  [all, filters, query]);
  const download = () => {
    const text = shown.map((b) => bugReport(b, project)).join('\n\n---\n\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${project.id}-bugs.md` });
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    qa.toast.hud(`Downloaded ${shown.length} reports`, { tone: 'success' });
  };
  const filtered = serializeFilters(filters) !== serializeFilters(defaultFilters());

  return (
    <FilterBar fields={FIELDS} value={filters} onValueChange={setFilters} className="gap-3.5">
      <div className="flex flex-wrap items-center gap-2">
        <FilterToolbar />
        {filtered ? (
          <Button size="sm" variant="ghost" className="h-8 rounded-[9px] px-2.5 text-[12.5px] text-muted-foreground" onPress={() => setFilters(defaultFilters())}>
            Reset
          </Button>
        ) : null}
        <SearchField aria-label="Search bugs" placeholder="Search bugs" value={query} onChange={setQuery} className="max-w-[260px] min-w-[160px] flex-1" />
        <span className="flex-1" />
        <div className="flex gap-1.5">
          <Button size="sm" variant="secondary" className="h-8 rounded-[9px]" onPress={() => qa.copyBugReports(project.id)}>
            <Icon name="copy" size={14} sw={2} /><span className="hidden @2xl:inline!">Copy reports</span>
          </Button>
          <Button size="sm" variant="secondary" className="h-8 rounded-[9px]" onPress={download} aria-label="Download reports">
            <Icon name="download" size={14} sw={2} /><span className="hidden @4xl:inline!">Download</span>
          </Button>
          <Button size="sm" variant="secondary" className="h-8 rounded-[9px]" onPress={() => qa.setDialog('tracker')}
            aria-label={qa.trackers.length ? 'Issue tracker connected' : 'Connect issue tracker'}>
            <Icon name={qa.trackers.length ? 'checkmark-circle' : 'link'} size={14} sw={2} className={qa.trackers.length ? 'text-success' : undefined} />
            <span className="hidden @4xl:inline!">{qa.trackers.length ? 'Tracker connected' : 'Connect tracker'}</span>
          </Button>
        </div>
      </div>
      <FilterInput className="max-w-xl" placeholder="Describe what you want, e.g. critical bugs in production" />

      <div className="overflow-hidden rounded-card border border-border bg-card">
        <div role="row" className="hidden grid-cols-[92px_1fr_128px_128px_112px_72px] items-center gap-3 border-b border-border bg-muted px-4 py-2 text-caption2 font-semibold tracking-[.06em] text-muted-foreground uppercase @4xl:grid!">
          <span>Severity</span><span>Bug</span><span>Status</span><span>Kind</span><span>Environment</span><span className="text-right">Found</span>
        </div>
        {shown.length ? (
          <ul className="m-0 list-none p-0" aria-label="Bugs">
            {shown.map((b) => <BugRow key={b.id} bug={b} />)}
          </ul>
        ) : (
          <Empty icon="checkmark-circle" title={all.length ? 'No bugs match' : 'No bugs found'} text={all.length ? 'Try clearing a filter or the search.' : 'Loop QA hasn’t found anything in this project yet.'} />
        )}
      </div>
      <div className="text-caption text-muted-foreground">{shown.length} of {all.length} bugs</div>
    </FilterBar>
  );
}

function BugRow({ bug: b }: { bug: Bug }) {
  const qa = useLoopQA();
  return (
    <li className="group/row relative grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1.5 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted! @4xl:grid-cols-[92px_1fr_128px_128px_112px_72px]! @4xl:py-2.5!">
      {/* The row's action covers it; the status menu sits above it. */}
      <Pressable aria-label={`${b.id}: ${b.title}`} onPress={() => qa.open({ kind: 'bug', id: b.id })}
        className="absolute inset-0 z-0 cursor-pointer rounded-none bg-transparent data-pressed:not-aria-expanded:scale-100 data-focus-visible:ring-inset" />
      <span className="pointer-events-none relative hidden @4xl:block!"><SeverityBadge severity={b.severity} /></span>
      <span className="pointer-events-none relative min-w-0">
        <span className="flex items-center gap-2 @4xl:hidden!">
          <span className="size-2 shrink-0 rounded-full bg-(--c)" style={{ '--c': SEVERITY_COLOR[b.severity] } as CSSProperties} />
          <span className="text-[11.5px] font-semibold text-muted-foreground">{SEVERITY_LABEL[b.severity]}</span>
          <span className="font-mono text-[11.5px] text-tertiary-foreground">{b.id}</span>
        </span>
        <span className="line-clamp-2 text-[13.5px] leading-[19px] font-medium @4xl:line-clamp-1!">{b.title}</span>
        <span className="mt-0.5 hidden truncate text-caption text-muted-foreground @4xl:block!"><span className="font-mono">{b.id}</span> · {b.journey}</span>
      </span>
      <span className="relative z-10 row-span-2 self-start @4xl:row-span-1! @4xl:self-center!"><StatusMenu bug={b} /></span>
      <span className="pointer-events-none relative flex items-center gap-2 @4xl:contents!">
        <span className="relative @4xl:block!"><KindLabel kind={b.kind} /></span>
        <span className="relative @4xl:block!"><EnvBadge env={b.environment} /></span>
        <span className="relative text-right text-caption text-muted-foreground tabular-nums">{relativeTime(b.discovered)}</span>
      </span>
    </li>
  );
}

/** The bug's status as a pill that opens a menu. */
export function StatusMenu({ bug: b, className }: { bug: Bug; className?: string }) {
  const qa = useLoopQA();
  return (
    <DropdownMenu>
      <Pressable aria-label={`Status: ${STATUS_LABEL[b.status]}`} className={cn('h-auto cursor-pointer gap-0.5 rounded-full p-0 data-pressed:not-aria-expanded:scale-95', className)}>
        <span className={pillVariants({ tone: STATUS_TONE[b.status] })}>
          <span className="size-1.5 rounded-full bg-current" />
          {STATUS_LABEL[b.status]}
          <Icon name="chevron-down" size={10} sw={2.6} className="-ml-0.5 opacity-70" />
        </span>
      </Pressable>
      <DropdownMenuContent
        placement="bottom end"
        selectionMode="single"
        selectedKeys={[b.status]}
        onSelectionChange={(keys) => {
          const next = [...(keys as Set<Key>)][0] as BugStatus | undefined;
          if (next && next !== b.status) {
            qa.setBugStatus(b.id, next);
            qa.toast.hud(`${b.id} → ${STATUS_LABEL[next]}`);
          }
        }}
      >
        {STATUSES.map((s) => <DropdownMenuItem key={s} id={s}>{STATUS_LABEL[s]}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
