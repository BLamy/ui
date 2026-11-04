/* ══ The Cloudflare catalog — what's in it, and finding things in it ══
   The data's in `cloudflare-catalog.generated.ts`, which `tools/cloudflare/catalog.mjs` writes from pinned upstream versions.
   It's about 150 KB, so it isn't in the main entry: it comes with `@brett_lamy/ui/cloudflare`. */

/** What a product is, on a diagram.
 *  - `service`: someone would draw it as a node.
 *  - `feature`: part of a node (`parent`), a badge or a setting rather than a box of its own.
 *  - `umbrella`: a family or hub whose members have their own entries: a group box at most.
 *  - `tooling`: account admin, CLIs, SDKs, dashboards: real products, with no place in a running system's diagram.
 *  - `docs`: documentation, with no product behind it. */
export type CatalogClass = 'service' | 'feature' | 'umbrella' | 'tooling' | 'docs';

export interface CatalogProduct {
  /** Its file name in Cloudflare's docs, like `r2`. */
  id: string;
  name: string;
  /** Under developers.cloudflare.com. */
  url: string;
  group: string | null;
  groups: string[];
  description: string | null;
  class: CatalogClass;
  parent: string | null;
  /** Why it's been classed by hand, when a rule over upstream's fields got it wrong. */
  why?: string;
  /** The binding keys that reach it. */
  calls: string[];
  /** Types that reach it with no binding, like `Cache`. */
  callsWithoutBinding: string[];
  /** Methods of another binding that reach it, like `ai.gateway`. */
  alsoReachedThrough: string[];
  /** The ids of `receives` rows it starts. */
  sends: string[];
  /** The event types it can send through a Queue. */
  events: string[];
}

export interface CatalogField {
  name: string;
  type: string;
  required: boolean;
  deprecated?: boolean;
  description: string;
}

export interface CatalogMethod {
  name: string;
  overloads?: number;
  params?: string[];
  /** Cut short, with an ellipsis, past 80 characters. */
  paramTypes?: string[];
  /** Cut short, with an ellipsis, past 120 characters. */
  returns?: string[];
  optional?: boolean;
  deprecated?: boolean;
}

export interface CatalogProperty {
  name: string;
  type: string;
  optional?: boolean;
  deprecated?: boolean;
}

export interface CatalogBinding {
  /** The key at the top of the config, like `queues`. */
  key: string;
  /** Where it is in the config, like `queues.producers`. */
  path: string;
  container: 'array' | 'object' | 'map';
  /** The field that names it on `env`, or null for a map, whose keys do. */
  nameField: string | null;
  description: string;
  friendlyName: string | null;
  fields: CatalogField[];
  /** The product behind it, or null if there isn't one. */
  product: string | null;
  why?: string;
  /** Other products its methods reach, by method. */
  alsoReaches?: Record<string, string>;
  /** What `wrangler types` says it is. */
  typeText: string | null;
  runtimeType: string | null;
  typeWhere: string | null;
  methods: CatalogMethod[];
  properties: CatalogProperty[];
  /** The methods of the types its methods hand back, by type. */
  followOn: Record<string, string[]>;
  /** Why it has no type with methods. */
  unresolved?: string;
}

export interface CatalogHandlers {
  type: string;
  where: string;
  handlers: CatalogMethod[];
}

export interface CatalogContextType {
  type: string;
  found: boolean;
  where: string | null;
  kind: string | null;
  methods: string[];
  properties: string[];
}

/** One way a Worker gets called: who from, on what handler, with what, set up how. No upstream source links these. */
export interface CatalogReceive {
  id: string;
  /** The product it comes from, or null for the outside world. */
  from: string | null;
  what: string;
  /** The service between the sender and the Worker. */
  via?: string;
  /** Like `ExportedHandler.queue`. */
  handler: string;
  payload: string | null;
  /** Where it's set up in the config, or null if it isn't. */
  config: string[] | null;
  /** How it's arranged when the config has no key for it. */
  setup?: string;
  /** A runtime call that arranges it. */
  by?: string;
  events?: string;
  doc?: string;
}

export interface CatalogOtherKey {
  path: string;
  product: string;
  role: string;
}

export interface CatalogSurface {
  product: string;
  type: string;
  reachedBy: string;
  doc: string;
  methods: CatalogMethod[];
  properties: CatalogProperty[];
}

export interface CloudflareCatalog {
  pins: {
    docs: { repo: string; ref: string; date: string; license: string; files: number };
    wrangler: { version: string; schemaSha256: string; license: string };
    workersTypes: { version: string; tarballSha256: string };
    typescript: { version: string };
  };
  /** The credit Cloudflare's docs ask for, and the trademark line. Show it wherever the catalog's text is shown. */
  attribution: string;
  products: CatalogProduct[];
  bindings: CatalogBinding[];
  handlers: CatalogHandlers[];
  contextTypes: CatalogContextType[];
  receives: CatalogReceive[];
  otherConfigKeys: CatalogOtherKey[];
  nonBindingSurface: CatalogSurface[];
  r2Notifications: { doc: string; categories: { category: string; actions: string[] }[] };
  eventSubscriptions: { hub: string; sources: { heading: string; product: string; partial: string; events: { name: string; type: string | null }[] }[] };
  artifactsEvents: { types: string[]; target: string };
}
