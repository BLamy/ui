import { StrictMode, type ReactElement } from 'react';
import * as ReactDOM from 'react-dom/client';
import '@brett_lamy/ui/styles.css';
// ui's sheet compiled with the registry blocks' Tailwind classes (loaded last, so it's the superset that wins).
import '@brett_lamy/registry/styles.css';
import { AppearanceProvider, DeliveryTrackingDemo, MapChatDemo } from '@brett_lamy/ui';
import App from './app/app';
import { DemoFullscreen } from './demo-adapter';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

/* `?demo=map-chat` / `?demo=delivery` render a demo full screen instead of the docs; `?example=<page>/<example>` one
   docs example and `?block=<slug>` a registry block (with `&theme=dark`, or the docs' saved / OS appearance). */
const params = new URLSearchParams(window.location.search);
const demo = params.get('demo');
const example = params.get('example') ?? (params.get('block') ? `blocks/${params.get('block')}` : null);
const theme = params.get('theme') ?? window.localStorage.getItem('bldocs-theme');
const appearance = theme === 'dark' || theme === 'light' ? theme : window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
if (example) document.documentElement.dataset.theme = appearance;
const fullscreen: Record<string, () => ReactElement> = {
  'map-chat': () => <MapChatDemo style={{ width: '100vw', height: '100dvh' }} />,
  delivery: () => <DeliveryTrackingDemo style={{ width: '100vw', height: '100dvh' }} />,
};
const Fullscreen = demo ? fullscreen[demo] : undefined;

root.render(
  <StrictMode>
    {example ? (
      <AppearanceProvider value={appearance}><DemoFullscreen src={example} /></AppearanceProvider>
    ) : Fullscreen ? <Fullscreen /> : <App />}
  </StrictMode>,
);
