import { describe, expect, it } from 'vitest';
import {
  CodeDocument, CodeHistory, UNDO_MAX_STEPS, caretAt, deleteBackwardCommand, deleteForwardCommand, detectIndent, detectLineEnding, editBetween,
  editorKeyAction, endOfText, indentCommand, insertCommand, leadingWhitespace, lineAfterEdit, lineEditOf, mapPosition, mapSelection, moveCaret, newlineCommand,
  positionAtRow, redoEdit, rowOfPosition, selectedLines, splitEditorLines, tabCommand, undoEdit, wordEndAfter, wordStartBefore,
  type CaretMove, type DeleteContext, type EditCommand, type EditorKey, type MoveContext,
} from '@/lib/code-document';
import { LineMetrics, identityRowMap, wrapRowMap, type CodePosition, type CodeSelection } from '@/lib/code-editor-model';

const at = (line: number, offset: number): CodePosition => ({ line, offset });
const range = (anchor: CodePosition, focus: CodePosition): CodeSelection => ({ anchor, focus });
const docOf = (text: string) => new CodeDocument(text);
const metricsFor = (document: { get: (line: number) => string }) => (line: number) => new LineMetrics(document.get(line), 4);
const context = (document: CodeDocument, indent?: string): DeleteContext => ({ document, metricsOf: metricsFor(document), indent });

/** Runs a command the way the editor does: makes the edit, and says where the selection went. */
function run(document: CodeDocument, command: EditCommand | null) {
  if (!command) return null;
  const applied = document.replace(command.edit);
  return { applied, selection: command.after ?? caretAt(applied.newTo) };
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return (below: number) => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return (state >>> 8) % below;
  };
}

describe('splitting and joining', () => {
  it('splits at the line ends a file has, and leaves U+2028 in the line', () => {
    expect(splitEditorLines('a\nb\r\nc\rd')).toEqual(['a', 'b', 'c', 'd']);
    expect(splitEditorLines('a b c\nd')).toEqual(['a b c', 'd']);
    expect(splitEditorLines('')).toEqual(['']);
    expect(splitEditorLines('a\n')).toEqual(['a', '']);
  });

  it('writes back the line ending most of the text uses', () => {
    expect(detectLineEnding('a\nb')).toBe('\n');
    expect(detectLineEnding('a\r\nb\r\nc\nd')).toBe('\r\n');
    expect(detectLineEnding('a\r\nb\nc\nd')).toBe('\n');
  });

  it('gives back the text it was given, until an edit', () => {
    for (const text of ['', 'a', 'a\n', '\n', 'a\nb\n\nc', 'a\r\nb\r\n', 'mixed\r\nends\nhere']) {
      expect(docOf(text).getText()).toBe(text);
    }
  });

  it('keeps its line ending through an edit', () => {
    const document = docOf('a\r\nb\r\nc');
    document.replace({ from: at(1, 0), to: at(1, 1), text: 'B\r\nB' });
    expect(document.getText()).toBe('a\r\nB\r\nB\r\nc');
    expect(document.count).toBe(4);
  });

  it('finds where a text ends', () => {
    expect(endOfText(at(2, 3), 'abc')).toEqual(at(2, 6));
    expect(endOfText(at(2, 3), 'a\nbc')).toEqual(at(3, 2));
    expect(endOfText(at(2, 3), '\n\n')).toEqual(at(4, 0));
    expect(endOfText(at(2, 3), '')).toEqual(at(2, 3));
  });
});

describe('CodeDocument.replace', () => {
  it('edits within a line', () => {
    const document = docOf('hello world\nnext');
    const applied = document.replace({ from: at(0, 6), to: at(0, 11), text: 'there' });
    expect(document.get(0)).toBe('hello there');
    expect(applied).toEqual({ from: at(0, 6), to: at(0, 11), text: 'there', removed: 'world', newTo: at(0, 11) });
    expect(document.version).toBe(1);
  });

  it('adds lines, and joins them', () => {
    const document = docOf('one\ntwo\nthree');
    let applied = document.replace({ from: at(1, 1), to: at(1, 2), text: 'a\nb\nc' });
    expect(document.getText()).toBe('one\nta\nb\nco\nthree');
    expect(applied.newTo).toEqual(at(3, 1));
    expect(applied.removed).toBe('w');
    applied = document.replace({ from: at(0, 1), to: at(4, 2), text: '' });
    expect(document.getText()).toBe('oree');
    expect(applied.removed).toBe('ne\nta\nb\nco\nth');
    expect(applied.newTo).toEqual(at(0, 1));
    expect(document.count).toBe(1);
  });

  it('turns any line ending it is given into a line', () => {
    const document = docOf('');
    const applied = document.replace({ from: at(0, 0), to: at(0, 0), text: 'a\r\nb\rc' });
    expect(document.count).toBe(3);
    expect(applied.text).toBe('a\nb\nc');
  });

  it('clamps a range to what exists', () => {
    const document = docOf('abc');
    const applied = document.replace({ from: at(5, 99), to: at(9, 99), text: 'd' });
    expect(document.get(0)).toBe('abcd');
    expect(applied.from).toEqual(at(0, 3));
  });

  it('takes a paste of more lines than fit in a function call', () => {
    const document = docOf('start\nend');
    const text = Array.from({ length: 200_000 }, (_, i) => `line ${i}`).join('\n');
    const applied = document.replace({ from: at(0, 5), to: at(0, 5), text });
    expect(document.count).toBe(200_001);
    expect(document.get(200_000)).toBe('end');
    expect(applied.newTo).toEqual(at(199_999, 'line 199999'.length));
  });

  it('says which lines it touched', () => {
    const document = docOf('one\ntwo\nthree');
    expect(lineEditOf(document.replace({ from: at(0, 1), to: at(1, 2), text: 'x\ny\nz' }))).toEqual({
      fromLine: 0, oldEndLine: 1, newEndLine: 2, fromOffset: 1, oldEndOffset: 2, newEndOffset: 1,
    });
  });
});

