import {
  Children, createContext, isValidElement, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef,
  useState, useSyncExternalStore, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactElement,
  type ReactNode,
} from 'react';
import { Dialog as AriaDialog, Modal, ModalOverlay } from 'react-aria-components';
import { UNSAFE_PortalProvider } from 'react-aria/PortalProvider';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { AnimatedHeight, ContentSwap } from './animated-height';
import { IconSwap } from './icon-swap';
import { Kbd } from './kbd';
import { Haptics } from '../lib/haptics';
import { Icon } from '../lib/icon';
import { fades, springs } from '../lib/motion';
import { overlayZ, selectableText } from '../lib/primitives';
import { cn } from '../lib/utils';

/* ══ CommandMenu — a cmdk-style palette on react-aria ══
   <CommandMenu variant="dialog" isOpen={open} onOpenChange={setOpen} hotkey="mod+k" aria-label="Command menu">
     <CommandInput placeholder="Search commands…" />
     <CommandList>
       <CommandEmpty>No results</CommandEmpty>
       <CommandPage id="root">
         <CommandGroup heading="Actions">
           <CommandItem icon="square-pencil" title="New thread" shortcut="⇧⌘O" onSelect={…} />
           <CommandItem icon="folder-plus" title="New thread in…" page="projects" />
         </CommandGroup>
       </CommandPage>
       <CommandPage id="projects" numbered>…</CommandPage>
     </CommandList>
     <CommandFooter />
   </CommandMenu>

   The input keeps DOM focus the whole time; the active item is virtual (aria-activedescendant), so typing,
   arrows and Enter never fight over focus. react-aria supplies the modal (focus trap, focus return, portal,
   aria-modal) and the Keyboard slot of Kbd; the list, filtering and page stack are this file's, because the
   palette needs things react-aria's Autocomplete does not expose: a readable active item (⌘1–9, previews),
   scored fuzzy ranking with highlight ranges, grid sections, and a page stack that restores each page's query.

   Keyboard (input focused):
     ↑ ↓ / Ctrl+P Ctrl+N / Ctrl+K Ctrl+J   move, wrapping at the ends (`loop`)
     Alt+↑ Alt+↓                            previous / next group
     Home End, PageUp PageDown              first / last, ±5
     ← → (grid groups)                      move within a `columns` group; ↑ ↓ move a row
     Enter                                  select (a `page` item pushes its page)
     ⌘1–⌘9 (Ctrl on other platforms)        select the Nth visible item
     Backspace on an empty input            back one page — a fresh press only, so holding Backspace to clear
                                            the query stops at empty instead of popping pages
     Esc                                    clears a typed query first; otherwise closes the whole menu from any
                                            depth (the footer's "Esc Close"). escapeBehavior="pop" steps back a
                                            page before closing instead.
   A page's own `onKeyDown` runs first; preventDefault() there to take over a key.
   Pointer: moving the mouse over an item makes it active (moves only — a list scrolling under a resting cursor
   does not steal the keyboard's item); clicking selects without taking focus from the input. ══ */

/* ── Fuzzy matching ── */

export interface CommandMatch {
  /** 0 (no match) … 1 (exact). */
  score: number;
  /** Matched character indices in the text, for highlighting. */
  indices: number[];
}

const isBoundary = (t: string, i: number) => i === 0 || /[\s\-_/.:·@]/.test(t[i - 1]) || (t[i - 1] === t[i - 1].toLowerCase() && t[i] !== t[i].toLowerCase());

function matchToken(token: string, text: string): CommandMatch | null {
  const t = text.toLowerCase();
  const at = t.indexOf(token);
  if (at >= 0) {
    // A substring: best at the start, then at a word start, then anywhere.
    const indices = Array.from({ length: token.length }, (_, k) => at + k);
    const place = at === 0 ? 1 : isBoundary(text, at) ? 0.93 : 0.82;
    return { score: place - Math.min(0.08, (t.length - token.length) / 400), indices };
  }
  // A subsequence: every char in order; consecutive runs and word starts score higher.
  const indices: number[] = [];
  let from = 0, points = 0, prev = -2;
  for (const ch of token) {
    let found = -1;
    // Prefer the next word start carrying this char, else the next occurrence.
    for (let i = from; i < t.length; i++) if (t[i] === ch && isBoundary(text, i)) { found = i; break; }
    const plain = t.indexOf(ch, from);
    if (found < 0 || (plain >= 0 && plain === prev + 1)) found = plain;
    if (found < 0) return null;
    points += found === prev + 1 ? 1 : isBoundary(text, found) ? 0.8 : 0.35;
    indices.push(found);
    prev = found;
    from = found + 1;
  }
  return { score: Math.max(0.05, 0.7 * (points / token.length) - Math.min(0.1, (indices[indices.length - 1] - indices[0]) / 300)), indices };
}

/** Scores `query` against `text`: every whitespace-separated token must match (a substring, else a fuzzy
 *  subsequence). Returns null when it doesn't match; an empty query matches everything with score 1. */
export function commandMatch(query: string, text: string): CommandMatch | null {
  const tokens = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!tokens.length) return { score: 1, indices: [] };
  let score = 0;
  const all = new Set<number>();
  for (const tok of tokens) {
    const m = matchToken(tok, text);
    if (!m) return null;
    score += m.score;
    m.indices.forEach((i) => all.add(i));
  }
  return { score: score / tokens.length, indices: [...all].sort((a, b) => a - b) };
}

