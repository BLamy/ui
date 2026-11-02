/* Insights: Pulse (a week's merged and proposed work), Contributors, Commit activity, Code frequency, Traffic (GitHub only
   shows it to people who can push) and Forks. GitHub computes the statistics on demand: its first answer is often "come
   back", so these screens say so and check again. */
import { Fragment } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { BarChart } from './chart';
import { GhLink, UserLink } from './links';
import { Pagination } from './lists';
import { Box, Oct } from './parts';
import type { InsightsPage } from './route';
import { Loaded, useCan, useLoad, useNav, usePoll, useRepo } from './repo-context';
import { useState } from 'react';

const PAGES: [InsightsPage, string][] = [['pulse', 'Pulse'], ['contributors', 'Contributors'], ['commits', 'Commits'], ['code', 'Code frequency'], ['traffic', 'Traffic'], ['forks', 'Forks']];

const weekLabel = (s: number) => new Date(s * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export function InsightsTab({ page = 'pulse' }: { page?: InsightsPage }) {
  const { ui } = useRepo();
  const can = useCan();
  const pages = PAGES.filter(([id]) => id !== 'traffic' || can.push);
  const item = (id: InsightsPage, label: string) => (
    <GhLink key={id} to={{ s: 'insights', page: id }} aria-current={page === id ? 'page' : undefined}
      className={cn('flex min-h-8 items-center whitespace-nowrap rounded-md px-2 text-detail text-foreground no-underline hover:bg-secondary group-data-[phone=true]/gh:min-h-11', page === id && 'bg-secondary font-semibold')}>{label}</GhLink>
  );

  return (
    <div className={cn('flex gap-6', !ui.wide && 'flex-col gap-3', ui.phone && 'p-4')}>
      <nav aria-label="Insights" className={cn(ui.wide ? 'w-[200px] shrink-0 space-y-0.5' : 'flex overflow-x-auto [scrollbar-width:thin]')}>{pages.map(([id, l]) => item(id, l))}</nav>
      <div className="min-w-0 flex-1">
        {page === 'pulse' ? <Pulse /> : page === 'contributors' ? <Contributors /> : page === 'commits' ? <CommitActivity /> : page === 'code' ? <CodeFrequency /> : page === 'traffic' ? <TrafficPage /> : <Forks />}
      </div>
    </div>
  );
}

const Computing = () => (
  <Box className="px-6 py-12 text-center text-muted-foreground" role="status"><Oct name="history" size={24} /><p className="mt-3 mb-0">GitHub is computing these statistics. This page checks again by itself.</p></Box>
);

function Stat({ value, label, icon, to }: { value: number; label: string; icon: 'merged' | 'pr' | 'issueClosed' | 'issue'; to: Parameters<typeof GhLink>[0]['to'] }) {
  return (
    <GhLink to={to} className="flex items-center gap-2 rounded-md border border-border p-3 text-foreground no-underline hover:border-primary">
      <Oct name={icon} className="text-muted-foreground" />
      <span className="text-title font-semibold tabular-nums">{value.toLocaleString('en-US')}</span>
      <span className="min-w-0 text-caption text-muted-foreground">{label}</span>
    </GhLink>
  );
}

function Pulse() {
  const { source, gh } = useRepo();
  const since = new Date((gh?.now() ?? Date.now()) - 7 * 86400_000).toISOString().slice(0, 10);
  const merged = useLoad(`${source.id}:pulse:merged:${since}`, () => source.searchPulls(`is:merged merged:>=${since}`, 1));
  const opened = useLoad(`${source.id}:pulse:prs:${since}`, () => source.searchPulls(`is:pr created:>=${since}`, 1));
  const closed = useLoad(`${source.id}:pulse:closed:${since}`, () => source.searchIssues(`is:closed closed:>=${since}`, 1));
  const issues = useLoad(`${source.id}:pulse:issues:${since}`, () => source.searchIssues(`is:issue created:>=${since}`, 1));
  const activity = useLoad(`${source.id}:stats:activity`, source.commitActivity).data;
  const lastWeek = Array.isArray(activity) ? activity.at(-1) : undefined;
  return (
    <section aria-labelledby="pulse-title">
      <h1 id="pulse-title" className="mt-0 mb-1 text-title font-semibold">Pulse</h1>
      <p className="mt-0 mb-4 text-muted-foreground">The last 7 days, since {since}.{lastWeek ? ` ${lastWeek.total} commit${lastWeek.total === 1 ? '' : 's'} on the default branch this week.` : ''}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon="merged" value={merged.data?.total ?? 0} label="merged pull requests" to={{ s: 'pulls', q: `is:merged merged:>=${since}` }} />
        <Stat icon="pr" value={opened.data?.total ?? 0} label="proposed pull requests" to={{ s: 'pulls', q: `is:pr created:>=${since}` }} />
        <Stat icon="issueClosed" value={closed.data?.total ?? 0} label="closed issues" to={{ s: 'issues', q: `is:closed closed:>=${since}` }} />
        <Stat icon="issue" value={issues.data?.total ?? 0} label="new issues" to={{ s: 'issues', q: `is:issue created:>=${since}` }} />
      </div>
      {merged.data?.items.length ? (
        <>
          <h2 className="mt-6 mb-2 text-callout font-semibold">Merged pull requests</h2>
          <Box>{merged.data.items.map((p) => <div key={p.number} className="flex items-center gap-2 border-t border-border px-4 py-2 first:border-t-0"><Oct name="merged" className="text-(--gh-done)" /><GhLink to={{ s: 'pull', n: p.number }} className="min-w-0 flex-1 truncate text-foreground no-underline hover:text-primary">{p.title} <span className="text-muted-foreground">#{p.number}</span></GhLink><span className="shrink-0 text-caption text-muted-foreground">{p.when}</span></div>)}</Box>
        </>
      ) : null}
    </section>
  );
}

function Contributors() {
  const { source } = useRepo();
  const stats = useLoad(`${source.id}:stats:contributors`, source.contributorStats);
  usePoll(source.live && stats.data === 'computing', 5000, () => source.refresh('/stats'));
  return (
    <section>
      <h1 className="mt-0 mb-4 text-title font-semibold">Contributors</h1>
      <Loaded load={stats}>
        {(data) => data === 'computing' ? <Computing /> : (
          <div className="grid gap-3 lg:grid-cols-2">
            {data.map((c) => (
              <div key={c.user.login} className="rounded-md border border-border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <Avatar c={c.user} src={c.user.avatar} size={32} />
                  <div className="min-w-0 flex-1">
                    <UserLink user={c.user} className="block truncate font-semibold text-primary" />
                    <div className="text-caption text-muted-foreground">{c.commits.toLocaleString('en-US')} commit{c.commits === 1 ? '' : 's'} · <span className="text-(--gh-open)">{c.additions.toLocaleString('en-US')}++</span> <span className="text-(--gh-closed)">{c.deletions.toLocaleString('en-US')}−−</span></div>
                  </div>
                </div>
                <BarChart title={`${c.user.login}’s commits per week`} height={48} unit="commits" tickEvery={Math.max(1, Math.ceil(c.weeks.length / 4))} points={c.weeks.slice(-52).map((w) => ({ label: weekLabel(w.w), title: `Week of ${weekLabel(w.w)}`, value: w.c }))} />
              </div>
            ))}
            {!data.length ? <Box className="px-6 py-12 text-center text-muted-foreground lg:col-span-2">No contributors yet.</Box> : null}
          </div>
        )}
      </Loaded>
    </section>
  );
}

function CommitActivity() {
  const { source } = useRepo();
  const stats = useLoad(`${source.id}:stats:activity`, source.commitActivity);
  usePoll(source.live && stats.data === 'computing', 5000, () => source.refresh('/stats'));
  return (
    <section>
      <h1 className="mt-0 mb-4 text-title font-semibold">Commit activity</h1>
      <Loaded load={stats}>
        {(data) => data === 'computing' ? <Computing /> : (
          <Box className="p-4">
            <BarChart title="Commits per week, the last year" height={160} unit="commits" points={data.map((w) => ({ label: weekLabel(w.week), title: `Week of ${weekLabel(w.week)}`, value: w.total }))} />
          </Box>
        )}
      </Loaded>
    </section>
  );
}

function CodeFrequency() {
  const { source } = useRepo();
  const stats = useLoad(`${source.id}:stats:code`, source.codeFrequency);
  usePoll(source.live && stats.data === 'computing', 5000, () => source.refresh('/stats'));
  return (
    <section>
      <h1 className="mt-0 mb-4 text-title font-semibold">Code frequency</h1>
      <Loaded load={stats}>
        {(data) => data === 'computing' ? <Computing /> : data.length ? (
          <Box className="p-4">
            <BarChart title="Lines added and removed per week" height={200} unit="additions" belowUnit="deletions" color="bg-(--gh-open)" tickEvery={Math.max(1, Math.ceil(data.length / 5))} points={data.map((w) => ({ label: weekLabel(w.week), title: `Week of ${weekLabel(w.week)}`, value: w.additions, below: w.deletions }))} />
          </Box>
        ) : <Box className="px-6 py-12 text-center text-muted-foreground">No commits yet.</Box>}
      </Loaded>
    </section>
  );
}

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function TrafficPage() {
  const { source } = useRepo();
  const traffic = useLoad(`${source.id}:traffic`, source.traffic);
  const table = (title: string, head: string, rows: { key: string; name: string; count: number; uniques: number }[]) => (
    <Box header={<b className="font-semibold">{title}</b>}>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label={title}>
        <table className="w-full border-collapse text-caption">
          <thead><tr className="text-left text-muted-foreground"><th className="px-3 py-1.5 font-semibold">{head}</th><th className="px-3 py-1.5 text-right font-semibold">Views</th><th className="px-3 py-1.5 text-right font-semibold">Unique</th></tr></thead>
          <tbody>
            {rows.map((r) => <tr key={r.key} className="border-t border-border"><td className="px-3 py-1.5 break-all">{r.name}</td><td className="px-3 py-1.5 text-right tabular-nums">{r.count.toLocaleString('en-US')}</td><td className="px-3 py-1.5 text-right tabular-nums">{r.uniques.toLocaleString('en-US')}</td></tr>)}
            {!rows.length ? <tr><td colSpan={3} className="px-3 py-6 text-center text-muted-foreground">Nothing recorded.</td></tr> : null}
          </tbody>
        </table>
      </div>
    </Box>
  );
  return (
    <section>
      <h1 className="mt-0 mb-4 text-title font-semibold">Traffic</h1>
      <Loaded load={traffic}>
        {(t) => t ? (
          <div className="space-y-4">
            <Box className="p-4">
              <p className="mt-0 mb-2 text-caption text-muted-foreground"><b className="text-title font-semibold text-foreground tabular-nums">{t.viewsTotal.toLocaleString('en-US')}</b> views · {t.viewsUnique.toLocaleString('en-US')} unique visitors, 14 days</p>
              <BarChart title="Views per day" height={100} unit="views" tickEvery={3} points={t.views.map((v) => ({ label: dayLabel(v.at), value: v.count }))} />
            </Box>
            <Box className="p-4">
              <p className="mt-0 mb-2 text-caption text-muted-foreground"><b className="text-title font-semibold text-foreground tabular-nums">{t.clonesTotal.toLocaleString('en-US')}</b> clones · {t.clonesUnique.toLocaleString('en-US')} unique cloners, 14 days</p>
              <BarChart title="Clones per day" height={100} unit="clones" tickEvery={3} points={t.clones.map((v) => ({ label: dayLabel(v.at), value: v.count }))} />
            </Box>
            <div className="grid gap-4 lg:grid-cols-2">
              {table('Referring sites', 'Site', t.referrers.map((r) => ({ key: r.referrer, name: r.referrer, count: r.count, uniques: r.uniques })))}
              {table('Popular content', 'Content', t.paths.map((p) => ({ key: p.path, name: p.path, count: p.count, uniques: p.uniques })))}
            </div>
          </div>
        ) : <Box className="px-6 py-12 text-center text-muted-foreground">GitHub only shows traffic to people who can push to this repository.</Box>}
      </Loaded>
    </section>
  );
}

function Forks() {
  const { source, repo } = useRepo();
  const nav = useNav();
  const [page, setPage] = useState(1);
  const forks = useLoad(`${source.id}:people:forks:${page}`, () => source.people('forks', page));
  return (
    <section>
      <h1 className="mt-0 mb-1 text-title font-semibold">Forks</h1>
      <p className="mt-0 mb-4 text-muted-foreground">{repo.forkCount.toLocaleString('en-US')} in total. GitHub lists the ones you can see.</p>
      <Loaded load={forks}>
        {(data) => (
          <>
            <Box>
              {data.items.map((f) => (
                <Fragment key={f.full ?? f.login}>
                  <div className="flex items-center gap-3 border-t border-border px-4 py-2 first:border-t-0">
                    <Avatar c={f} src={f.avatar} size={24} />
                    <button type="button" className="min-w-0 flex-1 cursor-pointer truncate border-0 bg-transparent p-0 text-left text-detail font-semibold text-primary hover:underline group-data-[phone=true]/gh:min-h-11" onClick={() => f.full && nav.openRepo(f.full)}>{f.full ?? f.login}</button>
                  </div>
                </Fragment>
              ))}
              {!data.items.length ? <div className="px-4 py-14 text-center"><Oct name="fork" size={24} className="text-muted-foreground" /><h2 className="mt-3 mb-0 text-title font-semibold">No forks to show</h2></div> : null}
            </Box>
            <Pagination data={data} go={setPage} />
          </>
        )}
      </Loaded>
    </section>
  );
}
