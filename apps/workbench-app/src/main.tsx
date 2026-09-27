import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import T3Clone from '@brett_lamy/registry/blocks/t3-clone/page';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <div style={{ position: 'fixed', inset: 0 }}>
      <T3Clone />
    </div>
  </StrictMode>
);
