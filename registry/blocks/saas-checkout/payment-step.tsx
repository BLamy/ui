/* Step 3 — the card and the billing address, then the payment. The number groups itself as you type and shows its
   brand, the security code follows the brand's length, the postal code follows the country (and sets the tax).
   Paying waits on the mock processor; a decline puts its message under the field it is about and focus on it. The
   test cards fill the form in one press; resting on one shows its whole number and what the processor will answer. */
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Form } from '@/components/ui/form';
import { HoverCard, HoverCardContent, HoverCardHeader, HoverCardTrigger, createHoverCardController } from '@/components/ui/hover-card';
import { IconSwap } from '@/components/ui/icon-swap';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectTrigger } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import {
  BRAND_NAMES, cardBrand, cardNumberError, cvcError, cvcLength, expiryError, formatCardNumber, formatCvc, formatExpiry, formatPostal,
  longDate, money, postalError, renewsOn,
} from './checkout';
import { COUNTRIES, DECLINES, PRODUCT, TEST_CARDS, type CountryId } from './data';
import { BrandMark, ErrorText, SOFT_INK, StepActions, StepHeading, useFormattedInput, useStepErrors } from './parts';
import { useCheckoutCtx } from './use-checkout';

const ACCEPTED = ['visa', 'mastercard', 'amex', 'discover'] as const;
const COUNTRY_ITEMS = COUNTRIES.map((x) => ({ value: x.id, label: x.name }));
type TestCard = (typeof TEST_CARDS)[number];

export function PaymentStep() {
  const c = useCheckoutCtx();
  const { card, billing } = c.draft;
  const q = c.quote;
  const brand = cardBrand(card.number);
  const country = COUNTRIES.find((x) => x.id === billing.country) ?? COUNTRIES[0];
  const busy = c.status !== 'idle';
  const box = useRef<HTMLDivElement | null>(null);

  const onNumber = useFormattedInput(formatCardNumber, (number) => c.setCard({ number }));
  const onExpiry = useFormattedInput(formatExpiry, (expiry) => c.setCard({ expiry }));
  const onCvc = useFormattedInput((raw) => formatCvc(raw, brand), (cvc) => c.setCard({ cvc }));
  const onPostal = useFormattedInput((raw) => formatPostal(raw, billing.country), (postal) => c.setBilling({ postal }));

  // A decline shows under the field it is about until that field changes, and focus goes there.
  const v = useStepErrors({
    cardNumber: cardNumberError(card.number),
    expiry: expiryError(card.expiry, c.today),
    cvc: cvcError(card.cvc, brand),
    cardName: card.name.trim() ? null : 'Enter the name on your card.',
    postal: postalError(billing.postal, billing.country),
  }, c.decline ? { [c.decline.field]: c.decline.message } : undefined);
  useEffect(() => {
    if (c.decline) box.current?.querySelector<HTMLInputElement>(`input[name="${c.decline.field}"]`)?.focus();
  }, [c.decline]);

  /** Fills the form with a test card; keeps an expiry and security code that already fit it. */
  const fillTestCard = (number: string) => {
    const nextBrand = cardBrand(number);
    const year = String((c.today.getFullYear() + 3) % 100).padStart(2, '0');
    c.setCard({
      number: formatCardNumber(number),
      expiry: card.expiry && !expiryError(card.expiry, c.today) ? card.expiry : `12 / ${year}`,
      cvc: card.cvc.length === cvcLength(nextBrand) ? card.cvc : '1234'.slice(0, cvcLength(nextBrand)),
      name: card.name || c.draft.account.name,
    });
  };

  return (
    <div ref={box}>
      <Form noValidate className="gap-5" onSubmit={(e) => {
        e.preventDefault();
        if (!v.check(e.currentTarget)) return;
        // Keep focus on the Pay button while the fields lock (Enter may have come from one of them).
        e.currentTarget.querySelector<HTMLElement>('button[type="submit"]')?.focus();
        c.pay();
      }}>
        <StepHeading title="Payment" description="Billed in US dollars. Cancel any time from Settings&nbsp;›&nbsp;Billing." focus={c.moved} />
        <TestCards disabled={busy} onPick={fillTestCard} />

        <Field name="cardNumber" disabled={busy} invalid={v.invalid('cardNumber') || undefined}>
          <FieldLabel>Card number</FieldLabel>
          <div className="relative">
            <Input required value={card.number} onValueChange={onNumber} inputMode="numeric" autoComplete="cc-number" placeholder="1234 1234 1234 1234"
              className={cn('tabular-nums', card.number ? 'pr-14' : 'pr-[136px]')} />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
              <IconSwap id={card.number ? brand : 'accepted'}>
                {card.number ? <BrandMark brand={brand} className="text-tertiary-foreground" /> : (
                  <span className="flex gap-1">{ACCEPTED.map((b) => <BrandMark key={b} brand={b} className="h-4 w-[26px]" />)}</span>
                )}
              </IconSwap>
            </span>
          </div>
          <ErrorText>{v.error('cardNumber')}</ErrorText>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field name="expiry" disabled={busy} invalid={v.invalid('expiry') || undefined}>
            <FieldLabel>Expiration</FieldLabel>
            <Input required value={card.expiry} onValueChange={onExpiry} inputMode="numeric" autoComplete="cc-exp" placeholder="MM / YY" className="tabular-nums" />
            <ErrorText>{v.error('expiry')}</ErrorText>
          </Field>
          <Field name="cvc" disabled={busy} invalid={v.invalid('cvc') || undefined}>
            <FieldLabel>Security code</FieldLabel>
            <Input required value={card.cvc} onValueChange={onCvc} inputMode="numeric" autoComplete="cc-csc" placeholder={brand === 'amex' ? '4 digits' : '3 digits'} className="tabular-nums" />
            <ErrorText>{v.error('cvc')}</ErrorText>
          </Field>
        </div>

        <Field name="cardName" disabled={busy} invalid={v.invalid('cardName') || undefined}>
          <FieldLabel>Name on card</FieldLabel>
          <Input required value={card.name} onValueChange={(name) => c.setCard({ name })} autoComplete="cc-name" placeholder="Jane Appleseed" />
          <ErrorText>{v.error('cardName')}</ErrorText>
        </Field>

        <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-3">
          <Field name="country" disabled={busy}>
            <FieldLabel>Country or region</FieldLabel>
            <Select<CountryId> items={COUNTRY_ITEMS} value={billing.country}
              onValueChange={(id) => { if (id) c.setBilling({ country: id, postal: '' }); }}>
              <SelectTrigger />
              <SelectContent />
            </Select>
          </Field>
          <Field name="postal" disabled={busy} invalid={v.invalid('postal') || undefined}>
            <FieldLabel>{country.postal.label}</FieldLabel>
            <Input required value={billing.postal} onValueChange={onPostal} autoComplete="postal-code" inputMode={billing.country === 'US' ? 'numeric' : 'text'} placeholder={country.postal.placeholder} />
            <ErrorText>{v.error('postal')}</ErrorText>
          </Field>
        </div>

        <StepActions onBack={() => c.goTo('account')} backDisabled={busy}>
          <Button type="submit" size="lg" className="w-full @md:w-auto @md:min-w-[220px]">
            {c.status === 'processing' ? <><Spinner spin size={18} /> Processing…</>
              : c.status === 'paid' ? <><Icon name="check" size={18} sw={2.8} /> Paid</>
              : `Pay ${money(q.total)}`}
          </Button>
        </StepActions>
        <p className={cn('m-0 text-footnote leading-[18px]', SOFT_INK)}>
          By paying you authorize {PRODUCT.name} to charge {money(q.total)} today and {money(q.renewal)}{q.tax ? '' : ' plus tax'} every{' '}
          {c.draft.cycle === 'annual' ? 'year' : 'month'} from {longDate(renewsOn(c.today, c.draft.cycle))} until you cancel.
        </p>
        {/* Announces the payment's progress, and why it failed the moment it does (the message also stays under the field). */}
        <p role="status" className="sr-only">{c.status === 'processing' ? 'Processing your payment…' : c.status === 'paid' ? 'Payment complete.' : ''}</p>
        <p role="alert" className="sr-only">{c.decline ? `Payment failed. ${c.decline.message}` : ''}</p>
      </Form>
    </div>
  );
}

