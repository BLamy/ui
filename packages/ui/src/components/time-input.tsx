'use client';
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { announce } from '@ui-sdk/core';
import { cva, type VariantProps } from 'class-variance-authority';
import { Badge } from '@/components/ui/badge';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input, type InputProps } from '@/components/ui/input';
import {
  browserTimeZone,
  describeRecurrence,
  formatOccurrence,
  rruleLine,
  timeTextSegments,
  useTimeParse,
  type TimeParseResult,
  type UseTimeParseOptions,
} from '@/lib/gpu-time';
import { Icon } from '@/lib/icon';
import { cn } from '@/lib/utils';

/* ══ TimeInput — a text field that reads a date, a time or a recurrence written in English ("every weekday at 9am",
   "Sat Sun 1pm-8pm") with gpu-time, and shows what it understood as you type: the words it recognised, the
   occurrences it resolved (formatted in the field's time zone), a "Repeats" chip for recurrences, and any
   diagnostics. It works with or without WebGPU (the model runs on the CPU unless the GPU is worth using), and the
   package loads on first use. The field itself is the kit's Input in a Field, so the label, description and error
   are wired to it and every native input attribute passes through. (For a time typed part by part, see TimeField.)

   <TimeInput label="When" timeZone="Europe/Paris" onParseChange={({ text, result, pending }) => … } />

   gpu-time is a small model and can resolve a wrong date without any diagnostic, so the preview lists the actual dates
   for the person to check; do not schedule anything consequential from the result unreviewed. ══ */

/** Secondary text: `text-muted-foreground` is below WCAG AA (4.5:1) on the bl-theme's grey surfaces, so the captions
    and notes here use the foreground at 70%. */
const subtleText = 'text-foreground/70';

/** A field error: the message in the foreground color (red text is below AA on grey) with a red icon, so it is
    never color alone. */
function ErrorLine({ children }: { children: ReactNode }) {
  return (
    <span className="flex items-start gap-1.5">
      <Icon name="exclamation-circle" size={14} className="mt-[3px] shrink-0 text-destructive" />
      <span>{children}</span>
    </span>
  );
}

export const timeInputVariants = cva('flex min-w-0 flex-col gap-2 text-footnote', {
  variants: {
    /** `card`: the preview sits on a filled panel under the field. `plain`: no surface. */
    variant: {
      card: '[&_[data-slot=time-input-preview]]:rounded-panel [&_[data-slot=time-input-preview]]:bg-secondary [&_[data-slot=time-input-preview]]:p-3',
      plain: '[&_[data-slot=time-input-preview]]:px-1',
    },
  },
  defaultVariants: { variant: 'card' },
});

export interface TimeInputChange {
  /** The text in the field. */
  text: string;
  /** The parse of `text`; null while it is still parsing (`pending`), when the field is empty, or on `error`. */
  result: TimeParseResult | null;
  /** True between a keystroke and the parse of it settling. Empty text is never pending. */
  pending: boolean;
  /** Why parsing failed (an unknown time zone, say), or null. */
  error: Error | null;
}

export interface TimeInputProps
  extends Omit<InputProps, 'value' | 'defaultValue' | 'children' | 'className' | 'style' | 'render'>,
    VariantProps<typeof timeInputVariants>,
    Pick<UseTimeParseOptions, 'reference' | 'timeZone' | 'dateOrder' | 'backend' | 'weekStart' | 'bareWeekday' | 'bareWeekdays' | 'nextWeekday' | 'dayParts' | 'until' | 'debounceMs'> {
  /** Controlled text. Follow it with `onValueChange(text, details)`, the Input's own callback. */
  value?: string;
  /** Initial text when uncontrolled. */
  defaultValue?: string;
  /** Called on every keystroke with `result: null` and `pending: true`, and again with the result when the parse of
      that text settles. Read `result` only when `pending` is false. */
  onParseChange?: (change: TimeInputChange) => void;
  label?: ReactNode;
  description?: ReactNode;
  /** Marks the field invalid. A parser failure (an unknown time zone, say) does too. */
  invalid?: boolean;
  /** Shown under the field while it is invalid (`invalid`, or the parser failed). */
  error?: ReactNode;
  /** How many occurrences to list (the rest of a repeating schedule is summarised by its "Repeats" chip). Default: 5. */
  maxOccurrences?: number;
  /** BCP 47 locale for dates and times in the preview. Default: the browser's. */
  locale?: string;
  /** Show which backend ("CPU" or "GPU") parsed the text. Default: false. */
  showBackend?: boolean;
  className?: string;
  style?: CSSProperties;
}

