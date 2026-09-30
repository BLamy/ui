/* Loop QA sample data — fixed, so every render (and every screenshot) is identical. "Now" is NOW below; nothing
   reads the wall clock. One project (Northwind Storefront) is fully fleshed out: bugs with chronologies, runs with
   journeys, a site map and generated Playwright tests. The rest carry enough to browse. */

/** The block's "now": Tue 29 Sep 2026, 15:00 UTC. Relative times are measured from here. */
export const NOW = Date.UTC(2026, 8, 29, 15, 0);
const min = 60_000;
const hr = 60 * min;
const day = 24 * hr;
const at = (ago: number) => new Date(NOW - ago).toISOString();

export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type BugStatus = 'open' | 'confirmed' | 'fixed' | 'dismissed' | 'unconfirmed';
export type BugKind = 'Functional' | 'Network' | 'Visual' | 'Performance' | 'Accessibility' | 'Console';
export type Environment = 'Production' | 'Preview' | 'Staging';
export type RunStatus = 'running' | 'completed' | 'failed' | 'blocked';
export type SiteKind = 'shop' | 'docs' | 'dashboard' | 'editor' | 'todo' | 'landing';

export const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];
export const STATUSES: BugStatus[] = ['open', 'confirmed', 'unconfirmed', 'fixed', 'dismissed'];
export const KINDS: BugKind[] = ['Functional', 'Network', 'Visual', 'Performance', 'Accessibility', 'Console'];
export const ENVIRONMENTS: Environment[] = ['Production', 'Preview', 'Staging'];

export const SEVERITY_LABEL: Record<Severity, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' };
export const STATUS_LABEL: Record<BugStatus, string> = {
  open: 'Open', confirmed: 'Confirmed', unconfirmed: 'Unconfirmed', fixed: 'Fixed', dismissed: 'Dismissed',
};

export interface Project {
  id: string;
  name: string;
  url: string;
  status: 'active' | 'paused';
  site: SiteKind;
  /** The thumbnail's brand color (content constant). */
  brand: string;
  lastRun: string;
  /** Open bugs per run, oldest first — the card's sparkline. */
  trend: number[];
  schedule: string;
  members: string[];
}

export const PROJECTS: Project[] = [
  { id: 'northwind', name: 'Northwind Storefront', url: 'https://shop.northwind.test', status: 'active', site: 'shop', brand: '#0D9488', lastRun: at(18 * min), trend: [4, 6, 9, 8, 11, 12, 10], schedule: 'Every 6 hours', members: ['BL', 'MK', 'AR'] },
  { id: 'pulse', name: 'Pulse Analytics', url: 'https://app.pulsehq.io', status: 'active', site: 'dashboard', brand: '#6366F1', lastRun: at(2 * hr + 12 * min), trend: [7, 5, 6, 4, 4, 3, 5], schedule: 'On every deploy', members: ['BL', 'JS'] },
  { id: 'collab', name: 'Collaborative AI Editor', url: 'https://collab-editor.workers.dev', status: 'active', site: 'editor', brand: '#2563EB', lastRun: at(12 * hr), trend: [2, 3, 5, 9, 12, 14, 13], schedule: 'Nightly', members: ['BL'] },
  { id: 'pr-4650', name: 'Checkout PR #4650', url: 'https://pr-4650--northwind.netlify.app', status: 'active', site: 'shop', brand: '#F59E0B', lastRun: at(1 * day + 3 * hr), trend: [3, 2, 2], schedule: 'On every push', members: ['MK'] },
  { id: 'relay-docs', name: 'Relay Docs', url: 'https://docs.relay.dev', status: 'active', site: 'docs', brand: '#10B981', lastRun: at(2 * day), trend: [3, 3, 2, 2, 1, 2], schedule: 'Weekly', members: ['AR', 'BL'] },
  { id: 'todo', name: 'Todo smoke test', url: 'https://todo.hosted.test', status: 'paused', site: 'todo', brand: '#8B5CF6', lastRun: at(5 * day), trend: [1, 0, 0, 0], schedule: 'Paused', members: ['BL'] },
  { id: 'marketing', name: 'northwind.com', url: 'https://northwind.com', status: 'active', site: 'landing', brand: '#E11D48', lastRun: at(3 * day), trend: [2, 1, 1, 0, 1], schedule: 'Daily', members: ['JS'] },
];

export interface ChronologyStep {
  /** ms into the replay */
  time: number;
  text: string;
  /** e.g. "click", "network", "console" */
  tag: string;
  evidence: { kind: 'Screenshot' | 'Request' | 'Console' | 'DOM snapshot'; label: string }[];
}

