/* Pieces the steps, the summary and the receipt share: the product mark, card-brand marks, field help and error
   text, step validation, the step heading (which takes focus when a step opens) and its Back / submit row, the
   order's money lines, and the hook that keeps the caret in place while a field formats itself (`4242 4242 …`,
   `12 / 28`). */
import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { NumberMorph } from '@/components/ui/number-morph';
import { FieldDescription, FieldError } from '@/components/ui/text-field';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';
import { MONEY_FORMAT, money, percent, type CardBrand, type Quote } from './checkout';

/** Error text dark enough to read on white (iOS red alone is 3.5:1); in dark mode it lightens instead. */
export const ERROR_INK = 'text-[color-mix(in_oklab,var(--destructive)_72%,var(--foreground))]';
/** Secondary text that still passes contrast on the card and muted surfaces. */
export const SOFT_INK = 'text-foreground/70';

export function Hint({ children, className }: { children: ReactNode; className?: string }) {
  return <FieldDescription className={cn(SOFT_INK, className)}>{children}</FieldDescription>;
}

export function ErrorText({ children }: { children?: ReactNode }) {
  return <FieldError className={ERROR_INK}>{children}</FieldError>;
}

/* ── The product mark: a planet and its orbit, on the tint ── */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span aria-hidden="true" className="grid shrink-0 place-items-center rounded-[28%] bg-primary text-primary-foreground" style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" width={size * 0.68} height={size * 0.68} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none" />
        <ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(-24 12 12)" />
      </svg>
    </span>
  );
}

/* ── Card brands: small acceptance marks (brand colors are content, so they're constants) ── */
const BRAND_INK = { visa: '#1A1F71', amex: '#006FCF', mcRed: '#EB001B', mcYellow: '#F79E1B', mcOverlap: '#FF5F00', discover: '#FF6000', paper: '#FFFFFF', print: '#231F20' } as const;

export function BrandMark({ brand, className }: { brand: CardBrand; className?: string }) {
  const frame = 'h-5 w-8 shrink-0 overflow-visible';
  const edge = <rect x=".25" y=".25" width="31.5" height="19.5" rx="3" fill={BRAND_INK.paper} stroke="var(--border)" strokeWidth=".5" />;
  return (
    <svg viewBox="0 0 32 20" aria-hidden="true" className={cn(frame, className)}>
      {brand === 'visa' ? (
        <>
          <rect width="32" height="20" rx="3" fill={BRAND_INK.visa} />
          <text x="16" y="13.6" textAnchor="middle" fill="white" fontSize="9" fontStyle="italic" fontWeight="800" fontFamily="Arial, Helvetica, sans-serif" letterSpacing=".2">VISA</text>
        </>
      ) : brand === 'mastercard' ? (
        <>
          {edge}
          <circle cx="13" cy="10" r="6" fill={BRAND_INK.mcRed} />
          <circle cx="19" cy="10" r="6" fill={BRAND_INK.mcYellow} />
          <path d="M16 4.8a6 6 0 0 1 0 10.4 6 6 0 0 1 0-10.4z" fill={BRAND_INK.mcOverlap} />
        </>
      ) : brand === 'amex' ? (
        <>
          <rect width="32" height="20" rx="3" fill={BRAND_INK.amex} />
          <text x="16" y="13.2" textAnchor="middle" fill="white" fontSize="7.6" fontWeight="800" fontFamily="Arial, Helvetica, sans-serif" letterSpacing=".3">AMEX</text>
        </>
      ) : brand === 'discover' ? (
        <>
          {edge}
          <text x="4" y="12.6" fill={BRAND_INK.print} fontSize="6" fontWeight="700" fontFamily="Arial, Helvetica, sans-serif">DISC</text>
          <circle cx="24.5" cy="10" r="3.6" fill={BRAND_INK.discover} />
        </>
      ) : (
        <>
          <rect x=".75" y=".75" width="30.5" height="18.5" rx="2.6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M1 6.5h30" stroke="currentColor" strokeWidth="2.6" />
          <path d="M5 14h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </>
      )}
    </svg>
  );
}

/* ── Step validation ──
   A step's errors appear when it is submitted (focus goes to the first invalid field, whose message is its
   description) and from then on follow each value as it is typed, appearing and clearing live. Nothing validates on
   blur: an error that appeared or cleared as you left a field would move the button you were pressing. `server`
   errors (a decline) show regardless. Use with `<Form validationBehavior="aria">`; fields are found by `name`. */
