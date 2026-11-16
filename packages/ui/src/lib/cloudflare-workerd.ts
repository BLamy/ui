/* ══ A workerd config, as a system ══
   Reads the Cap'n Proto text of a workerd config, `config.capnp`, into the same system `readWrangler` makes from a
   `wrangler.jsonc`, for a CloudflareDiagram to draw. It only reads: nothing's run, nothing's fetched, and `embed` files stay
   names. What isn't one of Cloudflare's services, like a disk, a socket or a plain value on `env`, is said in `notes`.

   The text format is Cap'n Proto's: `using Workerd = import "/workerd/workerd.capnp";`, then `const name :Type = value;`,
   where a value is a struct `( field = value, … )`, a list `[ value, … ]`, a string, a number, `true`/`false`, an enum
   name, `.name` for another const, or `embed "file"`. `#` starts a comment. */
import type { CloudflareEdge, CloudflareService } from '@/lib/cloudflare-services';
import type { CloudflareSystem } from '@/lib/cloudflare-system';

export type CapnpValue =
  | { kind: 'struct'; fields: Map<string, CapnpValue> }
  | { kind: 'list'; items: CapnpValue[] }
  | { kind: 'string'; value: string }
  | { kind: 'number'; value: number }
  | { kind: 'bool'; value: boolean }
  | { kind: 'name'; name: string }
  | { kind: 'ref'; name: string }
  | { kind: 'embed'; path: string };

export interface CapnpConst {
  name: string;
  /** What it says it is, like `Workerd.Config`. */
  type: string;
  value: CapnpValue;
}

export interface WorkerdNote {
  code: 'not-a-service' | 'setting' | 'unknown-binding' | 'socket' | 'missing' | 'storage';
  /** The service it's about, by its name in the config. */
  service?: string;
  message: string;
}

export interface WorkerdSocket {
  name: string;
  address?: string;
  /** The service it hands what comes in to. */
  service?: string;
}

export type WorkerdRead =
  | { ok: true; system: CloudflareSystem; sockets: WorkerdSocket[]; notes: WorkerdNote[] }
  | { ok: false; /** Why, in words, with where. */ reason: string };

/* ── The text ── */

type Token = { t: 'name' | 'string' | 'number' | 'punct'; v: string; at: number };

class CapnpSyntaxError extends Error {}

function tokenize(text: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i]!;
    if (c === '#') { while (i < text.length && text[i] !== '\n') i++; continue; }
    if (/\s/.test(c)) { i++; continue; }
    if (c === '"') {
      let value = '';
      const at = i++;
      for (;;) {
        if (i >= text.length) throw new CapnpSyntaxError(`a string that starts at ${where(text, at)} isn't closed`);
        const d = text[i++]!;
        if (d === '"') break;
        if (d === '\\') {
          const e = text[i++];
          value += e === 'n' ? '\n' : e === 't' ? '\t' : e === 'r' ? '\r' : e === '0' ? '\0' : (e ?? '');
        } else value += d;
      }
      out.push({ t: 'string', v: value, at });
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      const at = i;
      while (i < text.length && /[\w]/.test(text[i]!)) i++;
      out.push({ t: 'name', v: text.slice(at, i), at });
      continue;
    }
    if (/[0-9]/.test(c) || (c === '-' && /[0-9]/.test(text[i + 1] ?? ''))) {
      const at = i;
      i++;
      while (i < text.length && /[\w.]/.test(text[i]!)) i++;
      out.push({ t: 'number', v: text.slice(at, i), at });
      continue;
    }
    if ('()[]=,;:.@{}'.includes(c)) { out.push({ t: 'punct', v: c, at: i++ }); continue; }
    throw new CapnpSyntaxError(`there's a ${JSON.stringify(c)} at ${where(text, i)} that isn't Cap'n Proto`);
  }
  return out;
}

function where(text: string, at: number): string {
  const before = text.slice(0, at);
  const line = before.split('\n').length;
  return `line ${line}, column ${at - before.lastIndexOf('\n')}`;
}

