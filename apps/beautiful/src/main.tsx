import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BeautifulCatalog } from '@touchkit/beautiful';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <div style={{ position: 'fixed', inset: 0 }}>
      <BeautifulCatalog />
    </div>
  </StrictMode>
);
