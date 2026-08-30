import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PencilKitDemo } from '@touchkit/pencilkit';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <div style={{ position: 'fixed', inset: 0 }}>
      <PencilKitDemo dark />
    </div>
  </StrictMode>
);
