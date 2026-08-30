/* 26 — PlanReview: editable step list the user approves before the agent runs */
import type { CSSProperties, ReactNode } from 'react';
import { BFONT, BIcon, BMONO, C, P, card, cn, mut, mut3, vib } from './base';

export interface PlanReviewProps {
  title?: ReactNode;
  onApprove?: () => void;
  onReject?: () => void;
  approved?: boolean;
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}
export function PlanReview({ title = 'Proposed plan', onApprove, onReject, approved, children, style, className }: PlanReviewProps) {
  return (
    <div data-slot="plan-review" className={cn(className)} style={card({ overflow: 'hidden', maxWidth: 480, ...style })}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px', borderBottom: '1px solid var(--wb-sep)' }}
      >
        <span style={{ color: C.orange, display: 'grid' }}>
          <BIcon d={P['bolt']} size={14} />
        </span>
        <span style={{ fontSize: 13, fontWeight: 650, color: 'var(--wb-label)', flex: 1 }}>{title}</span>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: approved ? C.green : C.orange }}>
          {approved ? 'APPROVED' : 'AWAITING REVIEW'}
        </span>
      </div>
      <div style={{ padding: '8px 10px' }}>{children}</div>
      {!approved && (
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '4px 12px 12px' }}>
          <button
            onClick={() => {
              vib([6]);
              onReject && onReject();
            }}
            style={{
              border: 0,
              borderRadius: 9,
              padding: '7px 13px',
              fontSize: 12.5,
              fontWeight: 650,
              cursor: 'pointer',
              fontFamily: BFONT,
              background: 'var(--wb-fill)',
              color: 'var(--wb-label)',
            }}
          >
            Reject
          </button>
          <button
            onClick={() => {
              vib([12]);
              onApprove && onApprove();
            }}
            style={{
              border: 0,
              borderRadius: 9,
              padding: '7px 15px',
              fontSize: 12.5,
              fontWeight: 650,
              cursor: 'pointer',
              fontFamily: BFONT,
              background: C.blue,
              color: '#fff',
            }}
          >
            Approve & run
          </button>
        </div>
      )}
    </div>
  );
}

export interface PlanReviewStepProps {
  n?: ReactNode;
  detail?: ReactNode;
  onUp?: (() => void) | null;
  onDown?: (() => void) | null;
  onRemove?: (() => void) | null;
  children?: ReactNode;
}
export function PlanReviewStep({ n, detail, onUp, onDown, onRemove, children }: PlanReviewStepProps) {
  return (
    <div
      data-slot="plan-review-step"
      className="bui-hl"
      style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', borderRadius: 9 }}
    >
      <span
        style={{
          width: 19,
          height: 19,
          borderRadius: 6,
          background: 'var(--wb-fill)',
          display: 'grid',
          placeItems: 'center',
          fontFamily: BMONO,
          fontSize: 10,
          color: mut,
          flexShrink: 0,
        }}
      >
        {n}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: 'var(--wb-label)', fontWeight: 600 }}>{children}</div>
        {detail && <div style={{ fontSize: 11, color: mut3, marginTop: 1 }}>{detail}</div>}
      </div>
      <span style={{ display: 'flex', gap: 1 }}>
        {onUp && (
          <button
            onClick={() => {
              vib([4]);
              onUp();
            }}
            aria-label="Move up"
            style={{ border: 0, background: 'none', color: mut3, cursor: 'pointer', padding: 3, display: 'grid' }}
          >
            <BIcon d={P['up']} size={12} />
          </button>
        )}
        {onDown && (
          <button
            onClick={() => {
              vib([4]);
              onDown();
            }}
            aria-label="Move down"
            style={{ border: 0, background: 'none', color: mut3, cursor: 'pointer', padding: 3, display: 'grid' }}
          >
            <BIcon d={P['down']} size={12} />
          </button>
        )}
        {onRemove && (
          <button
            onClick={() => {
              vib([6]);
              onRemove();
            }}
            aria-label="Remove"
            style={{ border: 0, background: 'none', color: mut3, cursor: 'pointer', padding: 3, display: 'grid' }}
          >
            <BIcon d={P['trash']} size={12} />
          </button>
        )}
      </span>
    </div>
  );
}
PlanReview.Step = PlanReviewStep;
