/* Releases: the list, one release (notes, assets, source archives), and the form to draft, publish, edit and delete one,
   with GitHub's generated notes. Uploading assets goes to a different host that doesn't allow browsers, so that stays on
   GitHub and the form says so. */
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Release } from './data';
import { GitHubError } from './github-api';
import { GhLink, UserLink } from './links';
import { Pagination } from './lists';
import { MarkdownField, Md } from './markdown';
import { Box, Oct, ghButton } from './parts';
import { ActionError, Failed, Loaded, useAction, useCan, useLoad, useNav, useRepo } from './repo-context';

const size = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

function ReleaseBadge({ r }: { r: Release }) {
  if (r.draft) return <span className="rounded-full border border-(--gh-attention) px-2 text-caption leading-[18px] font-medium text-(--gh-attention)">Draft</span>;
  if (r.prerelease) return <span className="rounded-full border border-(--gh-attention) px-2 text-caption leading-[18px] font-medium text-(--gh-attention)">Pre-release</span>;
  if (r.latest) return <span className="rounded-full border border-(--gh-open) px-2 text-caption leading-[18px] font-medium text-(--gh-open)">Latest</span>;
  return null;
}

function ReleaseCard({ r, full }: { r: Release; full?: boolean }) {
  const can = useCan();
  const { source, notify } = useRepo();
  const nav = useNav();
  const act = useAction();
  const [confirming, setConfirming] = useState(false);
  return (
    <section aria-label={r.name} className="overflow-hidden rounded-md border border-border">
      <div className="flex flex-wrap items-start gap-2 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {full ? <h1 className="m-0 text-title font-semibold">{r.name}</h1> : <GhLink to={{ s: 'release', tag: r.tag }} className="text-title font-semibold text-foreground no-underline hover:text-primary">{r.name}</GhLink>}
            <ReleaseBadge r={r} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-caption text-muted-foreground">
            <Avatar c={r.author} src={r.author.avatar} size={16} /><UserLink user={r.author} className="font-semibold text-foreground" /> {r.draft ? 'drafted this' : 'released this'} <span title={r.at ? new Date(r.at).toLocaleString() : undefined}>{r.when}</span>
            · <GhLink to={{ s: 'code', ref: r.draft ? r.target : r.tag }} className="flex items-center gap-1 text-muted-foreground no-underline hover:text-primary"><Oct name="tag" size={12} />{r.tag}</GhLink>
          </div>
        </div>
        {can.push ? (
          <div className="flex gap-2">
            {r.draft ? <Button className={ghButton(true)} isDisabled={act.busy} onPress={() => void act.run(async () => { await source.updateRelease(r.id, { draft: false }); notify(`${r.tag} published`); })}>Publish</Button> : null}
            <GhLink to={{ s: 'new-release', editing: r.tag }} aria-label={`Edit ${r.name}`} className={cn(ghButton(), 'w-8 px-0 no-underline')}><Oct name="pencil" size={14} /></GhLink>
            <Button aria-label={`Delete ${r.name}`} className={cn(ghButton(), 'w-8 px-0 text-(--gh-closed)')} onPress={() => setConfirming(true)}><Oct name="trash" size={14} /></Button>
          </div>
        ) : null}
      </div>
      {confirming ? (
        <div role="alertdialog" aria-label={`Delete ${r.name}?`} className="flex flex-wrap items-center gap-2 border-t border-border bg-muted px-4 py-2">
          <span className="min-w-0 flex-1 font-semibold">Delete this release? Its tag stays.</span>
          <Button className={ghButton()} onPress={() => setConfirming(false)}>Cancel</Button>
          <Button className={cn(ghButton(), 'text-(--gh-closed)')} isDisabled={act.busy} onPress={() => void act.run(async () => { await source.deleteRelease(r.id); notify('Release deleted'); nav.go({ s: 'releases' }, { replace: true }); })}>Delete</Button>
        </div>
      ) : null}
      <ActionError error={act.error} className="px-4 pb-2" />
      {r.body ? <Md markdown={r.body} className="border-t border-border px-4 py-3" /> : null}
      <div className="border-t border-border">
        <h3 className="m-0 bg-muted px-4 py-2 text-caption font-semibold">Assets {r.assets.length + (r.draft ? 0 : 2)}</h3>
        <ul className="m-0 list-none p-0">
          {r.assets.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-1.5 text-caption">
              <Oct name="zip" size={14} className="text-muted-foreground" /><a href={a.url} className="min-w-0 flex-1 truncate font-semibold text-primary no-underline hover:underline">{a.name}</a>
              <span className="text-muted-foreground">{size(a.size)} · {a.downloads.toLocaleString('en-US')} downloads</span>
            </li>
          ))}
          {!r.draft && r.zip ? <li className="flex items-center gap-2 border-t border-border px-4 py-1.5 text-caption"><Oct name="zip" size={14} className="text-muted-foreground" /><a href={r.zip} className="font-semibold text-primary no-underline hover:underline">Source code (zip)</a></li> : null}
          {!r.draft && r.tar ? <li className="flex items-center gap-2 border-t border-border px-4 py-1.5 text-caption"><Oct name="zip" size={14} className="text-muted-foreground" /><a href={r.tar} className="font-semibold text-primary no-underline hover:underline">Source code (tar.gz)</a></li> : null}
        </ul>
      </div>
    </section>
  );
}

