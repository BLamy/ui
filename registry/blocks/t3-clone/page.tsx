import { useState } from 'react';
import { Toaster, createToastQueue, toastApi } from '@/components/ui/toast';
import { type Appearance } from '@/lib/theme';
import { SURFACES, type SurfaceKind } from './components/workbench/surfaces';
import { WorkbenchAction, WorkbenchActions, WorkbenchDockTrigger, WorkbenchHeader, WorkbenchMain, WorkbenchPanelTrigger, WorkbenchShell, WorkbenchSidebar, WorkbenchSidebarTrigger, WorkbenchTab, WorkbenchTabBar, WorkbenchTitle } from './components/workbench/workbench-shell';
import { AppSidebar } from './components/app-sidebar';
import { Commands, type PaletteState } from './components/commands';
import { SurfacePanel } from './components/surface-panel';
import { TerminalDock } from './components/terminal-dock';
import { ThreadView } from './components/thread-view';
import { PROJECTS, TINTS, type Project } from './lib/data';
import { useThreads } from './lib/use-threads';
import { DRAFT, useWorkspaces } from './lib/use-workspaces';

export interface T3CloneProps {
  tint?: string;
  /** light or dark; defaults to the ambient AppearanceProvider, else dark */
  appearance?: Appearance;
  /** terminal dock: unset opens it at desktop widths, `false` keeps it closed */
  terminal?: boolean;
  /** surface open in the right panel of the first thread (each sample thread has its own); `null` shows the picker */
  surface?: SurfaceKind | null;
  /** open the ⌘K palette on mount, optionally on a page (['projects'], ['add-project']) */
  palette?: boolean | string[];
}

/**
 * T3 Code clone — thread sidebar · conversation · terminal dock · surface panel, and a ⌘K command palette.
 * Each thread brings its own terminals and panel surface: picking another thread switches all three.
 * Desktop docks everything; tablet slides the panel over as a drawer; phones get a hamburger sidebar,
 * a bottom tab bar for surfaces, and the terminal in a snap sheet.
 */
export default function T3Clone({ tint, appearance, terminal, surface: initialSurface, palette }: T3CloneProps) {
  const workspaces = useWorkspaces(initialSurface);
  const threads = useThreads('t1', { onCreate: workspaces.adopt, onNew: workspaces.resetDraft });
  // A thread that doesn't exist yet keeps its terminals and panel under DRAFT until its first message.
  const threadKey = threads.current?.id ?? DRAFT;
  const workspace = workspaces.of(threadKey);
  const [projects, setProjects] = useState<Project[]>(PROJECTS);
  const [project, setProject] = useState(PROJECTS[0].name);
  const [look, setLook] = useState<Appearance | undefined>(appearance);
  const [accent, setAccent] = useState(tint);
  const [hud] = useState(createToastQueue);
  const [notify] = useState(() => {
    const api = toastApi(hud);
    return (message: string) => api.hud(message, { tone: 'success' });
  });
  const [paletteState, setPaletteState] = useState<PaletteState>(() => ({
    open: !!palette,
    pages: Array.isArray(palette) ? palette : undefined,
    key: 0,
  }));

  return (
    <WorkbenchShell tint={accent} appearance={look ?? appearance} defaultDockOpen={terminal}>
      <WorkbenchSidebar>
        <AppSidebar state={threads} />
      </WorkbenchSidebar>

      <WorkbenchMain>
        <WorkbenchHeader>
          <WorkbenchSidebarTrigger />
          <WorkbenchTitle project={project}>{threads.current?.title ?? 'new thread'}</WorkbenchTitle>
          <WorkbenchActions>
            <WorkbenchAction icon="magnifier" label="Command palette (⌘K)" onPress={() => setPaletteState((s) => ({ open: true, key: s.key + 1 }))} />
            <WorkbenchAction icon="plus" label="New thread" onPress={threads.newThread} />
            <WorkbenchDockTrigger />
            <WorkbenchPanelTrigger />
          </WorkbenchActions>
        </WorkbenchHeader>

        <ThreadView state={threads} />

        <TerminalDock threadKey={threadKey} workspace={workspace} />
      </WorkbenchMain>

      <SurfacePanel threadKey={threadKey} workspace={workspace} />

      <WorkbenchTabBar value={workspace.surface} onValueChange={(k) => workspace.setSurface(k as SurfaceKind)}>
        <WorkbenchTab id="chat" icon="bubble-left">
          Chat
        </WorkbenchTab>
        {SURFACES.map((s) => (
          <WorkbenchTab key={s.k} id={s.k} icon={s.icon}>
            {s.name}
          </WorkbenchTab>
        ))}
      </WorkbenchTabBar>

      <Commands
        palette={paletteState}
        onPalette={setPaletteState}
        threads={threads}
        project={project}
        projects={projects}
        onNewThread={(name) => {
          setProject(name);
          threads.newThread();
        }}
        onAddProject={(p) => {
          setProjects((ps) => (ps.some((x) => x.name === p.name) ? ps : [...ps, p]));
          setProject(p.name);
        }}
        onOpenFile={(path) => {
          workspace.setFile(path);
          workspace.setSurface('files');
        }}
        onAppearance={setLook}
        tint={accent ?? TINTS[0]}
        onTint={setAccent}
        notify={notify}
      />
      <Toaster queue={hud} inline aria-label="Workbench notifications" />
    </WorkbenchShell>
  );
}