/** `text` with the characters `query` matched wrapped in <mark>. */
export function CommandHighlight({ text, query, className }: { text: string; query?: string; className?: string }) {
  const ctx = useContext(MenuCtx);
  const q = query ?? ctx?.query ?? '';
  const m = q ? commandMatch(q, text) : null;
  if (!m || !m.indices.length) return <>{text}</>;
  const hit = new Set(m.indices);
  const out: ReactNode[] = [];
  let run = '', on = false;
  const flush = (k: number) => {
    if (!run) return;
    out.push(on ? <mark key={k} data-slot="command-highlight" className={cn('bg-transparent font-semibold text-foreground', className)}>{run}</mark> : run);
    run = '';
  };
  for (let i = 0; i < text.length; i++) {
    const h = hit.has(i);
    if (h !== on) { flush(i); on = h; }
    run += text[i];
  }
  flush(text.length);
  return <>{out}</>;
}

/* ── Store: items, the active item, visibility — outside React state so hover re-renders two rows, not all ── */

interface ItemRecord {
  id: string;
  domId: string;
  page: string;
  group: string | null;
  value: string;
  score: number;
  disabled: boolean;
  el: HTMLElement | null;
  select: () => void;
}

interface GroupRecord { el: HTMLElement | null; columns: number }
interface PageRecord { placeholder?: string; title?: string; onKeyDown?: (e: ReactKeyboardEvent) => void }

type Source = 'keyboard' | 'pointer' | 'auto';

function createStore() {
  const listeners = new Set<() => void>();
  const s = {
    items: new Map<string, ItemRecord>(),
    groups: new Map<string, GroupRecord>(),
    pages: new Map<string, PageRecord>(),
    visible: [] as string[],
    active: null as string | null,
    source: 'auto' as Source,
    page: 'root',
    query: '',
    /** The query / page the active item was last reset for. */
    seen: '',
    /** Restores the item that pushed a page when it pops (by value: the page's items remount with new ids). */
    restore: null as string | null,
    scroller: null as HTMLElement | null,
    version: 0,
    queued: false,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
    emit() { s.version++; listeners.forEach((fn) => fn()); },
    setActive(id: string | null, source: Source) {
      if (s.active === id) return;
      s.active = id;
      s.source = source;
      s.emit();
      if (source === 'keyboard') s.reveal();
    },
    /** Brings the active item into view; the first item of a group brings its heading along. */
    reveal() {
      const rec = s.active ? s.items.get(s.active) : null;
      if (!rec?.el) return;
      if (s.visible[0] === rec.id && s.scroller) { s.scroller.scrollTop = 0; return; }
      const g = rec.group ? s.groups.get(rec.group) : null;
      const firstInGroup = rec.group && s.visible.find((id) => s.items.get(id)?.group === rec.group) === rec.id;
      if (firstInGroup && g?.el) g.el.scrollIntoView({ block: 'nearest' });
      rec.el.scrollIntoView({ block: 'nearest' });
    },
    /** Recomputes the visible, ordered items of the current page and keeps the active item valid. */
    reconcile() {
      s.queued = false;
      const recs = [...s.items.values()].filter((r) => r.page === s.page && r.score > 0 && r.el?.isConnected);
      const dom = new Map<ItemRecord, number>();
      recs.sort((a, b) => (a.el!.compareDocumentPosition(b.el!) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      recs.forEach((r, i) => dom.set(r, i));
      // Within a group, items rank by score while filtering (the group's CSS `order` matches this).
      const groupStart = new Map<string, number>();
      for (const r of recs) if (r.group && !groupStart.has(r.group)) groupStart.set(r.group, dom.get(r)!);
      const filtering = !!s.query.trim();
      recs.sort((a, b) => {
        const ga = a.group ? groupStart.get(a.group)! : dom.get(a)!;
        const gb = b.group ? groupStart.get(b.group)! : dom.get(b)!;
        if (ga !== gb) return ga - gb;
        if (filtering && a.score !== b.score) return b.score - a.score;
        return dom.get(a)! - dom.get(b)!;
      });
      const visible = recs.map((r) => r.id);
      const changed = visible.length !== s.visible.length || visible.some((id, i) => id !== s.visible[i]);
      if (changed) s.visible = visible;
      const key = s.page + '\u0000' + s.query;
      const enabled = visible.filter((id) => !s.items.get(id)!.disabled);
      let next = s.active;
      if (key !== s.seen) {
        // A new query or page starts at the top — or, popping, at the item that pushed.
        const back = s.restore !== null ? enabled.find((id) => s.items.get(id)!.value === s.restore) : undefined;
        next = back ?? enabled[0] ?? null;
        s.restore = null;
        s.seen = key;
      } else if (!next || !enabled.includes(next)) next = enabled[0] ?? null;
      if (next !== s.active) {
        s.active = next;
        s.source = 'auto';
        s.emit();
        requestAnimationFrame(() => s.reveal());
      } else if (changed) s.emit();
    },
    queue() {
      if (s.queued) return;
      s.queued = true;
      queueMicrotask(() => s.queued && s.reconcile());
    },
  };
  return s;
}
type Store = ReturnType<typeof createStore>;

function useStoreValue<T>(store: Store, pick: (s: Store) => T): T {
  return useSyncExternalStore(store.subscribe, () => pick(store), () => pick(store));
}

/* ── Context ── */

interface PageEntry { id: string; query: string; active: string | null; scroll: number }

export interface CommandMenuApi {
  /** The current input text. */
  query: string;
  setQuery: (q: string) => void;
  /** The current page id ('root' at the bottom of the stack). */
  page: string;
  /** Page ids from the root to the current page. */
  pages: string[];
  /** 0 at the root. */
  depth: number;
  /** Pushes a page (the query clears; it comes back when the page pops). */
  push: (page: string) => void;
  /** Pops one page; false at the root. */
  pop: () => boolean;
  /** Closes the menu (dialog: onOpenChange(false); inline: onOpenChange/onClose). */
  close: () => void;
  /** Moves the active item by `delta` visible items (wrapping when `loop`). */
  move: (delta: number) => void;
  /** Selects the active item, or the item with this `value`. */
  select: (value?: string) => void;
}

interface MenuContext extends CommandMenuApi {
  store: Store;
  menuId: string;
  listId: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  direction: -1 | 0 | 1;
  loop: boolean;
  closeOnSelect: boolean;
  filter: boolean;
  onKeyDown: (e: ReactKeyboardEvent) => void;
}

const MenuCtx = createContext<MenuContext | null>(null);
const PageCtx = createContext<{ id: string; filter: boolean | null; numbered: boolean }>({ id: 'root', filter: null, numbered: false });
const GroupCtx = createContext<{ id: string; columns: number } | null>(null);

function useMenu(part: string): MenuContext {
  const ctx = useContext(MenuCtx);
  if (!ctx) throw new Error(`<${part}> must be used within <CommandMenu>`);
  return ctx;
}

/** The menu's state and actions, from inside a CommandMenu (pages, custom rows, footers). */
export function useCommandMenu(): CommandMenuApi {
  const m = useMenu('useCommandMenu');
  return { query: m.query, setQuery: m.setQuery, page: m.page, pages: m.pages, depth: m.depth, push: m.push, pop: m.pop, close: m.close, move: m.move, select: m.select };
}

/** The active item's `value` (null when nothing is active) — for preview panes. */
export function useCommandActive(): string | null {
  const { store } = useMenu('useCommandActive');
  return useStoreValue(store, (s) => (s.active ? (s.items.get(s.active)?.value ?? null) : null));
}

/* ── Hotkeys ── */

const isMac = () => typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

/** Does a keyboard event match a hotkey like 'mod+k', 'shift+mod+o', 'alt+shift+mod+t'? `mod` is ⌘ on Apple
 *  platforms and Ctrl elsewhere. */
export function matchesHotkey(e: { key: string; code?: string; metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }, hotkey: string) {
  const parts = hotkey.toLowerCase().split('+');
  const key = parts.pop()!;
  const mac = isMac();
  const want = {
    meta: parts.includes('meta') || (mac && parts.includes('mod')),
    ctrl: parts.includes('ctrl') || (!mac && parts.includes('mod')),
    alt: parts.includes('alt'),
    shift: parts.includes('shift'),
  };
  if (e.metaKey !== want.meta || e.ctrlKey !== want.ctrl || e.altKey !== want.alt || e.shiftKey !== want.shift) return false;
  // Alt/Shift change e.key (⌥T → †), so letters and digits compare by physical key.
  const code = e.code ?? '';
  if (/^[a-z]$/.test(key)) return code ? code === `Key${key.toUpperCase()}` : e.key.toLowerCase() === key;
  if (/^[0-9]$/.test(key)) return code ? code === `Digit${key}` : e.key === key;
  return e.key.toLowerCase() === key;
}

/** Calls `handler` when `hotkey` is pressed anywhere in the document (while `enabled`). */
export function useHotkey(hotkey: string | undefined, handler: (e: KeyboardEvent) => void, enabled = true) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!hotkey || !enabled) return;
    const on = (e: KeyboardEvent) => {
      if (e.defaultPrevented || !matchesHotkey(e, hotkey)) return;
      e.preventDefault();
      ref.current(e);
    };
    document.addEventListener('keydown', on);
    return () => document.removeEventListener('keydown', on);
  }, [hotkey, enabled]);
}