const SAMPLE = 'tomorrow at 3pm';

/** A natural-language time field with a live preview: the text is parsed (gpu-time) into dates and schedules. It goes
    in a form like any Input: `name`, `required`, `disabled` and the rest pass through. Not UI SDK's `TimeInput`, the
    segmented hour/minute field, which the kit ships as `TimeField` in `@/components/ui/date-field`. */
export function TimeInput({
  value,
  defaultValue = '',
  onValueChange,
  onParseChange,
  label,
  description,
  error: errorProp,
  placeholder = `e.g. ${SAMPLE}`,
  size,
  maxOccurrences = 5,
  locale,
  showBackend = false,
  variant,
  className,
  style,
  reference,
  timeZone,
  dateOrder,
  backend,
  weekStart,
  bareWeekday,
  bareWeekdays,
  nextWeekday,
  dayParts,
  until,
  debounceMs,
  invalid: invalidProp,
  disabled,
  ...inputProps
}: TimeInputProps) {
  const [inner, setInner] = useState(defaultValue);
  const text = value ?? inner;
  const zone = useMemo(() => timeZone ?? browserTimeZone(), [timeZone]);
  const state = useTimeParse(text, {
    reference, timeZone: zone, dateOrder, backend, weekStart, bareWeekday, bareWeekdays, nextWeekday, dayParts, until, debounceMs,
    limit: maxOccurrences, enabled: !disabled,
  });
  const { result, error, pending, backend: usedBackend, parsedText } = state;

  const emit = useRef(onParseChange);
  emit.current = onParseChange;
  const change: NonNullable<InputProps['onValueChange']> = (next, details) => {
    onValueChange?.(next, details);
    if (details.canceled) return;
    if (value === undefined) setInner(next);
    emit.current?.({ text: next, result: null, pending: next.trim() !== '', error: null });
  };
  const latest = useRef(text);
  latest.current = text;
  // The answer for the latest text: reported once per settled parse, and read out through UI SDK's announcer while it
  // still matches what is in the field.
  useEffect(() => {
    if (pending || parsedText === null) return;
    emit.current?.({ text: parsedText, result, pending: false, error });
    if (result && parsedText === latest.current && parsedText.trim() !== '') announce(summarize(result));
  }, [pending, parsedText, result, error]);

  const previewId = useId();
  const trimmed = text.trim();
  const fresh = parsedText === text;
  const hasPreview = trimmed !== '' && result !== null;
  const invalid = error !== null ? true : invalidProp;
  const message = errorProp ?? error?.message;

  return (
    <div data-slot="time-input" data-backend={usedBackend ?? undefined} data-pending={pending || undefined} className={cn(timeInputVariants({ variant }), className)} style={style}>
      <Field invalid={invalid} disabled={disabled}>
        {label ? <FieldLabel variant="field" className={subtleText}>{label}</FieldLabel> : null}
        <Input
          value={value}
          defaultValue={value === undefined ? defaultValue : undefined}
          onValueChange={change}
          size={size}
          placeholder={placeholder}
          autoComplete="off"
          spellCheck={false}
          aria-label={label ? undefined : 'Date or time'}
          aria-describedby={hasPreview ? previewId : undefined}
          {...inputProps}
        />
        {description ? <FieldDescription className={subtleText}>{description}</FieldDescription> : null}
        {/* Without a message of ours it shows the browser's (a missing required value). */}
        <FieldError className="text-foreground">{message ? <ErrorLine>{message}</ErrorLine> : undefined}</FieldError>
      </Field>
      {hasPreview ? (
        <TimeInputPreview
          id={previewId}
          text={text}
          result={result}
          fresh={fresh}
          pending={pending}
          timeZone={zone}
          locale={locale}
          backend={showBackend ? usedBackend : null}
        />
      ) : null}
    </div>
  );
}

function summarize(result: TimeParseResult): string {
  const n = result.occurrences.length;
  if (result.rrules.length) return `Repeating schedule found, ${n}${result.truncated ? '+' : ''} upcoming ${n === 1 ? 'time' : 'times'} shown.`;
  if (n === 0) return 'No date or time recognized.';
  return `${n} ${n === 1 ? 'date' : 'dates'} found.`;
}