export interface Bug {
  id: string;
  projectId: string;
  title: string;
  severity: Severity;
  status: BugStatus;
  kind: BugKind;
  environment: Environment;
  discovered: string;
  runId: string;
  journey: string;
  replayId: string;
  summary: string;
  expected: string;
  actual: string;
  steps: string[];
  rootCause: string[];
  chronology?: ChronologyStep[];
}

const B = (b: Omit<Bug, 'replayId' | 'expected' | 'actual' | 'steps' | 'rootCause' | 'summary'> & Partial<Bug>): Bug => ({
  replayId: `7e28a39d-${b.id.toLowerCase().replace(/[^a-z0-9]/g, '')}-4ad4-84f5`,
  summary: b.title,
  expected: 'The step completes and the page reflects the change.',
  actual: 'The step fails silently; the page is left in its previous state.',
  steps: ['Open the page', 'Perform the journey step', 'Observe the result'],
  rootCause: ['The handler for this step throws before updating state; the error is swallowed by a catch-all.'],
  ...b,
});

/** The bug the sample recording (replayDemoEvents) shows. */
export const FEATURED_BUG = 'NW-142';

export const BUGS: Bug[] = [
  B({
    id: 'NW-142', projectId: 'northwind', severity: 'critical', status: 'open', kind: 'Network', environment: 'Production',
    title: 'Checkout fails with HTTP 500 when a promo code is applied — applyPromo reads `total` of an undefined cart',
    discovered: at(18 * min), runId: 'run-2419', journey: 'Add two products, apply a promo code and place the order',
    summary: 'Any order with a promo code fails at "Place order". POST /api/checkout returns 500 because `applyPromo` runs before the cart is hydrated on the server and reads `cart.total` of `undefined`. The shopper sees "Something went wrong" and the order is lost.',
    expected: 'The order is placed with the FALL25 discount applied and the confirmation page opens.',
    actual: 'POST /api/checkout responds 500 after ~900 ms; the drawer shows "Something went wrong. Please try again." and the cart is unchanged.',
    steps: ['Open /collections/trail', 'Add "Trail Runner 2" and "Ridge Pack 28L" to the cart', 'Open the cart and enter an email', 'Enter promo code FALL25', 'Press "Place order"'],
    rootCause: [
      'Pressing "Place order" posts the cart id and the promo code to POST /api/checkout (at 0:07.4).',
      'The handler calls `applyPromo(cart, code)` before `await hydrateCart(id)` resolves, so `cart` is still `undefined`; `applyPromo` reads `cart.total` and throws `TypeError: Cannot read properties of undefined (reading \'total\')` (checkout.ts:88).',
      'The route\'s catch-all turns the exception into a bare 500, and the client shows its generic error banner. Orders without a promo code skip `applyPromo` and succeed, which is why the bug only shows with FALL25.',
    ],
    chronology: [
      { time: 2250, tag: 'click', text: 'The agent adds "Trail Runner 2" to the cart; the badge updates to 1 and POST /api/cart/items returns 201.', evidence: [{ kind: 'Screenshot', label: '0:02.2' }, { kind: 'Request', label: 'POST /api/cart/items · 201' }] },
      { time: 5600, tag: 'input', text: 'With two items in the cart ($267), it opens the drawer, types maya@northwind.test and the promo code FALL25.', evidence: [{ kind: 'Screenshot', label: '0:05.6' }, { kind: 'DOM snapshot', label: 'input#promo' }] },
      { time: 7400, tag: 'network', text: 'It presses "Place order". The button reads "Placing order…" and POST /api/checkout is sent with the cart id and FALL25.', evidence: [{ kind: 'Request', label: 'POST /api/checkout · pending' }] },
      { time: 8350, tag: 'console', text: 'The request fails with 500 after 912 ms; the server logs a TypeError from applyPromo and the drawer shows "Something went wrong. Please try again."', evidence: [{ kind: 'Screenshot', label: '0:08.3' }, { kind: 'Console', label: "TypeError: …reading 'total'" }] },
    ],
  }),
  B({ id: 'NW-141', projectId: 'northwind', severity: 'high', status: 'open', kind: 'Functional', environment: 'Production', title: 'Cart badge keeps the old count after removing an item until the page reloads', discovered: at(18 * min), runId: 'run-2419', journey: 'Add and remove items from the cart drawer' }),
  B({ id: 'NW-139', projectId: 'northwind', severity: 'high', status: 'confirmed', kind: 'Visual', environment: 'Production', title: 'Cart drawer overflows the viewport on 375px phones — "Place order" is clipped off-screen', discovered: at(6 * hr), runId: 'run-2418', journey: 'Mobile checkout sweep (375 × 812)' }),
  B({ id: 'NW-138', projectId: 'northwind', severity: 'high', status: 'open', kind: 'Network', environment: 'Production', title: 'GET /api/inventory is requested 14 times per product card hover — no request dedupe', discovered: at(6 * hr), runId: 'run-2418', journey: 'Browse the trail collection' }),
  B({ id: 'NW-136', projectId: 'northwind', severity: 'medium', status: 'open', kind: 'Accessibility', environment: 'Production', title: '"Add to cart" buttons have no accessible name beyond the repeated label — screen readers can\'t tell products apart', discovered: at(12 * hr), runId: 'run-2417', journey: 'Keyboard-only browse and add to cart' }),
  B({ id: 'NW-135', projectId: 'northwind', severity: 'medium', status: 'unconfirmed', kind: 'Performance', environment: 'Production', title: 'Collection page LCP is 4.8s on a throttled connection — hero gradient image is 2.1 MB', discovered: at(12 * hr), runId: 'run-2417', journey: 'Browse the trail collection' }),
  B({ id: 'NW-133', projectId: 'northwind', severity: 'medium', status: 'open', kind: 'Console', environment: 'Production', title: 'Warning: Each child in a list should have a unique "key" prop — logged on every cart render', discovered: at(1 * day), runId: 'run-2416', journey: 'Add and remove items from the cart drawer' }),
  B({ id: 'NW-131', projectId: 'northwind', severity: 'low', status: 'open', kind: 'Visual', environment: 'Production', title: 'Price column misaligns by 2px when a line item name wraps', discovered: at(1 * day), runId: 'run-2416', journey: 'Add two products, apply a promo code and place the order' }),
  B({ id: 'NW-128', projectId: 'northwind', severity: 'high', status: 'fixed', kind: 'Functional', environment: 'Production', title: 'Email field accepts "maya@northwind" and checkout proceeds to payment', discovered: at(2 * day), runId: 'run-2414', journey: 'Checkout form validation' }),
  B({ id: 'NW-126', projectId: 'northwind', severity: 'low', status: 'dismissed', kind: 'Visual', environment: 'Staging', title: 'Footer social icons render 1px below the baseline in Safari', discovered: at(3 * day), runId: 'run-2412', journey: 'Footer and legal links' }),
  B({ id: 'NW-124', projectId: 'northwind', severity: 'medium', status: 'fixed', kind: 'Network', environment: 'Preview', title: 'Promo code endpoint returns 404 on preview deploys (missing rewrite)', discovered: at(4 * day), runId: 'run-2410', journey: 'Apply and remove a promo code' }),
  B({ id: 'NW-121', projectId: 'northwind', severity: 'critical', status: 'fixed', kind: 'Functional', environment: 'Production', title: 'Guest checkout double-charges when "Place order" is pressed twice quickly', discovered: at(5 * day), runId: 'run-2408', journey: 'Add two products, apply a promo code and place the order' }),
  B({ id: 'PR-18', projectId: 'pr-4650', severity: 'high', status: 'open', kind: 'Functional', environment: 'Preview', title: 'New shipping step skips address validation for PO boxes', discovered: at(1 * day + 3 * hr), runId: 'run-2402', journey: 'Checkout with a new shipping address' }),
  B({ id: 'PR-17', projectId: 'pr-4650', severity: 'medium', status: 'open', kind: 'Visual', environment: 'Preview', title: 'Shipping method radio cards lose their focus ring in dark mode', discovered: at(1 * day + 3 * hr), runId: 'run-2402', journey: 'Keyboard-only checkout' }),
  B({ id: 'PU-77', projectId: 'pulse', severity: 'high', status: 'open', kind: 'Network', environment: 'Production', title: 'Date range picker fires GET /api/metrics for every intermediate day while dragging', discovered: at(2 * hr), runId: 'run-2415', journey: 'Change the dashboard date range' }),
  B({ id: 'PU-75', projectId: 'pulse', severity: 'medium', status: 'confirmed', kind: 'Visual', environment: 'Production', title: 'Chart tooltip is clipped by the card edge on the rightmost bar', discovered: at(2 * hr), runId: 'run-2415', journey: 'Explore the revenue chart' }),
  B({ id: 'PU-72', projectId: 'pulse', severity: 'low', status: 'open', kind: 'Accessibility', environment: 'Production', title: 'KPI tiles use color alone to show trend direction', discovered: at(1 * day), runId: 'run-2411', journey: 'Explore the revenue chart' }),
  B({ id: 'CE-54', projectId: 'collab', severity: 'critical', status: 'open', kind: 'Network', environment: 'Production', title: 'Collaboration sync fails: PUT /api/yjs/docs/…/collaboration returns HTTP 530 and the editor stays disconnected', discovered: at(12 * hr), runId: 'run-2413', journey: 'Create a note, write content, then delete it' }),
  B({ id: 'CE-53', projectId: 'collab', severity: 'high', status: 'open', kind: 'Functional', environment: 'Production', title: 'Slash-menu "Heading 1" inserts an invisible block — no placeholder, no caret', discovered: at(12 * hr), runId: 'run-2413', journey: 'Insert blocks with the slash menu' }),
  B({ id: 'CE-51', projectId: 'collab', severity: 'high', status: 'open', kind: 'Functional', environment: 'Production', title: 'Bold toolbar button fires toggleBold but never applies bold or shows its active state', discovered: at(12 * hr), runId: 'run-2413', journey: 'Format text with the toolbar' }),
  B({ id: 'RD-9', projectId: 'relay-docs', severity: 'low', status: 'open', kind: 'Visual', environment: 'Production', title: 'Search dialog loses its backdrop blur on Firefox', discovered: at(2 * day), runId: 'run-2409', journey: 'Search the docs' }),
  B({ id: 'RD-8', projectId: 'relay-docs', severity: 'medium', status: 'open', kind: 'Functional', environment: 'Production', title: '"Copy code" button copies the line numbers along with the snippet', discovered: at(2 * day), runId: 'run-2409', journey: 'Copy a code sample' }),
  B({ id: 'MK-3', projectId: 'marketing', severity: 'medium', status: 'open', kind: 'Performance', environment: 'Production', title: 'Hero video autoplays at 4K on mobile — 38 MB before first interaction', discovered: at(3 * day), runId: 'run-2407', journey: 'Landing page sweep' }),
];

