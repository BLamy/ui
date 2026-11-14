'use client';
import {
  createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore,
  type ComponentProps, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent,
  type ReactNode, type RefObject,
} from 'react';
import { nearestInDirection } from '@ui-sdk/core';
import {
  Command, CommandEmpty, CommandGroup, CommandGroupLabel, CommandInput, CommandItem, CommandItemIcon, CommandItemText, CommandList,
  CommandPage, CommandSeparator, CommandShortcut, CommandStatus, createCommandController,
  type CommandController, type CommandDataItem, type CommandItemState, type CommandListState, type CommandPagesChangeReason,
  type CommandProps, type ListSeparator, type SearchFilter,
} from '@ui-sdk/react/command';
import { DialogContent } from '@ui-sdk/react/dialog';
import { Dialog, DialogBackdrop, DialogTrigger, createDialogController, type DialogProps } from '@/components/ui/dialog';
import { registerShortcut } from '@ui-sdk/react/shortcuts';
import { AnimatedHeight } from '@/components/ui/animated-height';
import { Button } from '@/components/ui/button';
import { IconSwap } from '@/components/ui/icon-swap';
import { Kbd } from '@/components/ui/kbd';
import { Icon } from '@/lib/icon';
import { selectableText } from '@/lib/primitives';
import { scopeStyle, useThemeScopeProps } from '@/lib/theme';
import { cn, cx } from '@/lib/utils';

/* ══ CommandMenu — UI SDK's Command with the kit's palette look ══
   <CommandMenuDialog>
     <CommandMenuDialogTrigger shortcut="mod+k" className={buttonVariants({ variant: 'secondary' })}>Search…</CommandMenuDialogTrigger>
     <CommandMenuDialogContent aria-label="Command menu">
       <CommandMenu onAction={run}>
         <CommandMenuInput placeholder="Search commands…" />
         <CommandMenuEmpty>No results</CommandMenuEmpty>
         <CommandMenuList>
           <CommandMenuPage>
             <CommandMenuGroup>
               <CommandMenuGroupLabel>Actions</CommandMenuGroupLabel>
               <CommandMenuItem value="new-thread" icon="square-pencil" title="New thread" shortcut="mod+shift+o" />
               <CommandMenuItem value="new-thread-in" icon="folder-plus" title="New thread in…" page="projects" />
             </CommandMenuGroup>
           </CommandMenuPage>
           <CommandMenuPage value="projects" title="Projects" numbered>…</CommandMenuPage>
         </CommandMenuList>
         <CommandMenuFooter />
       </CommandMenu>
     </CommandMenuDialogContent>
   </CommandMenuDialog>

   Leave the dialog parts out and the same CommandMenu renders in place.

   UI SDK owns the behavior. The input keeps focus while `aria-activedescendant` follows the highlighted command;
   typing filters with its fuzzy scorer and highlights the best match; ↑ ↓ move (wrapping unless `loop={false}`),
   ⌘↑ ⌘↓ jump to the ends, PageUp PageDown step ten; Enter runs the command (`onSelect`, then `onAction`, or its
   `page`); Backspace in the empty field goes back a page and puts its search text back; Esc clears the search,
   then goes back a page, then closes the dialog. A command's `shortcut` runs it while the list is mounted, and
   `status` with CommandMenuStatus reports async results. The dialog brings the focus trap, dismissal, focus
   return and presence; a command that runs closes it (`closeOnSelect`).

   On top of that the kit adds the bar (search icon or back button, the page's title chip), rows with an icon, a
   title, a description and a trailing slot, a keyboard legend, and four things a launcher needs: a page's own
   placeholder, filter and keys (CommandMenuPage); `columns` groups, where the arrows follow the grid;
   ⌘1–⌘9 (Ctrl elsewhere) for the first nine visible commands, shown on `numbered` pages; and the row you came
   from highlighted again when you go back.
   Commands written as children keep their order while filtering; pass them as `items` and UI SDK ranks them, best
   match first. ══ */

export { createCommandController as createCommandMenuController };
export type CommandMenuController = CommandController;

/* ── What the parts share ── */

type PageKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>, controller: CommandMenuController) => void;

interface PageSettings {
  title?: string;
  placeholder?: string;
  filter?: SearchFilter;
  numbered: boolean;
  keys: RefObject<PageKeyDown | undefined>;
}

/** What the list shows now, outside React state, so moving the highlight renders only the parts that read it. */
function createListView() {
  let value: string | null = null;
  let numbered: readonly string[] = [];
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach((listener) => listener());
  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    value: () => value,
    numbered: () => numbered,
    setValue(next: string | null) {
      if (next === value) return;
      value = next;
      emit();
    },
    setNumbered(next: readonly string[]) {
      if (next.length === numbered.length && next.every((key, i) => key === numbered[i])) return;
      numbered = next;
      emit();
    },
  };
}
type ListView = ReturnType<typeof createListView>;

/** The same for the life of the menu: parts that only call it never render again for a keystroke. */
interface MenuHandle {
  controller: CommandMenuController;
  view: ListView;
  list: RefObject<HTMLElement | null>;
  /** Commands that keep the dialog open, or close it, whatever the menu's `closeOnSelect`. */
  closes: Map<string, boolean>;
  setList: (el: HTMLElement | null) => void;
  setPage: (page: string | null, settings: PageSettings | null) => void;
  /** The key press of a ⌘1–⌘9 run in progress: the controller's `run()` takes no event, so `onAction` gets it from here. */
  running: RefObject<KeyboardEvent | null>;
}

