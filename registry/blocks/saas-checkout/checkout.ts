/* The checkout's pure logic: what an order costs (seats × price × months, a promotion, tax), card numbers (brand,
   grouping, the Luhn check), field validation messages, and a mock payment processor. Money is in cents. Nothing
   here touches the network: `charge` only waits, then answers from the test-card table. */
import {
  COUNTRIES, DECLINES, PLANS, PROMOS, TEST_CARDS, US_SALES_TAX,
  type CountryId, type Cycle, type DeclineCode, type Plan, type PlanId, type Promo,
} from './data';

export interface Account { email: string; name: string; workspace: string; updates: boolean }
export interface CardDetails { number: string; expiry: string; cvc: string; name: string }
export interface Billing { country: CountryId; postal: string }

/** Everything the customer has chosen or typed. */
export interface Draft {
  plan: PlanId;
  cycle: Cycle;
  seats: number;
  /** The applied promotion code, if any. */
  promo: string | null;
  account: Account;
  card: CardDetails;
  billing: Billing;
}

export const DEFAULT_DRAFT: Draft = {
  plan: 'pro',
  cycle: 'annual',
  seats: 5,
  promo: null,
  account: { email: '', name: '', workspace: '', updates: true },
  card: { number: '', expiry: '', cvc: '', name: '' },
  billing: { country: 'US', postal: '' },
};

/* ── Money and dates ── */

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const USD_WHOLE = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** `$1,234.50`; whole amounts drop the cents when `whole` is set (`$16`). */
export function money(cents: number, whole = false) {
  return (whole && cents % 100 === 0 ? USD_WHOLE : USD).format(cents / 100);
}

/** Intl options for a NumberMorph showing the same amount as `money`. */
export const MONEY_FORMAT: Intl.NumberFormatOptions = { style: 'currency', currency: 'USD' };

export function longDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

/** The day the subscription renews: a month or a year after `from`. */
export function renewsOn(from: Date, cycle: Cycle) {
  const d = new Date(from);
  if (cycle === 'annual') d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1);
  return d;
}

/* ── Plans, promotions, tax ── */

export const planById = (id: PlanId): Plan => PLANS.find((p) => p.id === id) ?? PLANS[0];

/** Seats clamped to what the plan allows. */
export const clampSeats = (plan: Plan, seats: number) => Math.min(plan.seats.max, Math.max(plan.seats.min, Math.round(seats) || plan.seats.min));

/** Looks a code up. Returns the promotion, or why it can't be applied to `plan`. */
export function findPromo(raw: string, plan: PlanId): { promo: Promo } | { error: string } {
  const code = raw.trim().toUpperCase();
  if (!code) return { error: 'Enter a promotion code.' };
  const promo = PROMOS.find((p) => p.code === code);
  if (!promo) return { error: `“${code}” isn’t a valid code.` };
  if (promo.expired) return { error: `${promo.code} expired on ${promo.expired}.` };
  const ineligible = promoIneligible(promo, plan);
  return ineligible ? { error: ineligible } : { promo };
}

/** Why an applied promotion doesn't cover `plan` (the plan changed after it was applied), or null. */
export function promoIneligible(promo: Promo, plan: PlanId): string | null {
  if (!promo.plans || promo.plans.includes(plan)) return null;
  return `${promo.code} only applies to the ${promo.plans.map((p) => planById(p).name).join(' or ')} plan.`;
}

export interface Tax { label: string; rate: number }

/** The tax for a billing address: a country's flat rate, or (US) a rate from the ZIP's first digit. Null until a
 *  US ZIP is complete. */
export function taxFor(billing: Billing): Tax | null {
  const country = COUNTRIES.find((c) => c.id === billing.country) ?? COUNTRIES[0];
  if (country.tax !== 'zip') return country.tax;
  if (!country.postal.pattern.test(billing.postal.trim())) return null;
  return { label: 'Sales tax', rate: US_SALES_TAX[Number(billing.postal.trim()[0])] };
}

export const percent = (rate: number) => `${+(rate * 100).toFixed(3)}%`;

