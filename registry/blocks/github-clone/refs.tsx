/* Refs: the branch/tag switcher (filter, tabs, create a branch from here), the Branches page (ahead/behind, its pull
   request, new, rename, delete) and the Tags page. */
import { useState } from 'react';
import { Autocomplete, Button as AriaButton, Dialog, DialogTrigger, Input, ListBox, ListBoxItem, SearchField, useFilter } from 'react-aria-components';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input as TextInput } from '@/components/ui/input';
import { Popover } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { RefInfo } from './data';
import { GhLink } from './links';
import { Pagination } from './lists';
import { Box, Oct, StateIcon, ghButton, PR_STATE } from './parts';
import { Menu } from './pickers';
import { ActionError, Loaded, useAction, useCan, useLoad, useNav, useRepo } from './repo-context';

/** Switches the ref, staying on `path` when it can. */
export function RefPicker({ value, path = '' }: { value: string; path?: string }) {
  const { source, repo, notify } = useRepo();
  const nav = useNav();
  const can = useCan();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [tab, setTab] = useState<'branches' | 'tags'>('branches');
  const names = useLoad(source.id + ':refnames', source.refNames).data;
  const act = useAction();
  const { contains } = useFilter({ sensitivity: 'base' });
  const current = value || repo.branch;
  const list = tab === 'branches' ? [repo.branch, ...(names?.branches ?? []).filter((b) => b !== repo.branch)] : names?.tags ?? [];
  const isSha = /^[0-9a-f]{7,40}$/.test(current);
  const go = (ref: string) => {
    nav.go({ s: 'code', ref: ref === repo.branch ? undefined : ref, path: path || undefined });
    setOpen(false);
  };
  const exact = (names?.branches ?? []).some((b) => b === q.trim());
  const create = () => void act.run(async () => {
    const name = q.trim();
    await source.createBranch(name, current);
    notify(`Branch ${name} created`);
    go(name);
  });
  return (
    <DialogTrigger isOpen={open} onOpenChange={(v) => { setOpen(v); if (v) setQ(''); }}>
      <AriaButton aria-label={`Switch branches or tags: ${current}`} className={ghButton()}>
        <Oct name={(names?.tags ?? []).includes(current) ? 'tag' : isSha ? 'commit' : 'branch'} className="text-muted-foreground" />
        <span className="max-w-[140px] truncate font-mono text-caption">{isSha ? current.slice(0, 7) : current}</span>
        <Oct name="chevDown" size={12} className="text-muted-foreground" />
      </AriaButton>
      <Popover placement="bottom start" className="w-[min(320px,calc(100vw-24px))]">
        <Dialog aria-label="Switch branches or tags" className="flex max-h-[min(460px,70vh)] flex-col outline-none">
          <header className="border-b border-border px-3 py-2 text-caption font-semibold">Switch branches/tags</header>
          <Autocomplete filter={(text, input) => contains(text, input)} inputValue={q} onInputChange={setQ}>
            <SearchField aria-label={tab === 'branches' ? 'Find or create a branch' : 'Find a tag'} className="p-2" autoFocus>
              <Input placeholder={tab === 'branches' && can.push ? 'Find or create a branch…' : `Find a ${tab === 'branches' ? 'branch' : 'tag'}…`} autoComplete="off" spellCheck={false}
                className="box-border h-8 w-full rounded-md border border-border bg-background px-2 font-sans text-detail text-foreground outline-none select-text data-focused:border-primary data-focused:ring-1 data-focused:ring-primary group-data-[phone=true]/gh:h-11 [&::-webkit-search-cancel-button]:appearance-none" />
            </SearchField>
            <div role="group" aria-label="Kind of ref" className="flex gap-1 border-b border-border px-2">
              {(['branches', 'tags'] as const).map((t) => (
                <Button key={t} aria-pressed={tab === t} onPress={() => setTab(t)} className={cn('h-8 cursor-pointer border-0 border-b-2 bg-transparent px-2 text-caption outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary group-data-[phone=true]/gh:h-11', tab === t ? 'border-(--gh-tab) font-semibold text-foreground' : 'border-transparent text-muted-foreground')}>{t === 'branches' ? 'Branches' : 'Tags'}</Button>
              ))}
            </div>
            <ListBox aria-label={tab} selectionMode="single" selectedKeys={[current]} className="bl-scroll min-h-0 flex-1 overflow-y-auto outline-none"
              onAction={(key) => go(String(key))} onSelectionChange={() => {}}
              renderEmptyState={() => <div className="px-3 py-5 text-center text-caption text-muted-foreground">{tab === 'tags' ? 'Nothing to show' : 'No branches match'}</div>}>
              {list.map((name) => (
                <ListBoxItem key={name} id={name} textValue={name} className="flex min-h-8 cursor-pointer items-center gap-2 border-t border-border px-3 py-1.5 font-mono text-caption text-foreground outline-none first:border-t-0 data-focused:bg-accent group-data-[phone=true]/gh:min-h-11">
                  {({ isSelected }) => <><span className="grid w-4 shrink-0 place-items-center">{isSelected ? <Oct name="check" size={14} /> : null}</span><span className="min-w-0 flex-1 truncate">{name}</span>{name === repo.branch ? <span className="rounded-full border border-border px-1.5 font-sans text-caption2 text-muted-foreground">default</span> : null}</>}
                </ListBoxItem>
              ))}
            </ListBox>
          </Autocomplete>
          {tab === 'branches' && can.push && q.trim() && !exact ? (
            <div className="border-t border-border">
              <Button className="flex w-full cursor-pointer items-center gap-2 border-0 bg-transparent px-3 py-2 text-left text-caption text-foreground outline-none data-hovered:bg-accent data-focus-visible:ring-2 data-focus-visible:ring-primary group-data-[phone=true]/gh:min-h-11" isDisabled={act.busy} onPress={create}>
                <Oct name="branch" />Create branch <b className="font-mono font-semibold">{q.trim()}</b> from {current}
              </Button>
              <ActionError error={act.error} className="px-3 pb-2" />
            </div>
          ) : null}
          <footer className="border-t border-border px-3 py-1.5 text-caption">
            <GhLink to={tab === 'branches' ? { s: 'branches' } : { s: 'tags' }} onNavigate={() => setOpen(false)} className="text-primary no-underline hover:underline">View all {tab}</GhLink>
          </footer>
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}

function PullBadge({ pull }: { pull: NonNullable<RefInfo['pull']> }) {
  return <GhLink to={{ s: 'pull', n: pull.number }} className="inline-flex items-center gap-1 text-caption text-muted-foreground no-underline hover:text-primary"><StateIcon state={PR_STATE[pull.state]} />#{pull.number}</GhLink>;
}

export function BranchesPage({ page = 1 }: { page?: number }) {
  const { source, repo, ui, notify } = useRepo();
  const nav = useNav();
  const can = useCan();
  const branches = useLoad(`${source.id}:branches:${page}`, () => source.branches(page));
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [from, setFrom] = useState(repo.branch);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameTo, setRenameTo] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const act = useAction();
  const names = useLoad(source.id + ':refnames', source.refNames).data?.branches ?? [];
  return (
    <div className={cn(ui.phone && 'p-4')}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="m-0 flex-1 text-title font-semibold">Branches</h1>
        {can.push ? <Button className={ghButton(true)} onPress={() => { setCreating(!creating); setNewName(''); act.clear(); }}>New branch</Button> : null}
      </div>
      {creating ? (
        <form className="mb-4 grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_1fr_auto]" onSubmit={(e) => { e.preventDefault(); if (newName.trim()) void act.run(async () => { await source.createBranch(newName.trim(), from); notify(`Branch ${newName.trim()} created`); setCreating(false); }); }}>
          <label className="grid gap-1 font-semibold">New branch name
            <TextInput autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} className="h-8 rounded-md border border-border bg-background font-mono text-caption font-normal group-data-[phone=true]/gh:h-11" />
          </label>
          <label className="grid gap-1 font-semibold">Branch source
            <select value={from} onChange={(e) => setFrom(e.target.value)} className="box-border h-8 rounded-md border border-border bg-background px-1 font-mono text-caption font-normal text-foreground group-data-[phone=true]/gh:h-11">
              {names.map((b) => <option key={b}>{b}</option>)}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <Button className={ghButton()} onPress={() => setCreating(false)}>Cancel</Button>
            <Button type="submit" className={ghButton(true)} isDisabled={act.busy || !newName.trim()}>Create</Button>
          </div>
          <ActionError error={act.error} className="sm:col-span-3" />
        </form>
      ) : null}
      <label className="mb-3 flex h-8 items-center gap-2 rounded-md border border-border bg-background px-2 text-muted-foreground group-data-[phone=true]/gh:h-11">
        <Oct name="search" /><input aria-label="Search branches" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search branches on this page" className="min-w-0 flex-1 border-0 bg-transparent font-sans text-detail text-foreground outline-none select-text" />
      </label>
      {!creating ? <ActionError error={act.error} className="mb-2" /> : null}
      <Loaded load={branches}>
        {(data) => {
          const rows = data.items.filter((b) => !q || b.name.toLowerCase().includes(q.toLowerCase()));
          return (
            <>
              <Box header={<b className="font-semibold">All branches</b>}>
                {rows.map((b) => (
                  <div key={b.name} className="border-t border-border px-4 py-2.5 first:border-t-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <GhLink to={{ s: 'code', ref: b.name === repo.branch ? undefined : b.name }} className="min-w-0 truncate rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-caption text-primary no-underline">{b.name}</GhLink>
                        {b.name === repo.branch ? <span className="rounded-full border border-border px-1.5 text-caption2 text-muted-foreground">default</span> : null}
                        {b.protected ? <Oct name="shield" size={14} className="text-muted-foreground" aria-label="Protected" /> : null}
                      </div>
                      {b.commit && !ui.phone ? <span className="flex items-center gap-1.5 text-caption text-muted-foreground"><Avatar c={b.commit.author} src={b.commit.author.avatar} size={16} />Updated {b.commit.when}</span> : null}
                      {b.ahead != null ? <span className="text-caption text-muted-foreground" title={`${b.ahead} ahead, ${b.behind} behind ${repo.branch}`}>{b.behind} behind · {b.ahead} ahead</span> : null}
                      {b.pull ? <PullBadge pull={b.pull} /> : b.name !== repo.branch && (b.ahead ?? 0) > 0 ? <GhLink to={{ s: 'compare', head: b.name, create: true }} className="text-caption text-primary no-underline hover:underline">New pull request</GhLink> : null}
                      {can.push ? (
                        <Menu label={`Actions for ${b.name}`} triggerClassName={cn(ghButton(), 'h-7 w-7 px-0')} trigger={<Oct name="kebab" />} entries={[
                          { id: 'activity', label: 'Commits', onAction: () => nav.go({ s: 'commits', ref: b.name }) },
                          { id: 'rename', label: 'Rename branch', onAction: () => { setRenaming(b.name); setRenameTo(b.name); } },
                          b.name !== repo.branch && !b.protected ? { id: 'delete', label: 'Delete branch', danger: true, onAction: () => setDeleting(b.name) } : null,
                        ]} />
                      ) : null}
                    </div>
                    {renaming === b.name ? (
                      <form className="mt-2 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); void act.run(async () => { await source.renameBranch(b.name, renameTo.trim()); setRenaming(null); notify('Branch renamed'); }); }}>
                        <TextInput aria-label={`New name for ${b.name}`} autoFocus value={renameTo} onChange={(e) => setRenameTo(e.target.value)} className="h-8 min-w-[160px] flex-1 rounded-md border border-border bg-background font-mono text-caption group-data-[phone=true]/gh:h-11" />
                        <Button type="submit" className={ghButton(true)} isDisabled={act.busy || !renameTo.trim() || renameTo === b.name}>Rename</Button>
                        <Button className={ghButton()} onPress={() => setRenaming(null)}>Cancel</Button>
                      </form>
                    ) : null}
                    {deleting === b.name ? (
                      <div role="alertdialog" aria-label={`Delete ${b.name}?`} className="mt-2 flex flex-wrap items-center gap-2 rounded-md border border-(--gh-closed)/50 p-2">
                        <span className="min-w-0 flex-1">Delete <b className="font-mono font-semibold">{b.name}</b>?{b.pull?.state === 'open' ? ' Its open pull request will close.' : ''}</span>
                        <Button className={ghButton()} onPress={() => setDeleting(null)}>Cancel</Button>
                        <Button className={cn(ghButton(), 'text-(--gh-closed)')} isDisabled={act.busy} onPress={() => void act.run(async () => { await source.deleteBranch(b.name); setDeleting(null); notify(`Branch ${b.name} deleted`); })}>Delete</Button>
                      </div>
                    ) : null}
                  </div>
                ))}
                {!rows.length ? <div className="px-4 py-10 text-center text-muted-foreground">No branches match.</div> : null}
              </Box>
              <Pagination data={data} go={(p) => nav.go({ s: 'branches', page: p })} />
            </>
          );
        }}
      </Loaded>
    </div>
  );
}