interface MenuState {
  query: string;
  pages: string[];
  /** The current page's own settings, from its CommandMenuPage. */
  settings: PageSettings | undefined;
  loop: boolean;
}

const HandleContext = createContext<MenuHandle | null>(null);
const StateContext = createContext<MenuState | null>(null);
const PageContext = createContext(false);
const ColumnsContext = createContext(1);
type AnyDialogController = NonNullable<DialogProps['controller']>;
const DialogContext = createContext<AnyDialogController | null>(null);

function useHandle(part: string): MenuHandle {
  const handle = useContext(HandleContext);
  if (!handle) throw new Error(`<${part}> must be used within <CommandMenu>`);
  return handle;
}

function useMenuState(part: string): MenuState {
  const state = useContext(StateContext);
  if (!state) throw new Error(`<${part}> must be used within <CommandMenu>`);
  return state;
}

export interface CommandMenuState {
  /** The search text. */
  query: string;
  /** The stack of open pages, from the first one opened to the current one. Empty on the first page. */
  pages: string[];
  /** The current page, or `null` on the first page. */
  page: string | null;
  /** Drives the menu: `push` and `pop` pages, `setQuery`, `setValue` (the highlight), `run` a command, `focus`. */
  controller: CommandMenuController;
}

/** The surrounding menu's search text and pages, and its controller: for custom rows, bars and footers. */
export function useCommandMenu(): CommandMenuState {
  const { controller } = useHandle('useCommandMenu');
  const { query, pages } = useMenuState('useCommandMenu');
  return { query, pages, page: pages[pages.length - 1] ?? null, controller };
}

/** The highlighted command's `value`, or `null`: for preview panes and footers that follow the highlight. */
export function useCommandMenuValue(): string | null {
  const { view } = useHandle('useCommandMenuValue');
  return useSyncExternalStore(view.subscribe, view.value, view.value);
}

const ITEM = '[data-slot="command-item"]';

/** The commands a filter left in the list, in the order they show. */
const shownCommands = (list: HTMLElement) => [...list.querySelectorAll<HTMLElement>(`${ITEM}:not([hidden])`)];

const NO_PAGES: string[] = [];
const stackKey = (pages: string[]) => pages.join('\u0000');

const isThenable = (value: unknown): value is PromiseLike<unknown> =>
  typeof value === 'object' && value !== null && typeof (value as PromiseLike<unknown>).then === 'function';

/* ── CommandMenu ── */

/** A command as data, with what the kit's row shows beside its label. */
export type CommandMenuDataItem = Omit<CommandDataItem, 'items'> & Pick<CommandMenuItemProps, 'icon' | 'description' | 'trailing' | 'dimmed' | 'closeOnSelect'> & {
  /** Commands on a page of their own, which choosing this one opens. */
  items?: CommandMenuData;
};
export type CommandMenuDataGroup = { type: 'group'; label?: string; items: (CommandMenuDataItem | string)[] };
/** Commands as data: commands, plain strings, groups and separators. */
export type CommandMenuData = (CommandMenuDataItem | CommandMenuDataGroup | ListSeparator | string)[];

export type CommandMenuProps = Omit<CommandProps, 'items' | 'emptyItems'> & {
  /** The commands as data. UI SDK ranks them as the user types; CommandMenuList renders them as the kit's rows. */
  items?: CommandMenuData;
  /** Commands shown instead of `items` on the first page while the search is empty. */
  emptyItems?: CommandMenuData;
  /** Inside a CommandMenuDialog, running a command closes it (default true). A command that opens a page never
      does, and one whose action returns a Promise closes it once that settles. */
  closeOnSelect?: boolean;
};

