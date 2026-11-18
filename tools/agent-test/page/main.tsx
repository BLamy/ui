/* The scenario page run.mjs drives: one kit scenario (`?scenario=<id>`) inside BLProvider, and UI SDK's agent bridge
   on `window.agentBridge`, the only thing the model's tool calls reach. The app state each scenario keeps is mirrored
   on `window.__state` for run.mjs's end-state check, which the model never sees. */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createAgent } from '@brett_lamy/ui/sdk/react/agent';
import { BLProvider } from '@/lib/theme';
import '../../../packages/ui/src/styles.css';
import { scenarios, store } from './scenarios';

// The person behind the goal approves every step marked `data-agent-confirm`; each one is recorded, so a check can
// insist the bridge asked.
const agent = createAgent({
  allow: (step) => {
    if (step.confirm) store.confirms.push(step.confirm);
    return true;
  },
});

Object.assign(window, {
  agentBridge: {
    snapshot: () => agent.snapshot(),
    act: (input: Parameters<typeof agent.act>[0]) => agent.act(input),
    query: (input: Parameters<typeof agent.query>[0]) => agent.query(input),
  },
  __state: store,
});

const id = new URLSearchParams(location.search).get('scenario') ?? '';
const Scenario = scenarios[id];

createRoot(document.getElementById('root') as HTMLElement).render(
  <StrictMode>
    <BLProvider className="min-h-screen bg-background p-8 text-foreground">
      <main data-scenario={id} className="mx-auto grid max-w-md gap-5">
        {Scenario ? <Scenario /> : <p>Unknown scenario “{id}”.</p>}
      </main>
    </BLProvider>
  </StrictMode>,
);
