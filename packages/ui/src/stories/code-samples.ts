/* Sample source for CodeEditor's stories. All of it is a pure function of its arguments, since visual regression compares
   these at zero tolerance. */


/** A readable source of a good length for a window. */
export const STORE_SOURCE = `// A small store, the way the bundles in a recording tend to start out.
import { produce } from 'immer';

/* Actions are plain objects. Reducers get the state
   and an action, and return the next state. */
export const ADD_TODO = 'todos/add';
export const TOGGLE_TODO = 'todos/toggle';
const MAX_HISTORY = 128;

export function createStore(reducer, preloaded) {
  let state = preloaded;
  let listeners = new Set();
  const history = [];

  function getState() {
    return state;
  }

  function dispatch(action) {
    if (typeof action?.type !== 'string') {
      throw new TypeError(\`Actions need a type, got \${JSON.stringify(action)}\`);
    }
    const previous = state;
    state = reducer(previous, action);
    history.push({ action, at: history.length });
    if (history.length > MAX_HISTORY) history.shift();
    for (const listener of listeners) {
      listener(state, previous);
    }
    return action;
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  dispatch({ type: '@@init' });
  return { getState, dispatch, subscribe, history };
}

export function todos(state = [], action) {
  switch (action.type) {
    case ADD_TODO:
      return [...state, { id: state.length + 1, text: action.text, done: false }];
    case TOGGLE_TODO:
      return state.map((todo) => (todo.id === action.id ? { ...todo, done: !todo.done } : todo));
    default:
      return state;
  }
}

export const visible = (list, filter = /./) =>
  list.filter((todo) => filter.test(todo.text)).sort((a, b) => a.id - b.id);

export function formatTitle(todo, width = 40) {
  const mark = todo.done ? '[x]' : '[ ]';
  const title = \`\${mark} \${todo.text}\`;
  return title.length > width ? title.slice(0, width - 1) + '…' : title.padEnd(width, ' ');
}

const store = createStore(todos, []);
const unsubscribe = store.subscribe((next, previous) => {
  console.log('todos', previous.length, '->', next.length);
});

store.dispatch({ type: ADD_TODO, text: 'Scrub back to the render that dropped a row, and find out which action it was' });
store.dispatch({ type: ADD_TODO, text: 'Ship it' });
store.dispatch({ type: TOGGLE_TODO, id: 1 });

for (const todo of visible(store.getState(), /scrub/i)) {
  console.log(formatTitle(todo));
}

unsubscribe();
export default store;
`;

const seeded = (seed: number) => {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
};

const NAMES = ['a', 'b', 'c', 'e', 'n', 'r', 't', 'i', 'o', 's', 'u', 'l', 'f', 'd', 'h', 'p', 'm', 'g', 'y', 'x', 'k', 'w', 'v', 'z', 'Ne', 'Oe', 'qt', 'Zn', 'jr', 'Kt'];
const PROPS = ['type', 'props', 'key', 'ref', 'current', 'memoizedState', 'return', 'child', 'sibling', 'flags', 'lanes', 'stateNode', 'updateQueue', 'alternate', 'then', 'value', 'length', 'push', 'call', 'apply'];
const WORDS = ['react.element', 'function', 'object', 'symbol', 'undefined', 'Minified error #', 'hidden', 'click', 'data-testid', 'aria-label', 'http://www.w3.org/2000/svg'];

/** Minified code, as a bundler leaves it: a pure function of its seed, with the regular expressions, templates and nested
    strings that trip up a lexer, and now and then a multi-byte character inside a string. */
