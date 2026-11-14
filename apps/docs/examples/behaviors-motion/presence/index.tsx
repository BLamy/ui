import { animateIn, animateOut, definePrimitive } from '@ui-sdk/core';
import { createParts } from '@ui-sdk/react/primitive';
import { buttonVariants } from '@/components/ui/button';
import { Icon } from '@/lib/icon';

type RemindersState = { items: string[]; leaving: string[] };

const NAMES = ['Call the dentist', 'Water the plants', 'Renew passport', 'Book flights', 'Return library books'];

/* Rows that animate in and out. `animateIn` puts `data-starting-style` on a new row for its first frame, so a CSS
   transition runs from that style; `animateOut` sets `data-ending-style` and keeps the row in the store (and so
   mounted) until its transitions finish, then the callback removes it. The motion itself is plain CSS on the kit's
   spring tokens, so it can be interrupted, and reduced motion only turns the movement off. */
const reminders = definePrimitive({
  name: 'reminders',
  state: (): RemindersState => ({ items: NAMES.slice(0, 2), leaving: [] }),
  api: (context) => {
    const { store } = context;
    let next = 2;
    return {
      add() {
        const name = `${NAMES[next % NAMES.length]}${next >= NAMES.length ? ` (${Math.floor(next / NAMES.length) + 1})` : ''}`;
        next += 1;
        store.set({ items: [...store.get().items, name] });
      },
      dismiss(key: string) {
        if (!store.get().leaving.includes(key)) store.set({ leaving: [...store.get().leaving, key] });
      },
      remove(key: string) {
        const { items, leaving } = store.get();
        store.set({ items: items.filter((k) => k !== key), leaving: leaving.filter((k) => k !== key) });
      },
    };
  },
  slots: (slot) => ({
    root: slot<object, { items: string[] }>({ state: (state) => ({ items: state.items }) }),
    add: slot({ attrs: () => ({ type: 'button' }), press: ({ api }) => api.add() }),
    item: slot<{ value: string }>({
      props: { value: 'string' },
      attrs: () => ({ role: 'listitem' }),
      bind: (el, { api, key, store }) => {
        let stop = animateIn(el);
        const unsubscribe = store.subscribe(() => {
          if (!store.get().leaving.includes(key) || el.hasAttribute('data-ending-style')) return;
          stop();
          stop = animateOut(el, () => api.remove(key));
        });
        return () => {
          unsubscribe();
          stop();
        };
      },
    }),
    done: slot<{ value: string }>({
      props: { value: 'string' },
      attrs: () => ({ type: 'button' }),
      press: ({ api, key }) => api.dismiss(key),
    }),
  }),
  agent: { actions: ['add', 'dismiss'] },
});

const { Root: Reminders, Add: RemindersAdd, Item: Reminder, Done: ReminderDone } = createParts(reminders, {
  root: 'div',
  add: 'button',
  item: 'div',
  done: 'button',
});

export default function PresenceDemo() {
  return (
    <Reminders className="mx-auto grid w-full max-w-sm gap-3">
      {({ items }) => (
        <>
          <RemindersAdd className={buttonVariants({ variant: 'secondary', size: 'sm' })}>Add reminder</RemindersAdd>
          <div role="list" aria-label="Reminders" className="grid overflow-hidden rounded-card bg-card shadow-hairline">
            {items.map((name) => (
              <Reminder
                key={name}
                value={name}
                className="grid grid-rows-[1fr] transition-[grid-template-rows,opacity,translate] duration-spring-smooth ease-spring-smooth data-starting-style:grid-rows-[0fr] data-starting-style:opacity-0 data-ending-style:grid-rows-[0fr] data-ending-style:opacity-0 motion-safe:data-starting-style:-translate-y-2 motion-reduce:transition-opacity"
              >
                <div className="flex min-h-0 items-center gap-3 overflow-hidden border-b border-border px-4 last:border-b-0">
                  <ReminderDone
                    value={name}
                    aria-label={`Complete ${name}`}
                    className="grid size-6 shrink-0 cursor-pointer place-items-center rounded-full border-0 bg-secondary text-foreground/70 outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/45"
                  >
                    <Icon name="checkmark" size={13} />
                  </ReminderDone>
                  <span className="flex h-row items-center text-body text-foreground">{name}</span>
                </div>
              </Reminder>
            ))}
          </div>
        </>
      )}
    </Reminders>
  );
}