export function CommandMenu({
  query: queryProp, defaultQuery = '', onQueryChange, pages: pagesProp, defaultPages = NO_PAGES, onPagesChange, onAction, filter,
  loop = true, controller: controllerProp, closeOnSelect = true, className, children, ...props
}: CommandMenuProps) {
  const [ownController] = useState(createCommandController);
  const controller = controllerProp ?? ownController;
  const dialog = useContext(DialogContext);
  const [view] = useState(createListView);
  const [closes] = useState(() => new Map<string, boolean>());
  const list = useRef<HTMLElement | null>(null);

  // The search text and the pages live here, so the bar, the legend and custom parts can render them.
  const [ownQuery, setOwnQuery] = useState(defaultQuery);
  const query = queryProp ?? ownQuery;
  const [ownPages, setOwnPages] = useState(defaultPages);
  const pages = pagesProp ?? ownPages;

  // Which way the last page change went, for the page that slides in.
  const stack = stackKey(pages);
  const [seen, setSeen] = useState({ stack, depth: pages.length });
  const [direction, setDirection] = useState<'forward' | 'back' | undefined>(undefined);
  if (seen.stack !== stack) {
    setSeen({ stack, depth: pages.length });
    setDirection(pages.length < seen.depth ? 'back' : 'forward');
  }

  const [settings, setSettings] = useState(() => new Map<string | null, PageSettings>());
  const setPage = useCallback((page: string | null, next: PageSettings | null) => {
    setSettings((current) => {
      const copy = new Map(current);
      if (next) copy.set(page, next);
      else copy.delete(page);
      return copy;
    });
  }, []);
  const setList = useCallback((el: HTMLElement | null) => { list.current = el; }, []);
  const running = useRef<KeyboardEvent | null>(null);
  const current = settings.get(pages[pages.length - 1] ?? null);

  // The command highlighted on each page below the current one, to land on it again on the way back.
  const left = useRef<(string | null)[]>([]);
  const restore = (value: string, to: string[], reason: CommandPagesChangeReason) => {
    if (stackKey(controller.getPages()) !== stackKey(to) || !list.current) return;
    const row = shownCommands(list.current).find((el) => el.dataset.value === value);
    if (row && !row.hasAttribute('data-disabled')) controller.setValue(value, { reason });
  };

  const handle = useMemo<MenuHandle>(
    () => ({ controller, view, list, closes, setList, setPage, running }),
    [controller, view, closes, setList, setPage],
  );
  const state = useMemo<MenuState>(() => ({ query, pages, settings: current, loop }), [query, pages, current, loop]);

  return (
    <HandleContext.Provider value={handle}>
      <StateContext.Provider value={state}>
        <Command
          controller={controller}
          query={query}
          onQueryChange={(next, details) => {
            onQueryChange?.(next, details);
            if (!details.canceled && queryProp === undefined) setOwnQuery(next);
          }}
          pages={pages}
          onPagesChange={(next, details) => {
            onPagesChange?.(next, details);
            if (details.canceled) return;
            if (next.length > pages.length) left.current[pages.length] = controller.getValue();
            else {
              const value = left.current[next.length];
              left.current.length = next.length;
              const back = next.length < pages.length && next.every((page, i) => page === pages[i]);
              // UI SDK highlights the page's first command once its commands are back; the next frame is after that.
              if (back && value != null) requestAnimationFrame(() => restore(value, next, details.reason));
            }
            if (pagesProp === undefined) setOwnPages(next);
          }}
          onAction={(value, ownDetails) => {
            // Gap (gaps/command.md #5): a ⌘1–⌘9 run goes through `controller.run()`, which passes no event.
            const details = ownDetails.event || !running.current ? ownDetails : { ...ownDetails, event: running.current };
            const result = onAction?.(value, details);
            if (dialog && (closes.get(value) ?? closeOnSelect)) {
              const close = () => { dialog.close({ reason: 'action', event: details.event }); };
              if (isThenable(result)) result.then(close, () => {});
              else close();
            }
            return result;
          }}
          filter={current?.filter !== undefined ? current.filter : filter}
          loop={loop}
          data-depth={pages.length}
          data-direction={direction}
          className={cx(
            cn(
              // --command-surface is the card's fill; sticky group labels share it. Override it (not bg-*) to recolour.
              'group/command relative box-border flex w-full min-w-0 flex-col overflow-hidden bg-(--command-surface) text-popover-foreground [--command-surface:var(--popover)]',
              dialog
                ? 'min-h-0 rounded-sheet shadow-[0_24px_80px_--alpha(black/35%),0_0_0_.5px_var(--border)]'
                : 'rounded-card shadow-[0_0_0_.5px_var(--border)]',
            ),
            className,
          )}
          {...props}
        >
          {/* As a function: UI SDK's root then leaves the list to CommandMenuList. Given `items` and plain children
              it renders a list of its own for one commit, and the rows that outlive it never show the highlight. */}
          {typeof children === 'function' ? children : () => children}
        </Command>
      </StateContext.Provider>
    </HandleContext.Provider>
  );
}

/* ── CommandMenuInput ── */

const ARROWS: Record<string, readonly [number, number] | undefined> = {
  ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1],
};

/** In a `columns` group the arrows follow the layout: UI SDK's `nearestInDirection` picks the nearest command that
    way, and past the grid's first or last row the highlight leaves for the command before or after the group. */