export interface NetworkEntry { method: string; path: string; status: number; ms: number; size: string; at: number }
export const BUG_NETWORK: NetworkEntry[] = [
  { method: 'GET', path: '/collections/trail', status: 200, ms: 142, size: '18.4 kB', at: 0 },
  { method: 'GET', path: '/api/cart', status: 200, ms: 38, size: '312 B', at: 120 },
  { method: 'POST', path: '/api/cart/items', status: 201, ms: 64, size: '288 B', at: 2250 },
  { method: 'POST', path: '/api/cart/items', status: 201, ms: 58, size: '301 B', at: 3450 },
  { method: 'GET', path: '/api/promo/FALL25', status: 200, ms: 44, size: '96 B', at: 6900 },
  { method: 'POST', path: '/api/checkout', status: 500, ms: 912, size: '64 B', at: 7440 },
];

export interface ConsoleEntry { level: 'error' | 'warn' | 'info'; text: string; source: string; at: number }
export const BUG_CONSOLE: ConsoleEntry[] = [
  { level: 'info', text: '[cart] hydrated 0 items', source: 'cart.ts:21', at: 140 },
  { level: 'warn', text: 'Warning: Each child in a list should have a unique "key" prop.', source: 'CartLines.tsx:14', at: 2260 },
  { level: 'error', text: 'POST https://shop.northwind.test/api/checkout 500 (Internal Server Error)', source: 'checkout-client.ts:42', at: 8352 },
  { level: 'error', text: "Uncaught (in promise) TypeError: Cannot read properties of undefined (reading 'total')\n    at applyPromo (checkout.ts:88:23)\n    at POST (routes/api/checkout.ts:31:9)", source: 'checkout.ts:88', at: 8360 },
];

