/* Settings, for admins (GitHub shows others nothing, and neither do we): name, description, website, topics, default
   branch, features, merge button rules, branch protection as it stands, collaborators, visibility and archiving.
   Deleting a repository needs a token scope this sign-in doesn't ask for, so that link goes to GitHub. */
import { useEffect, useState, type ReactNode } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { GhLink, UserLink } from './links';
import { Box, Oct, ghButton } from './parts';
import { SelectMenu } from './pickers';
import type { SettingsPage } from './route';
import { ActionError, Loaded, useAction, useCan, useLoad, useNav, useRepo } from './repo-context';
import type { RepoSettings } from './source';

const PAGES: [SettingsPage, string][] = [['general', 'General'], ['merging', 'Pull requests'], ['branches', 'Branches'], ['collaborators', 'Collaborators']];

export function SettingsTab({ page = 'general' }: { page?: SettingsPage }) {
  const { ui } = useRepo();
  const can = useCan();
  if (!can.admin) return <Box className="px-6 py-16 text-center text-muted-foreground"><Oct name="lock" size={24} /><p className="mt-3 mb-0">Only repository admins can see settings.</p></Box>;
  return (
    <div className={cn('flex gap-6', !ui.wide && 'flex-col gap-3', ui.phone && 'p-4')}>
      <nav aria-label="Settings" className={cn(ui.wide ? 'w-[200px] shrink-0 space-y-0.5' : 'flex overflow-x-auto [scrollbar-width:thin]')}>
        {PAGES.map(([id, label]) => (
          <GhLink key={id} to={{ s: 'settings', page: id }} aria-current={page === id ? 'page' : undefined} className={cn('flex min-h-8 items-center whitespace-nowrap rounded-md px-2 text-detail text-foreground no-underline hover:bg-secondary group-data-[phone=true]/gh:min-h-11', page === id && 'bg-secondary font-semibold')}>{label}</GhLink>
        ))}
      </nav>
      <div className="min-w-0 flex-1 space-y-6">
        {page === 'general' ? <General /> : page === 'merging' ? <Merging /> : page === 'branches' ? <BranchRules /> : <Collaborators />}
      </div>
    </div>
  );
}

function Section({ title, children, danger }: { title: string; children: ReactNode; danger?: boolean }) {
  return (
    <section aria-label={title} className={cn('rounded-md border', danger ? 'border-(--gh-closed)/50' : 'border-border')}>
      <h2 className={cn('m-0 border-b px-4 py-2 text-callout font-semibold', danger ? 'border-(--gh-closed)/50' : 'border-border bg-muted')}>{title}</h2>
      <div className="grid gap-3 p-4">{children}</div>
    </section>
  );
}

