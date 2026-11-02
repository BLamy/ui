/* A recording's DOM without a browser: rrweb's full snapshot rebuilt as plain nodes (keyed by rrweb's node ids), kept
   current by applying its mutations, so the analysis can ask what was on the page at any moment — what an element
   says, where it sits, whether it's still attached — and find the same element in a replayed page by its path. */

/** rrweb's serialized node types. */
const DOC = 0, ELEMENT = 2, TEXT = 3;

export interface VNode {
  id: number;
  type: number;
  /** Lower-case tag name, for elements. */
  tag: string;
  attrs: Record<string, string>;
  text: string;
  parent: number | null;
  children: number[];
}

interface SerializedNode {
  id: number;
  type: number;
  tagName?: string;
  attributes?: Record<string, unknown>;
  childNodes?: SerializedNode[];
  textContent?: string;
}

export interface MutationData {
  texts: { id: number; value: string | null }[];
  attributes: { id: number; attributes: Record<string, unknown> }[];
  removes: { parentId: number; id: number }[];
  adds: { parentId: number; nextId: number | null; previousId?: number | null; node: SerializedNode }[];
}

/** Tags whose text is never shown. */
const SILENT = new Set(['script', 'style', 'noscript', 'template', 'head', 'title', 'meta', 'link']);

function attrValue(v: unknown): string | null {
  if (v === null || v === undefined || v === false) return null;
  if (typeof v === 'object') {
    // rrweb 2 sends inline-style diffs as { prop: value | [value, priority] | false }.
    return Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x !== false)
      .map(([k, x]) => `${k}: ${Array.isArray(x) ? x[0] : x}`)
      .join('; ');
  }
  return String(v);
}

export class VDom {
  nodes = new Map<number, VNode>();
  root: number | null = null;
  /** The latest value typed into each input (rrweb Input events). */
  values = new Map<number, string>();

  load(node: SerializedNode) {
    this.nodes.clear();
    this.values.clear();
    this.root = node.id;
    this.add(node, null);
  }

  private add(n: SerializedNode, parent: number | null): VNode {
    const attrs: Record<string, string> = {};
    for (const [k, v] of Object.entries(n.attributes ?? {})) {
      const s = attrValue(v);
      if (s !== null && !k.startsWith('_')) attrs[k] = s;
    }
    const node: VNode = { id: n.id, type: n.type, tag: (n.tagName ?? '').toLowerCase(), attrs, text: n.textContent ?? '', parent, children: [] };
    this.nodes.set(n.id, node);
    for (const c of n.childNodes ?? []) node.children.push(this.add(c, n.id).id);
    return node;
  }

  private detach(id: number) {
    const node = this.nodes.get(id);
    if (!node || node.parent === null) return;
    const parent = this.nodes.get(node.parent);
    if (parent) parent.children = parent.children.filter((c) => c !== id);
    node.parent = null;
  }

  /** Applies one mutation batch; returns the ids it added (outermost first) and the nodes it removed. */
  apply(m: MutationData): { added: number[]; removed: VNode[] } {
    const removed: VNode[] = [];
    for (const r of m.removes) {
      const node = this.nodes.get(r.id);
      if (node) removed.push(node);
      this.detach(r.id);
    }
    // Adds may name parents (or next siblings) that come later in the same batch, like rrweb's own queue.
    let pending = [...m.adds];
    const added: number[] = [];
    for (let pass = 0; pending.length && pass < 50; pass++) {
      const later: typeof pending = [];
      for (const a of pending) {
        const parent = this.nodes.get(a.parentId);
        if (!parent || (a.nextId !== null && a.nextId !== undefined && !this.nodes.has(a.nextId) && pass < 49)) { later.push(a); continue; }
        this.detach(a.node.id);
        const node = this.add(a.node, parent.id);
        const at = a.nextId !== null && a.nextId !== undefined ? parent.children.indexOf(a.nextId) : -1;
        if (at >= 0) parent.children.splice(at, 0, node.id);
        else parent.children.push(node.id);
        added.push(node.id);
      }
      if (later.length === pending.length) break;
      pending = later;
    }
    for (const t of m.texts) {
      const node = this.nodes.get(t.id);
      if (node) node.text = t.value ?? '';
    }
    for (const a of m.attributes) {
      const node = this.nodes.get(a.id);
      if (!node) continue;
      for (const [k, v] of Object.entries(a.attributes)) {
        const s = attrValue(v);
        if (s === null) delete node.attrs[k];
        else node.attrs[k] = s;
      }
    }
    // Outermost first: drop added nodes whose ancestor was added in the same batch.
    const set = new Set(added);
    const outer = added.filter((id) => {
      for (let p = this.nodes.get(id)?.parent ?? null; p !== null; p = this.nodes.get(p)?.parent ?? null) if (set.has(p)) return false;
      return true;
    });
    return { added: outer, removed };
  }