export interface Journey { id: string; title: string; status: 'passed' | 'failed' | 'blocked'; steps: number; bugIds: string[] }

export interface Run {
  id: string;
  projectId: string;
  title: string;
  status: RunStatus;
  started: string;
  /** minutes */
  duration: number;
  trigger: 'Scheduled' | 'Deploy' | 'Pull request' | 'Manual' | 'Ask QA';
  environment: Environment;
  journeys: Journey[];
  /** Journey count while running (the live run fills `journeys` as it goes). */
  plannedJourneys?: number;
  newBugs: number;
  rediscovered: number;
  coverage: number;
  findings?: string;
  coverageSummary?: string;
  explored?: boolean;
}

const J = (id: string, title: string, status: Journey['status'], steps: number, bugIds: string[] = []): Journey => ({ id, title, status, steps, bugIds });

export const RUNS: Run[] = [
  {
    id: 'run-2419', projectId: 'northwind', title: 'Checkout, cart and promo flows', status: 'completed', started: at(58 * min), duration: 40,
    trigger: 'Scheduled', environment: 'Production', newBugs: 2, rediscovered: 3, coverage: 78, explored: true,
    journeys: [
      J('j1', 'Add two products, apply a promo code and place the order', 'failed', 14, ['NW-142', 'NW-131']),
      J('j2', 'Add and remove items from the cart drawer', 'failed', 9, ['NW-141', 'NW-133']),
      J('j3', 'Browse the trail collection', 'passed', 7),
      J('j4', 'Checkout form validation', 'passed', 11),
      J('j5', 'Apply and remove a promo code', 'passed', 8),
      J('j6', 'Keyboard-only browse and add to cart', 'failed', 12, ['NW-136']),
      J('j7', 'Mobile checkout sweep (375 × 812)', 'blocked', 6),
      J('j8', 'Footer and legal links', 'passed', 5),
    ],
    findings:
      '**QA found 5 bugs (1 critical, 1 high, 2 medium, 1 low); 2 are new.**\n\n' +
      '- **Critical** — Checkout fails with HTTP 500 whenever a promo code is applied (`applyPromo` reads `total` of an undefined cart). Every discounted order is lost.\n' +
      '- **High** — The cart badge keeps its old count after an item is removed.\n' +
      '- **Medium** — "Add to cart" buttons are indistinguishable to screen readers; a missing `key` warning is logged on every cart render.\n\n' +
      '**Next step:** fix NW-142 first — it blocks revenue. Copy the bug reports and hand them to a coding agent, or connect Linear to file them automatically.',
    coverageSummary:
      'Eight journeys covered browsing, the cart drawer, promo codes, form validation, keyboard navigation and the footer. Checkout itself failed in both journeys that used a promo code; the mobile sweep was blocked by the clipped drawer (NW-139, rediscovered). Account pages and order history were not reached — they need a signed-in session.',
  },
  {
    id: 'run-2418', projectId: 'northwind', title: 'Nightly regression sweep', status: 'completed', started: at(6 * hr + 40 * min), duration: 52,
    trigger: 'Scheduled', environment: 'Production', newBugs: 2, rediscovered: 4, coverage: 71,
    journeys: [J('j1', 'Mobile checkout sweep (375 × 812)', 'failed', 10, ['NW-139']), J('j2', 'Browse the trail collection', 'failed', 7, ['NW-138']), J('j3', 'Checkout form validation', 'passed', 11), J('j4', 'Footer and legal links', 'passed', 5), J('j5', 'Search for a product', 'passed', 6), J('j6', 'Apply and remove a promo code', 'passed', 8)],
  },
  {
    id: 'run-2417', projectId: 'northwind', title: 'Accessibility and performance audit', status: 'completed', started: at(12 * hr + 20 * min), duration: 33,
    trigger: 'Manual', environment: 'Production', newBugs: 2, rediscovered: 1, coverage: 64,
    journeys: [J('j1', 'Keyboard-only browse and add to cart', 'failed', 12, ['NW-136']), J('j2', 'Browse the trail collection', 'failed', 7, ['NW-135']), J('j3', 'Screen reader landmark tour', 'passed', 9)],
  },
  {
    id: 'run-2416', projectId: 'northwind', title: 'Deploy 8c41f0e — cart refactor', status: 'failed', started: at(1 * day + 2 * hr), duration: 21,
    trigger: 'Deploy', environment: 'Production', newBugs: 2, rediscovered: 0, coverage: 38,
    journeys: [J('j1', 'Add and remove items from the cart drawer', 'failed', 9, ['NW-133']), J('j2', 'Add two products, apply a promo code and place the order', 'failed', 14, ['NW-131']), J('j3', 'Browse the trail collection', 'blocked', 2)],
  },
  {
    id: 'run-2414', projectId: 'northwind', title: 'Checkout form validation', status: 'completed', started: at(2 * day + 5 * hr), duration: 18,
    trigger: 'Ask QA', environment: 'Production', newBugs: 1, rediscovered: 0, coverage: 22,
    journeys: [J('j1', 'Checkout form validation', 'failed', 11, ['NW-128']), J('j2', 'Guest checkout happy path', 'passed', 9)],
  },
  {
    id: 'run-2412', projectId: 'northwind', title: 'Staging smoke', status: 'blocked', started: at(3 * day + 1 * hr), duration: 4,
    trigger: 'Deploy', environment: 'Staging', newBugs: 1, rediscovered: 0, coverage: 9,
    journeys: [J('j1', 'Footer and legal links', 'failed', 5, ['NW-126']), J('j2', 'Sign in with a magic link', 'blocked', 1)],
  },
  { id: 'run-2415', projectId: 'pulse', title: 'Dashboard interactions', status: 'completed', started: at(2 * hr + 50 * min), duration: 38, trigger: 'Deploy', environment: 'Production', newBugs: 2, rediscovered: 3, coverage: 66, journeys: [J('j1', 'Change the dashboard date range', 'failed', 8, ['PU-77']), J('j2', 'Explore the revenue chart', 'failed', 6, ['PU-75']), J('j3', 'Export a CSV report', 'passed', 7)] },
  { id: 'run-2413', projectId: 'collab', title: 'Note editor, collaboration sync and slash commands', status: 'completed', started: at(12 * hr + 45 * min), duration: 47, trigger: 'Scheduled', environment: 'Production', newBugs: 6, rediscovered: 8, coverage: 41, journeys: [J('j1', 'Create a note, write content, then delete it', 'failed', 12, ['CE-54']), J('j2', 'Insert blocks with the slash menu', 'failed', 9, ['CE-53']), J('j3', 'Format text with the toolbar', 'failed', 7, ['CE-51']), J('j4', 'Share a note', 'passed', 6)] },
  { id: 'run-2402', projectId: 'pr-4650', title: 'PR #4650 — new shipping step', status: 'completed', started: at(1 * day + 3 * hr + 30 * min), duration: 26, trigger: 'Pull request', environment: 'Preview', newBugs: 2, rediscovered: 0, coverage: 35, journeys: [J('j1', 'Checkout with a new shipping address', 'failed', 10, ['PR-18']), J('j2', 'Keyboard-only checkout', 'failed', 11, ['PR-17'])] },
  { id: 'run-2409', projectId: 'relay-docs', title: 'Docs navigation and search', status: 'completed', started: at(2 * day + 40 * min), duration: 22, trigger: 'Scheduled', environment: 'Production', newBugs: 2, rediscovered: 1, coverage: 58, journeys: [J('j1', 'Search the docs', 'failed', 5, ['RD-9']), J('j2', 'Copy a code sample', 'failed', 4, ['RD-8']), J('j3', 'Follow the quickstart', 'passed', 9)] },
  { id: 'run-2407', projectId: 'marketing', title: 'Landing page sweep', status: 'completed', started: at(3 * day + 20 * min), duration: 12, trigger: 'Scheduled', environment: 'Production', newBugs: 1, rediscovered: 0, coverage: 80, journeys: [J('j1', 'Landing page sweep', 'failed', 6, ['MK-3']), J('j2', 'Newsletter signup', 'passed', 4)] },
  { id: 'run-2401', projectId: 'todo', title: 'Todo smoke exploration', status: 'completed', started: at(5 * day), duration: 9, trigger: 'Manual', environment: 'Production', newBugs: 0, rediscovered: 0, coverage: 92, journeys: [J('j1', 'Add, complete and clear todos', 'passed', 8)] },
];