/* ── CommandMenu ── */

export interface CommandMenuProps {
  /** `inline` renders in place; `dialog` is a react-aria modal near the top of the viewport. */
  variant?: 'inline' | 'dialog';
  /** Dialog visibility (and, inline, what Esc asks to close). */
  isOpen?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Toggles the dialog from anywhere, e.g. 'mod+k'. */
  hotkey?: string;
  /** Controlled query. */
  query?: string;
  onQueryChange?: (query: string) => void;
  /** Page ids to open on, below the root (['projects'] opens the projects page, with Back to the root). */
  defaultPages?: string[];
  /** Called whenever the page stack changes. */
  onPageChange?: (page: string, pages: string[]) => void;
  /** Arrow keys wrap from the last item to the first (default true). */
  loop?: boolean;
  /** Selecting an item without a `page` closes the menu (default: true for dialogs, false inline). */
  closeOnSelect?: boolean;
  /** 'close' (default): Esc clears a typed query, else closes from any depth. 'pop': Esc steps back a page first. */
  escapeBehavior?: 'close' | 'pop';
  /** Filter items by the query (default true). A page can opt out with `filter={false}`. */
  filter?: boolean;
  'aria-label'?: string;
  className?: string;
  style?: CSSProperties;
  /** Dialog scrim classes. */
  overlayClassName?: string;
  /** Where the dialog portals (default: BLProvider's root, else document.body). Pass an element inside a themed
   *  surface (a `display: contents` layer in a Workbench shell) so the palette keeps that surface's palette and
   *  its scrim covers that surface. */
  container?: Element | null;
  children?: ReactNode;
}

