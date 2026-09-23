import React from 'react';
import type { Preview } from '@storybook/react-vite';
// Every package's stylesheet, as an app would load them — stories import components directly, which skips
// the stylesheet each package index pulls in.
import '../../../packages/ui/src/styles.css';
import '../../../packages/chatkit/src/styles.css';
import '../../../packages/workbench/src/styles.css';
import '../../../packages/pencilkit/src/styles.css';

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    options: {
      storySort: { order: ['Atoms', 'Molecules', 'Organisms', 'Templates', 'Pages'] },
    },
  },
};
export default preview;
