/* 28 — AgentBoard: parallel agents with live state */
import type { CSSProperties, ReactNode } from 'react';
import { BIcon, BMONO, C, Meter, P, card, cn, mut, mut3 } from './base';

export interface AgentBoardProps {
  children?: ReactNode;
  style?: CSSProperties;
  className?: string;
}
export function AgentBoard({ children, style, className }: AgentBoardProps) {
  return (
    <div
      data-slot="agent-board"
      className={cn(className)}
      style={{ ...card({ overflow: 'hidden', maxWidth: 500 }), display: 'grid', ...style }}
    >
      {children}
    </div>
  );
}

export type AgentBoardState = 'idle' | 'running' | 'done' | 'failed';
export interface AgentBoardAgentProps {
  name?: ReactNode;
  task?: ReactNode;
  state?: AgentBoardState;
  progress?: number | null;
  tone?: string;
}
export function AgentBoardAgent({ name, task, state = 'idle', progress, tone }: AgentBoardAgentProps) {
  const tc = tone || (state === 'done' ? C.green : state === 'failed' ? C.red : state === 'running' ? C.blue : mut3);
  return (
    <div
      data-slot="agent-board-agent"
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 13px', borderBottom: '1px solid var(--wb-sep)' }}
    >
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: 8,
          background: 'var(--wb-fill)',
          display: 'grid',
          placeItems: 'center',
          color: tc,
          flexShrink: 0,
        }}
      >
        <BIcon d={P['spark']} size={13} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--wb-label)' }}>{name}</div>
        <div style={{ fontSize: 11.5, color: mut, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {task}
        </div>
      </div>
      {state === 'running' && progress != null ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <Meter v={progress} tone={C.blue} />
          <span style={{ fontFamily: BMONO, fontSize: 10.5, color: mut3, width: 30, textAlign: 'right' }}>
            {Math.round(progress * 100)}%
          </span>
        </div>
      ) : state === 'running' ? (
        <span
          style={{
            width: 12,
            height: 12,
            border: '2px solid var(--wb-fill2)',
            borderTopColor: C.blue,
            borderRadius: '50%',
            animation: 'bui-spin .8s linear infinite',
          }}
        />
      ) : (
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 700,
            color: tc,
            background:
              state === 'done' ? 'rgba(50,215,75,.12)' : state === 'failed' ? 'rgba(255,69,58,.12)' : 'var(--wb-fill)',
            borderRadius: 6,
            padding: '2px 8px',
            textTransform: 'capitalize',
          }}
        >
          {state}
        </span>
      )}
    </div>
  );
}
AgentBoard.Agent = AgentBoardAgent;
