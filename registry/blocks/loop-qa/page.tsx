/* Loop QA — an agentic QA workspace. Projects (a URL under test) each have an Overview, Bugs, a Site map, Test
   runs and generated Playwright tests; bugs open to their replay, logs, chronology and root cause; runs to their
   findings and journeys. "Ask QA", the agent, sits beside every page: it answers from the bugs and replays, and
   starts runs that report live. ⌘K jumps anywhere and runs any command.

   One SplitView at every size: the sidebar tiles beside the page on a desktop, floats over it on a tablet, and is
   the root of a stack on a phone; each project's pages push onto the detail column's NavigationStack. Ask QA docks as a
   column when there's room and slides over the page when there isn't. */
import { useEffect } from 'react';
import { ArtifactChatContainer, ArtifactChatContainerChat, ArtifactChatContainerComposer, ArtifactChatContainerContent } from '@/components/ui/artifact-chat-container';
import { NavigationStack, useNavigationStack } from '@/components/ui/navigation-stack';
import { SplitView, SplitViewDetail, useSplitView } from '@/components/ui/split-view';
import { ToastRegion } from '@/components/ui/toast';
import { SizeClassProvider, useSizeClass } from '@/lib/container';
import { AppearanceProvider, BLProvider, useAppearance, type Appearance } from '@/lib/theme';
import { AskComposer, AskQA } from './ask-qa';
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
  /** Where Ask QA floats (tablet, phone): start with the whole transcript over the page (the default when
   *  `askOpen`), or `false` to rest as the composer with the newest reply peeking. */
  chatExpanded?: boolean;
}

/** Block widths (px) where the medium (tablet) and regular (desktop, Ask QA docked) classes start. */
const SIZE_CLASSES = { medium: 640, regular: 1180 };

export default function LoopQA({ appearance, initialProject, initialTab, initialPage, askOpen, palette, liveRunAt, emptyChat, chatExpanded }: LoopQAProps) {
  const ambient = useAppearance();
  const qa = useLoopQAState({ appearance, project: initialProject, tab: initialTab, push: initialPage, askOpen, palette, liveRunAt, emptyChat, chatExpanded });
  const dark = (qa.look ?? appearance ?? ambient) === 'dark';
  const mode = dark ? 'dark' : 'light';
  // Compact is a phone; regular is wide enough to dock Ask QA beside the page.
  const [ref, sizeClass] = useSizeClass<HTMLDivElement>({ breakpoints: SIZE_CLASSES });
  const phone = sizeClass === 'compact';
  const dock = sizeClass === 'regular';
  const { setWide } = qa;
  useEffect(() => setWide(dock), [dock, setWide]);

  return (
    <AppearanceProvider value={mode}>
      <BLProvider tint={LOOP_TINT[mode]} style={LOOP_THEME[mode]} className="min-h-0 bg-background">
        <LoopQAProvider value={qa}>
          <div ref={ref} data-slot="loop-qa" className="relative flex h-full min-h-0 w-full bg-background text-detail text-foreground">
            {/* The block is a size-class scope (its compact break is BLProvider's 640px): its dialogs are trays on a phone. */}
            <SizeClassProvider value={sizeClass}>
              <ArtifactChatContainer
                layout={dock && qa.askOpen ? 'split' : 'floating'}
                chatSide="end"
                chatLabel="Ask QA"
                chatWidth={384}
                open={!dock && qa.askOpen && qa.chatOpen}
                onOpenChange={qa.setChatOpen}
                minimized={!qa.askOpen}
                onMinimizedChange={(m) => qa.setAskPref(!m)}
                peek={phone ? 0 : 168}
                fabAlign="end"
                className="min-w-0 flex-1"
              >
                <ArtifactChatContainerContent>
                  <div className="relative h-full min-h-0">
                    <SplitView
                      aria-label="Loop QA"
                      value={{ sidebar: qa.section }}
                      onValueChange={(v) => { if (v.sidebar) qa.setSection(v.sidebar); }}
                      defaultCompactColumn={initialProject || initialPage ? 'detail' : 'sidebar'}
                    >
                      <SplitBridge />
                      <AppSidebar />
                      <SplitViewDetail aria-label="Page">
                        <NavigationStack resetKey={qa.section} renderPage={(page) => <Pushed page={page} />}>
                          <PendingPush />
                          {qa.project ? <ProjectPage value="root" project={qa.project} /> : <ProjectsHome value="root" />}
                        </NavigationStack>
                      </SplitViewDetail>
                    </SplitView>
                  </div>
                </ArtifactChatContainerContent>
                <ArtifactChatContainerChat><AskQA /></ArtifactChatContainerChat>
                <ArtifactChatContainerComposer><AskComposer /></ArtifactChatContainerComposer>
              </ArtifactChatContainer>
              <Commands />
              <Dialogs />
              <ToastRegion toaster={qa.toast} aria-label="Loop QA notifications" />
              <ToastRegion variant="hud" toaster={qa.hud.toaster} aria-label="Loop QA status" />
            </SizeClassProvider>
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

/** The pending push (a bug / run / test someone asked for from ⌘K or a card), once its project is up: its key goes
    on the detail column's stack, unless it is on top already. */
function PendingPush() {
  const qa = useLoopQA();
  const stack = useNavigationStack();
  const { pending, section, consumePending } = qa;
  useEffect(() => {
    if (!pending || pending.section !== section) return;
    const key = `${pending.kind}:${pending.id}`;
    if (stack.getPages().at(-1) !== key) stack.push(key);
    consumePending();
  }, [pending, section, stack, consumePending]);
  return null;
}

/** A pushed page, from its key: `bug:<id>`, `run:<id>` or `test:<id>`. */
function Pushed({ page }: { page: string }) {
  const at = page.indexOf(':');
  const kind = page.slice(0, at), id = page.slice(at + 1);
  if (kind === 'bug') return <BugPage value={page} id={id} />;
  if (kind === 'run') return <RunPage value={page} id={id} />;
  if (kind === 'test') return <TestPage value={page} id={id} />;
  return null;
}
