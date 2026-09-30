/* Loop QA — an agentic QA workspace. Projects (a URL under test) each have an Overview, Bugs, a Site map, Test
   runs and generated Playwright tests; bugs open to their replay, logs, chronology and root cause; runs to their
   findings and journeys. "Ask QA", the agent, sits beside every page: it answers from the bugs and replays, and
   starts runs that report live. ⌘K jumps anywhere and runs any command.

   One SplitView at every size: the sidebar tiles beside the page on a desktop, floats over it on a tablet, and is
   the root of a stack on a phone; each project's pages push onto the detail column's stack. Ask QA docks as a
   column when there's room and slides over the page when there isn't. */
import { useEffect, useRef, type ReactNode } from 'react';
import {
  AppearanceProvider, BLProvider, SideDrawer, SplitView, SplitViewDetail, SplitViewStack, Toaster, useAppearance, useContainerWidth,
  useSplitView, useSplitViewStack, type Appearance,
} from '@brett_lamy/ui';
import { AskQA, AskTitle } from './ask-qa';
import { BugPage } from './bug-detail';
import { Commands } from './commands';
import { Dialogs } from './dialogs';
import { LOOP_THEME, LOOP_TINT } from './parts';
import { ProjectPage } from './project-page';
import { ProjectsHome } from './projects-home';
import { RunPage } from './run-detail';
import { AppSidebar } from './sidebar';
import { LoopQAProvider, useLoopQA, useLoopQAState, type ProjectTab, type PushTarget } from './state';
import { TestPage } from './tests';

export interface LoopQAProps {
  /** Light or dark. Defaults to the ambient AppearanceProvider (or the page's `.dark`), else light. */
  appearance?: Appearance;
  /** Project to open on (e.g. 'northwind'); omit for All projects. */
  initialProject?: string;
  /** The project's tab. */
  initialTab?: ProjectTab;
  /** Open a bug, run or test page on top of its project (e.g. `{ kind: 'bug', id: 'NW-142' }`). */
  initialPage?: PushTarget;
  /** Ask QA open or closed; by default it opens where it can dock beside the page. */
  askOpen?: boolean;
  /** Open ⌘K on mount, optionally on a page (['bugs'], ['status']). */
  palette?: boolean | string[];
  /** A run in progress, frozen after this many journeys (for screenshots). */
  liveRunAt?: number;
  /** Start Ask QA with an empty thread. */
  emptyChat?: boolean;
}

export default function LoopQA({ appearance, initialProject, initialTab, initialPage, askOpen, palette, liveRunAt, emptyChat }: LoopQAProps) {
  const ambient = useAppearance();
  const qa = useLoopQAState({ appearance, project: initialProject, tab: initialTab, push: initialPage, askOpen, palette, liveRunAt, emptyChat });
  const dark = (qa.look ?? appearance ?? ambient) === 'dark';
  const mode = dark ? 'dark' : 'light';
  const [ref, width] = useContainerWidth<HTMLDivElement>(1280);
  const phone = width < 640;
  const dock = width >= 1180;
  const { setWide } = qa;
  useEffect(() => setWide(dock), [dock, setWide]);

  return (
    <AppearanceProvider value={mode}>
      <BLProvider tint={LOOP_TINT[mode]} style={LOOP_THEME[mode]} className="min-h-0 bg-background">
        <LoopQAProvider value={qa}>
          <div ref={ref} data-slot="loop-qa" className="relative flex h-full min-h-0 w-full bg-background text-[14px] text-foreground">
            <div className="relative min-w-0 flex-1">
              <SplitView
                aria-label="Loop QA"
                selection={{ sidebar: qa.section }}
                onSelectionChange={(s) => { if (s.sidebar) qa.setSection(s.sidebar); }}
                defaultCompactColumn={initialProject || initialPage ? 'detail' : 'sidebar'}
              >
                <SplitBridge />
                <AppSidebar />
                <SplitViewDetail aria-label="Page">
                  <SplitViewStack resetKey={qa.section}>
                    <StackBridge>{qa.project ? <ProjectPage project={qa.project} /> : <ProjectsHome />}</StackBridge>
                  </SplitViewStack>
                </SplitViewDetail>
              </SplitView>
            </div>
            <SideDrawer mode={dock ? 'fixed' : 'overlay'} open={qa.askOpen} onClose={() => qa.setAskOpen(false)} title={<AskTitle />} width={phone ? width : 384}>
              <AskQA />
            </SideDrawer>
            <Commands />
            <Dialogs compact={phone} />
            <Toaster queue={qa.hud} inline aria-label="Loop QA notifications" />
          </div>
        </LoopQAProvider>
      </BLProvider>
    </AppearanceProvider>
  );
}

/** Hands the SplitView's API to the block state, so ⌘K and cards navigate the way a tap in the sidebar would. */
function SplitBridge() {
  const s = useSplitView();
  const { split } = useLoopQA();
  split.current = s;
  return null;
}

/** The stack's root page, plus the pending push (a bug / run / test someone asked for) once its project is up. */
function StackBridge({ children }: { children: ReactNode }) {
  const qa = useLoopQA();
  const stack = useSplitViewStack();
  const top = useRef<string | null>(null);
  const { pending, section, consumePending } = qa;
  useEffect(() => {
    if (!pending || pending.section !== section) return;
    const key = `${pending.kind}:${pending.id}`;
    if (!(stack.depth > 1 && top.current === key)) {
      stack.push(<Pushed target={pending} />, { key });
      top.current = key;
    }
    consumePending();
  }, [pending, section, stack, consumePending]);
  useEffect(() => { if (stack.depth === 1) top.current = null; }, [stack.depth]);
  return <>{children}</>;
}

function Pushed({ target }: { target: PushTarget }) {
  if (target.kind === 'bug') return <BugPage id={target.id} />;
  if (target.kind === 'run') return <RunPage id={target.id} />;
  return <TestPage id={target.id} />;
}
