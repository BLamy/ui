import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ComposerAnnotatorProvider } from '@brett_lamy/ui';
import { PencilKitAnnotator } from '@brett_lamy/pencilkit';
import T3Clone from '@brett_lamy/registry/blocks/t3-clone/page';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <ComposerAnnotatorProvider annotator={PencilKitAnnotator}>
      <div style={{ position: 'fixed', inset: 0 }}>
        <T3Clone />
      </div>
    </ComposerAnnotatorProvider>
  </StrictMode>
);
