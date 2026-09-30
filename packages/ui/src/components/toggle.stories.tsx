import type { Meta, StoryObj } from '@storybook/react-vite';
import { Toggle } from '@/components/ui/toggle';
import { Icon } from '@/lib/icon';
import { Panel } from '../stories/primitive-frame';

const meta: Meta<typeof Toggle> = {
  title: 'Atoms/Toggle',
  component: Toggle,
  args: { children: 'Bold', variant: 'default', size: 'default' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['default', 'filled', 'outline'] },
    size: { control: 'inline-radio', options: ['sm', 'default', 'lg'] },
  },
  decorators: [(Story) => <Panel><Story /></Panel>],
};
export default meta;
type Story = StoryObj<typeof Toggle>;

export const Default: Story = {};

const grid = (
  <div className="flex flex-col gap-3">
    {(['default', 'filled', 'outline'] as const).map((variant) => (
      <div key={variant} className="flex items-center gap-2">
        <Toggle variant={variant} aria-label="Favorite"><Icon name="star" size={18} /></Toggle>
        <Toggle variant={variant} defaultSelected aria-label="Favorited"><Icon name="starF" size={18} /></Toggle>
        <Toggle variant={variant}><Icon name="bell" size={18} />Alerts</Toggle>
        <Toggle variant={variant} defaultSelected><Icon name="bell" size={18} />Alerts</Toggle>
        <Toggle variant={variant} isDisabled>Off</Toggle>
      </div>
    ))}
    <div className="flex items-center gap-2">
      <Toggle size="sm" defaultSelected>Small</Toggle>
      <Toggle defaultSelected>Default</Toggle>
      <Toggle size="lg" defaultSelected>Large</Toggle>
    </div>
  </div>
);

export const Variants: Story = { render: () => grid };
export const Dark: Story = { decorators: [(Story) => <Panel dark><Story /></Panel>], render: () => grid };
