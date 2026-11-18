#!/usr/bin/env node
/* The model-driven agent test: a real model operates the kit through UI SDK's agent tools (snapshot, act, query),
   with no screenshots, and each scenario's end state is checked in the page.

     pnpm agent-test                         every scenario
     pnpm agent-test settings rename         some of them
     AGENT_TEST_MODEL=gpt-5.4-mini pnpm agent-test

   The key comes from OPENAI_API_KEY or the worktree's .env.local; with none, it says so and exits 0. The model gets
   the goal and the tools' results (component snapshots of the scenario page), nothing else. A JSON report lands in
   tools/agent-test/.results/. Exits 1 when a scenario fails. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../..');
const PORT = Number(process.env.AGENT_TEST_PORT ?? 5531);

// Hard caps, so a run stays cheap whatever the model does.
const MAX_TURNS = 8; // model calls per scenario
const MAX_SCENARIO_TOKENS = 40_000;
const MAX_RUN_TOKENS = 300_000;
const MAX_COMPLETION_TOKENS = 2_000; // per call, reasoning included
const MAX_RESULT_CHARS = 8_000; // a tool result sent back to the model

const SYSTEM = [
  'You operate a web page for a person, through three tools: snapshot, query and act.',
  'Do what the person asks, using the tools. Put every step you already know into one act call.',
  'When the goal is done, or cannot be done, reply with one short sentence and no tool call. Do not ask questions.',
].join(' ');

function loadKey() {
  if (process.env.OPENAI_API_KEY?.trim()) return process.env.OPENAI_API_KEY.trim();
  const file = join(ROOT, '.env.local');
  if (!existsSync(file)) return null;
  const line = readFileSync(file, 'utf8').match(/^\s*(?:export\s+)?OPENAI_API_KEY\s*=\s*(.*)$/m);
  const key = line?.[1].trim().replace(/^(['"])(.*)\1$/, '$2');
  return key || null;
}

async function openai(key, path, body) {
  // Up to three tries on rate limits and server errors.
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(`https://api.openai.com/v1/${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { authorization: `Bearer ${key}`, ...(body ? { 'content-type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (response.ok) return { json: await response.json(), retries: attempt };
    const text = await response.text();
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
      continue;
    }
    // Error bodies can echo part of the key ("Incorrect API key provided: sk-…"): never print it.
    const error = new Error(`OpenAI ${path} ${response.status}: ${text.replace(/sk-[\w*-]+/g, 'sk-…').slice(0, 300)}`);
    error.status = response.status;
    error.body = text;
    throw error;
  }
}

/** The newest small model: `gpt-<version>-mini` (no dated snapshot), else `-nano`, else gpt-4o-mini. */
async function pickModel(key) {
  if (process.env.AGENT_TEST_MODEL) return { model: process.env.AGENT_TEST_MODEL, how: 'AGENT_TEST_MODEL' };
  const { json } = await openai(key, 'models');
  const ids = json.data.map((m) => m.id);
  for (const tier of ['mini', 'nano']) {
    const ranked = ids
      .map((id) => ({ id, m: id.match(new RegExp(`^gpt-(\\d+(?:\\.\\d+)?)-${tier}$`)) }))
      .filter((x) => x.m)
      .sort((a, b) => Number(b.m[1]) - Number(a.m[1]));
    if (ranked.length) return { model: ranked[0].id, how: `newest gpt-*-${tier} of ${ids.length} listed models` };
  }
  return { model: 'gpt-4o-mini', how: 'fallback' };
}

const truncate = (text) => (text.length > MAX_RESULT_CHARS ? `${text.slice(0, MAX_RESULT_CHARS)}… (truncated)` : text);