export function useStepErrors<K extends string>(errors: Record<K, string | null>, server?: Partial<Record<K, string>>) {
  const [submitted, setSubmitted] = useState(false);
  const error = (k: K) => server?.[k] ?? (submitted ? errors[k] : null);
  return {
    error,
    invalid: (k: K) => !!error(k),
    /** For `onSubmit`: true when the step is valid; otherwise shows its errors and focuses the first invalid field. */
    check: (form: HTMLFormElement) => {
      setSubmitted(true);
      const first = (Object.keys(errors) as K[]).find((k) => errors[k]);
      if (first) form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      return !first;
    },
  };
}

/* ── Step heading: focused (without scrolling) when its step opens, so a screen reader starts there ── */
export function StepHeading({ title, description, focus }: { title: string; description?: ReactNode; focus: boolean }) {
  const ref = useRef<HTMLHeadingElement | null>(null);
  // Mount-only on purpose: the heading takes focus once, when its step arrives.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (focus) ref.current?.focus({ preventScroll: true }); }, []);
  return (
    <div className="flex flex-col gap-1">
      <h2 ref={ref} tabIndex={-1} className="m-0 text-[22px] leading-7 font-semibold tracking-[-.3px] text-foreground outline-none">{title}</h2>
      {description ? <p className={cn('m-0 text-subhead leading-5', SOFT_INK)}>{description}</p> : null}
    </div>
  );
}

/** Back, and the step's submit button: one row on a roomy column, stacked (submit on top) on a narrow one. */
export function StepActions({ onBack, backDisabled, children }: { onBack: () => void; backDisabled?: boolean; children: ReactNode }) {
  return (
    <div className="flex flex-col-reverse gap-2 pt-1 @md:flex-row @md:items-center @md:justify-between">
      <Button variant="ghost" size="lg" onPress={onBack} isDisabled={backDisabled} className="text-link @md:-ml-3">
        <Icon name="chevron-left" size={18} sw={2.4} /> Back
      </Button>
      {children}
    </div>
  );
}

/* ── Money lines ── */
export function Line({ label, detail, value, className }: { label: ReactNode; detail?: ReactNode; value: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-start justify-between gap-4 text-subhead leading-5', className)}>
      <div className="min-w-0">
        <div className="text-foreground">{label}</div>
        {detail ? <div className={cn('mt-0.5 text-footnote leading-[18px]', SOFT_INK)}>{detail}</div> : null}
      </div>
      <div className="shrink-0 text-right text-foreground tabular-nums">{value}</div>
    </div>
  );
}

/** Subtotal, the promotion, tax and the total — the order summary's foot and the receipt's. `taxHint` stands in for
 *  the tax line until the billing address is known. */
export function Totals({ quote: q, totalLabel, taxHint }: { quote: Quote; totalLabel: string; taxHint?: string }) {
  return (
    <div className="flex flex-col gap-2.5">
      <Line label="Subtotal" value={money(q.subtotal)} />
      {q.promo && !q.promoError ? <Line label={`${q.promo.code} · ${q.promo.kind === 'percent' ? `${q.promo.value}% off` : `${money(q.promo.value * 100, true)} off`}`} value={`−${money(q.discount)}`} /> : null}
      {q.tax ? (
        <Line label={`${q.tax.label} · ${percent(q.tax.rate)}`} value={money(q.tax.amount)} />
      ) : (
        <Line label="Tax" value={<span className={cn('text-footnote', SOFT_INK)}>{taxHint ?? 'Calculated at payment'}</span>} />
      )}
      <div aria-hidden="true" className="my-1 h-px bg-border" />
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-callout font-semibold text-foreground">{totalLabel}</span>
        <NumberMorph value={q.total / 100} format={MONEY_FORMAT} className="text-title font-semibold tracking-[-.2px] text-foreground" />
      </div>
    </div>
  );
}

/* ── Formatting fields ──
   A formatter that inserts spaces or a slash moves the caret to the end on every keystroke. This keeps it after the
   same number of letters and digits it was after, so editing the middle of a card number works. Pass the returned
   handler as the Input's `onChange` and keep the TextField controlled (`value`, no `onChange`). */
const isMark = (ch: string) => /[0-9A-Za-z]/.test(ch);

export function useFormattedInput(format: (raw: string) => string, onValue: (value: string) => void) {
  const caret = useRef<{ el: HTMLInputElement; at: number } | null>(null);
  useLayoutEffect(() => {
    const c = caret.current;
    caret.current = null;
    if (c && c.el === document.activeElement) c.el.setSelectionRange(c.at, c.at);
  });
  return (e: ChangeEvent<HTMLInputElement>) => {
    const el = e.target;
    const next = format(el.value);
    const marks = Array.from(el.value.slice(0, el.selectionStart ?? el.value.length)).filter(isMark).length;
    let at = 0;
    for (let seen = 0; at < next.length && seen < marks; at++) if (isMark(next[at])) seen++;
    caret.current = { el, at };
    onValue(next);
  };
}
