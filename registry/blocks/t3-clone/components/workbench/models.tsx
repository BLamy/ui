import * as React from 'react';

/* ══ Model catalog — provider glyphs and the default Workbench model list ══
   ModelPicker is data-driven; these are the defaults WorkbenchComposer ships with. Hosts pass their own. */

export interface ModelProvider {
  id: string;
  name: string;
  /** A 1em glyph (inherits currentColor). */
  icon: React.ReactNode;
}

export interface ModelOption {
  id: string;
  name: string;
  /** A ModelProvider id. */
  provider: string;
  /** A short tag rendered as an outlined badge ("NEW"). */
  badge?: string;
  /** Listed under "Legacy models" instead of the provider tabs. */
  legacy?: boolean;
  /** 1–9: ⌘N picks it while the picker is open. */
  shortcut?: number;
}

type GlyphProps = React.SVGProps<SVGSVGElement> & { size?: number | string };

/** Anthropic's "A\" mark. */
export function AnthropicGlyph({ size = '1em', ...props }: GlyphProps) {
  return (
    <svg data-slot="anthropic-glyph" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M17.3 3.54h-3.67l6.7 16.92H24zM6.7 3.54 0 20.46h3.74l1.37-3.55h7.01l1.37 3.55h3.74L10.54 3.54zm-.37 10.22 2.29-5.94 2.29 5.94z" />
    </svg>
  );
}

/** An OpenAI-style knot: three rounded links at 60° steps. */
export function OpenAIGlyph({ size = '1em', ...props }: GlyphProps) {
  return (
    <svg data-slot="openai-glyph" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true" {...props}>
      {[0, 60, 120].map((a) => (
        <rect key={a} x="8.6" y="2.6" width="6.8" height="18.8" rx="3.4" transform={`rotate(${a} 12 12)`} />
      ))}
    </svg>
  );
}

/** A four-point sparkle (Gemini-style). */
export function SparkleGlyph({ size = '1em', ...props }: GlyphProps) {
  return (
    <svg data-slot="sparkle-glyph" width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 2c.6 5.4 4.6 9.4 10 10-5.4.6-9.4 4.6-10 10-.6-5.4-4.6-9.4-10-10 5.4-.6 9.4-4.6 10-10z" />
    </svg>
  );
}

export const WORKBENCH_PROVIDERS: ModelProvider[] = [
  { id: 'anthropic', name: 'Anthropic', icon: <AnthropicGlyph /> },
  { id: 'openai', name: 'OpenAI', icon: <OpenAIGlyph /> },
];

export const WORKBENCH_MODELS: ModelOption[] = [
  { id: 'claude-opus-5-5', name: 'Claude Opus 5.5', provider: 'anthropic', badge: 'NEW', shortcut: 1 },
  { id: 'claude-opus-4-7', name: 'Claude Opus 4.7', provider: 'anthropic', shortcut: 2 },
  { id: 'claude-sonnet-4-9', name: 'Claude Sonnet 4.9', provider: 'anthropic', shortcut: 3 },
  { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5', provider: 'anthropic', shortcut: 4 },
  { id: 'gpt-5-5', name: 'GPT-5.5', provider: 'openai', badge: 'NEW', shortcut: 5 },
  { id: 'gpt-5-5-mini', name: 'GPT-5.5 mini', provider: 'openai', shortcut: 6 },
  { id: 'gpt-5-codex', name: 'GPT-5 Codex', provider: 'openai', shortcut: 7 },
  { id: 'claude-opus-4-1', name: 'Claude Opus 4.1', provider: 'anthropic', legacy: true },
  { id: 'claude-sonnet-4', name: 'Claude Sonnet 4', provider: 'anthropic', legacy: true },
  { id: 'claude-3-7-sonnet', name: 'Claude 3.7 Sonnet', provider: 'anthropic', legacy: true },
  { id: 'gpt-4-1', name: 'GPT-4.1', provider: 'openai', legacy: true },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', legacy: true },
  { id: 'o3', name: 'o3', provider: 'openai', legacy: true },
  { id: 'o4-mini', name: 'o4-mini', provider: 'openai', legacy: true },
];
