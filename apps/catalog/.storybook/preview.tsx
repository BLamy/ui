import React from 'react';
import type { Preview } from '@storybook/react-vite';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    options: {
      storySort: { order: ['Atoms', 'Molecules', 'Organisms', 'Templates', 'Pages'] },
    },
  },
};
export default preview;
