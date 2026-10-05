/* The order summary: the plan and seats, a promotion code (checked against the plan), tax once the billing address
   gives one, and what is due today — every figure follows the form as it changes. Beside the form on a wide host,
   and in a disclosure above it on a narrow one (with the total on its trigger). */
import { useEffect, useRef, useState } from 'react';
import { AnimatedHeight } from '@/components/ui/animated-height';
import { Button } from '@/components/ui/button';
import { Disclosure, DisclosurePanel, DisclosureTrigger } from '@/components/ui/disclosure';
import { Form } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { NumberMorph } from '@/components/ui/number-morph';
import { PlainButton } from '@/components/ui/plain-button';
import { Spinner } from '@/components/ui/spinner';
import { TextField } from '@/components/ui/text-field';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { MONEY_FORMAT, longDate, money, renewsOn } from './checkout';
import { PRODUCT } from './data';
import { ERROR_INK, ErrorText, Line, Logo, SOFT_INK, Totals } from './parts';
import { useCheckoutCtx } from './use-checkout';

export function OrderSummary() {
  const c = useCheckoutCtx();
  const q = c.quote;
  const { seats, cycle } = c.draft;
  const yearly = cycle === 'annual';
  const busy = c.status !== 'idle';
  const taxHint = c.step === 'payment' && c.draft.billing.country === 'US' ? 'Enter your ZIP' : 'Calculated at payment';
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Logo size={44} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-callout font-semibold text-foreground">{PRODUCT.name} {q.plan.name}</div>
          <div className={cn('text-footnote', SOFT_INK)}>{seats} {seats === 1 ? 'seat' : 'seats'} · billed {yearly ? 'yearly' : 'monthly'}</div>
        </div>
        {c.step !== 'plan' ? (
          <Button variant="link" size="sm" isDisabled={busy} onPress={() => c.goTo('plan')} className="h-auto px-0 text-link" aria-label="Change plan">Change</Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2.5">
        <Line label={`${q.plan.name} plan`} value={money(q.subtotal)}
          detail={yearly ? `${seats} × ${money(q.unit, true)} × 12 months` : `${seats} × ${money(q.unit, true)} per month`} />
        {yearly ? (
          <p className={cn('m-0 flex items-center gap-1.5 text-footnote leading-[18px]', SOFT_INK)}>
            <Icon name="check-circle-fill" size={15} className="shrink-0 text-success" />
            Yearly billing saves you {money(q.annualSaving, true)} a year.
          </p>
        ) : (
          <Button variant="link" size="sm" isDisabled={busy} onPress={() => c.setCycle('annual')} className="h-auto justify-start px-0 font-medium whitespace-normal text-link">
            Switch to yearly and save {money(q.annualSaving, true)} a year
          </Button>
        )}
      </div>

      <div aria-hidden="true" className="h-px bg-border" />
      <PromoCode disabled={busy} />
      <div aria-hidden="true" className="h-px bg-border" />

      <Totals quote={q} totalLabel="Due today" taxHint={taxHint} />
      <p className={cn('m-0 text-footnote leading-[18px]', SOFT_INK)}>
        Then {money(q.renewal)}{q.tax ? '' : ' plus tax'} per {yearly ? 'year' : 'month'} from {longDate(renewsOn(c.today, cycle))}.
        {q.promo && !q.promoError ? ' The promotion covers the first payment only.' : ''}
      </p>
    </div>
  );
}

/** "Add promotion code" → a field and Apply (a short pretend lookup) → the applied code as a chip you can remove. */
function PromoCode({ disabled }: { disabled: boolean }) {
  const c = useCheckoutCtx();
  const q = c.quote;
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  // The control that had focus goes away (Escape, Apply, Remove): hand focus to what replaced it.
  const wrap = useRef<HTMLDivElement | null>(null);
  const focusNext = useRef<'add' | 'applied' | null>(null);
  useEffect(() => {
    const target = focusNext.current;
    focusNext.current = null;
    if (target) wrap.current?.querySelector<HTMLElement>(`[data-promo-focus="${target}"]`)?.focus();
  });

  const apply = () => {
    if (checking) return;
    setChecking(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setChecking(false);
      const problem = c.applyPromo(code);
      setError(problem);
      if (!problem) { setCode(''); setOpen(false); focusNext.current = 'applied'; }
    }, 550);
  };

  let body;
  if (q.promo) {
    body = (
      <div data-promo-focus="applied" tabIndex={-1} className="flex flex-col gap-1.5 outline-none">
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-secondary pr-1 pl-2.5 text-footnote font-semibold text-foreground">
            <Icon name="tag-fill" size={14} className="text-primary" />
            {q.promo.code}
            <PlainButton aria-label={`Remove ${q.promo.code}`} isDisabled={disabled} onPress={() => { focusNext.current = 'add'; c.removePromo(); }}
              className="bl-btn grid size-5 cursor-pointer place-items-center rounded-full border-0 bg-transparent p-0 text-foreground/70 outline-none data-disabled:cursor-default data-disabled:opacity-40 data-focus-visible:ring-2 data-focus-visible:ring-ring data-hovered:bg-secondary-strong">
              <Icon name="xmark" size={11} sw={2.6} />
            </PlainButton>
          </span>
          {!q.promoError ? <span className="text-subhead text-foreground tabular-nums">−{money(q.discount)}</span> : null}
        </div>
        <p className={cn('m-0 text-footnote leading-[18px]', q.promoError ? ERROR_INK : SOFT_INK)}>{q.promoError ?? q.promo.label}</p>
      </div>
    );
  } else if (!open) {
    body = (
      <Button data-promo-focus="add" variant="link" size="sm" isDisabled={disabled} onPress={() => setOpen(true)} className="h-auto justify-start px-0 font-medium text-link">
        <Icon name="tag" size={16} /> Add promotion code
      </Button>
    );
  } else {
    body = (
      <Form validationBehavior="aria" onSubmit={(e) => { e.preventDefault(); apply(); }} className="flex-row items-start gap-2">
        <TextField aria-label="Promotion code" autoFocus value={code} isInvalid={!!error} isDisabled={disabled} className="min-w-0 flex-1"
          onChange={(v) => { setCode(v); setError(null); }} onKeyDown={(e) => { if (e.key === 'Escape' && !code) { focusNext.current = 'add'; setOpen(false); } }}>
          <Input size="sm" placeholder="Try LAUNCH20" autoComplete="off" className="h-9 uppercase placeholder:normal-case" />
          <ErrorText>{error}</ErrorText>
        </TextField>
        <Button type="submit" variant="secondary" isDisabled={disabled} className="w-[76px] shrink-0">
          {checking ? <Spinner spin size={16} /> : 'Apply'}
        </Button>
      </Form>
    );
  }
  return (
    <div ref={wrap}>
      {/* The padding inside the clipped box leaves room for focus rings. */}
      <AnimatedHeight className="-m-1"><div className="p-1">{body}</div></AnimatedHeight>
      <p role="status" className="sr-only">{q.promo && !q.promoError ? `${q.promo.code} applied: ${q.promo.label}.` : ''}</p>
    </div>
  );
}

/** Narrow hosts: the summary folds into a bar above the form that shows the total. */
export function SummaryDisclosure() {
  const c = useCheckoutCtx();
  const [open, setOpen] = useState(false);
  return (
    // The bar runs edge to edge; its contents line up with the form column below it.
    <div className="border-b border-border bg-muted">
      <Disclosure isExpanded={open} onExpandedChange={setOpen} className="mx-auto max-w-[520px] px-5">
        <DisclosureTrigger level={2} className="w-full gap-2 py-3 text-subhead">
          <span className="flex items-center gap-2 font-medium text-link">
            <Icon name="cart" size={18} />
            {open ? 'Hide' : 'Show'} order summary
          </span>
          <NumberMorph value={c.quote.total / 100} format={MONEY_FORMAT} className="mr-1 ml-auto text-callout font-semibold text-foreground" />
        </DisclosureTrigger>
        <DisclosurePanel>
          <div className="pt-2 pb-2">
            <OrderSummary />
          </div>
        </DisclosurePanel>
      </Disclosure>
    </div>
  );
}
