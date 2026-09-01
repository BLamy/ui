/* Actual live React demo for the "Live React demos" page.

   Imports the playground entry DIRECTLY (not via docstream-lite) and lazily,
   so the almost-node/@agent-wasm runtime only loads when this page mounts. */
import { Suspense, lazy } from 'react';

const ReactCodePreview = lazy(() =>
  import('../../src/playground').then((m) => ({ default: m.ReactCodePreview })),
);

const FILES = {
  '/src/App.jsx': `import { useState } from 'react'

export default function App() {
  const [count, setCount] = useState(0)
  return (
    <div style={{ fontFamily: 'sans-serif', padding: 24 }}>
      <h1>Counter</h1>
      <p data-count>Count: {count}</p>
      <button onClick={() => setCount((c) => c + 1)}>Increment</button>
    </div>
  )
}
`,
  '/src/main.jsx': `import { createRoot } from 'react-dom/client'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(<App />)
`,
};

// Stable identities — these land in the ReactDemo effect deps.
const WORKSPACE_OPTIONS = {
  basePath: import.meta.env.BASE_URL.replace(/\/$/, ''),
};

export function ReactDemoLive() {
  return (
    <Suspense
      fallback={
        <div style={{ border: '1px solid #e2e2ea', borderRadius: 12, padding: 24, margin: '16px 0', fontSize: 13, color: '#9a9aa2' }}>
          Loading the almost-node runtime…
        </div>
      }
    >
      <ReactCodePreview
        files={FILES}
        entry="/src/main.jsx"
        codeFile="/src/App.jsx"
        title="Counter app — real Vite dev server in your browser"
        height={320}
        workspaceOptions={WORKSPACE_OPTIONS}
      />
    </Suspense>
  );
}
