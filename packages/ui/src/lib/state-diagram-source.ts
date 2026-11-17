/* ══ State diagram source — a machine's config, read from its source text ══
   `parseXState(code)` reads the config out of an XState machine's source, TypeScript or JSON, without running any of it:
   a `createMachine({…})` or `setup(…).createMachine({…})` call, a bare config object, or a JSON document. Structure (states,
   `initial`, `on`, `after`, `always`, targets, `invoke`'s `src` / `id` / `onDone` / `onError` / `onSnapshot`, `type`,
   `history`, `reenter`) is kept as written, and so is everything else a machine says that's data: `entry`, `exit` and
   `actions`, guards, `tags`, `description`, `meta`, `context`, an invoke's `input` and `params`. What's code is never run:
   - an action written inline is `{ type: 'xstate.inline' }` (with `params.name` when it has one), and XState's built-ins are
     `{ type: 'xstate.assign' | 'xstate.raise' | 'xstate.sendTo' | 'xstate.sendParent' | 'xstate.log' | 'xstate.emit' |
     'xstate.spawnChild' | 'xstate.stopChild' | 'xstate.cancel' | 'xstate.enqueueActions', params }`, where `params` holds
     what they say that's literal (`assign`'s `keys` and the `values` that are literals; the `event` raised; `to`…);
   - a guard is its name, `{ type, params }`, `{ type: 'xstate.and' | 'xstate.or' | 'xstate.not', params: { guards } }`,
     `{ type: 'xstate.stateIn', params: { state } }`, or `{ type: 'xstate.inline' }`;
   - a literal's parts that are code are left out; `context` keys whose value is code are kept by their type;
   - `types.context` (`setup({ types })` or the config's own) becomes `types: { context: { key: 'its type, as written' } }`.
   XState itself ignores an action it has nothing for, and `types` at run time. What can't be read statically is refused.

   It's how StateDiagram's `source` and docstream's ```` ```xstate ```` fence read a machine: hand what it returns to
   XState's `createMachine`, then `machineToDraft`. It doesn't import XState; it uses Babel's parser. */
import { parse, parseExpression } from '@babel/parser';

type Syntax = { type: string; start?: number | null; end?: number | null; [key: string]: unknown };
const syntax = (value: unknown): value is Syntax => !!value && typeof value === 'object' && 'type' in value;
const ignored = new Set(['context', 'types', 'input', 'output', 'params']);

const STATIC = 'XState diagrams need a static machine config. Use literal states, initial states and transition targets.';
const LITERAL = 'Use literal properties in XState diagram configs; spreads and computed keys are not supported.';

const WRAPPERS = ['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'ParenthesizedExpression', 'TSTypeAssertion'];
const unwrap = (node: Syntax): Syntax => (WRAPPERS.includes(node.type) ? unwrap(node.expression as Syntax) : node);

const calleeName = (call: Syntax): string | null => {
  const callee = call.callee as Syntax;
  return callee.type === 'Identifier' ? String(callee.name) : callee.type === 'MemberExpression' ? String((callee.property as Syntax).name ?? '') || null : null;
};

const keyOf = (prop: Syntax): string => {
  const k = prop.key as Syntax;
  return String(k.name ?? k.value);
};

/** What a function written inline is called, if anything. */
const functionName = (node: Syntax): string | undefined => (syntax(node.id) ? String(node.id.name) : undefined);
const isFunction = (node: Syntax) => ['ArrowFunctionExpression', 'FunctionExpression'].includes(node.type);

/** An actor's name, without running it. Written inline, it has no name to show, so it's called `actor`. */
function actorName(node: Syntax): string {
  const src = unwrap(node);
  if (src.type === 'StringLiteral') return String(src.value);
  if (src.type === 'Identifier') return String(src.name);
  if (src.type === 'MemberExpression' && !src.computed) return String((src.property as Syntax).name);
  if (src.type === 'FunctionExpression' && syntax(src.id)) return String(src.id.name);
  return 'actor';
}

function validate(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !('states' in value) || !value.states || typeof value.states !== 'object' || Array.isArray(value.states) || !Object.keys(value.states).length) {
    throw new Error('An XState diagram needs a non-empty states object.');
  }
  return value as Record<string, unknown>;
}

