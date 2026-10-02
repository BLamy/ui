import type { CSSProperties, ReactNode } from 'react';

/* ══ Spinner shapes — BL UI's own loaders ══
   Thirteen small animations, three variants each, drawn on the same 24px grid as the ported loaders in spinner.tsx
   and driven the same way: a table says how long a cycle is and when each part starts, the component writes those as
   custom properties (--bl-ld-d, --bl-ld-delay …), and the keyframes in styles.css (`bl-ld-*`) read them. They are
   original designs, made after the *ideas* in the gallery at https://loading.daniasyrofi.com (a cradle, an hourglass,
   a balance beam, a stair climb …) without using any of its code. */

interface Variant {
  /** One cycle, in ms. */
  duration: number;
  /** When each part starts within the cycle, in ms (one per part). */
  delays: number[];
  /** Extra custom properties the keyframes read (balance angles, ring speeds …). */
  vars?: CSSProperties;
}

const tick = (n: number, step: number, from = 0) => Array.from({ length: n }, (_, i) => from + i * step);

/** The beam's four angles → the matching vertical offsets of the two pans (9 units from the pivot). */
const beam = (angles: [number, number, number, number]): CSSProperties => {
  const out: Record<string, string> = {};
  angles.forEach((a, i) => {
    const dy = 9 * Math.sin((a * Math.PI) / 180);
    out[`--bl-ld-a${i}`] = `${a}deg`;
    out[`--bl-ld-l${i}`] = `${(-dy).toFixed(2)}px`;
    out[`--bl-ld-r${i}`] = `${dy.toFixed(2)}px`;
  });
  return out as CSSProperties;
};

/** Eight dots round a ring of radius 8.5, as translations from the center. */
const RING = Array.from({ length: 8 }, (_, i) => {
  const a = (i * Math.PI) / 4 - Math.PI / 2;
  return { x: +(8.5 * Math.cos(a)).toFixed(2), y: +(8.5 * Math.sin(a)).toFixed(2) };
});
/** Thirteen dots on the golden-angle spiral (the sunflower arrangement). */
const SPIRAL = Array.from({ length: 13 }, (_, i) => {
  const a = (i * 137.508 * Math.PI) / 180;
  const r = 2.85 * Math.sqrt(i);
  return { x: +(r * Math.cos(a)).toFixed(2), y: +(r * Math.sin(a)).toFixed(2) };
});
/** The six corners of a hexagon of radius 9 about (12, 12), top first. */
const HEX = Array.from({ length: 6 }, (_, i) => {
  const a = ((-90 + i * 60) * Math.PI) / 180;
  return { x: +(12 + 9 * Math.cos(a)).toFixed(2), y: +(12 + 9 * Math.sin(a)).toFixed(2) };
});

const at = (v: Variant, i: number): CSSProperties => ({ '--bl-ld-d': `${v.duration}ms`, '--bl-ld-delay': `${v.delays[i] ?? 0}ms` }) as CSSProperties;
const vars = (v: Variant, i: number, extra?: Record<string, string | number>): CSSProperties => ({ ...at(v, i), ...extra }) as CSSProperties;
const svg = (name: string, children: ReactNode) => (
  <svg className="bl-ld-svg" viewBox="0 0 24 24" data-variant={name} aria-hidden="true">{children}</svg>
);

interface Shape {
  label: string;
  variants: Record<string, Variant>;
  render: (name: string, v: Variant) => ReactNode;
}

