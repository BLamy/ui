/* Pull requests tab: the PR list with check status and review state. */
import { useState } from 'react';
import { PR_COUNTS, PULLS } from './data';
import { Box, Oct, PR_STATE, type Layout, type Nav } from './parts';
import { FilterMenus, ItemRow, ListToolbar, StateToggle } from './lists';

export const CHECK_ICON = {
  success: <Oct name="check" className="text-[var(--gh-open)]" />,
  failure: <Oct name="x" className="text-[var(--gh-closed)]" />,
  pending: <span className="mx-1 size-2 rounded-full bg-[var(--gh-attention)]" />,
};
export const REVIEW_TEXT = { approved: 'Approved', changes: 'Changes requested', pending: 'Review required', draft: 'Draft' };

export function PullList({ ui, nav }: { ui: Layout; nav: Nav }) {
  const [state, setState] = useState<'open' | 'closed'>('open');
  const [q, setQ] = useState('');
  const rows = PULLS.filter((p) => (state === 'open' ? p.state === 'open' || p.state === 'draft' : p.state === 'merged' || p.state === 'closed'))
    .filter((p) => !q || p.title.toLowerCase().includes(q.toLowerCase()));
  return (
    <div>
      <ListToolbar ui={ui} nav={nav} q={q} setQ={setQ} placeholder={`is:pr state:${state}`} newLabel="New pull request" />
      <Box header={
        <>
          <StateToggle value={state} onChange={setState} open={PR_COUNTS.open} closed={PR_COUNTS.closed} closedIcon="check" />
          <FilterMenus ui={ui} names={['Author', 'Labels', 'Projects', 'Milestones', 'Reviews', 'Assignee', 'Sort']} onLabel={nav.labels} />
        </>
      }>
        {rows.map((p) => (
          <ItemRow key={p.number} ui={ui} state={PR_STATE[p.state]} title={p.title} labels={p.labels} status={CHECK_ICON[p.checks]}
            onOpen={() => nav.openPr(p.number)} assignees={[p.author]} comments={p.comments}
            meta={<>#{p.number} {p.state === 'merged' ? 'merged' : 'opened'} {p.when} by {p.author.login} · <span className={p.review === 'approved' ? 'text-[var(--gh-open)]' : p.review === 'changes' ? 'text-[var(--gh-closed)]' : ''}>{REVIEW_TEXT[p.review]}</span></>} />
        ))}
      </Box>
    </div>
  );
}