function gridStep(event: ReactKeyboardEvent<HTMLInputElement>, list: HTMLElement | null, controller: CommandMenuController, loop: boolean) {
  const direction = ARROWS[event.key];
  if (!direction || !list || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
  const current = list.querySelector<HTMLElement>(`${ITEM}[data-highlighted]`);
  const grid = current?.closest<HTMLElement>('[data-columns]');
  if (!current || !grid) return;
  const rows = shownCommands(list).filter((el) => !el.hasAttribute('data-disabled'));
  const cells = rows.filter((el) => grid.contains(el));
  const across = direction[1] === 0;
  let next = nearestInDirection(
    current.getBoundingClientRect(),
    (across ? cells : rows).filter((el) => el !== current).map((el) => ({ key: el.dataset.value ?? '', rect: el.getBoundingClientRect() })),
    direction,
  );
  if (next === undefined && !across) {
    const down = direction[1] > 0;
    const edge = rows.indexOf(down ? cells[cells.length - 1] : cells[0]) + direction[1];
    next = (rows[edge] ?? (loop ? rows[down ? 0 : rows.length - 1] : undefined))?.dataset.value;
  }
  event.preventDefault();
  if (next !== undefined) controller.setValue(next, { reason: 'list-navigation', event: event.nativeEvent });
}

export type CommandMenuInputProps = ComponentProps<typeof CommandInput> & {
  /** Placeholder on the first page; pages below it use their own `placeholder`, else "Search…". */
  placeholder?: string;
  /** Show a back button in place of the search icon on pages below the first (default true). */
  backButton?: boolean;
  /** Show the current page's `title` as a chip before the field (default true). */
  pageTitle?: boolean;
  /** Content after the field (a spinner, a hint). */
  trailing?: ReactNode;
};

/** The search field in its bar. It is named by `aria-label`, or else by its placeholder. Inline it takes focus as
    it mounts (`autoFocus`, without scrolling the page to it); in a dialog the dialog moves focus to it. */
export function CommandMenuInput({
  placeholder = 'Search…', backButton = true, pageTitle = true, trailing, autoFocus = true, className, style, onKeyDown, ref, ...props
}: CommandMenuInputProps) {
  const { controller, list } = useHandle('CommandMenuInput');
  const { pages, settings, loop } = useMenuState('CommandMenuInput');
  const inDialog = useContext(DialogContext) !== null;
  const input = useRef<HTMLInputElement | null>(null);
  const below = pages.length > 0;
  const shown = settings?.placeholder ?? (below ? 'Search…' : placeholder);
  const named = props['aria-label'] !== undefined || props['aria-labelledby'] !== undefined;
  useEffect(() => {
    // Not the native attribute: React's autoFocus scrolls the page to a menu further down it.
    if (autoFocus && !inDialog) input.current?.focus({ preventScroll: true });
  }, [autoFocus, inDialog]);
  return (
    <div data-slot="command-input-wrapper" className="flex h-toolbar shrink-0 items-center gap-2.5 px-4">
      {backButton && below ? (
        <Button
          variant="quiet"
          size="icon-sm"
          aria-label="Back"
          tabIndex={-1}
          // The field keeps focus.
          onMouseDown={(event: ReactMouseEvent) => event.preventDefault()}
          onClick={() => { controller.pop({ reason: 'back' }); }}
          className="-m-1.5 size-8 shrink-0 rounded-lg p-0 hover:not-data-disabled:bg-accent hover:text-foreground"
        >
          <IconSwap id="back"><Icon name="arrow-left" size={18} sw={2} /></IconSwap>
        </Button>
      ) : (
        <span aria-hidden="true" className="-m-1.5 grid size-8 shrink-0 place-items-center text-muted-foreground">
          <IconSwap id="search"><Icon name="magnifier" size={18} sw={1.8} /></IconSwap>
        </span>
      )}
      {pageTitle && below && settings?.title ? (
        <span
          key={settings.title}
          data-slot="command-page-title"
          className={cn(ARRIVE, 'inline-flex h-6 shrink-0 items-center rounded-md bg-secondary px-2 text-[12.5px] font-medium whitespace-nowrap text-secondary-foreground group-data-direction/command:starting:translate-x-2')}
        >
          {settings.title}
        </span>
      ) : null}
      <CommandInput
        ref={(el: HTMLInputElement | null) => { input.current = el; assignRef(ref, el); }}
        aria-label={named ? undefined : shown}
        placeholder={shown}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return;
          // The page's own keys first, then the caller's: either can take a key over with preventDefault().
          settings?.keys.current?.(event, controller);
          if (!event.defaultPrevented) onKeyDown?.(event);
          if (event.defaultPrevented) return;
          // Holding Backspace to clear the search stops at empty; only a fresh press goes back a page.
          if (event.key === 'Backspace' && event.repeat && event.currentTarget.value === '') event.preventDefault();
          else gridStep(event, list.current, controller, loop);
        }}
        // The field is the whole bar and always focused: no ring (inline, so a host's global :focus-visible can't add one).
        style={typeof style === 'function' ? (state) => ({ outline: 'none', ...style(state) }) : { outline: 'none', ...style }}
        className={cx(
          ['h-full min-w-0 flex-1 border-0 bg-transparent p-0 font-[inherit] text-callout text-foreground outline-none placeholder:text-tertiary-foreground', selectableText],
          className,
        )}
        {...props}
      />
      {trailing}
    </div>
  );
}

/* ── CommandMenuList / CommandMenuPage ── */

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/* What a page change brings in arrives rather than cuts: it moves on the smooth spring and fades in, blurred at
   first. It starts once the menu has changed page (`data-direction` on the root), so nothing animates as the menu
   itself mounts; reduced motion keeps only the fade. UI SDK unmounts what leaves at once. */
const ARRIVE = [
  '[transition:translate_var(--duration-spring-smooth)_var(--ease-spring-smooth),scale_var(--duration-spring-snappy)_var(--ease-spring-snappy),opacity_.22s_cubic-bezier(.22,1,.36,1),filter_.22s_cubic-bezier(.22,1,.36,1)]',
  'group-data-direction/command:starting:opacity-0 group-data-direction/command:starting:blur-xs',
  'motion-reduce:[transition:opacity_.12s] motion-reduce:group-data-direction/command:starting:translate-none motion-reduce:group-data-direction/command:starting:scale-100 motion-reduce:group-data-direction/command:starting:blur-none',
].join(' ');

