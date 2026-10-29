/* Pull requests tab: the PR list with check status and review state (live lists come from search, which doesn't say
   either, so those rows show them only once the PR is opened). */
import { useState } from 'react';
import { Box, Oct, PR_STATE, type Layout, type Nav } from './parts';
import { FilterMenus, ItemRow, ListToolbar, StateToggle } from './lists';
import { Loaded, useLoad, useRepo } from './repo-context';

export const CHECK_ICON = {
  success: <Oct name="check" className="text-[var(--gh-open)]" />,
  failure: <Oct name="x" className="text-[var(--gh-closed)]" />,
  pending: <span className="mx-1 size-2 rounded-full bg-[var(--gh-attention)]" />,
};
export const REVIEW_TEXT = { approved: 'Approved', changes: 'Changes requested', pending: 'Review required', draft: 'Draft' };

export function PullList({ ui, nav }: { ui: Layout; nav: Nav }) {
  const { source } = useRepo();
  const [state, setState] = useState<'open' | 'closed'>('open');
  const [q, setQ] = useState('');
  const pulls = useLoad(`${source.id}:pulls:${state}`, () => source.pulls(state));
  const counts = useLoad(source.id + ':counts', source.counts).data;
  return (
    <div>
      <ListToolbar ui={ui} nav={nav} q={q} setQ={setQ} placeholder={`is:pr state:${state}`} newLabel="New pull request" />
      <Box header={
        <>
          <StateToggle value={state} onChange={setState} open={counts?.pulls.open} closed={counts?.pulls.closed} closedIcon="check" />
          <FilterMenus ui={ui} names={['Author', 'Labels', 'Projects', 'Milestones', 'Reviews', 'Assignee', 'Sort']} onLabel={nav.labels} />
        </>
      }>
        <Loaded load={pulls} className="rounded-none border-0">
          {(list) => {
            const rows = list.filter((p) => !q || p.title.toLowerCase().includes(q.toLowerCase()));
            return (
              <>
                {rows.map((p) => (
                  <ItemRow key={p.number} ui={ui} state={PR_STATE[p.state]} title={p.title} labels={p.labels} status={p.checks ? CHECK_ICON[p.checks] : undefined}
                    onOpen={() => nav.openPr(p.number)} assignees={[p.author]} comments={p.comments}
                    meta={<>#{p.number} {p.state === 'merged' ? 'merged' : p.state === 'closed' ? 'was closed' : 'opened'} {p.when} by {p.author.login}{p.review ? <> · <span className={p.review === 'approved' ? 'text-[var(--gh-open)]' : p.review === 'changes' ? 'text-[var(--gh-closed)]' : ''}>{REVIEW_TEXT[p.review]}</span></> : null}</>} />
                ))}
                {rows.length === 0 ? <div className="px-4 py-10 text-center text-muted-foreground">{list.length ? 'No results matched your search.' : `No ${state} pull requests.`}</div> : null}
              </>
            );
          }}
        </Loaded>
      </Box>
    </div>
  );
}
