/* The end of the flow: a burst for the rare moment, what was bought, and the receipt — its number, the date, the card,
   the money lines and the renewal. "Go to dashboard" hands over to the host app. */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Celebrate } from '@/components/ui/celebrate';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { BRAND_NAMES, longDate, money, renewsOn, slugify } from './checkout';
import { PRODUCT } from './data';
import { BrandMark, SOFT_INK, Totals } from './parts';
import { useCheckoutCtx } from './use-checkout';

export function ReceiptView({ onDashboard }: { onDashboard: () => void }) {
  const c = useCheckoutCtx();
  const r = c.receipt;
  const heading = useRef<HTMLHeadingElement | null>(null);
  const [burst, setBurst] = useState(0);
  // On arrival: the heading takes focus (when the flow led here) and the confetti fires once the view has swapped in.
  useEffect(() => {
    if (c.moved) heading.current?.focus({ preventScroll: true });
    const t = setTimeout(() => setBurst(1), 260);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!r) return null;

  const rows: [string, ReactNode][] = [
    ['Date paid', longDate(r.paidAt)],
    ['Plan', `${r.quote.plan.name} · ${r.seats} ${r.seats === 1 ? 'seat' : 'seats'} · ${r.cycle === 'annual' ? 'yearly' : 'monthly'}`],
    ...(r.account.workspace ? [['Workspace', `${PRODUCT.domain}/${slugify(r.account.workspace)}`] as [string, string]] : []),
    ['Payment method', (
      <span className="inline-flex items-center gap-2">
        <BrandMark brand={r.brand} className="text-tertiary-foreground" />
        {BRAND_NAMES[r.brand]} •••• {r.last4}
      </span>
    )],
  ];

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative isolate mt-2 grid place-items-center">
        <Celebrate fire={burst} spread={84} />
        <span className="grid size-16 place-items-center rounded-full bg-success text-white shadow-[0_0_0_8px_color-mix(in_oklab,var(--success)_18%,transparent)]">
          <Icon name="check" size={32} sw={3} />
        </span>
      </div>
      <div className="flex flex-col gap-1.5 text-center">
        <h2 ref={heading} tabIndex={-1} className="m-0 text-[26px] leading-8 font-bold tracking-[-.4px] text-foreground outline-none">
          Welcome to {PRODUCT.name} {r.quote.plan.name}
        </h2>
        <p className={cn('m-0 text-subhead leading-5', SOFT_INK)}>
          We received {money(r.quote.total)}
          {r.account.email ? <> and sent the receipt to <span className="font-medium whitespace-nowrap text-foreground">{r.account.email}</span></> : null}.
        </p>
      </div>

      <Card variant="elevated" className="w-full select-text">
        <div className="flex items-baseline justify-between gap-3 px-5 pt-4 pb-3.5 shadow-hairline-b">
          <h3 className="m-0 text-callout font-semibold text-foreground">Receipt</h3>
          <span className={cn('text-footnote tabular-nums', SOFT_INK)}>#{r.id}</span>
        </div>
        <dl className="m-0 flex flex-col gap-2.5 px-5 py-4 text-subhead leading-5 shadow-hairline-b">
          {rows.map(([term, value]) => (
            <div key={term} className="flex items-center justify-between gap-4">
              <dt className={SOFT_INK}>{term}</dt>
              <dd className="m-0 min-w-0 truncate text-right text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="px-5 py-4">
          <Totals quote={r.quote} totalLabel="Amount paid" />
        </div>
        <p className={cn('m-0 px-5 pb-5 text-footnote leading-[18px]', SOFT_INK)}>
          Renews on {longDate(renewsOn(r.paidAt, r.cycle))} for {money(r.quote.renewal)}. Change seats or cancel any time from
          Settings&nbsp;›&nbsp;Billing.
        </p>
      </Card>

      <Button size="lg" className="w-full" onPress={onDashboard}>
        Go to dashboard <Icon name="arrow-right" size={18} sw={2.2} />
      </Button>
    </div>
  );
}