function assignRef<T>(ref: ((value: T | null) => unknown) | { current: T | null } | null | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

export type CommandMenuListProps = ComponentProps<typeof CommandList> & {
  /** Group labels stick to the top while their rows scroll (default true). Off for translucent cards. */
  stickyHeadings?: boolean;
};

/** The scrolling results, at most 360px tall (`className="max-h-…"`, or `style` for a measured height). Its
    height springs between pages and as filtering shrinks it. Without children it renders the menu's `items`. */
export function CommandMenuList({ stickyHeadings = true, className, children, ref, ...props }: CommandMenuListProps) {
  const { controller, view, setList, running } = useHandle('CommandMenuList');
  const { settings } = useMenuState('CommandMenuList');
  const [list, setOwnList] = useState<HTMLElement | null>(null);
  const numbered = settings?.numbered ?? false;

  // ⌘1–⌘9 run the first nine commands in view, while focus is in the menu.
  useEffect(() => {
    if (!list) return;
    const offs = DIGITS.map((digit) =>
      registerShortcut(
        `mod+${digit}`,
        (event) => {
          const value = shownCommands(list)[digit - 1]?.dataset.value;
          if (value === undefined) return;
          controller.setValue(value, { reason: 'shortcut', event });
          running.current = event;
          try { controller.run(value); } finally { running.current = null; }
        },
        { layer: list, when: () => !!list.closest('[data-slot="command"]')?.contains(document.activeElement) },
      ));
    return () => offs.forEach((off) => off());
  }, [list, controller, running]);

  // On a `numbered` page the first nine rows show their key. UI SDK hides rows as it filters, without rendering,
  // so their order is read from the list.
  useLayoutEffect(() => {
    if (!list || !numbered) {
      view.setNumbered([]);
      return;
    }
    const read = () => view.setNumbered(shownCommands(list).slice(0, DIGITS.length).map((el) => el.dataset.value ?? ''));
    read();
    const observer = new MutationObserver(read);
    observer.observe(list, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] });
    return () => observer.disconnect();
  }, [list, numbered, view]);

  const bind = useCallback((el: HTMLDivElement | null) => {
    setOwnList(el);
    setList(el);
    assignRef(ref, el);
  }, [setList, ref]);

  return (
    <AnimatedHeight spring="tray" className="shrink-0">
      <CommandList
        ref={bind}
        data-sticky-headings={stickyHeadings}
        className={cx(
          'group/command-list bl-scroll relative max-h-90 scroll-pb-2 overflow-x-hidden overflow-y-auto overscroll-contain px-2 pb-2 data-[sticky-headings=true]:scroll-pt-8',
          className,
        )}
        {...props}
      >
        {(state: CommandListState) => (typeof children === 'function'
          ? children(state)
          : children ?? (state.items.length ? <CommandMenuItems items={state.items as CommandMenuData} /> : null))}
      </CommandList>
    </AnimatedHeight>
  );
}

export interface CommandMenuPageProps {
  /** The page's name, which a command's `page` opens. Leave it out for the first page. */
  value?: string;
  /** The field's placeholder while this page is open. */
  placeholder?: string;
  /** A chip shown before the field while this page is open. */
  title?: string;
  /** How typing narrows this page (default: the menu's `filter`). `false` for rows computed from the search text. */
  filter?: SearchFilter;
  /** Show ⌘1–⌘9 on the first nine visible rows (the keys run them either way). */
  numbered?: boolean;
  /** Runs on a key press in the field before the menu's own keys; `preventDefault()` takes the key over. */
  onKeyDown?: PageKeyDown;
  className?: string;
  children?: ReactNode;
}

/** The commands shown while this page is on top: UI SDK's CommandPage, which mounts them only then. The page
    slides in from the side it was opened from. */
export function CommandMenuPage({ value, placeholder, title, filter, numbered = false, onKeyDown, className, children }: CommandMenuPageProps) {
  const { setPage } = useHandle('CommandMenuPage');
  const keys = useRef(onKeyDown);
  useLayoutEffect(() => { keys.current = onKeyDown; });
  useLayoutEffect(() => {
    setPage(value ?? null, { title, placeholder, filter, numbered, keys });
    return () => setPage(value ?? null, null);
  }, [setPage, value, title, placeholder, filter, numbered]);
  return (
    <CommandPage value={value}>
      <PageContext.Provider value={numbered}>
        <div
          data-slot="command-page"
          className={cn(ARRIVE, 'group-data-[direction=back]/command:starting:-translate-x-7 group-data-[direction=forward]/command:starting:translate-x-7', className)}
        >
          {children}
        </div>
      </PageContext.Provider>
    </CommandPage>
  );
}

/* ── CommandMenuGroup ── */

export type CommandMenuGroupProps = ComponentProps<typeof CommandGroup> & {
  /** Lay the commands out as a grid of this many columns. The arrows then move by cell and by row. */
  columns?: number;
};

/** A group of commands under a CommandMenuGroupLabel. UI SDK hides it while none of its commands matches. */
export function CommandMenuGroup({ columns = 1, className, style, ...props }: CommandMenuGroupProps) {
  const grid = columns > 1;
  const track = { '--command-columns': columns } as CSSProperties;
  return (
    <ColumnsContext.Provider value={columns}>
      <CommandGroup
        data-columns={grid ? columns : undefined}
        className={cx(
          ['group/command-group pt-1 [&[hidden]]:hidden', grid && 'grid grid-cols-[repeat(var(--command-columns),minmax(0,1fr))] gap-1'],
          className,
        )}
        style={grid ? scopeStyle(track, style) : style}
        {...props}
      />
    </ColumnsContext.Provider>
  );
}

/** A group's heading. It sticks over its rows on `--command-heading-surface` (default: the card's
    `--command-surface`). A translucent card doubles its tint under a sticky band: give the labels an opaque
    surface, or pass `stickyHeadings={false}` to the list. */
