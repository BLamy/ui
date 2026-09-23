import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppearanceProvider } from '@brett_lamy/ui';
import { WorkbenchDemo } from './workbench-demo';
import '../styles.css';

const meta: Meta<typeof WorkbenchDemo> = {
  title: 'Pages/Workbench',
  component: WorkbenchDemo,
  parameters: { layout: 'fullscreen' },
};
export default meta;
type Story = StoryObj<typeof WorkbenchDemo>;

const frame = (w: number, h: number) => (args: React.ComponentProps<typeof WorkbenchDemo>) => (
  <div style={{ width: w, height: h, margin: '0 auto', overflow: 'hidden', border: '1px solid rgba(255,255,255,.1)' }}>
    <WorkbenchDemo {...args} />
  </div>
);

export const Desktop: Story = { render: frame(1280, 760) };
export const Medium: Story = { render: frame(900, 700) };
export const Phone: Story = { render: frame(390, 720) };
export const WithBrowserSurface: Story = { args: { surface: 'browser' }, render: frame(1280, 760) };

/* Appearance: the demo follows an ambient AppearanceProvider (the docs site's light/dark toggle). */
const inAppearance =
  (appearance: 'light' | 'dark', w = 1280, h = 760) =>
  (args: React.ComponentProps<typeof WorkbenchDemo>) => (
    <AppearanceProvider value={appearance}>
      <div style={{ width: w, height: h, margin: '0 auto', overflow: 'hidden' }}>
        <WorkbenchDemo {...args} />
      </div>
    </AppearanceProvider>
  );
export const AppearanceLight: Story = { render: inAppearance('light') };
export const AppearanceDark: Story = { render: inAppearance('dark') };
export const AppearanceLightDiff: Story = { args: { surface: 'diff' }, render: inAppearance('light') };
export const AppearanceLightPhone: Story = { render: inAppearance('light', 390, 720) };
