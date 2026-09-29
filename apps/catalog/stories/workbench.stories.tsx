import type { ComponentProps } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppearanceProvider } from '@brett_lamy/ui';
import T3Clone from '@brett_lamy/registry/blocks/t3-clone/page';

/* The t3-clone registry block (registry/blocks/t3-clone), composed from the WorkbenchShell primitives. */
const meta: Meta<typeof T3Clone> = {
  title: 'Pages/Workbench',
  component: T3Clone,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof T3Clone>;

const frame = (w: number, h: number) => (args: ComponentProps<typeof T3Clone>) => (
  <div style={{ width: w, height: h, margin: '0 auto', overflow: 'hidden', border: '1px solid rgba(255,255,255,.1)' }}>
    <T3Clone {...args} />
  </div>
);

export const Desktop: Story = { render: frame(1280, 760) };
export const Medium: Story = { render: frame(900, 700) };
export const Phone: Story = { render: frame(390, 720) };
export const WithBrowserSurface: Story = { args: { surface: 'browser' }, render: frame(1280, 760) };

/* Appearance: the block follows an ambient AppearanceProvider (the docs site's light/dark toggle). */
const inAppearance =
  (appearance: 'light' | 'dark', w = 1280, h = 760) =>
  (args: ComponentProps<typeof T3Clone>) => (
    <AppearanceProvider value={appearance}>
      <div style={{ width: w, height: h, margin: '0 auto', overflow: 'hidden' }}>
        <T3Clone {...args} />
      </div>
    </AppearanceProvider>
  );
export const AppearanceLight: Story = { render: inAppearance('light') };
export const AppearanceDark: Story = { render: inAppearance('dark') };
export const AppearanceLightDiff: Story = { args: { surface: 'diff' }, render: inAppearance('light') };
export const AppearanceLightPhone: Story = { render: inAppearance('light', 390, 720) };

/* The ⌘K command palette, open on each of its reference pages. */
export const CommandPalette: Story = { args: { palette: true }, render: frame(1280, 760) };
export const CommandPaletteProjects: Story = { args: { palette: ['projects'] }, render: frame(1280, 760) };
export const CommandPaletteAddProject: Story = { args: { palette: ['add-project'] }, render: frame(1280, 760) };
export const CommandPaletteLight: Story = { args: { palette: true }, render: inAppearance('light') };
