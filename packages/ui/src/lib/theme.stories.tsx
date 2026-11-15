import type { ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Popover, PopoverContent, PopoverDescription, PopoverTitle, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { AppearanceProvider, BLProvider, ThemeScope, contrastRatio, tintForeground, useThemeScope, type Appearance } from '@/lib/theme';

const meta: Meta<typeof ThemeScope> = {
  title: 'Atoms/ThemeScope',
  component: ThemeScope,
};
export default meta;
type Story = StoryObj<typeof ThemeScope>;

/* The workbench scope paints its root (background, text, font) and dresses the popups opened inside it. */

function Readout() {
  const scope = useThemeScope();
  return (
    <span className="rounded-full bg-secondary px-2 py-0.5 text-caption font-semibold text-muted-foreground">
      {scope?.scope} · {scope?.appearance}
    </span>
  );
}

function Sample({ open }: { open?: boolean }) {
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-2">
        <span className="text-footnote font-semibold">Agent workspace</span>
        <Readout />
      </div>
      <div className="rounded-card bg-card p-3 text-subhead shadow-hairline">
        The build pulls in <code className="rounded bg-code px-1.5 py-0.5 font-mono text-caption text-code-foreground">@babel/core</code> for every file.
        <div className="mt-1 text-footnote text-muted-foreground">Worked for 12s</div>
      </div>
      <div className="flex gap-2">
        <Button size="sm">Apply fix</Button>
        <Popover defaultOpen={open}>
          <PopoverTrigger render={<Button size="sm" variant="secondary" />}>Details</PopoverTrigger>
          <PopoverContent side="bottom" align="start">
            <PopoverTitle>Opened inside the scope</PopoverTitle>
            <PopoverDescription className="mt-1">This popover renders in the layer host, and still wears the workbench palette and tint.</PopoverDescription>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function Frame({ children, dark, h = 300, w = 760 }: { children: ReactNode; dark?: boolean; h?: number; w?: number }) {
  return (
    <div style={{ width: w, height: h }} className="overflow-hidden rounded-xl">
      <BLProvider appearance={dark ? 'dark' : 'light'}>
        <div className="grid h-full grid-cols-2 gap-4 p-4">{children}</div>
      </BLProvider>
    </div>
  );
}

const Scope = ({ appearance, tint, open }: { appearance?: Appearance; tint?: string; open?: boolean }) => (
  <ThemeScope scope="workbench" appearance={appearance} tint={tint} className="rounded-card p-4 shadow-hairline">
    <Sample open={open} />
  </ThemeScope>
);

/** Explicit appearances side by side on a light page. */
export const Workbench: Story = {
  render: () => (
    <Frame>
      <Scope appearance="light" />
      <Scope appearance="dark" />
    </Frame>
  ),
};

/** No `appearance` and no ambient one: the workbench scope is dark-first. With an AppearanceProvider it follows that. */
export const WorkbenchDefaultAppearance: Story = {
  render: () => (
    <Frame>
      <Scope />
      <AppearanceProvider value="light"><Scope /></AppearanceProvider>
    </Frame>
  ),
};

/** `tint` replaces --primary and --ring inside the scope, and picks the ink on it (--primary-foreground): white while it
    reaches 3:1, else a near-black. Each swatch is a primary Button in the scope, with the ratio of its label on its fill. */
export const WorkbenchTint: Story = {
  render: () => (
    <Frame dark h={420} w={840}>
      <Scope appearance="dark" tint="#30d158" />
      <Scope appearance="light" tint="#ff9f0a" />
      <TintSwatches appearance="dark" />
      <TintSwatches appearance="light" />
    </Frame>
  ),
};

const TINTS = ['#0a84ff', '#ff453a', '#bf5af2', '#30d158', '#ff9f0a', '#ffd60a', '#64d2ff', '#ac8e68'];

function TintSwatches({ appearance }: { appearance: Appearance }) {
  return (
    <ThemeScope scope="workbench" appearance={appearance} className="grid grid-cols-2 content-start gap-2 rounded-card p-3 shadow-hairline">
      {TINTS.map((tint) => (
        <ThemeScope key={tint} tint={tint} className="flex items-center gap-2">
          <Button size="sm">Apply</Button>
          <span className="font-mono text-caption whitespace-nowrap text-muted-foreground tabular-nums">
            {tint} {contrastRatio(tint, tintForeground(tint))?.toFixed(1)}:1
          </span>
        </ThemeScope>
      ))}
    </ThemeScope>
  );
}

/** A popover opened inside a dark workbench on a light page wears the scope, not the page. */
export const WorkbenchPopover: Story = {
  render: () => (
    <Frame h={340}>
      <Scope appearance="dark" open />
      <div />
    </Frame>
  ),
};
