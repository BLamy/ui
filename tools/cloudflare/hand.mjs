/* Everything in the catalog that a person decided rather than a source said. catalog.mjs reads these tables, and checks every
   reference in them against the pinned data: a handler that no longer exists, a config key wrangler dropped, or a doc page
   that moved all stop the run. */

/* ── Products ──
   The rule in catalog.mjs: a "Docs collections" entry is docs; a hidden entry (`entry.show: false`) is a feature if its
   URL sits under another product's, else docs; every other visible entry is a service. These are the entries the rule
   gets wrong, after reading all 195.
     service  someone would draw it as a node on an architecture diagram
     feature  part of a node (`parent`), a badge or a setting rather than a box of its own
     umbrella a family or hub whose members have their own entries: a group box at most
     tooling  account admin, CLIs, SDKs, dashboards: real products, no place in a running system's diagram
     docs     documentation with no product behind it */
export const PRODUCT_OVERRIDES = {
  // Visible, but not a node: account admin, tools, dashboards.
  'account-billing': { class: 'tooling', why: 'account admin' },
  billing: { class: 'tooling', why: 'account admin' },
  organizations: { class: 'tooling', why: 'account admin' },
  'resource-tagging': { class: 'tooling', why: 'account admin' },
  tenant: { class: 'tooling', why: 'account provisioning' },
  'version-management': { class: 'tooling', why: 'configuration workflow' },
  registrar: { class: 'tooling', why: 'buying domains; nothing runs through it' },
  network: { class: 'tooling', why: 'a page of zone settings' },
  cf: { class: 'tooling', why: 'CLI' },
  terraform: { class: 'tooling', why: 'infrastructure as code' },
  pulumi: { class: 'tooling', why: 'infrastructure as code' },
  sdk: { class: 'tooling', why: 'SDK' },
  'go-sdk': { class: 'tooling', why: 'SDK' },
  'python-sdk': { class: 'tooling', why: 'SDK' },
  'typescript-sdk': { class: 'tooling', why: 'SDK' },
  'agent-lee': { class: 'tooling', why: 'dashboard assistant' },
  'graphql-api': { class: 'tooling', why: 'a query API over analytics' },
  radar: { class: 'tooling', why: 'public Internet data' },
  'security-center': { class: 'tooling', why: 'dashboard' },
  // Visible hubs whose members are listed separately.
  ai: { class: 'umbrella', why: 'overview over Workers AI, AI Gateway and others (src/content/docs/ai/index.mdx)' },
  basin: { class: 'umbrella', why: 'basin-pipelines, basin-catalog and basin-sql are listed separately' },
  'cloudflare-for-platforms': { class: 'umbrella', why: 'workers-for-platforms and cloudflare-for-saas are listed separately' },
  'cloudflare-one': { class: 'umbrella', why: 'access, gateway and the rest are listed separately' },
  'data-localization': { class: 'umbrella', why: 'a suite of settings across products' },
  observability: { class: 'umbrella', why: 'overview over logs and traces' },
  realtime: { class: 'umbrella', why: 'realtime-kit, realtime-sfu and realtime-turn are listed separately' },
  rules: { class: 'umbrella', why: 'its rule types have their own entries' },
  'ruleset-engine': { class: 'umbrella', why: 'the engine beneath WAF and Rules, not reached directly' },
  speed: { class: 'umbrella', why: 'overview of optimizations' },
  // Visible, and an overview too, but a Worker can bind to it, which makes it something to draw.
  analytics: { class: 'service', why: 'an overview of analytics products as well, but it has the Analytics SQL binding: src/content/docs/analytics/sql-api/workers-binding.mdx' },
  // Visible, but part of something else.
  'automatic-platform-optimization': { class: 'feature', parent: 'cache', why: 'a WordPress caching setting' },
  'cloudflare-tunnel-sase': { class: 'feature', parent: 'tunnel', why: 'the same tunnel, documented under Cloudflare One' },
  'fraud-detection': { class: 'feature', why: 'sequence rules inside Bots' },
  'geokey-manager': { class: 'feature', why: 'a key-storage setting of SSL/TLS' },
  'leaked-credentials': { class: 'feature', why: 'a WAF detection' },
  'network-error-logging': { class: 'feature', parent: 'analytics', why: 'a report in the dashboard' },
  'network-visibility': { class: 'feature', why: 'a Cloudflare One insight' },
  'posture-checks': { class: 'feature', parent: 'access', why: 'an input to Access policies' },
  'private-origins': { class: 'feature', why: 'a DNS setting' },
  // Hidden, but really a node.
  logpush: { class: 'service', why: 'hidden entry, but it pushes logs to R2, HTTP and others and gets drawn' },
  // Hidden with a top-level URL, so the rule says docs, but a product stands behind them.
  'client-ip-geolocation': { class: 'feature', why: 'a setting for a website behind Cloudflare, in closed beta. It has no parent: the docs say it is not the IP Geolocation setting under Network' },
  constellation: { class: 'feature', parent: 'workers-ai', why: 'a hidden page saying Beta, which does not say what became of it. Workers AI is what runs models now' },
  'email-security': { class: 'feature', parent: 'email-security-cf1', why: 'the older entry for Email security (formerly Area 1)' },
  firewall: { class: 'feature', parent: 'waf', why: 'Firewall Rules, deprecated' },
};

