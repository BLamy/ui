import type { Meta, StoryObj } from '@storybook/react-vite';
import { Spreadsheet } from '@/components/ui/spreadsheet';
import { parseCsv } from '@/lib/csv';
import { Panel } from '../stories/primitive-frame';

/* `engine="fallback"` keeps the histograms on the CPU, so screenshots don't depend on the machine's GPU. */

const meta: Meta<typeof Spreadsheet> = {
  title: 'Organisms/Spreadsheet',
  component: Spreadsheet,
  // One panel per story: 760 px, or what a story's `parameters.panel` asks for (a phone's width, dark).
  decorators: [(Story, { parameters }) => {
    const panel = (parameters.panel ?? {}) as { w?: number; dark?: boolean };
    return <Panel w={panel.w ?? 760} dark={panel.dark}><Story /></Panel>;
  }],
};
export default meta;
type Story = StoryObj<typeof Spreadsheet>;

const parts = parseCsv(`Part,Supplier,Stock,Unit price,Restocked
M3 heat-set insert,Ruthex,1840,0.06,2026-09-14
PETG filament (1 kg),Prusament,12,29.99,2026-10-02
Nozzle 0.4 mm,E3D,46,12.50,2026-08-21
PEI sheet,Prusa,7,39.00,2026-07-30
M3 × 8 screw,Bossard,3200,0.04,2026-09-14
Bowden tube (1 m),Capricorn,18,9.90,2026-06-11
Thermistor,Semitec,25,7.25,2026-10-12
Part cooling fan,Delta,14,6.80,2026-05-03
`).rows;

const base = { defaultValue: parts, engine: 'fallback', 'aria-label': 'Parts', className: 'h-[340px]' } as const;

export const Default: Story = { args: base };
export const Comfortable: Story = { args: { ...base, density: 'comfortable' } };
export const NoHeader: Story = { args: { ...base, header: false, histograms: false, defaultValue: parts.slice(1) } };
export const ReadOnly: Story = { args: { ...base, readOnly: true } };
export const Empty: Story = { args: { ...base, defaultValue: [['Name', 'Amount']] } };
/** Sorted from the start by Stock, highest first (`defaultSort`): the header's arrow, and the status bar says what ran it. */
export const Sorted: Story = { args: { ...base, defaultSort: { column: 2, direction: 'descending' } } };
/** No status bar, for a sheet that is only part of a screen. */
export const NoStatusBar: Story = { args: { ...base, statusBar: false } };
/** In a phone-sized frame: the grid scrolls both ways under its sticky titles and row numbers. */
export const Phone: Story = {
  args: { ...base, density: 'comfortable', className: 'h-[600px]' },
  parameters: { panel: { w: 390 } },
};
export const Dark: Story = {
  args: base,
  parameters: { panel: { dark: true } },
};
