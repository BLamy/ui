import {
  createChange,
  definePrimitive,
  type ChangeDetails,
} from '@ui-sdk/core';
import { bindBack } from '@/lib/back';
import { bindEdgeSwipe } from '@/lib/edge-swipe';
import { createPageStack, type PageStackExit, type PageStackReason } from '@/lib/stack';
import { createParts } from '@ui-sdk/react/primitive';
import { useState, type ReactNode } from 'react';
import { Icon } from '@/lib/icon';

type SettingsReason = PageStackReason | 'trigger-press';
type SettingsState = { pages: string[]; exiting: PageStackExit[] };
type SettingsOptions = {
  pages?: string[];
  defaultPages?: string[];
  onPagesChange?: (pages: string[], details: ChangeDetails<SettingsReason>) => void;
};

/* A stack of pages that cover each other. `createPageStack` keeps the pages in the primitive's own state (so
   `onPagesChange` hears every push and pop and can cancel one), runs each page's entrance and exit, moves focus
   in on a push and back on a pop, makes covered pages inert, pops on Escape, and, while there is a page to go back
   to, on the platform's back (`bindBack`) and an edge swipe (`bindEdgeSwipe`). */
const settings = definePrimitive({
  name: 'settings-stack',
  options: { pages: 'list', defaultPages: 'list', onPagesChange: 'callback' },
  state: (options: SettingsOptions): SettingsState => ({
    pages: options.pages ?? options.defaultPages ?? ['root'],
    exiting: [],
  }),
  sync: (options) => (options.pages === undefined ? {} : { pages: options.pages }),
  api: (context) => {
    const change = createChange(context);
    const stack = createPageStack<SettingsState, SettingsReason>(context, {
      key: 'pages',
      exiting: 'exiting',
      set: (value, details) => change('pages', value, details),
      back: bindBack,
    });
    return { stack, push: (page: string) => stack.push(page), pop: () => stack.pop() };
  },
  slots: (slot) => ({
    root: slot({ bind: (el, { api }) => bindEdgeSwipe(el, { ...api.stack.swipe }) }),
    page: slot<{ value: string }>({
      props: { value: 'string' },
      present: (state, { api, key }) => api.stack.present(state, key),
      attrs: (state, { api, key }) => api.stack.pageAttrs(state, key),
      bind: (el, { api, key }) => api.stack.bindPage(el, key, { initialFocus: () => el.querySelector<HTMLElement>('h2') }),
    }),
    // `value` is the page a link opens. It is also the part's key, so each link hears its own presses.
    link: slot<{ value: string }>({
      props: { value: 'string' },
      attrs: () => ({ type: 'button' }),
      press: ({ api, key }, event) => api.stack.push(key, { reason: 'trigger-press', event }),
    }),
    back: slot({
      attrs: () => ({ type: 'button' }),
      press: ({ api }, event) => api.stack.pop({ reason: 'trigger-press', event }),
    }),
  }),
  agent: { actions: ['push', 'pop'] },
});

const {
  Root: SettingsStack,
  Page: SettingsPage,
  Link: SettingsLink,
  Back: SettingsBack,
} = createParts(settings, { root: 'div', page: 'section', link: 'button', back: 'button' });

/* The motion is CSS on the kit's spring, driven by the stack's attributes: a pushed page enters from the trailing
   edge (`data-starting-style`), a popped one leaves the same way (`data-ending-style`), the page under it slides a
   little (`data-covered`), and a swipe follows the finger (`data-swiping`, `--stack-progress`) with no transition. */
const PAGE = [
  'absolute inset-0 overflow-y-auto bg-background outline-none',
  'transition-[translate] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none',
  'data-starting-style:translate-x-full data-ending-style:not-data-covered:translate-x-full data-covered:-translate-x-[30%]',
  'data-swiping:transition-none data-swiping:not-data-covered:translate-x-[calc(var(--stack-progress)*100%)] data-swiping:data-covered:translate-x-[calc(-30%+var(--stack-progress)*30%)]',
].join(' ');

const ROW =
  'flex h-row w-full cursor-pointer items-center justify-between border-0 border-b border-border bg-transparent px-4 text-left text-body text-foreground outline-none [font-family:inherit] last:border-b-0 hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/45';

function Header({ title, back }: { title: string; back?: string }) {
  return (
    <header className="grid h-toolbar grid-cols-[1fr_auto_1fr] items-center border-b border-border bg-bar px-2">
      {back ? (
        <SettingsBack className="flex cursor-pointer items-center gap-1 justify-self-start rounded-ctl border-0 bg-transparent px-1 text-body text-primary outline-none [font-family:inherit] focus-visible:ring-[3px] focus-visible:ring-ring/45">
          <Icon name="chevL" size={16} />
          {back}
        </SettingsBack>
      ) : (
        <span />
      )}
      <h2 tabIndex={-1} className="m-0 text-body font-semibold text-foreground outline-none">
        {title}
      </h2>
    </header>
  );
}

function Rows({ children }: { children: ReactNode }) {
  return <div className="m-4 overflow-hidden rounded-card bg-card shadow-hairline">{children}</div>;
}

function Link({ to, children }: { to: string; children: ReactNode }) {
  return (
    <SettingsLink value={to} className={ROW}>
      {children}
      <Icon name="chev" size={14} className="text-tertiary-foreground" />
    </SettingsLink>
  );
}

export default function NavStackDemo() {
  const [log, setLog] = useState('root');
  return (
    <div className="grid justify-items-center gap-3">
      <SettingsStack
        aria-label="Settings"
        defaultPages={['root']}
        onPagesChange={(pages: string[], details: ChangeDetails<SettingsReason>) => setLog(`${pages.join(' › ')} · ${details.reason}`)}
        className="relative h-96 w-full max-w-sm touch-pan-y overflow-hidden rounded-sheet bg-background shadow-hairline"
      >
        <SettingsPage value="root" className={PAGE}>
          <Header title="Settings" />
          <Rows>
            <Link to="wifi">Wi-Fi</Link>
            <Link to="notifications">Notifications</Link>
          </Rows>
        </SettingsPage>
        <SettingsPage value="wifi" className={PAGE}>
          <Header title="Wi-Fi" back="Settings" />
          <Rows>
            <Link to="other">Other network…</Link>
          </Rows>
        </SettingsPage>
        <SettingsPage value="other" className={PAGE}>
          <Header title="Other network" back="Wi-Fi" />
          <p className="m-4 text-footnote text-foreground/70">Swipe in from the left edge, press Escape, or use Back.</p>
        </SettingsPage>
        <SettingsPage value="notifications" className={PAGE}>
          <Header title="Notifications" back="Settings" />
          <p className="m-4 text-footnote text-foreground/70">Nothing to see here.</p>
        </SettingsPage>
      </SettingsStack>
      <p className="m-0 font-mono text-footnote text-foreground/70" aria-live="polite">
        {log}
      </p>
    </div>
  );
}
