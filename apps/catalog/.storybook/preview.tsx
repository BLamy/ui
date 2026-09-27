import React from 'react';
import type { Preview } from '@storybook/react-vite';
// Both packages' stylesheets, as an app would load them — stories import components directly, which skips
// the stylesheet each package index pulls in.
import '../../../packages/ui/src/styles.css';
import '../../../packages/pencilkit/src/styles.css';
// The catalog plugs PencilKit into the Composer's image annotator, as an app using both packages would
// (@brett_lamy/ui doesn't depend on @brett_lamy/pencilkit). Source modules, like the stories import.
import { ComposerAnnotatorProvider } from '../../../packages/ui/src/components/workbench/annotator';
import { PencilKitAnnotator } from '../../../packages/pencilkit/src/lib/pencilkit-annotator';

const preview: Preview = {
  decorators: [
    (Story) => (
      <ComposerAnnotatorProvider annotator={PencilKitAnnotator}>
        <Story />
      </ComposerAnnotatorProvider>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    options: {
      storySort: { order: ['Atoms', 'Molecules', 'Organisms', 'Templates', 'Pages'] },
    },
  },
};
export default preview;