function General() {
  const { source, repo, notify } = useRepo();
  const nav = useNav();
  const [name, setName] = useState(repo.name);
  const [description, setDescription] = useState(repo.description);
  const [homepage, setHomepage] = useState(repo.homepage);
  const [topics, setTopics] = useState(repo.topics.join(', '));
  const names = useLoad(source.id + ':refnames', source.refNames).data;
  const act = useAction();
  const danger = useAction();
  const features = useAction();
  useEffect(() => { setName(repo.name); setDescription(repo.description); setHomepage(repo.homepage); setTopics(repo.topics.join(', ')); }, [repo.name, repo.description, repo.homepage, repo.topics.join()]);
  const [confirm, setConfirm] = useState<'archive' | 'visibility' | null>(null);
  const [typed, setTyped] = useState('');
  const toggle = (patch: RepoSettings) => void features.run(() => source.update(patch));
  const save = () => void act.run(async () => {
    const nextTopics = topics.split(',').map((t) => t.trim().toLowerCase().replace(/\s+/g, '-')).filter(Boolean);
    // Topics first: a rename changes the address they'd be sent to.
    if (nextTopics.join() !== repo.topics.join()) await source.setTopics(nextTopics);
    const full = await source.update({ description, homepage, ...(name !== repo.name ? { name } : {}) });
    notify('Settings saved');
    if (full !== source.full) nav.openRepo(full, { s: 'settings' });
  });
  return (
    <>
      <h1 className="m-0 text-title font-semibold">General</h1>
      <Section title="Repository">
        <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <label className="grid gap-1 font-semibold">Repository name<Input value={name} onChange={(e) => setName(e.target.value)} className="h-8 max-w-sm rounded-md border border-border bg-background font-normal group-data-[phone=true]/gh:h-11" /></label>
          <label className="grid gap-1 font-semibold">Description<Input value={description} onChange={(e) => setDescription(e.target.value)} className="h-8 rounded-md border border-border bg-background font-normal group-data-[phone=true]/gh:h-11" /></label>
          <label className="grid gap-1 font-semibold">Website<Input value={homepage} onChange={(e) => setHomepage(e.target.value)} placeholder="https://" className="h-8 rounded-md border border-border bg-background font-normal group-data-[phone=true]/gh:h-11" /></label>
          <label className="grid gap-1 font-semibold">Topics<Input value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="Separated by commas" className="h-8 rounded-md border border-border bg-background font-normal group-data-[phone=true]/gh:h-11" /></label>
          <ActionError error={act.error} onDismiss={act.clear} />
          {repo.archived ? <p className="m-0 text-caption text-muted-foreground">Archived repositories can’t change. Unarchive it below first.</p> : null}
          <div><Button type="submit" className={ghButton(true)} isDisabled={act.busy || !name.trim() || repo.archived}>{act.busy ? 'Saving…' : 'Save changes'}</Button></div>
        </form>
      </Section>
      <Section title="Default branch">
        <p className="m-0 text-muted-foreground">Pull requests and new commits go here unless you say otherwise.</p>
        <div className="flex flex-wrap items-center gap-2">
          <SelectMenu title="Switch the default branch" trigger={<><Oct name="branch" className="text-muted-foreground" /><span className="font-mono text-caption">{repo.branch}</span><Oct name="chevDown" size={12} /></>} selected={[repo.branch]} items={(names?.branches ?? []).map((b) => ({ id: b, label: b }))} filterPlaceholder="Filter branches"
            onApply={(ids) => { if (ids[0]) toggle({ default_branch: ids[0] }); }} />
        </div>
      </Section>
      <Section title="Features">
        <Checkbox isSelected={repo.has.issues} isDisabled={features.busy} onChange={(v) => toggle({ has_issues: v })} className="text-detail">Issues</Checkbox>
        <Checkbox isSelected={repo.has.projects} isDisabled={features.busy} onChange={(v) => toggle({ has_projects: v })} className="text-detail">Projects</Checkbox>
        <Checkbox isSelected={repo.has.wiki} isDisabled={features.busy} onChange={(v) => toggle({ has_wiki: v })} className="text-detail">Wikis</Checkbox>
        <Checkbox isSelected={repo.has.discussions} isDisabled={features.busy} onChange={(v) => toggle({ has_discussions: v })} className="text-detail">Discussions</Checkbox>
        <p className="m-0 text-caption text-muted-foreground">Issues has a tab here. Projects, Wikis and Discussions turn on for github.com; this example doesn’t have screens for them.</p>
        <ActionError error={features.error} />
      </Section>
      <Section title="Danger zone" danger>
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1"><b className="font-semibold">Change visibility</b><p className="m-0 text-caption text-muted-foreground">This repository is {repo.private ? 'private' : 'public'}.</p></div>
          <Button className={cn(ghButton(), 'border-(--gh-closed) text-foreground')} onPress={() => { setConfirm('visibility'); setTyped(''); }}>Make {repo.private ? 'public' : 'private'}</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <div className="min-w-0 flex-1"><b className="font-semibold">{repo.archived ? 'Unarchive' : 'Archive'} this repository</b><p className="m-0 text-caption text-muted-foreground">{repo.archived ? 'It’s read-only now. Unarchive to take changes again.' : 'Mark it read-only for everyone.'}</p></div>
          <Button className={cn(ghButton(), 'border-(--gh-closed) text-foreground')} onPress={() => { setConfirm('archive'); setTyped(''); }}>{repo.archived ? 'Unarchive' : 'Archive'}</Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <div className="min-w-0 flex-1"><b className="font-semibold">Delete this repository</b><p className="m-0 text-caption text-muted-foreground">Needs the delete_repo scope, which this sign-in doesn’t ask for. Do it on GitHub.</p></div>
          {source.live ? <a href={`https://github.com/${source.full}/settings`} target="_blank" rel="noreferrer" className={cn(ghButton(), 'no-underline')}>Open on GitHub<Oct name="external" size={12} /></a> : null}
        </div>
        {confirm ? (
          <form role="alertdialog" aria-label="Are you sure?" className="grid gap-2 rounded-md border border-(--gh-closed)/50 p-3" onSubmit={(e) => {
            e.preventDefault();
            if (typed !== source.full) return;
            void danger.run(async () => { await source.update(confirm === 'archive' ? { archived: !repo.archived } : { private: !repo.private }); setConfirm(null); notify('Done'); });
          }}>
            <label className="grid gap-1">Type <b className="font-mono text-caption font-semibold">{source.full}</b> to confirm
              <Input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} className="h-8 rounded-md border border-border bg-background font-mono text-caption group-data-[phone=true]/gh:h-11" />
            </label>
            <ActionError error={danger.error} />
            <div className="flex justify-end gap-2">
              <Button className={ghButton()} onPress={() => setConfirm(null)}>Cancel</Button>
              <Button type="submit" className={cn(ghButton(), 'border-(--gh-closed) text-foreground')} isDisabled={typed !== source.full || danger.busy}>I understand</Button>
            </div>
          </form>
        ) : null}
      </Section>
    </>
  );
}