export interface Quote {
  plan: Plan;
  /** Price per seat per month, in cents. */
  unit: number;
  months: number;
  subtotal: number;
  promo: Promo | null;
  /** Set when the applied promotion doesn't cover the chosen plan; its discount is then 0. */
  promoError: string | null;
  discount: number;
  tax: (Tax & { amount: number }) | null;
  /** Due today. */
  total: number;
  /** Each renewal after the first payment (no promotion, same tax). */
  renewal: number;
  /** What annual billing saves over monthly for these seats, per year. */
  annualSaving: number;
}

export function quote(draft: Pick<Draft, 'plan' | 'cycle' | 'seats' | 'promo' | 'billing'>): Quote {
  const plan = planById(draft.plan);
  const unit = plan.price[draft.cycle] * 100;
  const months = draft.cycle === 'annual' ? 12 : 1;
  const subtotal = unit * draft.seats * months;
  const promo = PROMOS.find((p) => p.code === draft.promo) ?? null;
  const promoError = promo ? promoIneligible(promo, plan.id) : null;
  const discount = !promo || promoError ? 0
    : promo.kind === 'percent' ? Math.round((subtotal * promo.value) / 100) : Math.min(subtotal, promo.value * 100);
  const rate = taxFor(draft.billing);
  const tax = rate ? { ...rate, amount: Math.round((subtotal - discount) * rate.rate) } : null;
  return {
    plan, unit, months, subtotal, promo, promoError, discount, tax,
    total: subtotal - discount + (tax?.amount ?? 0),
    renewal: subtotal + (rate ? Math.round(subtotal * rate.rate) : 0),
    annualSaving: (plan.price.monthly - plan.price.annual) * 100 * draft.seats * 12,
  };
}

/* ── Cards ── */

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover' | 'unknown';

export const BRAND_NAMES: Record<CardBrand, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', discover: 'Discover', unknown: 'Card' };

const digitsOf = (s: string) => s.replace(/\D/g, '');

/** The brand from the number's leading digits (IIN ranges). */
export function cardBrand(number: string): CardBrand {
  const d = digitsOf(number);
  const first4 = Number(d.slice(0, 4));
  if (/^4/.test(d)) return 'visa';
  if (/^3[47]/.test(d)) return 'amex';
  if (/^5[1-5]/.test(d) || (d.length >= 4 && first4 >= 2221 && first4 <= 2720)) return 'mastercard';
  if (/^(6011|65|64[4-9])/.test(d)) return 'discover';
  return 'unknown';
}

/** How many digits a brand's numbers have, and how they're grouped when shown. */
const LAYOUT: Record<CardBrand, number[]> = { amex: [4, 6, 5], visa: [4, 4, 4, 4], mastercard: [4, 4, 4, 4], discover: [4, 4, 4, 4], unknown: [4, 4, 4, 4] };
export const cardLength = (brand: CardBrand) => LAYOUT[brand].reduce((a, b) => a + b, 0);
export const cvcLength = (brand: CardBrand) => (brand === 'amex' ? 4 : 3);

/** `4242424242424242` → `4242 4242 4242 4242`; Amex as 4-6-5. Extra digits are dropped. */
export function formatCardNumber(raw: string) {
  const d = digitsOf(raw);
  const groups = LAYOUT[cardBrand(d)];
  const out: string[] = [];
  let at = 0;
  for (const size of groups) {
    if (at >= d.length) break;
    out.push(d.slice(at, at + size));
    at += size;
  }
  return out.join(' ');
}

/** The Luhn checksum every card number carries. */
export function luhn(number: string) {
  const d = digitsOf(number);
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2) n = n * 2 > 9 ? n * 2 - 9 : n * 2;
    sum += n;
  }
  return d.length > 0 && sum % 10 === 0;
}

