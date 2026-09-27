/* A pull request: title and state, then Conversation (timeline, merge box, comment composer), Commits, Checks and
   Files changed. */
import { useState, type ReactNode } from 'react';
import {
  Avatar, Button, Composer, ComposerCard, ComposerFooter, ComposerInput, ComposerSend, ComposerSpacer, ComposerText, MarkdownView, Progress, TabView, TabViewBar, TabViewFooter, TabViewList, TabViewPanels, cn,
} from '@brett_lamy/ui';
import { ME, PR_CHECKS, PR_COMMITS, PR_FILES, PR_TIMELINE, PULLS, USERS, type FileNode, type PullRequest, type TimelineItem } from './data';
import { AvatarStack, Box, DiffStat, DiffView, FileTree, FlowPanel, LabelChip, Oct, StatePill, UnderlineTab, ghButton, githubMarkdown, Branch, PR_STATE, type OctName, type Layout, type Nav } from './parts';

export type PullRequestTab = 'conversation' | 'commits' | 'checks' | 'files';

export function PullRequestView({ ui, number, nav, initialTab = 'conversation' }: { ui: Layout; number: number; nav: Nav; initialTab?: PullRequestTab }) {
  const p = PULLS.find((x) => x.number === number) ?? PULLS[0];
  const [sub, setSub] = useState<string>(initialTab);
  return (
    <div className={cn(ui.phone && 'px-4 py-4')}>
      {!ui.phone ? (
        <button type="button" onClick={() => nav.openPr(null)} className="mb-3 flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-[14px] text-bl-tint hover:underline">
          <Oct name="chevLeft" size={14} />Pull requests
        </button>
      ) : null}
      <div className="flex items-start gap-4">
        <h1 className={cn('m-0 min-w-0 flex-1 leading-tight font-normal', ui.phone ? 'text-[22px]' : 'text-[32px]')}>
          {p.title} <span className="font-light text-bl-label2">#{p.number}</span>
        </h1>
        {!ui.phone ? (
          <div className="flex shrink-0 gap-2 pt-1.5">
            <Button className={ghButton()}>Edit</Button>
            <Button className={ghButton(true)} onPress={nav.clone}><Oct name="code" />Code<Oct name="chevDown" size={12} /></Button>
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-bl-sep pb-4 text-bl-label2">
        <StatePill state={PR_STATE[p.state]} />
        <span className="leading-6">
          <b className="font-semibold text-bl-label">{p.author.login}</b> wants to merge {p.commits} commits into <Branch>{p.base}</Branch> from <Branch>{p.head}</Branch>
        </span>
      </div>
      <TabView placement="top" selectedKey={sub} onSelectionChange={(k) => setSub(String(k))} className="mt-2">
        <TabViewBar variant="plain" className="overflow-x-auto border-b border-bl-sep [scrollbar-width:none]">
          <TabViewList aria-label="Pull request" className="flex gap-1">
            <UnderlineTab id="conversation" icon="comment" label="Conversation" count={p.comments} />
            <UnderlineTab id="commits" icon="commit" label="Commits" count={PR_COMMITS.length} />
            <UnderlineTab id="checks" icon="checkFill" label="Checks" count={PR_CHECKS.length} />
            <UnderlineTab id="files" icon="file" label="Files changed" count={PR_FILES.length} />
          </TabViewList>
          {!ui.phone ? <TabViewFooter className="pl-4"><DiffStat add={p.additions} del={p.deletions} /></TabViewFooter> : null}
        </TabViewBar>
        <TabViewPanels className="pt-6">
          <FlowPanel id="conversation"><Conversation ui={ui} pr={p} /></FlowPanel>
          <FlowPanel id="commits"><CommitList ui={ui} /></FlowPanel>
          <FlowPanel id="checks"><Checks /></FlowPanel>
          <FlowPanel id="files"><FilesChanged ui={ui} /></FlowPanel>
        </TabViewPanels>
      </TabView>
    </div>
  );
}

/* ── Conversation ── */

export function Conversation({ ui, pr }: { ui: Layout; pr: PullRequest }) {
  const [items, setItems] = useState<TimelineItem[]>(PR_TIMELINE);
  const comment = (body: string) =>
    setItems((xs) => [...xs, { kind: 'comment', id: 'new' + xs.length, author: ME, when: 'now', body, role: 'Member' }]);
  const side = 'border-b border-bl-sep py-4 text-[12px] first:pt-0';
  const sideTitle = 'mb-2 flex items-center justify-between font-semibold text-bl-label2';
  return (
    <div className="flex gap-6">
      <div className="min-w-0 flex-1">
        {/* The timeline rail runs behind the event badges. */}
        <div className={cn('relative', ui.phone ? 'before:left-4' : 'before:left-[72px]', 'before:absolute before:inset-y-0 before:w-0.5 before:bg-bl-sep')}>
          {items.map((it) => <TimelineEntry key={it.id} ui={ui} item={it} />)}
        </div>
        <MergeBox ui={ui} />
        <div className="mt-6 flex gap-4 border-t-2 border-bl-sep pt-6">
          {!ui.phone ? <Avatar c={ME} size={40} /> : null}
          <div className="min-w-0 flex-1">
            <h3 className="mt-0 mb-2 text-[14px] font-semibold">Add a comment</h3>
            <Composer onSubmit={comment}>
              <ComposerCard className="rounded-md shadow-none">
                <ComposerInput placeholder="Use Markdown to format your comment" slashMenu={false} />
                <ComposerFooter>
                  <ComposerText><Oct name="book" size={14} />Markdown is supported</ComposerText>
                  <ComposerSpacer />
                  <ComposerSend />
                </ComposerFooter>
              </ComposerCard>
            </Composer>
            <div className="mt-3 flex justify-end gap-2">
              <Button className={ghButton()}><Oct name="prClosed" className="text-[var(--gh-closed)]" />Close pull request</Button>
            </div>
          </div>
        </div>
      </div>
      {ui.wide ? (
        <aside className="w-[256px] shrink-0">
          <div className={side}>
            <div className={sideTitle}>Reviewers<Oct name="gear" size={14} /></div>
            <div className="flex items-center gap-2"><Avatar c={USERS.jonas} size={20} /><b className="flex-1 font-semibold">{USERS.jonas.login}</b><Oct name="check" className="text-[var(--gh-open)]" /></div>
          </div>
          <div className={side}>
            <div className={sideTitle}>Assignees<Oct name="gear" size={14} /></div>
            <div className="flex items-center gap-2"><Avatar c={pr.author} size={20} /><b className="font-semibold">{pr.author.login}</b></div>
          </div>
          <div className={side}>
            <div className={sideTitle}>Labels<Oct name="gear" size={14} /></div>
            <div className="flex flex-wrap gap-1">{pr.labels.map((l) => <LabelChip key={l.name} label={l} dark={ui.dark} />)}</div>
          </div>
          <div className={side}>
            <div className={sideTitle}>Milestone<Oct name="gear" size={14} /></div>
            <Progress aria-label="v3.3 progress" value={62} size="sm" tone="success" />
            <b className="mt-1.5 block font-semibold">v3.3</b>
          </div>
          <div className={side}>
            <div className={sideTitle}>Development</div>
            <p className="m-0 text-bl-label2">Successfully merging this pull request may close these issues.</p>
            <p className="mt-2 mb-0 flex items-center gap-1.5"><Oct name="issue" size={14} className="text-[var(--gh-open)]" /><b className="font-semibold">Retries fire in lockstep after an outage</b></p>
          </div>
          <div className={side}>
            <div className={sideTitle}>Participants</div>
            <AvatarStack users={[USERS.maya, USERS.jonas, USERS.priya]} size={26} />
          </div>
        </aside>
      ) : null}
    </div>
  );
}

export function CommentCard({ ui, author, when, body, role, verb = 'commented', tone }: {
  ui: Layout; author: { login: string; f: string; l: string }; when: string; body: string; role?: string; verb?: string; tone?: 'author';
}) {
  return (
    <div className="relative flex gap-4 py-4">
      {!ui.phone ? <Avatar c={author} size={40} /> : null}
      <div className={cn('relative z-1 min-w-0 flex-1 overflow-hidden rounded-md border bg-bl-bg', tone === 'author' ? 'border-bl-tint/40' : 'border-bl-sep')}>
        <div className={cn('flex items-center gap-1.5 border-b px-4 py-2 text-bl-label2', tone === 'author' ? 'border-bl-tint/40 bg-bl-tint/8' : 'border-bl-sep bg-bl-bg2')}>
          {ui.phone ? <Avatar c={author} size={20} /> : null}
          <b className="shrink-0 font-semibold whitespace-nowrap text-bl-label">{author.login}</b>
          <span className="min-w-0 truncate">{verb} {when}</span>
          <span className="flex-1" />
          {role && !ui.phone ? <span className="rounded-full border border-bl-sep px-2 text-[12px] leading-[18px] font-medium">{role}</span> : null}
          <Oct name="kebab" className="shrink-0" />
        </div>
        <MarkdownView markdown={body} className={cn(githubMarkdown, 'bg-bl-bg px-4 py-3 text-[14px] leading-[1.5]')} />
      </div>
    </div>
  );
}

export function TimelineEvent({ ui, icon, badge, children }: { ui: Layout; icon: OctName; badge?: string; children: ReactNode }) {
  return (
    <div className={cn('relative flex items-start gap-2 py-3', ui.phone ? 'pl-0' : 'pl-14')}>
      <span className={cn('z-1 grid size-8 shrink-0 place-items-center rounded-full border-2 border-bl-bg', badge ?? 'bg-bl-bg2 text-bl-label2')}>
        <Oct name={icon} size={16} />
      </span>
      <div className="min-w-0 flex-1 pt-1.5 text-bl-label2">{children}</div>
    </div>
  );
}

export function TimelineEntry({ ui, item }: { ui: Layout; item: TimelineItem }) {
  const who = (u: { login: string; f: string; l: string }) => (
    <><Avatar c={u} size={20} className="mr-1.5 inline-grid align-[-5px]" /><b className="font-semibold text-bl-label">{u.login}</b></>
  );
  switch (item.kind) {
    case 'comment':
      return <CommentCard ui={ui} author={item.author} when={item.when} body={item.body} role={item.role} tone={item.author.login === 'maya-chen' ? 'author' : undefined} />;
    case 'commits':
      return (
        <TimelineEvent ui={ui} icon="commit">
          {who(item.author)} added {item.commits.length} commits {item.when}
          <ul className="mt-2 mb-0 list-none space-y-1.5 p-0">
            {item.commits.map((c) => (
              <li key={c.sha} className="flex items-center gap-2">
                <Avatar c={c.author} size={16} />
                <span className="min-w-0 flex-1 truncate text-bl-label">{c.message}</span>
                <Oct name="check" size={14} className="shrink-0 text-[var(--gh-open)]" />
                <code className="shrink-0 font-mono text-[12px]">{c.sha}</code>
              </li>
            ))}
          </ul>
        </TimelineEvent>
      );
    case 'labeled':
      return (
        <TimelineEvent ui={ui} icon="tag">
          {who(item.author)} added {item.labels.map((l) => <LabelChip key={l.name} label={l} dark={ui.dark} className="mx-0.5 align-[1px]" />)} labels {item.when}
        </TimelineEvent>
      );
    case 'requested':
      return <TimelineEvent ui={ui} icon="eye">{who(item.author)} requested a review from <b className="font-semibold text-bl-label">{item.reviewer.login}</b> {item.when}</TimelineEvent>;
    case 'review':
      return (
        <>
          <TimelineEvent ui={ui} icon={item.state === 'approved' ? 'check' : 'eye'} badge={item.state === 'approved' ? 'bg-[#1f883d] text-white' : undefined}>
            {who(item.author)} {item.state === 'approved' ? 'approved these changes' : 'reviewed'} {item.when}
          </TimelineEvent>
          {item.body ? <CommentCard ui={ui} author={item.author} when={item.when} body={item.body} verb="left a comment" role="Member" /> : null}
        </>
      );
  }
}

export function MergeBox({ ui }: { ui: Layout }) {
  const row = (icon: ReactNode, title: string, text: string) => (
    <div className="flex items-start gap-3 border-b border-bl-sep px-4 py-3">
      {icon}
      <div className="min-w-0">
        <div className="font-semibold">{title}</div>
        <div className="text-[12px] text-bl-label2">{text}</div>
      </div>
    </div>
  );
  const ok = <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#1f883d] text-white"><Oct name="check" /></span>;
  return (
    <div className="relative flex gap-4 pt-4">
      {!ui.phone ? <span className="grid size-10 shrink-0 place-items-center rounded-md bg-[#1f883d] text-white"><Oct name="pr" size={20} /></span> : null}
      <div className="relative z-1 min-w-0 flex-1 overflow-hidden rounded-md border border-[#1f883d]/60 bg-bl-bg">
        {row(ok, 'Changes approved', '1 approving review by reviewers with write access.')}
        {row(ok, 'All checks have passed', `${PR_CHECKS.length} successful checks`)}
        <div className="border-b border-bl-sep bg-bl-bg2">
          {PR_CHECKS.map((c) => (
            <div key={c.name} className="flex items-center gap-2 px-4 py-1.5 text-[12px] sm:pl-[60px]">
              <Oct name="check" size={14} className="text-[var(--gh-open)]" />
              <b className="min-w-0 truncate font-semibold">{c.name}</b>
              <span className="text-bl-label2">Successful in {c.time}</span>
            </div>
          ))}
        </div>
        {row(ok, 'No conflicts with base branch', 'Merging can be performed automatically.')}
        <div className="flex flex-wrap items-center gap-3 bg-bl-bg px-4 py-3">
          <div className="flex">
            <Button className={cn(ghButton(true), 'rounded-r-none')}>Merge pull request</Button>
            <Button aria-label="Merge options" className={cn(ghButton(true), 'rounded-l-none border-l-[rgba(255,255,255,.3)] px-2')}><Oct name="chevDown" size={12} /></Button>
          </div>
          <span className="text-[12px] text-bl-label2">You can also merge this with the command line.</span>
        </div>
      </div>
    </div>
  );
}

/* ── Commits / Checks / Files changed ── */

export function CommitList({ ui }: { ui: Layout }) {
  return (
    <div className={cn('relative', !ui.phone && 'pl-8')}>
      <div className="mb-2 flex items-center gap-2 text-bl-label2"><Oct name="commit" />Commits on Sep 24, 2026</div>
      <Box>
        {PR_COMMITS.map((c) => (
          <div key={c.sha} className="flex items-center gap-3 border-t border-bl-sep px-4 py-3 first:border-t-0 hover:bg-bl-bg2">
            <div className="min-w-0 flex-1">
              <div className="truncate font-semibold">{c.message}</div>
              <div className="mt-1 flex items-center gap-1.5 text-[12px] text-bl-label2">
                <Avatar c={c.author} size={16} /><b className="font-semibold text-bl-label">{c.author.login}</b> committed {c.when}
                <Oct name="check" size={14} className="text-[var(--gh-open)]" />
              </div>
            </div>
            <code className={cn(ghButton(), 'h-7 px-2 font-mono text-[12px]')}>{c.sha}</code>
            {!ui.phone ? <Oct name="copy" size={14} className="text-bl-label2" /> : null}
          </div>
        ))}
      </Box>
    </div>
  );
}

export function Checks() {
  return (
    <Box header={<><Oct name="checkFill" className="text-[var(--gh-open)]" /><b className="font-semibold">All checks have passed</b><span className="text-bl-label2">· {PR_CHECKS.length} successful checks</span></>}>
      {PR_CHECKS.map((c) => (
        <div key={c.name} className="flex items-center gap-3 border-t border-bl-sep px-4 py-2.5 first:border-t-0">
          <Oct name="checkFill" className="text-[var(--gh-open)]" />
          <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
          <span className="shrink-0 text-[12px] text-bl-label2">{c.time}</span>
        </div>
      ))}
    </Box>
  );
}

/** Builds a folder tree from the changed paths. */
export function treeFromPaths(paths: string[]): FileNode[] {
  const root: FileNode[] = [];
  for (const p of paths) {
    let level = root;
    p.split('/').forEach((name, i, parts) => {
      const path = parts.slice(0, i + 1).join('/');
      let n = level.find((x) => x.name === name);
      if (!n) {
        n = { name, path, type: i === parts.length - 1 ? 'file' : 'dir', commit: '', when: '', children: i === parts.length - 1 ? undefined : [] };
        level.push(n);
      }
      level = n.children ?? [];
    });
  }
  return root;
}

export function FilesChanged({ ui }: { ui: Layout }) {
  const [selected, setSelected] = useState(PR_FILES[0].path);
  const add = PR_FILES.reduce((s, f) => s + f.additions, 0);
  const del = PR_FILES.reduce((s, f) => s + f.deletions, 0);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {!ui.phone ? <Button className={ghButton()}>All commits<Oct name="chevDown" size={12} /></Button> : null}
        <span className="flex items-center gap-2 text-bl-label2">{PR_FILES.length} files <DiffStat add={add} del={del} /></span>
        <span className="flex-1" />
        <span className="text-[12px] text-bl-label2">0 / {PR_FILES.length} viewed</span>
        <Button className={ghButton(true)}>Review changes<Oct name="chevDown" size={12} /></Button>
      </div>
      <div className="flex gap-4">
        {ui.wide ? (
          <aside className="w-[260px] shrink-0">
            <div className="sticky top-0">
              <FileTree nodes={treeFromPaths(PR_FILES.map((f) => f.path))} selected={selected} defaultOpen
                onSelect={(n) => { setSelected(n.path); document.getElementById('diff-' + n.path)?.scrollIntoView({ block: 'start' }); }} />
            </div>
          </aside>
        ) : null}
        <div className="min-w-0 flex-1 space-y-4">
          {PR_FILES.map((f) => <DiffView key={f.path} path={f.path} patch={f.patch} add={f.additions} del={f.deletions} />)}
        </div>
      </div>
    </div>
  );
}
