/* History: a ref's or file's commits, paged and grouped by day with an author filter, and one commit in full: message,
   author, parents, the pull requests it belongs to, its checks and its diff. */
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Commit } from './data';
import { DiffFiles } from './diff';
import { GitHubError } from './github-api';
import { GhLink, UserLink } from './links';
import { Pagination } from './lists';
import { Md } from './markdown';
import { Box, DiffStat, Oct, ghButton } from './parts';
import { SelectMenu } from './pickers';
import { CheckRow } from './pull-request';
import { RefPicker } from './refs';
import { Failed, Loaded, useCopy, useLoad, useNav, useRepo } from './repo-context';

const dayOf = (c: Commit) => (c.at ? new Date(c.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '');

/** A commit's row, wherever commits are listed. */
export function CommitRow({ c }: { c: Commit }) {
  const { ui } = useRepo();
  const copy = useCopy();
  return (
    <div className="flex items-center gap-3 border-t border-border px-4 py-2.5 first:border-t-0 hover:bg-muted">
      <div className="min-w-0 flex-1">
        <GhLink to={{ s: 'commit', sha: c.fullSha }} className="block truncate font-semibold text-foreground no-underline hover:text-primary hover:underline">{c.message}</GhLink>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-caption text-muted-foreground">
          <Avatar c={c.author} src={c.author.avatar} size={16} /><UserLink user={c.author} className="font-semibold text-foreground" /> committed <span title={c.at ? new Date(c.at).toLocaleString() : undefined}>{c.when}</span>
          {c.verified ? <span className="rounded-full border border-(--gh-open) px-1.5 text-caption2 leading-4 text-(--gh-open)">Verified</span> : null}
        </div>
      </div>
      <GhLink to={{ s: 'commit', sha: c.fullSha }} className={cn(ghButton(), 'h-7 px-2 font-mono text-caption no-underline')}>{c.sha}</GhLink>
      <Button aria-label={`Copy full SHA ${c.sha}`} className={cn(ghButton(), 'h-7 w-7 px-0')} onPress={() => void copy(c.fullSha, 'SHA copied')}><Oct name="copy" size={14} /></Button>
      {!ui.phone ? <GhLink aria-label={`Browse the repository at ${c.sha}`} to={{ s: 'code', ref: c.fullSha }} className={cn(ghButton(), 'h-7 w-7 px-0 no-underline')}><Oct name="code" size={14} /></GhLink> : null}
    </div>
  );
}

export function CommitsPage({ gitRef = '', path, author, page = 1 }: { gitRef?: string; path?: string; author?: string; page?: number }) {
  const { source, repo, ui } = useRepo();
  const nav = useNav();
  const commits = useLoad(`${source.id}:commit-list:${gitRef}:${path ?? ''}:${author ?? ''}:${page}`, () => source.commits({ ref: gitRef, path, author, page }));
  const people = useLoad(source.id + ':assignable', source.assignable).data ?? [];
  const contributors = repo.contributors;
  const authors = [...new Map([...contributors, ...people].map((u) => [u.login, u])).values()];
  return (
    <div className={cn(ui.phone && 'p-4')}>
      <h1 className="mt-0 mb-4 text-title font-semibold">{path ? <>History of <span className="font-mono text-detail break-all">{path}</span></> : 'Commits'}</h1>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <RefPicker value={gitRef} path="" />
        {path ? <GhLink to={{ s: 'code', ref: gitRef || undefined, path }} className={cn(ghButton(), 'no-underline')}>View file</GhLink> : null}
        <span className="flex-1" />
        <SelectMenu title="Filter by author" trigger={<><Oct name="people" />{author ?? 'All users'}<Oct name="chevDown" size={12} /></>} clearLabel="All users" selected={author ? [author] : []} filterPlaceholder="Filter users"
          items={authors.map((u) => ({ id: u.login, label: u.login, leading: <Avatar c={u} src={u.avatar} size={20} /> }))}
          onApply={(ids) => nav.go({ s: 'commits', ref: gitRef || undefined, path, author: ids[0] })} />
      </div>
      <Loaded load={commits}>
        {(data) => {
          const groups = new Map<string, Commit[]>();
          for (const c of data.items) groups.set(dayOf(c), [...(groups.get(dayOf(c)) ?? []), c]);
          return (
            <div aria-busy={commits.loading} className={cn(commits.loading && 'opacity-70')}>
              {[...groups].map(([day, list]) => (
                <section key={day} className="mb-4" aria-label={`Commits on ${day}`}>
                  <h2 className="mt-0 mb-2 flex items-center gap-2 text-detail font-normal text-muted-foreground"><Oct name="commit" />Commits on {day}</h2>
                  <Box>{list.map((c) => <CommitRow key={c.fullSha} c={c} />)}</Box>
                </section>
              ))}
              {!data.items.length ? <Box className="px-6 py-12 text-center text-muted-foreground">No commits match.</Box> : null}
              <Pagination data={data} go={(p) => nav.go({ s: 'commits', ref: gitRef || undefined, path, author, page: p })} />
            </div>
          );
        }}
      </Loaded>
    </div>
  );
}

export function CommitPage({ sha }: { sha: string }) {
  const { source, ui } = useRepo();
  const copy = useCopy();
  const commit = useLoad(`${source.id}:commit:${sha}`, () => source.commit(sha));
  if (commit.error instanceof GitHubError && (commit.error.kind === 'notFound' || commit.error.kind === 'validation')) {
    return <div className={cn(ui.phone && 'p-4')}><Failed error={new GitHubError(404, '', 'notFound')} what={`There’s no commit ${sha.slice(0, 12)} in ${source.full}.`} /></div>;
  }
  return (
    <div className={cn(ui.phone && 'p-4')}>
      <Loaded load={commit}>
        {(c) => (
          <>
            <section aria-label="Commit" className="mb-6 overflow-hidden rounded-md border border-border">
              <div className="border-b border-border bg-muted px-4 py-3">
                <div className="flex flex-wrap items-start gap-3">
                  <h1 className="m-0 min-w-0 flex-1 text-callout font-semibold">{c.message}</h1>
                  <GhLink to={{ s: 'code', ref: c.fullSha }} className={cn(ghButton(), 'no-underline')}>Browse files</GhLink>
                </div>
                {c.body ? <Md markdown={c.body} className="mt-2 bg-transparent text-caption" /> : null}
                {c.pulls.length ? (
                  <div className="mt-2 flex flex-wrap gap-2 text-caption">
                    {c.pulls.map((p) => <GhLink key={p.number} to={{ s: 'pull', n: p.number }} className="inline-flex items-center gap-1 text-primary no-underline hover:underline"><Oct name="pr" size={14} />#{p.number} {p.title}</GhLink>)}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-caption text-muted-foreground">
                <span className="flex items-center gap-1.5"><Avatar c={c.author} src={c.author.avatar} size={20} /><UserLink user={c.author} className="font-semibold text-foreground" /> committed <span title={c.at ? new Date(c.at).toLocaleString() : undefined}>{c.when}</span></span>
                <span className="flex-1" />
                {c.parents?.length ? <span>{c.parents.length} parent{c.parents.length === 1 ? '' : 's'} {c.parents.map((p) => <GhLink key={p} to={{ s: 'commit', sha: p }} className="ml-1 font-mono text-primary no-underline hover:underline">{p.slice(0, 7)}</GhLink>)}</span> : <span>No parents: the first commit</span>}
                <span className="flex items-center gap-1">commit <code className="font-mono text-foreground">{c.sha}</code>
                  <Button aria-label="Copy full SHA" className="grid size-6 cursor-pointer place-items-center rounded-md border-0 bg-transparent text-muted-foreground outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary data-hovered:text-primary group-data-[phone=true]/gh:size-11" onPress={() => void copy(c.fullSha, 'SHA copied')}><Oct name="copy" size={14} /></Button>
                </span>
              </div>
              {c.checks?.length ? <div className="border-t border-border bg-muted">{c.checks.map((k) => <CheckRow key={k.name} check={k} />)}</div> : null}
            </section>
            <DiffFiles files={c.files} browseRef={c.fullSha} toolbar={<DiffStat add={c.additions} del={c.deletions} />} empty="This commit changes no files." />
          </>
        )}
      </Loaded>
    </div>
  );
}
