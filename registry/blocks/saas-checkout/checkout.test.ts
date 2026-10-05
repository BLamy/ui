import { describe, expect, it } from 'vitest';
import {
  DEFAULT_DRAFT, cardBrand, cardNumberError, charge, clampSeats, cvcError, expiryError, findPromo, formatCardNumber,
  formatExpiry, luhn, planById, postalError, quote, renewsOn, slugify, taxFor,
} from './checkout';
import { TEST_CARDS } from './data';

const TODAY = new Date('2026-10-04T10:00:00');

describe('card numbers', () => {
  it('knows the brand from the leading digits', () => {
    expect(cardBrand('4242')).toBe('visa');
    expect(cardBrand('5555 5555')).toBe('mastercard');
    expect(cardBrand('2223003122003222')).toBe('mastercard');
    expect(cardBrand('3782')).toBe('amex');
    expect(cardBrand('6011')).toBe('discover');
    expect(cardBrand('9999')).toBe('unknown');
  });

  it('groups as it formats, Amex 4-6-5, and drops what does not fit', () => {
    expect(formatCardNumber('4242424242424242')).toBe('4242 4242 4242 4242');
    expect(formatCardNumber('424242424242424299')).toBe('4242 4242 4242 4242');
    expect(formatCardNumber('378282246310005')).toBe('3782 822463 10005');
    expect(formatCardNumber('42a42 ')).toBe('4242');
  });

  it('checks the Luhn digit, and every test card passes it', () => {
    for (const t of TEST_CARDS) expect(luhn(t.number)).toBe(true);
    expect(luhn('4242424242424241')).toBe(false);
    expect(cardNumberError('4242 4242 4242 4241')).toMatch(/invalid/);
    expect(cardNumberError('4242 4242')).toMatch(/incomplete/);
    expect(cardNumberError('')).toMatch(/Enter/);
    expect(cardNumberError('4242 4242 4242 4242')).toBeNull();
  });

  it('formats the expiry as MM / YY and rejects past or impossible dates', () => {
    expect(formatExpiry('4')).toBe('04');
    expect(formatExpiry('1')).toBe('1');
    expect(formatExpiry('1228')).toBe('12 / 28');
    expect(expiryError('12 / 28', TODAY)).toBeNull();
    expect(expiryError('10 / 26', TODAY)).toBeNull();
    expect(expiryError('09 / 26', TODAY)).toMatch(/past/);
    expect(expiryError('13 / 28', TODAY)).toMatch(/month/);
    expect(expiryError('12 / 2', TODAY)).toMatch(/incomplete/);
  });

  it('wants four security digits for Amex and three otherwise', () => {
    expect(cvcError('123', 'visa')).toBeNull();
    expect(cvcError('123', 'amex')).toMatch(/incomplete/);
    expect(cvcError('1234', 'amex')).toBeNull();
    expect(cvcError('1234', 'visa')).toMatch(/invalid/);
  });
});

describe('the order', () => {
  it('prices seats × the cycle’s per-seat price × its months', () => {
    expect(quote({ ...DEFAULT_DRAFT, plan: 'pro', cycle: 'annual', seats: 5 }).subtotal).toBe(96000);
    expect(quote({ ...DEFAULT_DRAFT, plan: 'pro', cycle: 'monthly', seats: 5 }).subtotal).toBe(10000);
    expect(quote({ ...DEFAULT_DRAFT, plan: 'pro', cycle: 'monthly', seats: 5 }).annualSaving).toBe(24000);
  });

  it('keeps seats inside the plan’s range', () => {
    expect(clampSeats(planById('starter'), 40)).toBe(10);
    expect(clampSeats(planById('business'), 2)).toBe(5);
    expect(clampSeats(planById('pro'), Number.NaN)).toBe(1);
  });

  it('applies a promotion to the first payment, then taxes what is left', () => {
    const q = quote({ ...DEFAULT_DRAFT, plan: 'pro', cycle: 'annual', seats: 5, promo: 'LAUNCH20', billing: { country: 'GB', postal: '' } });
    expect(q.discount).toBe(19200);
    expect(q.tax).toMatchObject({ label: 'VAT', rate: 0.2, amount: 15360 });
    expect(q.total).toBe(96000 - 19200 + 15360);
    expect(q.renewal).toBe(96000 + 19200);
  });

  it('caps a fixed discount at the subtotal', () => {
    expect(quote({ ...DEFAULT_DRAFT, plan: 'starter', cycle: 'monthly', seats: 1, promo: 'WELCOME25' }).discount).toBe(1000);
  });

  it('turns codes down with a reason, and drops a discount the plan no longer qualifies for', () => {
    expect(findPromo(' launch20 ', 'pro')).toMatchObject({ promo: { code: 'LAUNCH20' } });
    expect(findPromo('SUMMER24', 'pro')).toMatchObject({ error: expect.stringMatching(/expired/) });
    expect(findPromo('SCALE30', 'pro')).toMatchObject({ error: expect.stringMatching(/Business/) });
    expect(findPromo('NOPE', 'pro')).toMatchObject({ error: expect.stringMatching(/valid/) });
    const q = quote({ ...DEFAULT_DRAFT, plan: 'pro', promo: 'SCALE30' });
    expect(q.discount).toBe(0);
    expect(q.promoError).toMatch(/Business/);
  });

  it('needs a complete US ZIP before it can tax, and checks postal codes by country', () => {
    expect(taxFor({ country: 'US', postal: '941' })).toBeNull();
    expect(taxFor({ country: 'US', postal: '94107' })).toEqual({ label: 'Sales tax', rate: 0.0875 });
    expect(postalError('94107', 'US')).toBeNull();
    expect(postalError('9410', 'US')).toMatch(/ZIP/);
    expect(postalError('m5v 2t6', 'CA')).toBeNull();
    expect(postalError('EC1V 9HX', 'GB')).toBeNull();
  });

  it('renews a month or a year on', () => {
    expect(renewsOn(TODAY, 'annual').getFullYear()).toBe(2027);
    expect(renewsOn(TODAY, 'monthly').getMonth()).toBe(10);
  });

  it('makes a workspace URL from its name', () => {
    expect(slugify('Acme Rockets, Inc.')).toBe('acme-rockets-inc');
    expect(slugify('  Café  Crème ')).toBe('cafe-creme');
  });
});

describe('the mock processor', () => {
  const card = (number: string) => ({ number, expiry: '12 / 30', cvc: '123', name: 'Jane' });

  it('declines the decline cards, naming the field, and charges the rest', async () => {
    const [ok, declined, , cvc] = await Promise.all([
      charge(card('4242 4242 4242 4242'), 1000),
      charge(card('4000 0000 0000 0002'), 1000),
      charge(card('4000 0000 0000 9995'), 1000),
      charge(card('4000 0000 0000 0127'), 1000),
    ]);
    expect(ok).toMatchObject({ ok: true });
    expect(declined).toMatchObject({ ok: false, code: 'card_declined', field: 'cardNumber' });
    expect(cvc).toMatchObject({ ok: false, code: 'incorrect_cvc', field: 'cvc' });
  });

  it('stops when aborted', async () => {
    const ctrl = new AbortController();
    const pending = charge(card('4242424242424242'), 1000, ctrl.signal);
    ctrl.abort();
    await expect(pending).rejects.toThrow(/Aborted/);
  });
});
