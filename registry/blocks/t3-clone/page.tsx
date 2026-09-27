import { useState } from 'react';
import {
  SURFACES,
  TerminalAction,
  TerminalBody,
  TerminalHeader,
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
  type Appearance,
  type SurfaceKind,
} from '@brett_lamy/ui';
import { AppSidebar } from './components/app-sidebar';
import { SurfacePanel } from './components/surface-panel';
import { ThreadView } from './components/thread-view';
import { PROJECT, TERMINAL_SEED } from './lib/data';
import { useThreads } from './lib/use-threads';

export interface T3CloneProps {
  tint?: string;
  /** light or dark; defaults to the ambient AppearanceProvider, else dark */
  appearance?: Appearance;
  /** terminal dock: unset opens it at desktop widths, `false` keeps it closed */
  terminal?: boolean;
  /** surface open in the right panel */
  surface?: SurfaceKind | null;
}

/**
 * T3 Code clone — thread sidebar · conversation · terminal dock · surface panel.
 * Desktop docks everything; tablet slides the panel over as a drawer; phones get a hamburger sidebar,
 * a bottom tab bar for surfaces, and the terminal in a snap sheet.
 */
export default function T3Clone({ tint, appearance, terminal, surface: initialSurface = null }: T3CloneProps) {
  const threads = useThreads();
  const [surface, setSurface] = useState<SurfaceKind | null>(initialSurface);

  return (
    <WorkbenchShell tint={tint} appearance={appearance} defaultDockOpen={terminal}>
      <WorkbenchSidebar>
        <AppSidebar state={threads} />
      </WorkbenchSidebar>

      <WorkbenchMain>
        <WorkbenchHeader>
          <WorkbenchSidebarTrigger />
          <WorkbenchTitle project={PROJECT}>{threads.current?.title ?? 'new thread'}</WorkbenchTitle>
          <WorkbenchActions>
            <WorkbenchAction icon="plus" label="New thread" onPress={threads.newThread} />
            <WorkbenchDockTrigger />
            <WorkbenchPanelTrigger />
          </WorkbenchActions>
        </WorkbenchHeader>

        <ThreadView state={threads} />

        <WorkbenchDock>
          <TerminalHeader title={`zsh — ${PROJECT}`}>
            <TerminalAction icon="split" label="Split terminal" />
            <TerminalAction icon="plus" label="New terminal" />
            <WorkbenchDockClose />
          </TerminalHeader>
          <TerminalBody seed={TERMINAL_SEED} />
        </WorkbenchDock>
      </WorkbenchMain>

      <SurfacePanel surface={surface} onSurface={setSurface} />

      <WorkbenchTabBar value={surface} onValueChange={(k) => setSurface(k as SurfaceKind)}>
        <WorkbenchTab id="chat" icon="msg">
          Chat
        </WorkbenchTab>
        {SURFACES.map((s) => (
          <WorkbenchTab key={s.k} id={s.k} icon={s.icon}>
            {s.name}
          </WorkbenchTab>
        ))}
      </WorkbenchTabBar>
    </WorkbenchShell>
  );
}
