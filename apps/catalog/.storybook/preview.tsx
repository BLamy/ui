import React from 'react';
import type { Preview } from '@storybook/react-vite';
// ui's stylesheet, as an app would load it — stories import components directly, which skips the stylesheet the
// package index pulls in. Compiled together with the registry blocks' classes (registry/styles.css imports it).
import '../../../registry/styles.css';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    options: {
      storySort: { order: ['Atoms', 'Molecules', 'Organisms', 'Templates', 'Pages', 'Blocks'] },
    },
  },
};
export default preview;
