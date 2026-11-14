import { definePrimitive } from '@ui-sdk/core';
import { bindPullToRefresh } from '@/lib/pull-to-refresh';
import { createParts } from '@ui-sdk/react/primitive';
import { useState } from 'react';
import { buttonVariants } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

type InboxOptions = { onRefresh?: () => unknown };

/* A scroller that reloads when it is pulled down from its top with a finger. `bindPullToRefresh` writes everything
   on the scroller itself, without a render: `data-pulling` while a finger pulls, `--pull-distance` (rubber-banded,
   0 under reduced motion) and `--pull-progress` (0 to 1 at the threshold), and `data-pending` with `aria-busy`
   while the Promise `onRefresh` returned is pending. The returned handle is its cleanup and has `refresh()`, for a
   button or a key: a mouse never pulls. */
const inbox = definePrimitive({
  name: 'inbox',
  options: { onRefresh: 'action' },
  state: (_options: InboxOptions) => ({}),
  api: (context) => {
    let pull: ReturnType<typeof bindPullToRefresh> | undefined;
    return {
      bind(el: HTMLElement) {
        pull = bindPullToRefresh(el, { onRefresh: () => context.options().onRefresh?.() });
        return pull;
      },
      refresh: () => pull?.refresh(),
    };
  },
  slots: (slot) => ({
    root: slot({}),
    list: slot({ bind: (el, { api }) => api.bind(el) }),
    refresh: slot({ attrs: () => ({ type: 'button' }), press: ({ api }) => api.refresh() }),
    indicator: slot({ attrs: () => ({ 'aria-hidden': 'true' }) }),
  }),
  agent: { actions: ['refresh'] },
});

const { Root: Inbox, List: InboxList, Refresh: InboxRefresh, Indicator: InboxIndicator } = createParts(inbox, {
  root: 'div',
  list: 'div',
  refresh: 'button',
  indicator: 'div',
});

const SENDERS = ['Ana', 'Wei', 'Malik', 'Jo', 'Priya', 'Sam'];

export default function PullToRefreshDemo() {
  const [messages, setMessages] = useState(['Wei · Lunch?', 'Ana · Slides attached', 'Jo · Re: invoice']);
  const load = () =>
    new Promise<void>((resolve) =>
      setTimeout(() => {
        setMessages((list) => [`${SENDERS[list.length % SENDERS.length]} · New message ${list.length + 1}`, ...list]);
        resolve();
      }, 900),
    );
  return (
    <Inbox onRefresh={load} className="mx-auto grid w-full max-w-sm gap-3">
      <InboxRefresh className={buttonVariants({ variant: 'secondary', size: 'sm' })}>Refresh</InboxRefresh>
      <InboxList
        aria-label="Messages"
        className="group/inbox relative h-72 overflow-y-auto rounded-card bg-card shadow-hairline"
      >
        <InboxIndicator className="absolute inset-x-0 top-3 flex justify-center opacity-(--pull-progress,0) group-data-pending/inbox:opacity-100">
          <Spinner size={18} />
        </InboxIndicator>
        <div className="translate-y-(--pull-distance,0px) bg-card transition-[translate] duration-spring-smooth ease-spring-smooth group-data-pulling/inbox:transition-none motion-reduce:transition-none">
          {messages.map((message) => (
            <div key={message} className="flex h-row items-center border-b border-border px-4 text-body text-foreground last:border-b-0">
              {message}
            </div>
          ))}
        </div>
      </InboxList>
    </Inbox>
  );
}
