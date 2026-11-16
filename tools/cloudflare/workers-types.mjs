/* Reads @cloudflare/workers-types with the TypeScript compiler API, as data: nothing in the package is run or imported.
 *
 * The program holds only that .d.ts and TypeScript's own lib files (`noResolve`, `types: []`), so nothing else loads.
 * `describe` returns each named type's members as the checker sees them, inherited ones included; a member is a
 * `method` when its type has a call signature (a function-typed property counts), otherwise a `property`.
 */

/* Web-standard types the package declares for itself. Following a return value into these says nothing about the
   service, so they end the walk. This list is hand-written. */
const STOP_FOLLOWING = new Set([
  'Promise', 'Array', 'ReadonlyArray', 'Map', 'Set', 'Date', 'Uint8Array', 'ArrayBuffer', 'ArrayBufferView', 'Blob', 'File', 'FormData',
  'Response', 'Request', 'Headers', 'ReadableStream', 'WritableStream', 'TransformStream', 'WebSocket', 'URL', 'URLSearchParams',
  'AbortSignal', 'Socket', 'Iterator', 'AsyncIterator', 'AsyncIterable', 'Iterable', 'Record', 'Object', 'Function', 'String', 'Number', 'Boolean',
  'Disposable', 'AsyncDisposable', 'Error', 'ReadableStreamDefaultReader',
]);

const cutType = (text) => (text.length > 120 ? `${text.slice(0, 119)}…` : text);