describe('positions through an edit', () => {
  const edit = docOf('abcdef\nghijkl\nmnopqr').replace({ from: at(0, 2), to: at(1, 3), text: 'X\nYZ' });

  it('leaves what is before it, moves what is after it, and collapses what it replaced', () => {
    expect(mapPosition(at(0, 1), edit)).toEqual(at(0, 1));
    expect(mapPosition(at(0, 4), edit)).toEqual(edit.newTo);
    expect(mapPosition(at(0, 4), edit, 'start')).toEqual(edit.from);
    expect(mapPosition(at(1, 5), edit)).toEqual(at(1, 4));
    expect(mapPosition(at(2, 3), edit)).toEqual(at(2, 3));
    expect(mapSelection(range(at(0, 1), at(2, 2)), edit)).toEqual(range(at(0, 1), at(2, 2)));
  });

  it('moves a line number by what happened above it', () => {
    const lines = docOf('a\nb\nc\nd\ne').replace({ from: at(1, 0), to: at(2, 1), text: 'x\ny\nz' });
    expect(lineAfterEdit(0, lines)).toBe(0);
    expect(lineAfterEdit(1, lines)).toBe(1);
    expect(lineAfterEdit(2, lines)).toBe(1);
    expect(lineAfterEdit(3, lines)).toBe(4);
    expect(lineAfterEdit(4, lines)).toBe(5);
  });
});

describe('editBetween', () => {
  const edit = (from: string, to: string) => editBetween(docOf(from), to);

  it('says when nothing changed', () => {
    expect(edit('a\nb', 'a\nb')).toBeNull();
    expect(edit('', '')).toBeNull();
  });

  it('finds the smallest edit', () => {
    expect(edit('const a = 1;\nnext', 'const a = 2;\nnext')).toEqual({ from: at(0, 10), to: at(0, 11), text: '2' });
    expect(edit('a\nb\nc', 'a\nx\ny\nc')).toEqual({ from: at(1, 0), to: at(1, 1), text: 'x\ny' });
    expect(edit('a\nb\nc', 'a\nnew\nb\nc')).toEqual({ from: at(1, 0), to: at(1, 0), text: 'new\n' });
    expect(edit('a\nb', 'a\nb\nc')).toEqual({ from: at(1, 1), to: at(1, 1), text: '\nc' });
    expect(edit('a\nb\nc', 'a\nc')).toEqual({ from: at(1, 0), to: at(2, 0), text: '' });
    expect(edit('a\nb\nc', 'a\nb')).toEqual({ from: at(1, 1), to: at(2, 1), text: '' });
  });

  it('never cuts a surrogate pair in half', () => {
    const e = edit('😀', '😁');
    expect(e).toEqual({ from: at(0, 0), to: at(0, 2), text: '😁' });
  });

  it('always gets there, on any pair of texts', () => {
    const random = seededRandom(3);
    const pieces = ['a', 'b', '\n', '\n\n', 'hello', ' ', '😀', 'é'];
    const text = () => {
      let out = '';
      const n = random(12);
      for (let i = 0; i < n; i++) out += pieces[random(pieces.length)];
      return out;
    };
    for (let i = 0; i < 2000; i++) {
      const a = text();
      const b = text();
      const document = docOf(a);
      const e = editBetween(document, b);
      if (a === b) expect(e).toBeNull();
      else {
        document.replace(e as NonNullable<typeof e>);
        expect(document.getText()).toBe(b);
      }
    }
  });
});