export function CommandMenuGroupLabel({ className, ...props }: ComponentProps<typeof CommandGroupLabel>) {
  return (
    <CommandGroupLabel
      className={cx(
        'sticky top-0 z-1 col-span-full bg-(--command-heading-surface,var(--command-surface)) px-3 pt-2 pb-1.5 text-[12.5px] font-medium text-muted-foreground group-data-columns/command-group:-mb-1 group-data-[sticky-headings=false]/command-list:static group-data-[sticky-headings=false]/command-list:bg-transparent',
        className,
      )}
      {...props}
    />
  );
}

/* ── CommandMenuItem ── */

/** The keys of a shortcut, one cap each: UI SDK's CommandShortcut, which formats them for the platform (⇧⌘O, or
    Ctrl+Shift+O). Inside a command it shows the command's `shortcut`; with its own `shortcut` it only shows keys. */
export function CommandMenuShortcut({ className, children, ...props }: ComponentProps<typeof CommandShortcut>) {
  return (
    <CommandShortcut
      dir="ltr"
      className={cx('ml-auto inline-flex shrink-0 items-center gap-0.5 pl-3 text-footnote text-muted-foreground', className)}
      {...props}
    >
      {typeof children === 'string' ? keycaps(children) : children ?? ((state) => keycaps(state.text))}
    </CommandShortcut>
  );
}

const APPLE_ORDER = '⌃⌥⇧⌘';

function keycaps(text: string) {
  // UI SDK wraps the keys in direction isolates; the caps sit in a left-to-right row instead.
  const keys = text.replace(/[⁦-⁩]/g, '');
  const [, modifiers = '', key = ''] = /^([⌃⌥⇧⌘]*)(.*)$/u.exec(keys) ?? [];
  // Apple's modifier order (⌃⌥⇧⌘), whatever order the shortcut was written in.
  const caps = modifiers ? [...[...modifiers].sort((a, b) => APPLE_ORDER.indexOf(a) - APPLE_ORDER.indexOf(b)), key] : keys.split(/\+(?=.)/);
  return caps.filter(Boolean).map((cap, i) => <kbd key={i} className="min-w-3 text-center font-sans font-normal">{cap}</kbd>);
}

/** A command's leading icon. */
export function CommandMenuItemIcon({ className, ...props }: ComponentProps<typeof CommandItemIcon>) {
  return (
    <CommandItemIcon
      className={cx(
        'grid size-6 shrink-0 place-items-center text-muted-foreground group-data-dimmed/command-item:opacity-60 group-data-disabled/command-item:opacity-60',
        className,
      )}
      {...props}
    />
  );
}

/** A command's text, with what the search matched in bold. */
export function CommandMenuItemText({ className, ...props }: ComponentProps<typeof CommandItemText>) {
  return (
    <CommandItemText
      className={cx('truncate leading-[20px] [&_mark]:bg-transparent [&_mark]:font-semibold [&_mark]:text-foreground', className)}
      {...props}
    />
  );
}

/** A command's second line (a path, an id). */
export function CommandMenuItemDescription({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      data-slot="command-item-description"
      className={cn(
        'truncate text-footnote leading-[18px] text-muted-foreground group-data-dimmed/command-item:opacity-70 group-data-disabled/command-item:opacity-70',
        className,
      )}
      {...props}
    />
  );
}

export type CommandMenuItemProps = Omit<ComponentProps<typeof CommandItem>, 'title' | 'children'> & {
  /** Identifies the command: passed to `onAction`, and the highlight's value (default: `title` when it is a string). */
  value?: string;
  /** Leading icon: an Icon name or any node (a monogram, an image). */
  icon?: string | ReactNode;
  /** The row's text. A string shows what the search matched in bold. */
  title?: ReactNode;
  /** Second line (a path, an id). Searched with the title unless `label` says what to search. */
  description?: ReactNode;
  /** Trailing node (a Badge, or a CommandMenuShortcut with its own `shortcut` to show keys the app handles
      itself). Replaces the command's own shortcut keys. */
  trailing?: ReactNode;
  /** Show a chevron (default: when `page` is set). */
  chevron?: boolean;
  /** Dimmed but still runnable (an integration that needs setup). */
  dimmed?: boolean;
  /** Overrides the menu's `closeOnSelect` for this command. */
  closeOnSelect?: boolean;
  /** Custom row content, or a function of the command's state (replaces icon / title / description / trailing). */
  children?: ReactNode | ((state: CommandItemState) => ReactNode);
};

/** A command: UI SDK's CommandItem as the kit's row. Enter or a press runs it: `onSelect(event)`, then the menu's
    `onAction(value)`, or its `page`. `shortcut` ("mod+shift+o") runs it from the keyboard while the list is
    mounted and shows its keys. */
