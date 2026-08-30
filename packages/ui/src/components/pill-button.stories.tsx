import type { Meta, StoryObj } from '@storybook/react-vite';
import { PillButton } from './pill-button';
import { Pad } from '../stories/frame';

const meta: Meta<typeof PillButton> = {
  title: 'Atoms/PillButton',
  component: PillButton,
  decorators: [(Story) => <Pad><Story /></Pad>],
};
export default meta;
type Story = StoryObj<typeof PillButton>;

export const Tint: Story = { args: { label: 'Save to Photos' } };
export const Soft: Story = { args: { label: 'Not Now', tone: 'soft' } };

export const Stack: Story = {
  render: () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <PillButton label="Export Wei.vcf" />
      <PillButton label="Cancel" tone="soft" />
    </div>
  ),
};