/** The journeys a new run plans (the live run started from Ask QA or ⌘K fills these in one by one). */
export const LIVE_PLAN: { title: string; steps: number; status: Journey['status']; bugIds?: string[] }[] = [
  { title: 'Browse the trail collection', steps: 7, status: 'passed' },
  { title: 'Add two products, apply a promo code and place the order', steps: 14, status: 'failed', bugIds: ['NW-142'] },
  { title: 'Add and remove items from the cart drawer', steps: 9, status: 'passed' },
  { title: 'Checkout form validation', steps: 11, status: 'passed' },
  { title: 'Apply and remove a promo code', steps: 8, status: 'passed' },
  { title: 'Keyboard-only browse and add to cart', steps: 12, status: 'failed', bugIds: ['NW-136'] },
  { title: 'Search for a product', steps: 6, status: 'passed' },
  { title: 'Footer and legal links', steps: 5, status: 'passed' },
];

export interface Exploration { id: string; title: string; summary: string; initialTime: number; pages: number; actions: number }
/** Three explorations of the same recorded tour, each opening at its own moment. */
export const EXPLORATIONS: Exploration[] = [
  { id: 'ex-1', title: 'Collection grid and header navigation', summary: 'Toured the header links and hovered every product card; no errors.', initialTime: 2600, pages: 3, actions: 18 },
  { id: 'ex-2', title: 'Add to cart from the grid', summary: 'Added Merino Crew and Summit Shell; the badge counted 2.', initialTime: 4300, pages: 2, actions: 9 },
  { id: 'ex-3', title: 'Cart drawer', summary: 'Opened the drawer; both line items and the total ($297) are listed.', initialTime: 5900, pages: 1, actions: 6 },
];