describe('undo', () => {
  function setup(options: ConstructorParameters<typeof CodeHistory>[0] = {}) {
    let time = 1000;
    const history = new CodeHistory({ now: () => time, ...options });
    const document = docOf('');
    const type = (text: string, origin: EditCommand['origin'] = 'input') => {
      const end = at(document.count - 1, document.get(document.count - 1).length);
      const before = caretAt(end);
      const applied = document.replace({ from: end, to: end, text });
      history.record(applied, origin, before, caretAt(applied.newTo));
    };
    const undo = () => {
      const step = history.undo();
      if (step) document.replace(undoEdit(step));
      return step;
    };
    const redo = () => {
      const step = history.redo();
      if (step) document.replace(redoEdit(step));
      return step;
    };
    return { history, document, type, undo, redo, tick: (ms: number) => { time += ms; } };
  }

  it('groups typing into a step', () => {
    const { document, type, undo, redo } = setup();
    for (const c of 'hello') type(c);
    expect(document.getText()).toBe('hello');
    undo();
    expect(document.getText()).toBe('');
    redo();
    expect(document.getText()).toBe('hello');
  });

  it('starts a new step at a word, a pause, or the caret moving', () => {
    const { document, type, undo, tick, history } = setup();
    for (const c of 'one') type(c);
    for (const c of ' two') type(c);
    undo();
    expect(document.getText()).toBe('one');
    tick(5000);
    type('!');
    tick(5000);
    type('?');
    undo();
    expect(document.getText()).toBe('one!');
    history.seal();
    type('a');
    history.seal();
    type('b');
    undo();
    expect(document.getText()).toBe('one!a');
  });

  it('keeps pasting, new lines and indenting each to a step of their own', () => {
    const { document, type, undo } = setup();
    type('a');
    type('pasted', 'paste');
    type('\n', 'newline');
    type('b');
    undo();
    expect(document.getText()).toBe('apasted\n');
    undo();
    expect(document.getText()).toBe('apasted');
    undo();
    expect(document.getText()).toBe('a');
  });

  it('groups backspacing and deleting, and puts all of it back', () => {
    const history = new CodeHistory({ now: () => 1 });
    const document = docOf('hello world');
    const del = (from: number, to: number) => {
      const before = caretAt(at(0, to));
      const applied = document.replace({ from: at(0, from), to: at(0, to), text: '' });
      history.record(applied, 'delete', before, caretAt(at(0, from)));
    };
    del(10, 11);
    del(9, 10);
    del(8, 9);
    expect(document.get(0)).toBe('hello wo');
    const step = history.undo() as NonNullable<ReturnType<CodeHistory['undo']>>;
    document.replace(undoEdit(step));
    expect(document.get(0)).toBe('hello world');
    expect(step.after).toEqual(caretAt(at(0, 8)));
    expect(step.before).toEqual(caretAt(at(0, 11)));

    history.seal();
    const forward = (from: number) => {
      const applied = document.replace({ from: at(0, from), to: at(0, from + 1), text: '' });
      history.record(applied, 'delete', caretAt(at(0, from)), caretAt(at(0, from)));
    };
    forward(5);
    forward(5);
    expect(document.get(0)).toBe('helloorld');
    document.replace(undoEdit(history.undo() as NonNullable<ReturnType<CodeHistory['undo']>>));
    expect(document.get(0)).toBe('hello world');
  });

  it('puts the selection back', () => {
    const history = new CodeHistory();
    const document = docOf('abc');
    const before = range(at(0, 0), at(0, 3));
    const applied = document.replace({ from: at(0, 0), to: at(0, 3), text: 'x' });
    history.record(applied, 'input', before, caretAt(applied.newTo));
    expect((history.undo() as NonNullable<ReturnType<CodeHistory['undo']>>).before).toEqual(before);
    expect((history.redo() as NonNullable<ReturnType<CodeHistory['redo']>>).after).toEqual(caretAt(at(0, 1)));
  });

  it('forgets what could be redone when something new is typed', () => {
    const { history, type, undo } = setup();
    type('a');
    undo();
    expect(history.canRedo).toBe(true);
    type('b');
    expect(history.canRedo).toBe(false);
    expect(history.redo()).toBeNull();
  });

  it('does nothing with nothing to do', () => {
    const history = new CodeHistory();
    expect(history.undo()).toBeNull();
    expect(history.redo()).toBeNull();
  });

  it('holds only so many steps', () => {
    const history = new CodeHistory();
    const document = docOf('');
    for (let i = 0; i < UNDO_MAX_STEPS + 50; i++) {
      const applied = document.replace({ from: at(0, 0), to: at(0, 0), text: 'x' });
      history.record(applied, 'paste', caretAt(at(0, 0)), caretAt(applied.newTo));
    }
    expect(history.size.steps).toBe(UNDO_MAX_STEPS);
  });

  it('holds only so much text, and always the latest step', () => {
    const history = new CodeHistory({ maxChars: 100 });
    const document = docOf('');
    const paste = (n: number) => {
      const applied = document.replace({ from: at(0, 0), to: at(0, 0), text: 'x'.repeat(n) });
      history.record(applied, 'paste', caretAt(at(0, 0)), caretAt(applied.newTo));
    };
    paste(40);
    paste(40);
    paste(40);
    expect(history.size).toEqual({ steps: 2, chars: 80 });
    paste(1000);
    expect(history.size).toEqual({ steps: 1, chars: 1000 });
    expect(history.canUndo).toBe(true);
  });

  it('stops counting what it no longer holds', () => {
    const history = new CodeHistory();
    const document = docOf('');
    const applied = document.replace({ from: at(0, 0), to: at(0, 0), text: 'abc' });
    history.record(applied, 'paste', caretAt(at(0, 0)), caretAt(applied.newTo));
    document.replace(undoEdit(history.undo() as NonNullable<ReturnType<CodeHistory['undo']>>));
    const next = document.replace({ from: at(0, 0), to: at(0, 0), text: 'z' });
    history.record(next, 'paste', caretAt(at(0, 0)), caretAt(next.newTo));
    expect(history.size).toEqual({ steps: 1, chars: 1 });
  });

  it('gets back to where it started, however it got there', () => {
    const random = seededRandom(21);
    const start = 'first line\n  second line\n\nlast';
    const document = docOf(start);
    const history = new CodeHistory({ now: () => 0 });
    const texts: string[] = [start];
    let selection = caretAt(at(0, 0));
    for (let i = 0; i < 400; i++) {
      const line = random(document.count);
      const offset = random(document.get(line).length + 1);
      const toLine = Math.min(document.count - 1, line + random(2));
      const to = toLine === line ? at(line, Math.min(document.get(line).length, offset + random(4))) : at(toLine, random(document.get(toLine).length + 1));
      const text = ['', 'x', 'yz', '\n', 'a\nb', ' '][random(6)];
      history.seal();
      const applied = document.replace({ from: at(line, offset), to, text });
      history.record(applied, random(2) ? 'input' : 'delete', selection, caretAt(applied.newTo));
      selection = caretAt(applied.newTo);
      texts.push(document.getText());
    }
    for (let i = texts.length - 2; i >= 0; i--) {
      document.replace(undoEdit(history.undo() as NonNullable<ReturnType<CodeHistory['undo']>>));
      expect(document.getText()).toBe(texts[i]);
    }
    for (let i = 1; i < texts.length; i++) {
      document.replace(redoEdit(history.redo() as NonNullable<ReturnType<CodeHistory['redo']>>));
      expect(document.getText()).toBe(texts[i]);
    }
  });
});