export function CommandMenuItem({
  value, icon, title, description, trailing, chevron, dimmed = false, closeOnSelect, className, children, ...props
}: CommandMenuItemProps) {
  const { closes } = useHandle('CommandMenuItem');
  const columns = useContext(ColumnsContext);
  const generated = useId();
  const key = value ?? (typeof title === 'string' ? title : generated);
  useLayoutEffect(() => {
    if (closeOnSelect === undefined) return;
    closes.set(key, closeOnSelect);
    return () => { closes.delete(key); };
  }, [closes, key, closeOnSelect]);
  return (
    <CommandItem
      value={key}
      data-value={key}
      data-dimmed={dimmed ? '' : undefined}
      className={cx(
        [
          'group/command-item relative flex min-w-0 cursor-default items-center gap-3 rounded-ctl px-3 text-subhead text-foreground outline-none select-none [&[hidden]]:hidden',
          columns > 1 ? 'aspect-square justify-center p-0' : description != null ? 'min-h-toolbar py-1.5' : 'min-h-10 py-1',
          'transition-[background-color] duration-100 data-dimmed:text-muted-foreground data-disabled:text-muted-foreground data-disabled:opacity-60 data-highlighted:bg-accent data-pending:cursor-progress',
        ],
        className,
      )}
      {...props}
    >
      {(state: CommandItemState) => (
        <Row id={key} highlighted={state.highlighted}>
          {children != null ? (typeof children === 'function' ? children(state) : children) : (
            <>
              {icon != null ? <CommandMenuItemIcon>{typeof icon === 'string' ? <Icon name={icon} size={19} sw={1.7} /> : icon}</CommandMenuItemIcon> : null}
              {title != null || description != null ? (
                <span className="flex min-w-0 flex-1 flex-col">
                  {typeof title === 'string'
                    ? <CommandMenuItemText>{title}</CommandMenuItemText>
                    : title != null ? <span data-slot="command-item-title" className="truncate leading-[20px]">{title}</span> : null}
                  {description != null ? <CommandMenuItemDescription>{description}</CommandMenuItemDescription> : null}
                </span>
              ) : null}
              {trailing ?? (props.shortcut ? <CommandMenuShortcut /> : <Numbered id={key} />)}
              {(chevron ?? props.page !== undefined) ? <Icon name="chevron-right" size={15} sw={2} className="ml-auto shrink-0 text-muted-foreground" /> : null}
            </>
          )}
        </Row>
      )}
    </CommandItem>
  );
}

/** Publishes the highlighted command to `useCommandMenuValue`. UI SDK highlights the first command without a change
    event, so the row that shows the highlight reports it. */
function Row({ id, highlighted, children }: { id: string; highlighted: boolean; children: ReactNode }) {
  const { view } = useHandle('CommandMenuItem');
  useLayoutEffect(() => {
    if (!highlighted) return;
    view.setValue(id);
    return () => { if (view.value() === id) view.setValue(null); };
  }, [view, id, highlighted]);
  return children;
}

/** On a `numbered` page, the key that runs this row while it is among the first nine in view. */
function Numbered({ id }: { id: string }) {
  const { view } = useHandle('CommandMenuItem');
  const numbered = useContext(PageContext);
  const index = useSyncExternalStore(view.subscribe, () => view.numbered().indexOf(id), () => -1);
  return numbered && index >= 0 ? <CommandMenuShortcut shortcut={`mod+${index + 1}`} /> : null;
}

/** Renders commands given as data as the kit's rows: groups, separators, and commands with their `icon`,
    `description` and `trailing`. CommandMenuList uses it for the menu's `items`. */
export function CommandMenuItems({ items }: { items: CommandMenuData }) {
  return items.map((entry, index) => {
    if (typeof entry === 'string') return <CommandMenuItem key={entry} value={entry} title={entry} />;
    if ('type' in entry) {
      if (entry.type === 'separator') return <CommandMenuSeparator key={`separator-${index}`} />;
      return (
        <CommandMenuGroup key={`group-${entry.label ?? index}`}>
          {entry.label ? <CommandMenuGroupLabel>{entry.label}</CommandMenuGroupLabel> : null}
          <CommandMenuItems items={entry.items} />
        </CommandMenuGroup>
      );
    }
    return (
      <CommandMenuItem
        key={entry.value}
        value={entry.value}
        label={entry.label}
        keywords={entry.keywords}
        disabled={entry.disabled}
        shortcut={entry.shortcut}
        title={entry.label}
        icon={entry.icon}
        description={entry.description}
        trailing={entry.trailing}
        dimmed={entry.dimmed}
        closeOnSelect={entry.closeOnSelect}
        chevron={entry.items ? true : undefined}
      />
    );
  });
}

/* ── CommandMenuEmpty / CommandMenuStatus / CommandMenuSeparator ── */

/** Shown, and announced, while no command matches. It goes beside the list, not in it. */
export function CommandMenuEmpty({ className, children = 'No results', ...props }: ComponentProps<typeof CommandEmpty>) {
  return (
    <CommandEmpty className={cx('py-10 text-center text-detail text-muted-foreground not-data-empty:hidden', className)} {...props}>
      {children}
    </CommandEmpty>
  );
}

/** A polite live region for loading and result counts, with the menu's `status`. Its content is yours, usually a
    function of its state: `{(state) => (state.loading ? 'Searching…' : null)}`. */
export function CommandMenuStatus({ className, ...props }: ComponentProps<typeof CommandStatus>) {
  return <CommandStatus className={cx('shrink-0 px-5 pb-2 text-footnote text-muted-foreground empty:hidden', className)} {...props} />;
}

/** A line between groups. UI SDK hides it while the list is filtered. */
export function CommandMenuSeparator({ className, ...props }: ComponentProps<typeof CommandSeparator>) {
  return <CommandSeparator className={cx('mx-3 my-1.5 h-px bg-border', className)} {...props} />;
}

/* ── CommandMenuFooter ── */

export interface CommandMenuLegendItem { keys: ReactNode[]; label: string }

