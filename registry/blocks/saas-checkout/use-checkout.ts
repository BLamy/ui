/* The checkout's state: which step is open, the draft order, and the payment in flight. One hook, shared with the
   steps, the summary and the receipt through CheckoutCtx. */
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_DRAFT, charge, clampSeats, findPromo, planById, quote, receiptFor, receiptIdFor,
  type Account, type Billing, type CardDetails, type Draft, type Receipt,
} from './checkout';
import { TEST_CARDS, type Cycle, type DeclineCode, type PlanId } from './data';

export type Step = 'plan' | 'account' | 'payment' | 'done';
export const STEPS = ['plan', 'account', 'payment'] as const;

/** A partial draft to open on: `{ plan: 'business', account: { email: '…' } }`. */
export interface DraftInit extends Partial<Omit<Draft, 'account' | 'card' | 'billing'>> {
  account?: Partial<Account>;
  card?: Partial<CardDetails>;
  billing?: Partial<Billing>;
}

export interface Decline {
  code: DeclineCode;
  /** The payment form field it is about. */
  field: 'cardNumber' | 'expiry' | 'cvc';
  message: string;
}

function draftFrom(init: DraftInit | undefined, step: Step): Draft {
  const plan = planById(init?.plan ?? DEFAULT_DRAFT.plan);
  const card = { ...DEFAULT_DRAFT.card, ...init?.card };
  // A block opened on its receipt still needs a card to have paid with.
  if (step === 'done' && !card.number) Object.assign(card, { number: TEST_CARDS[0].number, expiry: '12 / 34', cvc: '123' });
  return {
    ...DEFAULT_DRAFT,
    ...init,
    plan: plan.id,
    seats: clampSeats(plan, init?.seats ?? DEFAULT_DRAFT.seats),
    promo: init?.promo?.trim().toUpperCase() || null,
    account: { ...DEFAULT_DRAFT.account, ...init?.account },
    card,
    billing: { ...DEFAULT_DRAFT.billing, ...init?.billing },
  };
}

/** Which card field each payment-form field edits. */
const CARD_FIELD = { cardNumber: 'number', expiry: 'expiry', cvc: 'cvc' } as const;

export function useCheckout({ initialStep = 'plan', initial, today: todayProp }: { initialStep?: Step; initial?: DraftInit; today?: Date }) {
  const [today] = useState(() => todayProp ?? new Date());
  const [step, setStep] = useState<Step>(initialStep);
  // Whether the open step was reached by moving through the flow (its heading takes focus) or opened on.
  const [moved, setMoved] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => draftFrom(initial, initialStep));
  const [status, setStatus] = useState<'idle' | 'processing' | 'paid'>('idle');
  const [decline, setDecline] = useState<Decline | null>(null);
  const [receipt, setReceipt] = useState<Receipt | null>(() =>
    initialStep === 'done' ? receiptFor(draft, receiptIdFor(draft), today) : null);

  const inflight = useRef<AbortController | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => { inflight.current?.abort(); clearTimeout(timer.current); }, []);

  const goTo = (next: Step) => { setMoved(true); setStep(next); };

  return {
    step, moved, draft, today, status, decline, receipt,
    quote: quote(draft),
    goTo,
    setPlan: (plan: PlanId) => setDraft((d) => ({ ...d, plan, seats: clampSeats(planById(plan), d.seats) })),
    setCycle: (cycle: Cycle) => setDraft((d) => ({ ...d, cycle })),
    setSeats: (seats: number) => setDraft((d) => ({ ...d, seats: clampSeats(planById(d.plan), seats) })),
    /** Applies a code; returns why it can't be, or null. */
    applyPromo: (code: string) => {
      const found = findPromo(code, draft.plan);
      if ('error' in found) return found.error;
      setDraft((d) => ({ ...d, promo: found.promo.code }));
      return null;
    },
    removePromo: () => setDraft((d) => ({ ...d, promo: null })),
    setAccount: (patch: Partial<Account>) => setDraft((d) => ({ ...d, account: { ...d.account, ...patch } })),
    setCard: (patch: Partial<CardDetails>) => {
      setDraft((d) => ({ ...d, card: { ...d.card, ...patch } }));
      // Editing the field a decline was about clears it (the form drops the server error the same way).
      if (decline && CARD_FIELD[decline.field] in patch) setDecline(null);
    },
    setBilling: (patch: Partial<Billing>) => setDraft((d) => ({ ...d, billing: { ...d.billing, ...patch } })),
    /** Sends the draft to the mock processor; a decline comes back on `decline`, success opens the receipt. */
    pay: () => {
      if (status !== 'idle') return;
      setStatus('processing');
      setDecline(null);
      const ctrl = new AbortController();
      inflight.current = ctrl;
      const paying = draft;
      charge(paying.card, quote(paying).total, ctrl.signal).then((result) => {
        if (!result.ok) {
          setStatus('idle');
          setDecline({ code: result.code, field: result.field, message: result.message });
          return;
        }
        // A beat on the button's "Paid" before the receipt replaces the form.
        setStatus('paid');
        timer.current = setTimeout(() => {
          setReceipt(receiptFor(paying, result.id, today));
          goTo('done');
        }, 700);
      }, () => { /* aborted: the block unmounted or started over */ });
    },
    /** Back to the first step with the draft the block opened with. */
    restart: () => {
      inflight.current?.abort();
      clearTimeout(timer.current);
      setDraft(draftFrom(initial, 'plan'));
      setStatus('idle');
      setDecline(null);
      setReceipt(null);
      goTo('plan');
    },
  };
}

export type Checkout = ReturnType<typeof useCheckout>;

export const CheckoutCtx = createContext<Checkout | null>(null);

export function useCheckoutCtx(): Checkout {
  const c = useContext(CheckoutCtx);
  if (!c) throw new Error('useCheckoutCtx must be used inside the SaaS checkout block');
  return c;
}