export function minifiedCode(length: number, seed = 7): string {
  const next = seeded(seed);
  const pick = <T,>(list: readonly T[]): T => list[next() % list.length];
  const name = () => pick(NAMES);
  const prop = () => pick(PROPS);
  const pieces: string[] = [];
  let size = 0;
  const templates = [
    () => `function ${name()}(${name()},${name()}){return ${name()}.${prop()}===${name()}?${name()}:${next() % 9}}`,
    () => `var ${name()}=${name()}.${prop()},${name()}="${pick(WORDS)}";`,
    () => `if(${name()}&&typeof ${name()}.${prop()}=="function")${name()}.${prop()}(${name()},${name()});`,
    () => `${name()}=${name()}/${next() % 8 + 2}|0;`,
    () => `const ${name()}=/["'\`]/g.test(${name()}),${name()}=\`${pick(WORDS)}\${${name()}?\`\${${name()}}\`:'${pick(WORDS)}'}\`;`,
    () => `for(let ${name()}=0;${name()}<${next() % 64};${name()}++)${name()}[${name()}]=${name()}*${next() % 100}/${next() % 9 + 1};`,
    () => `class ${pick(['Ae', 'Be', 'Ce', 'De'])} extends ${pick(['Fe', 'Ge', 'He'])}{${prop()}(){return this.${prop()}??null}}`,
    () => `${name()}.${prop()}(${name()}=>{${name()}.${prop()}=${name()}.${prop()}||${next() % 2 === 0 ? 'true' : 'void 0'}});`,
    () => (next() % 8 === 0 ? `${name()}="実行中 … 🚀";` : `/*! ${pick(WORDS)} */`),
    () => `switch(${name()}.${prop()}){case ${next() % 32}:${name()}=${name()};break;default:${name()}=0}`,
  ];
  for (;;) {
    const piece = pick(templates)();
    if (size + piece.length > length) break;
    pieces.push(piece);
    size += piece.length;
  }
  // Whole statements, and padding to the exact length: nothing is left open for the next line.
  return pieces.join('') + ';'.repeat(length - size);
}

const LOCALS = ['node', 'fiber', 'queue', 'update', 'next', 'lane', 'child', 'state', 'props', 'context'];
const ACTIONS = ['flushWork', 'commitRoot', 'scheduleUpdate', 'markRootUpdated', 'readContext', 'bailout', 'resetHooks', 'pushEffect'];

/** A line of a generated, pretty printed file with no end to speak of: a pure function of its index, so it needs no memory.
    Lines repeat a 12 line shape that varies with the index. */
export function generatedLine(index: number): string {
  const block = Math.floor(index / 12);
  const local = LOCALS[block % LOCALS.length];
  const action = ACTIONS[(block * 7) % ACTIONS.length];
  switch (index % 12) {
    case 0:
      return `function ${action}_${block}(${local}, lanes) {`;
    case 1:
      return `  // Block ${block.toLocaleString('en-US')} of a generated file`;
    case 2:
      return `  const previous = ${local}.memoizedState;`;
    case 3:
      return `  if (previous === null || (lanes & ${1 << (block % 24)}) === 0) {`;
    case 4:
      return `    return ${action}_${Math.max(0, block - 1)}(${local}.return, lanes);`;
    case 5:
      return '  }';
    case 6:
      return `  const label = "${action}:" + ${local}.key + \` at \${${block}}\`;`;
    case 7:
      return `  ${local}.flags |= 0x${(block % 4096).toString(16).padStart(3, '0')};`;
    case 8:
      return `  console.log(label, ${local}.type?.name ?? null, ${(block % 97) / 8});`;
    case 9:
      return '  return previous;';
    case 10:
      return '}';
    default:
      return '';
  }
}

/** The widest `generatedLine`, near enough: a known bound saves the editor a pass over the file to find out. */
export const GENERATED_MAX_LINE = 64;

/** Tabs, wide characters and things a font can't be trusted with. */
export const UNICODE_SOURCE = [
  '// Tabs reach the next stop, wherever they start.',
  'switch (kind) {',
  '\tcase 1:\tvalue = "tab\tin a string";\tbreak;',
  '\tcase 22:\tvalue = 2;\t\tbreak;',
  '\tcase 333:\tvalue = 3;\t\tbreak;',
  '}',
  '',
  '// Wide characters and emoji are two cells, and accents stay on their letters.',
  'const greetings = ["こんにちは世界", "안녕하세요", "你好，世界", "Olá, café", "Привет"];',
  'const status = "✅ done 🚀 shipped 👩\u200d💻 by a person 🇺🇸 here 👍🏽";',
  'const combining = "cafe\u0301 and an e\u0301 and a\u0308";',
  '',
  '// A column keeps its place on the grid after any of them.',
  '/* 漢字 */ const after = 1;',
  '/* abcd */ const after = 1;',
  '/* 😀😀 */ const after = 1;',
  '',
  '// Invisible characters show, and bidi controls have no effect.',
  'const zero = "a\u200bb", joiner = "a\u2060b", override = "x\u202eyz";',
  'const arabic = "مرحبا بالعالم"; const hebrew = "שלום עולם";',
];

/** Half a million lines of `generatedLine` as one text, the way a document starts: made once. */
let halfMillion: string | null = null;
export function halfMillionLines(): string {
  return (halfMillion ??= Array.from({ length: 500_000 }, (_, i) => generatedLine(i)).join('\n'));
}