interface PreviewProps {
  id: string;
  text: string;
  result: TimeParseResult;
  fresh: boolean;
  pending: boolean;
  timeZone: string;
  locale?: string;
  backend: 'cpu' | 'webgpu' | null;
}

function TimeInputPreview({ id, text, result, fresh, pending, timeZone, locale, backend }: PreviewProps) {
  const segments = useMemo(() => (fresh ? timeTextSegments(text, result.spans) : []), [result, fresh, text]);
  const occurrences = useMemo(() => result.occurrences.map((o) => formatOccurrence(o, { timeZone, locale })), [result, timeZone, locale]);
  const rules = useMemo(
    () => result.rrules.map((r) => ({ raw: rruleLine(r), words: describeRecurrence(r, { locale, timeZone }) })),
    [result, locale, timeZone],
  );
  const found = occurrences.length > 0 || rules.length > 0;
  return (
    <div id={id} data-slot="time-input-preview" aria-busy={pending || undefined} data-stale={fresh ? undefined : ''} className={cn('flex min-w-0 flex-col gap-2 transition-opacity', !fresh && 'opacity-60')}>
      {segments.some((s) => s.matched) ? (
        <p data-slot="time-input-recognized" className="m-0 wrap-anywhere text-foreground/70">
          <span className="sr-only">Recognized: </span>
          {segments.map((s) =>
            s.matched ? (
              <mark
                key={s.start}
                data-confidence={(s.confidence ?? 1) < 0.5 ? 'low' : undefined}
                className="rounded-sm bg-primary/15 px-0.5 text-foreground data-[confidence=low]:underline data-[confidence=low]:decoration-dotted data-[confidence=low]:decoration-warning data-[confidence=low]:underline-offset-4"
              >
                {s.text}
              </mark>
            ) : (
              <span key={s.start}>{s.text}</span>
            ),
          )}
        </p>
      ) : null}

      {rules.length ? (
        <ul data-slot="time-input-repeats" aria-label="Repeats" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {rules.map((r, i) => (
            <li key={i} className="min-w-0 max-w-full">
              <Badge variant="tinted" title={r.raw} className="h-auto min-h-[22px] max-w-full py-1 leading-tight whitespace-normal text-foreground">
                <Icon name="repeat" size={12} className="text-primary" />
                <span className="font-semibold">Repeats</span>
                <span>{r.words ?? <code className="font-mono">{r.raw}</code>}</span>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      {occurrences.length ? (
        <ul data-slot="time-input-occurrences" aria-label="Upcoming" className="m-0 flex list-none flex-col gap-1 p-0 text-foreground">
          {occurrences.map((o, i) => (
            <li key={i} className="flex items-center gap-2 tabular-nums">
              <Icon name="calendar" size={14} className="text-foreground/70" />
              <span>{o}</span>
            </li>
          ))}
          {result.truncated ? <li className="pl-[22px] text-foreground/70">and more</li> : null}
        </ul>
      ) : null}

      {!found ? <p className="m-0 text-foreground/70">No date or time found in that text.</p> : null}

      {result.diagnostics.length ? (
        <ul data-slot="time-input-diagnostics" aria-label="Notes" className="m-0 flex list-none flex-col gap-1 p-0">
          {result.diagnostics.map((d, i) => {
            const quoted = fresh ? text.slice(d.start, d.end).trim() : '';
            return (
              <li key={i} data-severity={d.severity} className="flex items-start gap-1.5 text-foreground">
                <Icon name={d.severity === 'error' ? 'exclamation-circle' : 'warning'} size={14} className={cn('mt-[3px]', d.severity === 'error' ? 'text-destructive' : 'text-warning')} />
                <span>
                  <span className="sr-only">{d.severity === 'error' ? 'Error: ' : 'Warning: '}</span>
                  {d.message}
                  {quoted ? <> <q className="text-foreground/70">{quoted}</q></> : null}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}

      <p className="m-0 flex items-center gap-2 text-caption text-foreground/70">
        <span>Times in {timeZone}</span>
        {backend ? <Badge variant="outline" data-backend-label={backend}>{backend === 'webgpu' ? 'GPU' : 'CPU'}</Badge> : null}
      </p>
    </div>
  );
}