export function ReleasesPage({ page = 1 }: { page?: number }) {
  const { source, ui } = useRepo();
  const nav = useNav();
  const can = useCan();
  const list = useLoad(`${source.id}:releases:${page}`, () => source.releases(page));
  return (
    <div className={cn(ui.phone && 'p-4')}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="m-0 flex-1 text-title font-semibold">Releases</h1>
        <GhLink to={{ s: 'tags' }} className={cn(ghButton(), 'no-underline')}>Tags</GhLink>
        {can.push ? <Button className={ghButton(true)} onPress={() => nav.go({ s: 'new-release' })}>Draft a new release</Button> : null}
      </div>
      <Loaded load={list}>
        {(data) => (
          <div className="space-y-4">
            {data.items.map((r) => <ReleaseCard key={r.id} r={r} />)}
            {!data.items.length ? <Box className="px-6 py-14 text-center"><Oct name="tag" size={24} className="text-muted-foreground" /><h2 className="mt-3 mb-1 text-title font-semibold">There aren’t any releases here</h2><p className="m-0 text-muted-foreground">Releases package software with notes and files.</p></Box> : null}
            <Pagination data={data} go={(p) => nav.go({ s: 'releases', page: p })} />
          </div>
        )}
      </Loaded>
    </div>
  );
}

export function ReleasePage({ tag }: { tag: string }) {
  const { source, ui } = useRepo();
  const release = useLoad(`${source.id}:release:${tag}`, () => source.release(tag));
  if (release.error instanceof GitHubError && release.error.kind === 'notFound') return <div className={cn(ui.phone && 'p-4')}><Failed error={release.error} what={`There’s no release for the tag ${tag}. Drafts are only visible to people who can push.`} /></div>;
  return (
    <div className={cn(ui.phone && 'p-4')}>
      {!ui.phone ? <GhLink to={{ s: 'releases' }} className="mb-3 flex w-fit items-center gap-1 text-detail text-primary no-underline hover:underline"><Oct name="chevLeft" size={14} />Releases</GhLink> : null}
      <Loaded load={release}>{(r) => <ReleaseCard r={r} full />}</Loaded>
    </div>
  );
}

