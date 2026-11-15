import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from '@ui-sdk/react/button';
import { FloatingSheet, FloatingSheetBody } from '@/components/ui/floating-sheet';
import { ThemeScope } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { pressable } from '@/lib/primitives';
import { TerminalHeader, TerminalBody, TerminalAction } from './terminal';
import { TERMINAL_SEED } from './fixtures';

const meta: Meta<typeof FloatingSheet> = {
  title: 'Organisms/WorkbenchDock (compact)',
  component: FloatingSheet,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof FloatingSheet>;

/* The compact dock: a FloatingSheet (`collapse="hide"`) in a phone frame — drag the cap between the 52% and 93%
   stops; a fast downward flick (or dragging past the low stop) puts it away. */
function SheetDemo({ open: initialOpen }: { open: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  return (
    <ThemeScope scope="workbench" className="grid min-h-[760px] place-items-center p-5">
      <div className="relative h-[720px] w-[390px] overflow-hidden rounded-xl border border-border bg-background">
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-[13px] text-tertiary-foreground">
          <div>
            <div className="mb-3.5">compact-width terminal presentation</div>
            <Button
              className={cn(pressable, 'cursor-pointer rounded-[9px] border-0 bg-primary px-4 py-[9px] text-[13px] font-semibold text-primary-foreground')}
              onClick={() => setOpen(true)}
            >
              Open terminal drawer
            </Button>
          </div>
        </div>
        {/* The drawer holds a terminal: a `terminal` theme scope, dark in either appearance. */}
        <ThemeScope scope="terminal" className="contents">
          <FloatingSheet
            variant="card"
            gutter={0}
            radius={16}
            collapse="hide"
            visible={open}
            onVisibleChange={setOpen}
            peek="52%"
            topGap="7%"
            hideOnScroll={false}
            scrim={false}
            aria-label="Dock"
            className="z-70"
            surfaceClassName="bg-background"
          >
            <FloatingSheetBody>
              <div className="flex h-full min-h-0 flex-col">
                <TerminalHeader title="zsh — cookbook">
                  <TerminalAction icon="rectangle-split" label="Split terminal" />
                  <TerminalAction icon="plus" label="New terminal" />
                  <TerminalAction icon="bin" label="Close terminal" onClick={() => setOpen(false)} />
                </TerminalHeader>
                <TerminalBody seed={TERMINAL_SEED} />
              </div>
            </FloatingSheetBody>
          </FloatingSheet>
        </ThemeScope>
      </div>
    </ThemeScope>
  );
}

export const Open: Story = { render: () => <SheetDemo open /> };
export const Closed: Story = { render: () => <SheetDemo open={false} /> };
