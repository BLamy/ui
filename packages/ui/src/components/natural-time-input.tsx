'use client';
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react';
import { announce } from '@ui-sdk/core';
import { useFieldControl } from '@ui-sdk/react/field';
import type { VariantProps } from 'class-variance-authority';
import { Badge } from '@/components/ui/badge';
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
import { OccurrenceList, PreviewNote, ZoneNote, previewPanelVariants, previewSubtle } from '@/lib/schedule-preview';
import { cn } from '@/lib/utils';

/* ══ NaturalTimeInput — a text field that reads a date, a time or a recurrence written in English ("every weekday at
   9am", "Sat Sun 1pm-8pm") with gpu-time, and shows what it understood as you type: the words it recognised, the
   occurrences it resolved (formatted in the field's time zone), a "Repeats" chip for recurrences, and any
   diagnostics. It works with or without WebGPU (the model runs on the CPU unless the GPU is worth using), and the
   package loads on first use. It is a control: put it in a Field for its label, description and error, like an Input.
   (For a time typed part by part, see the date and time inputs.)

   <Field name="when">
     <FieldLabel>When</FieldLabel>
     <NaturalTimeInput timeZone="Europe/Paris" onParseChange={({ text, result, pending }) => … } />
   </Field>

   gpu-time is a small model and can resolve a wrong date without any diagnostic, so the preview lists the actual dates
   for the person to check; do not schedule anything consequential from the result unreviewed. ══ */

export interface NaturalTimeInputChange {
  /** The text in the field. */
  text: string;
  /** The parse of `text`; null while it is still parsing (`pending`), when the field is empty, or on `error`. */
  result: TimeParseResult | null;
  /** True between a keystroke and the parse of it settling. Empty text is never pending. */
  pending: boolean;
  /** Why parsing failed (an unknown time zone, say), or null. */
  error: Error | null;
}

/** How the text is read: gpu-time's grammar options and the wait after typing. */
export type NaturalTimeInputParseOptions = Pick<
  UseTimeParseOptions,
  'dateOrder' | 'backend' | 'weekStart' | 'bareWeekday' | 'bareWeekdays' | 'nextWeekday' | 'dayParts' | 'until' | 'debounceMs'
>;

export interface NaturalTimeInputProps
  extends Omit<InputProps, 'value' | 'defaultValue' | 'children' | 'className' | 'style' | 'render'> {
  /** Controlled text. Follow it with `onValueChange(text, details)`, the Input's own callback. */
  value?: string;
  /** Initial text when uncontrolled. */
  defaultValue?: string;
  /** Called on every keystroke with `result: null` and `pending: true`, and again with the result when the parse of
      that text settles. Read `result` only when `pending` is false. */
  onParseChange?: (change: NaturalTimeInputChange) => void;
  /** IANA zone the text is read and the dates are shown in. Default: this device's. */
  timeZone?: string;
  /** BCP 47 locale for dates and times in the preview. Default: the browser's. */
  locale?: string;
  /** The moment relative phrases count from ("tomorrow", "next Friday"): a Date, epoch milliseconds or an ISO
      string. Default: now. */
  reference?: UseTimeParseOptions['reference'];
  /** How many occurrences to list (the rest of a repeating schedule is summarised by its "Repeats" chip). Default: 5. */
  maxOccurrences?: number;
  /** gpu-time's options: `dateOrder`, `weekStart`, `dayParts`, `until`, `backend`, `debounceMs`… */
  parse?: NaturalTimeInputParseOptions;
  /** Show which backend ("CPU" or "GPU") parsed the text. Default: false. */
  showBackend?: boolean;
  /** `card` (default): the preview sits in an outlined well under the field (not the field's fill). `plain`: no surface. */
  variant?: VariantProps<typeof previewPanelVariants>['variant'];
  className?: string;
  style?: CSSProperties;
}

const SAMPLE = 'tomorrow at 3pm';

/** A natural-language time field with a live preview: the text is parsed (gpu-time) into dates and schedules. It goes
    in a form like any Input: `name`, `required`, `disabled` and the rest pass through, and inside a Field it takes the
    field's label, description, error and disabled state. A parser failure (an unknown time zone, say) marks it
    invalid and shows under it. */