async function runScenario({ page, baseURL, key, model, tools, scenario, budget }) {
  const errors = [];
  const onError = (error) => errors.push(String(error.message ?? error));
  page.on('pageerror', onError);
  await page.goto(`${baseURL}/?scenario=${scenario.id}`, { waitUntil: 'load' });
  await page.waitForFunction(() => 'agentBridge' in window && document.querySelector('[data-scenario] > *'), null, { timeout: 60_000 });
  await page.waitForTimeout(150);

  const messages = [{ role: 'system', content: SYSTEM }, { role: 'user', content: scenario.goal }];
  const result = {
    id: scenario.id, goal: scenario.goal, pass: false, turns: 0, toolCalls: [], tokens: { prompt: 0, completion: 0, total: 0 },
    failedSteps: [], retried: false, httpRetries: 0, stop: 'turn limit', reply: null, state: null, pageErrors: errors,
  };
  let reasoning = /^gpt-5|^o\d/.test(model) ? 'low' : undefined;

  while (result.turns < MAX_TURNS) {
    if (result.tokens.total >= MAX_SCENARIO_TOKENS || budget.used >= MAX_RUN_TOKENS) {
      result.stop = 'token cap';
      break;
    }
    result.turns++;
    const body = { model, messages, tools, tool_choice: 'auto', max_completion_tokens: MAX_COMPLETION_TOKENS, ...(reasoning ? { reasoning_effort: reasoning } : {}) };
    let response;
    try {
      response = await openai(key, 'chat/completions', body);
    } catch (error) {
      // A model that takes no reasoning effort: ask again without it.
      if (reasoning && error.status === 400 && /reasoning/i.test(error.body ?? '')) {
        reasoning = undefined;
        result.turns--;
        continue;
      }
      throw error;
    }
    const { json, retries } = response;
    result.httpRetries += retries;
    const usage = json.usage ?? {};
    result.tokens.prompt += usage.prompt_tokens ?? 0;
    result.tokens.completion += usage.completion_tokens ?? 0;
    result.tokens.total += usage.total_tokens ?? 0;
    budget.used += usage.total_tokens ?? 0;

    const message = json.choices?.[0]?.message;
    if (!message) {
      result.stop = 'no message';
      break;
    }
    messages.push(message);
    if (!message.tool_calls?.length) {
      result.reply = message.content ?? null;
      result.stop = 'model finished';
      break;
    }
    for (const call of message.tool_calls) {
      let args = {};
      try {
        args = JSON.parse(call.function.arguments || '{}');
      } catch {
        // Sent back as an error below.
      }
      const name = call.function.name;
      let output;
      if (!['snapshot', 'act', 'query'].includes(name)) output = { error: `No tool ${name}` };
      else {
        try {
          output = await page.evaluate(([tool, input]) => window.agentBridge[tool](input), [name, args]);
        } catch (error) {
          output = { error: String(error.message ?? error).slice(0, 500) };
        }
      }
      const failed = name === 'act' && output && output.ok === false;
      if (failed) result.failedSteps.push(output.error?.message ?? 'failed');
      // A retry: an act that failed, followed by one that worked.
      if (name === 'act' && output?.ok === true && result.failedSteps.length) result.retried = true;
      result.toolCalls.push({ tool: name, args, ok: name === 'act' ? output?.ok === true : !output?.error, error: failed ? output.error?.message : undefined });
      messages.push({ role: 'tool', tool_call_id: call.id, content: truncate(JSON.stringify(output ?? null)) });
    }
  }

  await page.waitForTimeout(250);
  result.state = await page.evaluate(() => JSON.parse(JSON.stringify(window.__state)));
  result.pass = Boolean(scenario.check(result.state));
  page.off('pageerror', onError);
  return result;
}