/* ── Bindings → products ──
   The answer for every binding key, to judge the automatic attempts with and to supply what they miss. A key the table
   doesn't list stops the run, so a new wrangler binding can't slip through. `null`: no product stands behind it. */
export const BINDING_PRODUCT = {
  durable_objects: { product: 'durable-objects' },
  workflows: { product: 'workflows' },
  kv_namespaces: { product: 'kv' },
  send_email: { product: 'email-service', why: 'src/content/docs/email-service/configuration/send-bindings.mdx' },
  queues: { product: 'queues' },
  r2_buckets: { product: 'r2' },
  d1_databases: { product: 'd1' },
  vectorize: { product: 'vectorize' },
  ai_search_namespaces: { product: 'ai-search' },
  ai_search: { product: 'ai-search' },
  agent_memory: { product: 'agent-memory' },
  hyperdrive: { product: 'hyperdrive' },
  services: { product: 'workers', why: 'service bindings are Worker-to-Worker' },
  analytics_engine_datasets: { product: 'workers-analytics-engine' },
  browser: { product: 'browser-run' },
  analytics: { product: 'analytics', why: 'the Analytics SQL binding, documented at /analytics/sql-api/workers-binding/' },
  ai: { product: 'workers-ai', why: 'the wrangler page files it under "Workers AI"; the `ai` entry is the overview above it', alsoReaches: { gateway: 'ai-gateway', aiSearch: 'ai-search', autorag: 'ai-search', websearch: 'web-search' } },
  images: { product: 'images' },
  media: { product: 'stream', why: 'Media Transformations are documented under Stream, /stream/transform-videos/' },
  stream: { product: 'stream' },
  version_metadata: { product: 'workers', why: 'a Workers runtime binding' },
  unsafe: { product: null, why: 'an escape hatch, any binding type' },
  mtls_certificates: { product: 'workers', why: 'documented at /workers/runtime-apis/bindings/mTLS/; the far end is your origin' },
  dispatch_namespaces: { product: 'workers-for-platforms' },
  pipelines: { product: 'basin-pipelines', why: 'src/content/docs/basin-pipelines/streams/writing-to-streams.mdx configures it' },
  k2: { product: 'k2' },
  secrets_store_secrets: { product: 'secrets-store' },
  artifacts: { product: 'artifacts' },
  unsafe_hello_world: { product: null, why: 'the schema says DO NOT USE: an example binding' },
  flagship: { product: 'flagship' },
  ratelimits: { product: 'workers', why: 'the Workers rate-limit binding at /workers/runtime-apis/bindings/rate-limit/, not the WAF rules at /waf/rate-limiting-rules/' },
  worker_loaders: { product: 'dynamic-workers', why: 'src/content/docs/dynamic-workers/getting-started.mdx: "it needs a Worker Loader binding"' },
  vpc_services: { product: 'workers-vpc' },
  vpc_networks: { product: 'workers-vpc' },
  logfwdr: { product: null, why: 'in the schema, but with no directory entry and no section on the wrangler configuration page' },
  assets: { product: 'workers', why: 'Workers static assets, /workers/static-assets/' },
  vars: { product: 'workers', why: 'plain environment variables' },
  secrets: { product: 'workers', why: 'Worker secrets, not the Secrets Store' },
  wasm_modules: { product: null, why: 'legacy module form' },
  text_blobs: { product: null, why: 'legacy module form' },
  data_blobs: { product: null, why: 'legacy module form' },
};

