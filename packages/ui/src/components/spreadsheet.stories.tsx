import type { Meta, StoryObj } from '@storybook/react-vite';
import { Spreadsheet } from '@/components/ui/spreadsheet';
import { parseCsv } from '@/lib/csv';
import { Panel } from '../stories/primitive-frame';

/* `engine="fallback"` keeps the histograms on the CPU, so screenshots don't depend on the machine's GPU. */

const meta: Meta<typeof Spreadsheet> = {
  title: 'Organisms/Spreadsheet',
  component: Spreadsheet,
  decorators: [(Story) => <Panel w={760}><Story /></Panel>],
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
export const ReadOnly: Story = { args: { ...base, isReadOnly: true } };
export const Empty: Story = { args: { ...base, defaultValue: [['Name', 'Amount']] } };
export const Dark: Story = {
  args: base,
  decorators: [(Story) => <Panel w={760} dark><Story /></Panel>],
};