export function CommandMenu({
  variant = 'inline', isOpen: openProp, defaultOpen = false, onOpenChange, hotkey, query: queryProp, onQueryChange,
  defaultPages, onPageChange, loop = true, closeOnSelect, escapeBehavior = 'close', filter = true, 'aria-label': ariaLabel = 'Command menu',
  className, style, overlayClassName, container, children,
}: CommandMenuProps) {
  const [openState, setOpenState] = useState(defaultOpen);
  const open = openProp ?? openState;
  const setOpen = useCallback((o: boolean) => { if (openProp === undefined) setOpenState(o); onOpenChange?.(o); }, [openProp, onOpenChange]);
  useHotkey(variant === 'dialog' ? hotkey : undefined, () => setOpen(!open));

  const inner = (
    <CommandRoot
      variant={variant} open={open} setOpen={setOpen} queryProp={queryProp} onQueryChange={onQueryChange} defaultPages={defaultPages} onPageChange={onPageChange}
      loop={loop} closeOnSelect={closeOnSelect ?? variant === 'dialog'} escapeBehavior={escapeBehavior} filter={filter}
      ariaLabel={ariaLabel} className={className} style={variant === 'inline' ? style : undefined}
    >
      {children}
    </CommandRoot>
  );
  if (variant === 'inline') return inner;
  const modal = (
    <ModalOverlay
      data-slot="command-overlay"
      isOpen={open}
      onOpenChange={setOpen}
      isDismissable
      // Esc is the menu's own (it clears the query first).
      isKeyboardDismissDisabled
      className={cn(
        // Portals into BLProvider's root like Dialog, so the scrim covers the provider; the card hangs from the
        // top rather than centring, so its height can spring between pages without the input moving.
        'absolute inset-0 flex items-start justify-center bg-overlay px-4 pt-[min(14vh,120px)] data-entering:animate-bl-fade-in data-exiting:animate-bl-fade-out',
        overlayZ,
        overlayClassName,
      )}
    >
      <Modal
        data-slot="command-modal"
        className="w-full max-w-[600px] outline-none data-entering:animate-bl-pop-in data-exiting:animate-bl-pop-out motion-reduce:data-entering:animate-bl-fade-in motion-reduce:data-exiting:animate-bl-fade-out"
        style={style}
      >
        <AriaDialog aria-label={ariaLabel} className="outline-none">{inner}</AriaDialog>
      </Modal>
    </ModalOverlay>
  );
  return container ? <UNSAFE_PortalProvider getContainer={() => container as HTMLElement}>{modal}</UNSAFE_PortalProvider> : modal;
}

