/* Changing files from the browser: edit, create and delete, each ending in GitHub's commit form: a message, and either
   commit to this branch or to a new one and open a pull request. Without write access the same action offers to fork
   first, as GitHub does. A file that changed while you edited comes back from GitHub as a conflict; your text stays. */
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { GitHubError } from './github-api';
import { GhLink } from './links';
import { Box, CodeView, Oct, ghButton } from './parts';
import type { Route } from './route';
import { ActionError, CancelButton, Loaded, useAction, useCan, useDraft, useLoad, useNav, useRepo } from './repo-context';

function CommitForm({ busy, error, defaultMessage, gitRef, submitLabel, danger, dirty = false, isDisabled, onSubmit, onCancel }: {
  busy: boolean; error: unknown; defaultMessage: string; gitRef: string; submitLabel: string; danger?: boolean; dirty?: boolean; isDisabled?: boolean;
  onSubmit: (o: { message: string; branch: string; newBranch: string | null }) => void; onCancel: () => void;
}) {
  const { repo } = useRepo();
  const [message, setMessage] = useState('');
  const [details, setDetails] = useState('');
  const branch = gitRef || repo.branch;
  const [mode, setMode] = useState<'direct' | 'new'>('direct');
  const [newBranch, setNewBranch] = useState('');
  useEffect(() => setNewBranch(`patch-${String(Date.now()).slice(-5)}`), []);
  const send = () => {
    const title = (message.trim() || defaultMessage).trim();
    onSubmit({ message: details.trim() ? `${title}\n\n${details.trim()}` : title, branch, newBranch: mode === 'new' ? newBranch.trim() : null });
  };
  return (
    <form className="mt-4 rounded-md border border-border p-4" onSubmit={(e) => { e.preventDefault(); send(); }}>
      <h2 className="mt-0 mb-2 text-callout font-semibold">Commit changes</h2>
      <div className="grid gap-2">
        <Input aria-label="Commit message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder={defaultMessage} className="h-8 rounded-md border border-border bg-background group-data-[phone=true]/gh:h-11" />
        <textarea aria-label="Extended description" value={details} onChange={(e) => setDetails(e.target.value)} rows={3} placeholder="Add an optional extended description…" className="box-border w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 font-sans text-detail text-foreground outline-none select-text focus:border-primary" />
        <fieldset className="m-0 grid gap-1.5 border-0 p-0">
          <legend className="sr-only">Where to commit</legend>
          <label className="flex cursor-pointer items-start gap-2"><input type="radio" name="commit-where" className="mt-1" checked={mode === 'direct'} onChange={() => setMode('direct')} /><span>Commit directly to the <b className="font-mono text-caption font-semibold">{branch}</b> branch</span></label>
          <label className="flex cursor-pointer items-start gap-2"><input type="radio" name="commit-where" className="mt-1" checked={mode === 'new'} onChange={() => setMode('new')} /><span>Create a <b className="font-semibold">new branch</b> for this commit and start a pull request</span></label>
          {mode === 'new' ? <Input aria-label="New branch name" value={newBranch} onChange={(e) => setNewBranch(e.target.value)} className="ml-5 h-8 w-[calc(100%-20px)] max-w-sm rounded-md border border-border bg-background font-mono text-caption group-data-[phone=true]/gh:h-11" /> : null}
        </fieldset>
        <ActionError error={error} />
        <div className="flex flex-wrap justify-end gap-2">
          <CancelButton dirty={dirty} isDisabled={busy} onCancel={onCancel} />
          <Button type="submit" className={cn(danger ? ghButton() : ghButton(true), danger && 'text-(--gh-closed)')} isDisabled={busy || isDisabled || (mode === 'new' && !newBranch.trim())}>{busy ? 'Committing…' : submitLabel}</Button>
        </div>
      </div>
    </form>
  );
}

/** Commits via `write`, on a new branch first if asked, then shows the result (or the compare page for a new branch). */
function useCommit() {
  const { source } = useRepo();
  const nav = useNav();
  const act = useAction();
  // A branch made on an earlier try that then failed: trying again uses it instead of tripping over it.
  const madeBranch = useRef<string | null>(null);
  const { repo } = useRepo();
  const commit = (o: { message: string; branch: string; newBranch: string | null }, write: (branch: string, message: string) => Promise<unknown>, after: (branch: string) => void) => act.run(async () => {
    if (o.newBranch && madeBranch.current !== o.newBranch) {
      await source.createBranch(o.newBranch, o.branch);
      madeBranch.current = o.newBranch;
    }
    await write(o.newBranch ?? o.branch, o.message);
    // On a fork the point is usually the pull request back to where it came from.
    if (repo.parent) nav.openRepo(repo.parent, { s: 'compare', head: `${repo.owner}:${o.newBranch ?? o.branch}`, create: true });
    else if (o.newBranch) nav.go({ s: 'compare', base: o.branch, head: o.newBranch, create: true }, { replace: true });
    else after(o.branch);
  });
  return { commit, busy: act.busy, error: act.error };
}

