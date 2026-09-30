/* A bug: status and severity menus over the title, the replay (its rail marks the failing request and the
   error), the network and console logs (a row seeks the replay to its moment), expected vs actual, the chronology
   of what happened — each step's evidence is the replay frozen at that instant — the root cause, and a details
   column with the report actions. */
import { useEffect, useRef, useState, type Key, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { MarkdownView } from '@/components/ui/markdown-view';
import { ReplayPreview, formatReplayTime, replayDemoEvents, type ReplayPreviewHandle } from '@/components/ui/replay-preview';
import { SplitViewContent, SplitViewHeader } from '@/components/ui/split-view';
import { Tab, TabList, TabPanel, Tabs } from '@/components/ui/tabs';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { StatusMenu } from './bugs';
import {
  BUG_CONSOLE, BUG_NETWORK, FEATURED_BUG, PROJECTS, SEVERITIES, SEVERITY_LABEL, TRACKERS, bugReport, dateTime, relativeTime,
  type Bug, type Severity,
} from './data';
import { PageActions } from './header';
import { EnvBadge, KindLabel, Panel, SEVERITY_TONE, SectionLabel, pillVariants, Pressable } from './parts';
import { useLoopQA } from './state';

export function BugPage({ id }: { id: string }) {
  const qa = useLoopQA();
  const b = qa.bugs.find((x) => x.id === id);
  const player = useRef<ReplayPreviewHandle>(null);
  const { setCurrentBug } = qa;
  // ⌘K offers "Change status / severity" for the bug on screen.
  useEffect(() => { setCurrentBug(id); return () => setCurrentBug(null); }, [id, setCurrentBug]);
  if (!b) return null;
  const project = PROJECTS.find((p) => p.id === b.projectId);
  const featured = b.id === FEATURED_BUG;
  const seek = (ms: number) => player.current?.seek(ms);

  return (
    <>
      <SplitViewHeader title={b.id} titleOnScroll trailing={<PageActions run={false} extra={
        <Button size="sm" variant="secondary" className="mr-1 h-8 rounded-[9px]" onPress={() => qa.copyBugReport(b.id)}>
          <Icon name="copy" size={13} sw={2} /><span className="hidden @xl:inline!">Copy report</span>
        </Button>
      } />} />
      <SplitViewContent className="@container">
        <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-5 px-5 pt-3 pb-14 @3xl:px-8!">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusMenu bug={b} />
              <SeverityMenu bug={b} />
              <KindLabel kind={b.kind} className="ml-1" />
              <EnvBadge env={b.environment} />
              <span className="font-mono text-[12px] text-tertiary-foreground">{b.id}</span>
            </div>
            <h1 className="m-0 mt-3 max-w-[900px] text-[22px] leading-[29px] font-semibold tracking-[-.025em] text-balance @3xl:text-[26px]! @3xl:leading-[33px]!">{b.title}</h1>
          </div>

          <div className="grid items-start gap-5 @5xl:grid-cols-[1fr_280px]!">
            <div className="flex min-w-0 flex-col gap-5">
              <ReplayPreview events={replayDemoEvents} initialTime={featured ? 8400 : 2250} playerRef={player} title={`Replay of ${b.id}`} />

              <Tabs variant="underline" defaultSelectedKey="network">
                <TabList aria-label="Logs">
                  <Tab id="network">Network <span className="ml-1 text-[11px] text-destructive">1 failed</span></Tab>
                  <Tab id="console">Console <span className="ml-1 text-[11px] text-destructive">2 errors</span></Tab>
                </TabList>
                <TabPanel id="network" className="pt-2">
                  <LogTable>
                    {BUG_NETWORK.map((n, i) => (
                      <LogRow key={i} at={n.at} onSeek={seek} bad={n.status >= 400}>
                        <span className="w-12 shrink-0 font-mono text-[11.5px] font-semibold text-muted-foreground">{n.method}</span>
                        <span className="min-w-0 flex-1 truncate font-mono text-[12px]">{n.path}</span>
                        <span className={cn('w-10 shrink-0 text-right font-mono text-[12px] font-semibold', n.status >= 400 ? 'text-destructive' : 'text-success')}>{n.status}</span>
                        <span className="hidden w-16 shrink-0 text-right text-[12px] text-muted-foreground tabular-nums @2xl:block!">{n.ms} ms</span>
                        <span className="hidden w-16 shrink-0 text-right text-[12px] text-muted-foreground tabular-nums @2xl:block!">{n.size}</span>
                      </LogRow>
                    ))}
                  </LogTable>
                </TabPanel>
                <TabPanel id="console" className="pt-2">
                  <LogTable>
                    {BUG_CONSOLE.map((c, i) => (
                      <LogRow key={i} at={c.at} onSeek={seek} bad={c.level === 'error'} warn={c.level === 'warn'}>
                        <Icon name={c.level === 'error' ? 'xmark-circle-fill' : c.level === 'warn' ? 'warning-fill' : 'info'} size={14}
                          className={cn('mt-px shrink-0 self-start', c.level === 'error' ? 'text-destructive' : c.level === 'warn' ? 'text-warning' : 'text-muted-foreground')} />
                        <span className="min-w-0 flex-1 font-mono text-[12px] leading-[18px] whitespace-pre-wrap">{c.text}</span>
                        <span className="hidden shrink-0 self-start font-mono text-[11.5px] text-muted-foreground @2xl:block!">{c.source}</span>
                      </LogRow>
                    ))}
                  </LogTable>
                </TabPanel>
              </Tabs>

              <div className="grid gap-3 @2xl:grid-cols-2!">
                <Outcome label="Expected" icon="checkmark-circle" tone="text-success">{b.expected}</Outcome>
                <Outcome label="Actual" icon="xmark-circle" tone="text-destructive">{b.actual}</Outcome>
              </div>

              <Panel title="Steps to reproduce" icon="checklist" bodyClassName="px-4 py-3">
                <ol className="m-0 flex list-none flex-col gap-2 p-0 [counter-reset:step]">
                  {b.steps.map((s) => (
                    <li key={s} className="flex items-baseline gap-3 text-[13.5px] [counter-increment:step] before:grid before:size-5 before:shrink-0 before:place-items-center before:rounded-full before:bg-secondary before:text-[11px] before:font-semibold before:text-muted-foreground before:content-[counter(step)]">{s}</li>
                  ))}
                </ol>
              </Panel>

              {b.chronology ? <Chronology bug={b} onSeek={seek} /> : null}

              <section className="flex flex-col gap-3">
                <SectionLabel>Root cause</SectionLabel>
                <ol className="m-0 flex list-none flex-col gap-0 p-0">
                  {b.rootCause.map((s, i) => (
                    <li key={i} className="relative flex gap-4 pb-5 last:pb-0">
                      {i < b.rootCause.length - 1 ? <span className="absolute top-7 bottom-0 left-[13px] w-px bg-border" /> : null}
                      <span className="grid size-7 shrink-0 place-items-center rounded-full border border-border bg-card text-[12px] font-semibold">{i + 1}</span>
                      <div className="min-w-0 flex-1 pt-0.5 text-[13.5px] leading-[21px] [&_p]:m-0"><MarkdownView markdown={s} /></div>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            <Details bug={b} project={project?.name ?? ''} />
          </div>
        </div>
      </SplitViewContent>
    </>
  );
}

function SeverityMenu({ bug: b }: { bug: Bug }) {
  const qa = useLoopQA();
  return (
    <DropdownMenu>
      <Pressable aria-label={`Severity: ${SEVERITY_LABEL[b.severity]}`} className="h-auto cursor-pointer rounded-full p-0 data-pressed:not-aria-expanded:scale-95">
        <span className={pillVariants({ tone: SEVERITY_TONE[b.severity] })}>
          {SEVERITY_LABEL[b.severity]}<Icon name="chevron-down" size={10} sw={2.6} className="-ml-0.5 opacity-70" />
        </span>
      </Pressable>
      <DropdownMenuContent placement="bottom start" selectionMode="single" selectedKeys={[b.severity]}
        onSelectionChange={(keys) => {
          const next = [...(keys as Set<Key>)][0] as Severity | undefined;
          if (next && next !== b.severity) { qa.setBugSeverity(b.id, next); qa.toast.hud(`${b.id} → ${SEVERITY_LABEL[next]}`); }
        }}>
        {SEVERITIES.map((s) => <DropdownMenuItem key={s} id={s}>{SEVERITY_LABEL[s]}</DropdownMenuItem>)}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LogTable({ children }: { children: ReactNode }) {
  return <ul className="m-0 flex list-none flex-col overflow-hidden rounded-[12px] border border-border bg-card p-0">{children}</ul>;
}

function LogRow({ at, onSeek, bad, warn, children }: { at: number; onSeek: (ms: number) => void; bad?: boolean; warn?: boolean; children: ReactNode }) {
  return (
    <li className={cn('border-b border-border last:border-b-0', bad ? 'bg-destructive/6' : warn ? 'bg-warning/6' : '')}>
      <Pressable onPress={() => onSeek(at)} aria-label={`Seek to ${formatReplayTime(at)}`}
        className="flex w-full cursor-pointer items-center justify-start gap-3 rounded-none px-3.5 py-2 text-left whitespace-normal data-hovered:bg-muted! data-pressed:not-aria-expanded:scale-100 data-focus-visible:ring-inset">
        <span className="w-9 shrink-0 self-start pt-px text-[11px] text-tertiary-foreground tabular-nums">{formatReplayTime(at)}</span>
        {children}
      </Pressable>
    </li>
  );
}

function Outcome({ label, icon, tone, children }: { label: string; icon: string; tone: string; children: ReactNode }) {
  return (
    <div className="rounded-[14px] border border-border bg-card p-4">
      <div className={cn('flex items-center gap-1.5 text-[12px] font-semibold', tone)}><Icon name={icon} size={14} sw={2.2} />{label}</div>
      <p className="m-0 mt-1.5 text-[13.5px] leading-[20px]">{children}</p>
    </div>
  );
}

/** What happened, step by step; each step's frame is the replay paused at that moment. */
function Chronology({ bug: b, onSeek }: { bug: Bug; onSeek: (ms: number) => void }) {
  return (
    <section className="flex flex-col gap-3">
      <SectionLabel count={b.chronology!.length}>Chronology of events</SectionLabel>
      <ol className="m-0 flex list-none flex-col p-0">
        {b.chronology!.map((c, i) => (
          <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
            {i < b.chronology!.length - 1 ? <span className="absolute top-7 bottom-0 left-[13px] w-px bg-border" /> : null}
            <span className={cn('grid size-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold', i === b.chronology!.length - 1 ? 'bg-destructive text-white' : 'border border-border bg-card')}>{i + 1}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-3 @2xl:flex-row!">
              <Pressable onPress={() => onSeek(c.time)} aria-label={`Show ${formatReplayTime(c.time)} in the replay`}
                className="relative w-full shrink-0 cursor-pointer overflow-hidden rounded-[10px] border border-border p-0 data-hovered:ring-2 data-hovered:ring-primary/40 @2xl:w-[200px]!">
                <ReplayPreview events={replayDemoEvents} chrome="none" controls={false} initialTime={c.time} className="pointer-events-none w-full" title={`Frame at ${formatReplayTime(c.time)}`} />
                <span className="absolute right-1.5 bottom-1.5 rounded-md bg-foreground/80 px-1.5 py-0.5 font-mono text-[10.5px] text-background">{formatReplayTime(c.time)}.{String(Math.floor((c.time % 1000) / 100))}</span>
              </Pressable>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-[13.5px] leading-[20px]">{c.text}</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <span className={pillVariants({ tone: 'neutral' })}><Icon name={c.tag === 'click' ? 'hand' : c.tag === 'network' ? 'network' : c.tag === 'console' ? 'terminal' : 'textformat'} size={11} sw={2.2} />{c.tag}</span>
                  {c.evidence.map((e) => (
                    <span key={e.label} className={pillVariants({ tone: 'outline' })}>
                      <Icon name={e.kind === 'Screenshot' ? 'photo' : e.kind === 'Request' ? 'globe' : e.kind === 'Console' ? 'terminal' : 'doc-text'} size={11} sw={2.2} />
                      <span className="font-medium text-foreground">{e.kind}</span><span className="font-normal">{e.label}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Details({ bug: b, project }: { bug: Bug; project: string }) {
  const qa = useLoopQA();
  const [copied, setCopied] = useState(false);
  const tracker = TRACKERS.find((t) => qa.trackers.includes(t.id));
  const rows: [string, string, ReactNode][] = [
    ['Discovered', 'clock', <>{relativeTime(b.discovered)} <span className="text-muted-foreground">· {dateTime(b.discovered)}</span></>],
    ['Type', 'sparkle', `${b.kind}`],
    ['Source', 'checklist', <Button key="run" variant="link" size={null} className="h-auto p-0 text-[13px]" onPress={() => qa.open({ kind: 'run', id: b.runId })}>Test run #{b.runId.slice(4)}</Button>],
    ['Journey', 'network', b.journey],
    ['Project', 'folder-closed', project],
    ['Webhook', 'paperplane', tracker ? `Filed in ${tracker.name}` : 'Not sent'],
  ];
  return (
    <aside className="flex flex-col gap-3 @5xl:sticky! @5xl:top-4!">
      <div className="flex flex-col gap-2">
        <Button className="h-9 rounded-[10px] text-[13.5px]" onPress={() => { qa.copyBugReport(b.id); setCopied(true); }}>
          <Icon name={copied ? 'check' : 'copy'} size={14} sw={2.2} />{copied ? 'Copied bug report' : 'Copy bug report'}
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" className="h-9 rounded-[10px] text-[13px]" onPress={() => {
            const url = URL.createObjectURL(new Blob([bugReport(b)], { type: 'text/markdown' }));
            Object.assign(document.createElement('a'), { href: url, download: `${b.id}.md` }).click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);
          }}>
            <Icon name="download" size={14} sw={2} />Download
          </Button>
          <Button variant="secondary" className="h-9 rounded-[10px] text-[13px]" onPress={() => qa.setDialog('tracker')}>
            <Icon name={tracker ? 'checkmark-circle' : 'link'} size={14} sw={2} className={tracker ? 'text-success' : undefined} />{tracker ? tracker.name : 'Tracker'}
          </Button>
        </div>
      </div>
      <dl className="m-0 flex flex-col overflow-hidden rounded-[14px] border border-border bg-card">
        {rows.map(([k, icon, v]) => (
          <div key={k} className="flex gap-3 border-b border-border px-3.5 py-2.5 last:border-b-0">
            <Icon name={icon} size={14} sw={2} className="mt-0.5 shrink-0 text-tertiary-foreground" />
            <div className="min-w-0 flex-1">
              <dt className="text-[11.5px] text-muted-foreground">{k}</dt>
              <dd className="m-0 mt-0.5 text-[13px] leading-[18px]">{v}</dd>
            </div>
          </div>
        ))}
        <div className="flex gap-3 px-3.5 py-2.5">
          <Icon name="play-outline" size={14} sw={2} className="mt-0.5 shrink-0 text-tertiary-foreground" />
          <div className="min-w-0 flex-1">
            <dt className="text-[11.5px] text-muted-foreground">Replay</dt>
            <dd className="m-0 mt-0.5 font-mono text-[11.5px] leading-[16px] break-all">{b.replayId}</dd>
            <Button variant="link" size={null} className="mt-1 h-auto p-0 text-[12.5px]" onPress={() => qa.copy(`https://loopqa.dev/replays/${b.replayId}`, 'Copied replay link')}>Copy replay link</Button>
          </div>
        </div>
      </dl>
    </aside>
  );
}