export const SHAPES = {
  /* A stair with a marker that climbs, descends, or leaves marks behind. */
  steps: {
    label: 'Steps',
    variants: {
      climb: { duration: 1200, delays: tick(4, 150) },
      descend: { duration: 1200, delays: tick(4, 150).reverse() },
      mark: { duration: 1800, delays: tick(4, 220) },
    },
    render: (name, v) => svg(name, (
      <>
        <path className="bl-ld-st-path" d="M2.5 20.5H8V16.5H13V12.5H18V8.5H23" />
        {[[5.2, 18.6], [10.5, 14.6], [15.5, 10.6], [20.5, 6.6]].map(([cx, cy], i) => (
          <circle key={i} className="bl-ld-a bl-ld-fb bl-ld-st-dot" cx={cx} cy={cy} r="1.7" style={at(v, i)} />
        ))}
      </>
    )),
  },

  /* Newton's cradle: the end balls swing in turn. */
  cradle: {
    label: 'Cradle',
    variants: {
      transfer: { duration: 1500, delays: [0, 0, 0, 0, 0] },
      reverse: { duration: 1500, delays: [750, 0, 0, 0, 750] },
      double: { duration: 1700, delays: [0, 0, 0, 0, 0] },
    },
    render: (name, v) => {
      const roles = name === 'double' ? ['l', 'l', 's', 'r', 'r'] : ['l', 's', 's', 's', 'r'];
      return svg(name, (
        <>
          <line className="bl-ld-cr-bar" x1="2" y1="4" x2="22" y2="4" />
          {roles.map((role, i) => {
            const x = 3.2 + i * 4.4;
            return (
              <g key={i} className={role === 's' ? 'bl-ld-cr-arm' : 'bl-ld-a bl-ld-cr-arm'} data-role={role} style={{ ...at(v, i), '--bl-ld-ox': `${x}px` } as CSSProperties}>
                <line className="bl-ld-cr-string" x1={x} y1="4" x2={x} y2="14.2" />
                <circle className="bl-ld-cr-ball" cx={x} cy="16" r="2.1" />
              </g>
            );
          })}
        </>
      ));
    },
  },

  /* An hourglass: the sand runs down and the glass turns over. */
  hourglass: {
    label: 'Hourglass',
    variants: {
      flip: { duration: 2000, delays: [0, 0, 0, 0] },
      slow: { duration: 3000, delays: [0, 0, 0, 0] },
      grains: { duration: 1500, delays: [0, 300, 600, 0] },
    },
    render: (name, v) => svg(name, (
      <g className="bl-ld-a bl-ld-hg-glass" style={at(v, 3)}>
        <path className="bl-ld-hg-frame" d="M6.5 3h11M6.5 21h11M8 3c0 5.4 4 6.4 4 9s-4 3.6-4 9M16 3c0 5.4-4 6.4-4 9s4 3.6 4 9" />
        {name === 'grains' ? (
          [0, 1, 2].map((i) => <circle key={i} className="bl-ld-a bl-ld-hg-grain" cx={12} cy={11} r="0.9" style={at(v, i)} />)
        ) : (
          <>
            <polygon className="bl-ld-a bl-ld-hg-top" points="8.9,4.7 15.1,4.7 12,10.4" style={at(v, 0)} />
            <polygon className="bl-ld-a bl-ld-hg-bottom" points="8.9,19.3 15.1,19.3 12,13.6" style={at(v, 1)} />
            <line className="bl-ld-a bl-ld-hg-stream" x1="12" y1="10.6" x2="12" y2="18.8" style={at(v, 2)} />
          </>
        )}
      </g>
    )),
  },

  /* A beam balance that tips, settles, or weighs. */
  balance: {
    label: 'Balance',
    variants: {
      tilt: { duration: 2200, delays: [0, 0, 0], vars: beam([-12, -12, 12, 12]) },
      settle: { duration: 2600, delays: [0, 0, 0], vars: beam([17, -9, 3.5, 0]) },
      weigh: { duration: 3000, delays: [0, 0, 0], vars: beam([0, 14, 0, -14]) },
    },
    render: (name, v) => svg(name, (
      <g style={v.vars}>
        <path className="bl-ld-ba-stand" d="M12 8.5L8.6 20.5H15.4Z" />
        <g className="bl-ld-a bl-ld-ba-beam" style={at(v, 0)}>
          <line className="bl-ld-ba-line" x1="3" y1="8" x2="21" y2="8" />
        </g>
        <g className="bl-ld-a bl-ld-ba-pan" style={at(v, 1)} data-side="l">
          <path className="bl-ld-ba-line" d="M3 8L0.8 13.2M3 8L5.2 13.2M0.6 13.2Q3 16.6 5.4 13.2Z" />
        </g>
        <g className="bl-ld-a bl-ld-ba-pan" style={at(v, 2)} data-side="r">
          <path className="bl-ld-ba-line" d="M21 8L18.8 13.2M21 8L23.2 13.2M18.6 13.2Q21 16.6 23.4 13.2Z" />
        </g>
        <circle className="bl-ld-ba-pivot" cx="12" cy="8" r="1.3" />
      </g>
    )),
  },

  /* A root that fans out to three results. */
  fanout: {
    label: 'Fanout',
    variants: {
      search: { duration: 1800, delays: [0, 130, 260, 0] },
      collect: { duration: 1800, delays: [0, 130, 260, 520] },
      rank: { duration: 1900, delays: [0, 200, 400, 0] },
    },
    render: (name, v) => svg(name, (
      <>
        {[5, 12, 19].map((y, i) => (
          <path key={y} className="bl-ld-a bl-ld-fo-line" pathLength={1} d={`M5.8 12C11 12 12 ${y} 17.6 ${y}`} style={at(v, i)} />
        ))}
        <circle className="bl-ld-a bl-ld-fb bl-ld-fo-root" cx="4" cy="12" r="1.9" style={at(v, 3)} />
        {[5, 12, 19].map((y, i) => (
          <circle key={y} className="bl-ld-a bl-ld-fb bl-ld-fo-leaf" cx="19.6" cy={y} r="1.6" style={vars(v, i, { '--bl-ld-peak': [1.7, 1.4, 1.1][i] })} />
        ))}
      </>
    )),
  },

  /* A battery whose segments fill, drain, or breathe. */
  battery: {
    label: 'Battery',
    variants: {
      charge: { duration: 1900, delays: tick(4, 170) },
      drain: { duration: 1900, delays: tick(4, 190).reverse() },
      pulse: { duration: 1500, delays: [0, 0, 0, 0] },
    },
    render: (name, v) => svg(name, (
      <>
        <rect className={name === 'pulse' ? 'bl-ld-a bl-ld-ba2-body' : 'bl-ld-ba2-body'} x="2.5" y="7" width="17" height="10" rx="2.3" style={at(v, 0)} />
        <rect className="bl-ld-ba2-cap" x="20.6" y="10.2" width="1.7" height="3.6" rx="0.8" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} className="bl-ld-a bl-ld-fb bl-ld-ba2-cell" x={4.5 + i * 3.7} y="9.2" width="3" height="5.6" rx="0.9" style={at(v, i)} />
        ))}
      </>
    )),
  },

  /* Thirteen dots on a sunflower spiral that open in turn. */
  bloom: {
    label: 'Bloom',
    variants: {
      grow: { duration: 1700, delays: tick(13, 80) },
      ripple: { duration: 1700, delays: tick(13, 80).reverse() },
      spin: { duration: 1900, delays: tick(13, 90) },
    },
    render: (name, v) => (
      <span className="bl-ld-bloom" data-variant={name} style={at(v, 0)}>
        {SPIRAL.map((p, i) => (
          <span key={i} className="bl-ld-a bl-ld-bloom-dot" style={vars(v, i, { '--bl-ld-x': `${p.x}px`, '--bl-ld-y': `${p.y}px` })} />
        ))}
      </span>
    ),
  },

  /* A radar disc: a sweeping arm with blips, or rings that ping outward. */
  sonar: {
    label: 'Sonar',
    variants: {
      // Blip delays are the arm's angle when it passes (angle / 360 × 2000ms), so each blip lights as the arm sweeps over it.
      sweep: { duration: 2000, delays: [0, 270, 1280, 880] },
      pulse: { duration: 2100, delays: [0, 700, 1400] },
      ping: { duration: 2400, delays: [0, 1200, 0] },
    },
    render: (name, v) => (
      <span className="bl-ld-sonar" data-variant={name} style={at(v, 0)}>
        {name === 'sweep' ? (
          <>
            <span className="bl-ld-so-ring" style={{ '--bl-ld-w': '22px' } as CSSProperties} />
            <span className="bl-ld-so-ring" style={{ '--bl-ld-w': '12px' } as CSSProperties} />
            <span className="bl-ld-so-arm" style={at(v, 0)} />
            {[[7, -6], [-6, 5], [3, 8]].map(([x, y], i) => (
              <span key={i} className="bl-ld-a bl-ld-so-blip" style={vars(v, i + 1, { '--bl-ld-x': `${x}px`, '--bl-ld-y': `${y}px` })} />
            ))}
          </>
        ) : (
          <>
            <span className="bl-ld-so-core" />
            {(name === 'pulse' ? [0, 1, 2] : [0, 1]).map((i) => <span key={i} className="bl-ld-a bl-ld-so-wave" style={at(v, i)} />)}
          </>
        )}
      </span>
    ),
  },

  /* Three rings turning about different axes. */
  gyro: {
    label: 'Gyro',
    variants: {
      // h1 / h2: the angle at 40% and 60% of the cycle. Equal angles hold; 144° and 216° make a steady spin.
      spin: { duration: 2400, delays: [0, 0, 0], vars: { '--bl-ld-d0': '2600ms', '--bl-ld-d1': '2000ms', '--bl-ld-d2': '3200ms', '--bl-ld-h1': '144deg', '--bl-ld-h2': '216deg' } as CSSProperties },
      tumble: { duration: 2600, delays: [0, 260, 520], vars: { '--bl-ld-d0': '2600ms', '--bl-ld-d1': '2600ms', '--bl-ld-d2': '2600ms', '--bl-ld-h1': '180deg', '--bl-ld-h2': '180deg' } as CSSProperties },
      settle: { duration: 2200, delays: [0, 180, 360], vars: { '--bl-ld-d0': '2200ms', '--bl-ld-d1': '2200ms', '--bl-ld-d2': '2200ms', '--bl-ld-h1': '360deg', '--bl-ld-h2': '360deg' } as CSSProperties },
    },
    render: (name, v) => (
      <span className="bl-ld-gyro" data-variant={name} style={v.vars}>
        {[22, 15, 8].map((w, i) => (
          <span key={w} className="bl-ld-a bl-ld-gy-ring" data-ring={i} style={{ ...at(v, i), '--bl-ld-w': `${w}px`, '--bl-ld-d': `var(--bl-ld-d${i})` } as CSSProperties} />
        ))}
      </span>
    ),
  },

  /* Eight dots that gather into a core, burst outward, or ripple in. */
  coalesce: {
    label: 'Coalesce',
    variants: {
      gather: { duration: 1800, delays: tick(8, 0) },
      burst: { duration: 1900, delays: tick(8, 0) },
      ripple: { duration: 1900, delays: tick(8, 110) },
    },
    render: (name, v) => (
      <span className="bl-ld-coalesce" data-variant={name}>
        {RING.map((p, i) => (
          <span key={i} className="bl-ld-a bl-ld-co-dot" style={vars(v, i, { '--bl-ld-x': `${p.x}px`, '--bl-ld-y': `${p.y}px` })} />
        ))}
      </span>
    ),
  },

  /* A hexagon whose six facets light up. */
  crystal: {
    label: 'Crystal',
    variants: {
      grow: { duration: 1900, delays: tick(6, 150) },
      mirror: { duration: 1900, delays: [0, 170, 340, 510, 340, 170] },
      shimmer: { duration: 1700, delays: [0, 850, 0, 850, 0, 850] },
    },
    render: (name, v) => svg(name, (
      <>
        {HEX.map((p, i) => {
          const q = HEX[(i + 1) % 6];
          return <polygon key={i} className="bl-ld-a bl-ld-ct-facet" points={`12,12 ${p.x},${p.y} ${q.x},${q.y}`} style={at(v, i)} />;
        })}
        <polygon className="bl-ld-ct-frame" points={HEX.map((p) => `${p.x},${p.y}`).join(' ')} />
      </>
    )),
  },

  /* A light that runs round an infinity loop. */
  loop: {
    label: 'Loop',
    variants: {
      run: { duration: 1800, delays: [0] },
      trail: { duration: 1800, delays: [0, 90, 180] },
      pair: { duration: 2000, delays: [0] },
    },
    render: (name, v) => {
      const d = 'M12 12c-2.5-3.5-4.6-5-6.5-5C3.4 7 2 9.2 2 12s1.4 5 3.5 5c1.9 0 4-1.5 6.5-5s4.6-5 6.5-5c2.1 0 3.5 2.2 3.5 5s-1.4 5-3.5 5c-1.9 0-4-1.5-6.5-5z';
      const runners = name === 'trail' ? [0, 1, 2] : [0];
      return svg(name, (
        <>
          <path className="bl-ld-lp-track" d={d} />
          {runners.map((i) => (
            <path key={i} className="bl-ld-a bl-ld-lp-run" pathLength={1} d={d} style={vars(v, i, { '--bl-ld-o': [1, 0.5, 0.22][i] })} />
          ))}
        </>
      ));
    },
  },

  /* Three nodes passing a pulse along. */
  relay: {
    label: 'Relay',
    variants: {
      hop: { duration: 1500, delays: [0, 0, 0] },
      bounce: { duration: 1800, delays: [0, 0, 0] },
      flow: { duration: 1500, delays: [0, 0, 0] },
    },
    render: (name, v) => svg(name, (
      <>
        <line className="bl-ld-a bl-ld-rl-link" x1="6.4" y1="12" x2="9.6" y2="12" style={at(v, 0)} data-link="0" />
        <line className="bl-ld-a bl-ld-rl-link" x1="14.4" y1="12" x2="17.6" y2="12" style={at(v, 1)} data-link="1" />
        {[4, 12, 20].map((cx, i) => (
          <circle key={cx} className="bl-ld-a bl-ld-fb bl-ld-rl-node" data-node={i} cx={cx} cy="12" r="2.2" style={at(v, i)} />
        ))}
      </>
    )),
  },
} satisfies Record<string, Shape>;

export type ShapeAnimation = keyof typeof SHAPES;
export type ShapeVariant = { [A in ShapeAnimation]: keyof (typeof SHAPES)[A]['variants'] }[ShapeAnimation];

export const SHAPE_IDS = Object.keys(SHAPES) as ShapeAnimation[];

/** Draws one of the shapes; an unknown variant falls back to the first. */
export function ShapeLoader({ animation, variant }: { animation: ShapeAnimation; variant: string }) {
  const shape = SHAPES[animation] as Shape;
  const name = shape.variants[variant] ? variant : Object.keys(shape.variants)[0];
  return <>{shape.render(name, shape.variants[name])}</>;
}