export function TagsPage({ page = 1 }: { page?: number }) {
  const { source, repo, ui, notify } = useRepo();
  const nav = useNav();
  const can = useCan();
  const tags = useLoad(`${source.id}:tags:${page}`, () => source.tags(page));
  const [deleting, setDeleting] = useState<string | null>(null);
  const act = useAction();
  const archive = (tag: string, ext: string) => `https://github.com/${source.full}/archive/refs/tags/${encodeURIComponent(tag)}.${ext}`;
  return (
    <div className={cn(ui.phone && 'p-4')}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="m-0 flex-1 text-title font-semibold">Tags</h1>
        <GhLink to={{ s: 'releases' }} className={cn(ghButton(), 'no-underline')}>Releases</GhLink>
        {can.push ? <Button className={ghButton(true)} onPress={() => nav.go({ s: 'new-release' })}>Draft a new release</Button> : null}
      </div>
      <ActionError error={act.error} className="mb-2" />
      <Loaded load={tags}>
        {(data) => (
          <>
            <Box header={<b className="font-semibold">{data.items.length ? `${repo.tagCount} tag${repo.tagCount === 1 ? '' : 's'}` : 'Tags'}</b>}>
              {data.items.map((t) => (
                <div key={t.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border px-4 py-2.5 first:border-t-0">
                  <div className="min-w-0 flex-1">
                    <GhLink to={{ s: 'code', ref: t.name }} className="font-semibold text-foreground no-underline hover:text-primary"><Oct name="tag" size={14} className="mr-1.5 text-muted-foreground" />{t.name}</GhLink>
                    {t.commit ? <div className="mt-0.5 truncate text-caption text-muted-foreground">{t.commit.when} · <GhLink to={{ s: 'commit', sha: t.sha }} className="font-mono text-muted-foreground no-underline hover:text-primary">{t.sha.slice(0, 7)}</GhLink> · {t.commit.message}</div> : null}
                  </div>
                  <a href={archive(t.name, 'zip')} className="text-caption text-primary no-underline hover:underline">zip</a>
                  <a href={archive(t.name, 'tar.gz')} className="text-caption text-primary no-underline hover:underline">tar.gz</a>
                  {can.push ? (
                    deleting === t.name ? (
                      <span className="flex items-center gap-2">
                        <Button className={cn(ghButton(), 'h-7 px-2 text-caption')} onPress={() => setDeleting(null)}>Cancel</Button>
                        <Button className={cn(ghButton(), 'h-7 px-2 text-caption text-(--gh-closed)')} isDisabled={act.busy} onPress={() => void act.run(async () => { await source.deleteTag(t.name); setDeleting(null); notify(`Tag ${t.name} deleted`); })}>Delete</Button>
                      </span>
                    ) : <Button aria-label={`Delete tag ${t.name}`} className={cn(ghButton(), 'h-7 w-7 px-0')} onPress={() => setDeleting(t.name)}><Oct name="trash" size={14} /></Button>
                  ) : null}
                </div>
              ))}
              {!data.items.length ? <div className="px-4 py-10 text-center text-muted-foreground">There aren’t any tags yet.</div> : null}
            </Box>
            <Pagination data={data} go={(p) => nav.go({ s: 'tags', page: p })} />
          </>
        )}
      </Loaded>
    </div>
  );
}
