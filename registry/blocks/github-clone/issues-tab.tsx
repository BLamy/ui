/* Issues tab: search, label filter, Open/Closed and the issue rows. */
import { useState } from 'react';
import { ISSUES, ISSUE_COUNTS, LABELS } from './data';
import { Box, LabelChip, Oct, type Layout, type Nav } from './parts';
import { FilterMenus, ItemRow, ListToolbar, StateToggle } from './lists';

export function IssueList({ ui, nav, labelFilter }: { ui: Layout; nav: Nav; labelFilter: string[] }) {
  const [state, setState] = useState<'open' | 'closed'>('open');
  const [q, setQ] = useState('');
  const rows = ISSUES.filter((i) => i.state === state)
    .filter((i) => !q || i.title.toLowerCase().includes(q.toLowerCase()))
    .filter((i) => labelFilter.every((l) => i.labels.some((x) => x.name === l)));
  return (
    <div>
      <ListToolbar ui={ui} nav={nav} q={q} setQ={setQ} placeholder={`is:issue state:${state}`} newLabel="New issue" />
      {labelFilter.length ? (
        <div className="mb-3 flex flex-wrap items-center gap-1.5 text-muted-foreground">
          Filtered by {labelFilter.map((l) => <LabelChip key={l} label={Object.values(LABELS).find((x) => x.name === l)!} dark={ui.dark} />)}
        </div>
      ) : null}
      <Box header={
        <>
          <StateToggle value={state} onChange={setState} open={ISSUE_COUNTS.open} closed={ISSUE_COUNTS.closed} closedIcon="check" />
          <FilterMenus ui={ui} names={['Author', 'Labels', 'Projects', 'Milestones', 'Assignee', 'Sort']} onLabel={nav.labels} />
        </>
      }>
        {rows.map((i) => (
          <ItemRow key={i.number} ui={ui} state={i.state === 'open' ? 'open' : 'closed'} title={i.title} labels={i.labels}
            meta={<>#{i.number} {i.state === 'open' ? 'opened' : 'was closed'} {i.when} by {i.author.login}{i.milestone ? <span className="ml-2 inline-flex items-center gap-1"><Oct name="history" size={12} />{i.milestone}</span> : null}</>}
            assignees={i.assignees} comments={i.comments} />
        ))}
        {rows.length === 0 ? <div className="px-4 py-10 text-center text-muted-foreground">No results matched your search.</div> : null}
      </Box>
      <p className="mt-4 text-center text-[12px] text-muted-foreground">
        <b className="font-semibold">ProTip!</b> Add <code className="rounded bg-secondary px-1 font-mono">no:assignee</code> to see everything that’s not assigned.
      </p>
    </div>
  );
}
