import type { Meta, StoryObj } from '@storybook/react-vite';
import { BeautifulCatalog } from './catalog';
import { beautifulDarkVars } from '../lib/base';
import '../styles.css';

const meta: Meta<typeof BeautifulCatalog> = {
  title: 'Pages/Beautiful UI',
  component: BeautifulCatalog,
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div style={{ ...beautifulDarkVars, background: 'var(--wb-bg)', minHeight: '100vh' }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof BeautifulCatalog>;

export const Catalog: Story = {};
