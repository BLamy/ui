/* "Ask QA" — the agent's side of the chat. Replies are canned (picked by keyword) and streamed in chunks, so the
   block feels alive without a backend. A reply can also start a test run, which then reports in place. */
import { BUGS, PLAYWRIGHT_TESTS, SEVERITY_LABEL, type Bug, type Project } from './data';

export interface ToolStep { icon: string; title: string; detail?: string }

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  /** Tool calls shown in a collapsed work log above the answer. */
  tools?: ToolStep[];
  worked?: string;
  /** A run card under the answer (a run this message started or reported on). */
  runId?: string;
}

export const SUGGESTIONS = [
  'Why is checkout failing?',
  'Summarize open bugs',
  'Start a test run',
  'Write a Playwright test for NW-142',
  'How do I record real user sessions?',
];

/** The conversation the block opens with (Northwind Storefront). */
export const SEED_CHAT: ChatMessage[] = [
  { id: 'm1', role: 'user', text: 'Why are checkouts failing on production?' },
  {
    id: 'm2', role: 'assistant', worked: 'Investigated for 14s',
    tools: [
      { icon: 'magnifier', title: 'Searched open bugs', detail: '9 open in Northwind Storefront' },
      { icon: 'play-outline', title: 'Watched the replay of NW-142', detail: '0:07.4 — POST /api/checkout → 500' },
      { icon: 'network', title: 'Read the network log', detail: '6 requests, 1 failed' },
    ],
    text:
      '**Checkout breaks whenever a promo code is applied.** Run #2419 reproduced it in both promo journeys:\n\n' +
      '- `POST /api/checkout` returns **500** after 912 ms\n' +
      "- the server throws `TypeError: Cannot read properties of undefined (reading 'total')` in `applyPromo` (checkout.ts:88)\n" +
      '- orders *without* a code go through, so only discounted carts fail\n\n' +
      'The handler prices the cart before it has loaded:\n\n' +
      '```ts\n// routes/api/checkout.ts\nconst cart = hydrateCart(body.cartId) // ← missing await\nconst priced = applyPromo(cart, body.promo)\n```\n\n' +
      'Awaiting `hydrateCart` fixes it. It is filed as **NW-142 (critical)**, with a Playwright test that goes green once the fix ships.',
    runId: 'run-2419',
  },
];

export type Intent = 'run' | 'summary' | 'playwright' | 'setup' | 'why' | 'other';

export function intentOf(text: string): Intent {
  const t = text.toLowerCase();
  if (/\b(start|kick off|run)\b.*\b(run|test|tests|qa)\b|^run\b|test run/.test(t)) return 'run';
  if (/playwright|write .*test|regression test/.test(t)) return 'playwright';
  if (/summar|open bugs|what.*bugs|triage/.test(t)) return 'summary';
  if (/set ?up|install|record|session|fullstory|snippet/.test(t)) return 'setup';
  if (/why|fail|broken|error|500/.test(t)) return 'why';
  return 'other';
}

