/* Playwright tests Loop QA generated from bugs: a list with each test's state, and the selected test's source
   (SyntaxHighlighting) beside it — or, in a narrow container, on its own pushed page. */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { SplitViewContent, SplitViewHeader } from '@/components/ui/split-view';
import { SyntaxHighlighting, SyntaxHighlightingContent, SyntaxHighlightingCopyButton, SyntaxHighlightingHeader, SyntaxHighlightingTitle } from '@/components/ui/syntax-highlighting';
import { useContainerWidth } from '@/lib/container';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { PLAYWRIGHT_TESTS, relativeTime, type PlaywrightTest, type Project } from './data';
import { PageActions } from './header';
import { Empty, Pill, type PillTone, Pressable } from './parts';
import { useLoopQA } from './state';

const STATE: Record<PlaywrightTest['status'], { tone: PillTone; label: string; icon: string }> = {
  passing: { tone: 'success', label: 'Passing', icon: 'check' },
  failing: { tone: 'danger', label: 'Failing', icon: 'xmark' },
  flaky: { tone: 'warning', label: 'Flaky', icon: 'exclamation-circle' },
};

export function TestsTab({ project }: { project: Project }) {
  const qa = useLoopQA();
  const [ref, width] = useContainerWidth<HTMLDivElement>(900);
  const [selected, setSelected] = useState(PLAYWRIGHT_TESTS[0]!.id);
  if (project.id !== 'northwind') {
    return <Empty icon="doc-text" title="No tests yet" text="When Loop QA confirms a bug it writes a Playwright test that reproduces it, so the fix stays fixed." />;
  }
  const wide = width >= 820;
  const test = PLAYWRIGHT_TESTS.find((t) => t.id === selected)!;
  return (
    <div ref={ref} className={cn('grid gap-4', wide && 'grid-cols-[minmax(280px,340px)_1fr]')}>
      <ul className="m-0 flex list-none flex-col self-start overflow-hidden rounded-[14px] border border-border bg-card p-0" aria-label="Playwright tests">
        {PLAYWRIGHT_TESTS.map((t) => (
          <li key={t.id} className="border-b border-border last:border-b-0">
            <Pressable aria-current={wide && t.id === selected ? 'true' : undefined}
              onPress={() => (wide ? setSelected(t.id) : qa.open({ kind: 'test', id: t.id }))}
              className="flex w-full cursor-pointer items-start justify-start gap-3 rounded-none px-4 py-3 text-left whitespace-normal data-hovered:bg-muted! data-pressed:not-aria-expanded:scale-100 data-focus-visible:ring-inset aria-[current=true]:bg-primary/8!">
              <Icon name={STATE[t.status].icon} size={14} sw={2.6} className={cn('mt-0.5 shrink-0', t.status === 'passing' ? 'text-success' : t.status === 'failing' ? 'text-destructive' : 'text-warning')} />
              <span className="min-w-0 flex-1">
                <span className="block text-[13.5px] leading-[18px] font-medium">{t.name}</span>
                <span className="mt-0.5 block truncate font-mono text-[11.5px] text-muted-foreground">{t.file}</span>
              </span>
              {!wide ? <Icon name="chevron-right" size={13} sw={2.2} className="mt-1 shrink-0 text-tertiary-foreground" /> : null}
            </Pressable>
          </li>
        ))}
      </ul>
      {wide ? <TestSource test={test} /> : null}
    </div>
  );
}

export function TestSource({ test: t }: { test: PlaywrightTest }) {
  const qa = useLoopQA();
  const s = STATE[t.status];
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={s.tone}><Icon name={s.icon} size={11} sw={2.6} />{s.label}</Pill>
        <span className="text-[12.5px] text-muted-foreground">{t.runs} runs · {t.duration} · last {relativeTime(t.lastRun)}</span>
        {t.fromBug ? (
          <Button size="sm" variant="ghost" className="ml-auto h-7 rounded-md px-2 text-[12.5px]" onPress={() => qa.open({ kind: 'bug', id: t.fromBug! })}>
            From <span className="font-mono">{t.fromBug}</span><Icon name="chevron-right" size={12} sw={2.4} />
          </Button>
        ) : null}
      </div>
      <SyntaxHighlighting code={t.code} language="ts" className="overflow-hidden rounded-[14px] border border-border">
        <SyntaxHighlightingHeader>
          <SyntaxHighlightingTitle>{t.file}</SyntaxHighlightingTitle>
          <SyntaxHighlightingCopyButton label={`Copy ${t.file}`} />
        </SyntaxHighlightingHeader>
        <SyntaxHighlightingContent lineNumbers />
      </SyntaxHighlighting>
    </div>
  );
}

/** The pushed page for a test (narrow containers). */
export function TestPage({ id }: { id: string }) {
  const t = PLAYWRIGHT_TESTS.find((x) => x.id === id);
  return (
    <>
      <SplitViewHeader title={t?.name ?? 'Test'} titleOnScroll trailing={<PageActions run={false} />} />
      <SplitViewContent className="@container">
        <div className="mx-auto w-full max-w-[980px] px-5 py-4">
          <h2 className="m-0 mb-3 text-[20px] leading-6 font-semibold tracking-[-.02em]">{t?.name}</h2>
          {t ? <TestSource test={t} /> : null}
        </div>
      </SplitViewContent>
    </>
  );
}
