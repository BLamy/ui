/* SaaS checkout — an upgrade flow in the spirit of Stripe Checkout, Linear and Vercel: choose a plan (monthly or
   yearly, priced per seat, with a seat stepper), create the account, then pay by card (the number groups itself and
   shows its brand; expiry, security code, country and postal code). The order summary follows along live: promotion
   codes, tax from the billing address, the total. Paying runs a mock processor — nothing leaves the browser, and the
   test cards decline in different ways — and ends on a receipt. Wide hosts: the form beside a sticky summary. Narrow:
   one column, with the summary folded into a bar on top. */
import { useLayoutEffect, useRef, type CSSProperties } from 'react';
import { ContentSwap } from '@/components/ui/animated-height';
import { Badge } from '@/components/ui/badge';
import { ProgressStepper } from '@/components/ui/progress-stepper';
import { useContainerWidth } from '@/lib/container';
import { Icon } from '@/lib/icon';
import { useDirection } from '@/lib/motion';
import { BLProvider, useAppearance } from '@/lib/theme';
import { cn } from '@/lib/utils';
import type { Receipt } from './checkout';
import { PRODUCT } from './data';
import { AccountStep } from './account-step';
import { Logo, SOFT_INK } from './parts';
import { PaymentStep } from './payment-step';
import { PlanStep } from './plan-step';
import { ReceiptView } from './receipt';
import { OrderSummary, SummaryDisclosure } from './summary';
import { CheckoutCtx, STEPS, useCheckout, type DraftInit, type Step } from './use-checkout';

/** The checkout's accent, iOS indigo: `fill` for buttons and selection (white labels read on it), `ink` for tinted text
 *  such as links (lighter in dark mode, so it reads on the dark surfaces too). */
const CHECKOUT_TINT = { light: { fill: '#5856D6', ink: '#5856D6' }, dark: { fill: '#5E5CE6', ink: '#8F8CFF' } } as const;
/** Host width (px) from which the summary sits beside the form. */
const WIDE = 860;

const STEP_LABELS = { plan: 'Plan', account: 'Account', payment: 'Payment' } as const;
const STEP_ICONS = { plan: 'layers', account: 'person', payment: 'wallet' } as const;

export interface SaasCheckoutProps {
  /** Step to open on. `done` opens on the receipt (paid with the test card unless `initial` has a card). */
  initialStep?: Step;
  /** The order to start from: plan, cycle, seats, a promotion code, account, card and billing fields. */
  initial?: DraftInit;
  /** The billing date (default: now). Pass a fixed date for still frames. */
  today?: Date;
  /** "Go to dashboard" on the receipt. Without it the demo starts over. */
  onDashboard?: (receipt: Receipt) => void;
}

export default function SaasCheckout({ initialStep, initial, today, onDashboard }: SaasCheckoutProps) {
  const dark = useAppearance() === 'dark';
  const tint = CHECKOUT_TINT[dark ? 'dark' : 'light'];
  const [ref, width] = useContainerWidth<HTMLDivElement>(1100);
  const wide = width >= WIDE;
  const checkout = useCheckout({ initialStep, initial, today });
  const { step, status } = checkout;
  const index = step === 'done' || status === 'paid' ? STEPS.length : STEPS.indexOf(step);
  const direction = useDirection(index);

  // Each step starts at the top of the page.
  const scroller = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => { scroller.current?.scrollTo({ top: 0 }); }, [step]);

  const steps = STEPS.map((id) => ({ id, label: STEP_LABELS[id], icon: <Icon name={STEP_ICONS[id]} size={20} /> }));
  const flow = (
    <div className="flex flex-col gap-8">
      {/* The active segment shimmers only while a payment is processing. The other steps' labels are darker than the
          stepper's muted default, so they stay readable. */}
      <ProgressStepper steps={steps} current={index} labels animated={status === 'processing'}
        className="[&>li:not([data-state=active])>span:last-child]:text-foreground/70" />
      <ContentSwap id={step} direction={direction}>
        {step === 'plan' ? <PlanStep /> : step === 'account' ? <AccountStep /> : <PaymentStep />}
      </ContentSwap>
    </div>
  );
  const toDashboard = () => (onDashboard && checkout.receipt ? onDashboard(checkout.receipt) : checkout.restart());

  return (
    <BLProvider dark={dark} tint={tint.fill} style={{ '--link': tint.ink } as CSSProperties} className="bg-background">
      <CheckoutCtx.Provider value={checkout}>
        <div ref={ref} className="flex h-full min-h-0 w-full flex-col">
          <header className="shrink-0 border-b border-border bg-background">
            <div className={cn('mx-auto flex h-toolbar w-full items-center gap-2.5', wide ? 'max-w-[1120px] px-12' : 'px-5')}>
              <Logo />
              <span className="text-callout font-semibold text-foreground">{PRODUCT.name}</span>
              <span aria-hidden="true" className="mx-1 h-4 w-px bg-border" />
              <span className={cn('inline-flex items-center gap-1.5 text-subhead', SOFT_INK)}>
                <Icon name="lock-fill" size={14} />
                Checkout
              </span>
              <Badge variant="secondary" className="ml-auto gap-1.5">
                <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
                Test mode
              </Badge>
            </div>
          </header>

          <div ref={scroller} className="bl-scroll min-h-0 flex-1 overflow-y-auto">
            {step === 'done' ? (
              <div className="min-h-full bg-muted px-5 pt-12 pb-10">
                <div className="mx-auto max-w-[480px]"><ReceiptView onDashboard={toDashboard} /></div>
              </div>
            ) : (
              /* Wide: two halves, the right one on the muted surface out to the edge (the gradient), the summary
                 sticky. Narrow: the summary bar, then the form. The form keeps its place in the tree either way, so
                 resizing across the breakpoint doesn't reset a step. */
              <div className={cn('flex min-h-full', wide ? 'bg-[linear-gradient(to_right,var(--background)_50%,var(--muted)_50%)]' : 'flex-col bg-background')}>
                {wide ? null : <SummaryDisclosure />}
                <div className={cn('mx-auto w-full', wide ? 'grid max-w-[1120px] grid-cols-2' : 'max-w-[520px]')}>
                  <div className={cn('@container', wide ? 'bg-background px-12 py-10' : 'px-5 pt-6 pb-10')}>
                    <div className={cn(wide && 'ml-auto max-w-[460px]')}>{flow}</div>
                  </div>
                  {wide ? (
                    <section aria-label="Order summary" className="border-l border-border bg-muted px-12 py-10">
                      <div className="sticky top-10 max-w-[400px]"><OrderSummary /></div>
                    </section>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        </div>
      </CheckoutCtx.Provider>
    </BLProvider>
  );
}