/* Keys that put names on `env` with no naming field for the schema walk to find. catalog.mjs checks that every key in
   wrangler's friendlyBindingNames is either found by the walk or listed here. `secrets` is in neither. */
export const ENV_MAP_KEYS = ['vars', 'secrets', 'wasm_modules', 'text_blobs', 'data_blobs'];

/* Config keys that aren't bindings but belong to a product on a diagram. */
export const OTHER_CONFIG_KEYS = [
  { path: 'containers', product: 'containers', role: 'runs a container behind a Durable Object class' },
  { path: 'cloudchamber', product: 'containers', role: 'older container settings' },
  { path: 'migrations', product: 'durable-objects', role: 'Durable Object class history' },
  { path: 'exports', product: 'workers', role: 'declares Durable Object, entrypoint and Workflow exports' },
  { path: 'tail_consumers', product: 'workers', role: 'receive side: see RECEIVES' },
  { path: 'streaming_tail_consumers', product: 'workers', role: 'receive side: see RECEIVES' },
  { path: 'triggers', product: 'workers', role: 'receive side: see RECEIVES' },
  { path: 'connect', product: 'workers', role: 'receive side: see RECEIVES' },
  { path: 'routes', product: 'workers', role: 'receive side: see RECEIVES' },
  { path: 'addresses', product: 'email-service', role: 'receive side: see RECEIVES' },
];

/* Runtime surfaces with no binding: reached from a global or from a Durable Object's state. */
export const NON_BINDING_SURFACE = [
  { product: 'containers', type: 'Container', reachedBy: 'DurableObjectState.container', doc: 'src/content/docs/durable-objects/api/container.mdx' },
  { product: 'cache', type: 'Cache', reachedBy: 'caches.default or caches.open, a global', doc: 'src/content/docs/workers/runtime-apis/cache.mdx' },
];

/* Which types hold the handlers, and which types the handlers hand over. */
export const HANDLER_TYPES = ['ExportedHandler', 'DurableObject', 'WorkerEntrypoint', 'WorkflowEntrypoint'];
export const CONTEXT_TYPES = ['MessageBatch', 'Message', 'ScheduledController', 'ForwardableEmailMessage', 'TraceItem', 'DurableObjectState', 'DurableObjectStorage', 'DurableObjectStub', 'WorkflowEvent', 'WorkflowStep', 'WorkflowInstance', 'AlarmInvocationInfo', 'TestController', 'Socket'];

/* Keys `wrangler types` needs a value of a particular form for, when the probe config is generated from the schema. */
export const PROBE_VALUES = {
  namespace_id: '1', // ratelimits: wrangler wants a positive integer in a string.
  class_name: 'ProbeClass', // Durable Objects and Workflows: the class the probe's module exports.
};
/* Fields wrangler's validator insists on though the schema marks them optional: the schema's `required` says only `binding`. */
export const PROBE_EXTRA_FIELDS = { pipelines: { stream: 'probe-value' } };
/* `wrangler types` writes this one under a fixed name, whatever the binding is called. */
export const PROBE_FIXED_NAMES = { logfwdr: 'LOGFWDR_SCHEMA' };

/* ── Event sources ── The headings of the Queues "Events & schemas" page that match no directory entry by name. */
export const EVENT_SOURCE_PRODUCT = {
  'Email Sending': 'email-service',
  'Super Slurper': 'r2',
  'Workers KV': 'kv',
};