/** Fork-to-edit, for people who can't push here. */
function NoPush({ verb, then }: { verb: string; then?: Route }) {
  const { source, repo } = useRepo();
  const nav = useNav();
  const can = useCan();
  const act = useAction();
  if (repo.archived) return <Box className="px-6 py-10 text-center text-muted-foreground">This repository is archived, so its files can’t change.</Box>;
  return (
    <Box className="px-6 py-10 text-center">
      <Oct name="fork" size={24} className="text-muted-foreground" />
      <h2 className="mt-3 mb-1 text-title font-semibold">You need a fork to {verb} this</h2>
      <p className="mt-0 mb-4 text-muted-foreground">You can’t write to {source.full}. Fork it, make the change there, and open a pull request back.</p>
      {can.signedIn ? <Button className={ghButton(true)} isDisabled={act.busy} onPress={() => void act.run(async () => { const full = await source.fork({}); nav.openRepo(full, then); })}>{act.busy ? 'Forking…' : 'Fork this repository'}</Button> : null}
      <ActionError error={act.error} onDismiss={act.clear} className="mt-2 justify-center" />
    </Box>
  );
}

/** Commits go on branches. A tag or a commit can be read, not written. */
function useOnBranch(gitRef: string) {
  const { source, repo } = useRepo();
  const names = useLoad(source.id + ':refnames', source.refNames).data;
  return !gitRef || gitRef === repo.branch || !names || names.branches.includes(gitRef);
}

function NotABranch({ gitRef, path }: { gitRef: string; path?: string }) {
  const { repo } = useRepo();
  return (
    <Box className="px-6 py-10 text-center" role="alert">
      <h2 className="mt-0 mb-1 text-title font-semibold">You can’t commit here</h2>
      <p className="mt-0 mb-4 text-muted-foreground"><b className="font-mono text-caption">{gitRef.slice(0, 40)}</b> isn’t a branch: it’s a tag or a commit, which don’t move. Switch to a branch to change files.</p>
      <GhLink to={{ s: 'code', path }} className={cn(ghButton(), 'no-underline')}>Go to {repo.branch}</GhLink>
    </Box>
  );
}

