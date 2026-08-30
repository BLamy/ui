import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WorkbenchDemo } from '@touchkit/workbench';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <div style={{ position: 'fixed', inset: 0 }}>
      <WorkbenchDemo />
    </div>
  </StrictMode>
);
