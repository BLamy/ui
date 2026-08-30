import { StrictMode } from 'react';
import * as ReactDOM from 'react-dom/client';
import '@touchkit/ui/styles.css';
import '@touchkit/chatkit/styles.css';
import '@touchkit/workbench/styles.css';
import App from './app/app';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement,
);

root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