describe('indents', () => {
  it('finds what a file uses', () => {
    expect(detectIndent(docOf('a\n\tb\n\tc'))).toBe('\t');
    expect(detectIndent(docOf('a\n  b\n    c'))).toBe('  ');
    expect(detectIndent(docOf('a\n    b\n        c'))).toBe('    ');
    expect(detectIndent(docOf('nothing to go on'))).toBe('  ');
    expect(detectIndent(docOf('a\n\tb\n  c\n  d\n\te\n\tf'))).toBe('\t');
  });

  it('measures leading whitespace', () => {
    expect(leadingWhitespace('  \tabc')).toBe(3);
    expect(leadingWhitespace('abc')).toBe(0);
    expect(leadingWhitespace('   ')).toBe(3);
    expect(leadingWhitespace('')).toBe(0);
  });
});

describe('commands', () => {
  it('replaces a selection with what is typed, either way round', () => {
    const document = docOf('hello');
    const result = run(document, insertCommand(range(at(0, 4), at(0, 1)), 'i'));
    expect(document.get(0)).toBe('hio');
    expect(result?.selection).toEqual(caretAt(at(0, 2)));
  });

  it('keeps the indent on a new line, up to the caret', () => {
    const document = docOf('    code();');
    let result = run(document, newlineCommand(document, caretAt(at(0, 11))));
    expect(document.getText()).toBe('    code();\n    ');
    expect(result?.selection).toEqual(caretAt(at(1, 4)));
    const other = docOf('    code();');
    result = run(other, newlineCommand(other, caretAt(at(0, 2))));
    expect(other.getText()).toBe('  \n  ' + '  code();');
    const tabs = docOf('\t\tx');
    run(tabs, newlineCommand(tabs, caretAt(at(0, 3))));
    expect(tabs.getText()).toBe('\t\tx\n\t\t');
  });

  it('replaces a selection with the new line', () => {
    const document = docOf('  abc def');
    run(document, newlineCommand(document, range(at(0, 5), at(0, 6))));
    expect(document.getText()).toBe('  abc\n  def');
  });

  describe('backspace', () => {
    const back = (text: string, position: CodePosition, unit: 'char' | 'word' | 'line' = 'char', indent?: string) => {
      const document = docOf(text);
      const result = run(document, deleteBackwardCommand(context(document, indent), caretAt(position), unit));
      return result ? { text: document.getText(), caret: result.selection.focus } : null;
    };

    it('takes a character, and a whole cluster', () => {
      expect(back('abc', at(0, 2))).toEqual({ text: 'ac', caret: at(0, 1) });
      expect(back('a😀', at(0, 3))).toEqual({ text: 'a', caret: at(0, 1) });
      expect(back('éx', at(0, 2))).toEqual({ text: 'x', caret: at(0, 0) });
      expect(back('👩‍💻', at(0, 5))).toEqual({ text: '', caret: at(0, 0) });
    });

    it('joins lines at the start of one, and does nothing at the start of the file', () => {
      expect(back('ab\ncd', at(1, 0))).toEqual({ text: 'abcd', caret: at(0, 2) });
      expect(back('ab', at(0, 0))).toBeNull();
    });

    it('takes a word, or punctuation, or the spaces before it', () => {
      expect(back('foo bar', at(0, 7), 'word')).toEqual({ text: 'foo ', caret: at(0, 4) });
      expect(back('foo bar  ', at(0, 9), 'word')).toEqual({ text: 'foo ', caret: at(0, 4) });
      expect(back('foo.bar', at(0, 4), 'word')).toEqual({ text: 'foobar', caret: at(0, 3) });
      expect(back('foo===', at(0, 6), 'word')).toEqual({ text: 'foo', caret: at(0, 3) });
      expect(back('ab\ncd', at(1, 0), 'word')).toEqual({ text: 'abcd', caret: at(0, 2) });
    });

    it('takes the line up to the caret', () => {
      expect(back('  abc def', at(0, 5), 'line')).toEqual({ text: ' def', caret: at(0, 0) });
      expect(back('ab\ncd', at(1, 0), 'line')).toEqual({ text: 'abcd', caret: at(0, 2) });
    });

    it('goes back an indent at a time in a file of spaces', () => {
      expect(back('    code', at(0, 4), 'char', '  ')).toEqual({ text: '  code', caret: at(0, 2) });
      expect(back('   code', at(0, 3), 'char', '  ')).toEqual({ text: '  code', caret: at(0, 2) });
      expect(back('  code ', at(0, 7), 'char', '  ')).toEqual({ text: '  code', caret: at(0, 6) });
      expect(back('\t\tcode', at(0, 2), 'char', '\t')).toEqual({ text: '\tcode', caret: at(0, 1) });
    });

    it('takes a selection first', () => {
      const document = docOf('abcdef');
      run(document, deleteBackwardCommand(context(document), range(at(0, 1), at(0, 4)), 'word'));
      expect(document.get(0)).toBe('aef');
    });
  });

  describe('delete', () => {
    const forward = (text: string, position: CodePosition, unit: 'char' | 'word' | 'line' = 'char') => {
      const document = docOf(text);
      const result = run(document, deleteForwardCommand(context(document), caretAt(position), unit));
      return result ? { text: document.getText(), caret: result.selection.focus } : null;
    };

    it('takes a character, a cluster, a word or the rest of the line', () => {
      expect(forward('abc', at(0, 1))).toEqual({ text: 'ac', caret: at(0, 1) });
      expect(forward('😀a', at(0, 0))).toEqual({ text: 'a', caret: at(0, 0) });
      expect(forward('foo bar', at(0, 3), 'word')).toEqual({ text: 'foo', caret: at(0, 3) });
      expect(forward('foo bar baz', at(0, 4), 'line')).toEqual({ text: 'foo ', caret: at(0, 4) });
    });

    it('joins lines at the end of one, and does nothing at the end of the file', () => {
      expect(forward('ab\ncd', at(0, 2))).toEqual({ text: 'abcd', caret: at(0, 2) });
      expect(forward('ab', at(0, 2))).toBeNull();
    });
  });

  describe('words', () => {
    it('finds where they start and end', () => {
      expect(wordStartBefore('foo bar', 7)).toBe(4);
      expect(wordStartBefore('foo bar', 4)).toBe(0);
      expect(wordStartBefore('a.b', 2)).toBe(1);
      expect(wordStartBefore('   ', 3)).toBe(0);
      expect(wordEndAfter('foo bar', 0)).toBe(3);
      expect(wordEndAfter('foo bar', 3)).toBe(7);
      expect(wordEndAfter('a.b', 1)).toBe(2);
      expect(wordEndAfter('   ', 0)).toBe(3);
    });
  });

  describe('tab', () => {
    const metricsOf = (document: CodeDocument) => metricsFor(document);

    it('goes to the next stop in a file of spaces, and one tab in a file of tabs', () => {
      const spaces = docOf('abc');
      run(spaces, tabCommand(caretAt(at(0, 1)), '  ', metricsOf(spaces)));
      expect(spaces.get(0)).toBe('a bc');
      const four = docOf('abc');
      run(four, tabCommand(caretAt(at(0, 3)), '    ', metricsOf(four)));
      expect(four.get(0)).toBe('abc ');
      const tabs = docOf('abc');
      run(tabs, tabCommand(caretAt(at(0, 1)), '\t', metricsOf(tabs)));
      expect(tabs.get(0)).toBe('a\tbc');
    });

    it('indents every line a selection touches, as one edit, and leaves them selected', () => {
      const document = docOf('one\n\ntwo\nthree');
      const result = run(document, indentCommand(document, range(at(0, 1), at(2, 1)), '  ', false));
      expect(document.getText()).toBe('  one\n\n  two\nthree');
      expect(result?.selection).toEqual(range(at(0, 0), at(2, 5)));
    });

    it('leaves out a last line the selection only reaches the start of', () => {
      expect(selectedLines(range(at(0, 0), at(2, 0)))).toEqual({ first: 0, last: 1 });
      expect(selectedLines(range(at(2, 0), at(0, 0)))).toEqual({ first: 0, last: 1 });
      expect(selectedLines(range(at(2, 0), at(2, 0)))).toEqual({ first: 2, last: 2 });
      const document = docOf('one\ntwo\nthree');
      run(document, indentCommand(document, range(at(0, 0), at(2, 0)), '\t', false));
      expect(document.getText()).toBe('\tone\n\ttwo\nthree');
    });

    it('keeps the direction of a backward selection', () => {
      const document = docOf('one\ntwo');
      const result = run(document, indentCommand(document, range(at(1, 2), at(0, 1)), '  ', false));
      expect(result?.selection).toEqual(range(at(1, 5), at(0, 0)));
    });

    it('outdents by one indent, as far as there is one', () => {
      const document = docOf('    a\n  b\nc\n\td');
      run(document, indentCommand(document, range(at(0, 0), at(3, 1)), '  ', true));
      expect(document.getText()).toBe('  a\nb\nc\nd');
    });

    it('does nothing when there is nothing to take out', () => {
      const document = docOf('a\nb');
      expect(indentCommand(document, range(at(0, 0), at(1, 1)), '  ', true)).toBeNull();
      expect(indentCommand(document, caretAt(at(0, 0)), '  ', true)).toBeNull();
    });

    it('moves one line with the smallest edit, and the caret comes along', () => {
      const document = docOf('  abc');
      const command = indentCommand(document, caretAt(at(0, 3)), '  ', true) as EditCommand;
      expect(command.edit).toEqual({ from: at(0, 0), to: at(0, 2), text: '' });
      const result = run(document, command);
      expect(document.get(0)).toBe('abc');
      expect(result?.selection).toEqual(caretAt(at(0, 1)));
      const again = indentCommand(document, caretAt(at(0, 1)), '  ', false) as EditCommand;
      expect(again.edit).toEqual({ from: at(0, 0), to: at(0, 0), text: '  ' });
      expect(run(document, again)?.selection).toEqual(caretAt(at(0, 3)));
    });

    it('does not move the caret off the line start when outdenting past it', () => {
      const document = docOf('    abc');
      const result = run(document, indentCommand(document, caretAt(at(0, 1)), '  ', true));
      expect(result?.selection).toEqual(caretAt(at(0, 0)));
    });
  });
});

