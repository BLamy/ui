/* Labels and milestones: the repository's lists, with create, edit and delete for people with triage. A milestone opens to
   its progress and its items. */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { Label, Milestone } from './data';
import { GitHubError, labelOf } from './github-api';
import { GhLink } from './links';
import { ItemRow, Pagination, StateToggle, queryState, setQueryState } from './lists';
import { MarkdownField, Md } from './markdown';
import { Box, LabelChip, Oct, ghButton } from './parts';
import { ActionError, Failed, Loaded, useAction, useCan, useLoad, useNav, useRepo } from './repo-context';

const PRESET = ['d73a4a', '0075ca', 'a2eeef', '7057ff', '008672', 'e4e669', 'd876e3', 'fbca04', 'b60205', '0e8a16'];

function LabelForm({ initial, onCancel, onSave, submit }: { initial?: Label; onCancel: () => void; onSave: (l: { name: string; color: string; description: string }) => Promise<void>; submit: string }) {
  const { ui } = useRepo();
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [color, setColor] = useState((initial?.color ?? '#' + PRESET[3]).replace('#', ''));
  const act = useAction();
  const valid = /^[0-9a-fA-F]{6}$/.test(color);
  return (
    <form className="grid gap-3 p-3" onSubmit={(e) => { e.preventDefault(); if (name.trim() && valid) void act.run(() => onSave({ name: name.trim(), color, description })); }}>
      <div><LabelChip label={{ name: name || 'Label preview', color: valid ? '#' + color : labelOf('').color }} dark={ui.dark} /></div>
      <div className="grid gap-3 sm:grid-cols-[1fr_2fr_auto]">
        <label className="grid gap-1 font-semibold">Label name<Input autoFocus value={name} onChange={(e) => setName(e.target.value)} className="h-8 rounded-md border border-border bg-background font-normal group-data-[phone=true]/gh:h-11" /></label>
        <label className="grid gap-1 font-semibold">Description<Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" className="h-8 rounded-md border border-border bg-background font-normal group-data-[phone=true]/gh:h-11" /></label>
        <label className="grid gap-1 font-semibold">Color
          <span className="flex items-center gap-1">
            <input type="color" aria-label="Pick a color" value={'#' + (valid ? color : '000000')} onChange={(e) => setColor(e.target.value.slice(1))} className="size-8 cursor-pointer rounded-md border border-border bg-transparent p-0.5 group-data-[phone=true]/gh:size-11" />
            <Input aria-invalid={!valid} value={'#' + color} onChange={(e) => setColor(e.target.value.replace('#', ''))} className="h-8 w-24 rounded-md border border-border bg-background font-mono text-caption font-normal group-data-[phone=true]/gh:h-11" />
          </span>
        </label>
      </div>
      <div className="flex flex-wrap gap-1" role="group" aria-label="Suggested colors">
        {PRESET.map((c) => <Button key={c} aria-label={`Use color ${c}`} onPress={() => setColor(c)} className="size-5 cursor-pointer rounded-full border border-border outline-none data-focus-visible:ring-2 data-focus-visible:ring-primary group-data-[phone=true]/gh:size-9" style={{ background: '#' + c }} />)}
      </div>
      {!valid ? <p role="alert" className="m-0 text-caption text-(--gh-closed)">Colors are six hex digits.</p> : null}
      <ActionError error={act.error} onDismiss={act.clear} />
      <div className="flex justify-end gap-2">
        <Button className={ghButton()} onPress={onCancel}>Cancel</Button>
        <Button type="submit" className={ghButton(true)} isDisabled={act.busy || !name.trim() || !valid}>{act.busy ? 'Saving…' : submit}</Button>
      </div>
    </form>
  );
}

