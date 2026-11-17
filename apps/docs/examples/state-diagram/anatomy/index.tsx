import { useState } from 'react'
import { and, not } from 'xstate'
import { Segmented, SegmentedItem } from '@/components/ui/segmented'
import { StateDiagram } from '@/components/ui/state-diagram'

/* Every part of a machine and how it's drawn, one machine at a time. */
const MACHINES: Record<string, Record<string, unknown>> = {
  // A header alone; entry and exit actions; an invoke with its done and error; tags, a description and meta; a compound
  // state with its start marked; a final state's square.
  States: {
    id: 'kinds',
    initial: 'atomic',
    states: {
      atomic: { on: { NEXT: 'acting' } },
      acting: { entry: ['startTimer', { type: 'track', params: { screen: 'acting' } }], exit: 'stopTimer', on: { NEXT: 'fetching' } },
      fetching: {
        description: 'Loads the profile',
        tags: ['busy', 'network'],
        meta: { owner: 'profile', retries: 3 },
        invoke: { id: 'profile', src: 'fetchProfile', input: { user: 'me' }, onDone: 'compound', onError: 'failed' },
      },
      compound: { initial: 'first', states: { first: { on: { NEXT: 'second' } }, second: { on: { NEXT: '#kinds.done' } } } },
      failed: { on: { RETRY: 'fetching' } },
      done: { type: 'final' },
    },
  },
  // An event alone is a pill; a guard, actions, a delay, always, reenter, no target, several targets make it a card.
  Transitions: {
    id: 'forms',
    initial: 'idle',
    on: { RESET: { target: '.idle', actions: 'clearAll' } },
    states: {
      idle: {
        on: {
          GO: 'busy',
          TRY: { target: 'busy', guard: 'canTry' },
          SAVE: { target: 'busy', guard: { type: 'isAbove', params: { min: 3 } }, actions: ['save', 'notify'] },
          PING: { actions: 'pong' },
          '*': 'unknown',
        },
        after: { 500: 'busy', IDLE_TIMEOUT: 'away' },
      },
      busy: {
        on: { AGAIN: { target: 'busy', reenter: true, actions: 'restart' }, SPLIT: { target: ['#forms.both.left.on', '#forms.both.right.on'] } },
        always: { guard: and(['isDone', not('isLocked')]), target: 'idle' },
      },
      both: { type: 'parallel', states: { left: { initial: 'off', states: { off: {}, on: {} } }, right: { initial: 'off', states: { off: {}, on: {} } } } },
      away: {},
      unknown: {},
    },
  },
  // Regions side by side, each with its own start.
  Parallel: {
    id: 'editor',
    type: 'parallel',
    states: {
      bold: { initial: 'off', states: { off: { on: { TOGGLE_BOLD: 'on' } }, on: { on: { TOGGLE_BOLD: 'off' } } } },
      italic: { initial: 'off', states: { off: { on: { TOGGLE_ITALIC: 'on' } }, on: { on: { TOGGLE_ITALIC: 'off' } } } },
      list: { initial: 'none', states: { none: { on: { BULLETS: 'bullets', NUMBERS: 'numbers' } }, bullets: { on: { NONE: 'none', NUMBERS: 'numbers' } }, numbers: { on: { NONE: 'none', BULLETS: 'bullets' } } } },
    },
  },
  // H for shallow history, H* for deep.
  History: {
    id: 'player',
    initial: 'playing',
    states: {
      playing: {
        initial: 'track',
        states: { track: { initial: 'one', states: { one: { on: { NEXT: 'two' } }, two: {} } }, ad: {}, shallow: { type: 'history' }, deep: { type: 'history', history: 'deep' } },
        on: { PAUSE: 'paused' },
      },
      paused: { on: { RESUME: 'playing.deep', RESTART: 'playing.shallow' } },
    },
  },
  // A long list grows the card.
  'Long actions': {
    id: 'checkout',
    initial: 'cart',
    context: { items: [], total: 0, coupon: null, address: '', paid: false },
    states: {
      cart: { on: { CHECKOUT: { target: 'paying', actions: ['validateCart', 'reserveStock', 'applyCoupon', 'computeTax', 'computeShipping', 'logCheckout'] } } },
      paying: {
        entry: ['showSpinner', 'lockForm', { type: 'track', params: { step: 'pay' } }, 'startPaymentTimeout'],
        exit: ['hideSpinner', 'unlockForm', 'clearPaymentTimeout'],
        on: { PAID: 'done', DECLINED: 'cart' },
      },
      done: { type: 'final' },
    },
  },
  // Nothing but names: headers and pills.
  'Only names': { id: 'light', initial: 'green', states: { green: { on: { TIMER: 'yellow' } }, yellow: { on: { TIMER: 'red' } }, red: { on: { TIMER: 'green' } } } },
}

export default function Anatomy() {
  const [name, setName] = useState(new URLSearchParams(window.location.search).get('machine') ?? 'States')
  return (
    <div className="grid h-full min-h-[640px] w-full grid-rows-[auto_1fr]">
      <div className="flex flex-wrap gap-2 border-b border-border p-3">
        <Segmented aria-label="Which machine" size="sm" value={name} onValueChange={(value) => { if (value) setName(value) }}>
          {Object.keys(MACHINES).map((n) => <SegmentedItem key={n} value={n}>{n}</SegmentedItem>)}
        </Segmented>
      </div>
      <div className="relative"><StateDiagram key={name} config={MACHINES[name]} aria-label={`${name}, drawn`} /></div>
    </div>
  )
}
