'use client';
import { useMemo, useRef, useState, type HTMLAttributes } from 'react';
import { PlainButton } from '@/components/ui/plain-button';
import {
  STRING_PREVIEW_LENGTH, copyTextOf, formatLength, fullLength, hiddenLength, nextShownLength, previewTokens,
  type ValuePreview, type ValueTint,
} from '@/lib/object-tree-value';
import { selectableText } from '@/lib/primitives';
import { cn } from '@/lib/utils';

/* ══ ObjectValue — a value's one-line preview, tinted by type as DevTools does.
   The value is plain data (`ValuePreview`), so it can come from another process; `previewFromValue` makes one from a
   live value. Long strings and error stacks are truncated, with Show more and Copy beside them.
   <ObjectValue value={{ type: 'string', value: 'hello' }} />
   <ObjectValue value={previewFromValue({ a: 1, b: [2, 3] })} /> ══ */

/** The tints share SyntaxHighlighting's token colors, so a value and the code next to it read alike. */
const TINTS: Record<ValueTint, string> = {
  string: 'bl-tok-string',
  number: 'bl-tok-number',
  keyword: 'bl-tok-keyword',
  nullish: 'text-muted-foreground',
  function: 'bl-tok-function',
  functionMark: 'bl-tok-keyword italic',
  symbol: 'bl-tok-constant',
  regexp: 'bl-tok-operator',
  date: 'bl-tok-type',
  error: 'text-destructive',
  className: 'bl-tok-type',
  key: 'text-muted-foreground',
  punctuation: 'text-muted-foreground',
  muted: 'text-muted-foreground',
  plain: '',
};

const linkButton =
  'ml-1.5 cursor-default border-0 bg-transparent p-0 font-sans text-caption2 font-medium whitespace-nowrap text-primary outline-none data-hovered:underline data-focus-visible:underline';

export interface ObjectValueProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  value: ValuePreview;
  /** Characters of a long string to show at first. Default 100. */
  maxLength?: number;
  /** Quote strings. `false` for the bare text a console shows for a top-level string. Default `true`. */
  quote?: boolean;
  /** Show more and Copy beside a long string or an error's stack. Off in a row of fixed height, as a tree's. Default `true`. */
  expandable?: boolean;
}

export function ObjectValue({ value, maxLength = STRING_PREVIEW_LENGTH, quote, expandable = true, className, style, ...props }: ObjectValueProps) {
  const [shown, setShown] = useState(maxLength);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const options = useMemo(() => ({ maxString: expandable ? shown : maxLength, quote, expanded }), [expandable, shown, maxLength, quote, expanded]);
  const tokens = useMemo(() => previewTokens(value, options), [value, options]);
  const hidden = expandable ? hiddenLength(value, shown, expanded) : 0;

  const showMore = () => {
    setExpanded(true);
    setShown((s) => nextShownLength(fullLength(value), s));
  };
  const copy = () => {
    void navigator.clipboard?.writeText(copyTextOf(value)).then(() => {
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1200);
    }, () => {});
  };

  return (
    <span
      data-slot="object-value"
      data-type={value.type}
      className={cn('font-mono text-caption break-words whitespace-pre-wrap', selectableText, className)}
      style={style}
      {...props}
    >
      {tokens.map((token, i) => (
        <span key={i} className={TINTS[token.tint]}>{token.text}</span>
      ))}
      {hidden > 0 ? (
        <>
          <PlainButton className={linkButton} onPress={showMore}>Show more ({formatLength(hidden)})</PlainButton>
          <PlainButton className={linkButton} onPress={copy}>{copied ? 'Copied' : 'Copy'}</PlainButton>
        </>
      ) : null}
    </span>
  );
}
