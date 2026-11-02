/* Who starred, watches or contributed. */
import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { UserLink } from './links';
import { Pagination } from './lists';
import { Box, Oct } from './parts';
import type { PeoplePage as Kind } from './route';
import { Loaded, useLoad, useRepo } from './repo-context';
import { useState } from 'react';

const TITLE: Record<Kind, string> = { stargazers: 'Stargazers', watchers: 'Watchers', contributors: 'Contributors' };

export function PeoplePage({ kind }: { kind: Kind }) {
  const { source, ui, repo } = useRepo();
  const [page, setPage] = useState(1);
  const list = useLoad(`${source.id}:people:${kind}:${page}`, () => source.people(kind, page));
  const known = kind === 'stargazers' ? repo.starCount : kind === 'watchers' ? repo.watcherCount : repo.contributorCount;
  return (
    <div className={cn(ui.phone && 'p-4')}>
      <h1 className="mt-0 mb-1 text-title font-semibold">{TITLE[kind]}</h1>
      <p className="mt-0 mb-4 text-muted-foreground">{known.toLocaleString('en-US')} in total.</p>
      <Loaded load={list}>
        {(data) => (
          <>
            <Box>
              <ul className="m-0 grid list-none gap-0 p-0 sm:grid-cols-2 md:grid-cols-3">
                {data.items.map((u) => (
                  <li key={u.login} className="flex min-h-12 items-center gap-3 border-b border-border px-4 py-2">
                    <Avatar c={u} src={u.avatar} size={32} />
                    <span className="min-w-0"><UserLink user={u} className="block truncate font-semibold text-primary" />{u.detail ? <span className="block truncate text-caption text-muted-foreground">{u.detail}</span> : null}</span>
                  </li>
                ))}
              </ul>
              {!data.items.length ? <div className="px-4 py-14 text-center"><Oct name="people" size={24} className="text-muted-foreground" /><h2 className="mt-3 mb-0 text-title font-semibold">Nobody yet</h2></div> : null}
            </Box>
            <Pagination data={data} go={setPage} />
          </>
        )}
      </Loaded>
    </div>
  );
}
