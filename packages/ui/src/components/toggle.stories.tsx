import type { Meta, StoryObj } from '@storybook/react-vite';
import { Toggle, ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle';
import { Icon } from '@/lib/icon';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof Toggle> = {
  title: 'Atoms/Toggle',
  component: Toggle,
  args: { children: 'Bold', variant: 'default', size: 'default' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['default', 'filled', 'outline', 'quiet'] },
    size: { control: 'inline-radio', options: ['sm', 'default', 'lg', 'icon-sm', 'icon', 'icon-lg'] },
    disabled: { control: 'boolean' },
  },
  decorators: [(Story) => <Panel><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof Toggle>;

/** One toggle; the controls change its variant and size. */
export const Default: Story = {};

const grid = (
  <div className="flex flex-col gap-3">
    {(['default', 'filled', 'outline', 'quiet'] as const).map((variant) => (
      <div key={variant} className="flex items-center gap-2">
        <Toggle variant={variant} aria-label="Favorite"><Icon name="star" size={18} /></Toggle>
        <Toggle variant={variant} defaultPressed aria-label="Favorite"><Icon name="starF" size={18} /></Toggle>
        <Toggle variant={variant}><Icon name="bell" size={18} />Alerts</Toggle>
        <Toggle variant={variant} defaultPressed><Icon name="bell" size={18} />Alerts</Toggle>
        <Toggle variant={variant} disabled>Off</Toggle>
        <Toggle variant={variant} disabled defaultPressed>On</Toggle>
      </div>
    ))}
    <div className="flex items-center gap-2">
      <Toggle size="sm" defaultPressed>Small</Toggle>
      <Toggle defaultPressed>Default</Toggle>
      <Toggle size="lg" defaultPressed>Large</Toggle>
    </div>
    <div className="flex items-center gap-2">
      <Toggle variant="quiet" size="icon-sm" aria-label="Bookmark"><Icon name="bookmark" size={18} sw={1.7} /></Toggle>
      <Toggle variant="quiet" size="icon-sm" defaultPressed aria-label="Bookmark"><Icon name="bookmark" size={18} sw={1.7} /></Toggle>
      <Toggle variant="filled" size="icon" defaultPressed aria-label="Mute"><Icon name="bell" size={18} /></Toggle>
      <Toggle variant="filled" size="icon-lg" aria-label="Mute"><Icon name="bell" size={20} /></Toggle>
    </div>
  </div>
);

/** Every variant at rest, pressed and disabled; the sizes; the icon sizes. */
export const Variants: Story = { render: () => grid };
export const Dark: Story = { decorators: [(Story) => <Panel dark><Story /></Panel>], render: () => grid };

/* ── ToggleGroup ── */

const B = () => <span className="font-bold">B</span>;
const I = () => <span className="font-serif italic">I</span>;
const U = () => <span className="underline">U</span>;
const S = () => <span className="line-through">S</span>;

function Format({ variant }: { variant: 'default' | 'filled' | 'outline' | 'quiet' }) {
  return (
    <ToggleGroup variant={variant} multiple defaultValue={['bold', 'italic']} aria-label="Text formatting">
      <ToggleGroupItem value="bold" aria-label="Bold"><B /></ToggleGroupItem>
      <ToggleGroupItem value="italic" aria-label="Italic"><I /></ToggleGroupItem>
      <ToggleGroupItem value="underline" aria-label="Underline"><U /></ToggleGroupItem>
      <ToggleGroupItem value="strike" aria-label="Strikethrough"><S /></ToggleGroupItem>
    </ToggleGroup>
  );
}

function Align({ variant }: { variant: 'default' | 'filled' | 'outline' }) {
  return (
    <ToggleGroup variant={variant} deselectable={false} defaultValue={['left']} aria-label="Alignment">
      <ToggleGroupItem value="left">Left</ToggleGroupItem>
      <ToggleGroupItem value="center">Center</ToggleGroupItem>
      <ToggleGroupItem value="right">Right</ToggleGroupItem>
    </ToggleGroup>
  );
}

const groups = (
  <div className="flex flex-col items-start gap-4">
    <Format variant="default" />
    <Format variant="quiet" />
    <Format variant="filled" />
    <Format variant="outline" />
    <Align variant="filled" />
    <Align variant="outline" />
    <ToggleGroup size="sm" variant="outline" defaultValue={['day']} aria-label="Range">
      <ToggleGroupItem value="day">Day</ToggleGroupItem>
      <ToggleGroupItem value="week">Week</ToggleGroupItem>
      <ToggleGroupItem value="month" disabled>Month</ToggleGroupItem>
    </ToggleGroup>
  </div>
);

/** ToggleGroup with `multiple`: formatting toggles that press independently but share one tab stop. */
export const Group: Story = { render: () => <Format variant="default" /> };
/** ToggleGroup pressing one at a time: in a `filled` tray the pressed card slides between items. */
export const GroupSingle: Story = { render: () => <Align variant="filled" /> };
/** Every ToggleGroup variant, multiple and single, and a disabled item. */
export const GroupVariants: Story = { render: () => groups };
export const GroupDark: Story = { decorators: [(Story) => <Panel dark><Story /></Panel>], render: () => groups };
