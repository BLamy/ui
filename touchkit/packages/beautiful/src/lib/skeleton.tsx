/* 21 — Skeleton: auto mode — wrap any rendered subtree in <Skeleton loading> and it measures the
   layout (text lines, avatars, chips, images) and generates matching shimmer blocks */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

const SKGRAD = 'linear-gradient(90deg, var(--wb-fill) 30%, var(--wb-fill2) 50%, var(--wb-fill) 70%)';

export interface SkeletonProps {
  loading?: boolean;
  children?: ReactNode;
  w?: number | string;
  h?: number | string;
  r?: number | string;
  style?: CSSProperties;
}
export function Skeleton(props: SkeletonProps) {
  if (props.children !== undefined) return <AutoSkeleton {...props} />;
  const w = props.w == null ? '100%' : props.w,
    h = props.h == null ? 14 : props.h,
    r = props.r == null ? 6 : props.r;
  return (
    <span
      data-slot="skeleton"
      style={{
        display: 'block',
        width: w,
        height: h,
        borderRadius: r,
        background: SKGRAD,
        backgroundSize: '200% 100%',
        animation: 'bui-sweep 1.4s linear infinite',
        ...props.style,
      }}
    />
  );
}

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  r: number;
}
export function AutoSkeleton({ loading = true, children, style }: SkeletonProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [blocks, setBlocks] = useState<Block[] | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!loading || !el) {
      setBlocks(null);
      return;
    }
    const measure = () => {
      const root = el.getBoundingClientRect();
      if (!root.width) return;
      const out: Block[] = [];
      const pushRect = (x: number, y: number, w: number, h: number, r: number) => {
        if (w > 3 && h > 3 && out.length < 140) out.push({ x: x - root.left, y: y - root.top, w, h, r });
      };
      const walk = (node: Node) => {
        for (const c of Array.from(node.childNodes)) {
          if (out.length >= 140) return;
          if (c.nodeType === 3) {
            if (!c.textContent || !c.textContent.trim()) continue;
            const rg = document.createRange();
            rg.selectNodeContents(c);
            for (const lr of Array.from(rg.getClientRects()))
              pushRect(lr.left, lr.top + lr.height * 0.14, lr.width, lr.height * 0.72, 4);
            continue;
          }
          if (c.nodeType !== 1) continue;
          const elc = c as HTMLElement;
          const cs = getComputedStyle(elc);
          if (cs.display === 'none') continue;
          const hasEl = Array.from(elc.childNodes).some((n) => n.nodeType === 1);
          const bg =
            cs.backgroundImage !== 'none' ||
            (cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent');
          if (/^(IMG|svg|CANVAS|VIDEO|BUTTON|INPUT|TEXTAREA|SELECT)$/.test(elc.tagName) || (!hasEl && bg)) {
            const r = elc.getBoundingClientRect();
            const br = parseFloat(cs.borderRadius) || 0;
            pushRect(r.left, r.top, r.width, r.height, br >= Math.min(r.width, r.height) / 2 ? 999 : Math.max(br, 4));
          } else walk(elc);
        }
      };
      walk(el);
      setBlocks(out);
    };
    measure();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(el);
    return () => {
      if (ro) ro.disconnect();
    };
  }, [loading]);
  return (
    <span data-slot="skeleton-auto" style={{ position: 'relative', display: 'block', ...style }}>
      <span
        ref={ref}
        aria-hidden={loading ? true : undefined}
        style={{ display: 'block', opacity: loading ? 0 : 1, pointerEvents: loading ? 'none' : 'auto', transition: 'opacity .25s' }}
      >
        {children}
      </span>
      {loading &&
        blocks &&
        blocks.map((b, i) => (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: b.x,
              top: b.y,
              width: b.w,
              height: b.h,
              borderRadius: b.r,
              background: SKGRAD,
              backgroundSize: '200% 100%',
              animation: 'bui-sweep 1.4s linear infinite',
            }}
          />
        ))}
    </span>
  );
}

export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <span data-slot="skeleton-text" style={{ display: 'grid', gap: 7 }}>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} h={11} w={i === lines - 1 ? '62%' : '100%'} />
      ))}
    </span>
  );
}
export function SkeletonAvatar({ size = 32 }: { size?: number }) {
  return <Skeleton w={size} h={size} r="50%" />;
}
Skeleton.Text = SkeletonText;
Skeleton.Avatar = SkeletonAvatar;
