import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { SnapSheet } from './snap-sheet';
import { TerminalHeader, TerminalBody, TerminalAction } from './terminal';
import { WorkbenchTheme } from '../../lib/workbench/theme';
import { ThemeScope } from '../../lib/theme';
import { Button } from '../../lib/workbench/press';
import { cn, wbPress } from '../../lib/workbench/util';
import { TERMINAL_SEED } from './fixtures';
import '../../styles.css';

const meta: Meta<typeof SnapSheet> = {
  title: 'Organisms/SnapSheet',
  component: SnapSheet,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof SnapSheet>;

/* vaul-style bottom drawer in a phone frame — drag the handle between the 52% and 93%
   snap points; a fast downward flick (or dragging past the low snap) closes it. */
function SheetDemo({ open: initialOpen }: { open: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <WorkbenchTheme className="grid min-h-[760px] place-items-center p-5">
      <div className="relative h-[720px] w-[390px] overflow-hidden rounded-xl border border-border bg-background">
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-[13px] text-tertiary-foreground">
          <div>
            <div className="mb-3.5">compact-width terminal presentation</div>
            <Button
              className={cn(wbPress, 'cursor-pointer rounded-[9px] border-0 bg-primary px-4 py-[9px] text-[13px] font-semibold text-primary-foreground')}
              onPress={() => setOpen(true)}
            >
              Open terminal drawer
            </Button>
          </div>
        </div>
        {/* The drawer holds a terminal: a `terminal` theme scope, dark in either appearance. */}
        <ThemeScope scope="terminal" className="contents">
          <SnapSheet open={open} onClose={() => setOpen(false)} snaps={[0.52, 0.93]} className="bg-background">
            <TerminalHeader title="zsh — cookbook">
              <TerminalAction icon="rectangle-split" label="Split terminal" />
              <TerminalAction icon="plus" label="New terminal" />
              <TerminalAction icon="bin" label="Close terminal" onPress={() => setOpen(false)} />
            </TerminalHeader>
            <TerminalBody seed={TERMINAL_SEED} />
          </SnapSheet>
        </ThemeScope>
      </div>
    </WorkbenchTheme>
  );
}

export const Open: Story = { render: () => <SheetDemo open /> };
export const Closed: Story = { render: () => <SheetDemo open={false} /> };
