#!/usr/bin/env node
/* Adds the 'use client' directive to library modules that use client-only APIs (React hooks/state, react-aria,
 * framer-motion, react-dom), so Next's server components can import them. Pure modules (cn, recipes' data, icon shapes,
 * tokens) stay directive-free. Idempotent.
 *
 *   node tools/codemod/use-client.mjs [--dry]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { ROOT, SRC, listModules } from '../registry/graph.mjs';

const dry = process.argv.includes('--dry');
const CLIENT = /^(react-dom(\/.*)?|react-aria-components|react-aria(\/.*)?|framer-motion|@tiptap\/.*|@brett_lamy\/docstream.*)$/;
const REACT_HOOKS = new Set(['useState', 'useEffect', 'useLayoutEffect', 'useRef', 'useContext', 'createContext', 'useReducer', 'useMemo', 'useCallback', 'useSyncExternalStore', 'useId', 'useImperativeHandle', 'useTransition', 'useDeferredValue', 'forwardRef', 'memo', 'Children', 'cloneElement', 'createPortal']);

let added = 0;
for (const rel of listModules()) {
  const file = join(ROOT, SRC, rel);
  const src = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true);
  let client = false;
  const hasDirective = sf.statements.some((s) => ts.isExpressionStatement(s) && ts.isStringLiteral(s.expression) && s.expression.text === 'use client');
  sf.forEachChild((n) => {
    if (!ts.isImportDeclaration(n) || n.importClause?.isTypeOnly) return;
    const spec = n.moduleSpecifier.text;
    if (CLIENT.test(spec)) {
      const named = n.importClause?.namedBindings;
      const allTypes = named && ts.isNamedImports(named) && !n.importClause.name && named.elements.every((e) => e.isTypeOnly);
      if (!allTypes) client = true;
    } else if (spec === 'react') {
      const named = n.importClause?.namedBindings;
      if (named && ts.isNamespaceImport(named)) client = client || /\bReact\.(use[A-Z]\w*|createContext|forwardRef|memo|Children|cloneElement)\b/.test(src);
      else if (named && ts.isNamedImports(named)) client = client || named.elements.some((e) => !e.isTypeOnly && REACT_HOOKS.has((e.propertyName ?? e.name).text));
    }
  });
  if (client && !hasDirective) {
    added++;
    if (!dry) writeFileSync(file, `'use client';\n${src}`);
  }
}
console.log(`${dry ? 'would add' : 'added'} 'use client' to ${added} modules`);