function Merging() {
  const { source, repo } = useRepo();
  const act = useAction();
  const toggle = (patch: RepoSettings) => void act.run(() => source.update(patch));
  const on = [repo.merge.merge, repo.merge.squash, repo.merge.rebase].filter(Boolean).length;
  const row = (label: string, hint: string, value: boolean, patch: (v: boolean) => RepoSettings, lastOn?: boolean) => (
    <div>
      <Checkbox isSelected={value} isDisabled={act.busy || (lastOn && value)} onChange={(v) => toggle(patch(v))} className="text-detail font-semibold">{label}</Checkbox>
      <p className="mt-0.5 mb-0 pl-6 text-caption text-muted-foreground">{hint}</p>
    </div>
  );
  return (
    <>
      <h1 className="m-0 text-title font-semibold">Pull requests</h1>
      <Section title="Merge button">
        {row('Allow merge commits', 'Add all commits from the head branch with a merge commit.', repo.merge.merge, (v) => ({ allow_merge_commit: v }), on === 1)}
        {row('Allow squash merging', 'Combine all commits from the head branch into one.', repo.merge.squash, (v) => ({ allow_squash_merge: v }), on === 1)}
        {row('Allow rebase merging', 'Add all commits from the head branch without a merge commit.', repo.merge.rebase, (v) => ({ allow_rebase_merge: v }), on === 1)}
        {on === 1 ? <p className="m-0 text-caption text-muted-foreground">At least one method has to stay on.</p> : null}
        <ActionError error={act.error} onDismiss={act.clear} />
      </Section>
      <Section title="More">
        {row('Allow auto-merge', 'Let people merge automatically once requirements are met.', repo.merge.auto, (v) => ({ allow_auto_merge: v }))}
        {row('Always suggest updating pull request branches', 'Offer “Update branch” whenever a head branch is behind.', repo.merge.updateBranch, (v) => ({ allow_update_branch: v }))}
        {row('Automatically delete head branches', 'Delete a pull request’s branch when it merges.', repo.merge.deleteBranch, (v) => ({ delete_branch_on_merge: v }))}
      </Section>
    </>
  );
}