/** The reply to `text` for `project`. `runId` is the id a started run will get. */
export function replyTo(text: string, project: Project, bugs: Bug[], runId: string): Omit<ChatMessage, 'id' | 'role'> {
  const intent = intentOf(text);
  const open = bugs.filter((b) => b.projectId === project.id && (b.status === 'open' || b.status === 'confirmed' || b.status === 'unconfirmed'));
  switch (intent) {
    case 'run':
      return {
        worked: 'Queued in 2s',
        tools: [{ icon: 'robot', title: 'Planned 8 journeys', detail: 'from the site map and the last 3 runs' }],
        text: `Starting a run on **${project.name}** against production. It will replay the 8 riskiest journeys — checkout and the cart drawer first — and I'll post what it finds here.`,
        runId,
      };
    case 'summary': {
      const by = (s: Bug['severity']) => open.filter((b) => b.severity === s).length;
      const top = [...open].sort((a, b) => sevOrder(a) - sevOrder(b)).slice(0, 3);
      return {
        worked: 'Read 1 project in 3s',
        tools: [{ icon: 'magnifier', title: `Searched bugs in ${project.name}`, detail: `${open.length} open` }],
        text:
          `**${open.length} open bugs** in ${project.name}: ${by('critical')} critical, ${by('high')} high, ${by('medium')} medium, ${by('low')} low.\n\n` +
          top.map((b) => `- **${b.id}** (${SEVERITY_LABEL[b.severity]}) — ${b.title}`).join('\n') +
          '\n\nFix the critical one first: it loses every discounted order. Copy the reports with **⇧⌘C** to hand them to a coding agent.',
      };
    }
    case 'playwright': {
      const t = PLAYWRIGHT_TESTS[0]!;
      return {
        worked: 'Wrote 1 test in 9s',
        tools: [{ icon: 'play-outline', title: 'Replayed NW-142', detail: '14 steps' }, { icon: 'doc-text', title: `Wrote ${t.file}` }],
        text: `Here is a regression test for **NW-142**. It fails today at the \`/api/checkout\` assertion and will pass once the handler awaits the cart:\n\n\`\`\`ts\n${t.code.trim()}\n\`\`\`\n\nIt's saved under **Playwright tests**; I'll run it on every deploy.`,
      };
    }
    case 'setup':
      return {
        worked: 'Read the docs in 2s',
        text:
          'Record real sessions with the Loop QA snippet, then turn any of them into a journey:\n\n' +
          '1. **Install the recorder** in your app shell:\n\n```bash\nnpm install @loopqa/recorder\n```\n\n' +
          '2. **Start it** as early as possible:\n\n```ts\nimport { record } from \'@loopqa/recorder\'\n\nrecord({ project: \'northwind\', endpoint: \'/api/loopqa-session\' })\n```\n\n' +
          '3. **Forward sessions from your server** so the token never reaches the browser:\n\n```ts\nexport async function POST(request: Request) {\n  return fetch(\'https://ingest.loopqa.dev/sessions\', {\n    method: \'POST\',\n    headers: { Authorization: `Bearer ${process.env.LOOPQA_SESSION_TOKEN}` },\n    body: await request.text(),\n  })\n}\n```\n\n' +
          'Sessions show up under **Site map** within a minute, with the pages they touched.',
      };
    case 'why': {
      const b = [...open].sort((a, c) => sevOrder(a) - sevOrder(c))[0];
      return {
        worked: 'Investigated for 6s',
        tools: [{ icon: 'magnifier', title: 'Searched open bugs', detail: `${open.length} open` }],
        text: b
          ? `The most severe failure in **${project.name}** right now is **${b.id}**: ${b.title}.\n\n${b.summary}\n\nOpen it for the replay, the network log and the root cause.`
          : `Nothing is failing in **${project.name}** — the last run passed every journey.`,
      };
    }
    default:
      return {
        text: `I can start a run, summarize or triage bugs, explain a failure from its replay, or write a Playwright test. For example: *"Why is checkout failing?"* or *"Start a test run"*.`,
      };
  }
}

const sevOrder = (b: Bug) => ['critical', 'high', 'medium', 'low'].indexOf(b.severity);

/** Split a reply into streaming chunks: a few words at a time, never inside a fenced block's opening line. */
export function chunks(text: string): string[] {
  const words = text.split(/(\s+)/);
  const out: string[] = [];
  let acc = '';
  for (let i = 0; i < words.length; i++) {
    acc += words[i];
    if (i % 6 === 5) { out.push(acc); acc = ''; }
  }
  if (acc) out.push(acc);
  return out;
}

export const OPEN_STATUSES = new Set(['open', 'confirmed', 'unconfirmed']);
export const isOpen = (b: Bug) => OPEN_STATUSES.has(b.status);
export const bugsFor = (projectId: string) => BUGS.filter((b) => b.projectId === projectId);
