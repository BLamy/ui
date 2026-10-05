/* Step 3 — the card and the billing address, then the payment. The number groups itself as you type and shows its
   brand, the security code follows the brand's length, the postal code follows the country (and sets the tax).
   Paying waits on the mock processor; a decline puts its message under the field it is about and focus on it. The
   test cards fill the form in one press. */
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Form } from '@/components/ui/form';
import { IconSwap } from '@/components/ui/icon-swap';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { TextField } from '@/components/ui/text-field';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import {
  cardBrand, cardNumberError, cvcError, cvcLength, expiryError, formatCardNumber, formatCvc, formatExpiry, formatPostal,
  longDate, money, postalError, renewsOn,
} from './checkout';
import { COUNTRIES, PRODUCT, TEST_CARDS, type CountryId } from './data';
import { BrandMark, ErrorText, SOFT_INK, StepActions, StepHeading, useFormattedInput, useStepErrors } from './parts';
import { useCheckoutCtx } from './use-checkout';

const ACCEPTED = ['visa', 'mastercard', 'amex', 'discover'] as const;

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
      <Form validationBehavior="aria" className="gap-5" onSubmit={(e) => {
        e.preventDefault();
        if (!v.check(e.currentTarget)) return;
        // Keep focus on the Pay button while the fields lock (Enter may have come from one of them).
        e.currentTarget.querySelector<HTMLElement>('button[type="submit"]')?.focus();
        c.pay();
      }}>
        <StepHeading title="Payment" description="Billed in US dollars. Cancel any time from Settings&nbsp;›&nbsp;Billing." focus={c.moved} />
        <TestCards disabled={busy} onPick={fillTestCard} />

        <TextField name="cardNumber" isRequired isDisabled={busy} value={card.number} isInvalid={v.invalid('cardNumber')}>
          <Label>Card number</Label>
          <div className="relative">
            <Input inputMode="numeric" autoComplete="cc-number" placeholder="1234 1234 1234 1234" onChange={onNumber}
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
        </TextField>

        <div className="grid grid-cols-2 gap-3">
          <TextField name="expiry" isRequired isDisabled={busy} value={card.expiry} isInvalid={v.invalid('expiry')}>
            <Label>Expiration</Label>
            <Input inputMode="numeric" autoComplete="cc-exp" placeholder="MM / YY" onChange={onExpiry} className="tabular-nums" />
            <ErrorText>{v.error('expiry')}</ErrorText>
          </TextField>
          <TextField name="cvc" isRequired isDisabled={busy} value={card.cvc} isInvalid={v.invalid('cvc')}>
            <Label>Security code</Label>
            <Input inputMode="numeric" autoComplete="cc-csc" placeholder={brand === 'amex' ? '4 digits' : '3 digits'} onChange={onCvc} className="tabular-nums" />
            <ErrorText>{v.error('cvc')}</ErrorText>
          </TextField>
        </div>

        <TextField name="cardName" isRequired isDisabled={busy} value={card.name} onChange={(name) => c.setCard({ name })} isInvalid={v.invalid('cardName')}>
          <Label>Name on card</Label>
          <Input autoComplete="cc-name" placeholder="Jane Appleseed" />
          <ErrorText>{v.error('cardName')}</ErrorText>
        </TextField>

        <div className="grid grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-3">
          <Select name="country" isDisabled={busy} value={billing.country}
            onChange={(id) => { if (id) c.setBilling({ country: id as CountryId, postal: '' }); }}>
            <Label>Country or region</Label>
            <SelectTrigger />
            <SelectContent items={COUNTRIES}>{(item) => <SelectItem id={item.id}>{item.name}</SelectItem>}</SelectContent>
          </Select>
          <TextField name="postal" isRequired isDisabled={busy} value={billing.postal} isInvalid={v.invalid('postal')}>
            <Label>{country.postal.label}</Label>
            <Input autoComplete="postal-code" inputMode={billing.country === 'US' ? 'numeric' : 'text'} placeholder={country.postal.placeholder} onChange={onPostal} />
            <ErrorText>{v.error('postal')}</ErrorText>
          </TextField>
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

/** Test mode: the processor's cards, each with a different ending. Pressing one fills the card fields. */
function TestCards({ disabled, onPick }: { disabled: boolean; onPick: (number: string) => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-panel border border-dashed border-border p-3">
      <p className="m-0 flex items-center gap-1.5 text-footnote leading-[18px] text-foreground">
        <Icon name="info" size={16} className="shrink-0 text-primary" />
        <span><span className="font-semibold">Test mode.</span> <span className={SOFT_INK}>Nothing is charged — pick a card, then pay.</span></span>
      </p>
      <div role="group" aria-label="Test cards" className="flex flex-wrap gap-1.5">
        {TEST_CARDS.map((t) => (
          <Button key={t.number} size="sm" variant="secondary" isDisabled={disabled} onPress={() => onPick(t.number)}
            aria-label={`Use test card ending ${t.number.slice(-4)}: ${t.label.toLowerCase()}`} className="h-7 gap-1.5 px-2.5 font-medium">
            <span className="tabular-nums">{t.number.slice(-4)}</span>
            <span className={SOFT_INK}>{t.label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}