/* ── What a Worker can receive ──
   Which handler gets what, from where, set up how. No source links these: the types have the handler, the schema the
   config key, the docs the event names, and only this table says they are one thing. Each reference is checked.
     handler  a member of a type in workers-types
     payload  a type in workers-types (null: none, or the body is yours to type)
     config   a path in wrangler's schema (null: the schema has no key for it)
     setup    how it's arranged when the schema has no key
     by       a runtime call in workers-types that arranges it
     events   where the event names come from: `r2-notifications`, `event-subscriptions` or `schema:<path>`
     via      the service between the sender and the Worker
     doc      a page at the pinned docs ref */
export const RECEIVES = [
  { id: 'http', from: null, what: 'HTTP request', handler: 'ExportedHandler.fetch', payload: 'Request', config: ['routes', 'route', 'workers_dev'], doc: 'src/content/docs/workers/runtime-apis/handlers/fetch.mdx' },
  { id: 'cron', from: 'workers', what: 'Cron Trigger', handler: 'ExportedHandler.scheduled', payload: 'ScheduledController', config: ['triggers.crons'], doc: 'src/content/docs/workers/runtime-apis/handlers/scheduled.mdx' },
  { id: 'queue-consumer', from: 'queues', what: 'message batch from a Queue', handler: 'ExportedHandler.queue', payload: 'MessageBatch', config: ['queues.consumers'], by: 'Queue.send', doc: 'src/content/docs/workers/runtime-apis/handlers/queue.mdx' },
  { id: 'r2-notification', from: 'r2', what: 'R2 event notification, delivered through a Queue', via: 'queues', handler: 'ExportedHandler.queue', payload: 'MessageBatch', config: null, setup: 'wrangler r2 bucket notification create, or the API; not in the config file', events: 'r2-notifications', doc: 'src/content/docs/r2/buckets/event-notifications.mdx' },
  { id: 'event-subscription', from: null, what: 'Cloudflare event subscription, delivered through a Queue', via: 'queues', handler: 'ExportedHandler.queue', payload: 'MessageBatch', config: null, setup: 'wrangler queues subscription create, or the API; not in the config file', events: 'event-subscriptions', doc: 'src/content/docs/queues/event-subscriptions/events-schemas.mdx' },
  { id: 'artifacts-event', from: 'artifacts', what: 'Artifacts event, starting a Workflow', handler: 'WorkflowEntrypoint.run', payload: 'WorkflowEvent', config: ['triggers.events'], events: 'schema:ArtifactsEventType', doc: 'src/content/docs/artifacts/guides/event-subscriptions.mdx' },
  { id: 'email', from: 'email-service', what: 'inbound email', handler: 'ExportedHandler.email', payload: 'ForwardableEmailMessage', config: ['addresses'], doc: 'src/content/docs/workers/runtime-apis/handlers/email.mdx' },
  { id: 'tail', from: 'workers', what: 'traces of another Worker', handler: 'ExportedHandler.tail', payload: 'TraceItem', config: ['tail_consumers'], doc: 'src/content/docs/workers/runtime-apis/handlers/tail.mdx' },
  { id: 'tail-stream', from: 'workers', what: 'streaming traces of another Worker', handler: 'ExportedHandler.tailStream', payload: null, config: ['streaming_tail_consumers'], setup: 'the schema and the types have it; the tail-workers page and the wrangler configuration page do not mention it' },
  { id: 'trace', from: 'workers', what: 'traces, the older form', handler: 'ExportedHandler.trace', payload: 'TraceItem', config: null, setup: 'no key in the schema and no page under runtime-apis/handlers; the types alone have it' },
  { id: 'connect', from: null, what: 'raw TCP or UDP connection', handler: 'ExportedHandler.connect', payload: 'Socket', config: ['connect'], doc: 'src/content/docs/workers/runtime-apis/handlers/connect.mdx' },
  { id: 'test', from: null, what: 'test harness call', handler: 'ExportedHandler.test', payload: 'TestController', config: null, setup: 'no key in the schema and no page under runtime-apis/handlers; nothing for a diagram' },
  { id: 'do-request', from: 'workers', what: 'request through a Durable Object stub', handler: 'DurableObject.fetch', payload: 'Request', config: ['durable_objects.bindings'], by: 'DurableObjectNamespace.get', doc: 'src/content/docs/durable-objects/best-practices/create-durable-object-stubs-and-send-requests.mdx' },
  { id: 'do-alarm', from: 'durable-objects', what: 'Durable Object alarm', handler: 'DurableObject.alarm', payload: 'AlarmInvocationInfo', config: null, setup: 'set at runtime, no config', by: 'DurableObjectStorage.setAlarm', doc: 'src/content/docs/durable-objects/api/alarms.mdx' },
  { id: 'do-websocket-message', from: null, what: 'hibernating WebSocket message', handler: 'DurableObject.webSocketMessage', payload: 'WebSocket', config: null, setup: 'accepted at runtime, no config', by: 'DurableObjectState.acceptWebSocket', doc: 'src/content/docs/durable-objects/best-practices/websockets.mdx' },
  { id: 'do-websocket-close', from: null, what: 'hibernating WebSocket close', handler: 'DurableObject.webSocketClose', payload: 'WebSocket', config: null, setup: 'accepted at runtime, no config', by: 'DurableObjectState.acceptWebSocket', doc: 'src/content/docs/durable-objects/best-practices/websockets.mdx' },
  { id: 'do-websocket-error', from: null, what: 'hibernating WebSocket error', handler: 'DurableObject.webSocketError', payload: 'WebSocket', config: null, setup: 'accepted at runtime, no config', by: 'DurableObjectState.acceptWebSocket', doc: 'src/content/docs/durable-objects/best-practices/websockets.mdx' },
  { id: 'do-connect', from: 'workers', what: 'raw socket into a Durable Object', handler: 'DurableObject.connect', payload: 'Socket', config: null, setup: 'none in the schema', doc: 'src/content/docs/workers/runtime-apis/handlers/connect.mdx' },
  { id: 'workflow-run', from: 'workflows', what: 'a Workflow instance starting', handler: 'WorkflowEntrypoint.run', payload: 'WorkflowEvent', config: ['workflows'], by: 'Workflow.create', doc: 'src/content/docs/workflows/build/workers-api.mdx' },
  { id: 'workflow-cron', from: 'workflows', what: 'a Workflow instance on a schedule', handler: 'WorkflowEntrypoint.run', payload: 'WorkflowEvent', config: ['workflows.schedules'], doc: 'src/content/docs/workflows/build/trigger-workflows.mdx' },
  { id: 'workflow-event', from: 'workflows', what: 'an event a running step waits for', handler: 'WorkflowStep.waitForEvent', payload: null, config: null, setup: 'at runtime', by: 'WorkflowInstance.sendEvent', doc: 'src/content/docs/workflows/build/events-and-parameters.mdx' },
  { id: 'dispatch-outbound', from: 'workers-for-platforms', what: "a dispatched Worker's outbound request", handler: 'ExportedHandler.fetch', payload: 'Request', config: ['dispatch_namespaces.outbound'], doc: 'src/content/docs/workers/wrangler/configuration.mdx' },
  { id: 'service-rpc', from: 'workers', what: 'a call through a service binding; the methods are your own class', handler: 'WorkerEntrypoint.fetch', payload: null, config: ['services'], by: 'Fetcher.fetch', doc: 'src/content/docs/workers/wrangler/configuration.mdx' },
  { id: 'stream-webhook', from: 'stream', what: 'Stream webhook, plain HTTP', handler: 'ExportedHandler.fetch', payload: 'Request', config: null, setup: 'set through the API; nothing in the schema or the types', doc: 'src/content/docs/stream/manage-video-library/using-webhooks.mdx' },
  { id: 'notifications-webhook', from: 'notifications', what: 'Notifications webhook, plain HTTP', handler: 'ExportedHandler.fetch', payload: 'Request', config: null, setup: 'set in the dashboard; nothing in the schema or the types', doc: 'src/content/docs/notifications/get-started/configure-webhooks.mdx' },
  { id: 'logpush-http', from: 'logpush', what: 'Logpush batch, plain HTTP', handler: 'ExportedHandler.fetch', payload: 'Request', config: null, setup: 'a Logpush job; nothing in the schema or the types', doc: 'src/content/docs/logs/logpush/logpush-job/enable-destinations/http.mdx' },
];