/** `1` → `1`, `4` → `04`, `1228` → `12 / 28`. Months 2–9 get their leading zero as you type. */
export function formatExpiry(raw: string) {
  let d = digitsOf(raw).slice(0, 4);
  if (/^[2-9]/.test(d)) d = ('0' + d).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)} / ${d.slice(2)}` : d;
}

export const formatCvc = (raw: string, brand: CardBrand) => digitsOf(raw).slice(0, cvcLength(brand));

/** Postal codes in capitals, at most 10 characters (US: five digits). */
export const formatPostal = (raw: string, country: CountryId) =>
  country === 'US' ? digitsOf(raw).slice(0, 5) : raw.toUpperCase().replace(/[^A-Z0-9 -]/g, '').slice(0, 10);

/* ── Validation: a message for an invalid value, or null. Worded like a payment form, not a parser. ── */

export function cardNumberError(value: string) {
  const d = digitsOf(value);
  if (!d) return 'Enter your card number.';
  if (d.length < cardLength(cardBrand(d))) return 'Your card number is incomplete.';
  if (!luhn(d)) return 'Your card number is invalid.';
  return null;
}

export function expiryError(value: string, today: Date) {
  const d = digitsOf(value);
  if (!d) return 'Enter the expiration date.';
  if (d.length < 4) return 'Your card’s expiration date is incomplete.';
  const month = Number(d.slice(0, 2));
  const year = 2000 + Number(d.slice(2));
  if (month < 1 || month > 12) return 'Your card’s expiration month is invalid.';
  if (year * 12 + month < today.getFullYear() * 12 + today.getMonth() + 1) return 'Your card’s expiration date is in the past.';
  return null;
}

export function cvcError(value: string, brand: CardBrand) {
  if (!value) return 'Enter the security code.';
  // Too long happens when the number changes brand after the code was typed (Amex has four digits).
  if (value.length !== cvcLength(brand)) return `Your card’s security code is ${value.length < cvcLength(brand) ? 'incomplete' : 'invalid'}.`;
  return null;
}

export function postalError(value: string, country: CountryId) {
  const c = COUNTRIES.find((x) => x.id === country) ?? COUNTRIES[0];
  if (!value.trim()) return `Enter your ${c.postal.label === 'ZIP' ? 'ZIP' : c.postal.label.toLowerCase()}.`;
  return c.postal.pattern.test(value.trim()) ? null : `That ${c.postal.label === 'ZIP' ? 'ZIP' : c.postal.label.toLowerCase()} doesn’t look right.`;
}

export function emailError(value: string) {
  if (!value.trim()) return 'Enter your work email.';
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()) ? null : 'Enter an email address like jane@company.com.';
}

/** `Acme Rockets, Inc.` → `acme-rockets-inc` (the workspace's URL). */
export const slugify = (name: string) =>
  name.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 32);

/* ── The mock processor ── */

export type ChargeResult = { ok: true; id: string } | { ok: false; code: DeclineCode; field: 'cardNumber' | 'expiry' | 'cvc'; message: string };

/** Charges a card — after a pause, so the processing state shows. The test cards decide the outcome; any other
 *  number that passed validation succeeds. Rejects with an AbortError when `signal` aborts (the block unmounted). */
export function charge(card: CardDetails, amount: number, signal?: AbortSignal): Promise<ChargeResult> {
  const number = digitsOf(card.number);
  const outcome = TEST_CARDS.find((t) => t.number === number)?.outcome ?? 'success';
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (outcome === 'success') resolve({ ok: true, id: receiptId(number, amount) });
      else resolve({ ok: false, code: outcome, ...DECLINES[outcome] });
    }, outcome === 'success' ? 1800 : 1400);
    signal?.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    }, { once: true });
  });
}

/** A receipt number that is the same for the same card and amount, so frames are repeatable. */
function receiptId(number: string, amount: number) {
  let h = amount;
  for (const ch of number) h = (h * 31 + Number(ch)) % 1_000_000;
  return `${String(h).padStart(6, '0').slice(0, 4)}-${String(amount % 10_000).padStart(4, '0')}`;
}

export interface Receipt {
  id: string;
  paidAt: Date;
  quote: Quote;
  cycle: Cycle;
  seats: number;
  brand: CardBrand;
  last4: string;
  account: Account;
}

export function receiptFor(draft: Draft, id: string, paidAt: Date): Receipt {
  const number = digitsOf(draft.card.number);
  return {
    id, paidAt, quote: quote(draft), cycle: draft.cycle, seats: draft.seats,
    brand: cardBrand(number), last4: number.slice(-4), account: draft.account,
  };
}

/** A receipt id for a draft that never went through `charge` (a block opened on its receipt). */
export const receiptIdFor = (draft: Draft) => receiptId(digitsOf(draft.card.number), quote(draft).total);