/** The consts in a Cap'n Proto text file, in order. Throws, saying where, if it isn't Cap'n Proto. */
export function parseCapnp(text: string): CapnpConst[] {
  const tokens = tokenize(text);
  let i = 0;
  const peek = () => tokens[i];
  const next = () => {
    const t = tokens[i++];
    if (!t) throw new CapnpSyntaxError('it ends in the middle of something');
    return t;
  };
  const expect = (v: string) => {
    const t = next();
    if (t.v !== v) throw new CapnpSyntaxError(`${where(text, t.at)} has ${JSON.stringify(t.v)} where ${JSON.stringify(v)} should be`);
  };
  const qualified = () => {
    let name = next().v;
    while (peek()?.v === '.') { i++; name += `.${next().v}`; }
    return name;
  };
  const value = (): CapnpValue => {
    const t = next();
    if (t.t === 'string') {
      // Adjacent strings are one, as in Cap'n Proto.
      let s = t.v;
      while (peek()?.t === 'string') s += next().v;
      return { kind: 'string', value: s };
    }
    if (t.t === 'number') return { kind: 'number', value: Number(t.v) };
    if (t.v === '(') {
      const fields = new Map<string, CapnpValue>();
      while (peek()?.v !== ')') {
        const name = next();
        if (name.t !== 'name') throw new CapnpSyntaxError(`${where(text, name.at)} has ${JSON.stringify(name.v)} where a field's name should be`);
        expect('=');
        fields.set(name.v, value());
        if (peek()?.v === ',') i++;
        else if (peek()?.v !== ')') throw new CapnpSyntaxError(`${where(text, peek()?.at ?? text.length)} needs a "," or a ")"`);
      }
      i++;
      return { kind: 'struct', fields };
    }
    if (t.v === '[') {
      const items: CapnpValue[] = [];
      while (peek()?.v !== ']') {
        items.push(value());
        if (peek()?.v === ',') i++;
        else if (peek()?.v !== ']') throw new CapnpSyntaxError(`${where(text, peek()?.at ?? text.length)} needs a "," or a "]"`);
      }
      i++;
      return { kind: 'list', items };
    }
    if (t.v === '.') return { kind: 'ref', name: qualified() };
    if (t.v === 'embed') {
      const path = next();
      if (path.t !== 'string') throw new CapnpSyntaxError(`${where(text, path.at)}: embed takes a file's name, in quotes`);
      return { kind: 'embed', path: path.v };
    }
    if (t.v === 'true' || t.v === 'false') return { kind: 'bool', value: t.v === 'true' };
    if (t.t === 'name') {
      let name = t.v;
      while (peek()?.v === '.') { i++; name += `.${next().v}`; }
      return { kind: 'name', name };
    }
    throw new CapnpSyntaxError(`${where(text, t.at)} has ${JSON.stringify(t.v)} where a value should be`);
  };

  const consts: CapnpConst[] = [];
  while (i < tokens.length) {
    const t = next();
    if (t.v === '@') { while (next().v !== ';'); continue; } // a file id
    if (t.v === 'using') { while (next().v !== ';'); continue; }
    if (t.v === 'const') {
      const name = next().v;
      expect(':');
      const type = qualified();
      expect('=');
      consts.push({ name, type, value: value() });
      expect(';');
      continue;
    }
    throw new CapnpSyntaxError(`${where(text, t.at)} has ${JSON.stringify(t.v)}, and only using and const are read at the top of a config`);
  }
  return consts;
}

/* ── The config ── */

const isStruct = (v: CapnpValue | undefined): v is Extract<CapnpValue, { kind: 'struct' }> => v?.kind === 'struct';
const text = (v: CapnpValue | undefined): string | undefined => (v?.kind === 'string' ? v.value : undefined);

