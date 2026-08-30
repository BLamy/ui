import type { Meta, StoryObj } from '@storybook/react-vite';
import { ModelPicker, ProvGlyph } from './model-picker';
import { MODEL_PICKER_MODELS_DEMO, ModelPickerDemo } from '../demos/catalog';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof ModelPicker> = {
  title: 'Organisms/ModelPicker',
  component: ModelPicker,
  decorators: [darkDecorator],
};
export default meta;
type Story = StoryObj<typeof ModelPicker>;

export const Default: Story = { render: () => <ModelPickerDemo /> };
export const Closed: Story = {
  args: { models: MODEL_PICKER_MODELS_DEMO, value: 'sonnet', favorites: ['sonnet'] },
};
export const ProviderGlyphs: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      {['anthropic', 'openai', 'google', 'opencode', 'deepseek'].map((p) => (
        <ProvGlyph key={p} p={p} />
      ))}
    </div>
  ),
};
