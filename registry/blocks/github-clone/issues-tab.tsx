/* Issues tab: search, label filter, Open/Closed and the issue rows; an issue opens to its conversation (the same Thread
   pull requests use), where the composer posts real comments with live data. Live lists are GitHub's 50 newest per
   state; the search box filters what's loaded. */
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { labelOf } from './github-api';
import { Box, LabelChip, Oct, StatePill, type Layout, type Nav } from './parts';
import { FilterMenus, ItemRow, ListToolbar, StateToggle } from './lists';
import { Thread } from './pull-request';
import { Loaded, useLoad, useRepo } from './repo-context';

export function IssueList({ ui, nav, labelFilter }: { ui: Layout; nav: Nav; labelFilter: string[] }) {
  const { source } = useRepo();
  const [state, setState] = useState<'open' | 'closed'>('open');
  const [q, setQ] = useState('');
  const issues = useLoad(`${source.id}:issues:${state}`, () => source.issues(state));
  const counts = useLoad(source.id + ':counts', source.counts).data;
  const labels = useLoad(source.id + ':labels', source.labels).data ?? [];
  return (
    <div>
      <ListToolbar ui={ui} nav={nav} q={q} setQ={setQ} placeholder={`is:issue state:${state}`} newLabel="New issue" />
      {labelFilter.length ? (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 text-muted-foreground">
          Filtered by {labelFilter.map((l) => <LabelChip key={l} label={labels.find((x) => x.name === l) ?? labelOf(l)} dark={ui.dark} />)}
        </div>
      ) : null}
      <Box header={
        <>
          <StateToggle value={state} onChange={setState} open={counts?.issues.open} closed={counts?.issues.closed} closedIcon="check" />
          <FilterMenus ui={ui} names={['Author', 'Labels', 'Projects', 'Milestones', 'Assignee', 'Sort']} onLabel={nav.labels} />
        </>
      }>
        <Loaded load={issues} className="rounded-none border-0">
          {(list) => {
            const rows = list
              .filter((i) => !q || i.title.toLowerCase().includes(q.toLowerCase()))
              .filter((i) => labelFilter.every((l) => i.labels.some((x) => x.name === l)));
            return (
              <>
                {rows.map((i) => (
                  <ItemRow key={i.number} ui={ui} state={i.state === 'open' ? 'open' : 'closed'} title={i.title} labels={i.labels} onOpen={() => nav.openIssue(i.number)}
                    meta={<>#{i.number} {i.state === 'open' ? 'opened' : 'was closed'} {i.when} by {i.author.login}{i.milestone ? <span className="ml-2 inline-flex items-center gap-1"><Oct name="history" size={12} />{i.milestone}</span> : null}</>}
                    assignees={i.assignees} comments={i.comments} />
                ))}
                {rows.length === 0 ? <div className="px-4 py-10 text-center text-muted-foreground">{list.length ? 'No results matched your search.' : `No ${state} issues.`}</div> : null}
              </>
            );
          }}
        </Loaded>
      </Box>
      <p className="mt-4 text-center text-caption text-muted-foreground">
        <b className="font-semibold">ProTip!</b> Add <code className="rounded bg-secondary px-1 font-mono">no:assignee</code> to see everything that’s not assigned.
      </p>
    </div>
  );
}

/** One issue: title, state, and its conversation with the composer. */
export function IssueView({ ui, number, nav }: { ui: Layout; number: number; nav: Nav }) {
  const { source } = useRepo();
  const issue = useLoad(`${source.id}:issue:${number}`, () => source.issue(number));
  return (
    <div className={cn(ui.phone && 'px-4 py-4')}>
      {!ui.phone ? (
        <button type="button" onClick={() => nav.openIssue(null)} className="mb-3 flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-detail text-primary hover:underline">
          <Oct name="chevLeft" size={14} />Issues
        </button>
      ) : null}
      <Loaded load={issue}>
        {(i) => (
          <>
            <h1 className={cn('m-0 leading-tight font-normal', ui.phone ? 'text-[22px]' : 'text-[32px]')}>
              {i.title} <span className="font-light text-muted-foreground">#{i.number}</span>
            </h1>
            <div className="mt-3 mb-2 flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-border pb-4 text-muted-foreground">
              <StatePill state={i.state === 'open' ? 'open' : 'closed'} />
              <span className="leading-6"><b className="font-semibold text-foreground">{i.author.login}</b> opened this issue {i.when} · {i.comments} comment{i.comments === 1 ? '' : 's'}</span>
              {i.labels.map((l) => <LabelChip key={l.name} label={l} dark={ui.dark} />)}
            </div>
            <Thread ui={ui} number={i.number} authorLogin={i.author.login}
              closeLabel={i.state === 'open' ? <><Oct name="issueClosed" className="text-[var(--gh-done)]" />Close issue</> : null} />
          </>
        )}
      </Loaded>
    </div>
  );
}