export function NaturalTimeInput({
  value,
  defaultValue = '',
  onValueChange,
  onParseChange,
  placeholder = `e.g. ${SAMPLE}`,
  size,
  timeZone,
  locale,
  reference,
  maxOccurrences = 5,
  parse,
  showBackend = false,
  variant,
  className,
  style,
  disabled: disabledProp,
  'aria-label': ariaLabel,
  ...inputProps
}: NaturalTimeInputProps) {
  const field = useFieldControl();
  const disabled = disabledProp ?? field?.disabled;
  const [inner, setInner] = useState(defaultValue);
  const text = value ?? inner;
  const zone = useMemo(() => timeZone ?? browserTimeZone(), [timeZone]);
  const state = useTimeParse(text, { ...parse, reference, timeZone: zone, limit: maxOccurrences, enabled: !disabled });
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
  const errorId = useId();
  const trimmed = text.trim();
  const fresh = parsedText === text;
  const hasPreview = trimmed !== '' && result !== null;
  const describedBy = [inputProps['aria-describedby'], hasPreview ? previewId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div data-slot="natural-time-input" data-backend={usedBackend ?? undefined} data-pending={pending || undefined} className={cn('flex min-w-0 flex-col gap-2 text-footnote', className)} style={style}>
      <Input
        {...inputProps}
        value={value}
        defaultValue={value === undefined ? defaultValue : undefined}
        onValueChange={change}
        size={size}
        disabled={disabledProp}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        // Inside a Field its label names the box; alone, it needs a name of its own.
        aria-label={ariaLabel ?? (field ? undefined : 'Date or time')}
        aria-invalid={error ? true : inputProps['aria-invalid']}
        aria-describedby={describedBy}
      />
      {error ? <PreviewNote severity="error" data-slot="natural-time-input-error" className="px-1"><span id={errorId}>{error.message}</span></PreviewNote> : null}
      {hasPreview ? (
        <NaturalTimeInputPreview
          id={previewId}
          text={text}
          result={result}
          fresh={fresh}
          pending={pending}
          timeZone={zone}
          locale={locale}
          backend={showBackend ? usedBackend : null}
          variant={variant}
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

interface PreviewProps extends VariantProps<typeof previewPanelVariants> {
  id: string;
  text: string;
  result: TimeParseResult;
  fresh: boolean;
  pending: boolean;
  timeZone: string;
  locale?: string;
  backend: 'cpu' | 'webgpu' | null;
}

/** "Every weekday at 9:00 AM" reads "every weekday at 9:00 AM" after the chip's "Repeats". */
const lowerFirst = (words: string) => words.charAt(0).toLowerCase() + words.slice(1);

function NaturalTimeInputPreview({ id, text, result, fresh, pending, timeZone, locale, backend, variant }: PreviewProps) {
  const segments = useMemo(() => (fresh ? timeTextSegments(text, result.spans) : []), [result, fresh, text]);
  const occurrences = useMemo(() => result.occurrences.map((o, i) => ({ key: i, label: formatOccurrence(o, { timeZone, locale }) })), [result, timeZone, locale]);
  const rules = useMemo(
    () => result.rrules.map((r) => ({ raw: rruleLine(r), words: describeRecurrence(r, { locale, timeZone }) })),
    [result, locale, timeZone],
  );
  const found = occurrences.length > 0 || rules.length > 0;
  // The recognised words are worth showing when some of the text was left out, or the model is unsure of some: a row
  // that repeats the whole input, highlighted with confidence, says nothing new.
  const matched = segments.filter((s) => s.matched);
  const unsure = matched.some((s) => (s.confidence ?? 1) < 0.5);
  const whole = matched.length === 1 && matched[0]?.text.trim() === text.trim();
  const partial = matched.length > 0 && (unsure || !whole);
  return (
    <div id={id} data-slot="natural-time-input-preview" aria-busy={pending || undefined} data-stale={fresh ? undefined : ''} className={cn(previewPanelVariants({ variant }), 'transition-opacity', !fresh && 'opacity-60')}>
      {partial ? (
        <p data-slot="natural-time-input-recognized" className="m-0 wrap-anywhere text-foreground/70">
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
        <ul data-slot="natural-time-input-repeats" aria-label="Repeats" className="m-0 flex list-none flex-wrap gap-1.5 p-0">
          {rules.map((r, i) => (
            <li key={i} className="min-w-0 max-w-full">
              <Badge variant="tinted" title={r.raw} className="h-auto min-h-[22px] max-w-full py-1 leading-tight whitespace-normal text-foreground">
                <Icon name="repeat" size={12} className="text-primary" />
                <span className="font-semibold">Repeats</span>
                <span>{r.words ? lowerFirst(r.words) : <code className="font-mono">{r.raw}</code>}</span>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      {occurrences.length ? (
        <OccurrenceList data-slot="natural-time-input-occurrences" aria-label="Upcoming" icon="calendar" items={occurrences} more={result.truncated} />
      ) : null}

      {!found ? <p className={cn('m-0', previewSubtle)}>No date or time found in that text.</p> : null}

      {result.diagnostics.length ? (
        <ul data-slot="natural-time-input-diagnostics" aria-label="Notes" className="m-0 flex list-none flex-col gap-1 p-0">
          {result.diagnostics.map((d, i) => {
            const quoted = fresh ? text.slice(d.start, d.end).trim() : '';
            return (
              <li key={i} data-severity={d.severity}>
                <PreviewNote severity={d.severity === 'error' ? 'error' : 'warning'}>
                  {d.message}
                  {quoted ? <> <q className={previewSubtle}>{quoted}</q></> : null}
                </PreviewNote>
              </li>
            );
          })}
        </ul>
      ) : null}

      <ZoneNote zone={timeZone}>
        {backend ? <Badge variant="outline" className="ms-2 align-middle" data-backend-label={backend}>{backend === 'webgpu' ? 'GPU' : 'CPU'}</Badge> : null}
      </ZoneNote>
    </div>
  );
}