export interface SiteNode { path: string; title: string; visits: number; bugs: number; status: 'covered' | 'bugs' | 'unvisited'; children?: SiteNode[] }
export const SITE_MAP: SiteNode = {
  path: '/', title: 'Home', visits: 64, bugs: 0, status: 'covered', children: [
    { path: '/collections', title: 'Collections', visits: 48, bugs: 0, status: 'covered', children: [
      { path: '/collections/trail', title: 'Trail', visits: 41, bugs: 2, status: 'bugs' },
      { path: '/collections/road', title: 'Road', visits: 12, bugs: 0, status: 'covered' },
      { path: '/collections/sale', title: 'Sale', visits: 6, bugs: 0, status: 'covered' },
    ] },
    { path: '/products/[handle]', title: 'Product', visits: 37, bugs: 1, status: 'bugs' },
    { path: '/cart', title: 'Cart drawer', visits: 33, bugs: 3, status: 'bugs' },
    { path: '/checkout', title: 'Checkout', visits: 21, bugs: 2, status: 'bugs', children: [
      { path: '/checkout/shipping', title: 'Shipping', visits: 9, bugs: 0, status: 'covered' },
      { path: '/checkout/payment', title: 'Payment', visits: 0, bugs: 0, status: 'unvisited' },
      { path: '/checkout/confirmation', title: 'Confirmation', visits: 0, bugs: 0, status: 'unvisited' },
    ] },
    { path: '/search', title: 'Search', visits: 8, bugs: 0, status: 'covered' },
    { path: '/account', title: 'Account', visits: 0, bugs: 0, status: 'unvisited', children: [
      { path: '/account/orders', title: 'Order history', visits: 0, bugs: 0, status: 'unvisited' },
    ] },
    { path: '/pages/shipping-returns', title: 'Shipping & returns', visits: 4, bugs: 0, status: 'covered' },
  ],
};

