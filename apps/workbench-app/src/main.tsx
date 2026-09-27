import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ComposerAnnotatorProvider, WorkbenchDemo } from '@brett_lamy/ui';
import { PencilKitAnnotator } from '@brett_lamy/pencilkit';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <ComposerAnnotatorProvider annotator={PencilKitAnnotator}>
      <div style={{ position: 'fixed', inset: 0 }}>
        <WorkbenchDemo />
      </div>
    </ComposerAnnotatorProvider>
  </StrictMode>
);