async function main() {
  const key = loadKey();
  if (!key) {
    console.log('agent-test: no OPENAI_API_KEY (environment or .env.local): skipping the model-driven scenarios.');
    return 0;
  }
  const { scenarios } = await import('./scenarios.mjs');
  const only = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const chosen = only.length ? scenarios.filter((s) => only.includes(s.id)) : scenarios;
  if (!chosen.length) {
    console.error(`agent-test: no scenario named ${only.join(', ')}. Known: ${scenarios.map((s) => s.id).join(', ')}`);
    return 1;
  }

  const { model, how } = await pickModel(key);
  console.log(`agent-test: model ${model} (${how}); ${chosen.length} scenario(s); caps ${MAX_TURNS} turns, ${MAX_SCENARIO_TOKENS} tokens each, ${MAX_RUN_TOKENS} per run`);

  // UI SDK is the library's (packages/ui imports it as `@ui-sdk/core`; the workspace root does not depend on it).
  const fromUi = createRequire(join(dirname(fileURLToPath(import.meta.url)), '../../packages/ui/package.json'));
  const { agentTools } = await import(pathToFileURL(fromUi.resolve('@ui-sdk/core/agent')).href);
  const tools = agentTools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.inputSchema } }));

  const [{ createServer }, { default: react }, { default: tailwindcss }, { aliases }, { chromium }] = await Promise.all([
    import('vite'),
    import('@vitejs/plugin-react'),
    import('@tailwindcss/vite'),
    import('../alias.mjs'),
    import('@playwright/test'),
  ]);
  const server = await createServer({
    configFile: false,
    root: join(HERE, 'page'),
    cacheDir: join(ROOT, 'node_modules/.vite/agent-test'),
    // One React for the kit and its dependencies (framer-motion would otherwise find another copy).
    resolve: { alias: aliases, dedupe: ['react', 'react-dom'] },
    plugins: [react(), tailwindcss()],
    server: { port: PORT, strictPort: true, host: '127.0.0.1' },
    logLevel: 'warn',
  });
  await server.listen();
  const baseURL = `http://127.0.0.1:${PORT}`;
  const browser = await chromium.launch();
  const budget = { used: 0 };
  const results = [];
  try {
    for (const scenario of chosen) {
      const context = await browser.newContext({ viewport: { width: 900, height: 720 } });
      const page = await context.newPage();
      try {
        const r = await runScenario({ page, baseURL, key, model, tools, scenario, budget });
        results.push(r);
        console.log(
          `${r.pass ? 'PASS' : 'FAIL'}  ${r.id.padEnd(15)} ${String(r.turns).padStart(2)} turns  ${String(r.toolCalls.length).padStart(2)} tool calls  ${String(r.tokens.total).padStart(6)} tokens${r.retried ? '  (retried a failed step)' : ''}${r.pass ? '' : `  stop: ${r.stop}`}`,
        );
        if (!r.pass) console.log(`      state ${JSON.stringify(r.state)}${r.failedSteps.length ? `\n      failed steps: ${r.failedSteps.join(' | ')}` : ''}`);
      } catch (error) {
        results.push({ id: scenario.id, goal: scenario.goal, pass: false, error: String(error.message ?? error) });
        console.log(`FAIL  ${scenario.id.padEnd(15)} error: ${String(error.message ?? error).slice(0, 300)}`);
      } finally {
        await context.close();
      }
    }
  } finally {
    await browser.close();
    await server.close();
  }

  const passed = results.filter((r) => r.pass).length;
  const tokens = results.reduce((n, r) => n + (r.tokens?.total ?? 0), 0);
  const report = { date: new Date().toISOString(), model, modelChoice: how, passed, failed: results.length - passed, tokens, caps: { MAX_TURNS, MAX_SCENARIO_TOKENS, MAX_RUN_TOKENS, MAX_COMPLETION_TOKENS }, results };
  const dir = join(HERE, '.results');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${report.date.replace(/[:.]/g, '-')}.json`);
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(join(dir, 'latest.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`agent-test: ${passed}/${results.length} passed with ${model}, ${tokens} tokens. Report: ${file}`);
  return passed === results.length ? 0 : 1;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`agent-test: ${error.message ?? error}`);
    process.exit(1);
  },
);