export interface PlaywrightTest { id: string; name: string; file: string; status: 'passing' | 'failing' | 'flaky'; runs: number; duration: string; lastRun: string; fromBug?: string; code: string }

export const PLAYWRIGHT_TESTS: PlaywrightTest[] = [
  {
    id: 't1', name: 'places an order with a promo code', file: 'tests/checkout/promo.spec.ts', status: 'failing', runs: 6, duration: '8.4s', lastRun: at(18 * min), fromBug: 'NW-142',
    code: `import { test, expect } from '@playwright/test';

// Generated by Loop QA from NW-142 — keep it green once the fix ships.
test('places an order with a promo code', async ({ page }) => {
  await page.goto('/collections/trail');
  await page.getByRole('button', { name: 'Add Trail Runner 2 to cart' }).click();
  await page.getByRole('button', { name: 'Add Ridge Pack 28L to cart' }).click();
  await expect(page.getByTestId('cart-count')).toHaveText('2');

  await page.getByRole('button', { name: /cart/i }).click();
  await page.getByLabel('Email').fill('maya@northwind.test');
  await page.getByLabel('Promo code').fill('FALL25');

  const checkout = page.waitForResponse('**/api/checkout');
  await page.getByRole('button', { name: 'Place order' }).click();
  expect((await checkout).status()).toBe(200);
  await expect(page).toHaveURL(/\\/checkout\\/confirmation/);
});
`,
  },
  {
    id: 't2', name: 'updates the cart badge when an item is removed', file: 'tests/cart/badge.spec.ts', status: 'failing', runs: 6, duration: '3.1s', lastRun: at(18 * min), fromBug: 'NW-141',
    code: `import { test, expect } from '@playwright/test';

test('updates the cart badge when an item is removed', async ({ page }) => {
  await page.goto('/collections/trail');
  await page.getByRole('button', { name: 'Add Merino Crew to cart' }).click();
  await page.getByRole('button', { name: 'Add Summit Shell to cart' }).click();
  await page.getByRole('button', { name: /cart/i }).click();

  await page.getByRole('button', { name: 'Remove Merino Crew' }).click();
  await expect(page.getByTestId('cart-count')).toHaveText('1');
});
`,
  },
  {
    id: 't3', name: 'rejects an email without a domain', file: 'tests/checkout/validation.spec.ts', status: 'passing', runs: 14, duration: '2.2s', lastRun: at(18 * min), fromBug: 'NW-128',
    code: `import { test, expect } from '@playwright/test';

test('rejects an email without a domain', async ({ page }) => {
  await page.goto('/checkout');
  await page.getByLabel('Email').fill('maya@northwind');
  await page.getByRole('button', { name: 'Continue to shipping' }).click();
  await expect(page.getByText('Enter a valid email address')).toBeVisible();
  await expect(page).toHaveURL(/\\/checkout$/);
});
`,
  },
  {
    id: 't4', name: 'charges once when "Place order" is double-clicked', file: 'tests/checkout/idempotency.spec.ts', status: 'passing', runs: 22, duration: '5.7s', lastRun: at(18 * min), fromBug: 'NW-121',
    code: `import { test, expect } from '@playwright/test';

test('charges once when "Place order" is double-clicked', async ({ page }) => {
  const charges: string[] = [];
  page.on('request', (r) => r.url().endsWith('/api/checkout') && charges.push(r.method()));

  await page.goto('/cart?fixture=two-items');
  await page.getByRole('button', { name: 'Place order' }).dblclick();
  await expect(page).toHaveURL(/confirmation/);
  expect(charges).toHaveLength(1);
});
`,
  },
  {
    id: 't5', name: 'keeps the cart drawer on screen at 375px', file: 'tests/mobile/drawer.spec.ts', status: 'flaky', runs: 9, duration: '4.0s', lastRun: at(6 * hr), fromBug: 'NW-139',
    code: `import { test, expect, devices } from '@playwright/test';

test.use({ ...devices['iPhone 13 mini'] });

test('keeps the cart drawer on screen at 375px', async ({ page }) => {
  await page.goto('/cart?fixture=two-items');
  const button = page.getByRole('button', { name: 'Place order' });
  await expect(button).toBeInViewport();
});
`,
  },
  {
    id: 't6', name: 'browses the trail collection', file: 'tests/browse/collection.spec.ts', status: 'passing', runs: 31, duration: '1.9s', lastRun: at(18 * min),
    code: `import { test, expect } from '@playwright/test';

test('browses the trail collection', async ({ page }) => {
  await page.goto('/collections/trail');
  await expect(page.getByRole('heading', { name: 'Fall trail collection' })).toBeVisible();
  await expect(page.getByRole('article')).toHaveCount(4);
});
`,
  },
];

