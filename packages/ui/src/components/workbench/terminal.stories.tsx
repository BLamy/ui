import type { Meta, StoryObj } from '@storybook/react-vite';
import { TerminalHeader, TerminalBody, TerminalAction } from './terminal';
import { WorkbenchDock, WorkbenchDockClose } from '../../templates/workbench-shell';
import { WorkbenchTheme } from '../../lib/workbench/theme';
import { TERMINAL_SEED } from './fixtures';
import { themeScopeProps } from '../../lib/theme';
import '../../styles.css';

const TERMINAL = themeScopeProps({ scope: 'terminal', appearance: 'dark' });

const meta: Meta<typeof WorkbenchDock> = {
  title: 'Organisms/TerminalDock',
  component: WorkbenchDock,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof WorkbenchDock>;

/* WorkbenchDock on its own: an inline dock resized from its top edge (110–520px). */
export const Dock: Story = {
  render: () => (
    <WorkbenchTheme style={{ height: 480, display: 'flex', flexDirection: 'column' }}>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center', color: 'var(--tertiary-foreground)', fontSize: 13 }}>
        editor area — drag the dock's top edge to resize
      </div>
      <WorkbenchDock>
        <TerminalHeader title="zsh — cookbook">
          <TerminalAction icon="rectangle-split" label="Split terminal" />
          <TerminalAction icon="plus" label="New terminal" />
          <WorkbenchDockClose />
        </TerminalHeader>
        <TerminalBody seed={TERMINAL_SEED} />
      </WorkbenchDock>
    </WorkbenchTheme>
  ),
};

export const HeaderAndBody: Story = {
  render: () => (
    <WorkbenchTheme style={{ minHeight: 420, padding: 24, display: 'grid', placeItems: 'center' }}>
      {/* The terminal's window is a `terminal` theme scope: its own dark background. */}
      <div {...TERMINAL} className={TERMINAL.className} style={{ display: 'flex', flexDirection: 'column', height: 300, width: 520, borderRadius: 12, overflow: 'hidden', background: 'var(--background)', border: '1px solid var(--border)' }}>
        <TerminalHeader title="zsh — cookbook">
          <TerminalAction icon="rectangle-split" label="Split terminal" />
          <TerminalAction icon="plus" label="New terminal" />
          <TerminalAction icon="bin" label="Close terminal" />
        </TerminalHeader>
        <TerminalBody seed={[{ t: 'help', p: true }, { t: 'available: ls, pwd, echo, whoami, npm run dev, clear' }]} />
      </div>
    </WorkbenchTheme>
  ),
};
