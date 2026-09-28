import { StrictMode, useSyncExternalStore } from 'react';
import { createRoot } from 'react-dom/client';
import { AppearanceProvider, type Appearance } from '@brett_lamy/ui';
import DiscordClone from '@brett_lamy/registry/blocks/discord-clone/page';
import './styles.css';

/* The Discord clone block, full-window, in the OS color scheme. */
const dark = window.matchMedia('(prefers-color-scheme: dark)');
const subscribe = (fn: () => void) => {
  dark.addEventListener('change', fn);
  return () => dark.removeEventListener('change', fn);
};
const useSystemAppearance = (): Appearance => useSyncExternalStore(subscribe, () => (dark.matches ? 'dark' : 'light'));

function App() {
  return (
    <AppearanceProvider value={useSystemAppearance()}>
      <div className="fixed inset-0">
        <DiscordClone />
      </div>
    </AppearanceProvider>
  );
}

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