interface RootProps {
  variant: 'inline' | 'dialog';
  open: boolean;
  setOpen: (o: boolean) => void;
  queryProp?: string;
  onQueryChange?: (q: string) => void;
  defaultPages?: string[];
  onPageChange?: (page: string, pages: string[]) => void;
  loop: boolean;
  closeOnSelect: boolean;
  escapeBehavior: 'close' | 'pop';
  filter: boolean;
  ariaLabel: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

function CommandRoot({
  variant, setOpen, queryProp, onQueryChange, defaultPages, onPageChange, loop, closeOnSelect, escapeBehavior, filter, ariaLabel,
  className, style, children,
}: RootProps) {
  const [store] = useState(createStore);
  const menuId = useId();
  const listId = `${menuId}-list`;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [queryState, setQueryState] = useState('');
  const query = queryProp ?? queryState;
  const setQuery = useCallback((q: string) => { if (queryProp === undefined) setQueryState(q); onQueryChange?.(q); }, [queryProp, onQueryChange]);
  const [stack, setStack] = useState<PageEntry[]>(() =>
    ['root', ...(defaultPages ?? [])].map((id) => ({ id, query: '', active: null, scroll: 0 })));
  const [dir, setDir] = useState<-1 | 0 | 1>(0);
  const page = stack[stack.length - 1].id;
  store.page = page;
  store.query = filter ? query : '';

  const pageChange = useRef(onPageChange);
  pageChange.current = onPageChange;
  const pages = useMemo(() => stack.map((p) => p.id), [stack]);
  useEffect(() => { pageChange.current?.(page, pages); }, [page, pages]);

  // Every render (a keystroke, a page change) re-ranks after the items have reported their scores.
  useLayoutEffect(() => store.reconcile());

  const push = useCallback((id: string) => {
    Haptics.selection();
    const scroll = store.scroller?.scrollTop ?? 0;
    setStack((st) => [...st.slice(0, -1), { ...st[st.length - 1], query, active: store.active ? (store.items.get(store.active)?.value ?? null) : null, scroll }, { id, query: '', active: null, scroll: 0 }]);
    setDir(1);
    setQuery('');
    if (store.scroller) store.scroller.scrollTop = 0;
    inputRef.current?.focus();
  }, [query, setQuery, store]);

  const stackRef = useRef(stack);
  stackRef.current = stack;
  const pop = useCallback(() => {
    const st = stackRef.current;
    if (st.length < 2) return false;
    Haptics.selection();
    const parent = st[st.length - 2];
    store.restore = parent.active;
    setStack(st.slice(0, -1));
    setDir(-1);
    setQuery(parent.query);
    requestAnimationFrame(() => { if (store.scroller) store.scroller.scrollTop = parent.scroll; });
    inputRef.current?.focus();
    return true;
  }, [setQuery, store]);

  const close = useCallback(() => setOpen(false), [setOpen]);

  const move = useCallback((delta: number, wrap: boolean = loop) => {
    const ids = store.visible.filter((id) => !store.items.get(id)!.disabled);
    if (!ids.length) return;
    const i = store.active ? ids.indexOf(store.active) : -1;
    let n = i < 0 ? (delta > 0 ? 0 : ids.length - 1) : i + delta;
    if (wrap && Math.abs(delta) === 1) n = (n + ids.length) % ids.length;
    else n = Math.max(0, Math.min(ids.length - 1, n));
    store.setActive(ids[n], 'keyboard');
  }, [loop, store]);

  const select = useCallback((value?: string) => {
    const rec = value === undefined ? (store.active ? store.items.get(store.active) : undefined)
      : [...store.items.values()].find((r) => r.page === store.page && r.value === value);
    if (rec && !rec.disabled) rec.select();
  }, [store]);

  const onKeyDown = useCallback((e: ReactKeyboardEvent) => {
    if (e.nativeEvent.isComposing) return;
    store.pages.get(store.page)?.onKeyDown?.(e);
    if (e.defaultPrevented) return;
    const mod = isMac() ? e.metaKey : e.ctrlKey;
    const ids = store.visible;
    const active = store.active ? store.items.get(store.active) : undefined;
    const cols = active?.group ? (store.groups.get(active.group)?.columns ?? 1) : 1;
    const handled = () => { e.preventDefault(); e.stopPropagation(); };

    // Grid groups: ← → step, ↑ ↓ move a row (leaving the grid at its edges).
    if (cols > 1 && active && !e.altKey && !mod && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      const inGroup = ids.filter((id) => store.items.get(id)!.group === active.group);
      const i = inGroup.indexOf(active.id);
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const n = i + (e.key === 'ArrowRight' ? 1 : -1);
        if (n >= 0 && n < inGroup.length) store.setActive(inGroup[n], 'keyboard');
        return handled();
      }
      const down = e.key === 'ArrowDown';
      const n = i + (down ? cols : -cols);
      if (n >= 0 && n < inGroup.length) { store.setActive(inGroup[n], 'keyboard'); return handled(); }
      // A partial last row: ↓ from above it lands on its last item.
      if (down && Math.floor(i / cols) < Math.floor((inGroup.length - 1) / cols)) { store.setActive(inGroup[inGroup.length - 1], 'keyboard'); return handled(); }
      const edge = down ? inGroup[inGroup.length - 1] : inGroup[0];
      store.setActive(edge, 'auto');
      move(down ? 1 : -1);
      return handled();
    }

    if (e.key === 'ArrowDown' || (e.ctrlKey && (e.key === 'n' || e.key === 'j'))) {
      if (e.altKey) jumpGroup(1); else move(1);
      return handled();
    }
    if (e.key === 'ArrowUp' || (e.ctrlKey && (e.key === 'p' || e.key === 'k'))) {
      if (e.altKey) jumpGroup(-1); else move(-1);
      return handled();
    }
    if (e.key === 'Home' || e.key === 'End') {
      const en = ids.filter((id) => !store.items.get(id)!.disabled);
      if (en.length) store.setActive(e.key === 'Home' ? en[0] : en[en.length - 1], 'keyboard');
      return handled();
    }
    if (e.key === 'PageDown' || e.key === 'PageUp') { move(e.key === 'PageDown' ? 5 : -5, false); return handled(); }
    if (e.key === 'Enter') {
      if (active) { handled(); select(); }
      return;
    }
    if (mod && !e.altKey && !e.shiftKey && /^[1-9]$/.test(e.key)) {
      const rec = store.items.get(ids[Number(e.key) - 1]);
      if (rec) {
        handled();
        store.setActive(rec.id, 'keyboard');
        if (!rec.disabled) rec.select();
      }
      return;
    }
    if (e.key === 'Backspace' && !e.repeat && stackRef.current.length > 1) {
      const input = inputRef.current;
      if (!input || input.value === '') { if (pop()) handled(); }
      return;
    }
    if (e.key === 'Escape') {
      handled();
      if (inputRef.current?.value) { setQuery(''); return; }
      if (escapeBehavior === 'pop' && pop()) return;
      close();
    }

    function jumpGroup(delta: 1 | -1) {
      const en = ids.filter((id) => !store.items.get(id)!.disabled);
      if (!en.length) return;
      const group = active?.group ?? null;
      const i = active ? en.indexOf(active.id) : -1;
      if (delta > 0) {
        const next = en.slice(i + 1).find((id) => store.items.get(id)!.group !== group);
        store.setActive(next ?? en[en.length - 1], 'keyboard');
      } else {
        // Start of this group, or — already there — the start of the previous one.
        const g = (id: string) => store.items.get(id)!.group;
        let k = i;
        while (k > 0 && g(en[k - 1]) === group && group !== null) k--;
        if (k === i && k > 0) { const pg = g(en[k - 1]); k--; while (k > 0 && g(en[k - 1]) === pg && pg !== null) k--; }
        store.setActive(en[Math.max(0, k)], 'keyboard');
      }
    }
  }, [store, move, select, pop, setQuery, close, escapeBehavior]);

  const ctx: MenuContext = {
    store, menuId, listId, inputRef, direction: dir, loop, closeOnSelect, filter, onKeyDown,
    query, setQuery, page, pages, depth: stack.length - 1, push, pop, close, move, select,
  };

  return (
    <MenuCtx.Provider value={ctx}>
      <div
        data-slot="command-menu"
        data-variant={variant}
        data-depth={stack.length - 1}
        aria-label={variant === 'inline' ? ariaLabel : undefined}
        role={variant === 'inline' ? 'group' : undefined}
        onKeyDown={onKeyDown}
        className={cn(
          // --command-surface is the card's fill; sticky group headings share it. Override it (not bg-*) to recolour.
          'relative box-border flex w-full min-w-0 flex-col overflow-hidden bg-(--command-surface) text-popover-foreground [--command-surface:var(--popover)]',
          variant === 'dialog'
            ? 'max-h-[min(640px,calc(100dvh-160px))] rounded-[18px] shadow-[0_24px_80px_--alpha(black/35%),0_0_0_.5px_var(--border)]'
            : 'rounded-[14px] shadow-[0_0_0_.5px_var(--border)]',
          className,
        )}
        style={style}
      >
        {children}
      </div>
    </MenuCtx.Provider>
  );
}

/* ── CommandInput ── */

export interface CommandInputProps extends Omit<React.ComponentProps<'input'>, 'value' | 'onChange' | 'children'> {
  /** Placeholder at the root; pages below it use their own `placeholder`, else "Search…". */
  placeholder?: string;
  /** Show a back arrow in place of the search icon on pages below the root (default true). */
  backButton?: boolean;
  /** Show the current page's `title` as a chip before the input (default true). */
  pageTitle?: boolean;
  /** Content after the input (a spinner, a hint). */
  trailing?: ReactNode;
}