export function EditFile({ path, gitRef = '' }: { path: string; gitRef?: string }) {
  const { source, ui, repo } = useRepo();
  const nav = useNav();
  const can = useCan();
  const onBranch = useOnBranch(gitRef);
  const text = useLoad(`${source.id}:file:${gitRef}:${path}:false`, () => source.file(path, gitRef));
  const sha = useLoad(`${source.id}:sha:${gitRef}:${path}`, () => source.fileSha(path, gitRef));
  /* The version you started from, fixed when it first arrives. A refresh must never move this: sending the newest sha with
     text based on an older one is how a commit silently overwrites someone else's. GitHub only says "conflict" if we send the old one. */
  const base = useRef<{ text: string | null; sha: string | null } | null>(null);
  if (!base.current && text.data !== undefined && sha.data !== undefined) base.current = { text: text.data, sha: sha.data };
  const draftKey = `${source.id}:edit:${gitRef || repo.branch}:${path}`;
  const startedFrom = useDraft(`${draftKey}:base`);
  const draft = useDraft(draftKey, base.current?.text ?? '');
  const [preview, setPreview] = useState(false);
  const { commit, busy, error } = useCommit();
  const value = draft.value;
  const name = path.split('/').at(-1) ?? path;
  // A restored draft was based on the sha it started from, not on whatever's newest now.
  const baseSha = startedFrom.value || base.current?.sha || null;
  useEffect(() => { if (draft.dirty && !startedFrom.value && base.current?.sha) startedFrom.set(base.current.sha); }, [draft.dirty, draft.value]);
  const leave = (to: Route) => { draft.clear(); startedFrom.clear(); nav.go(to, { replace: true }); };
  if (!onBranch) return <div className={cn(ui.phone && 'p-4')}><NotABranch gitRef={gitRef} path={path} /></div>;
  if (!can.push) return <div className={cn(ui.phone && 'p-4')}><NoPush verb="edit" then={{ s: 'edit', ref: gitRef || undefined, path, mode: 'edit' }} /></div>;
  const conflict = error instanceof GitHubError && error.status === 409;
  return (
    <div className={cn(ui.phone && 'p-4')}>
      <h1 className="mt-0 mb-3 text-title font-semibold break-all">Editing {path}</h1>
      <p className="mt-0 mb-3 text-muted-foreground">on <b className="font-mono text-caption font-semibold">{gitRef || repo.branch}</b></p>
      {draft.restored && draft.dirty ? <p role="status" className="mt-0 mb-3 rounded-md border border-border bg-muted px-3 py-2 text-caption">These are your unsaved edits from earlier. Cancel discards them.</p> : null}
      <Loaded load={text}>
        {(original) => original == null ? <Box className="px-6 py-10 text-center text-muted-foreground">Binary files can’t be edited here.</Box> : (
          <>
            <Box header={
              <div role="group" aria-label="Editor view" className="flex gap-0.5 rounded-md bg-secondary p-0.5">
                {[['Edit', false], ['Preview', true]].map(([l, p]) => (
                  <Button key={String(l)} aria-pressed={preview === p} onPress={() => setPreview(p as boolean)} className={cn('h-7 cursor-pointer rounded-md border-0 px-2.5 text-caption font-medium outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary group-data-[phone=true]/gh:h-11', preview === p ? 'bg-background text-foreground shadow-hairline' : 'bg-transparent text-muted-foreground')}>{String(l)}</Button>
                ))}
              </div>
            }>
              {preview ? <CodeView path={path} code={value} /> : (
                <textarea aria-label={`Contents of ${name}`} value={value} onChange={(e) => draft.set(e.target.value)} spellCheck={false} rows={Math.min(30, Math.max(12, value.split('\n').length + 2))}
                  className="box-border block w-full resize-y border-0 bg-background p-3 font-mono text-caption leading-5 text-foreground outline-none select-text focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" />
              )}
            </Box>
            {conflict ? (
              <div role="alert" className="mt-4 rounded-md border border-(--gh-closed)/50 p-3">
                <p className="mt-0 mb-2 font-semibold text-(--gh-closed)">{name} changed on GitHub while you were editing, so nothing was committed.</p>
                <p className="mt-0 mb-2 text-caption text-muted-foreground">Your text is still here. Committing it now would overwrite the other change, so copy what you need, then start again from the newest version.</p>
                <GhLink to={{ s: 'commits', ref: gitRef || undefined, path }} className="text-caption">See what changed</GhLink>
              </div>
            ) : null}
            {!draft.dirty ? <p className="mt-4 mb-0 text-caption text-muted-foreground">Change something to commit it.</p> : null}
            <CommitForm busy={busy} error={conflict ? null : error} dirty={draft.dirty} isDisabled={!draft.dirty} defaultMessage={`Update ${name}`} gitRef={gitRef} submitLabel="Commit changes"
              onCancel={() => { draft.clear(); startedFrom.clear(); nav.back(); }}
              onSubmit={(o) => void commit(o, (branch, message) => source.putFile({ path, content: value, message, branch, sha: baseSha }), (branch) => leave({ s: 'code', ref: branch === repo.branch ? undefined : branch, path }))} />
          </>
        )}
      </Loaded>
    </div>
  );
}

export function DeleteFile({ path, gitRef = '' }: { path: string; gitRef?: string }) {
  const { source, ui, repo } = useRepo();
  const nav = useNav();
  const can = useCan();
  const sha = useLoad(`${source.id}:sha:${gitRef}:${path}`, () => source.fileSha(path, gitRef));
  const { commit, busy, error } = useCommit();
  const name = path.split('/').at(-1) ?? path;
  const onBranch = useOnBranch(gitRef);
  if (!onBranch) return <div className={cn(ui.phone && 'p-4')}><NotABranch gitRef={gitRef} path={path} /></div>;
  if (!can.push) return <div className={cn(ui.phone && 'p-4')}><NoPush verb="delete" then={{ s: 'edit', ref: gitRef || undefined, path, mode: 'delete' }} /></div>;
  if (sha.data === null) {
    return <div className={cn(ui.phone && 'p-4')}><Box className="px-6 py-10 text-center" role="alert"><h1 className="mt-0 mb-1 text-title font-semibold">Nothing to delete</h1><p className="m-0 text-muted-foreground">There’s no <b className="font-mono text-caption">{path}</b> on {gitRef || repo.branch}.</p></Box></div>;
  }
  return (
    <div className={cn(ui.phone && 'p-4')}>
      <h1 className="mt-0 mb-3 text-title font-semibold break-all">Delete {path}</h1>
      <p className="m-0 text-muted-foreground">This removes the file from <b className="font-mono text-caption font-semibold">{gitRef || repo.branch}</b>. It stays in the history.</p>
      <CommitForm busy={busy} error={error} defaultMessage={`Delete ${name}`} gitRef={gitRef} submitLabel={sha.data ? 'Delete file' : 'Finding the file…'} isDisabled={!sha.data} danger onCancel={() => nav.back()}
        onSubmit={(o) => { if (sha.data) void commit(o, (branch, message) => source.deleteFile({ path, message, branch, sha: sha.data! }), (branch) => nav.go({ s: 'code', ref: branch === repo.branch ? undefined : branch, path: path.split('/').slice(0, -1).join('/') || undefined }, { replace: true })); }} />
    </div>
  );
}

