import { StrictMode, type ReactElement } from 'react';
import * as ReactDOM from 'react-dom/client';
import '@brett_lamy/ui/styles.css';
import { ComposerAnnotatorProvider, DeliveryTrackingDemo, MapChatDemo } from '@brett_lamy/ui';
import { PencilKitAnnotator } from '@brett_lamy/pencilkit';
import App from './app/app';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

/* `?demo=map-chat` / `?demo=delivery` render a demo full screen instead of the docs. */
const demo = new URLSearchParams(window.location.search).get('demo');
const fullscreen: Record<string, () => ReactElement> = {
  'map-chat': () => <MapChatDemo style={{ width: '100vw', height: '100dvh' }} />,
  delivery: () => <DeliveryTrackingDemo style={{ width: '100vw', height: '100dvh' }} />,
};
const Fullscreen = demo ? fullscreen[demo] : undefined;

// Every Composer in the docs annotates pasted images with PencilKit.
root.render(
  <StrictMode>
    <ComposerAnnotatorProvider annotator={PencilKitAnnotator}>
      {Fullscreen ? <Fullscreen /> : <App />}
    </ComposerAnnotatorProvider>
  </StrictMode>,
);