describe('moving the caret', () => {
  function ctx(text: string, cols = 0, pageRows = 3): MoveContext {
    const document = docOf(text);
    const metricsOf = (line: number) => new LineMetrics(document.get(line), 4);
    const map = cols
      ? wrapRowMap(Uint32Array.from({ length: document.count }, (_, i) => metricsOf(i).cells), cols)
      : identityRowMap(document.count);
    return { document, metricsOf, map, cols, pageRows };
  }
  const move = (c: MoveContext, from: CodePosition, how: CaretMove, goal: number | null = null) => moveCaret(from, how, c, goal);

  it('goes by clusters, and over line ends', () => {
    const c = ctx('a😀b\ncd');
    expect(move(c, at(0, 1), 'right').position).toEqual(at(0, 3));
    expect(move(c, at(0, 3), 'left').position).toEqual(at(0, 1));
    expect(move(c, at(0, 4), 'right').position).toEqual(at(1, 0));
    expect(move(c, at(1, 0), 'left').position).toEqual(at(0, 4));
    expect(move(c, at(0, 0), 'left').position).toEqual(at(0, 0));
    expect(move(c, at(1, 2), 'right').position).toEqual(at(1, 2));
  });

  it('goes by words', () => {
    const c = ctx('foo bar.baz\nnext');
    expect(move(c, at(0, 0), 'wordRight').position).toEqual(at(0, 3));
    expect(move(c, at(0, 3), 'wordRight').position).toEqual(at(0, 7));
    expect(move(c, at(0, 11), 'wordRight').position).toEqual(at(1, 0));
    expect(move(c, at(0, 7), 'wordLeft').position).toEqual(at(0, 4));
    expect(move(c, at(1, 0), 'wordLeft').position).toEqual(at(0, 11));
  });

  it('home goes to where the code starts, then the very start', () => {
    const c = ctx('    code\n');
    expect(move(c, at(0, 6), 'lineStart').position).toEqual(at(0, 4));
    expect(move(c, at(0, 4), 'lineStart').position).toEqual(at(0, 0));
    expect(move(c, at(0, 0), 'lineStart').position).toEqual(at(0, 4));
    expect(move(c, at(0, 0), 'lineEnd').position).toEqual(at(0, 8));
  });

  it('keeps its column going up and down past short lines', () => {
    const c = ctx('long line\nab\nlong line');
    const first = move(c, at(0, 7), 'down');
    expect(first.position).toEqual(at(1, 2));
    expect(first.goal).toBe(7);
    const second = move(c, first.position, 'down', first.goal);
    expect(second.position).toEqual(at(2, 7));
  });

  it('keeps its place on the grid, not in the code units', () => {
    const c = ctx('漢字漢字\nabcdefgh');
    expect(move(c, at(0, 2), 'down').position).toEqual(at(1, 4));
    expect(move(c, at(1, 4), 'up').position).toEqual(at(0, 2));
  });

  it('stops at the ends of the file, at their ends', () => {
    const c = ctx('abc\ndef');
    expect(move(c, at(0, 2), 'up').position).toEqual(at(0, 0));
    expect(move(c, at(1, 1), 'down').position).toEqual(at(1, 3));
    expect(move(c, at(1, 1), 'documentStart').position).toEqual(at(0, 0));
    expect(move(c, at(0, 1), 'documentEnd').position).toEqual(at(1, 3));
  });

  it('goes by pages', () => {
    const c = ctx(Array.from({ length: 10 }, (_, i) => `line ${i}`).join('\n'), 0, 4);
    expect(move(c, at(1, 2), 'pageDown').position).toEqual(at(5, 2));
    expect(move(c, at(5, 2), 'pageUp').position).toEqual(at(1, 2));
    expect(move(c, at(1, 2), 'pageUp').position).toEqual(at(0, 0));
    expect(move(c, at(8, 2), 'pageDown').position).toEqual(at(9, 6));
  });

  describe('with wrapping on', () => {
    // 10 cells a row: `aaaaaaaaaabbbbbbbbbbcc` takes three.
    const text = `${'a'.repeat(10)}${'b'.repeat(10)}cc\nshort`;

    it('finds rows', () => {
      const c = ctx(text, 10);
      const metrics = c.metricsOf(0);
      expect(rowOfPosition(at(0, 3), metrics, c.map, 10)).toEqual({ row: 0, part: 0, cell: 3 });
      expect(rowOfPosition(at(0, 12), metrics, c.map, 10)).toEqual({ row: 1, part: 1, cell: 2 });
      expect(rowOfPosition(at(1, 2), c.metricsOf(1), c.map, 10)).toEqual({ row: 3, part: 0, cell: 2 });
    });

    it('goes up and down by the rows you can see, not the lines', () => {
      const c = ctx(text, 10);
      expect(move(c, at(0, 3), 'down').position).toEqual(at(0, 13));
      expect(move(c, at(0, 13), 'down').position).toEqual(at(0, 22));
      expect(move(c, at(0, 22), 'down').position).toEqual(at(1, 2));
      expect(move(c, at(1, 2), 'up').position).toEqual(at(0, 22));
      expect(move(c, at(0, 13), 'up').position).toEqual(at(0, 3));
    });

    it('stays on the row it was going to when the column is past the row\'s end', () => {
      const c = ctx(text, 10);
      // A place at the very end of a full row is the start of the next: going there has to stop just short.
      expect(positionAtRow(0, 10, c.map, c.metricsOf, 10)).toEqual(at(0, 9));
      expect(positionAtRow(2, 10, c.map, c.metricsOf, 10)).toEqual(at(0, 22));
    });

    it('ends a line that exactly fills its rows on the last of them', () => {
      const c = ctx('a'.repeat(20), 10);
      expect(rowOfPosition(at(0, 20), c.metricsOf(0), c.map, 10)).toEqual({ row: 1, part: 1, cell: 10 });
    });
  });
});