function BranchRules() {
  const { source, repo } = useRepo();
  const rule = useLoad(`${source.id}:protection:${repo.branch}`, () => source.protection(repo.branch));
  return (
    <>
      <h1 className="m-0 text-title font-semibold">Branches</h1>
      <Section title={`Protection on ${repo.branch}`}>
        <Loaded load={rule}>
          {(p) => p ? (
            <ul className="m-0 list-none space-y-1 p-0">
              <li>{p.reviews ? <><b className="font-semibold">{p.reviews}</b> approving review{p.reviews === 1 ? '' : 's'} required</> : 'No reviews required'}</li>
              <li>{p.checks.length ? <>Required checks: {p.checks.map((c) => <code key={c} className="mx-0.5 rounded bg-secondary px-1 font-mono text-caption">{c}</code>)}</> : 'No checks required'}</li>
              <li>{p.strict ? 'Branches must be up to date before merging' : 'Branches don’t have to be up to date'}</li>
            </ul>
          ) : <p className="m-0 text-muted-foreground">No protection on this branch.</p>}
        </Loaded>
        <p className="m-0 text-caption text-muted-foreground">Rules are edited on GitHub: their form has dozens of options this example doesn’t try to reproduce.{source.live ? <> <a className="text-primary" href={`https://github.com/${source.full}/settings/branches`} target="_blank" rel="noreferrer">Edit on GitHub</a>.</> : null}</p>
      </Section>
    </>
  );
}

const ROLE_VALUE: Record<string, string> = { read: 'pull', pull: 'pull', triage: 'triage', write: 'push', push: 'push', maintain: 'maintain', admin: 'admin' };

function Collaborators() {
  const { source, notify, viewer, repo } = useRepo();
  const people = useLoad(source.id + ':collaborators', source.collaborators);
  const [login, setLogin] = useState('');
  const [permission, setPermission] = useState('push');
  const act = useAction();
  return (
    <>
      <h1 className="m-0 text-title font-semibold">Collaborators</h1>
      <Section title="Add people">
        <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (login.trim()) void act.run(async () => { const already = people.data?.some((u) => u.login.toLowerCase() === login.trim().toLowerCase()); await source.addCollaborator(login.trim(), permission); notify(already ? `Changed ${login.trim()}’s role` : `Invited ${login.trim()}`); setLogin(''); }, 'add that person'); }}>
          <Input aria-label="GitHub username" placeholder="GitHub username" value={login} onChange={(e) => setLogin(e.target.value)} className="h-8 min-w-[180px] flex-1 rounded-md border border-border bg-background group-data-[phone=true]/gh:h-11" />
          <select aria-label="Role" value={permission} onChange={(e) => setPermission(e.target.value)} className="box-border h-8 rounded-md border border-border bg-background px-1 font-sans text-detail text-foreground group-data-[phone=true]/gh:h-11">
            <option value="pull">Read</option><option value="triage">Triage</option><option value="push">Write</option><option value="maintain">Maintain</option><option value="admin">Admin</option>
          </select>
          <Button type="submit" className={ghButton(true)} isDisabled={act.busy || !login.trim()}>Add</Button>
        </form>
        <ActionError error={act.error} onDismiss={act.clear} />
      </Section>
      <Section title="People with access">
        <Loaded load={people}>
          {(list) => (
            <ul className="m-0 list-none p-0">
              {list.map((u) => (
                <li key={u.login} className="flex flex-wrap items-center gap-3 border-t border-border py-2 first:border-t-0">
                  <Avatar c={u} src={u.avatar} size={28} />
                  <UserLink user={u} className="min-w-0 flex-1 truncate font-semibold text-foreground" />
                  {u.login === repo.owner ? <span className="rounded-full border border-border px-2 text-caption text-muted-foreground">Owner</span> : (
                    <select aria-label={`Role for ${u.login}`} value={ROLE_VALUE[u.role] ?? 'push'} disabled={act.busy} onChange={(e) => void act.run(async () => { await source.addCollaborator(u.login, e.target.value); notify(`Changed ${u.login}’s role`); }, 'change that role')} className="box-border h-7 rounded-md border border-border bg-background px-1 font-sans text-caption text-foreground group-data-[phone=true]/gh:h-11">
                      <option value="pull">Read</option><option value="triage">Triage</option><option value="push">Write</option><option value="maintain">Maintain</option><option value="admin">Admin</option>
                    </select>
                  )}
                  {u.login !== viewer?.login && u.login !== repo.owner ? <Button aria-label={`Remove ${u.login}`} className={cn(ghButton(), 'h-7 px-2 text-caption')} isDisabled={act.busy} onPress={() => void act.run(async () => { await source.removeCollaborator(u.login); notify(`Removed ${u.login}`); })}>Remove</Button> : null}
                </li>
              ))}
            </ul>
          )}
        </Loaded>
      </Section>
    </>
  );
}
