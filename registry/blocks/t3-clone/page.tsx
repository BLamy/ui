import { useState } from 'react';
import {
  SURFACES,
  TerminalAction,
  TerminalBody,
  TerminalHeader,
  Toaster,
  WorkbenchAction,
  WorkbenchActions,
  WorkbenchDock,
  WorkbenchDockClose,
  WorkbenchDockTrigger,
  WorkbenchHeader,
  WorkbenchMain,
  WorkbenchPanelTrigger,
  WorkbenchShell,
  WorkbenchSidebar,
  WorkbenchSidebarTrigger,
  WorkbenchTab,
  WorkbenchTabBar,
  WorkbenchTitle,
  createToastQueue,
  toastApi,
  type Appearance,
  type SurfaceKind,
} from '@brett_lamy/ui';
import { AppSidebar } from './components/app-sidebar';
import { Commands, type PaletteState } from './components/commands';
import { SurfacePanel } from './components/surface-panel';
import { ThreadView } from './components/thread-view';
import { PROJECTS, TERMINAL_SEED, TINTS, type Project } from './lib/data';
import { useThreads } from './lib/use-threads';

export interface T3CloneProps {
  tint?: string;
  /** light or dark; defaults to the ambient AppearanceProvider, else dark */
  appearance?: Appearance;
  /** terminal dock: unset opens it at desktop widths, `false` keeps it closed */
  terminal?: boolean;
  /** surface open in the right panel */
  surface?: SurfaceKind | null;
  /** open the ⌘K palette on mount, optionally on a page (['projects'], ['add-project']) */
  palette?: boolean | string[];
}

/**
 * T3 Code clone — thread sidebar · conversation · terminal dock · surface panel, and a ⌘K command palette.
 * Desktop docks everything; tablet slides the panel over as a drawer; phones get a hamburger sidebar,
 * a bottom tab bar for surfaces, and the terminal in a snap sheet.
 */
export default function T3Clone({ tint, appearance, terminal, surface: initialSurface = null, palette }: T3CloneProps) {
  const threads = useThreads();
  const [surface, setSurface] = useState<SurfaceKind | null>(initialSurface);
  const [file, setFile] = useState('cookbook/src/App.tsx');
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

        <WorkbenchDock>
          <TerminalHeader title={`zsh — ${project}`}>
            <TerminalAction icon="rectangle-split" label="Split terminal" />
            <TerminalAction icon="plus" label="New terminal" />
            <WorkbenchDockClose />
          </TerminalHeader>
          <TerminalBody seed={TERMINAL_SEED} />
        </WorkbenchDock>
      </WorkbenchMain>

      <SurfacePanel surface={surface} onSurface={setSurface} file={file} />

      <WorkbenchTabBar value={surface} onValueChange={(k) => setSurface(k as SurfaceKind)}>
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
          setFile(path);
          setSurface('files');
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