describe('keys', () => {
  const key = (name: string, mods: Partial<EditorKey> = {}): EditorKey => ({ key: name, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false, ...mods });
  const mac = (name: string, mods?: Partial<EditorKey>) => editorKeyAction(key(name, mods), true);
  const pc = (name: string, mods?: Partial<EditorKey>) => editorKeyAction(key(name, mods), false);

  it('moves, and extends with shift', () => {
    expect(mac('ArrowLeft')).toEqual({ type: 'move', move: 'left', extend: false });
    expect(mac('ArrowLeft', { shiftKey: true })).toEqual({ type: 'move', move: 'left', extend: true });
    expect(pc('ArrowDown')).toEqual({ type: 'move', move: 'down', extend: false });
    expect(pc('PageDown')).toEqual({ type: 'move', move: 'pageDown', extend: false });
    expect(pc('Home', { shiftKey: true })).toEqual({ type: 'move', move: 'lineStart', extend: true });
  });

  it('goes by word and line on each platform\'s keys', () => {
    expect(mac('ArrowLeft', { altKey: true })).toEqual({ type: 'move', move: 'wordLeft', extend: false });
    expect(mac('ArrowRight', { metaKey: true })).toEqual({ type: 'move', move: 'lineEnd', extend: false });
    expect(mac('ArrowUp', { metaKey: true })).toEqual({ type: 'move', move: 'documentStart', extend: false });
    expect(pc('ArrowLeft', { ctrlKey: true })).toEqual({ type: 'move', move: 'wordLeft', extend: false });
    expect(pc('Home', { ctrlKey: true })).toEqual({ type: 'move', move: 'documentStart', extend: false });
    expect(pc('End', { ctrlKey: true, shiftKey: true })).toEqual({ type: 'move', move: 'documentEnd', extend: true });
  });

  it('deletes by word and line on each platform\'s keys', () => {
    expect(mac('Backspace')).toEqual({ type: 'deleteBackward', unit: 'char' });
    expect(mac('Backspace', { altKey: true })).toEqual({ type: 'deleteBackward', unit: 'word' });
    expect(mac('Backspace', { metaKey: true })).toEqual({ type: 'deleteBackward', unit: 'line' });
    expect(mac('Delete', { altKey: true })).toEqual({ type: 'deleteForward', unit: 'word' });
    expect(mac('Delete', { metaKey: true })).toEqual({ type: 'deleteForward', unit: 'line' });
    expect(pc('Backspace', { ctrlKey: true })).toEqual({ type: 'deleteBackward', unit: 'word' });
    expect(pc('Delete', { ctrlKey: true })).toEqual({ type: 'deleteForward', unit: 'word' });
  });

  it('has the readline keys on a Mac', () => {
    expect(mac('a', { ctrlKey: true })).toEqual({ type: 'move', move: 'lineStart', extend: false });
    expect(mac('e', { ctrlKey: true, shiftKey: true })).toEqual({ type: 'move', move: 'lineEnd', extend: true });
    expect(mac('k', { ctrlKey: true })).toEqual({ type: 'deleteForward', unit: 'line' });
    expect(mac('h', { ctrlKey: true })).toEqual({ type: 'deleteBackward', unit: 'char' });
    expect(pc('k', { ctrlKey: true })).toBeNull();
  });

  it('undoes, redoes and selects all', () => {
    expect(mac('z', { metaKey: true })).toEqual({ type: 'undo' });
    expect(mac('z', { metaKey: true, shiftKey: true })).toEqual({ type: 'redo' });
    expect(mac('Z', { metaKey: true, shiftKey: true })).toEqual({ type: 'redo' });
    expect(pc('z', { ctrlKey: true })).toEqual({ type: 'undo' });
    expect(pc('y', { ctrlKey: true })).toEqual({ type: 'redo' });
    expect(mac('y', { metaKey: true })).toBeNull();
    expect(mac('a', { metaKey: true })).toEqual({ type: 'selectAll' });
    expect(pc('a', { ctrlKey: true })).toEqual({ type: 'selectAll' });
  });

  it('indents, starts lines and escapes', () => {
    expect(mac('Tab')).toEqual({ type: 'tab', outdent: false });
    expect(pc('Tab', { shiftKey: true })).toEqual({ type: 'tab', outdent: true });
    expect(pc('Enter')).toEqual({ type: 'newline' });
    expect(pc('Enter', { shiftKey: true })).toEqual({ type: 'newline' });
    expect(pc('Escape')).toEqual({ type: 'escape' });
  });

  it('leaves everything else alone: typing, and what belongs to the browser', () => {
    expect(mac('a')).toBeNull();
    expect(mac('c', { metaKey: true })).toBeNull();
    expect(mac('v', { metaKey: true })).toBeNull();
    expect(mac('x', { metaKey: true })).toBeNull();
    expect(mac('f', { metaKey: true })).toBeNull();
    expect(pc('Enter', { ctrlKey: true })).toBeNull();
    expect(mac('ArrowUp', { altKey: true })).toBeNull();
    expect(pc('Tab', { ctrlKey: true })).toBeNull();
    expect(mac('Tab', { altKey: true })).toBeNull();
    expect(pc('F5')).toBeNull();
  });
});