const CODE = Symbol('code');
const BUILT_INS = new Set(['assign', 'raise', 'sendTo', 'sendParent', 'log', 'emit', 'spawnChild', 'stopChild', 'stop', 'cancel', 'enqueueActions', 'forwardTo']);

/** A machine's config from its source, TypeScript or JSON, reading declarative data and never evaluating machine code,
 *  imports, actions or guards. Throws, with why, when the source isn't one machine with a static config. */
export function parseXState(code: string): Record<string, unknown> {
  const bindings = new Map<string, Syntax>();
  const textOf = (node: Syntax) => (typeof node.start === 'number' && typeof node.end === 'number' ? code.slice(node.start, node.end).replace(/\s+/g, ' ').trim() : '');
  const bound = (node: Syntax, seen: Set<string>): [Syntax, Set<string>] | null => {
    const name = String(node.name);
    return node.type === 'Identifier' && bindings.has(name) && !seen.has(name) ? [bindings.get(name)!, new Set([...seen, name])] : null;
  };

  /** A literal, with what's code in it left out: `CODE` when it's code through and through. */
  function literal(node: Syntax, seen = new Set<string>()): unknown {
    const v = unwrap(node);
    const via = bound(v, seen);
    if (via) return literal(...via);
    if (['StringLiteral', 'NumericLiteral', 'BooleanLiteral'].includes(v.type)) return v.value;
    if (v.type === 'NullLiteral') return null;
    if (v.type === 'Identifier' && v.name === 'undefined') return undefined;
    if (v.type === 'TemplateLiteral' && !(v.expressions as unknown[]).length) return (v.quasis as Syntax[]).map((q) => (q.value as { cooked: string }).cooked).join('');
    if (v.type === 'UnaryExpression' && v.operator === '-' && unwrap(v.argument as Syntax).type === 'NumericLiteral') return -Number(unwrap(v.argument as Syntax).value);
    if (v.type === 'ArrayExpression') return (v.elements as Syntax[]).map((n) => (n ? literal(n, seen) : null)).filter((x) => x !== CODE);
    if (v.type === 'ObjectExpression') {
      const out: Record<string, unknown> = {};
      for (const prop of v.properties as Syntax[]) {
        if (prop.type !== 'ObjectProperty' || prop.computed) continue;
        const value = literal(prop.value as Syntax, seen);
        if (value !== CODE) out[keyOf(prop)] = value;
      }
      return out;
    }
    return CODE;
  }

  /** An event as written: its `type`, from `{ type: 'E' }` or `'E'`. */
  const eventType = (node: Syntax | undefined): string | undefined => {
    if (!node) return undefined;
    const value = literal(node);
    return typeof value === 'string' ? value : value && typeof value === 'object' && typeof (value as { type?: unknown }).type === 'string' ? (value as { type: string }).type : undefined;
  };

  /** One action: a name, `{ type, params }`, a built-in, or code. */
  function action(node: Syntax, seen: Set<string>): unknown {
    const v = unwrap(node);
    const via = bound(v, seen);
    if (via) {
      // A name for a function is code by that name; a name for anything else is what it names.
      const [target] = via;
      return isFunction(unwrap(target)) ? { type: 'xstate.inline', params: { name: String(v.name) } } : action(...via);
    }
    if (v.type === 'StringLiteral') return v.value;
    if (v.type === 'Identifier') return { type: 'xstate.inline', params: { name: String(v.name) } };
    if (v.type === 'ObjectExpression') {
      const read = literal(v, seen) as Record<string, unknown>;
      if (typeof read.type === 'string') return { type: read.type, ...(read.params && typeof read.params === 'object' ? { params: read.params } : null) };
    }
    if (v.type === 'CallExpression') {
      const name = calleeName(v);
      const args = v.arguments as Syntax[];
      if (name && BUILT_INS.has(name)) {
        const params: Record<string, unknown> = {};
        if (name === 'assign') {
          const what = args[0] ? unwrap(args[0]) : undefined;
          if (what?.type === 'ObjectExpression') {
            const props = (what.properties as Syntax[]).filter((p) => p.type === 'ObjectProperty' && !p.computed);
            params.keys = props.map(keyOf);
            const values = Object.fromEntries(props.map((p) => [keyOf(p), literal(p.value as Syntax, seen)]).filter(([, x]) => x !== CODE));
            if (Object.keys(values).length) params.values = values;
          }
        } else if (name === 'sendTo' || name === 'forwardTo') {
          const to = args[0] ? literal(args[0], seen) : CODE;
          if (typeof to === 'string') params.to = to;
          const event = eventType(args[1]);
          if (event) params.event = event;
        } else if (name === 'raise' || name === 'emit' || name === 'sendParent') {
          const event = eventType(args[0]);
          if (event) params.event = event;
        } else {
          const first = args[0] ? literal(args[0], seen) : CODE;
          const key = name === 'log' ? 'value' : name === 'spawnChild' ? 'src' : name === 'cancel' ? 'id' : name === 'enqueueActions' ? null : 'actor';
          if (key && typeof first === 'string') params[key] = first;
        }
        const type = name === 'stop' ? 'xstate.stopChild' : name === 'forwardTo' ? 'xstate.sendTo' : `xstate.${name}`;
        return { type, ...(Object.keys(params).length ? { params } : null) };
      }
      return { type: 'xstate.inline', ...(name ? { params: { name } } : null) };
    }
    const named = isFunction(v) ? functionName(v) : undefined;
    return { type: 'xstate.inline', ...(named ? { params: { name: named } } : null) };
  }
  const actions = (node: Syntax, seen: Set<string>): unknown => {
    const v = unwrap(node);
    const via = bound(v, seen);
    if (via && unwrap(via[0]).type === 'ArrayExpression') return actions(...via);
    return v.type === 'ArrayExpression' ? (v.elements as Syntax[]).filter(Boolean).map((n) => action(n, seen)) : action(v, seen);
  };

  /** A guard, without running it. */
  function guard(node: Syntax, seen: Set<string>): unknown {
    const v = unwrap(node);
    const via = bound(v, seen);
    if (via) return isFunction(unwrap(via[0])) ? String(v.name) : guard(...via);
    if (v.type === 'StringLiteral') return v.value;
    if (v.type === 'Identifier') return String(v.name);
    if (v.type === 'ObjectExpression') {
      const read = literal(v, seen) as Record<string, unknown>;
      if (typeof read.type === 'string') return { type: read.type, ...(read.params && typeof read.params === 'object' ? { params: read.params } : null) };
    }
    if (v.type === 'CallExpression') {
      const name = calleeName(v);
      const args = v.arguments as Syntax[];
      if ((name === 'and' || name === 'or') && args[0] && unwrap(args[0]).type === 'ArrayExpression') {
        return { type: `xstate.${name}`, params: { guards: (unwrap(args[0]).elements as Syntax[]).filter(Boolean).map((n) => guard(n, seen)) } };
      }
      if (name === 'not' && args[0]) return { type: 'xstate.not', params: { guards: [guard(args[0], seen)] } };
      if (name === 'stateIn' && args[0]) {
        const state = literal(args[0], seen);
        return { type: 'xstate.stateIn', params: { state: typeof state === 'string' ? state : JSON.stringify(state) } };
      }
      return name ?? { type: 'xstate.inline' };
    }
    const named = isFunction(v) ? functionName(v) : undefined;
    return { type: 'xstate.inline', ...(named ? { params: { name: named } } : null) };
  }

  const members = (t: Syntax | undefined): Syntax[] => (t?.type === 'TSTypeLiteral' ? (t.members as Syntax[]).filter((m) => m.type === 'TSPropertySignature') : []);
  const annotationOf = (m: Syntax) => (m.typeAnnotation as Syntax | undefined)?.typeAnnotation as Syntax | undefined;
  /** The type of each of a context's keys, from its type literal. */
  const contextFrom = (type: Syntax | undefined, out: Record<string, string>) => {
    for (const m of members(type)) {
      const annotation = annotationOf(m);
      if (annotation) out[keyOf(m)] = textOf(annotation);
    }
  };
  /** `types`, written as `{} as { context: … }` or `{ context: {} as { … } }`. */
  const readTypes = (node: Syntax, out: Record<string, string>) => {
    if (node.type === 'TSAsExpression' || node.type === 'TSSatisfiesExpression') {
      const context = members(node.typeAnnotation as Syntax).find((m) => keyOf(m) === 'context');
      if (context) contextFrom(annotationOf(context), out);
    }
    const v = unwrap(node);
    if (v.type !== 'ObjectExpression') return;
    for (const prop of v.properties as Syntax[]) {
      if (prop.type !== 'ObjectProperty' || prop.computed || keyOf(prop) !== 'context') continue;
      const value = prop.value as Syntax;
      if (value.type === 'TSAsExpression' || value.type === 'TSSatisfiesExpression') contextFrom(value.typeAnnotation as Syntax, out);
    }
  };
  const contextTypes: Record<string, string> = {};

  /** `context`: its literal values, and the type of each key whose value is code (from an `as`, or `unknown`). */
  const readContext = (node: Syntax, seen: Set<string>): Record<string, unknown> | undefined => {
    const v = unwrap(node);
    const via = bound(v, seen);
    if (via) return readContext(...via);
    if (v.type !== 'ObjectExpression') return undefined;
    const out: Record<string, unknown> = {};
    for (const prop of v.properties as Syntax[]) {
      if (prop.type !== 'ObjectProperty' || prop.computed) continue;
      const key = keyOf(prop);
      const raw = prop.value as Syntax;
      const value = literal(raw, seen);
      if (value !== CODE) out[key] = value;
      if (raw.type === 'TSAsExpression' && !(key in contextTypes)) contextTypes[key] = textOf(raw.typeAnnotation as Syntax);
      else if (value === CODE && !(key in contextTypes)) contextTypes[key] = 'unknown';
    }
    return out;
  };

  /** An `invoke`: its name, its id, what it's given if that's literal, and where it goes when it finishes. */
  function readInvoke(node: Syntax, seen: Set<string>): unknown {
    const value = unwrap(node);
    const via = bound(value, seen);
    if (via) return readInvoke(...via);
    if (value.type === 'ArrayExpression') return (value.elements as Syntax[]).map((n) => readInvoke(n, seen));
    if (value.type !== 'ObjectExpression') throw new Error(STATIC);
    const result: Record<string, unknown> = Object.create(null);
    for (const prop of value.properties as Syntax[]) {
      if (prop.type !== 'ObjectProperty' || prop.computed) throw new Error(LITERAL);
      const key = keyOf(prop);
      if (key === 'src') result.src = actorName(prop.value as Syntax);
      else if (key === 'id' && unwrap(prop.value as Syntax).type === 'StringLiteral') result.id = unwrap(prop.value as Syntax).value;
      else if (key === 'input') {
        const input = literal(prop.value as Syntax, seen);
        if (input !== CODE) result.input = input;
      } else if (key === 'onDone' || key === 'onError' || key === 'onSnapshot') result[key] = read(prop.value as Syntax, seen);
    }
    return result;
  }
  function read(node: Syntax, seen = new Set<string>(), container = false): unknown {
    if (WRAPPERS.includes(node.type)) return read(node.expression as Syntax, seen, container);
    if (['StringLiteral', 'NumericLiteral', 'BooleanLiteral', 'NullLiteral'].includes(node.type)) return node.value ?? null;
    if (node.type === 'ArrayExpression') return (node.elements as Syntax[]).map((n) => read(n, seen));
    const via = bound(node, seen);
    if (via) return read(via[0], via[1], container);
    if (node.type === 'ObjectExpression') {
      const result: Record<string, unknown> = Object.create(null);
      for (const prop of node.properties as Syntax[]) {
        if (prop.type !== 'ObjectProperty' || prop.computed) throw new Error(LITERAL);
        const key = keyOf(prop);
        const value = prop.value as Syntax;
        // Under `states`, `on` and `after`, a key is a name (a state called `invoke`, an event called `actions`).
        if (container) result[key] = read(value, seen, false);
        else if (key === 'guard' || key === 'cond') result.guard = guard(value, seen);
        else if (key === 'entry' || key === 'exit' || key === 'actions') result[key] = actions(value, seen);
        else if (key === 'invoke') result.invoke = readInvoke(value, seen);
        else if (key === 'tags' || key === 'description' || key === 'meta') {
          const said = literal(value, seen);
          if (said !== CODE) result[key] = said;
        } else if (key === 'context') {
          const context = readContext(value, seen);
          if (context) result.context = context;
        } else if (key === 'types') readTypes(value, contextTypes);
        else if (!ignored.has(key)) result[key] = read(value, seen, ['states', 'on', 'after'].includes(key));
      }
      return result;
    }
    throw new Error(STATIC);
  }
  const options = { plugins: ['typescript' as const] };
  let expression: Syntax | undefined;
  let setupArgs: Syntax | undefined;
  try {
    expression = parseExpression(code.trim(), options) as unknown as Syntax;
  } catch {
    // A module or a JSON document follows.
  }
  if (expression && unwrap(expression).type === 'ObjectExpression') {
    // Positions are into what was parsed.
    code = code.trim();
  } else {
    let program: ReturnType<typeof parse>;
    try {
      program = parse(code, { ...options, sourceType: 'module' });
    } catch {
      // JSON's quoted object keys aren't a JavaScript block.
      return validate(JSON.parse(code));
    }
    const calls: Syntax[] = [];
    const walk = (value: unknown) => {
      if (Array.isArray(value)) {
        value.forEach(walk);
        return;
      }
      if (!syntax(value)) return;
      if (value.type === 'VariableDeclarator' && syntax(value.id) && value.id.type === 'Identifier' && syntax(value.init)) bindings.set(String(value.id.name), value.init);
      if (value.type === 'CallExpression') {
        const callee = value.callee as Syntax;
        if (callee?.name === 'createMachine' || callee?.name === 'Machine' || (callee?.property as Syntax)?.name === 'createMachine') calls.push(value);
      }
      Object.values(value).forEach(walk);
    };
    walk(program);
    if (calls.length !== 1) throw new Error('Use one createMachine({...}) call or a machine config object in each xstate fence.');
    expression = (calls[0]!.arguments as Syntax[])[0];
    // `setup({ types, … }).createMachine(…)`: its types say what's in the context.
    const callee = calls[0]!.callee as Syntax;
    const object = callee.type === 'MemberExpression' ? unwrap(callee.object as Syntax) : undefined;
    if (object?.type === 'CallExpression' && calleeName(object) === 'setup') setupArgs = (object.arguments as Syntax[])[0];
  }
  if (!expression) throw new Error('Add an XState machine config.');
  if (setupArgs) {
    const args = unwrap(setupArgs);
    if (args.type === 'ObjectExpression') {
      const types = (args.properties as Syntax[]).find((p) => p.type === 'ObjectProperty' && !p.computed && keyOf(p) === 'types');
      if (types) readTypes(types.value as Syntax, contextTypes);
    }
  }
  const config = validate(read(expression));
  if (Object.keys(contextTypes).length) {
    // Before `states`, as a machine's own config would have it.
    const { states, ...rest } = config;
    return { ...rest, types: { context: contextTypes }, states };
  }
  return config;
}
