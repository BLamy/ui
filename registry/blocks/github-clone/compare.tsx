/* Compare and open a pull request: choose base and head (a branch here, or owner:branch from a fork), see ahead/behind,
   the commits and the diff, then write the title and description (from the template when there is one) and create it. */
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Comparison } from './data';
import { CommitRow } from './commits';
import { DiffFiles } from './diff';
import { GhLink } from './links';
import { MarkdownField } from './markdown';
import { Box, Oct, ghButton } from './parts';
import { SelectMenu } from './pickers';
import { ActionError, Failed, Pending, useAction, useCan, useDraft, useLoad, useNav, useRepo } from './repo-context';

export function ComparePage({ base: baseProp, head: headProp, create }: { base?: string; head?: string; create?: boolean }) {
  const { source, repo, ui, viewer } = useRepo();
  const nav = useNav();
  const can = useCan();
  const base = baseProp || repo.branch;
  const head = headProp ?? '';
  const names = useLoad(source.id + ':refnames', source.refNames).data;
  const forks = useLoad(`${source.id}:people:forks`, () => source.people('forks', 1)).data?.items ?? [];
  const compare = useLoad<Comparison | null>(`${source.id}:compare:${base}...${head}`, () => (head && head !== base ? source.compare(base, head) : null));
  const existing = useLoad(`${source.id}:pulls-for:${head}:${base}`, () => (head ? source.searchPulls(`is:open head:${head.includes(':') ? head.split(':')[1] : head} base:${base}`, 1) : null)).data?.items[0];
  const template = useLoad(source.id + ':pull-template', source.pullTemplate).data;
  const [show, setShow] = useState(!!create);
  useEffect(() => { if (create) setShow(true); }, [create]);
  const refItems = [
    ...(names?.branches ?? []).map((b) => ({ id: b, label: b, description: b === repo.branch ? 'default branch' : undefined })),
    ...(names?.tags ?? []).map((t) => ({ id: t, label: t, description: 'tag' })),
  ];
  // Your fork's branches by name; other forks' default branch, since asking each one would spend the rate limit.
  const myFork = forks.find((f) => f.login === viewer?.login && f.full);
  const mine = useLoad<string[]>(`${source.id}:fork-branches:${myFork?.full ?? ''}`, () => (myFork?.full ? source.branchNamesOf(myFork.full) : [])).data ?? [];
  const forkHeads = [
    ...mine.map((b) => ({ id: `${viewer!.login}:${b}`, label: `${viewer!.login}:${b}`, description: `From your fork ${myFork!.full}` })),
    ...forks.filter((f) => f.full && f.login !== viewer?.login).map((f) => ({ id: `${f.login}:${repo.branch}`, label: `${f.login}:${repo.branch}`, description: `From the fork ${f.full}` })),
  ];
  const go = (o: { base?: string; head?: string }) => nav.go({ s: 'compare', base: o.base ?? base, head: o.head ?? head, create: show || undefined }, { replace: true });
  const c = compare.data;
  const canOpen = can.signedIn && !repo.archived && !!c && c.ahead > 0 && !existing;
  return (
    <div className={cn(ui.phone && 'p-4')}>
      <h1 className="mt-0 mb-1 text-title font-semibold">{show ? 'Open a pull request' : 'Compare changes'}</h1>
      <p className="mt-0 mb-4 text-muted-foreground">{show ? 'Create a new pull request by comparing changes across two branches.' : 'Choose two branches to see what’s changed or to start a new pull request.'}</p>
      <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted p-2">
        <Oct name="branch" className="text-muted-foreground" />
        <SelectMenu title="Choose a base branch" trigger={<>base: <b className="font-mono text-caption font-semibold">{base}</b><Oct name="chevDown" size={12} /></>} items={refItems} selected={[base]} filterPlaceholder="Filter branches" onApply={(ids) => { if (ids[0]) go({ base: ids[0] }); }} />
        <Oct name="chevLeft" size={14} className="text-muted-foreground" />
        <SelectMenu title="Choose a head branch" trigger={<>compare: <b className="font-mono text-caption font-semibold">{head || 'choose'}</b><Oct name="chevDown" size={12} /></>} items={[...refItems, ...forkHeads]} selected={head ? [head] : []} filterPlaceholder="Filter branches" onApply={(ids) => { if (ids[0]) go({ head: ids[0] }); }} />
        {c ? (
          <span className={cn('ml-1 flex items-center gap-1 text-caption', c.status === 'identical' ? 'text-muted-foreground' : 'text-(--gh-open)')}>
            {c.status === 'identical' ? 'Identical' : <><Oct name="check" size={14} />{c.ahead} ahead{c.behind ? `, ${c.behind} behind` : ''}</>}
          </span>
        ) : null}
      </div>
      {!head ? (
        <Box className="px-6 py-14 text-center">
          <Oct name="pr" size={24} className="text-muted-foreground" />
          <h2 className="mt-3 mb-1 text-title font-semibold">Pick a branch to compare</h2>
          <p className="m-0 text-muted-foreground">New commits on it appear here, and you can open a pull request from them.</p>
        </Box>
      ) : head === base ? (
        <Box className="px-6 py-14 text-center text-muted-foreground">Choose different branches: a branch has nothing to compare with itself.</Box>
      ) : compare.error ? (
        <Failed error={compare.error} retry={compare.retry} what={`Couldn’t compare ${base} with ${head}: one of them doesn’t exist here.`} />
      ) : !c ? <Pending label="Comparing…" /> : (
        <>
          {existing ? (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-border p-3">
              <Oct name="pr" className="text-(--gh-open)" /><span className="min-w-0 flex-1">A pull request already exists: <GhLink to={{ s: 'pull', n: existing.number }} className="font-semibold">{existing.title} #{existing.number}</GhLink></span>
            </div>
          ) : c.ahead === 0 ? (
            <Box className="mb-4 px-6 py-10 text-center">
              <h2 className="mt-0 mb-1 text-title font-semibold">There isn’t anything to compare</h2>
              <p className="m-0 text-muted-foreground"><b className="font-mono text-caption">{head}</b> has no commits that <b className="font-mono text-caption">{base}</b> doesn’t. Try switching the two.</p>
              {c.behind ? <Button className={cn(ghButton(), 'mt-3')} onPress={() => nav.go({ s: 'compare', base: head, head: base }, { replace: true })}>Switch base and compare</Button> : null}
            </Box>
          ) : !show ? (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-md border border-border bg-muted p-3">
              <span className="min-w-0 flex-1 text-muted-foreground">Discuss and review the changes in this comparison with others.</span>
              {canOpen ? <Button className={ghButton(true)} onPress={() => setShow(true)}>Create pull request</Button> : !viewer ? <span className="text-caption text-muted-foreground">Sign in to open a pull request.</span> : null}
            </div>
          ) : canOpen ? <PullForm base={base} head={head} comparison={c} template={template ?? null} /> : null}
          <h2 className="mt-6 mb-2 flex items-center gap-2 text-callout font-semibold">{c.commits.length} commit{c.commits.length === 1 ? '' : 's'}</h2>
          <Box>{c.commits.map((x) => <CommitRow key={x.fullSha} c={x} />)}{!c.commits.length ? <div className="px-4 py-6 text-center text-muted-foreground">No commits.</div> : null}</Box>
          <h2 className="mt-6 mb-2 text-callout font-semibold">Files changed</h2>
          <DiffFiles files={c.files} browseRef={head.includes(':') ? undefined : head} empty="No files changed." />
        </>
      )}
    </div>
  );
}

