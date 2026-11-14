# agent-test

Checks that a real model can operate the kit through UI SDK's agent tools (`snapshot`, `act`, `query`), with no
screenshots.

```sh
pnpm agent-test                  # all scenarios
pnpm agent-test settings rename  # a few, by id
AGENT_TEST_MODEL=gpt-5.4-mini pnpm agent-test
```

- **Key**: `OPENAI_API_KEY` from the environment, or from `.env.local` at the repo root (gitignored). If there is
  no key, the runner says so and exits 0, so CI without the secret stays green. The key is never printed.
- **Model**: `AGENT_TEST_MODEL`, or else the newest `gpt-<version>-mini` from `GET /v1/models` (then `-nano`, then
  `gpt-4o-mini`). The runner prints the model it used.
- **What is sent**: the system line, the goal, and the tool results (component snapshots of the scenario page).
  Nothing else.
- **Caps**: 8 model calls and 40k tokens per scenario, 300k per run, and 2k completion tokens per call.
- **Report**: one line per scenario (pass/fail, turns, tool calls, tokens, whether a failed step was retried), and
  JSON in `.results/<date>.json` plus `.results/latest.json`. The run exits 1 if a scenario fails.

## Files

| File | What it is |
| --- | --- |
| `run.mjs` | Starts Vite on port 5531 (`AGENT_TEST_PORT`) with `page/` as its root, opens each scenario in Playwright's Chromium, and runs the tool loop against `window.agentBridge` (a `createAgent` bridge). |
| `scenarios.mjs` | The goals and their end-state checks. A check reads the app state the page records (`window.__state`), not what the model says it did. |
| `page/scenarios.tsx` | The scenario pages, built from kit components inside `BLProvider`. |
| `page/main.tsx` | Mounts `?scenario=<id>` and creates the bridge. Its `allow` approves `data-agent-confirm` steps on the person's behalf and records each one, so `delete-project` can require that the bridge asked first. |

To add a scenario, add a component to `page/scenarios.tsx` that records its state with `useRecorded`, then add a
`{ id, goal, check }` entry to `scenarios.mjs`.

The deterministic layer (no network) lives in `packages/ui/src/agent/agent.*.test.tsx`, with its shared setup in
`packages/ui/test/agent-harness.tsx`. See `apps/docs/pages/agent-ready.md`.
