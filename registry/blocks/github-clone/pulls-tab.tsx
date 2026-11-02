/* Pull requests list: the same query box and menus as issues plus Reviews, each row with its real check and review state
   (one GraphQL query fills them all in, since search doesn't say). */
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ActiveFilters, FilterMenus, ItemRow, ListToolbar, Pagination, StateToggle, queryState, setQualifier, setQueryState } from './lists';
import { Box, Oct, PR_STATE } from './parts';
import { DEFAULT_PULL_Q } from './route';
import { Loaded, useCan, useLoad, useNav, useRepo } from './repo-context';

const CHECK_ICON = {
  success: [<Oct key="s" name="check" className="text-(--gh-open)" />, 'Checks passing'],
  failure: [<Oct key="f" name="x" className="text-(--gh-closed)" />, 'Checks failing'],
  pending: [<span key="p" className="mx-1 size-2 rounded-full bg-(--gh-attention)" />, 'Checks in progress'],
} as const;
const REVIEW_TEXT = { approved: 'Approved', changes: 'Changes requested', pending: 'Review required', draft: 'Draft' };
const STATE_TEXT = { open: 'Open', draft: 'Draft', merged: 'Merged', closed: 'Closed' };

export function PullList({ q, page = 1 }: { q?: string; page?: number }) {
  const { source, repo } = useRepo();
  const nav = useNav();
  const can = useCan();
  const query = q ?? DEFAULT_PULL_Q;
  const go = (next: string, p?: number) => nav.go({ s: 'pulls', q: next, page: p });
  const pulls = useLoad(`${source.id}:pulls:${query}:${page}`, () => source.searchPulls(query, page));
  const counts = useLoad(source.id + ':counts', source.counts).data;
  const labels = useLoad(source.id + ':labels', source.labels).data ?? [];
  const state = queryState(query);
  const filtered = !/^\s*is:(open|closed)\s*$/.test(query);
  return (
    <div>
      <h1 className="sr-only">Pull requests</h1>
      <ListToolbar query={query} onQuery={(x) => go(x)} placeholder="Search all pull requests" canCreate={!repo.archived && !repo.empty && can.signedIn} newLabel="New pull request" onNew={() => nav.go({ s: 'compare' })} />
      <ActiveFilters query={query} base={DEFAULT_PULL_Q} onQuery={(x) => go(x)} labels={labels} />
      <Box header={
        <div className="flex w-full flex-wrap items-center gap-x-2">
          <StateToggle value={state === 'merged' ? 'closed' : state} onChange={(v) => go(setQueryState(query, v))} open={filtered ? undefined : counts?.pulls.open} closed={filtered ? undefined : counts?.pulls.closed} closedIcon="check" />
          <Button aria-pressed={state === 'merged'} onPress={() => go(setQueryState(query, 'merged'))}
            className={cn('flex cursor-pointer items-center gap-1.5 rounded-md border-0 bg-transparent px-2 py-1 text-detail outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary data-hovered:bg-secondary group-data-[phone=true]/gh:min-h-11', state === 'merged' ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
            <Oct name="merged" />Merged
          </Button>
          {filtered && pulls.data?.total != null ? <span className="text-caption text-muted-foreground" role="status">{pulls.data.total.toLocaleString('en-US')} result{pulls.data.total === 1 ? '' : 's'}</span> : null}
          <FilterMenus query={query} onQuery={(x) => go(x)} reviews />
        </div>
      }>
        <Loaded load={pulls} className="rounded-none border-0">
          {(data) => (
            <div className={cn(pulls.loading && 'opacity-70')} aria-busy={pulls.loading}>
              {data.items.map((p) => (
                <ItemRow key={p.number} state={PR_STATE[p.state]} stateText={STATE_TEXT[p.state]} title={p.title} labels={p.labels} to={{ s: 'pull', n: p.number }} onLabel={(l) => go(setQualifier(query, 'label', [l]))}
                  status={p.checks ? <span title={CHECK_ICON[p.checks][1]} className="inline-flex items-center">{CHECK_ICON[p.checks][0]}<span className="sr-only">{CHECK_ICON[p.checks][1]}</span></span> : undefined}
                  assignees={p.assignees ?? []} comments={p.comments}
                  meta={<>#{p.number} {p.state === 'merged' ? 'merged' : p.state === 'closed' ? 'was closed' : 'opened'} <span title={p.at ? new Date(p.at).toLocaleString() : undefined}>{p.when}</span> by {p.author.login}{p.review ? <> · <span className={p.review === 'approved' ? 'text-(--gh-open)' : p.review === 'changes' ? 'text-(--gh-closed)' : ''}>{REVIEW_TEXT[p.review]}</span></> : null}{p.milestone ? <span className="ml-2 inline-flex items-center gap-1"><Oct name="milestone" size={12} />{p.milestone}</span> : null}</>} />
              ))}
              {data.items.length === 0 ? (
                <div className="px-4 py-14 text-center">
                  <Oct name="pr" size={24} className="text-muted-foreground" />
                  <h2 className="mt-3 mb-1 text-title font-semibold">{filtered ? 'No results matched your search.' : `No ${state} pull requests.`}</h2>
                </div>
              ) : null}
            </div>
          )}
        </Loaded>
      </Box>
      {pulls.data ? <Pagination data={pulls.data} go={(p) => go(query, p)} /> : null}
    </div>
  );
}
