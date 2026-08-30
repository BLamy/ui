import type { Meta, StoryObj } from '@storybook/react-vite';
import { BUIToast, ToastProvider } from './toast';
import { ToastDemo } from '../demos/catalog';
import { darkDecorator } from '../story-utils';

const meta: Meta<typeof ToastProvider> = {
  title: 'Organisms/Toast',
  component: ToastProvider,
  decorators: [darkDecorator],
};
export default meta;
type Story = StoryObj<typeof ToastProvider>;

export const Stack: Story = { render: () => <ToastDemo /> };
export const Tones: Story = {
  render: () => (
    <div style={{ display: 'grid', gap: 10, width: 272 }}>
      <BUIToast tone="info" title="Agent resumed" detail="Picking up the reorder plan." />
      <BUIToast tone="success" title="Order placed" detail="48 cases from cone_king." />
      <BUIToast tone="error" title="Supplier API failed" detail="Retrying in 30s." />
    </div>
  ),
};