describe('a session', () => {
  it('stays in step with a plain string through typing, deleting and undo', () => {
    // A model simple enough to believe: the text as a string, edited by offsets.
    const random = seededRandom(1234);
    let text = 'function a() {\n  return 1;\n}\n';
    const document = docOf(text);
    const offsetOf = (p: CodePosition) => {
      let offset = 0;
      for (let line = 0; line < p.line; line++) offset += document.get(line).length + 1;
      return offset + p.offset;
    };
    let selection = caretAt(at(0, 0));
    for (let i = 0; i < 1500; i++) {
      const roll = random(10);
      if (roll < 2) {
        const line = random(document.count);
        const position = at(line, random(document.get(line).length + 1));
        selection = random(2) ? caretAt(position) : range(selection.focus, position);
        continue;
      }
      let command: EditCommand | null;
      if (roll < 6) command = insertCommand(selection, ['x', 'yz', ' ', '(', '\n', 'a\nb'][random(6)]);
      else if (roll < 7) command = newlineCommand(document, selection);
      else if (roll < 8) command = deleteBackwardCommand(context(document, '  '), selection, (['char', 'word', 'line'] as const)[random(3)]);
      else if (roll < 9) command = deleteForwardCommand(context(document), selection, (['char', 'word', 'line'] as const)[random(3)]);
      else command = indentCommand(document, selection, '  ', random(2) === 0);
      if (!command) continue;
      const start = offsetOf(command.edit.from);
      const end = offsetOf(command.edit.to);
      const applied = document.replace(command.edit);
      text = text.slice(0, start) + applied.text + text.slice(end);
      expect(applied.removed).toBeDefined();
      expect(document.getText()).toBe(text);
      selection = command.after ?? caretAt(applied.newTo);
    }
  });
});
