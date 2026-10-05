/* Sample content for the checkout: the product, its plans, promotion codes, billing countries with their (invented)
   tax rates, and the test cards the mock processor knows. Replace it with your catalog and your payment provider. */

export type PlanId = 'starter' | 'pro' | 'business';
export type Cycle = 'monthly' | 'annual';

export interface Plan {
  id: PlanId;
  name: string;
  blurb: string;
  /** Price per seat per month, in whole dollars, for each billing cycle (annual is billed 12 months at a time). */
  price: Record<Cycle, number>;
  seats: { min: number; max: number };
  features: string[];
  popular?: boolean;
}

export const PRODUCT = { name: 'Orbit', domain: 'orbit.app', tagline: 'Plan, track and ship together' } as const;

/** What annual billing saves against paying monthly, as shown on the cycle toggle. */
export const ANNUAL_SAVING = 0.2;

export const PLANS: Plan[] = [
  {
    id: 'starter', name: 'Starter', blurb: 'For small teams getting organized.',
    price: { monthly: 10, annual: 8 }, seats: { min: 1, max: 10 },
    features: ['Unlimited issues', 'Up to 10 members', 'GitHub & Slack'],
  },
  {
    id: 'pro', name: 'Pro', blurb: 'For growing teams that ship every week.',
    price: { monthly: 20, annual: 16 }, seats: { min: 1, max: 250 }, popular: true,
    features: ['Everything in Starter', 'Roadmaps & insights', 'Guest access'],
  },
  {
    id: 'business', name: 'Business', blurb: 'For companies with security reviews.',
    price: { monthly: 40, annual: 32 }, seats: { min: 5, max: 1000 },
    features: ['Everything in Pro', 'SAML SSO & SCIM', 'Audit log'],
  },
];

export interface Promo {
  code: string;
  /** `percent` takes `value`% off the first payment; `amount` takes `value` dollars off it. */
  kind: 'percent' | 'amount';
  value: number;
  /** Shown under the applied code. */
  label: string;
  /** Only these plans qualify. */
  plans?: PlanId[];
  /** Set for a code that no longer works: the date it ended. */
  expired?: string;
}

/** Codes are matched without regard to case or surrounding spaces. Discounts apply to the first payment only. */
export const PROMOS: Promo[] = [
  { code: 'LAUNCH20', kind: 'percent', value: 20, label: '20% off your first payment' },
  { code: 'WELCOME25', kind: 'amount', value: 25, label: '$25 off your first payment' },
  { code: 'SCALE30', kind: 'percent', value: 30, label: '30% off Business', plans: ['business'] },
  { code: 'SUMMER24', kind: 'percent', value: 15, label: '15% off', expired: 'September 1, 2024' },
];

export type CountryId = 'US' | 'CA' | 'GB' | 'DE' | 'FR' | 'NL' | 'AU' | 'JP' | 'SG';

export interface Country {
  id: CountryId;
  name: string;
  /** The postal code's name, an example, and the shape it must have. */
  postal: { label: string; placeholder: string; pattern: RegExp };
  /** A flat rate (VAT, GST), or `zip` for a US-style rate looked up from the postal code. */
  tax: { label: string; rate: number } | 'zip';
}

export const COUNTRIES: Country[] = [
  { id: 'US', name: 'United States', postal: { label: 'ZIP', placeholder: '94107', pattern: /^\d{5}$/ }, tax: 'zip' },
  { id: 'CA', name: 'Canada', postal: { label: 'Postal code', placeholder: 'M5V 2T6', pattern: /^[A-Z]\d[A-Z] ?\d[A-Z]\d$/i }, tax: { label: 'GST', rate: 0.05 } },
  { id: 'GB', name: 'United Kingdom', postal: { label: 'Postcode', placeholder: 'EC1V 9HX', pattern: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i }, tax: { label: 'VAT', rate: 0.2 } },
  { id: 'DE', name: 'Germany', postal: { label: 'Postal code', placeholder: '10115', pattern: /^\d{5}$/ }, tax: { label: 'VAT', rate: 0.19 } },
  { id: 'FR', name: 'France', postal: { label: 'Postal code', placeholder: '75002', pattern: /^\d{5}$/ }, tax: { label: 'VAT', rate: 0.2 } },
  { id: 'NL', name: 'Netherlands', postal: { label: 'Postal code', placeholder: '1012 AB', pattern: /^\d{4} ?[A-Z]{2}$/i }, tax: { label: 'VAT', rate: 0.21 } },
  { id: 'AU', name: 'Australia', postal: { label: 'Postcode', placeholder: '2000', pattern: /^\d{4}$/ }, tax: { label: 'GST', rate: 0.1 } },
  { id: 'JP', name: 'Japan', postal: { label: 'Postal code', placeholder: '100-0001', pattern: /^\d{3}-?\d{4}$/ }, tax: { label: 'JCT', rate: 0.1 } },
  { id: 'SG', name: 'Singapore', postal: { label: 'Postal code', placeholder: '018956', pattern: /^\d{6}$/ }, tax: { label: 'GST', rate: 0.09 } },
];

/** US sales tax by the ZIP code's first digit. Invented for the demo: a real checkout asks its tax provider. */
export const US_SALES_TAX = [0.0625, 0.08, 0.06, 0.07, 0.07, 0.069, 0.0825, 0.0825, 0.076, 0.0875];

export type DeclineCode = 'card_declined' | 'insufficient_funds' | 'incorrect_cvc' | 'expired_card';

/** The mock processor's test cards (Stripe's numbers): any expiry in the future and any CVC. Other valid numbers succeed. */
export const TEST_CARDS: { number: string; label: string; outcome: 'success' | DeclineCode }[] = [
  { number: '4242424242424242', label: 'Succeeds', outcome: 'success' },
  { number: '4000000000000002', label: 'Declined', outcome: 'card_declined' },
  { number: '4000000000009995', label: 'Insufficient funds', outcome: 'insufficient_funds' },
  { number: '4000000000000127', label: 'Wrong CVC', outcome: 'incorrect_cvc' },
  { number: '4000000000000069', label: 'Expired', outcome: 'expired_card' },
];

/** Which field a decline is about, and what to tell the customer. */
export const DECLINES: Record<DeclineCode, { field: 'cardNumber' | 'expiry' | 'cvc'; message: string }> = {
  card_declined: { field: 'cardNumber', message: 'Your card was declined. Try a different card.' },
  insufficient_funds: { field: 'cardNumber', message: 'Your card has insufficient funds. Try a different card.' },
  incorrect_cvc: { field: 'cvc', message: 'Your card’s security code is incorrect.' },
  expired_card: { field: 'expiry', message: 'Your card has expired. Try a different card.' },
};

/** Workspace URLs already in use (the account step says so). */
export const TAKEN_WORKSPACES = ['orbit', 'admin', 'acme'];