export function openTypes(ts, dtsPath) {
  const program = ts.createProgram({
    rootNames: [dtsPath],
    options: { noResolve: true, types: [], lib: ['lib.esnext.d.ts'], target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, noEmit: true, skipLibCheck: true, strict: true },
  });
  const checker = program.getTypeChecker();
  const source = program.getSourceFile(dtsPath);
  if (!source) throw new Error(`workers-types: the compiler could not open ${dtsPath}`);
  const files = program.getSourceFiles().map((f) => f.fileName);

  // Globals, then the exports of each ambient module (`cloudflare:workers`, `cloudflare:pipelines` …), then namespaces.
  const modules = new Map();
  for (const m of checker.getAmbientModules()) {
    if (!m.declarations?.some((d) => d.getSourceFile() === source)) continue;
    modules.set(m.getName().replace(/^"|"$/g, ''), m);
  }
  const fromOurFile = (s) => s?.declarations?.some((d) => d.getSourceFile() === source);
  const find = (name) => {
    const global = checker.resolveName(name, undefined, ts.SymbolFlags.Type | ts.SymbolFlags.Value, false);
    if (fromOurFile(global)) return { symbol: global, where: 'global' };
    for (const [id, m] of modules) {
      const hit = checker.getExportsOfModule(m).find((s) => s.getName() === name);
      if (hit && fromOurFile(hit)) return { symbol: hit, where: id };
    }
    return null;
  };

  const declaredType = (symbol) => {
    const s = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    return { symbol: s, type: checker.getDeclaredTypeOfSymbol(s) };
  };

  const kindOf = (s) => {
    const d = s.declarations?.[0];
    if (!d) return 'unknown';
    if (ts.isClassDeclaration(d)) return 'class';
    if (ts.isInterfaceDeclaration(d)) return 'interface';
    if (ts.isTypeAliasDeclaration(d)) return 'type';
    if (ts.isVariableDeclaration(d)) return 'const';
    return ts.SyntaxKind[d.kind];
  };

  const short = (text) => text.replace(/\s+/g, ' ');
  const membersOf = (type, at) => {
    const out = [];
    for (const prop of checker.getPropertiesOfType(type)) {
      const name = prop.getName();
      if (name.startsWith('__@') || name === '__type') continue; // Symbol.dispose and friends
      if (!prop.declarations?.some((d) => d.getSourceFile() === source)) continue; // from TypeScript's lib: an Array's `map`
      const propType = checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration ?? prop.declarations?.[0] ?? at));
      const signatures = propType.getCallSignatures();
      const deprecated = prop.getJsDocTags(checker).some((t) => t.name === 'deprecated');
      const optional = (prop.flags & ts.SymbolFlags.Optional) !== 0;
      const inherited = prop.declarations?.[0]?.parent && !at.declarations?.includes(prop.declarations[0].parent);
      if (signatures.length) {
        out.push({
          name, kind: 'method', overloads: signatures.length, optional, deprecated,
          returns: [...new Set(signatures.map((sig) => short(checker.typeToString(checker.getReturnTypeOfSignature(sig), undefined, ts.TypeFormatFlags.NoTruncation))))],
          params: signatures[0].getParameters().map((p) => p.getName()),
          paramTypes: signatures[0].getParameters().map((p) => short(checker.typeToString(checker.getTypeOfSymbolAtLocation(p, p.valueDeclaration ?? at.declarations[0]), undefined, ts.TypeFormatFlags.NoTruncation))),
          ...(inherited ? { inherited: true } : {}),
        });
      } else {
        out.push({ name, kind: 'property', optional, deprecated, type: cutType(short(checker.typeToString(propType, undefined, ts.TypeFormatFlags.NoTruncation))), ...(inherited ? { inherited: true } : {}) });
      }
    }
    return out.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'method' ? -1 : 1));
  };

  // The object types a method hands back, unwrapping Promise, arrays and unions, for a follow-on walk.
  const namedIn = (type, into, depth = 0) => {
    if (depth > 4 || !type) return;
    const sym = type.aliasSymbol ?? type.getSymbol?.();
    const name = sym?.getName();
    if (name && !name.startsWith('__') && sym.declarations?.some((d) => d.getSourceFile() === source) && !STOP_FOLLOWING.has(name)) into.add(name);
    if (type.isUnionOrIntersection?.()) { for (const t of type.types) namedIn(t, into, depth + 1); return; }
    for (const a of checker.getTypeArguments?.(type) ?? []) namedIn(a, into, depth + 1);
  };

  const describe = (name) => {
    const found = find(name);
    if (!found) return { name, found: false };
    const { symbol, type } = declaredType(found.symbol);
    const members = membersOf(type, symbol);
    const line = symbol.declarations?.[0] ? source.getLineAndCharacterOfPosition(symbol.declarations[0].getStart()).line + 1 : null;
    return { name, found: true, where: found.where, kind: kindOf(symbol), line, members };
  };

  // Everything a type's methods hand back, and what those hand back, as far as `maxDepth`. Only types with methods.
  const followOn = (name, maxDepth = 3) => {
    const seen = new Set([name]);
    const out = {};
    let frontier = [name];
    for (let depth = 0; depth < maxDepth && frontier.length; depth++) {
      const next = [];
      for (const n of frontier) {
        const found = find(n);
        if (!found) continue;
        const { type } = declaredType(found.symbol);
        for (const prop of checker.getPropertiesOfType(type)) {
          if (prop.getName().startsWith('__@')) continue;
          const propType = checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(prop, prop.valueDeclaration ?? prop.declarations?.[0] ?? found.symbol));
          const handed = new Set();
          const signatures = propType.getCallSignatures();
          for (const sig of signatures) namedIn(checker.getReturnTypeOfSignature(sig), handed);
          if (!signatures.length) namedIn(propType, handed); // StreamBinding.videos is an object with methods
          for (const h of handed) if (!seen.has(h)) { seen.add(h); next.push(h); }
        }
      }
      for (const n of next) {
        const d = describe(n);
        if (!d.found) continue;
        const methods = d.members.filter((m) => m.kind === 'method').map((m) => m.name);
        if (methods.length) out[n] = methods;
      }
      frontier = next;
    }
    return out;
  };

  const moduleExports = (id) => {
    const m = modules.get(id);
    return m ? checker.getExportsOfModule(m).map((s) => s.getName()).sort() : null;
  };

  return { describe, followOn, modules: [...modules.keys()], moduleExports, files };
}
