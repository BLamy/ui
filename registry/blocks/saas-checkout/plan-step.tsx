/* Step 1 — the plan, how it is billed, and how many seats. Prices roll to their yearly figure when the cycle changes;
   the seat stepper (UI SDK's NumberInput: arrows, Page Up/Down, typing, held step buttons) keeps to the plan's
   limits. */
import { NumberInput, NumberInputControl, NumberInputDecrement, NumberInputGroup, NumberInputIncrement } from '@ui-sdk/react/number-input';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { inputVariants } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NumberMorph } from '@/components/ui/number-morph';
import { Radio, RadioGroup } from '@/components/ui/radio-group';
import { Segmented, SegmentedItem } from '@/components/ui/segmented';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { money } from './checkout';
import { ANNUAL_SAVING, PLANS, type Cycle, type Plan, type PlanId } from './data';
import { Hint, SOFT_INK, StepHeading } from './parts';
import { useCheckoutCtx } from './use-checkout';

const WHOLE_DOLLARS: Intl.NumberFormatOptions = { style: 'currency', currency: 'USD', maximumFractionDigits: 0 };

export function PlanStep() {
  const c = useCheckoutCtx();
  return (
    <FieldGroup render={<form onSubmit={(e) => { e.preventDefault(); c.goTo('account'); }} />} className="gap-6">
      <StepHeading title="Choose your plan" description="Change plans or seats whenever you like — we prorate the difference." focus={c.moved} />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <span aria-hidden="true" className="text-subhead font-medium text-foreground">Billing</span>
        <Segmented<Cycle> aria-label="Billing" value={c.draft.cycle} onValueChange={(cycle) => { if (cycle) c.setCycle(cycle); }} className="w-[232px]">
          <SegmentedItem value="monthly">Monthly</SegmentedItem>
          <SegmentedItem value="annual"><span>Yearly <span className="text-link">−{ANNUAL_SAVING * 100}%</span></span></SegmentedItem>
        </Segmented>
      </div>
      <RadioGroup<PlanId> aria-label="Plan" value={c.draft.plan} onValueChange={(id) => { if (id) c.setPlan(id); }} className="gap-3">
        {PLANS.map((plan) => <PlanOption key={plan.id} plan={plan} cycle={c.draft.cycle} />)}
      </RadioGroup>
      <SeatStepper />
      <Button type="submit" size="lg" className="w-full">
        Continue <Icon name="arrow-right" size={18} sw={2.2} />
      </Button>
    </FieldGroup>
  );
}

/** A plan as a selectable card: the radio's label is the card (a press anywhere on it picks the plan), with the
 *  name, price per seat and the three things it adds. */
function PlanOption({ plan, cycle }: { plan: Plan; cycle: Cycle }) {
  const yearly = cycle === 'annual';
  return (
    <Label
      variant="control"
      className={cn(
        'w-full items-start rounded-card bg-card p-4 text-subhead shadow-hairline',
        'transition-[box-shadow,background-color] duration-spring-snappy ease-spring-snappy motion-reduce:transition-none',
        'hover:bg-secondary/40 has-data-checked:bg-primary/[.05] has-data-checked:shadow-[inset_0_0_0_2px_var(--primary)]',
        'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary',
      )}
    >
      <Radio value={plan.id} className="mt-px" />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-start justify-between gap-3">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-callout leading-[22px] font-semibold text-foreground">{plan.name}</span>
            {plan.popular ? <Badge variant="tinted" className="bg-primary/10 text-link">Most popular</Badge> : null}
          </span>
          <span className="flex shrink-0 items-baseline gap-1.5">
            {/* The monthly price, struck through, beside the yearly one; screen readers get the sentence below instead. */}
            {yearly ? <s aria-hidden="true" className={cn('text-footnote', SOFT_INK)}>{money(plan.price.monthly * 100, true)}</s> : null}
            <NumberMorph value={plan.price[cycle]} format={WHOLE_DOLLARS} className="text-title leading-[22px] font-semibold tracking-[-.2px] text-foreground" />
          </span>
        </span>
        <span className={cn('flex items-start justify-between gap-3 text-footnote leading-[18px]', SOFT_INK)}>
          <span>{plan.blurb}</span>
          <span className="shrink-0 text-right">per seat / month{yearly ? <span className="sr-only"> (billed yearly)</span> : null}</span>
        </span>
        <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 text-footnote text-foreground">
          {plan.features.map((f) => (
            <span key={f} className="inline-flex items-center gap-1.5">
              <Icon name="check" size={14} sw={2.6} className="text-primary" />
              {f}
            </span>
          ))}
        </span>
      </span>
    </Label>
  );
}

/** − 5 + with the monthly cost beside it. The plan's seat range bounds it (Starter tops out, Business starts at 5). */
function SeatStepper() {
  const c = useCheckoutCtx();
  const { plan, unit } = c.quote;
  const seats = c.draft.seats;
  const yearly = c.draft.cycle === 'annual';
  const limit = plan.seats.max <= 10 ? `${plan.name} covers up to ${plan.seats.max} seats.`
    : plan.seats.min > 1 ? `${plan.name} starts at ${plan.seats.min} seats.`
    : 'Add seats as your team grows; you pay for the days you use them.';
  return (
    <Field className="gap-1.5">
      <FieldLabel variant="default">Seats</FieldLabel>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <NumberInput
          value={seats}
          onValueChange={(n) => { if (n != null && Number.isFinite(n)) c.setSeats(n); }}
          min={plan.seats.min}
          max={plan.seats.max}
          format={{ maximumFractionDigits: 0 }}
        >
          <NumberInputGroup className="flex h-11 items-center gap-0.5 rounded-ctl bg-input p-1 transition-shadow duration-spring-snappy ease-spring-snappy focus-within:shadow-[inset_0_0_0_1.5px_var(--primary)]">
            <NumberInputDecrement aria-label="Remove a seat" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'rounded-lg')}>
              <Icon name="minus" size={16} sw={2.4} />
            </NumberInputDecrement>
            <NumberInputControl className={cn(inputVariants(), 'h-9 w-14 bg-transparent px-0 text-center text-callout font-semibold tabular-nums focus:bg-transparent focus:shadow-none')} />
            <NumberInputIncrement aria-label="Add a seat" className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'rounded-lg')}>
              <Icon name="plus" size={16} sw={2.4} />
            </NumberInputIncrement>
          </NumberInputGroup>
        </NumberInput>
        <p aria-live="polite" className={cn('m-0 text-footnote leading-[18px]', SOFT_INK)}>
          {seats} × {money(unit, true)} = <span className="font-semibold text-foreground">{money(unit * seats, true)}</span> a month
          {yearly ? <>, billed {money(unit * seats * 12, true)} a year</> : null}
        </p>
      </div>
      <Hint>{limit}</Hint>
    </Field>
  );
}
