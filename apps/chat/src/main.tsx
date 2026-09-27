import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import DiscordClone from '@brett_lamy/registry/blocks/discord-clone/page';
import './styles.css';

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <div style={{ position: 'fixed', inset: 0 }}>
      <DiscordClone />
    </div>
  </StrictMode>
);
