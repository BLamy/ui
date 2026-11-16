/* ══ State diagram source — a machine's config, read from its source text ══
   `parseXState(code)` reads the config out of an XState machine's source, TypeScript or JSON, without running any of it:
   a `createMachine({…})` or `setup(…).createMachine({…})` call, a bare config object, or a JSON document. What's
   structure (states, `initial`, `on`, `after`, `always`, targets, `invoke`'s `src` / `id` / `onDone` / `onError` /
   `onSnapshot`, `type`, `history`) is kept; what's code (actions, `entry`, `exit`, `context`, `input`…) is left out,
   and a guard or an actor is kept as its name. What can't be read statically is refused, rather than guessed at.

   It's how StateDiagram's `source` and docstream's ```` ```xstate ```` fence read a machine: hand what it returns to
   XState's `createMachine`, then `machineToDraft`. It doesn't import XState; it uses Babel's parser. */
import { parse, parseExpression } from '@babel/parser';

type Syntax = { type: string; [key: string]: unknown };
const syntax = (value: unknown): value is Syntax => !!value && typeof value === 'object' && 'type' in value;
const ignored = new Set(['actions', 'entry', 'exit', 'context', 'guard', 'cond', 'types', 'input', 'output', 'meta', 'tags', 'description', 'params']);

const STATIC = 'XState diagrams need a static machine config. Use literal states, initial states and transition targets.';
const LITERAL = 'Use literal properties in XState diagram configs; spreads and computed keys are not supported.';

const WRAPPERS = ['TSAsExpression', 'TSSatisfiesExpression', 'TSNonNullExpression', 'ParenthesizedExpression'];
const unwrap = (node: Syntax): Syntax => (WRAPPERS.includes(node.type) ? unwrap(node.expression as Syntax) : node);

const calleeName = (call: Syntax): string | null => {
  const callee = call.callee as Syntax;
  return callee.type === 'Identifier' ? String(callee.name) : callee.type === 'MemberExpression' ? String((callee.property as Syntax).name ?? '') || null : null;
};

/** What a guard's called, without running it: its name, or what's being called, like `not` or `and`. */
function guardName(node: Syntax): string {
  const guard = unwrap(node);
  if (guard.type === 'StringLiteral') return String(guard.value);
  if (guard.type === 'Identifier') return String(guard.name);
  if (guard.type === 'CallExpression') return calleeName(guard) ?? 'guard';
  if (guard.type === 'ObjectExpression') {
    const named = (guard.properties as Syntax[]).find((p) => p.type === 'ObjectProperty' && !p.computed && String((p.key as Syntax).name ?? (p.key as Syntax).value) === 'type');
    if (named && unwrap(named.value as Syntax).type === 'StringLiteral') return String(unwrap(named.value as Syntax).value);
  }
  return 'guard';
}

/** What an invoked actor's called, without running it. Written inline, it has no name to show, so it's called `actor`. */
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

/** A machine's config from its source, TypeScript or JSON, reading declarative data and never evaluating machine code,
 *  imports, actions or guards. Throws, with why, when the source isn't one machine with a static config. */
export function parseXState(code: string): Record<string, unknown> {
  const bindings = new Map<string, Syntax>();
  /** An `invoke`: its name and where it goes when it finishes. What it does and what it's given are code. */
  function readInvoke(node: Syntax, seen: Set<string>): unknown {
    const value = unwrap(node);
    if (value.type === 'Identifier' && bindings.has(String(value.name)) && !seen.has(String(value.name))) {
      return readInvoke(bindings.get(String(value.name))!, new Set([...seen, String(value.name)]));
    }
    if (value.type === 'ArrayExpression') return (value.elements as Syntax[]).map((n) => readInvoke(n, seen));
    if (value.type !== 'ObjectExpression') throw new Error(STATIC);
    const result: Record<string, unknown> = Object.create(null);
    for (const prop of value.properties as Syntax[]) {
      if (prop.type !== 'ObjectProperty' || prop.computed) throw new Error(LITERAL);
      const keyNode = prop.key as Syntax;
      const key = String(keyNode.name ?? keyNode.value);
      if (key === 'src') result.src = actorName(prop.value as Syntax);
      else if (key === 'id' && unwrap(prop.value as Syntax).type === 'StringLiteral') result.id = unwrap(prop.value as Syntax).value;
      else if (key === 'onDone' || key === 'onError' || key === 'onSnapshot') result[key] = read(prop.value as Syntax, seen);
    }
    return result;
  }
  function read(node: Syntax, seen = new Set<string>(), container = false): unknown {
    if (WRAPPERS.includes(node.type)) return read(node.expression as Syntax, seen, container);
    if (['StringLiteral', 'NumericLiteral', 'BooleanLiteral', 'NullLiteral'].includes(node.type)) return node.value ?? null;
    if (node.type === 'ArrayExpression') return (node.elements as Syntax[]).map((n) => read(n, seen));
    if (node.type === 'Identifier' && bindings.has(String(node.name)) && !seen.has(String(node.name))) {
      return read(bindings.get(String(node.name))!, new Set([...seen, String(node.name)]), container);
    }
    if (node.type === 'ObjectExpression') {
      const result: Record<string, unknown> = Object.create(null);
      for (const prop of node.properties as Syntax[]) {
        if (prop.type !== 'ObjectProperty' || prop.computed) throw new Error(LITERAL);
        const keyNode = prop.key as Syntax;
        const key = String(keyNode.name ?? keyNode.value);
        // Under `states`, `on` and `after`, a key is a name (a state called `invoke`, an event called `actions`).
        if (!container && (key === 'guard' || key === 'cond')) result.guard = guardName(prop.value as Syntax);
        else if (!container && key === 'invoke') result.invoke = readInvoke(prop.value as Syntax, seen);
        else if (container || !ignored.has(key)) result[key] = read(prop.value as Syntax, seen, !container && ['states', 'on', 'after'].includes(key));
      }
      return result;
    }
    throw new Error(STATIC);
  }
  const options = { plugins: ['typescript' as const] };
  let expression: Syntax | undefined;
  try {
    expression = parseExpression(code.trim(), options) as unknown as Syntax;
  } catch {
    // A module or a JSON document follows.
  }
  if (!expression || expression.type !== 'ObjectExpression') {
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
  }
  if (!expression) throw new Error('Add an XState machine config.');
  return validate(read(expression));
}