export interface CommandMenuFooterProps extends Omit<ComponentProps<'div'>, 'children'> {
  /** Show the keyboard legend on the left (default true), or your own. */
  legend?: boolean | CommandMenuLegendItem[];
  /** Right-aligned content (a primary action, a hint). */
  children?: ReactNode;
}

/** The keyboard legend: ↑ ↓ Navigate, Enter Select, Backspace Back (below the first page), and Esc: Close in a
    CommandMenuDialog, Clear inline while there is a search (inline, Esc closes nothing). */
export function CommandMenuFooter({ legend = true, className, children, onMouseDown, ...props }: CommandMenuFooterProps) {
  const { pages, query } = useMenuState('CommandMenuFooter');
  const inDialog = useContext(DialogContext) !== null;
  const items: (CommandMenuLegendItem & { id: string })[] = Array.isArray(legend)
    ? legend.map((item, i) => ({ ...item, id: `${i}-${item.label}` }))
    : legend
      ? [
        { id: 'nav', keys: [<Icon key="u" name="arrow-up" size={12} sw={2.2} />, <Icon key="d" name="arrow-down" size={12} sw={2.2} />], label: 'Navigate' },
        { id: 'enter', keys: ['Enter'], label: 'Select' },
        ...(pages.length > 0 ? [{ id: 'back', keys: ['Backspace'], label: 'Back' }] : []),
        ...(inDialog ? [{ id: 'esc', keys: ['Esc'], label: 'Close' }] : query !== '' ? [{ id: 'esc', keys: ['Esc'], label: 'Clear' }] : []),
      ]
      : [];
  return (
    <div
      data-slot="command-footer"
      // The field keeps focus when the legend is pressed.
      onMouseDown={(event) => {
        onMouseDown?.(event);
        if (!(event.target as HTMLElement).closest('button,a,input')) event.preventDefault();
      }}
      className={cn('flex h-11 shrink-0 items-center gap-4 border-t border-border bg-secondary/40 px-3 text-footnote text-muted-foreground', className)}
      {...props}
    >
      {items.map((item) => (
        <span key={item.id} className={cn(ARRIVE, 'inline-flex items-center gap-1.5 whitespace-nowrap group-data-direction/command:starting:scale-90')}>
          {item.keys.map((key, i) => <Kbd key={i} className="h-6 min-w-6 rounded-md px-1.5 text-[12.5px] text-foreground">{key}</Kbd>)}
          <span>{item.label}</span>
        </span>
      ))}
      {children ? <div className="ml-auto flex min-w-0 items-center gap-2">{children}</div> : null}
    </div>
  );
}

/* ── CommandMenuDialog ── */

export type CommandMenuDialogProps = Omit<DialogProps, 'presentation'>;

/** The ⌘K presentation: the kit's Dialog (UI SDK's) around a CommandMenu. It takes the dialog's props (`open`, `defaultOpen`,
    `onOpenChange(open, details)`, `controller`, `container`) and renders into BLProvider's root (see
    `useLayerHost`), so the scrim covers the app it opened in. */
export function CommandMenuDialog({ controller, ...props }: CommandMenuDialogProps) {
  const [own] = useState<AnyDialogController>(createDialogController);
  const dialog = controller ?? own;
  return (
    <DialogContext.Provider value={dialog}>
      <Dialog controller={dialog} {...props} />
    </DialogContext.Provider>
  );
}

/** The button that opens the palette. `shortcut="mod+k"` opens it from anywhere on the page; give it the kit's
    look with `render={<Button … />}`. */
export const CommandMenuDialogTrigger = DialogTrigger;

export type CommandMenuDialogContentProps = ComponentProps<typeof DialogContent> & {
  /** Scrim classes. */
  overlayClassName?: ComponentProps<typeof DialogBackdrop>['className'];
};

/** The scrim and the dialog itself, which hangs from the top rather than centring, so the card's height can spring
    between pages without the field moving. Put the CommandMenu inside; name it with `aria-label`. */
export function CommandMenuDialogContent({
  className, style, overlayClassName, initialFocus = '[data-slot="command-input"]', children, ...props
}: CommandMenuDialogContentProps) {
  const scope = useThemeScopeProps();
  const named = props['aria-label'] !== undefined || props['aria-labelledby'] !== undefined;
  return (
    <>
      <DialogBackdrop className={overlayClassName} />
      <DialogContent
        aria-label={named ? undefined : 'Command menu'}
        data-theme-scope={scope['data-theme-scope']}
        initialFocus={initialFocus}
        className={cx(
          [
            // Sized against its containing block: the layer host (a framed app), or the window in the top layer.
            'fixed inset-x-0 top-[min(14%,120px)] bottom-auto mx-auto my-0 box-border flex h-auto max-h-[min(640px,calc(100%-160px))] w-[calc(100%-2rem)] max-w-[600px] flex-col overflow-visible border-0 bg-transparent p-0 text-foreground outline-none',
            'transition-[opacity,scale] duration-spring-snappy ease-spring-snappy data-starting-style:scale-90 data-starting-style:opacity-0',
            'data-ending-style:scale-96 data-ending-style:opacity-0 data-ending-style:duration-exit data-ending-style:ease-exit',
            'motion-reduce:transition-opacity motion-reduce:duration-spring-smooth motion-reduce:ease-spring-smooth',
            scope.className,
          ],
          className,
        )}
        style={scopeStyle(scope.style, style)}
        {...props}
      >
        {children}
      </DialogContent>
    </>
  );
}