export function CommandInput({ placeholder = 'Search…', backButton = true, pageTitle = true, trailing, className, autoFocus = true, ...props }: CommandInputProps) {
  const ctx = useMenu('CommandInput');
  const { store, inputRef, listId, menuId, query, setQuery, depth, pop } = ctx;
  const meta = useStoreValue(store, (s) => s.pages.get(s.page));
  const activeDom = useStoreValue(store, (s) => (s.active ? s.items.get(s.active)?.domId : undefined));
  const reduced = useReducedMotion();
  const ph = meta?.placeholder ?? (depth > 0 ? 'Search…' : placeholder);
  const back = backButton && depth > 0;
  return (
    <div data-slot="command-input-wrapper" className="flex h-[52px] shrink-0 items-center gap-2.5 px-4">
      {back ? (
        <button
          type="button"
          data-slot="command-back"
          aria-label="Back"
          tabIndex={-1}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => pop()}
          className="-m-1.5 grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg border-0 bg-transparent p-0 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <IconSwap id="back"><Icon name="arrow-left" size={18} sw={2} /></IconSwap>
        </button>
      ) : (
        <span aria-hidden="true" className="-m-1.5 grid size-8 shrink-0 place-items-center text-muted-foreground">
          <IconSwap id="search"><Icon name="magnifier" size={18} sw={1.8} /></IconSwap>
        </span>
      )}
      <AnimatePresence initial={false} mode="popLayout">
        {pageTitle && depth > 0 && meta?.title ? (
          <motion.span
            key={meta.title}
            data-slot="command-page-title"
            initial={reduced ? { opacity: 0 } : { opacity: 0, x: 8, filter: 'blur(3px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, transition: fades.out }}
            transition={reduced ? { duration: 0.12 } : { x: springs.smooth, default: fades.in }}
            className="inline-flex h-6 shrink-0 items-center rounded-md bg-secondary px-2 text-[12.5px] font-medium whitespace-nowrap text-secondary-foreground"
          >
            {meta.title}
          </motion.span>
        ) : null}
      </AnimatePresence>
      <input
        ref={inputRef}
        id={`${menuId}-input`}
        data-slot="command-input"
        type="text"
        role="combobox"
        aria-expanded
        aria-controls={listId}
        aria-activedescendant={activeDom}
        aria-autocomplete="list"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        autoFocus={autoFocus}
        placeholder={ph}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={cn(
          'h-full min-w-0 flex-1 border-0 bg-transparent p-0 font-[inherit] text-[16px] text-foreground outline-none placeholder:text-tertiary-foreground',
          selectableText,
          className,
        )}
        {...props}
      />
      {trailing}
    </div>
  );
}

/* ── CommandList / CommandPage ── */

export interface CommandListProps {
  /** CommandPage elements (only the current one renders) and anything shared by every page (CommandEmpty).
   *  Or a function of the current page id. */
  children?: ReactNode | ((page: string) => ReactNode);
  /** Height the list scrolls past (default 360px). */
  maxHeight?: number | string;
  'aria-label'?: string;
  className?: string;
}

/** The scrolling results. Its height springs between pages and as filtering shrinks the list; pages slide in
 *  the direction of travel (push → from the right, pop → from the left). */
export function CommandList({ children, maxHeight = 360, 'aria-label': ariaLabel = 'Results', className }: CommandListProps) {
  const { store, listId, page, direction } = useMenu('CommandList');
  const content = typeof children === 'function'
    ? children(page)
    : Children.map(children, (child) => (isValidElement(child) && child.type === CommandPage && (child as ReactElement<CommandPageProps>).props.id !== page ? null : child));
  return (
    <AnimatedHeight spring="tray" className="shrink-0">
      <div
        ref={(el) => { store.scroller = el; }}
        id={listId}
        role="listbox"
        aria-label={ariaLabel}
        data-slot="command-list"
        className={cn('bl-scroll relative overflow-x-hidden overflow-y-auto overscroll-contain scroll-pt-9 scroll-pb-2', className)}
        style={{ maxHeight }}
      >
        <ContentSwap id={page} direction={direction} distance={28}>
          <div className="flex flex-col px-2 pb-2">{content}</div>
        </ContentSwap>
      </div>
    </AnimatedHeight>
  );
}

export interface CommandPageProps {
  /** 'root' for the first page. */
  id: string;
  /** Input placeholder while this page is open. */
  placeholder?: string;
  /** Chip shown before the input while this page is open. */
  title?: string;
  /** Filter this page's items by the query (default: the menu's `filter`). Off for computed results (a calculator). */
  filter?: boolean;
  /** Show ⌘1–⌘9 on the first nine visible items (⌘N selects them either way). */
  numbered?: boolean;
  /** Runs before the menu's keys; preventDefault() to take a key over. */
  onKeyDown?: (e: ReactKeyboardEvent) => void;
  children?: ReactNode;
}

export function CommandPage({ id, placeholder, title, filter, numbered = false, onKeyDown, children }: CommandPageProps) {
  const { store, filter: menuFilter } = useMenu('CommandPage');
  const keyRef = useRef(onKeyDown);
  keyRef.current = onKeyDown;
  useLayoutEffect(() => {
    store.pages.set(id, { placeholder, title, onKeyDown: (e) => keyRef.current?.(e) });
    store.emit();
    return () => { store.pages.delete(id); store.emit(); };
  }, [store, id, placeholder, title]);
  const value = useMemo(() => ({ id, filter: filter ?? menuFilter, numbered }), [id, filter, menuFilter, numbered]);
  return <PageCtx.Provider value={value}>{children}</PageCtx.Provider>;
}

/* ── CommandGroup ── */

export interface CommandGroupProps {
  heading?: ReactNode;
  /** Lay the items out as a grid; ← → move within it and ↑ ↓ move a row. */
  columns?: number;
  /** Keep the group visible even with no matching items. */
  forceMount?: boolean;
  className?: string;
  children?: ReactNode;
}

export function CommandGroup({ heading, columns = 1, forceMount, className, children }: CommandGroupProps) {
  const { store } = useMenu('CommandGroup');
  const id = useId();
  const headingId = `${id}-heading`;
  const ref = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    store.groups.set(id, { el: ref.current, columns });
    return () => { store.groups.delete(id); };
  }, [store, id, columns]);
  const count = useStoreValue(store, (s) => s.visible.reduce((n, v) => n + (s.items.get(v)?.group === id ? 1 : 0), 0));
  const ctx = useMemo(() => ({ id, columns }), [id, columns]);
  // Items stay mounted while hidden (they keep scoring the query), so the group only hides.
  const hidden = !forceMount && count === 0;
  return (
    <div ref={ref} role="group" aria-labelledby={heading ? headingId : undefined} data-slot="command-group" hidden={hidden} className={cn('pt-1', className)}>
      {heading ? (
        <div id={headingId} data-slot="command-group-heading" aria-hidden="true" className="sticky top-0 z-1 bg-(--command-surface) px-3 pt-2 pb-1.5 text-[12.5px] font-medium text-muted-foreground">
          {heading}
        </div>
      ) : null}
      <GroupCtx.Provider value={ctx}>
        <div
          data-slot="command-group-items"
          className={columns > 1 ? 'grid gap-1' : 'flex flex-col'}
          style={columns > 1 ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` } : undefined}
        >
          {children}
        </div>
      </GroupCtx.Provider>
    </div>
  );
}

/* ── CommandItem ── */

export interface CommandItemProps {
  /** Identity and search text (default: `title` when it is a string). */
  value?: string;
  /** Extra search terms. */
  keywords?: string[];
  /** Leading icon: an Icon name or any node (a monogram, an image). */
  icon?: string | ReactNode;
  title?: ReactNode;
  /** Second line (a path, an id). Searchable when it is a string. */
  description?: ReactNode;
  /** Keycaps shown on the right: '⇧⌘O' (one cap per character) or an array of caps. */
  shortcut?: string | string[];
  /** Trailing node (a Badge); replaces the shortcut. */
  badge?: ReactNode;
  /** Pushes this page when selected; shows a chevron. */
  page?: string;
  /** Show a chevron (default: when `page` is set). */
  chevron?: boolean;
  /** Skipped by the keyboard, unselectable, dimmed. */
  disabled?: boolean;
  /** Dimmed but still selectable (an integration that needs setup). */
  dimmed?: boolean;
  onSelect?: (value: string) => void;
  /** Override the menu's `closeOnSelect` for this item. */
  closeOnSelect?: boolean;
  className?: string;
  /** Custom row content (replaces icon / title / description / trailing). */
  children?: ReactNode;
}

function Keycaps({ keys }: { keys: string | string[] }) {
  const caps = Array.isArray(keys) ? keys : [...keys];
  return (
    <span data-slot="command-shortcut" className="ml-auto inline-flex shrink-0 items-center gap-0.5 pl-3 text-[13px] text-muted-foreground">
      {caps.map((k, i) => <kbd key={i} className="min-w-3 text-center font-ios font-normal">{k}</kbd>)}
    </span>
  );
}

export function CommandItem({
  value: valueProp, keywords, icon, title, description, shortcut, badge, page: pushes, chevron, disabled = false, dimmed = false,
  onSelect, closeOnSelect, className, children,
}: CommandItemProps) {
  const menu = useMenu('CommandItem');
  const { store, menuId, query } = menu;
  const page = useContext(PageCtx);
  const group = useContext(GroupCtx);
  const id = useId();
  const domId = `${menuId}-item-${id.replace(/:/g, '')}`;
  const value = valueProp ?? (typeof title === 'string' ? title : id);
  const ref = useRef<HTMLDivElement | null>(null);

  const filtering = (page.filter ?? menu.filter) && query.trim() !== '';
  const score = useMemo(() => {
    if (!filtering) return 1;
    const texts: [string, number][] = [[value, 1], ...(keywords ?? []).map((k) => [k, 0.92] as [string, number])];
    if (typeof title === 'string' && title !== value) texts.push([title, 1]);
    if (typeof description === 'string') texts.push([description, 0.7]);
    let best = 0;
    for (const [t, w] of texts) { const m = commandMatch(query, t); if (m) best = Math.max(best, m.score * w); }
    return best;
  }, [filtering, query, value, keywords, title, description]);

  const selectRef = useRef<() => void>(() => {});
  selectRef.current = () => {
    if (disabled) return;
    if (pushes) { menu.push(pushes); onSelect?.(value); return; }
    Haptics.impact('light');
    onSelect?.(value);
    if (closeOnSelect ?? menu.closeOnSelect) menu.close();
  };

  useLayoutEffect(() => {
    const rec: ItemRecord = {
      id, domId, page: page.id, group: group?.id ?? null, value, score, disabled, el: ref.current, select: () => selectRef.current(),
    };
    store.items.set(id, rec);
    store.queue();
  });
  useLayoutEffect(() => () => { store.items.delete(id); store.queue(); }, [store, id]);

  const active = useStoreValue(store, (s) => s.active === id);
  const index = useStoreValue(store, (s) => (page.numbered ? s.visible.indexOf(id) : -1));
  if (score <= 0) return null;

  const trailing = badge ?? (shortcut ? <Keycaps keys={shortcut} /> : index >= 0 && index < 9 ? <Keycaps keys={['⌘', String(index + 1)]} /> : null);
  const showChevron = chevron ?? !!pushes;
  const grid = (group?.columns ?? 1) > 1;

  return (
    <div
      ref={ref}
      id={domId}
      role="option"
      aria-selected={active}
      aria-disabled={disabled || undefined}
      data-slot="command-item"
      data-active={active || undefined}
      data-disabled={disabled || undefined}
      data-dimmed={dimmed || undefined}
      data-value={value}
      // Keep the input focused; select on click.
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => { store.setActive(id, 'pointer'); selectRef.current(); }}
      onPointerMove={() => { if (!disabled && store.active !== id) store.setActive(id, 'pointer'); }}
      style={filtering && group ? { order: -Math.round(score * 1000) } : undefined}
      className={cn(
        'relative flex min-w-0 cursor-default items-center gap-3 rounded-[10px] px-3 text-[15px] text-foreground outline-none select-none',
        grid ? 'aspect-square justify-center p-0' : description ? 'min-h-[52px] py-1.5' : 'min-h-10 py-1',
        'transition-[background-color] duration-100 data-active:bg-accent',
        (disabled || dimmed) && 'text-muted-foreground',
        disabled && 'opacity-60',
        className,
      )}
    >
      {children ?? (
        <>
          {icon != null ? (
            <span data-slot="command-item-icon" className={cn('grid size-6 shrink-0 place-items-center text-muted-foreground', (disabled || dimmed) && 'opacity-60')}>
              {typeof icon === 'string' ? <Icon name={icon} size={19} sw={1.7} /> : icon}
            </span>
          ) : null}
          {title != null || description != null ? (
            <span className="flex min-w-0 flex-1 flex-col">
              <span data-slot="command-item-title" className="truncate leading-[20px]">
                {typeof title === 'string' && filtering ? <CommandHighlight text={title} /> : title}
              </span>
              {description != null ? (
                <span data-slot="command-item-description" className={cn('truncate text-[13px] leading-[18px] text-muted-foreground', (disabled || dimmed) && 'opacity-70')}>
                  {description}
                </span>
              ) : null}
            </span>
          ) : null}
          {trailing}
          {showChevron ? <Icon name="chevron-right" size={15} sw={2} className="ml-auto shrink-0 text-muted-foreground" /> : null}
        </>
      )}
    </div>
  );
}

/* ── CommandEmpty / CommandSeparator / CommandLoading ── */

/** Shown when a query matches nothing on the current page. */
export function CommandEmpty({ children = 'No results', className }: { children?: ReactNode; className?: string }) {
  const { store, query } = useMenu('CommandEmpty');
  const count = useStoreValue(store, (s) => s.visible.length);
  if (!query.trim() || count > 0) return null;
  return (
    <div data-slot="command-empty" role="presentation" className={cn('py-10 text-center text-[14px] text-muted-foreground', className)}>
      {children}
    </div>
  );
}

export function CommandSeparator({ className }: { className?: string }) {
  const { query } = useMenu('CommandSeparator');
  if (query.trim()) return null;
  return <div role="separator" data-slot="command-separator" className={cn('mx-3 my-1.5 h-px bg-border', className)} />;
}

/* ── CommandFooter ── */

export interface CommandLegendItem { keys: ReactNode[]; label: string }

export interface CommandFooterProps {
  /** Show the keyboard legend on the left (default true). */
  legend?: boolean | CommandLegendItem[];
  className?: string;
  /** Right-aligned content (a primary action, a hint). */
  children?: ReactNode;
}

/** The keyboard legend: ↑ ↓ Navigate, Enter Select, Backspace Back (below the root), Esc Close. */
export function CommandFooter({ legend = true, className, children }: CommandFooterProps) {
  const { depth } = useMenu('CommandFooter');
  const reduced = useReducedMotion();
  const items: (CommandLegendItem & { id: string })[] = Array.isArray(legend)
    ? legend.map((l, i) => ({ ...l, id: `${i}-${l.label}` }))
    : legend
      ? [
        { id: 'nav', keys: [<Icon key="u" name="arrow-up" size={12} sw={2.2} />, <Icon key="d" name="arrow-down" size={12} sw={2.2} />], label: 'Navigate' },
        { id: 'enter', keys: ['Enter'], label: 'Select' },
        ...(depth > 0 ? [{ id: 'back', keys: ['Backspace'], label: 'Back' }] : []),
        { id: 'esc', keys: ['Esc'], label: 'Close' },
      ]
      : [];
  return (
    <div
      data-slot="command-footer"
      onMouseDown={(e) => { if (!(e.target as HTMLElement).closest('button,a,input')) e.preventDefault(); }}
      className={cn('flex h-11 shrink-0 items-center gap-4 border-t border-border bg-secondary/40 px-3 text-[13px] text-muted-foreground', className)}
    >
      <AnimatePresence initial={false}>
        {items.map((it) => (
          <motion.span
            key={it.id}
            layout={reduced ? false : 'position'}
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9, filter: 'blur(3px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.9, transition: fades.out }}
            transition={reduced ? { duration: 0.12 } : { layout: springs.smooth, scale: springs.snappy, default: fades.in }}
            className="inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            {it.keys.map((k, i) => <Kbd key={i} className="h-6 min-w-6 rounded-md px-1.5 text-[12.5px] text-foreground">{k}</Kbd>)}
            <span>{it.label}</span>
          </motion.span>
        ))}
      </AnimatePresence>
      {children ? <div className="ml-auto flex items-center gap-2">{children}</div> : null}
    </div>
  );
}