export interface Notification { id: string; title: string; detail: string; when: string; kind: 'bug' | 'run' | 'invite' }
export const NOTIFICATIONS: Notification[] = [
  { id: 'n1', kind: 'bug', title: 'New critical bug in Northwind Storefront', detail: 'NW-142 · Checkout fails with HTTP 500 when a promo code is applied', when: at(18 * min) },
  { id: 'n2', kind: 'run', title: 'Run #2419 completed', detail: '8 journeys · 2 new bugs · 3 rediscovered', when: at(18 * min) },
  { id: 'n3', kind: 'run', title: 'PR #4650 preview tested', detail: '2 new bugs on the new shipping step', when: at(1 * day + 3 * hr) },
  { id: 'n4', kind: 'invite', title: 'Jordan Shah joined Pulse Analytics', detail: 'Invited by you', when: at(2 * day) },
];

export const CREDITS = { used: 3_418.5, total: 5_000, renews: 'Oct 1' };

export const ME = { name: 'Brett Lamy', initials: 'BL', email: 'brett@loopqa.dev', plan: 'Team' };

export const TRACKERS = [
  { id: 'linear', name: 'Linear', detail: 'File bugs as Linear issues in a team', color: '#5E6AD2' },
  { id: 'github', name: 'GitHub Issues', detail: 'Open issues in a repository', color: '#24292F' },
  { id: 'jira', name: 'Jira', detail: 'Create Jira tickets in a project', color: '#2684FF' },
  { id: 'slack', name: 'Slack', detail: 'Post new bugs to a channel', color: '#4A154B' },
] as const;

/* ── helpers ── */

export function relativeTime(iso: string): string {
  const ms = NOW - new Date(iso).getTime();
  if (ms < hr) return `${Math.max(1, Math.round(ms / min))}m ago`;
  if (ms < day) return `${Math.round(ms / hr)}h ago`;
  if (ms < 7 * day) return `${Math.round(ms / day)}d ago`;
  return shortDate(iso);
}

const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const TIME = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });
export const shortDate = (iso: string) => DATE.format(new Date(iso));
export const dateTime = (iso: string) => `${DATE.format(new Date(iso))}, ${TIME.format(new Date(iso))}`;

export function host(url: string) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export const severityRank = (s: Severity) => SEVERITIES.indexOf(s);

/** The Markdown bug report "Copy bug report" puts on the clipboard. */
export function bugReport(b: Bug, project?: Project): string {
  return [
    `# ${b.id}: ${b.title}`,
    '',
    `**Severity:** ${SEVERITY_LABEL[b.severity]} · **Status:** ${STATUS_LABEL[b.status]} · **Kind:** ${b.kind} · **Environment:** ${b.environment}`,
    project ? `**Project:** ${project.name} (${project.url})` : '',
    `**Replay:** https://loopqa.dev/replays/${b.replayId}`,
    '',
    '## Summary', b.summary, '',
    '## Steps to reproduce', ...b.steps.map((s, i) => `${i + 1}. ${s}`), '',
    '## Expected', b.expected, '',
    '## Actual', b.actual, '',
    '## Root cause', ...b.rootCause.map((s, i) => `${i + 1}. ${s}`),
  ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
}