export function LabelsPage() {
  const { source, ui, notify } = useRepo();
  const can = useCan();
  const labels = useLoad(source.id + ':labels', source.labels);
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const act = useAction();
  return (
    <div className={cn(ui.phone && 'p-4')}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="m-0 flex-1 text-title font-semibold">Labels</h1>
        <GhLink to={{ s: 'milestones' }} className={cn(ghButton(), 'no-underline')}><Oct name="milestone" className="text-muted-foreground" />Milestones</GhLink>
        {can.triage ? <Button className={ghButton(true)} onPress={() => setCreating(!creating)}>New label</Button> : null}
      </div>
      <label className="mb-3 flex h-8 items-center gap-2 rounded-md border border-border bg-background px-2 text-muted-foreground group-data-[phone=true]/gh:h-11">
        <Oct name="search" /><input aria-label="Search labels" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search all labels" className="min-w-0 flex-1 border-0 bg-transparent font-sans text-detail text-foreground outline-none select-text" />
      </label>
      {creating ? <Box className="mb-3"><LabelForm submit="Create label" onCancel={() => setCreating(false)} onSave={async (l) => { await source.createLabel(l); setCreating(false); notify('Label created'); }} /></Box> : null}
      <ActionError error={act.error} onDismiss={act.clear} className="mb-2" />
      <Loaded load={labels}>
        {(list) => {
          const rows = list.filter((l) => !q || l.name.toLowerCase().includes(q.toLowerCase()) || l.description?.toLowerCase().includes(q.toLowerCase()));
          return (
            <Box header={<b className="font-semibold">{rows.length} label{rows.length === 1 ? '' : 's'}</b>}>
              {rows.map((l) => (
                <div key={l.name} className="border-t border-border first:border-t-0">
                  {editing === l.name ? (
                    <LabelForm initial={l} submit="Save changes" onCancel={() => setEditing(null)} onSave={async (next) => { await source.updateLabel(l.name, { name: next.name, color: next.color, description: next.description }); setEditing(null); }} />
                  ) : (
                    <div className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                      <div className="w-[180px] max-w-full shrink-0"><GhLink to={{ s: 'issues', q: `is:open label:"${l.name}"` }} className="no-underline"><LabelChip label={l} dark={ui.dark} /></GhLink></div>
                      <span className="min-w-0 flex-1 text-caption text-muted-foreground">{l.description}</span>
                      {can.triage ? (
                        deleting === l.name ? (
                          <span role="alertdialog" aria-label={`Delete ${l.name}?`} className="flex flex-wrap items-center gap-2">
                            <span className="text-caption">Remove it from everything?</span>
                            <Button className={cn(ghButton(), 'h-7 px-2 text-caption')} onPress={() => setDeleting(null)}>Cancel</Button>
                            <Button className={cn(ghButton(), 'h-7 px-2 text-caption border-(--gh-closed) text-foreground')} isDisabled={act.busy} onPress={() => void act.run(async () => { await source.deleteLabel(l.name); setDeleting(null); notify('Label deleted'); })}>Delete</Button>
                          </span>
                        ) : (
                          <span className="flex gap-2">
                            <Button className={cn(ghButton(), 'h-7 px-2 text-caption')} onPress={() => setEditing(l.name)} aria-label={`Edit label ${l.name}`}>Edit</Button>
                            <Button className={cn(ghButton(), 'h-7 px-2 text-caption')} onPress={() => setDeleting(l.name)} aria-label={`Delete label ${l.name}`}>Delete</Button>
                          </span>
                        )
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
              {!rows.length ? <div className="px-4 py-10 text-center text-muted-foreground">No labels match.</div> : null}
            </Box>
          );
        }}
      </Loaded>
    </div>
  );
}

function MilestoneForm({ initial, submit, onCancel, onSave }: { initial?: Milestone; submit: string; onCancel: () => void; onSave: (m: { title: string; description: string; due: string | null }) => Promise<void> }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [due, setDue] = useState(initial?.due?.slice(0, 10) ?? '');
  const act = useAction();
  return (
    <form className="grid gap-3 p-3" onSubmit={(e) => { e.preventDefault(); if (title.trim()) void act.run(() => onSave({ title: title.trim(), description, due: due ? new Date(due + 'T00:00:00Z').toISOString() : null })); }}>
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <label className="grid gap-1 font-semibold">Title<Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 rounded-md border border-border bg-background font-normal group-data-[phone=true]/gh:h-11" /></label>
        <label className="grid gap-1 font-semibold">Due date (optional)<input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="box-border h-8 rounded-md border border-border bg-background px-2 font-sans text-detail font-normal text-foreground group-data-[phone=true]/gh:h-11" /></label>
      </div>
      <div className="grid gap-1"><span className="font-semibold">Description</span><MarkdownField label="Description" value={description} onChange={setDescription} rows={3} placeholder="What’s in this milestone?" /></div>
      <ActionError error={act.error} onDismiss={act.clear} />
      <div className="flex justify-end gap-2">
        <Button className={ghButton()} onPress={onCancel}>Cancel</Button>
        <Button type="submit" className={ghButton(true)} isDisabled={act.busy || !title.trim()}>{act.busy ? 'Saving…' : submit}</Button>
      </div>
    </form>
  );
}

export function MilestonesPage({ state = 'open' }: { state?: 'open' | 'closed' }) {
  const { source, ui, notify } = useRepo();
  const nav = useNav();
  const can = useCan();
  const milestones = useLoad(`${source.id}:milestones:${state}`, () => source.milestones(state));
  const all = useLoad(`${source.id}:milestones:all`, () => source.milestones('all')).data ?? [];
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);
  const act = useAction();
  return (
    <div className={cn(ui.phone && 'p-4')}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="m-0 flex-1 text-title font-semibold">Milestones</h1>
        <GhLink to={{ s: 'labels' }} className={cn(ghButton(), 'no-underline')}><Oct name="tag" className="text-muted-foreground" />Labels</GhLink>
        {can.triage ? <Button className={ghButton(true)} onPress={() => setCreating(!creating)}>New milestone</Button> : null}
      </div>
      {creating ? <Box className="mb-3"><MilestoneForm submit="Create milestone" onCancel={() => setCreating(false)} onSave={async (m) => { await source.createMilestone(m); setCreating(false); notify('Milestone created'); }} /></Box> : null}
      <ActionError error={act.error} onDismiss={act.clear} className="mb-2" />
      <Box header={<StateToggle value={state} onChange={(v) => nav.go({ s: 'milestones', state: v }, { replace: true })} open={all.filter((m) => m.state === 'open').length} closed={all.filter((m) => m.state === 'closed').length} closedIcon="check" />}>
        <Loaded load={milestones} className="rounded-none border-0">
          {(list) => (
            <>
              {list.map((m) => (
                <div key={m.number} className="border-t border-border first:border-t-0">
                  {editing === m.number ? (
                    <MilestoneForm initial={m} submit="Save changes" onCancel={() => setEditing(null)} onSave={async (next) => { await source.updateMilestone(m.number, next); setEditing(null); }} />
                  ) : (
                    <div className="flex flex-wrap gap-4 px-4 py-3">
                      <div className="min-w-[200px] flex-1">
                        <GhLink to={{ s: 'milestone', n: m.number }} className="text-title font-semibold text-foreground no-underline hover:text-primary">{m.title}</GhLink>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-caption text-muted-foreground">{m.state === 'closed' ? `Closed ${m.closedWhen ?? ''}` : m.dueWhen ? <><Oct name="calendar" size={12} />Due by {m.dueWhen}</> : 'No due date'}</div>
                        {m.description ? <p className="mt-1 mb-0 text-caption text-muted-foreground">{m.description}</p> : null}
                      </div>
                      <div className="w-full sm:w-[300px]">
                        <Progress aria-label={`${m.title}: ${m.pct}% complete`} value={m.pct} size="sm" tone="success" />
                        <div className="mt-1.5 flex gap-3 text-caption text-muted-foreground"><span><b className="font-semibold text-foreground">{m.pct}%</b> complete</span><span><b className="font-semibold text-foreground">{m.open}</b> open</span><span><b className="font-semibold text-foreground">{m.closed}</b> closed</span></div>
                        {can.triage ? (
                          deleting === m.number ? (
                            <div role="alertdialog" aria-label={`Delete ${m.title}?`} className="mt-2 flex flex-wrap items-center gap-2 text-caption">
                              <span>Delete it? Its items stay.</span>
                              <Button className={cn(ghButton(), 'h-7 px-2 text-caption')} onPress={() => setDeleting(null)}>Cancel</Button>
                              <Button className={cn(ghButton(), 'h-7 px-2 text-caption border-(--gh-closed) text-foreground')} isDisabled={act.busy} onPress={() => void act.run(async () => { await source.deleteMilestone(m.number); setDeleting(null); })}>Delete</Button>
                            </div>
                          ) : (
                            <div className="mt-2 flex gap-2">
                              <Button aria-label={`Edit ${m.title}`} className={cn(ghButton(), 'h-7 px-2 text-caption')} onPress={() => setEditing(m.number)}>Edit</Button>
                              <Button aria-label={`${m.state === 'open' ? 'Close' : 'Reopen'} ${m.title}`} className={cn(ghButton(), 'h-7 px-2 text-caption')} isDisabled={act.busy} onPress={() => void act.run(() => source.updateMilestone(m.number, { state: m.state === 'open' ? 'closed' : 'open' }))}>{m.state === 'open' ? 'Close' : 'Reopen'}</Button>
                              <Button aria-label={`Delete ${m.title}`} className={cn(ghButton(), 'h-7 px-2 text-caption')} onPress={() => setDeleting(m.number)}>Delete</Button>
                            </div>
                          )
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {!list.length ? <div className="px-4 py-14 text-center"><Oct name="milestone" size={24} className="text-muted-foreground" /><h2 className="mt-3 mb-1 text-title font-semibold">No {state} milestones</h2></div> : null}
            </>
          )}
        </Loaded>
      </Box>
    </div>
  );
}

export function MilestonePage({ number, q, page = 1 }: { number: number; q?: string; page?: number }) {
  const { source, ui } = useRepo();
  const nav = useNav();
  const milestone = useLoad(`${source.id}:milestone:${number}`, () => source.milestone(number));
  const state = q ?? 'is:open';
  const items = useLoad(`${source.id}:milestone-items:${number}:${state}:${page}:${milestone.data?.title ?? ''}`, () => (milestone.data ? source.searchIssues(`${state} milestone:"${milestone.data.title}"`, page) : null));
  const pulls = useLoad(`${source.id}:milestone-pulls:${number}:${state}:${milestone.data?.title ?? ''}`, () => (milestone.data ? source.searchPulls(`${state} milestone:"${milestone.data.title}"`, 1) : null));
  if (milestone.error instanceof GitHubError && milestone.error.kind === 'notFound') return <div className={cn(ui.phone && 'p-4')}><Failed error={milestone.error} what={`There’s no milestone ${number} here.`} /></div>;
  return (
    <div className={cn(ui.phone && 'p-4')}>
      {!ui.phone ? <GhLink to={{ s: 'milestones' }} className="mb-3 flex w-fit items-center gap-1 text-detail text-primary no-underline hover:underline"><Oct name="chevLeft" size={14} />Milestones</GhLink> : null}
      <Loaded load={milestone}>
        {(m) => (
          <>
            <h1 className="mt-0 mb-1 text-title font-semibold">{m.title}</h1>
            <p className="mt-0 mb-2 text-caption text-muted-foreground">{m.state === 'closed' ? `Closed ${m.closedWhen ?? ''}` : m.dueWhen ? `Due by ${m.dueWhen}` : 'No due date'}</p>
            {m.description ? <Md markdown={m.description} className="mb-3" /> : null}
            <div className="mb-4 max-w-md">
              <Progress aria-label={`${m.pct}% complete`} value={m.pct} size="sm" tone="success" />
              <div className="mt-1.5 text-caption text-muted-foreground"><b className="font-semibold text-foreground">{m.pct}%</b> complete · {m.open} open · {m.closed} closed</div>
            </div>
            <Box header={<StateToggle value={queryState(state)} onChange={(v) => nav.go({ s: 'milestone', n: number, q: setQueryState(state, v) }, { replace: true })} open={m.open} closed={m.closed} closedIcon="check" />}>
              <Loaded load={items} className="rounded-none border-0">
                {(data) => (
                  <>
                    {(pulls.data?.items ?? []).map((p) => <ItemRow key={p.number} state={p.state === 'merged' ? 'merged' : p.state === 'closed' ? 'prClosed' : p.state === 'draft' ? 'draft' : 'prOpen'} stateText={p.state} title={p.title} to={{ s: 'pull', n: p.number }} labels={p.labels} assignees={p.assignees ?? []} comments={p.comments} meta={<>#{p.number} by {p.author.login}</>} />)}
                    {(data?.items ?? []).map((i) => <ItemRow key={i.number} state={i.state === 'open' ? 'open' : 'closed'} stateText={i.state} title={i.title} to={{ s: 'issue', n: i.number }} labels={i.labels} assignees={i.assignees} comments={i.comments} meta={<>#{i.number} by {i.author.login}</>} />)}
                    {!data?.items.length && !pulls.data?.items.length ? <div className="px-4 py-10 text-center text-muted-foreground">Nothing {queryState(state)} in this milestone.</div> : null}
                  </>
                )}
              </Loaded>
            </Box>
            {items.data ? <Pagination data={items.data} go={(p) => nav.go({ s: 'milestone', n: number, q: state, page: p })} /> : null}
          </>
        )}
      </Loaded>
    </div>
  );
}