/** Whether some Cap'n Proto text is a workerd config, without reading all of it: for a fence that's capnp of another kind. */
export const looksLikeWorkerdConfig = (source: string): boolean => /:\s*Workerd\.Config\b/.test(source) || /\bservices\s*=\s*\[/.test(source);

// What a binding is, in a workerd config, against the catalog's: the product it reaches and its key in wrangler.jsonc.
const RESOURCE_BINDINGS: Record<string, { kind: string; via: string; noun: string }> = {
  kvNamespace: { kind: 'kv', via: 'kv_namespaces', noun: 'KV namespace' },
  r2Bucket: { kind: 'r2', via: 'r2_buckets', noun: 'R2 bucket' },
  r2Admin: { kind: 'r2', via: 'r2_buckets', noun: 'R2 bucket' },
  queue: { kind: 'queues', via: 'queues', noun: 'Queue' },
};
const SETTINGS = new Set(['text', 'data', 'json', 'fromEnvironment', 'cryptoKey', 'unsafeEval', 'memoryCache', 'workerLoader', 'durableObjectClass', 'analyticsEngine']);

/**
 * A workerd config's services as a system. A Worker is a `workers` service, called by its name in the config, and each of
 * its Durable Object classes is a `durable-objects` service, `<worker>.<class>`. A binding to a class, a service, a KV
 * namespace, an R2 bucket, a queue or D1 is an edge with wrangler.jsonc's key for it. What a KV, R2 or queue binding names
 * is the service that answers for it, which is drawn as that product, called by that name. A queue's service, if it's a
 * Worker, is drawn getting its messages.
 */
export function readWorkerdConfig(source: string): WorkerdRead {
  let consts: CapnpConst[];
  try {
    consts = parseCapnp(source);
  } catch (e) {
    if (e instanceof CapnpSyntaxError) return { ok: false, reason: `It isn't Cap'n Proto that can be read: ${e.message}.` };
    throw e;
  }
  const byName = new Map(consts.map((c) => [c.name, c]));
  const config = consts.find((c) => /(^|\.)Config$/.test(c.type)) ?? consts.find((c) => isStruct(c.value) && c.value.fields.has('services'));
  if (!config || !isStruct(config.value)) return { ok: false, reason: 'There’s no workerd config in it: no const that’s a Workerd.Config, or that has services.' };
  const deref = (v: CapnpValue | undefined, seen = new Set<string>()): CapnpValue | undefined => {
    if (v?.kind !== 'ref') return v;
    if (seen.has(v.name)) return undefined;
    seen.add(v.name);
    return deref(byName.get(v.name)?.value, seen);
  };

  const notes: WorkerdNote[] = [];
  const services = new Map<string, CloudflareService>();
  const edges: CloudflareEdge[] = [];
  const edgeIds = new Set<string>();
  const addEdge = (edge: Omit<CloudflareEdge, 'id'>) => {
    let id = `${edge.from}-${edge.via}-${edge.binding ?? edge.to}`;
    for (let n = 2; edgeIds.has(id); n++) id = `${edge.from}-${edge.via}-${edge.binding ?? edge.to}-${n}`;
    edgeIds.add(id);
    edges.push({ id, ...edge });
  };
  const addService = (service: CloudflareService) => {
    if (!services.has(service.id)) services.set(service.id, service);
    return services.get(service.id)!;
  };

  const declared = deref(config.value.fields.get('services'));
  const list = declared?.kind === 'list' ? declared.items.map((s) => deref(s)).filter(isStruct) : [];
  const workers = new Map<string, Extract<CapnpValue, { kind: 'struct' }>>();
  const kindOf = new Map<string, string>();
  for (const s of list) {
    const name = text(s.fields.get('name'));
    if (!name) continue;
    const worker = deref(s.fields.get('worker'));
    if (isStruct(worker)) {
      workers.set(name, worker);
      kindOf.set(name, 'worker');
      addService({ id: name, kind: 'workers', label: name });
    } else {
      const what = ['disk', 'external', 'network'].find((k) => s.fields.has(k)) ?? 'something else';
      kindOf.set(name, what);
      notes.push({ code: 'not-a-service', service: name, message: `${name} is a ${what} service, which isn’t one of Cloudflare’s, so it isn’t drawn.` });
    }
  }

  const classService = (worker: string, className: string) => addService({ id: `${worker}.${className}`, kind: 'durable-objects', label: className });
  for (const [name, worker] of workers) {
    const namespaces = deref(worker.fields.get('durableObjectNamespaces'));
    for (const ns of namespaces?.kind === 'list' ? namespaces.items.map((n) => deref(n)).filter(isStruct) : []) {
      const className = text(ns.fields.get('className'));
      if (className) classService(name, className);
    }
    const storage = deref(worker.fields.get('durableObjectStorage'));
    if (isStruct(storage)) {
      const disk = text(storage.fields.get('localDisk'));
      notes.push({ code: 'storage', service: name, message: disk ? `${name}’s Durable Objects keep their storage on the disk service ${disk}.` : `${name}’s Durable Objects keep their storage in memory.` });
    }
  }

  for (const [name, worker] of workers) {
    const bindings = deref(worker.fields.get('bindings'));
    for (const b of bindings?.kind === 'list' ? bindings.items.map((x) => deref(x)).filter(isStruct) : []) {
      const binding = text(b.fields.get('name')) ?? '(unnamed)';
      const field = [...b.fields.keys()].find((k) => k !== 'name');
      if (!field) continue;
      const v = deref(b.fields.get(field));
      if (field === 'durableObjectNamespace') {
        const className = text(v) ?? (isStruct(v) ? text(v.fields.get('className')) : undefined);
        const host = (isStruct(v) ? text(v.fields.get('serviceName')) : undefined) ?? name;
        if (!className) { notes.push({ code: 'unknown-binding', service: name, message: `${binding} is a Durable Object binding that doesn’t say which class.` }); continue; }
        if (!services.has(`${host}.${className}`)) notes.push({ code: 'missing', service: name, message: `${binding} is bound to ${className} in ${host}, which doesn’t declare that class in this config.` });
        addEdge({ from: name, to: classService(host, className).id, via: 'durable_objects', binding });
      } else if (field === 'service') {
        const target = text(v) ?? (isStruct(v) ? text(v.fields.get('name')) : undefined);
        if (!target) continue;
        if (kindOf.get(target) !== 'worker') { notes.push({ code: kindOf.has(target) ? 'not-a-service' : 'missing', service: name, message: kindOf.has(target) ? `${binding} reaches ${target}, a ${kindOf.get(target)} service, which isn’t drawn.` : `${binding} reaches ${target}, which isn’t in this config.` }); continue; }
        addEdge({ from: name, to: target, via: 'services', binding });
      } else if (field in RESOURCE_BINDINGS) {
        const { kind, via, noun } = RESOURCE_BINDINGS[field]!;
        const target = text(v) ?? (isStruct(v) ? text(v.fields.get('name')) : undefined) ?? binding;
        const node = addService({ id: `${kind}:${target}`, kind, label: target });
        addEdge({ from: name, to: node.id, via, binding });
        if (kind === 'queues' && kindOf.get(target) === 'worker') addEdge({ from: node.id, to: target, via: 'queue-consumer' });
        else if (kind !== 'queues' && kindOf.get(target) === 'worker') notes.push({ code: 'setting', service: name, message: `${binding}’s ${noun} is answered by the Worker ${target}.` });
      } else if (field === 'wrapped' && isStruct(v) && /d1/i.test(text(v.fields.get('moduleName')) ?? '')) {
        const node = addService({ id: `d1:${binding}`, kind: 'd1', label: binding });
        addEdge({ from: name, to: node.id, via: 'd1_databases', binding });
      } else if (field === 'hyperdrive' && isStruct(v)) {
        const node = addService({ id: `hyperdrive:${binding}`, kind: 'hyperdrive', label: text(v.fields.get('database')) ?? binding });
        addEdge({ from: name, to: node.id, via: 'hyperdrive', binding });
      } else if (SETTINGS.has(field)) {
        notes.push({ code: 'setting', service: name, message: `${binding} is ${field === 'json' || field === 'text' || field === 'data' ? `a ${field} value` : field} on ${name}’s env, which isn’t drawn.` });
      } else {
        notes.push({ code: 'unknown-binding', service: name, message: `${binding} is a ${field} binding, which this doesn’t draw.` });
      }
    }
  }

  const sockets: WorkerdSocket[] = [];
  const declaredSockets = deref(config.value.fields.get('sockets'));
  for (const s of declaredSockets?.kind === 'list' ? declaredSockets.items.map((x) => deref(x)).filter(isStruct) : []) {
    const socket: WorkerdSocket = { name: text(s.fields.get('name')) ?? '(unnamed)' };
    const address = text(s.fields.get('address'));
    const service = deref(s.fields.get('service'));
    const to = text(service) ?? (isStruct(service) ? text(service.fields.get('name')) : undefined);
    if (address) socket.address = address;
    if (to) socket.service = to;
    sockets.push(socket);
    notes.push({ code: 'socket', ...(to ? { service: to } : null), message: `${socket.name} listens${address ? ` on ${address}` : ''}${to ? ` for ${to}` : ''}.` });
  }

  return { ok: true, system: { services: [...services.values()], edges }, sockets, notes };
}