/** A test card's hover card: the full number (selectable, to paste elsewhere), its brand, and the processor's answer. */
function TestCardPreview({ test }: { test: TestCard }) {
  const brand = cardBrand(test.number);
  return (
    <div className="flex flex-col gap-2">
      <HoverCardHeader media={<BrandMark brand={brand} />} title={test.label} subtitle={`${BRAND_NAMES[brand]} test card`} />
      <code className="block rounded-ctl bg-secondary px-2 py-1 text-footnote tabular-nums text-foreground select-text">{formatCardNumber(test.number)}</code>
      <p className={cn('m-0 text-footnote leading-[18px]', SOFT_INK)}>
        {test.outcome === 'success' ? 'The payment goes through.' : `Declined: “${DECLINES[test.outcome].message}”`} Any future expiry and any CVC.
      </p>
    </div>
  );
}

/** Test mode: the processor's cards, each with a different ending. Pressing one fills the card fields; one hover card
 *  previews whichever the pointer or focus rests on. */
function TestCards({ disabled, onPick }: { disabled: boolean; onPick: (number: string) => void }) {
  const [preview] = useState(() => createHoverCardController<TestCard>());
  return (
    <div className="flex flex-col gap-2 rounded-panel border border-dashed border-border p-3">
      <p className="m-0 flex items-center gap-1.5 text-footnote leading-[18px] text-foreground">
        <Icon name="info" size={16} className="shrink-0 text-primary" />
        <span><span className="font-semibold">Test mode.</span> <span className={SOFT_INK}>Nothing is charged — pick a card, then pay.</span></span>
      </p>
      <div role="group" aria-label="Test cards" className="flex flex-wrap gap-1.5">
        {TEST_CARDS.map((t) => (
          <HoverCardTrigger key={t.number} controller={preview} payload={t}
            render={<Button size="sm" variant="secondary" disabled={disabled} onClick={() => onPick(t.number)}
              aria-label={`Use test card ending ${t.number.slice(-4)}: ${t.label.toLowerCase()}`} className="h-7 gap-1.5 px-2.5 font-medium" />}>
            <span className="tabular-nums">{t.number.slice(-4)}</span>
            <span className={SOFT_INK}>{t.label}</span>
          </HoverCardTrigger>
        ))}
      </div>
      <HoverCard controller={preview}>
        <HoverCardContent<TestCard> side="top">{({ payload }) => (payload ? <TestCardPreview test={payload} /> : null)}</HoverCardContent>
      </HoverCard>
    </div>
  );
}
