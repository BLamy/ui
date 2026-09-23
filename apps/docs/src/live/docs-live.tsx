/* DocsLive — the docs' live example card. Docstream's ReactDemo supplies the frame: a header (title, status,
   variant switch), the live preview mounted in-page, and a collapsible, line-numbered code panel. The preview
   area keeps a themed BL UI / Workbench surface that follows the docs' AppearanceProvider. */
import { Component, useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { ReactDemo } from '@brett_lamy/docstream/playground';
import { Segmented, useAppearance } from '@brett_lamy/ui';
import { MONO, WFONT, WorkbenchTheme } from '@brett_lamy/workbench';
import { BLDK, BLL, type LiveSpec, type LiveVariant } from './frame';
import { LIVE_CORE } from './live-core';

export const LIVE: Record<string, LiveSpec> = LIVE_CORE;

/* The docs present one public package; workspace package names stay internal (same rewrite as the markdown). */
export const publicCode = (code: string) => code.replace(/@brett_lamy\/(?:chatkit|workbench|pencilkit)\b/g, '@brett_lamy/ui');

class ErrB extends Component<{ label: string; children?: ReactNode }, { err: string | null }> {
  override state: { err: string | null } = { err: null };
  static getDerivedStateFromError(e: unknown) { return { err: String((e as any)?.message || e) }; }
  override render() {
    return this.state.err
      ? <div style={{ padding: 14, fontFamily: MONO, fontSize: 12, color: '#FF453A' }}>{this.props.label + ' failed: ' + this.state.err}</div>
      : this.props.children;
  }
}

/** A Segmented control for the card header, themed with the BL tokens for the current appearance. */
export function HeaderSwitch({ label, options, value, onChange, width }: {
  label: string; options: LiveVariant[]; value: string; onChange: (id: string) => void; width?: number;
}) {
  const dark = useAppearance() === 'dark';
  return (
    <div className="bl-live-switch" style={{ ...(dark ? BLDK : BLL), width: width ?? Math.max(150, options.length * 88), fontFamily: WFONT } as CSSProperties}>
      <Segmented aria-label={label} options={options} value={value} onChange={onChange} />
    </div>
  );
}

/** The themed stage a preview renders on: BL tokens (light/dark) or a Workbench root. */
export function LiveStage({ theme = 'bl', minHeight, bleed, children }: {
  theme?: 'bl' | 'wb'; minHeight?: number; bleed?: boolean; children?: ReactNode;
}) {
  const dark = useAppearance() === 'dark';
  const pad: CSSProperties = { padding: bleed ? 0 : 18, minHeight, boxSizing: 'border-box', position: 'relative', overflow: 'hidden' };
  if (theme === 'wb') {
    return <WorkbenchTheme className="bl-live-stage" style={pad}><ErrB label="preview">{children}</ErrB></WorkbenchTheme>;
  }
  return (
    <div className="bl-live-stage" style={{
      ...(dark ? BLDK : BLL), ...pad, background: 'var(--bl-bg2)', color: 'var(--bl-label)',
      colorScheme: dark ? 'dark' : 'light', fontFamily: WFONT,
    } as CSSProperties}>
      <ErrB label="preview">{children}</ErrB>
    </div>
  );
}

/** The shared card: Docstream's ReactDemo with an in-page preview. */
export function LiveCard({ title, code, status = 'live', actions, children }: {
  title: string; code: string; status?: string | false; actions?: ReactNode; children: ReactNode;
}) {
  return (
    <ReactDemo
      className="bl-live"
      title={title}
      status={status}
      actions={actions}
      preview={children}
      height="auto"
      code={publicCode(code)}
      language="tsx"
      collapsedCodeLines={3}
      expandedCodeLines={36}
    />
  );
}

export function DocsLive({ demo }: { demo: string }) {
  const spec = LIVE[demo] || null;
  const [variant, setVariant] = useState(spec?.variants?.[0]?.id ?? '');
  useEffect(() => { setVariant(LIVE[demo]?.variants?.[0]?.id ?? ''); }, [demo]);
  if (!spec) return null;
  const Render = spec.Render;
  const actions = spec.variants
    ? <HeaderSwitch label={spec.title + ' variant'} options={spec.variants} value={variant} onChange={setVariant} width={spec.variantsWidth} />
    : null;
  return (
    <LiveCard title={spec.title} code={spec.codeFor ? spec.codeFor(variant) : spec.code} status={spec.status} actions={actions}>
      <LiveStage theme={spec.theme} bleed={spec.bleed}>
        <Render variant={variant} />
      </LiveStage>
    </LiveCard>
  );
}
