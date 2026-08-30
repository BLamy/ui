import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatDemo } from '@touchkit/chatkit';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <div style={{ position: 'fixed', inset: 0 }}>
      <ChatDemo />
    </div>
  </StrictMode>
);
