/* Shared Storybook decorator: dark workbench frame supplying the --wb-* vars. */
import type { Decorator } from '@storybook/react-vite';
import { BFONT, beautifulDarkVars } from './lib/base';
import './styles.css';

export const darkDecorator: Decorator = (Story) => (
  <div
    style={{
      ...beautifulDarkVars,
      background: 'var(--wb-bg)',
      color: 'var(--wb-label)',
      fontFamily: BFONT,
      minHeight: '100vh',
      padding: 24,
      boxSizing: 'border-box',
    }}
  >
    <Story />
  </div>
);
