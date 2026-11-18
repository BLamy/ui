import { bindPanel, definePrimitive } from '@brett_lamy/ui/sdk/core';
import { createParts } from '@brett_lamy/ui/sdk/react/primitive';
import { Icon } from '@/lib/icon';

type FaqState = { expanded: string[]; exiting: string[] };

const without = (list: string[], value: string) => list.filter((other) => other !== value);

/* A disclosure group. `bindPanel` measures each panel, writes its height to `--panel-height` so CSS can animate
   0 → height and back, keeps a closing panel mounted until its transition ends (`exited`), and puts focus back on
   the trigger if it was inside a panel that closes. */
const faq = definePrimitive({
  name: 'faq',
  state: (): FaqState => ({ expanded: [], exiting: [] }),
  api: (context) => {
    const { store } = context;
    return {
      toggle(value: string) {
        const { expanded, exiting } = store.get();
        if (expanded.includes(value)) store.set({ expanded: without(expanded, value), exiting: [...exiting, value] });
        else store.set({ expanded: [...expanded, value], exiting: without(exiting, value) });
      },
    };
  },
  slots: (slot) => ({
    root: slot({}),
    trigger: slot<{ value: string }>({
      props: { value: 'string' },
      attrs: (state, { id, key }) => ({
        type: 'button',
        'aria-expanded': String(state.expanded.includes(key)),
        'aria-controls': `${id}-${key}`,
        'data-open': state.expanded.includes(key) ? '' : undefined,
      }),
      press: ({ api, key }) => api.toggle(key),
    }),
    panel: slot<{ value: string }>({
      props: { value: 'string' },
      present: (state, { key }) => state.expanded.includes(key) || state.exiting.includes(key),
      attrs: (_state, { id, key }) => ({ id: `${id}-${key}`, role: 'region' }),
      bind: (el, { api, key, store }) =>
        bindPanel(el, {
          size: (node, height) => node.style.setProperty('--panel-height', height),
          isOpen: () => store.get().expanded.includes(key),
          isExiting: () => store.get().exiting.includes(key),
          isFindable: () => false,
          opening: () => 'animate',
          reveal: () => api.toggle(key),
          trigger: () => el.previousElementSibling as HTMLElement | undefined,
          subscribe: store.subscribe,
          settled: () => {},
          exited: () => store.set({ exiting: without(store.get().exiting, key) }),
        }),
    }),
  }),
  agent: { actions: ['toggle'] },
});

const { Root: Faq, Trigger: FaqTrigger, Panel: FaqPanel } = createParts(faq, { root: 'div', trigger: 'button', panel: 'div' });

const QUESTIONS = [
  { value: 'refunds', question: 'Can I get a refund?', answer: 'Yes, within 30 days of buying, no questions asked.' },
  { value: 'seats', question: 'Can I add seats later?', answer: 'Any time. You pay for the rest of the month only.' },
  { value: 'export', question: 'Can I export my data?', answer: 'Everything exports to CSV or JSON from Settings.' },
];

export default function PanelDemo() {
  return (
    <Faq className="mx-auto grid w-full max-w-md overflow-hidden rounded-card bg-card shadow-hairline">
      {QUESTIONS.map((item) => (
        <div key={item.value} className="border-b border-border last:border-b-0">
          <FaqTrigger
            value={item.value}
            className="group flex h-row w-full cursor-pointer items-center justify-between border-0 bg-transparent px-4 text-left text-body text-foreground outline-none [font-family:inherit] hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-inset focus-visible:ring-ring/45"
          >
            {item.question}
            <Icon
              name="chev"
              size={14}
              className="text-tertiary-foreground transition-transform duration-spring-snappy ease-spring-snappy group-data-open:rotate-90"
            />
          </FaqTrigger>
          <FaqPanel
            value={item.value}
            className="h-(--panel-height) overflow-hidden transition-[height] duration-spring-smooth ease-spring-smooth data-starting-style:h-0 data-ending-style:h-0 motion-reduce:transition-none"
          >
            <p className="m-0 px-4 pb-3 text-footnote text-foreground/70">{item.answer}</p>
          </FaqPanel>
        </div>
      ))}
    </Faq>
  );
}