export function NewFile({ gitRef = '', dir = '', name: initialName = '', content = '', message }: { gitRef?: string; dir?: string; name?: string; content?: string; message?: string }) {
  const { source, ui, repo } = useRepo();
  const nav = useNav();
  const can = useCan();
  const key = `${source.id}:new-file:${gitRef || repo.branch}:${dir}`;
  const nameDraft = useDraft(`${key}:name`, initialName);
  const bodyDraft = useDraft(`${key}:body`, content);
  const name = nameDraft.value;
  const setName = nameDraft.set;
  const body = bodyDraft.value;
  const setBody = bodyDraft.set;
  const onBranch = useOnBranch(gitRef);
  const { commit, busy, error } = useCommit();
  const [touched, setTouched] = useState(false);
  const clean = name.trim().replace(/^\/+/, '');
  const full = [dir, clean].filter(Boolean).join('/');
  const tree = useLoad(`${source.id}:tree:${gitRef}`, () => source.tree(gitRef)).data ?? [];
  const paths = flat(tree);
  const exists = !!clean && paths.includes(full);
  // A file can't be a folder: "README.md/x" is refused by GitHub, so say why first.
  const underFile = !!clean && full.split('/').slice(0, -1).some((_, i, parts) => { const at = parts.slice(0, i + 1).join('/'); return fileAt(tree, at); });
  if (!onBranch) return <div className={cn(ui.phone && 'p-4')}><NotABranch gitRef={gitRef} /></div>;
  if (!can.push) return <div className={cn(ui.phone && 'p-4')}><NoPush verb="add a file to" /></div>;
  return (
    <div className={cn(ui.phone && 'p-4')}>
      <h1 className="mt-0 mb-3 text-title font-semibold">New file</h1>
      <div className="mb-3 flex flex-wrap items-center gap-1">
        <span className="text-muted-foreground">{repo.name}{dir ? ` / ${dir}` : ''} /</span>
        <Input aria-label="File name" aria-invalid={touched && (!clean || exists)} autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Name your file… (a/b.txt makes folders)" className="h-8 min-w-[220px] flex-1 rounded-md border border-border bg-background font-mono text-caption group-data-[phone=true]/gh:h-11" />
        <span className="text-muted-foreground">in <b className="font-mono text-caption font-semibold">{gitRef || repo.branch}</b></span>
      </div>
      {exists ? <p role="alert" className="mt-0 mb-2 text-caption text-(--gh-closed)">A file with that name already exists. <GhLink to={{ s: 'edit', ref: gitRef || undefined, path: full, mode: 'edit' }}>Edit it instead</GhLink>.</p> : null}
      {underFile ? <p role="alert" className="mt-0 mb-2 text-caption text-(--gh-closed)">Part of that path is a file, not a folder.</p> : null}
      {touched && !clean ? <p role="alert" className="mt-0 mb-2 text-caption text-(--gh-closed)">A file needs a name.</p> : null}
      <Box>
        <textarea aria-label="File contents" value={body} onChange={(e) => setBody(e.target.value)} spellCheck={false} rows={16} placeholder="Enter file contents here"
          className="box-border block w-full resize-y border-0 bg-background p-3 font-mono text-caption leading-5 text-foreground outline-none select-text focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary" />
      </Box>
      <CommitForm busy={busy} error={error} defaultMessage={message ?? (clean ? `Create ${clean}` : 'Create a new file')} gitRef={gitRef} submitLabel="Commit new file" dirty={nameDraft.dirty || bodyDraft.dirty} onCancel={() => { nameDraft.clear(); bodyDraft.clear(); nav.back(); }}
        onSubmit={(o) => {
          setTouched(true);
          if (!clean || exists || underFile) return;
          void commit(o, async (branch, m) => { await source.putFile({ path: full, content: body, message: m, branch }); nameDraft.clear(); bodyDraft.clear(); }, (branch) => nav.go({ s: 'code', ref: branch === repo.branch ? undefined : branch, path: full }, { replace: true }));
        }} />
    </div>
  );
}

const fileAt = (nodes: { path: string; type?: string; children?: unknown[] }[], path: string): boolean => nodes.some((n) => (n.path === path && n.type === 'file') || (n.children ? fileAt(n.children as { path: string; type?: string; children?: unknown[] }[], path) : false));
const flat = (nodes: { path: string; children?: unknown[] }[]): string[] => nodes.flatMap((n) => [n.path, ...(n.children ? flat(n.children as { path: string; children?: unknown[] }[]) : [])]);