function PullForm({ base, head, comparison, template }: { base: string; head: string; comparison: Comparison; template: string | null }) {
  const { source, viewer, ui } = useRepo();
  const nav = useNav();
  const first = comparison.commits[0];
  const one = comparison.commits.length === 1;
  const key = `${source.id}:new-pull:${base}...${head}`;
  const titleDraft = useDraft(`${key}:title`, one ? first.message : head.split(':').at(-1)!.split('/').at(-1)!.replace(/[-_]/g, ' ').replace(/^./, (c) => c.toUpperCase()));
  const bodyDraft = useDraft(`${key}:body`, (one && first.body) || template || '');
  const title = titleDraft.value;
  const setTitle = titleDraft.set;
  const body = bodyDraft.value;
  const setBody = bodyDraft.set;
  const [draft, setDraft] = useState(false);
  const [maintainer, setMaintainer] = useState(true);
  const [touched, setTouched] = useState(false);
  const act = useAction();
  const fromFork = head.includes(':');
  const submit = () => {
    setTouched(true);
    if (!title.trim()) return;
    void act.run(async () => {
      const n = await source.createPull({ title: title.trim(), body, head, base, draft, maintainerCanModify: fromFork ? maintainer : undefined });
      titleDraft.clear();
      bodyDraft.clear();
      nav.go({ s: 'pull', n }, { replace: true });
    }, 'open the pull request');
  };
  return (
    <form className="mb-4 flex gap-4" onSubmit={(e) => { e.preventDefault(); submit(); }} aria-label="New pull request">
      {!ui.phone && viewer ? <Avatar c={viewer} src={viewer.avatar} size={40} /> : null}
      <div className="min-w-0 flex-1 space-y-3">
        <label className="grid gap-1 font-semibold">Add a title
          <Input aria-required="true" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 rounded-md border border-border bg-background font-normal group-data-[phone=true]/gh:h-11" />
          {touched && !title.trim() ? <span role="alert" className="text-caption font-normal text-(--gh-closed)">A title is required.</span> : null}
        </label>
        <div className="grid gap-1">
          <span className="font-semibold">Add a description</span>
          <MarkdownField label="Description" value={body} onChange={setBody} onSubmit={submit} rows={8} placeholder="Describe your changes. Writing “Closes” and an issue’s number links it." disabled={act.busy} />
        </div>
        {fromFork ? <Checkbox isSelected={maintainer} onChange={setMaintainer} className="text-detail">Allow edits by maintainers</Checkbox> : null}
        <ActionError error={act.error} onDismiss={act.clear} />
        <div className="flex flex-wrap items-center justify-end gap-3">
          <Checkbox isSelected={draft} onChange={setDraft} className="text-detail">Create as draft</Checkbox>
          <Button type="submit" className={ghButton(true)} isDisabled={act.busy}>{act.busy ? 'Creating…' : draft ? 'Create draft pull request' : 'Create pull request'}</Button>
        </div>
      </div>
    </form>
  );
}