  get(id: number | null | undefined): VNode | undefined {
    return id === null || id === undefined ? undefined : this.nodes.get(id);
  }

  attached(id: number): boolean {
    let n = this.nodes.get(id);
    while (n) {
      if (n.id === this.root) return true;
      n = n.parent === null ? undefined : this.nodes.get(n.parent);
    }
    return false;
  }

  /** Is `id` inside (or equal to) `ancestor`? */
  within(id: number, ancestor: number): boolean {
    for (let n = this.nodes.get(id); n; n = n.parent === null ? undefined : this.nodes.get(n.parent)) if (n.id === ancestor) return true;
    return false;
  }

  ancestors(id: number): VNode[] {
    const out: VNode[] = [];
    for (let n = this.get(this.get(id)?.parent); n; n = this.get(n.parent)) out.push(n);
    return out;
  }

  elementChildren(node: VNode): VNode[] {
    return node.children.map((c) => this.nodes.get(c)!).filter((c) => c && c.type === ELEMENT);
  }

  find(pred: (n: VNode) => boolean, from = this.root): VNode | undefined {
    const start = this.get(from);
    if (!start) return undefined;
    const stack = [start];
    while (stack.length) {
      const n = stack.pop()!;
      if (pred(n)) return n;
      for (let i = n.children.length - 1; i >= 0; i--) stack.push(this.nodes.get(n.children[i])!);
    }
    return undefined;
  }

  body(): VNode | undefined {
    return this.find((n) => n.type === ELEMENT && n.tag === 'body');
  }

  /** The document's title. */
  title(): string {
    const t = this.find((n) => n.type === ELEMENT && n.tag === 'title');
    return t ? this.textOf(t, true).trim() : '';
  }

  /** The text an element shows (whitespace collapsed), skipping scripts and styles; `all` reads silent tags too. */
  textOf(node: VNode, all = false): string {
    const parts: string[] = [];
    const walk = (n: VNode) => {
      if (n.type === TEXT) parts.push(n.text);
      else if (n.type === ELEMENT || n.type === DOC) {
        if (!all && SILENT.has(n.tag)) return;
        if (n.tag === 'input' || n.tag === 'textarea') return;
        for (const c of n.children) walk(this.nodes.get(c)!);
      }
    };
    walk(node);
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  }

  /** Element-child indices from <body> down to `id` (null when it isn't under the body). */
  path(id: number): number[] | null {
    const body = this.body();
    if (!body) return null;
    const out: number[] = [];
    let n = this.get(id);
    while (n && n.id !== body.id) {
      const parent = this.get(n.parent);
      if (!parent) return null;
      out.unshift(this.elementChildren(parent).findIndex((c) => c.id === n!.id));
      n = parent;
    }
    return n ? out : null;
  }

  /** Every element under `node` (itself included), depth first. */
  elements(node: VNode): VNode[] {
    const out: VNode[] = [];
    const walk = (n: VNode) => {
      if (n.type !== ELEMENT) return;
      out.push(n);
      for (const c of n.children) walk(this.nodes.get(c)!);
    };
    walk(node);
    return out;
  }
}

export const isElement = (n: VNode | undefined): n is VNode => !!n && n.type === ELEMENT;

/** The element at `path` (from `vdom.path`) in a real document, e.g. a replayed page's. */
export function elementAtPath(doc: Document, path: readonly number[]): Element | null {
  let el: Element | null = doc.body;
  for (const i of path) {
    el = el?.children[i] ?? null;
    if (!el) return null;
  }
  return el;
}
