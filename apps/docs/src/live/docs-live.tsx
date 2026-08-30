/* DocsLive — code + live preview blocks for the docs, ported from the prototype's DocsLive
   (project/workbench.jsx). The almost-node playground tab is omitted; Preview mounts the real
   packages in-page and Code shows the sample source. */
import { useEffect, useState, Component, type ReactNode } from 'react';
import { Segmented } from '@touchkit/ui';
import { MarkdownView, MONO, WFONT } from '@touchkit/workbench';
import { TKL, WBD, type LiveSpec } from './frame';
import { LIVE_CORE } from './live-core';
import { LIVE_BUI } from './live-bui';

export const LIVE: Record<string, LiveSpec> = { ...LIVE_CORE, ...LIVE_BUI };

class ErrB extends Component<{ label: string; children?: ReactNode }, { err: string | null }> {
  override state: { err: string | null } = { err: null };
  static getDerivedStateFromError(e: unknown) { return { err: String((e as any)?.message || e) }; }
  override render() {
    return this.state.err
      ? <div style={{ padding: 14, fontFamily: MONO, fontSize: 12, color: '#FF453A' }}>{this.props.label + ' failed: ' + this.state.err}</div>
      : this.props.children;
  }
}

export function DocsLive({ demo }: { demo: string }) {
  const spec = LIVE[demo] || null;
  const [tab, setTab] = useState('preview');
  useEffect(() => { setTab('preview'); }, [demo]);
  if (!spec) return null;
  const Render = spec.Render;
  const tabs = [{ id: 'preview', label: 'Preview' }, { id: 'code', label: 'Code' }];
  return (
    <div style={{ border: '1px solid rgba(20,20,40,.12)', borderRadius: 14, overflow: 'hidden', margin: '18px 0', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 8px 14px', borderBottom: '1px solid rgba(20,20,40,.08)', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 650, fontFamily: MONO, color: '#55555E' }}>{spec.title}</span>
        <span style={{ flex: 1 }} />
        <div style={{ ...TKL, width: 180, fontFamily: WFONT } as any}>
          <Segmented aria-label="Live block view" options={tabs} value={tab} onChange={setTab} />
        </div>
      </div>
      {tab === 'preview' ? (
        <div style={{
          ...(spec.theme === 'wb' ? WBD : TKL), background: spec.theme === 'wb' ? '#141419' : '#F2F2F7',
          colorScheme: spec.theme === 'wb' ? 'dark' : 'light', padding: 18, minHeight: spec.h - 90,
          fontFamily: WFONT, color: spec.theme === 'wb' ? '#EDEDF2' : '#0B0B0F', boxSizing: 'border-box',
          position: 'relative', overflow: 'hidden',
        } as any}>
          <ErrB label="preview"><Render /></ErrB>
        </div>
      ) : null}
      {tab === 'code' ? (
        <div style={{ padding: '4px 16px 10px' }}>
          <MarkdownView markdown={'```jsx\n' + spec.code + '\n```'} />
        </div>
      ) : null}
    </div>
  );
}
