/* Actions tab: workflows sidebar and workflow runs. */
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RUNS, WORKFLOWS, type WorkflowRun } from './data';
import { Box, Oct, ghButton, Branch, type Layout } from './parts';
import { FilterMenus } from './lists';

export const RUN_ICON: Record<WorkflowRun['status'], ReactNode> = {
  success: <Oct name="checkFill" className="text-[var(--gh-open)]" />,
  failure: <Oct name="xFill" className="text-[var(--gh-closed)]" />,
  running: <Oct name="dotFill" className="text-[var(--gh-attention)]" />,
  cancelled: <Oct name="stopFill" className="text-muted-foreground" />,
};

export function ActionsView({ ui }: { ui: Layout }) {
  const [workflow, setWorkflow] = useState('all');
  const runs = RUNS.filter((r) => workflow === 'all' || r.workflow === workflow);
  const item = (id: string, label: string) => (
    <button key={id} type="button" onClick={() => setWorkflow(id)}
      className={cn('relative flex h-8 w-full cursor-pointer items-center rounded-md border-0 bg-transparent px-2 text-left text-[14px] text-foreground hover:bg-secondary',
        workflow === id && 'bg-secondary font-semibold before:absolute before:inset-y-1.5 before:-left-2 before:w-1 before:rounded-full before:bg-primary')}>
      {label}
    </button>
  );
  return (
    <div className="flex gap-6">
      {ui.wide ? (
        <aside className="w-[240px] shrink-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="m-0 text-[20px] font-semibold">Actions</h2>
            <Button className={cn(ghButton(), 'h-7 px-2 text-[12px]')}>New workflow</Button>
          </div>
          {item('all', 'All workflows')}
          {WORKFLOWS.map((w) => item(w, w))}
        </aside>
      ) : null}
      <div className="min-w-0 flex-1">
        <h2 className="mt-0 mb-1 text-[20px] font-semibold">{workflow === 'all' ? 'All workflows' : workflow}</h2>
        <p className="mt-0 mb-4 text-muted-foreground">Showing runs from {workflow === 'all' ? 'all workflows' : 'the ' + workflow + ' workflow'}</p>
        <Box header={
          <>
            <b className="font-semibold">{workflow === 'all' ? 184 : runs.length} workflow runs</b>
            <FilterMenus ui={ui} names={['Event', 'Status', 'Branch', 'Actor']} onLabel={() => {}} />
          </>
        }>
          {runs.map((r) => (
            <div key={r.id} className="flex items-start gap-3 border-t border-border px-4 py-3 first:border-t-0 hover:bg-muted">
              <span className="pt-0.5">{RUN_ICON[r.status]}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{r.title}</div>
                <div className="mt-1 text-[12px] text-muted-foreground">
                  <b className="font-semibold">{r.workflow}</b> #{r.number}: {r.event} by {r.actor.login}
                </div>
                {ui.phone ? <div className="mt-1.5 flex items-center gap-2 text-[12px] text-muted-foreground"><Branch>{r.branch}</Branch>{r.when}</div> : null}
              </div>
              {!ui.phone ? (
                <>
                  {ui.wide ? <span className="shrink-0 pt-0.5"><Branch>{r.branch}</Branch></span> : null}
                  <div className="w-[120px] shrink-0 space-y-1 text-[12px] text-muted-foreground">
                    <div className="flex items-center gap-1.5"><Oct name="history" size={14} />{r.when}</div>
                    <div className="flex items-center gap-1.5"><Oct name="pulse" size={14} />{r.duration}</div>
                  </div>
                  <Oct name="kebab" className="mt-0.5 shrink-0 text-muted-foreground" />
                </>
              ) : null}
            </div>
          ))}
        </Box>
      </div>
    </div>
  );
}
