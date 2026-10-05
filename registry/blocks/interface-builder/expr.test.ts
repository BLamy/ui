import { describe, expect, it } from 'vitest';
import { evaluate, freeNames, literalSource, memberPaths, parse, refPath, renameIn, valueOf } from './expr';

const scope = {
  count: 3,
  name: 'Ada',
  session: { user: 'ada@example.com', signedIn: true },
  plants: [
    { id: 1, name: 'Monstera', done: false },
    { id: 2, name: 'Fern', done: true },
  ],
  item: { id: 2 },
};
const v = (src: string) => {
  const r = evaluate(src, scope);
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

describe('evaluate', () => {
  it('does arithmetic, comparison and logic with JavaScript precedence', () => {
    expect(v('1 + 2 * 3')).toBe(7);
    expect(v('(1 + 2) * 3')).toBe(9);
    expect(v('count > 2 && name === "Ada"')).toBe(true);
    expect(v('count % 2 === 1 ? "odd" : "even"')).toBe('odd');
    expect(v('null ?? "fallback"')).toBe('fallback');
    expect(v('!session.signedIn || count')).toBe(3);
    expect(v('-count')).toBe(-3);
    expect(v('typeof name')).toBe('string');
  });

  it('reads members, indexes and optional chains', () => {
    expect(v('session.user')).toBe('ada@example.com');
    expect(v('plants[1].name')).toBe('Fern');
    expect(v('plants.length')).toBe(2);
    expect(v('session.missing?.deep')).toBeUndefined();
    expect(evaluate('session.missing.deep', scope).ok).toBe(false);
  });

  it('builds strings with templates, including nested expressions', () => {
    expect(v('`Hi, ${name}! You have ${count} ${count === 1 ? "plant" : "plants"}.`')).toBe('Hi, Ada! You have 3 plants.');
    expect(v('`${session.user.split("@")[0]}`')).toBe('ada');
  });

  it('calls allowlisted methods with arrow functions', () => {
    expect(v('plants.filter((p) => !p.done).length')).toBe(1);
    expect(v('plants.map(p => p.name).join(", ")')).toBe('Monstera, Fern');
    expect(v('plants.find((p) => p.id === item.id).name')).toBe('Fern');
    expect(v('name.toUpperCase()')).toBe('ADA');
    expect(v('(3.14159).toFixed(2)')).toBe('3.14');
    expect(v('Math.max(count, 10)')).toBe(10);
    expect(v('plants.reduce((sum, p) => sum + p.id, 0)')).toBe(3);
  });

  it('builds arrays and objects immutably, with spread', () => {
    expect(v('[...plants, { id: 3, name }]')).toEqual([...scope.plants, { id: 3, name: 'Ada' }]);
    expect(v('plants.map((p) => p.id === item.id ? { ...p, done: !p.done } : p)')).toEqual([
      { id: 1, name: 'Monstera', done: false },
      { id: 2, name: 'Fern', done: false },
    ]);
    expect(scope.plants[1].done).toBe(true);
  });

  it('refuses mutation, assignment, new, unknown names and prototype access', () => {
    expect(evaluate('plants.push(1)', scope)).toMatchObject({ ok: false, error: expect.stringContaining('[...list, item]') });
    expect(evaluate('count = 4', scope)).toMatchObject({ ok: false, error: expect.stringContaining('Set action') });
    expect(evaluate('new Date()', scope).ok).toBe(false);
    expect(evaluate('nope + 1', scope)).toMatchObject({ ok: false, error: "Cannot find name 'nope'", at: 0 });
    expect(evaluate('session.__proto__', scope).ok).toBe(false);
    expect(evaluate('name.constructor', scope).ok).toBe(false);
    expect(evaluate('session.toString()', scope).ok).toBe(false);
    expect(evaluate('({}).hasOwnProperty', scope)).toMatchObject({ ok: true, value: undefined });
  });

  it('does not call functions from the scope', () => {
    const r = evaluate('onAdd(1)', { onAdd: () => 1 });
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('Call action') });
  });

  it('falls back when an expression does not evaluate', () => {
    expect(valueOf('nope', scope, 'x')).toBe('x');
  });

  it('reports syntax errors with a position', () => {
    expect(parse('count +')).toMatchObject({ ok: false });
    expect(parse('"open')).toMatchObject({ ok: false, error: 'Unterminated string', at: 0 });
    expect(parse('a ? b')).toMatchObject({ ok: false, error: "Expected ':'" });
  });
});

describe('analysis', () => {
  it('finds the names an expression reads, without globals or parameters', () => {
    expect([...freeNames('plants.filter((p) => p.id === item.id && Math.random() > count).length').keys()].sort()).toEqual(['count', 'item', 'plants']);
    expect([...freeNames('`${name} ${session.user}`').keys()].sort()).toEqual(['name', 'session']);
  });

  it('finds the fields read off a name', () => {
    expect(memberPaths('session.user + session.user.length + other.x', 'session')).toEqual(['user']);
  });

  it('renames free names only', () => {
    expect(renameIn('count + plants.count + `${count}`', 'count', 'total')).toBe('total + plants.count + `${total}`');
    expect(renameIn('plants.map((count) => count + 1)', 'count', 'total')).toBe('plants.map((count) => count + 1)');
    expect(renameIn('{ count, other: count }', 'count', 'total')).toBe('{ count: total, other: total }');
  });

  it('recognizes plain references, for two-way bindings', () => {
    expect(refPath('email')).toEqual(['email']);
    expect(refPath(' session.user ')).toEqual(['session', 'user']);
    expect(refPath('email + 1')).toBeNull();
  });

  it('writes literals as source', () => {
    expect(literalSource("it's")).toBe("'it\\'s'");
    expect(literalSource(4)).toBe('4');
    expect(literalSource(true)).toBe('true');
    expect(v(literalSource('a\nb'))).toBe('a\nb');
  });
});