export function ReleaseForm({ tag: initialTag, editing }: { tag?: string; editing?: string }) {
  const { source, repo, ui } = useRepo();
  const nav = useNav();
  const can = useCan();
  const existing = useLoad(`${source.id}:release-edit:${editing ?? ''}`, () => (editing ? source.release(editing) : null));
  const names = useLoad(source.id + ':refnames', source.refNames).data;
  const [tag, setTag] = useState(initialTag ?? '');
  const [target, setTarget] = useState(repo.branch);
  const [name, setName] = useState('');
  const [body, setBody] = useState('');
  const [prerelease, setPrerelease] = useState(false);
  const act = useAction();
  const notes = useAction();
  useEffect(() => {
    const r = existing.data;
    if (r) { setTag(r.tag); setName(r.name); setBody(r.body); setPrerelease(r.prerelease); setTarget(r.target); }
  }, [existing.data]);
  if (!can.push) return <Box className="px-6 py-12 text-center text-muted-foreground">Only people who can push to {source.full} can publish releases.</Box>;
  const save = (draft: boolean) => {
    if (!tag.trim()) return;
    void act.run(async () => {
      const r = existing.data;
      const result = r
        ? await source.updateRelease(r.id, { tag: tag.trim(), name, body, prerelease, ...(r.draft && !draft ? { draft: false } : {}) })
        : await source.createRelease({ tag: tag.trim(), target, name: name || tag.trim(), body, draft, prerelease });
      nav.go(draft ? { s: 'releases' } : { s: 'release', tag: result }, { replace: true });
    });
  };
  const known = names?.tags.includes(tag.trim());
  return (
    <div className={cn('mx-auto max-w-[900px]', ui.phone && 'p-4')}>
      <h1 className="mt-0 mb-4 text-title font-semibold">{editing ? `Edit ${editing}` : 'New release'}</h1>
      <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); save(false); }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 font-semibold">Tag <span className="sr-only">(required)</span>
            <Input aria-required="true" autoFocus value={tag} onChange={(e) => setTag(e.target.value)} placeholder="v1.0.0" className="h-9 rounded-md border border-border bg-background font-mono text-caption font-normal" />
            <span className="text-caption font-normal text-muted-foreground">{tag.trim() ? (known ? 'Existing tag.' : 'A new tag, created when this is published.') : 'Choose an existing tag or name a new one.'}</span>
          </label>
          {!editing ? (
            <label className="grid gap-1 font-semibold">Target
              <select value={target} onChange={(e) => setTarget(e.target.value)} className="box-border h-9 rounded-md border border-border bg-background px-1 font-mono text-caption font-normal text-foreground">
                {(names?.branches ?? [repo.branch]).map((b) => <option key={b}>{b}</option>)}
              </select>
            </label>
          ) : null}
        </div>
        <label className="grid gap-1 font-semibold">Release title
          <Input value={name} onChange={(e) => setName(e.target.value)} className="h-9 rounded-md border border-border bg-background font-normal" />
        </label>
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1 font-semibold">Release notes</span>
            <Button className={ghButton()} isDisabled={!tag.trim() || notes.busy} onPress={() => void notes.run(async () => { const n = await source.generateNotes(tag.trim(), target); setBody(n.body); if (!name) setName(n.name); })}>{notes.busy ? 'Generating…' : 'Generate release notes'}</Button>
          </div>
          <ActionError error={notes.error} />
          <MarkdownField label="Release notes" value={body} onChange={setBody} rows={10} placeholder="Describe this release" />
        </div>
        <p className="m-0 text-caption text-muted-foreground">Attaching binaries happens on GitHub: its upload host doesn’t accept browser requests.</p>
        <Checkbox isSelected={prerelease} onChange={setPrerelease} className="text-detail">Set as a pre-release</Checkbox>
        <ActionError error={act.error} />
        <div className="flex flex-wrap justify-end gap-2">
          <Button className={ghButton()} onPress={() => nav.back()}>Cancel</Button>
          {!editing || existing.data?.draft ? <Button className={ghButton()} isDisabled={act.busy || !tag.trim()} onPress={() => save(true)}>Save draft</Button> : null}
          <Button type="submit" className={ghButton(true)} isDisabled={act.busy || !tag.trim()}>{act.busy ? 'Saving…' : existing.data && !existing.data.draft ? 'Update release' : 'Publish release'}</Button>
        </div>
      </form>
    </div>
  );
}
